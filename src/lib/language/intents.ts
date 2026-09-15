/**
 * Intent vocabulary shared by the parser, the planner and the UI.
 *
 * An Intent is what the operator asked for, already disambiguated against the
 * scene. It is deliberately separate from a PlanStep: an intent says "put the
 * plate on the right setting", a plan step says "arm A moves to (0.24, -0.25)
 * and closes its gripper". One intent can expand into many steps, and a single
 * intent can require both arms.
 */

import type { ArmId } from "../core/types";

export type ObjectRef = {
  /** Raw phrase the operator used, kept for error messages. */
  phrase: string;
  /** Object kind if the phrase named one. */
  kind?: string;
  /** Resolved scene object id, filled in during grounding. */
  id?: string;
};

export type TargetRef =
  | { type: "placemat"; id: string; phrase: string }
  | { type: "object"; id: string; phrase: string }
  | { type: "table"; phrase: string }
  | { type: "drawer"; id: string; phrase: string };

export type Intent =
  | { kind: "open_drawer"; drawerId: string; arm?: ArmId }
  | { kind: "close_drawer"; drawerId: string; arm?: ArmId }
  | { kind: "pick"; object: ObjectRef; arm?: ArmId }
  | { kind: "place"; object: ObjectRef; target: TargetRef; arm?: ArmId }
  | { kind: "pour"; source: ObjectRef; target: ObjectRef; arm?: ArmId }
  | { kind: "handoff"; object: ObjectRef; from?: ArmId; to?: ArmId }
  | { kind: "set_table" }
  | { kind: "clear_table" }
  | { kind: "stop" }
  | { kind: "resume" }
  | { kind: "reset" }
  | { kind: "query_state" };

export type ParseDiagnostic = {
  clause: string;
  message: string;
};

export type ParseResult = {
  intents: Intent[];
  /** Clauses we could not interpret. Surfaced to the operator, never silently dropped. */
  diagnostics: ParseDiagnostic[];
  /** The normalised transcript the parser actually worked from. */
  normalized: string;
};

export function describeIntent(intent: Intent): string {
  switch (intent.kind) {
    case "open_drawer":
      return `open the ${intent.drawerId.replace(/-/g, " ")}`;
    case "close_drawer":
      return `close the ${intent.drawerId.replace(/-/g, " ")}`;
    case "pick":
      return `pick up ${intent.object.phrase}${intent.arm ? ` with arm ${intent.arm}` : ""}`;
    case "place":
      return `place ${intent.object.phrase} on ${intent.target.phrase}${intent.arm ? ` with arm ${intent.arm}` : ""}`;
    case "pour":
      return `pour from ${intent.source.phrase} into ${intent.target.phrase}`;
    case "handoff":
      return `hand ${intent.object.phrase} from arm ${intent.from ?? "?"} to arm ${intent.to ?? "?"}`;
    case "set_table":
      return "set the table";
    case "clear_table":
      return "clear the table";
    case "stop":
      return "stop";
    case "resume":
      return "continue";
    case "reset":
      return "reset the scene";
    case "query_state":
      return "report status";
  }
}
