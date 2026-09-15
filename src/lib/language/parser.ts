/**
 * Natural-language command parser.
 *
 * This runs directly on Speechmatics transcript text, which means it must
 * tolerate everything real ASR produces and formatted prose does not:
 *
 *   - no punctuation at all ("open the top drawer then pick up the plate")
 *   - disfluencies ("uh pick up the, the plate")
 *   - spelled-out and homophone numbers ("arm a" / "arm eight", "two" / "to")
 *   - filler openers ("okay so", "can you", "please")
 *   - clause joins by "and" / "then" / comma, mixed freely
 *
 * The parser is deterministic and fully offline. No model call sits between
 * the operator's voice and the robot's action, which is what lets the system
 * stay predictable and auditable — an LLM is used only to *explain* plans, never
 * to choose them.
 */

import type { ArmId } from "../core/types";
import type {
  Intent,
  ObjectRef,
  ParseDiagnostic,
  ParseResult,
  TargetRef,
} from "./intents";

const FILLERS = [
  "um", "uh", "erm", "er", "ah", "like", "you know", "i mean",
  "please", "okay", "ok", "so", "now", "just", "can you", "could you",
  "would you", "i want you to", "i'd like you to", "let's", "lets",
  "go ahead and", "robot", "duet",
];

const OBJECT_SYNONYMS: Record<string, string> = {
  plate: "plate", plates: "plate", dish: "plate", saucer: "plate",
  mug: "mug", mugs: "mug", cup: "mug", cups: "mug", glass: "mug",
  fork: "fork", forks: "fork",
  spoon: "spoon", spoons: "spoon",
  knife: "knife", knives: "knife",
  bottle: "bottle", bottles: "bottle", jug: "bottle", pitcher: "bottle",
  napkin: "napkin", napkins: "napkin", serviette: "napkin",
};

/**
 * ASR frequently renders "arm A" as "arm a", "arm eight", or "arm hey", and
 * "arm B" as "arm be" or "arm bee". Map all of them.
 */
const ARM_TOKENS: Record<string, ArmId> = {
  a: "A", eight: "A", hey: "A", ay: "A", aye: "A", right: "A", first: "A", one: "A",
  b: "B", be: "B", bee: "B", bea: "B", left: "B", second: "B", two: "B", too: "B",
};

/**
 * Verbs that begin a new command. Used to recover clause boundaries when the
 * transcript has no punctuation, which is the common case with live ASR.
 *
 * `set` is safe to include: the word boundary means it matches "set the table"
 * but not "the right setting".
 */
const COMMAND_VERB =
  /\b(?:open|close|pick|grab|take|lift|retrieve|fetch|grasp|place|put|drop|position|pour|fill|hand|pass|give|transfer|stop|halt|reset|set)\b/g;

/** Explicit sequence markers, preserved through normalisation as ";". */
const BOUNDARY = ";";

export function normalize(raw: string): string {
  let s = raw.toLowerCase();

  // Commas and sentence enders are clause boundaries, not noise. Convert them
  // to an explicit marker before stripping the rest of the punctuation —
  // deleting them here would merge separate commands into one run-on clause.
  s = s.replace(/[.,!?;:]+/g, ` ${BOUNDARY} `);
  s = s.replace(/[''`]/g, "'");

  // Remove filler phrases as whole words, longest first so "can you" beats "you".
  for (const filler of [...FILLERS].sort((a, b) => b.length - a.length)) {
    s = s.replace(new RegExp(`\\b${filler.replace(/ /g, "\\s+")}\\b`, "g"), " ");
  }

  return s.replace(/\s+/g, " ").trim();
}

/**
 * Split a normalised utterance into independent command clauses.
 *
 * Two passes. First on explicit markers — punctuation that survived
 * normalisation as ";", plus sequence words like "then". Second on command-verb
 * onsets, which recovers the boundaries in an unpunctuated run-on such as
 * "open the drawer pick up the plate place it down".
 *
 * Note "and" is deliberately not a boundary. Splitting on it would break
 * "the plate and the mug" into nonsense, whereas the verb pass already handles
 * "pick up the plate and place it down" correctly.
 */
export function splitClauses(text: string): string[] {
  const coarse = text
    .split(/;|\b(?:then|after that|next after|next)\b/g)
    .map((c) => c.trim())
    .filter(Boolean);

  const out: string[] = [];

  for (const chunk of coarse) {
    // Find every command-verb onset past the start of the chunk and cut there.
    const cuts: number[] = [];
    COMMAND_VERB.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = COMMAND_VERB.exec(chunk)) !== null) {
      if (match.index > 0) cuts.push(match.index);
    }

    if (cuts.length === 0) {
      out.push(chunk);
      continue;
    }

    let start = 0;
    for (const cut of cuts) {
      const piece = chunk.slice(start, cut).trim();
      if (piece) out.push(piece);
      start = cut;
    }
    const tail = chunk.slice(start).trim();
    if (tail) out.push(tail);
  }

  return out.filter((c) => c.length > 1);
}

/**
 * Postfix form: "arm A", "with arm be", "using arm two".
 * Kept separate from the prefix form because a single combined pattern matches
 * at the word boundary *before* "with" and captures the preposition itself.
 */
const ARM_AFTER = /\barm\s+(\w+)\b/;

/** Prefix form, restricted to words that can actually name an arm. */
const ARM_BEFORE = /\b(left|right|first|second|one|two)\s+arm\b/;

function findArm(clause: string): ArmId | undefined {
  const token =
    clause.match(ARM_AFTER)?.[1] ?? clause.match(ARM_BEFORE)?.[1];
  if (!token) return undefined;
  return ARM_TOKENS[token];
}

function findObject(clause: string, after?: RegExp): ObjectRef | undefined {
  let scope = clause;
  if (after) {
    const idx = clause.search(after);
    if (idx >= 0) scope = clause.slice(idx);
  }
  for (const [word, kind] of Object.entries(OBJECT_SYNONYMS)) {
    const re = new RegExp(`\\b${word}\\b`);
    if (re.test(scope)) {
      return { phrase: `the ${kind}`, kind };
    }
  }
  return undefined;
}

function findTarget(clause: string): TargetRef | undefined {
  if (/\b(right|first)\s+(setting|placemat|mat|place)\b/.test(clause)) {
    return { type: "placemat", id: "mat-right", phrase: "the right setting" };
  }
  if (/\b(left|second)\s+(setting|placemat|mat|place)\b/.test(clause)) {
    return { type: "placemat", id: "mat-left", phrase: "the left setting" };
  }
  if (/\b(drawer)\b/.test(clause)) {
    return { type: "drawer", id: "drawer-top", phrase: "the top drawer" };
  }
  // "onto the table", "on the table", "down"
  if (/\b(table|down|surface)\b/.test(clause)) {
    return { type: "table", phrase: "the table" };
  }
  // "into the mug" — a target that is itself an object.
  const obj = findObject(clause, /\b(?:in|into|on|onto|to)\b/);
  if (obj?.kind) {
    return { type: "object", id: obj.kind, phrase: obj.phrase };
  }
  return undefined;
}

function parseClause(
  clause: string,
): { intent?: Intent; diagnostic?: string } {
  const c = clause.trim();
  if (!c) return {};

  // --- control verbs ------------------------------------------------------
  if (/\b(stop|halt|freeze|abort|cancel|wait)\b/.test(c)) {
    return { intent: { kind: "stop" } };
  }
  // Checked before the manipulation verbs: "carry on" must not be read as the
  // "carry" of a pick-and-place.
  if (/\b(continue|resume|carry on|go on|proceed|keep going|unpause)\b/.test(c)) {
    return { intent: { kind: "resume" } };
  }
  if (/\b(reset|start over|restart|clear the plan)\b/.test(c)) {
    return { intent: { kind: "reset" } };
  }
  if (
    /\b(status|what(?:'s| is) (?:the )?(?:state|status|going on)|report|where are we|what are you holding)\b/.test(
      c,
    )
  ) {
    return { intent: { kind: "query_state" } };
  }

  // --- macros -------------------------------------------------------------
  if (/\bset (?:up )?(?:the )?(?:dinner )?table\b/.test(c)) {
    return { intent: { kind: "set_table" } };
  }
  if (/\bclear (?:the )?table\b/.test(c)) {
    return { intent: { kind: "clear_table" } };
  }

  const arm = findArm(c);

  // --- drawer -------------------------------------------------------------
  if (/\bopen\b/.test(c) && /\bdrawer\b/.test(c)) {
    return { intent: { kind: "open_drawer", drawerId: "drawer-top", arm } };
  }
  if (/\bclose\b/.test(c) && /\bdrawer\b/.test(c)) {
    return { intent: { kind: "close_drawer", drawerId: "drawer-top", arm } };
  }

  // --- pour ---------------------------------------------------------------
  // Check before pick/place: "pour water into the mug" contains no pick verb
  // but does name two objects.
  if (/\b(pour|fill|top up)\b/.test(c)) {
    const target = findObject(c, /\b(?:in|into|to)\b/);
    // The source is whatever object is named before the preposition, defaulting
    // to the bottle since that is the only pourable vessel in this domain.
    const beforePrep = c.split(/\b(?:in|into|to)\b/)[0] ?? c;
    const source = findObject(beforePrep) ?? { phrase: "the bottle", kind: "bottle" };
    if (target) {
      return { intent: { kind: "pour", source, target, arm } };
    }
    return { diagnostic: "I heard a pour command but not what to pour into." };
  }

  // --- hand-off -----------------------------------------------------------
  if (/\b(hand|pass|give|transfer)\b/.test(c)) {
    const object = findObject(c);
    if (!object) {
      return { diagnostic: "I heard a hand-off but not which object." };
    }
    // "hand it to arm B" / "pass the plate from arm A to arm B"
    const toMatch = c.match(/\bto\s+(?:the\s+)?(?:arm\s+)?(\w+)/);
    const fromMatch = c.match(/\bfrom\s+(?:the\s+)?(?:arm\s+)?(\w+)/);
    return {
      intent: {
        kind: "handoff",
        object,
        to: toMatch?.[1] ? ARM_TOKENS[toMatch[1]] : undefined,
        from: fromMatch?.[1] ? ARM_TOKENS[fromMatch[1]] : undefined,
      },
    };
  }

  // --- place --------------------------------------------------------------
  // "place it on the table", "put the plate on the right setting"
  if (/\b(place|put|set|drop|position)\b/.test(c)) {
    const object = findObject(c) ?? { phrase: "it" };
    const target = findTarget(c);
    if (!target) {
      return { diagnostic: `I heard "place" but not where to put ${object.phrase}.` };
    }
    return { intent: { kind: "place", object, target, arm } };
  }

  // --- pick ---------------------------------------------------------------
  if (/\b(pick|grab|take|lift|get|retrieve|fetch|grasp)\b/.test(c)) {
    const object = findObject(c);
    if (!object) {
      return { diagnostic: "I heard a pick command but not which object." };
    }
    return { intent: { kind: "pick", object, arm } };
  }

  return { diagnostic: `I could not interpret "${clause.trim()}".` };
}

export function parseCommand(raw: string): ParseResult {
  const normalized = normalize(raw);
  const intents: Intent[] = [];
  const diagnostics: ParseDiagnostic[] = [];

  if (!normalized) {
    return { intents, diagnostics, normalized };
  }

  for (const clause of splitClauses(normalized)) {
    const { intent, diagnostic } = parseClause(clause);
    if (intent) intents.push(intent);
    else if (diagnostic) diagnostics.push({ clause, message: diagnostic });
  }

  // A bare utterance that produced nothing at all is worth reporting once,
  // rather than silently doing nothing.
  if (intents.length === 0 && diagnostics.length === 0) {
    diagnostics.push({
      clause: normalized,
      message: `I could not interpret "${raw.trim()}".`,
    });
  }

  return { intents, diagnostics, normalized };
}
