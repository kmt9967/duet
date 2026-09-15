import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { normalize, splitClauses, parseCommand } from "../src/lib/language/parser";

describe("normalize", () => {
  test("preserves clause boundaries as markers rather than deleting them", () => {
    // Regression: deleting commas merged separate commands into one run-on
    // clause, so everything after the first verb was silently dropped.
    const out = normalize("open the drawer, pick up the plate");
    assert.ok(out.includes(";"), `expected a boundary marker, got: ${out}`);
  });

  test("strips filler words that ASR emits", () => {
    const out = normalize("um, okay so can you please pick up the mug");
    assert.equal(out.replace(/[;\s]+/g, " ").trim(), "pick up the mug");
  });

  test("lowercases and is idempotent on already-clean input", () => {
    assert.equal(normalize("Pick Up The Plate"), "pick up the plate");
  });
});

describe("splitClauses", () => {
  test("splits an unpunctuated run-on at verb boundaries", () => {
    // This is the realistic ASR case: no punctuation at all.
    const clauses = splitClauses(
      normalize("open the top drawer pick up the plate place it on the table"),
    );
    assert.deepEqual(clauses, [
      "open the top drawer",
      "pick up the plate",
      "place it on the table",
    ]);
  });

  test("does not split 'and' joining two noun phrases", () => {
    const clauses = splitClauses(normalize("pick up the plate and the mug"));
    assert.equal(clauses.length, 1);
  });

  test("does not treat 'setting' as the verb 'set'", () => {
    const clauses = splitClauses(normalize("place it on the right setting"));
    assert.deepEqual(clauses, ["place it on the right setting"]);
  });
});

describe("parseCommand", () => {
  test("parses the challenge brief's worked example into five intents", () => {
    const result = parseCommand(
      "Open the top drawer, pick up the plate with arm A, place it on the table, pick up the mug with arm B, pour water into the mug with arm A.",
    );
    assert.equal(result.diagnostics.length, 0);
    assert.deepEqual(
      result.intents.map((i) => i.kind),
      ["open_drawer", "pick", "place", "pick", "pour"],
    );
  });

  test("binds explicit arm assignments", () => {
    const { intents } = parseCommand("pick up the plate with arm A");
    assert.equal(intents[0]?.kind, "pick");
    assert.equal((intents[0] as { arm?: string }).arm, "A");
  });

  test("accepts ASR homophones for arm names", () => {
    // Speechmatics commonly renders "arm B" as "arm be".
    const { intents } = parseCommand("pick up the mug with arm be");
    assert.equal((intents[0] as { arm?: string }).arm, "B");
  });

  test("maps object synonyms to canonical kinds", () => {
    const { intents } = parseCommand("grab the cup");
    assert.equal(
      (intents[0] as { object?: { kind?: string } }).object?.kind,
      "mug",
    );
  });

  test("recognises control verbs", () => {
    assert.equal(parseCommand("stop").intents[0]?.kind, "stop");
    assert.equal(parseCommand("reset the scene").intents[0]?.kind, "reset");
  });

  test("reports uninterpretable input instead of failing silently", () => {
    const result = parseCommand("the weather is nice today");
    assert.equal(result.intents.length, 0);
    assert.ok(result.diagnostics.length > 0);
  });

  test("never throws on empty or whitespace input", () => {
    assert.equal(parseCommand("").intents.length, 0);
    assert.equal(parseCommand("   ").intents.length, 0);
  });
});
