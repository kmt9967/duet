import assert from "node:assert/strict";
import { test, describe } from "node:test";

import {
  UtteranceAggregator,
  joinSegments,
  DEFAULT_SILENCE_MS,
} from "../src/lib/voice/utterance";
import { parseCommand } from "../src/lib/language/parser";

/**
 * Regression suite for the production bug where every `AddTranscript` message
 * was treated as a complete command.
 *
 * Speechmatics commits transcripts incrementally, so "Set the dinner table."
 * arrives as several segments. The exact sequences below are taken from the
 * recorded live session in evidence/speechmatics/live-test.json.
 */

/** Real segment sequences returned by the live API. */
const LIVE = {
  setTheTable: ["Set", "the", "dinner table."],
  crossTransfer: ["Pick", "up the", "mug and", "place", "it on", "the right", "setting."],
  briefExample: ["Open", "the top", "drawer.", "Pick up", "the plate", "with", "arm.", "Place it on", "the", "table."],
  stop: ["Stop."],
  fork: ["Place the", "fork on", "the", "right setting."],
};

describe("joinSegments", () => {
  test("reassembles the live 'set the dinner table' sequence", () => {
    assert.equal(joinSegments(LIVE.setTheTable), "Set the dinner table.");
  });

  test("pulls punctuation back onto the preceding word", () => {
    assert.equal(joinSegments(["Stop", " ."]), "Stop.");
    assert.equal(joinSegments(["Is it safe", " ?"]), "Is it safe?");
  });

  test("collapses stray whitespace and ignores empty segments", () => {
    assert.equal(joinSegments(["  Pick ", "", "   up  ", "the mug"]), "Pick up the mug");
  });
});

describe("many partials then one final", () => {
  test("multiple segments produce exactly one utterance", () => {
    const agg = new UtteranceAggregator();
    for (const segment of LIVE.setTheTable) agg.addFinalSegment(segment, 0);

    // Nothing may be emitted until the boundary arrives.
    assert.equal(agg.hasPending, true);

    const first = agg.complete();
    assert.equal(first, "Set the dinner table.");

    // And nothing further.
    assert.equal(agg.complete(), null);
  });

  test("the buffered caption grows as segments commit", () => {
    const agg = new UtteranceAggregator();
    agg.addFinalSegment("Set", 0);
    assert.equal(agg.buffered, "Set");
    agg.addFinalSegment("the", 0);
    assert.equal(agg.buffered, "Set the");
    agg.addFinalSegment("dinner table.", 0);
    assert.equal(agg.buffered, "Set the dinner table.");
  });

  test("each live sequence yields one actionable command, not fragments", () => {
    for (const [name, segments] of Object.entries(LIVE)) {
      const agg = new UtteranceAggregator();
      for (const s of segments) agg.addFinalSegment(s, 0);
      const utterance = agg.complete();
      assert.ok(utterance, `${name} produced no utterance`);

      const parsed = parseCommand(utterance!);
      assert.equal(
        parsed.diagnostics.length,
        0,
        `${name}: "${utterance}" produced diagnostics ${JSON.stringify(parsed.diagnostics)}`,
      );
      assert.ok(parsed.intents.length > 0, `${name} produced no intents`);
    }
  });

  test("individual fragments would have been rejected — the bug this prevents", () => {
    // This is the production failure in miniature. Dispatching per segment put
    // "Set", "the" and "dinner table." through the planner as three separate
    // commands. Not one of them is interpretable alone, so all three were
    // rejected and all three landed in the command log — while the sentence
    // the operator actually spoke never ran.
    const rejected = LIVE.setTheTable.filter(
      (fragment) => parseCommand(fragment).intents.length === 0,
    );
    assert.deepEqual(rejected, LIVE.setTheTable);

    // Reassembled, the very same segments are a valid command.
    assert.equal(
      parseCommand(joinSegments(LIVE.setTheTable)).intents[0]?.kind,
      "set_table",
    );
  });
});

describe("duplicate final events", () => {
  test("a second boundary for the same utterance emits nothing", () => {
    const agg = new UtteranceAggregator();
    agg.addFinalSegment("Set the dinner table.", 0);

    assert.equal(agg.complete(), "Set the dinner table.");
    assert.equal(agg.complete(), null);
    assert.equal(agg.complete(), null);
  });

  test("a boundary racing the silence timer cannot double-emit", () => {
    const agg = new UtteranceAggregator({ silenceMs: 100 });
    agg.addFinalSegment("Stop.", 0);

    // Server boundary wins.
    assert.equal(agg.complete(), "Stop.");
    // Timer fires afterwards and finds nothing.
    assert.equal(agg.completeIfSilent(10_000), null);
  });

  test("repeating a phrase genuinely still produces two commands", () => {
    // Dedupe must not be text-based: saying "Stop." twice is legitimate.
    const agg = new UtteranceAggregator();
    agg.addFinalSegment("Stop.", 0);
    assert.equal(agg.complete(), "Stop.");
    agg.addFinalSegment("Stop.", 5000);
    assert.equal(agg.complete(), "Stop.");
  });
});

describe("incomplete or empty finals", () => {
  test("whitespace-only segments never buffer", () => {
    const agg = new UtteranceAggregator();
    agg.addFinalSegment("   ", 0);
    agg.addFinalSegment("", 0);
    assert.equal(agg.hasPending, false);
    assert.equal(agg.complete(), null);
  });

  test("an utterance of pure punctuation is not emitted", () => {
    const agg = new UtteranceAggregator();
    agg.addFinalSegment(".", 0);
    agg.addFinalSegment("?", 0);
    assert.equal(agg.complete(), null);
  });

  test("reset discards a partially spoken utterance", () => {
    const agg = new UtteranceAggregator();
    agg.addFinalSegment("Pick up the", 0);
    agg.reset();
    assert.equal(agg.hasPending, false);
    assert.equal(agg.complete(), null);
  });
});

describe("silence fallback", () => {
  test("does not emit before the silence window elapses", () => {
    const agg = new UtteranceAggregator({ silenceMs: 1000 });
    agg.addFinalSegment("Set the dinner table.", 1000);
    assert.equal(agg.completeIfSilent(1500), null);
  });

  test("emits once the window elapses", () => {
    const agg = new UtteranceAggregator({ silenceMs: 1000 });
    agg.addFinalSegment("Set the dinner table.", 1000);
    assert.equal(agg.completeIfSilent(2000), "Set the dinner table.");
  });

  test("a later segment extends the window rather than splitting the sentence", () => {
    const agg = new UtteranceAggregator({ silenceMs: 1000 });
    agg.addFinalSegment("Set", 1000);
    assert.equal(agg.completeIfSilent(1800), null);
    agg.addFinalSegment("the dinner table.", 1800);
    assert.equal(agg.completeIfSilent(2500), null);
    assert.equal(agg.completeIfSilent(2900), "Set the dinner table.");
  });

  test("an idle aggregator never emits", () => {
    const agg = new UtteranceAggregator();
    assert.equal(agg.completeIfSilent(Number.MAX_SAFE_INTEGER), null);
  });

  test("the default window is long enough to span mid-sentence commits", () => {
    // Live segments arrived roughly 300-600ms apart; the window must exceed
    // that or a sentence would be cut in half.
    assert.ok(DEFAULT_SILENCE_MS >= 1000);
  });
});

describe("control commands and sequential utterances", () => {
  test("'Stop.' aggregates to a single stop intent", () => {
    const agg = new UtteranceAggregator();
    agg.addFinalSegment("Stop.", 0);
    const text = agg.complete()!;
    assert.equal(parseCommand(text).intents[0]?.kind, "stop");
  });

  test("'Continue.' arrives as segments and resolves to resume", () => {
    // Live transcripts split even short words from their punctuation.
    const agg = new UtteranceAggregator();
    agg.addFinalSegment("Continue", 0);
    agg.addFinalSegment(".", 0);
    const text = agg.complete();
    assert.equal(text, "Continue.");
    assert.equal(parseCommand(text!).intents[0]?.kind, "resume");
  });

  test("resume synonyms all map to the same control intent", () => {
    for (const phrase of ["continue", "resume", "carry on", "go on", "keep going"]) {
      assert.equal(
        parseCommand(phrase).intents[0]?.kind,
        "resume",
        `"${phrase}" did not resolve to resume`,
      );
    }
  });

  test("'carry on' is not mistaken for a carry-and-place", () => {
    const parsed = parseCommand("carry on");
    assert.equal(parsed.intents.length, 1);
    assert.equal(parsed.intents[0]?.kind, "resume");
  });

  test("three sentences in a row produce three distinct commands", () => {
    const agg = new UtteranceAggregator();
    const spoken = [LIVE.setTheTable, LIVE.stop, LIVE.crossTransfer];
    const emitted: string[] = [];

    for (const segments of spoken) {
      for (const s of segments) agg.addFinalSegment(s, 0);
      const utterance = agg.complete();
      if (utterance) emitted.push(utterance);
    }

    assert.deepEqual(emitted, [
      "Set the dinner table.",
      "Stop.",
      "Pick up the mug and place it on the right setting.",
    ]);
  });

  test("a new utterance starts clean after the previous one is emitted", () => {
    const agg = new UtteranceAggregator();
    agg.addFinalSegment("Stop.", 0);
    agg.complete();
    agg.addFinalSegment("Set", 0);
    assert.equal(agg.buffered, "Set");
  });
});
