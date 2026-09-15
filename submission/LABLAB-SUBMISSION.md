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

## Speechmatics usage — verified live

```
Verified against the live API, not mocked. 5/5 utterances transcribed and 5/5
turned into executable plans. Reproduce with `npm run test:voice`; raw output is
committed in the repository at evidence/speechmatics/live-test.json.

  "Set the dinner table."            -> 27 steps, 3 hand-offs
  "Pick up the mug and place it on
   the right setting."               -> 4 steps
  "Stop."                            -> control intent, correctly not planned

One run matters more than the clean ones. Speechmatics returned "pick up the
plate with arm." — the "A" was lost. The parser emitted a pick with no arm
binding, the planner assigned an arm itself by reachability, and the command
still executed. That is the designed degradation path, observed live.
```

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
| GitHub repository | https://github.com/kmt9967/duet |
| Application URL | https://duet-alpha-ebon.vercel.app |
| Demo platform | Vercel |
| Video presentation | `<RECORD — see DEMO-SCRIPT.md>` |
| Slide presentation | `<EXPORT — see SLIDES.md>` |

---

## Tagline

```
Say it. Two arms do it.
```

Alternate:

```
Dual-arm Execution from Everyday Talk.
```

## Innovation

```
Three things here are unusual for a hackathon build.

Hand-offs are forced by geometry, not scripted. Each place setting is verified at
scene-generation time to sit inside exactly one arm's reach envelope, so moving
an object across the table is physically impossible single-armed. The planner
discovers this by solving IK and inserts a transfer. 28 hand-offs were required
across 40 benchmark runs and not one is special-cased.

No language model sits in the action path. A model may explain a plan; it never
chooses one. The same utterance against the same seed yields a byte-identical
plan, enforced by the test suite. That is what makes a reported success rate
mean anything.

The reachable workspace is an annulus, not a disc. A top-down grasp spends the
wrist link vertically, cutting planar reach from 0.32 m to about 0.22 m, and
targets closer than ~0.14 m exceed the elbow stop. Every position is validated
by the same IK solver the planner and executor use, so the three can never
disagree. Sizing the workspace to full extension was our first bug and it cost a
3% success rate.
```

## Challenges we ran into

```
The honest version: the success rate went 3% -> 53% -> 73% -> 98%, and three of
the four causes were silent failures that produced plausible-looking plans
missing most of the command.

1. The workspace was sized to the arm's full extension. A top-down grasp cannot
   use the wrist link horizontally, so almost nothing was actually reachable.
2. The elbow joint limit rejected near-field targets that needed 1.84 rad on the
   elbow-down branch, and the grasp model rejected loads a real gripper holds.
3. Normalisation stripped commas BEFORE clause splitting, collapsing
   multi-command utterances into one run-on clause and discarding everything
   after the first verb.
4. An arm-binding regex matched at the word boundary before "with" and captured
   the preposition instead of the arm name.

None of these threw an exception. They were found by reading per-seed traces
rather than aggregate numbers. All four are now regression tests.

Testing against the live Speechmatics API then surfaced two more: a deprecated
config field, and an ordering flaw where a denied microphone still consumed a
session because the JWT was minted first.
```

## Future work

```
- Camera-to-state perception, so the multi-modal half is addressed on the vision
  side rather than only in language.
- Port the scene and kinematics to MuJoCo to gain real contact dynamics and
  arm-arm collision.
- Distil the deterministic planner's traces into a learned policy (ACT or
  SmolVLA via LeRobot) and compare success rates against the symbolic baseline
  on the same seeds.
- Quantise the perception stage to OpenVINO IR and benchmark on Intel Core Ultra
  Series 2/3 hardware.
- Multilingual command input; Speechmatics supports it and the intent layer is
  already language-agnostic.
```

## Cover image

Use `evidence/screenshots/01-command-center.png` — the console mid-execution with
both arms articulated, the plan's parallel phases visible, and the hand-off
annotation on screen.
