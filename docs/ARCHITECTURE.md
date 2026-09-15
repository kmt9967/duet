# Architecture

## Pipeline

```
transcript ──► parser ──► intents ──► planner ──► plan graph ──► executor ──► outcomes
                                          ▲                           │
                                          │                           ├──► playback  (UI)
                                      scene (seed)                    └──► harness   (benchmark)
```

Each stage is a pure function of its input plus the scene. There is no hidden state between them, which is why the same seed and the same utterance always produce the same plan and the same outcome.

## Layer by layer

### `core/rng.ts` — determinism

mulberry32, seeded from an integer. Every randomized quantity in a scene derives from this. Without it, a reported success rate across seeds would be meaningless, because seed 7 today would not be seed 7 tomorrow.

### `core/types.ts` — world model

SI units. Table surface is `z = 0`, `+x` points away from the operator, `+y` to the operator's left. Both arms are mounted at the rear edge.

### `core/kinematics.ts` — SO-101 arm

5-DOF plus gripper, modelled as a base yaw joint followed by a planar three-link chain in the vertical plane that yaw selects. This decomposition admits a **closed-form** solution, so IK is exact and allocation-free.

```
joints = [shoulder_pan, shoulder_lift, elbow_flex, wrist_flex, wrist_roll, gripper]
links  = { base: 0.0563, upperArm: 0.1159, forearm: 0.135, wrist: 0.0721 }  // metres
```

IK backs off along the approach direction to find the wrist centre, applies the law of cosines for the elbow, and tries both the elbow-up and elbow-down branches, returning the first that respects joint limits.

**The reach envelope is an annulus.** This is the single most important geometric fact in the system:

- A top-down grasp spends the wrist link *vertically*, so planar reach at table height is about **0.22 m**, not the 0.32 m of full extension.
- A target closer than about **0.14 m** requires roughly 2.0 rad of elbow flexion, past the servo stop — and only the elbow-down branch keeps the wrist within its own limit.

Both bounds are enforced by the solver, and `scene.ts` validates every generated position against it. Getting this wrong was the cause of an early 3% success rate: the workspace had been sized to full extension, so essentially nothing was actually reachable.

### `core/scene.ts` — seeded domain randomization

Randomizes, per the challenge brief's robustness axes: object placement, mass, friction, shape (±12% per axis), lighting, and background variant.

Two structural guarantees, both enforced by resampling against IK rather than by assumption:

- **Every object is reachable by at least one arm.** Sampling validates at the object's *own* grasp height, because a tall bottle trades planar reach for height and a position valid for a plate may not be valid for it.
- **Each placemat sits inside exactly one arm's envelope** — `mat-right` for arm A, `mat-left` for arm B. This is what makes hand-offs structurally necessary rather than decorative.

### `language/parser.ts` — ASR-tolerant understanding

Runs on raw Speechmatics output, so it handles what real transcripts contain:

| Input reality | Handling |
|---|---|
| No punctuation | Clause boundaries recovered from **command-verb onsets** |
| Commas that *are* present | Converted to an explicit marker during normalisation, not deleted |
| Fillers (`um`, `okay so`, `can you`) | Stripped as whole words, longest-first |
| Homophones (`arm be`, `arm eight`) | Explicit token map to arm ids |
| Synonyms (`cup`, `dish`, `serviette`) | Mapped to canonical object kinds |
| Uninterpretable input | Reported as a diagnostic, never silently dropped |

Two bugs found and fixed here during development, both caught by tests now in the suite:

1. Normalisation stripped commas *before* clause splitting, so `"open the drawer, pick up the plate, place it down"` collapsed into one run-on clause and only the first verb matched — silently discarding two thirds of the command.
2. The arm-binding regex `\b(?:with|using)?\s*(?:arm\s+(\w+)|(\w+)\s+arm)\b` matched at the word boundary *before* `with` and captured the preposition itself, so `"with arm A"` yielded `"with"` instead of `"A"`. Now split into two unambiguous patterns.

`"and"` is deliberately **not** a clause boundary: splitting on it would wreck `"the plate and the mug"`, while the verb pass already handles `"pick up the plate and place it down"` correctly.

### `planner/` — dependency graph, not a list

A `Plan` is a graph with explicit `dependsOn` edges. Coordination lives in the graph rather than in imperative code, so the UI can render *why* an arm is waiting.

Three responsibilities:

**Precondition chaining.** An object inside a closed drawer implies opening that drawer first — once, regardless of how many later intents need it.

**Arm assignment by real IK.** Every candidate grasp is tested with the actual solver against joint limits. An explicitly requested arm is honoured when feasible and overridden with a note when not.

**Hand-off insertion.** When the holding arm cannot reach the destination and the other can, a give/take pair is emitted through `HANDOFF_POINT`, on the centreline where the envelopes overlap.

Two invariants the executor relies on:

- `emit()` always adds the arm's previous step as a dependency, so an arm is never scheduled to do two things at once.
- Reachability is checked **at the approach angle the step will actually use**. A pour executes at −45°, and checking it top-down would let the planner commit to a step the executor refuses. This was a real planner/executor disagreement, now closed.

Transit waypoints are also verified, falling through progressively lower clearances and skipping the waypoint entirely rather than emitting an unreachable move.

### `sim/executor.ts` — execution with real failure modes

Walks the graph, advancing every step whose predecessors completed. Steps at equal depth on different arms genuinely run concurrently; `startMs` is derived from the dependency graph.

Grasp outcomes are **modelled, not assumed**:

```
stability = (friction × 18 N) / (mass × 9.81 × 1.2)
```

At or above 1.0 the grip is reliable. Below, slip probability rises linearly, drawn from a seeded RNG so a given seed always fails identically. With the randomization ranges in use, light items are always secure while a heavy low-friction bottle is genuinely marginal — which is the point, since robustness only means something if some conditions are hard.

A failed step marks its dependents `skipped`; they are never executed.

### `sim/playback.ts` — one execution, two consumers

Turns a plan plus its outcomes into a function sampling world state at any point on the simulated clock. The UI renders by calling this each frame, so **the picture on screen is a view of the same execution the benchmark scored**. There is no separate demo animation that could drift from reality.

### `eval/harness.ts` — measurement

Runs `transcript → parse → plan → execute → score` per seed with no per-seed tuning. Success requires no plan errors **and** no failed steps **and** all goal predicates satisfied.

## Why deterministic rather than learned

Given a 2012 CPU, no GPU, no Python and roughly 36 hours, training or fine-tuning a VLA policy was not achievable. Rather than wrap a language model around the action path and call it reasoning, the system makes the trade explicit:

- the planner is symbolic, inspectable, and reproducible;
- an LLM may *explain* a plan but never selects one;
- the limitation is stated in the README rather than obscured.

The cost is real — no learned generalization to unseen object categories. The benefit is that every number reported here is reproducible by anyone who clones the repo, and the failure modes are legible rather than mysterious.

## Rendering

Plan view on Canvas 2D rather than a 3D scene. The three things that matter — which arm can reach what, where the envelopes overlap, and when both arms move at once — are immediately legible from above and would be obscured by a perspective camera. It also renders reliably on the integrated-class GPU this was developed on.

Screen axes are rotated from world axes (`world +y → screen +x`, `world +x → screen −y`) so the arms sit at the bottom of the frame with the table extending upward.
