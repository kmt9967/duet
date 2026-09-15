# lablab.ai submission copy — DUET

Field-ready text for the lablab submission form. Track: **Bimanual VLA Manipulation with Multi-Modal Reasoning** (online). Also entered for the **Best Use of Speechmatics** bonus award, which is open to every track.

---

## Project title

```
DUET — Dual-arm Execution from Everyday Talk
```

## Short description

```
Say a dinner-table instruction and two simulated SO-101 arms work out how to do
it — chaining preconditions, assigning arms by real inverse kinematics, and
handing objects between themselves when neither arm can reach alone. 98% success
across 10 randomized seeds.
```

## Long description

```
DUET turns a spoken sentence into coordinated two-arm manipulation.

Speak "open the top drawer, pick up the plate with arm A, place it on the table,
pick up the mug with arm B, pour water into the mug with arm A" — the worked
example from Intel's challenge brief — and the system transcribes it with
Speechmatics real-time, parses it into structured intents, plans a dependency
graph of arm actions, and executes it with both arms running concurrently
wherever the graph allows.

Three things make that harder than it sounds, and DUET handles all three.

PRECONDITIONS. The cutlery starts inside a closed drawer. Nothing can be picked
from it until the drawer is opened — and it is opened exactly once, however many
later instructions depend on it.

HAND-OFFS THAT ARE FORCED, NOT SCRIPTED. Each place setting is verified at
scene-generation time to sit inside exactly one arm's reach envelope. When the
arm holding an object cannot reach the destination and the other one can, the
planner inserts a give/take transfer through the zone where the two envelopes
overlap. Across the benchmark, 28 hand-offs were required in 40 runs. None of
them are special-cased.

ROBUSTNESS. Object placement, mass, friction, shape, drawer position, lighting
and background are all randomized per seed. Grasps can genuinely fail: grip
stability is computed from Coulomb friction against load, so a heavy
low-friction bottle is marginal and sometimes slips. Failures propagate — the
dependent steps are skipped, not silently executed.

The planner is deterministic and no language model sits in the action path. A
model can explain a plan; it never chooses one. That is what makes the benchmark
meaningful: the same utterance against the same seed yields a byte-identical
plan every time, and the test suite enforces it.

Reachability is decided by solving inverse kinematics, never by a radius test.
This matters more than it sounds — the usable workspace is an annulus, not a
disc, because a target too close to the base needs more elbow flexion than the
servo allows. Getting this wrong was the cause of an early 3% success rate.

Measured result: 39 of 40 seed-task combinations succeed (98%), where "success"
requires the command to plan with no errors, every step to execute, AND the
world to actually end in the requested state. The single failure is retained
deliberately: on one seed the mug lands where neither arm can achieve the
pouring pose within its elbow limit, and the system says exactly that.

Runs entirely in the browser. npm install && npm run dev — no Python, no Docker,
no model download.
```

## Technology tags

```
TypeScript, Next.js, React, Speechmatics, Robotics, Bimanual Manipulation,
Inverse Kinematics, Task Planning, Simulation, Voice AI, Physical AI
```

## Category tags

```
Physical AI, Robotics, Voice, Developer Tools
```

---

## Speechmatics bonus — why this entry

```
Speechmatics is the operator interface for a physical task here, not a
transcription feature bolted on. Because the transcript gates a robot action,
three things follow directly.

Partials caption, finals execute. Partial transcripts drive the live caption so
the operator can see they are being heard, but only a settled transcript is
parsed and executed. A half-recognised phrase never moves an arm.

The parser is built for ASR output, not prose. Real transcripts arrive with no
punctuation, with fillers, and with homophones. DUET recovers clause boundaries
from command-verb onsets — so "open the drawer pick up the plate place it down"
splits correctly with zero punctuation — strips fillers, and maps "arm be" and
"arm eight" to arm B and arm A. Two real bugs were found and fixed here: comma
stripping that silently collapsed multi-command utterances, and a regex that
captured the preposition "with" instead of the arm name. Both are now regression
tests.

Low delay is functional. max_delay is 1.2s because the operator is waiting on a
physical outcome.

Credentials are handled properly. The API key never reaches the browser — a
server route mints a 120-second JWT, rate-limited to 60 per hour so a reconnect
loop cannot drain free-tier credits. Every failure path degrades to typed input
and says why, and typed commands take the identical path through parser, planner
and executor, so the fallback is not a different system.
```

---

## Challenge-rubric self-assessment

Stated plainly rather than implied. The Intel rubric is 100 points.

| Criterion | Pts | What DUET does |
|---|---|---|
| End-to-end task completion & bimanual manipulation | 30 | Full pipeline, 98% across 10 seeds, 28 forced hand-offs, 2× realised parallelism. **Not MuJoCo** — a purpose-built deterministic simulator. |
| VLA / multi-modal reasoning | 20 | Natural-language instruction → grounded intents → multi-step plan with preconditions and context across clauses. Reasoning is symbolic, **not a learned VLA policy**, and perception reads scene state rather than pixels. |
| Robustness & generalization | 15 | Seeded randomization of placement, mass, friction, shape, lighting, background. Results reported across 10 seeds including the failure. |
| OpenVINO & Intel Core Ultra optimization | 20 | **Not addressed.** No Core Ultra hardware was available; the dev machine is a 2012 i5-3470 with no NPU. Nothing is claimed. |
| Technical quality & reproducibility | 10 | Deterministic by construction, 29 tests, one-command setup, committed evidence, benchmark reproducible on any machine. |
| Innovation & technical demonstration | 5 | Hand-offs emerge from verified geometry rather than scripting; zero-install browser demo a judge can run instantly. |

We are not claiming the 20 OpenVINO points. Overstating that would be easy and wrong.

---

## Links

| Field | Value |
|---|---|
| GitHub repository | `<FILL IN>` |
| Application URL | `<FILL IN>` |
| Demo platform | Vercel |
| Video presentation | `<FILL IN>` |
| Slide presentation | `submission/SLIDES.md` |

## Cover image

Use `evidence/screenshots/01-command-center.png` — the console mid-execution with
both arms articulated, the plan's parallel phases visible, and the hand-off
annotation on screen.
