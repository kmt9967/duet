# Benchmarks

Every number here was produced by `npm run bench` on the machine described below. Nothing is estimated, extrapolated, or illustrative. Raw output is committed at [`evidence/benchmarks/`](../evidence/benchmarks/).

## Host

| | |
|---|---|
| CPU | Intel Core i5-3470 @ 3.20 GHz (4 cores / 4 threads, 2012 Ivy Bridge) |
| Memory | 8 GB |
| GPU | NVIDIA GeForce GT 630 |
| Runtime | Node v24.15.0, win32 x64 |

**This is not Intel Core Ultra hardware and has no NPU.** No OpenVINO figures are reported anywhere in this repository. See [Limitations](#what-is-not-measured-here).

## Method

For each of 10 seeds and each of 4 tasks, the harness runs the complete pipeline:

```
utterance ──► parse ──► ground ──► plan ──► execute ──► score goal predicates
```

No per-seed tuning. No retries. The same code path the UI uses.

### Success criterion

A seed counts as a success only when **all three** hold:

1. the command planned with zero plan errors,
2. every emitted step executed without failure,
3. every goal predicate on the final world state is satisfied.

Criterion 3 alone would be too weak — a plan that silently dropped half the command would pass whenever the scene happened to start close to the goal. During development this exact case appeared: a task reported `PASS` with `0/2` steps completed because the mug had spawned within tolerance of the target mat. Criteria 1 and 2 were added in response.

### What is randomized per seed

Object placement, mass (×0.8–1.3), friction (×0.7–1.35), per-axis shape jitter (±12%), drawer position, placemat positions, lighting, and background variant. Cutlery always starts inside a closed drawer.

## Results

Overall: **39/40 (98%)**

| Task | Success | Mean | p95 | Mean steps | Hand-offs |
|---|---|---|---|---|---|
| Full place setting | 10/10 (100%) | 2.23 ms | 12.73 ms | 10.8 | 4 |
| Cross-workspace transfer | 10/10 (100%) | 0.47 ms | 0.76 ms | 5.2 | 6 |
| The brief's worked example | 9/10 (90%) | 0.68 ms | 1.23 ms | 12.2 | 5 |
| Whole-task macro (`set the dinner table`) | 10/10 (100%) | 0.74 ms | 1.13 ms | 23.6 | 13 |

Timings are **reasoning latency** — parse plus plan plus execute — not wall-clock robot motion. The first measurement in a run carries JIT warm-up, which is why p95 on the first task is an order of magnitude above its mean.

### Bimanual behaviour

28 hand-offs were required across the 40 runs. They are emitted because each placemat is verified at generation time to lie inside exactly one arm's reach envelope, so crossing the table is physically impossible single-armed — not because any demo path is scripted.

`set the dinner table` reaches **2× parallelism** on all 10 seeds: two arms genuinely executing at the same graph depth.

## The failure

**`brief-example`, seed 6** — the single failure in 40 runs.

```
Neither arm can pour into the mug where it is.
```

After the plate is placed, the mug ends up at a position where the pour pose — 0.10 m above the rim at a −45° wrist pitch — falls outside both arms' reach annuli. The elbow would need to exceed its 1.95 rad stop.

This is left in deliberately. It is a genuine consequence of the geometry, the planner reports it precisely rather than skipping the step, and the operator is told. Tuning the scene generator until it disappeared would make the reported 100% meaningless.

## How the success rate got here

Recorded because the intermediate numbers are more informative than the final one.

| Stage | Overall | Cause of failure |
|---|---|---|
| First run | **3%** | Workspace sized to the arm's full 0.32 m extension; a top-down grasp spends the wrist link vertically, leaving ~0.22 m of planar reach. Almost nothing was reachable. |
| Geometry rescaled | 53% | Elbow limit of ±1.75 rad rejected near-field targets needing ~1.84 rad on the elbow-down branch. Grasp model also rejected loads a real gripper holds. |
| Limits + grasp model corrected | 73% | Normalisation deleted commas *before* clause splitting, collapsing multi-command utterances into one run-on clause and dropping everything after the first verb. |
| Parser fixed | 98% | — |

Three of those four were silent failures: the system produced a plausible-looking plan that was quietly missing most of the command. They were found by reading actual traces per seed rather than by inspecting aggregate numbers.

## What is *not* measured here

- **OpenVINO / Intel Core Ultra inference.** No such hardware was available. Nothing is claimed.
- **MuJoCo physics fidelity.** This is a purpose-built deterministic simulator, not MuJoCo. Contact dynamics, inter-object collision, and arm–arm collision are not modelled.
- **Learned-policy success rates.** There is no learned policy.
- **Speechmatics transcription latency.** Measured live in the UI per session and displayed there, because it depends on network path and audio hardware. No figure is asserted in documentation.
- **Real-robot transfer.** Everything is simulation. Link lengths approximate published SO-101 geometry but are not a calibrated URDF.

## Reproducing

```bash
npm install
npm run bench                      # human-readable table
npm run bench -- --json            # writes evidence/benchmarks/benchmark.json
npm run bench -- --seeds=11,12,13  # different seeds
```

Output is deterministic: the same seeds produce identical results on any machine. Only the timing columns vary with hardware.
