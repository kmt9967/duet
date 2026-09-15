/**
 * Evaluation harness.
 *
 * The challenge brief asks for results "across 10 randomized seeds". This module
 * is what produces them. It runs the full pipeline for each seed —
 * transcript -> parse -> ground -> plan -> execute -> score — with no shortcuts
 * and no hand-tuning per seed, then reports the aggregate.
 *
 * Success is judged against an explicit goal predicate, not against "the plan
 * ran without throwing". A plan can execute every step and still fail the task
 * if objects did not end up where the command asked.
 */

import { generateScene } from "../core/scene";
import { type Scene, planarDistance } from "../core/types";
import { parseCommand } from "../language/parser";
import { planIntents } from "../planner/planner";
import { maxParallelism } from "../planner/plan";
import { executePlan, type ExecutionResult } from "../sim/executor";

/** A single condition the final scene must satisfy. */
export type GoalCondition = {
  description: string;
  check: (scene: Scene) => boolean;
};

export type TaskSpec = {
  id: string;
  title: string;
  /** The spoken command, exactly as an operator would say it. */
  utterance: string;
  goals: (scene: Scene) => GoalCondition[];
};

/** Tolerance for "is this object on that placemat", metres. */
const PLACEMENT_TOLERANCE = 0.09;

function objectOnPlacemat(
  scene: Scene,
  kind: string,
  matId: string,
): boolean {
  const object = scene.objects.find((o) => o.kind === kind);
  const mat = scene.placemats.find((m) => m.id === matId);
  if (!object || !mat) return false;
  if (object.location.type !== "table") return false;
  return planarDistance(object.position, mat.center) <= PLACEMENT_TOLERANCE;
}

export const TASKS: TaskSpec[] = [
  {
    id: "full-setting",
    title: "Set a full place setting",
    utterance:
      "open the top drawer, pick up the plate with arm A, place it on the right setting, then put the fork on the right setting",
    goals: () => [
      {
        description: "The top drawer is open",
        check: (s) => (s.drawers[0]?.openness ?? 0) > 0.5,
      },
      {
        description: "The plate is on the right setting",
        check: (s) => objectOnPlacemat(s, "plate", "mat-right"),
      },
      {
        description: "The fork is on the right setting",
        check: (s) => objectOnPlacemat(s, "fork", "mat-right"),
      },
    ],
  },
  {
    id: "handoff-transfer",
    title: "Cross-workspace transfer",
    utterance: "pick up the mug and place it on the right setting",
    goals: () => [
      {
        description: "The mug is on the right setting",
        check: (s) => objectOnPlacemat(s, "mug", "mat-right"),
      },
      {
        description: "No arm is still holding the mug",
        check: (s) => s.arms.A.holding !== "mug-1" && s.arms.B.holding !== "mug-1",
      },
    ],
  },
  {
    id: "brief-example",
    title: "The brief's worked example",
    utterance:
      "open the top drawer, pick up the plate with arm A, place it on the table, pick up the mug with arm B, pour water into the mug with arm A",
    goals: () => [
      {
        description: "The top drawer is open",
        check: (s) => (s.drawers[0]?.openness ?? 0) > 0.5,
      },
      {
        description: "The plate is resting on the table",
        check: (s) => {
          const plate = s.objects.find((o) => o.kind === "plate");
          return plate?.location.type === "table";
        },
      },
    ],
  },
  {
    id: "set-the-table",
    title: "Whole-task macro",
    utterance: "set the dinner table",
    goals: () => [
      {
        description: "The plate is on the right setting",
        check: (s) => objectOnPlacemat(s, "plate", "mat-right"),
      },
      {
        description: "The mug is on the left setting",
        check: (s) => objectOnPlacemat(s, "mug", "mat-left"),
      },
    ],
  },
];

export type SeedResult = {
  seed: number;
  taskId: string;
  /** Every goal condition satisfied. */
  success: boolean;
  goals: Array<{ description: string; satisfied: boolean }>;
  stepCount: number;
  completedSteps: number;
  failedSteps: number;
  handoffCount: number;
  plannedParallelism: number;
  realisedParallelism: number;
  simulatedDurationMs: number;
  /** Wall-clock milliseconds the pipeline itself took. */
  pipelineMs: number;
  planErrors: string[];
  firstFailure?: string;
};

export function runSeed(task: TaskSpec, seed: number): SeedResult {
  const startedAt = performance.now();

  const scene = generateScene(seed);
  const parsed = parseCommand(task.utterance);
  const plan = planIntents(parsed.intents, scene);
  const execution: ExecutionResult = executePlan(plan, scene);

  const goals = task.goals(execution.scene).map((goal) => ({
    description: goal.description,
    satisfied: goal.check(execution.scene),
  }));

  const pipelineMs = performance.now() - startedAt;
  const failures = execution.outcomes.filter((o) => o.status === "failed");

  // A seed only counts as a success when the command was fully planned, every
  // step executed, and the world actually ended in the requested state. Scoring
  // on goal predicates alone would let a plan that silently dropped half the
  // command pass whenever the scene happened to start close to the goal.
  const success =
    goals.length > 0 &&
    goals.every((g) => g.satisfied) &&
    plan.errors.length === 0 &&
    failures.length === 0;

  return {
    seed,
    taskId: task.id,
    success,
    goals,
    stepCount: plan.steps.length,
    completedSteps: execution.outcomes.filter((o) => o.status === "completed").length,
    failedSteps: failures.length,
    handoffCount: execution.handoffCount,
    plannedParallelism: plan.steps.length > 0 ? maxParallelism(plan.steps) : 1,
    realisedParallelism: execution.realisedParallelism,
    simulatedDurationMs: execution.simulatedDurationMs,
    pipelineMs,
    planErrors: plan.errors.map((e) => e.message),
    firstFailure: failures[0]?.detail,
  };
}

export type TaskReport = {
  taskId: string;
  title: string;
  utterance: string;
  seeds: SeedResult[];
  successCount: number;
  successRate: number;
  meanPipelineMs: number;
  p95PipelineMs: number;
  meanStepCount: number;
  totalHandoffs: number;
};

export function runTask(task: TaskSpec, seeds: number[]): TaskReport {
  const results = seeds.map((seed) => runSeed(task, seed));
  const successCount = results.filter((r) => r.success).length;
  const timings = results.map((r) => r.pipelineMs).sort((a, b) => a - b);
  const p95Index = Math.min(timings.length - 1, Math.floor(timings.length * 0.95));

  return {
    taskId: task.id,
    title: task.title,
    utterance: task.utterance,
    seeds: results,
    successCount,
    successRate: results.length > 0 ? successCount / results.length : 0,
    meanPipelineMs:
      timings.reduce((a, b) => a + b, 0) / Math.max(1, timings.length),
    p95PipelineMs: timings[p95Index] ?? 0,
    meanStepCount:
      results.reduce((a, r) => a + r.stepCount, 0) / Math.max(1, results.length),
    totalHandoffs: results.reduce((a, r) => a + r.handoffCount, 0),
  };
}

export type Benchmark = {
  generatedAt: string;
  seeds: number[];
  tasks: TaskReport[];
  overallSuccessRate: number;
};

/** The canonical 10 seeds used in every reported result. */
export const DEFAULT_SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function runBenchmark(
  seeds: number[] = DEFAULT_SEEDS,
  tasks: TaskSpec[] = TASKS,
  now: string = new Date().toISOString(),
): Benchmark {
  const reports = tasks.map((task) => runTask(task, seeds));
  const total = reports.reduce((a, r) => a + r.seeds.length, 0);
  const succeeded = reports.reduce((a, r) => a + r.successCount, 0);

  return {
    generatedAt: now,
    seeds,
    tasks: reports,
    overallSuccessRate: total > 0 ? succeeded / total : 0,
  };
}
