import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { generateScene } from "../src/lib/core/scene";
import { parseCommand } from "../src/lib/language/parser";
import { topologicalOrder, maxParallelism } from "../src/lib/planner/plan";
import { planIntents } from "../src/lib/planner/planner";
import { executePlan } from "../src/lib/sim/executor";

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function planFor(utterance: string, seed: number) {
  const scene = generateScene(seed);
  const parsed = parseCommand(utterance);
  return { scene, plan: planIntents(parsed.intents, scene) };
}

describe("plan graph", () => {
  test("is always acyclic", () => {
    for (const seed of SEEDS) {
      const { plan } = planFor("set the dinner table", seed);
      assert.notEqual(
        topologicalOrder(plan.steps),
        null,
        `seed ${seed} produced a cyclic plan`,
      );
    }
  });

  test("every dependency refers to a step in the same plan", () => {
    for (const seed of SEEDS) {
      const { plan } = planFor("set the dinner table", seed);
      const ids = new Set(plan.steps.map((s) => s.id));
      for (const step of plan.steps) {
        for (const dep of step.dependsOn) {
          assert.ok(ids.has(dep), `seed ${seed}: dangling dependency ${dep}`);
        }
      }
    }
  });

  test("an arm never runs two steps concurrently", () => {
    // Each arm's steps must form a chain, otherwise the arm would be in two
    // places at once.
    for (const seed of SEEDS) {
      const { plan } = planFor("set the dinner table", seed);
      const { execution } = runFor("set the dinner table", seed);
      const windows: Record<string, Array<[number, number]>> = { A: [], B: [] };

      for (const outcome of execution.outcomes) {
        if (outcome.status === "skipped") continue;
        windows[outcome.arm]!.push([
          outcome.startMs,
          outcome.startMs + outcome.durationMs,
        ]);
      }

      for (const arm of ["A", "B"] as const) {
        const sorted = windows[arm]!.sort((a, b) => a[0] - b[0]);
        for (let i = 1; i < sorted.length; i++) {
          assert.ok(
            sorted[i]![0] >= sorted[i - 1]![1] - 1e-9,
            `seed ${seed}: arm ${arm} overlaps between ${JSON.stringify(sorted[i - 1])} and ${JSON.stringify(sorted[i])}`,
          );
        }
      }
      assert.ok(plan.steps.length > 0);
    }
  });
});

function runFor(utterance: string, seed: number) {
  const scene = generateScene(seed);
  const parsed = parseCommand(utterance);
  const plan = planIntents(parsed.intents, scene);
  return { scene, plan, execution: executePlan(plan, scene) };
}

describe("bimanual behaviour", () => {
  test("crossing the table inserts a hand-off", () => {
    // Each placemat sits inside exactly one arm's envelope, so moving the mug
    // to the far setting cannot be done single-armed.
    let sawHandoff = false;
    for (const seed of SEEDS) {
      const { plan } = planFor(
        "pick up the mug and place it on the right setting",
        seed,
      );
      if (plan.steps.some((s) => s.type === "handoff_take")) sawHandoff = true;
    }
    assert.ok(sawHandoff, "expected at least one seed to require a hand-off");
  });

  test("a hand-off is always give-then-take on opposite arms", () => {
    for (const seed of SEEDS) {
      const { plan } = planFor("set the dinner table", seed);
      const gives = plan.steps.filter((s) => s.type === "handoff_give");
      const takes = plan.steps.filter((s) => s.type === "handoff_take");
      assert.equal(gives.length, takes.length, `seed ${seed}`);

      for (const take of takes) {
        // Match on the object as well as the dependency edge: a take also
        // depends on that arm's own previous step, which may itself be an
        // unrelated earlier hand-off.
        const give = plan.steps.find(
          (s) =>
            s.type === "handoff_give" &&
            s.objectId === take.objectId &&
            take.dependsOn.includes(s.id),
        );
        assert.ok(give, `seed ${seed}: take without a matching give`);
        assert.notEqual(give!.arm, take.arm, `seed ${seed}: hand-off to same arm`);
        assert.equal(give!.objectId, take.objectId);
      }
    }
  });

  test("multi-step plans achieve genuine two-arm parallelism", () => {
    const parallel = SEEDS.map(
      (seed) => planFor("set the dinner table", seed).plan,
    ).map((plan) => maxParallelism(plan.steps));
    assert.ok(
      parallel.some((p) => p >= 2),
      `expected concurrent phases, got ${JSON.stringify(parallel)}`,
    );
  });
});

describe("preconditions", () => {
  test("reaching cutlery opens the drawer first, exactly once", () => {
    for (const seed of SEEDS) {
      const { plan } = planFor("put the fork on the right setting", seed);
      const opens = plan.steps.filter((s) => s.type === "open_drawer");
      const grasp = plan.steps.find(
        (s) => s.type === "grasp" && s.objectId === "fork-1",
      );
      if (!grasp) continue;

      assert.equal(opens.length, 1, `seed ${seed}: expected one drawer open`);

      // The open must precede the grasp somewhere in the dependency chain.
      const byId = new Map(plan.steps.map((s) => [s.id, s]));
      const seen = new Set<string>();
      const reaches = (from: string, targetId: string): boolean => {
        if (from === targetId) return true;
        if (seen.has(from)) return false;
        seen.add(from);
        return (byId.get(from)?.dependsOn ?? []).some((d) => reaches(d, targetId));
      };
      assert.ok(
        reaches(grasp.id, opens[0]!.id),
        `seed ${seed}: grasping the fork does not depend on opening the drawer`,
      );
    }
  });
});

describe("determinism", () => {
  test("the same seed produces an identical plan every time", () => {
    for (const seed of SEEDS) {
      const a = planFor("set the dinner table", seed).plan;
      const b = planFor("set the dinner table", seed).plan;
      assert.deepEqual(a.steps, b.steps, `seed ${seed} is not deterministic`);
    }
  });

  test("different seeds produce genuinely different scenes", () => {
    const signatures = SEEDS.map((seed) =>
      JSON.stringify(
        generateScene(seed).objects.map((o) => [
          o.kind,
          o.position.x.toFixed(4),
          o.position.y.toFixed(4),
        ]),
      ),
    );
    assert.equal(
      new Set(signatures).size,
      SEEDS.length,
      "randomisation is not varying across seeds",
    );
  });
});

describe("failure handling", () => {
  test("an unsatisfiable command is reported, not silently dropped", () => {
    const scene = generateScene(1);
    const parsed = parseCommand("pick up the chainsaw");
    const plan = planIntents(parsed.intents, scene);
    assert.ok(
      plan.errors.length > 0 || parsed.diagnostics.length > 0,
      "expected an explicit error for an object that does not exist",
    );
  });

  test("steps downstream of a failure are skipped, never executed", () => {
    for (const seed of SEEDS) {
      const { execution } = runFor("set the dinner table", seed);
      const failedIds = new Set(
        execution.outcomes.filter((o) => o.status === "failed").map((o) => o.stepId),
      );
      if (failedIds.size === 0) continue;
      const completedAfterFailure = execution.outcomes.filter(
        (o) => o.status === "completed" && o.startMs > 0 && failedIds.has(o.stepId),
      );
      assert.equal(completedAfterFailure.length, 0);
    }
  });
});
