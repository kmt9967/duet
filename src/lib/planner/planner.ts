/**
 * Deterministic task planner.
 *
 * Takes grounded intents plus the current scene and emits a dependency graph of
 * primitive arm actions. The planner is the only component allowed to decide
 * *what the robot does*; the language model in this system explains plans, it
 * never authors them. That separation is deliberate — it keeps behaviour
 * reproducible across runs and auditable after the fact.
 *
 * Three responsibilities live here:
 *
 *  1. Precondition chaining. Cutlery starts inside a closed drawer, so a pick
 *     on a drawer object implies opening that drawer first, exactly once,
 *     however many intents depend on it.
 *
 *  2. Arm assignment by reachability. Each candidate grasp is tested with real
 *     IK against the arm's joint limits, not a bounding sphere, so planning and
 *     execution cannot disagree about what is reachable.
 *
 *  3. Hand-off insertion. When the arm that can pick an object is not the arm
 *     that can reach the destination, the planner inserts a three-step transfer
 *     through a shared zone both arms can service.
 */

import { forwardKinematics, inverseKinematics } from "../core/kinematics";
import { ARM_BASES } from "../core/scene";
import {
  type ArmId,
  type Scene,
  type SceneObject,
  type Vec3,
  vec3,
} from "../core/types";
import type { Intent, ObjectRef } from "../language/intents";
import type { Plan, PlanError, PlanStep } from "./plan";

/**
 * Shared zone both arms can reach, used as the hand-off point.
 * Sits on the centreline where the two reach envelopes overlap.
 */
export const HANDOFF_POINT: Vec3 = vec3(0.15, 0, 0.1);

/**
 * Height the gripper rises to before travelling laterally.
 *
 * Kept low deliberately: a top-down approach trades planar reach for height, so
 * lifting too far shrinks the reachable envelope and would make transit
 * waypoints fail IK for objects the arm can otherwise grasp.
 */
const TRANSIT_HEIGHT = 0.09;

/**
 * Wrist pitch used when pouring. The vessel is tipped rather than held level,
 * so this angle must be used for the reach test as well as the emitted step.
 */
const POUR_APPROACH = -Math.PI / 4;

type PlanningState = {
  scene: Scene;
  /** Object id held by each arm during planning, mirroring execution. */
  holding: Record<ArmId, string | null>;
  /** Drawer openness as the plan progresses. */
  drawerOpen: Record<string, boolean>;
  /** Where each object will be once prior steps complete. */
  positions: Map<string, Vec3>;
  /** Last step id issued per arm, to serialise that arm's own actions. */
  lastStepByArm: Record<ArmId, string | null>;
  steps: PlanStep[];
  errors: PlanError[];
  notes: string[];
  counter: number;
};

function nextId(state: PlanningState, prefix: string): string {
  state.counter += 1;
  return `${prefix}-${state.counter}`;
}

/** Append a step, wiring in the implicit same-arm ordering dependency. */
function emit(
  state: PlanningState,
  step: Omit<PlanStep, "id" | "dependsOn"> & { dependsOn?: string[] },
): PlanStep {
  const id = nextId(state, step.type);
  const prior = state.lastStepByArm[step.arm];
  const dependsOn = [...(step.dependsOn ?? [])];
  // An arm can only do one thing at a time.
  if (prior && !dependsOn.includes(prior)) dependsOn.push(prior);

  const full: PlanStep = { ...step, id, dependsOn };
  state.steps.push(full);
  state.lastStepByArm[step.arm] = id;
  return full;
}

/** Resolve a spoken object reference to a concrete scene object. */
function groundObject(
  state: PlanningState,
  ref: ObjectRef,
  preferHeldBy?: ArmId,
): { object: SceneObject } | { error: PlanError } {
  const { scene } = state;

  // "it" / "that" — resolve to whatever the relevant arm is holding.
  if (!ref.kind) {
    const armsToCheck: ArmId[] = preferHeldBy
      ? [preferHeldBy, preferHeldBy === "A" ? "B" : "A"]
      : ["A", "B"];
    for (const arm of armsToCheck) {
      const held = state.holding[arm];
      if (held) {
        const object = scene.objects.find((o) => o.id === held);
        if (object) return { object };
      }
    }
    return {
      error: {
        reason: "ambiguous",
        message: `I need to know which object "${ref.phrase}" refers to — no arm is holding anything yet.`,
      },
    };
  }

  const matches = scene.objects.filter((o) => o.kind === ref.kind);
  if (matches.length === 0) {
    return {
      error: {
        reason: "no-such-object",
        message: `There is no ${ref.kind} in the scene.`,
      },
    };
  }
  if (matches.length > 1) {
    // Prefer one already held, otherwise the nearest to the table centre.
    const held = matches.find((o) => o.location.type === "held");
    if (held) return { object: held };
  }
  return { object: matches[0]! };
}

/** Effective position of an object as the plan currently stands. */
function positionOf(state: PlanningState, object: SceneObject): Vec3 {
  return state.positions.get(object.id) ?? object.position;
}

/**
 * Can `arm` service this point, per real IK?
 *
 * `approach` must match the angle the emitted step will use. A pour is executed
 * at -45 deg rather than straight down, and checking it top-down would let the
 * planner commit to a step the executor then refuses.
 */
function canReach(arm: ArmId, point: Vec3, approach = -Math.PI / 2): boolean {
  return inverseKinematics(point, ARM_BASES[arm], approach).ok;
}

function armsThatCanReach(point: Vec3, approach = -Math.PI / 2): ArmId[] {
  return (["A", "B"] as const).filter((arm) => canReach(arm, point, approach));
}

/**
 * Choose which arm should service a point, honouring an explicit request when
 * it is feasible and falling back to the other arm when it is not.
 */
function chooseArm(
  state: PlanningState,
  point: Vec3,
  requested?: ArmId,
  approach = -Math.PI / 2,
): ArmId | null {
  const capable = armsThatCanReach(point, approach);
  if (capable.length === 0) return null;

  if (requested) {
    if (capable.includes(requested)) return requested;
    state.notes.push(
      `Arm ${requested} cannot reach that point; using arm ${capable[0]} instead.`,
    );
    return capable[0]!;
  }

  // Prefer a free arm, then the one whose base is closer.
  const free = capable.filter((a) => state.holding[a] === null);
  const pool = free.length > 0 ? free : capable;
  return pool.sort((a, b) => {
    const da = Math.hypot(point.x - ARM_BASES[a].x, point.y - ARM_BASES[a].y);
    const db = Math.hypot(point.x - ARM_BASES[b].x, point.y - ARM_BASES[b].y);
    return da - db;
  })[0]!;
}

/**
 * Lift-then-travel: emit a transit waypoint above the target.
 *
 * The waypoint has to be reachable in its own right. A top-down approach trades
 * planar reach for height, so the nominal transit height can be outside the
 * envelope for a target the arm can nonetheless grasp. We try progressively
 * lower clearances and, if none solve, skip the waypoint rather than emit a
 * step the executor will reject.
 *
 * Returns the dependency list the caller should use for the following step.
 */
function emitApproach(
  state: PlanningState,
  arm: ArmId,
  target: Vec3,
  description: string,
  dependsOn: string[] = [],
): string[] {
  for (const height of [TRANSIT_HEIGHT, 0.07, 0.05, 0.035]) {
    if (height <= target.z) break;
    const waypoint = vec3(target.x, target.y, height);
    if (!canReach(arm, waypoint)) continue;
    const step = emit(state, {
      arm,
      type: "move",
      target: waypoint,
      description,
      dependsOn,
    });
    return [step.id];
  }
  return dependsOn;
}

/** Ensure the named drawer is open, emitting the action only once. */
function ensureDrawerOpen(
  state: PlanningState,
  drawerId: string,
  requestedArm?: ArmId,
): { stepId: string | null } | { error: PlanError } {
  if (state.drawerOpen[drawerId]) return { stepId: null };

  const drawer = state.scene.drawers.find((d) => d.id === drawerId);
  if (!drawer) {
    return {
      error: {
        reason: "no-such-object",
        message: `There is no drawer called "${drawerId}".`,
      },
    };
  }

  const arm = chooseArm(state, drawer.position, requestedArm);
  if (!arm) {
    return {
      error: {
        reason: "unreachable",
        message: `Neither arm can reach the ${drawer.label} handle.`,
      },
    };
  }

  const approachDeps = emitApproach(
    state,
    arm,
    drawer.position,
    `Arm ${arm} moves above the ${drawer.label} handle`,
  );
  const open = emit(state, {
    arm,
    type: "open_drawer",
    drawerId,
    target: drawer.position,
    description: `Arm ${arm} opens the ${drawer.label}`,
    dependsOn: approachDeps,
  });

  state.drawerOpen[drawerId] = true;

  // Once open, cutlery inside becomes reachable at the drawer's slid-out pose.
  for (const object of state.scene.objects) {
    if (
      object.location.type === "drawer" &&
      object.location.drawerId === drawerId
    ) {
      state.positions.set(
        object.id,
        vec3(
          object.position.x - drawer.travel,
          object.position.y,
          object.position.z,
        ),
      );
    }
  }

  return { stepId: open.id };
}

/**
 * Emit a pick. Returns the id of the grasp step and the arm that performed it,
 * so callers can chain a place onto it.
 */
function planPick(
  state: PlanningState,
  object: SceneObject,
  requestedArm?: ArmId,
  extraDeps: string[] = [],
): { stepId: string; arm: ArmId } | { error: PlanError } {
  const deps = [...extraDeps];

  // Precondition: an object inside a closed drawer needs that drawer opened.
  if (object.location.type === "drawer" && !state.drawerOpen[object.location.drawerId]) {
    const result = ensureDrawerOpen(state, object.location.drawerId, requestedArm);
    if ("error" in result) return { error: result.error };
    if (result.stepId) deps.push(result.stepId);
  }

  const point = positionOf(state, object);
  const arm = chooseArm(state, point, requestedArm);
  if (!arm) {
    return {
      error: {
        reason: "unreachable",
        message: `Neither arm can reach ${object.kind === "plate" ? "the plate" : `the ${object.kind}`} at its current position.`,
      },
    };
  }

  // If that arm is already holding something, put it down first.
  if (state.holding[arm] !== null && state.holding[arm] !== object.id) {
    const occupant = state.holding[arm]!;
    state.notes.push(
      `Arm ${arm} was holding ${occupant}; releasing it before the next pick.`,
    );
    const release = emit(state, {
      arm,
      type: "release",
      objectId: occupant,
      description: `Arm ${arm} sets down ${occupant} to free its gripper`,
    });
    deps.push(release.id);
    state.holding[arm] = null;
  }

  const approachDeps = emitApproach(
    state,
    arm,
    point,
    `Arm ${arm} moves above the ${object.kind}`,
    deps,
  );
  const grasp = emit(state, {
    arm,
    type: "grasp",
    objectId: object.id,
    target: point,
    description: `Arm ${arm} grasps the ${object.kind}`,
    dependsOn: approachDeps,
  });

  state.holding[arm] = object.id;
  return { stepId: grasp.id, arm };
}

/** Emit a hand-off transferring `objectId` from one arm to the other. */
function planHandoff(
  state: PlanningState,
  objectId: string,
  from: ArmId,
  to: ArmId,
  deps: string[],
): { stepId: string } {
  const give = emit(state, {
    arm: from,
    type: "handoff_give",
    objectId,
    target: HANDOFF_POINT,
    description: `Arm ${from} presents the object at the hand-off zone`,
    dependsOn: deps,
  });
  // The receiving arm must wait for the giving arm to arrive.
  const take = emit(state, {
    arm: to,
    type: "handoff_take",
    objectId,
    target: HANDOFF_POINT,
    description: `Arm ${to} takes the object from arm ${from}`,
    dependsOn: [give.id],
  });

  state.holding[from] = null;
  state.holding[to] = objectId;
  state.positions.set(objectId, HANDOFF_POINT);

  state.notes.push(
    `Inserted a hand-off: arm ${from} cannot reach the destination, arm ${to} can.`,
  );
  return { stepId: take.id };
}

/** Resolve a place target to a world point. */
function resolveTarget(
  state: PlanningState,
  intent: Extract<Intent, { kind: "place" }>,
): { point: Vec3 } | { error: PlanError } {
  const { target } = intent;

  if (target.type === "placemat") {
    const mat = state.scene.placemats.find((m) => m.id === target.id);
    if (!mat) {
      return {
        error: { reason: "no-such-object", message: `I do not know ${target.phrase}.` },
      };
    }
    return { point: vec3(mat.center.x, mat.center.y, 0.01) };
  }

  if (target.type === "drawer") {
    const drawer = state.scene.drawers.find((d) => d.id === target.id);
    if (!drawer) {
      return {
        error: { reason: "no-such-object", message: `I do not know ${target.phrase}.` },
      };
    }
    return { point: drawer.position };
  }

  if (target.type === "object") {
    const match = state.scene.objects.find((o) => o.kind === target.id);
    if (!match) {
      return {
        error: { reason: "no-such-object", message: `There is no ${target.id} to place onto.` },
      };
    }
    const p = positionOf(state, match);
    return { point: vec3(p.x, p.y, p.z + 0.05) };
  }

  // Plain "on the table": choose a clear spot both arms can service.
  return { point: vec3(0.15, 0, 0.012) };
}

export function planIntents(intents: Intent[], scene: Scene): Plan {
  const state: PlanningState = {
    scene,
    holding: { A: scene.arms.A.holding, B: scene.arms.B.holding },
    drawerOpen: Object.fromEntries(
      scene.drawers.map((d) => [d.id, d.openness > 0.5]),
    ),
    positions: new Map(),
    lastStepByArm: { A: null, B: null },
    steps: [],
    errors: [],
    notes: [],
    counter: 0,
  };

  const expanded = expandMacros(intents, scene);

  for (const [index, intent] of expanded.entries()) {
    const error = planOne(state, intent);
    if (error) state.errors.push({ ...error, intentIndex: index });
  }

  return { steps: state.steps, errors: state.errors, notes: state.notes };
}

function planOne(state: PlanningState, intent: Intent): PlanError | null {
  switch (intent.kind) {
    case "open_drawer": {
      const result = ensureDrawerOpen(state, intent.drawerId, intent.arm);
      return "error" in result ? result.error : null;
    }

    case "close_drawer": {
      const drawer = state.scene.drawers.find((d) => d.id === intent.drawerId);
      if (!drawer) {
        return { reason: "no-such-object", message: "I do not know that drawer." };
      }
      const arm = chooseArm(state, drawer.position, intent.arm);
      if (!arm) {
        return { reason: "unreachable", message: `Neither arm can reach the ${drawer.label}.` };
      }
      emit(state, {
        arm,
        type: "close_drawer",
        drawerId: intent.drawerId,
        target: drawer.position,
        description: `Arm ${arm} closes the ${drawer.label}`,
      });
      state.drawerOpen[intent.drawerId] = false;
      return null;
    }

    case "pick": {
      const grounded = groundObject(state, intent.object);
      if ("error" in grounded) return grounded.error;
      const result = planPick(state, grounded.object, intent.arm);
      return "error" in result ? result.error : null;
    }

    case "place": {
      const grounded = groundObject(state, intent.object, intent.arm);
      if ("error" in grounded) return grounded.error;
      const object = grounded.object;

      const resolved = resolveTarget(state, intent);
      if ("error" in resolved) return resolved.error;
      const destination = resolved.point;

      // Which arm already holds it, if any?
      let holdingArm: ArmId | null =
        state.holding.A === object.id ? "A" : state.holding.B === object.id ? "B" : null;
      const deps: string[] = [];

      if (holdingArm === null) {
        const picked = planPick(state, object, intent.arm);
        if ("error" in picked) return picked.error;
        holdingArm = picked.arm;
        deps.push(picked.stepId);
      } else if (state.lastStepByArm[holdingArm]) {
        deps.push(state.lastStepByArm[holdingArm]!);
      }

      // The heart of the bimanual behaviour: if the holding arm cannot reach
      // the destination but the other can, transfer rather than fail.
      let placingArm = holdingArm;
      if (!canReach(holdingArm, destination)) {
        const other: ArmId = holdingArm === "A" ? "B" : "A";
        if (canReach(other, destination)) {
          const handoff = planHandoff(state, object.id, holdingArm, other, deps);
          deps.length = 0;
          deps.push(handoff.stepId);
          placingArm = other;
        } else {
          return {
            reason: "unreachable",
            message: `Neither arm can place the ${object.kind} at ${intent.target.phrase}.`,
          };
        }
      }

      const approachDeps = emitApproach(
        state,
        placingArm,
        destination,
        `Arm ${placingArm} carries the ${object.kind} to ${intent.target.phrase}`,
        deps,
      );
      emit(state, {
        arm: placingArm,
        type: "release",
        objectId: object.id,
        target: destination,
        description: `Arm ${placingArm} places the ${object.kind} on ${intent.target.phrase}`,
        dependsOn: approachDeps,
      });

      state.holding[placingArm] = null;
      state.positions.set(object.id, destination);
      return null;
    }

    case "pour": {
      const sourceGrounded = groundObject(state, intent.source);
      if ("error" in sourceGrounded) return sourceGrounded.error;
      const targetGrounded = groundObject(state, intent.target);
      if ("error" in targetGrounded) return targetGrounded.error;

      const source = sourceGrounded.object;
      const target = targetGrounded.object;
      const deps: string[] = [];

      let pouringArm: ArmId | null =
        state.holding.A === source.id ? "A" : state.holding.B === source.id ? "B" : null;

      if (pouringArm === null) {
        const picked = planPick(state, source, intent.arm);
        if ("error" in picked) return picked.error;
        pouringArm = picked.arm;
        deps.push(picked.stepId);
      }

      // Pour above the receiving vessel, wherever it currently is.
      const targetPos = positionOf(state, target);
      // Pour from meaningful clearance above the rim. Too low and the wrist has
      // to fold past its elbow stop; this height keeps the pose comfortable.
      const pourPoint = vec3(targetPos.x, targetPos.y, targetPos.z + 0.1);

      if (!canReach(pouringArm, pourPoint, POUR_APPROACH)) {
        const other: ArmId = pouringArm === "A" ? "B" : "A";
        if (canReach(other, pourPoint, POUR_APPROACH)) {
          const handoff = planHandoff(state, source.id, pouringArm, other, deps);
          deps.length = 0;
          deps.push(handoff.stepId);
          pouringArm = other;
        } else {
          return {
            reason: "unreachable",
            message: `Neither arm can pour into the ${target.kind} where it is.`,
          };
        }
      }

      const approachDeps = emitApproach(
        state,
        pouringArm,
        pourPoint,
        `Arm ${pouringArm} brings the ${source.kind} over the ${target.kind}`,
        deps,
      );
      emit(state, {
        arm: pouringArm,
        type: "pour",
        objectId: source.id,
        target: pourPoint,
        approach: POUR_APPROACH,
        description: `Arm ${pouringArm} pours from the ${source.kind} into the ${target.kind}`,
        dependsOn: approachDeps,
      });
      return null;
    }

    case "handoff": {
      const grounded = groundObject(state, intent.object, intent.from);
      if ("error" in grounded) return grounded.error;
      const object = grounded.object;

      let from: ArmId | null =
        intent.from ??
        (state.holding.A === object.id ? "A" : state.holding.B === object.id ? "B" : null);

      const deps: string[] = [];
      if (from === null || state.holding[from] !== object.id) {
        const picked = planPick(state, object, from ?? undefined);
        if ("error" in picked) return picked.error;
        from = picked.arm;
        deps.push(picked.stepId);
      }

      const to: ArmId = intent.to ?? (from === "A" ? "B" : "A");
      if (to === from) {
        return {
          reason: "ambiguous",
          message: "A hand-off needs two different arms.",
        };
      }
      planHandoff(state, object.id, from, to, deps);
      return null;
    }

    case "set_table":
    case "clear_table":
      // Expanded upstream by expandMacros; reaching here means expansion failed.
      return {
        reason: "ambiguous",
        message: "I could not expand that into concrete steps for this scene.",
      };

    case "stop":
    case "resume":
    case "reset":
    case "query_state":
      // Control intents are handled by the session layer, not the planner.
      return null;
  }
}

/**
 * Expand high-level macros into explicit intents, using the scene to decide
 * which objects exist and which setting each should go to.
 */
export function expandMacros(intents: Intent[], scene: Scene): Intent[] {
  const out: Intent[] = [];

  for (const intent of intents) {
    if (intent.kind === "set_table") {
      const has = (kind: string) => scene.objects.some((o) => o.kind === kind);

      if (scene.drawers.length > 0) {
        out.push({ kind: "open_drawer", drawerId: scene.drawers[0]!.id });
      }
      if (has("plate")) {
        out.push({
          kind: "place",
          object: { phrase: "the plate", kind: "plate" },
          target: { type: "placemat", id: "mat-right", phrase: "the right setting" },
        });
      }
      if (has("fork")) {
        out.push({
          kind: "place",
          object: { phrase: "the fork", kind: "fork" },
          target: { type: "placemat", id: "mat-right", phrase: "the right setting" },
        });
      }
      if (has("mug")) {
        out.push({
          kind: "place",
          object: { phrase: "the mug", kind: "mug" },
          target: { type: "placemat", id: "mat-left", phrase: "the left setting" },
        });
      }
      if (has("spoon")) {
        out.push({
          kind: "place",
          object: { phrase: "the spoon", kind: "spoon" },
          target: { type: "placemat", id: "mat-left", phrase: "the left setting" },
        });
      }
      if (has("bottle") && has("mug")) {
        out.push({
          kind: "pour",
          source: { phrase: "the bottle", kind: "bottle" },
          target: { phrase: "the mug", kind: "mug" },
        });
      }
      continue;
    }

    if (intent.kind === "clear_table") {
      for (const object of scene.objects) {
        if (object.location.type !== "table") continue;
        out.push({
          kind: "place",
          object: { phrase: `the ${object.kind}`, kind: object.kind },
          target: { type: "drawer", id: "drawer-top", phrase: "the top drawer" },
        });
      }
      continue;
    }

    out.push(intent);
  }

  return out;
}

/** Convenience: parseCommand output straight to a Plan. */
export function planFromIntents(intents: Intent[], scene: Scene): Plan {
  return planIntents(intents, scene);
}

export { forwardKinematics };
