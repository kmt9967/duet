/**
 * Benchmark runner.
 *
 *   npm run bench            # human-readable table
 *   npm run bench -- --json  # machine-readable, written to evidence/
 *
 * Every number this prints is measured on the machine it runs on. Nothing here
 * is hard-coded or illustrative.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { cpus, totalmem } from "node:os";

import {
  DEFAULT_SEEDS,
  runBenchmark,
  type Benchmark,
} from "../src/lib/eval/harness";

const asJson = process.argv.includes("--json");
const seedArg = process.argv.find((a) => a.startsWith("--seeds="));
const seeds = seedArg
  ? seedArg
      .slice("--seeds=".length)
      .split(",")
      .map((s) => Number.parseInt(s, 10))
      .filter((n) => Number.isFinite(n))
  : DEFAULT_SEEDS;

const started = performance.now();
const benchmark: Benchmark = runBenchmark(seeds);
const elapsed = performance.now() - started;

const host = {
  cpu: cpus()[0]?.model?.trim() ?? "unknown",
  cores: cpus().length,
  memoryGb: Math.round((totalmem() / 1024 ** 3) * 10) / 10,
  node: process.version,
  platform: `${process.platform} ${process.arch}`,
};

if (asJson) {
  const outPath = resolve(process.cwd(), "evidence/benchmarks/benchmark.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    JSON.stringify({ host, totalRuntimeMs: elapsed, ...benchmark }, null, 2),
  );
  console.log(`Wrote ${outPath}`);
} else {
  const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
  const ms = (n: number) => `${n.toFixed(2)} ms`;

  console.log("\nDUET — bimanual pipeline benchmark");
  console.log("=".repeat(72));
  console.log(`Host        ${host.cpu} (${host.cores} cores, ${host.memoryGb} GB)`);
  console.log(`Runtime     Node ${host.node} on ${host.platform}`);
  console.log(`Seeds       ${seeds.join(", ")}`);
  console.log("=".repeat(72));

  for (const task of benchmark.tasks) {
    console.log(`\n${task.title}  [${task.taskId}]`);
    console.log(`  "${task.utterance}"`);
    console.log(
      `  success ${task.successCount}/${task.seeds.length} (${pct(task.successRate)})` +
        `   mean ${ms(task.meanPipelineMs)}   p95 ${ms(task.p95PipelineMs)}` +
        `   steps ~${task.meanStepCount.toFixed(1)}   hand-offs ${task.totalHandoffs}`,
    );

    for (const seed of task.seeds) {
      const mark = seed.success ? "PASS" : "FAIL";
      const detail = seed.success
        ? ""
        : `  <- ${seed.firstFailure ?? seed.planErrors[0] ?? "goal not satisfied"}`;
      console.log(
        `    seed ${String(seed.seed).padStart(2)}  ${mark}` +
          `  steps ${String(seed.completedSteps).padStart(2)}/${String(seed.stepCount).padStart(2)}` +
          `  par ${seed.realisedParallelism}` +
          `  ${seed.pipelineMs.toFixed(2)} ms${detail}`,
      );
    }
  }

  console.log("\n" + "=".repeat(72));
  console.log(
    `Overall success rate: ${pct(benchmark.overallSuccessRate)}  ` +
      `(harness completed in ${elapsed.toFixed(0)} ms)`,
  );
  console.log("=".repeat(72) + "\n");
}
