/**
 * Playback sampler.
 *
 * Turns a plan plus its execution outcomes into a function that returns the
 * world state at an arbitrary point on the simulated clock. The UI renders by
 * calling this each animation frame, which means the picture on screen is
 * always a view of the same execution the benchmark scored — there is no
 * separate "demo" animation that could drift from reality.
 *
 * Steps that ran concurrently share a time window, so both arms genuinely move
 * at once during a parallel phase.
 */

import { inverseKinematics, interpolateJoints } from "../core/kinematics";
import { cloneScene, restPose } from "../core/scene";
import type { ArmId, Scene, Vec3 } from "../core/types";
import { vec3 } from "../core/types";
import type { Plan, PlanStep } from "../planner/plan";
import { forwardKinematics } from "../core/kinematics";
import type { StepOutcome } from "./executor";

export type WorldSnapshot = {
  scene: Scene;
  /** Steps currently executing at the sampled time. */
  active: StepOutcome[];
  /** Steps that have finished at or before the sampled time. */
  completedCount: number;
  /** Total length of the schedule. */
  totalMs: number;
};

export type Playback = {
  totalMs: number;
  sample: (timeMs: number) => WorldSnapshot;
};

/** Where the gripper sits partway through a step. */
function poseAt(
  step: PlanStep,
  base: Vec3,
  fromJoints: number[],
  progress: number,
): number[] {
  if (!step.target) return fromJoints;
  const ik = inverseKinematics(
    step.target,
    base,
    step.approach ?? -Math.PI / 2,
    fromJoints,
  );
  if (!ik.ok) return fromJoints;
  return interpolateJoints(fromJoints, ik.joints, progress);
}

export function createPlayback(
  plan: Plan,
  outcomes: StepOutcome[],
  initialScene: Scene,
): Playback {
  const byId = new Map(plan.steps.map((s) => [s.id, s]));
  const runnable = outcomes
    .filter((o) => o.status !== "skipped")
    .sort((a, b) => a.startMs - b.startMs);

  const totalMs = runnable.reduce(
    (max, o) => Math.max(max, o.startMs + o.durationMs),
    0,
  );

  const sample = (timeMs: number): WorldSnapshot => {
    const scene = cloneScene(initialScene);
    // Track each arm's pose as we replay, so interpolation starts from wherever
    // the previous step actually left the arm.
    const jointsByArm: Record<ArmId, number[]> = {
      A: [...(initialScene.arms.A.joints ?? restPose())],
      B: [...(initialScene.arms.B.joints ?? restPose())],
    };

    const active: StepOutcome[] = [];
    let completedCount = 0;

    for (const outcome of runnable) {
      const step = byId.get(outcome.stepId);
      if (!step) continue;

      const endMs = outcome.startMs + outcome.durationMs;

      if (timeMs >= endMs) {
        // Fully done: apply its effect and settle the arm at the goal pose.
        if (outcome.status === "completed") {
          applyEffect(scene, step);
          jointsByArm[step.arm] = poseAt(step, scene.arms[step.arm].base, jointsByArm[step.arm]!, 1);
        }
        completedCount += 1;
        continue;
      }

      if (timeMs >= outcome.startMs) {
        // In progress: interpolate but do not commit the effect yet.
        const progress =
          outcome.durationMs > 0
            ? (timeMs - outcome.startMs) / outcome.durationMs
            : 1;
        jointsByArm[step.arm] = poseAt(
          step,
          scene.arms[step.arm].base,
          jointsByArm[step.arm]!,
          progress,
        );
        active.push(outcome);
      }
      // Steps that have not started yet contribute nothing.
    }

    scene.arms.A.joints = jointsByArm.A;
    scene.arms.B.joints = jointsByArm.B;

    // Anything being carried rides with its gripper.
    for (const arm of ["A", "B"] as const) {
      const heldId = scene.arms[arm].holding;
      if (!heldId) continue;
      const object = scene.objects.find((o) => o.id === heldId);
      if (!object) continue;
      object.position = forwardKinematics(scene.arms[arm].joints, scene.arms[arm].base);
    }

    return { scene, active, completedCount, totalMs };
  };

  return { totalMs, sample };
}

/** Mirror of the executor's state mutation, minus the failure modelling. */
function applyEffect(scene: Scene, step: PlanStep): void {
  const arm = scene.arms[step.arm];

  switch (step.type) {
    case "open_drawer": {
      const drawer = scene.drawers.find((d) => d.id === step.drawerId);
      if (!drawer) return;
      drawer.openness = 1;
      for (const object of scene.objects) {
        if (
          object.location.type === "drawer" &&
          object.location.drawerId === drawer.id
        ) {
          object.position = vec3(
            object.position.x - drawer.travel,
            object.position.y,
            object.position.z,
          );
        }
      }
      return;
    }
    case "close_drawer": {
      const drawer = scene.drawers.find((d) => d.id === step.drawerId);
      if (drawer) drawer.openness = 0;
      return;
    }
    case "grasp": {
      const object = scene.objects.find((o) => o.id === step.objectId);
      if (!object) return;
      arm.holding = object.id;
      object.location = { type: "held", arm: step.arm };
      return;
    }
    case "release": {
      const object = scene.objects.find((o) => o.id === step.objectId);
      if (!object) return;
      arm.holding = null;
      object.location = { type: "table" };
      if (step.target) {
        object.position = vec3(step.target.x, step.target.y, object.halfExtents.z);
      }
      return;
    }
    case "handoff_give": {
      const object = scene.objects.find((o) => o.id === step.objectId);
      if (object && step.target) object.position = { ...step.target };
      return;
    }
    case "handoff_take": {
      const object = scene.objects.find((o) => o.id === step.objectId);
      if (!object) return;
      const other: ArmId = step.arm === "A" ? "B" : "A";
      scene.arms[other].holding = null;
      arm.holding = object.id;
      object.location = { type: "held", arm: step.arm };
      return;
    }
    default:
      return;
  }
}
