/**
 * Plan representation.
 *
 * A Plan is a dependency graph, not a flat list. Steps carry explicit
 * `dependsOn` edges, so the executor can run arm A and arm B concurrently
 * whenever the graph permits and serialise them only where a real constraint
 * exists (a hand-off, a shared object, a drawer that must be open first).
 *
 * Keeping coordination in the graph rather than in imperative code is what
 * makes bimanual behaviour inspectable: the UI renders these edges directly,
 * so an operator can see *why* an arm is waiting.
 */

import type { ArmId, FailureReason, Vec3 } from "../core/types";

export type StepType =
  | "move"
  | "grasp"
  | "release"
  | "open_drawer"
  | "close_drawer"
  | "pour"
  | "handoff_give"
  | "handoff_take"
  | "home";

export type PlanStep = {
  id: string;
  arm: ArmId;
  type: StepType;
  /** Cartesian goal for the end-effector, world frame. */
  target?: Vec3;
  objectId?: string;
  drawerId?: string;
  /** Operator-facing description, shown in the timeline and spoken back. */
  description: string;
  /** Steps that must complete before this one may start. */
  dependsOn: string[];
  /** Approach pitch for IK, radians from horizontal. */
  approach?: number;
};

export type PlanError = {
  reason: FailureReason;
  message: string;
  /** The intent index this error came from, for UI highlighting. */
  intentIndex?: number;
};

export type Plan = {
  steps: PlanStep[];
  errors: PlanError[];
  /** Non-fatal notes, e.g. "inserted a hand-off because arm A cannot reach". */
  notes: string[];
};

/** Topologically ordered step ids, or null when the graph has a cycle. */
export function topologicalOrder(steps: PlanStep[]): string[] | null {
  const indegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  const byId = new Map(steps.map((s) => [s.id, s]));

  for (const step of steps) {
    indegree.set(step.id, 0);
    adjacency.set(step.id, []);
  }
  for (const step of steps) {
    for (const dep of step.dependsOn) {
      if (!byId.has(dep)) continue;
      adjacency.get(dep)!.push(step.id);
      indegree.set(step.id, (indegree.get(step.id) ?? 0) + 1);
    }
  }

  const queue = [...indegree.entries()]
    .filter(([, d]) => d === 0)
    .map(([id]) => id);
  const order: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of adjacency.get(id) ?? []) {
      const d = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, d);
      if (d === 0) queue.push(next);
    }
  }

  return order.length === steps.length ? order : null;
}

/**
 * Longest-path depth of each step, which is how many sequential phases the
 * plan needs. Two steps at the same depth on different arms run in parallel.
 */
export function stepDepths(steps: PlanStep[]): Map<string, number> {
  const depths = new Map<string, number>();
  const order = topologicalOrder(steps) ?? steps.map((s) => s.id);
  const byId = new Map(steps.map((s) => [s.id, s]));

  for (const id of order) {
    const step = byId.get(id);
    if (!step) continue;
    const depth = step.dependsOn.reduce(
      (max, dep) => Math.max(max, (depths.get(dep) ?? -1) + 1),
      0,
    );
    depths.set(id, depth);
  }
  return depths;
}

/**
 * How many steps the plan can run simultaneously at its widest point.
 * Reported in the UI as the plan's realised bimanual parallelism.
 */
export function maxParallelism(steps: PlanStep[]): number {
  const depths = stepDepths(steps);
  const counts = new Map<number, number>();
  for (const depth of depths.values()) {
    counts.set(depth, (counts.get(depth) ?? 0) + 1);
  }
  return Math.max(1, ...counts.values());
}
