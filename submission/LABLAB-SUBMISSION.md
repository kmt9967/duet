# lablab.ai submission — FINAL field-by-field copy

Paste each block verbatim. Verified against production on 2026-09-15.

| | |
|---|---|
| **Track** | Bimanual VLA Manipulation with Multi-Modal Reasoning *(online)* |
| **Bonus** | Best Use of Speechmatics — *"OPEN TO EVERY TRACK", "Onsite + Online", "No assignment needed"* |
| **Team** | Teqprotech |
| **Deadline** | Sep 16, 11:30 PM PST |

> Rule that governs this: *"Each project can be submitted to one track only."*
> The Speechmatics award is a **bonus**, not a track — it layers on top of the
> single track selected. No separate entry, no conflict.

---

## 1. Project name

```
DUET
```

## 2. Tagline

```
Say it. Two arms do it.
```

## 3. Short description

```
Say a dinner-table instruction and two simulated SO-101 arms work out how to do
it — chaining preconditions, assigning arms by real inverse kinematics, and
handing objects between themselves when neither arm can reach alone. One spoken
sentence produces exactly one command. 98% success across 10 randomized seeds.
```

## 4. Full description

```
DUET turns a spoken sentence into coordinated two-arm manipulation.

Say "Set the dinner table." and the system transcribes it live with
Speechmatics, parses it into structured intents, plans a dependency graph of arm
actions, and executes it with both arms running concurrently wherever the graph
allows: 27 steps, 3 hand-offs, 2x parallelism.

Three things make that harder than it sounds.

PRECONDITIONS. The cutlery starts inside a closed drawer. Nothing can be picked
from it until the drawer is opened — and it is opened exactly once, however many
later instructions depend on it. Nothing tells the planner to do this; it falls
out of the dependency graph.

HAND-OFFS THAT ARE FORCED, NOT SCRIPTED. Each place setting is verified at
scene-generation time to sit inside exactly one arm's reach envelope, so moving
an object across the table is physically impossible single-armed. When the arm
holding an object cannot reach the destination and the other one can, the
planner inserts a give/take transfer through the zone where the two envelopes
overlap. Across the benchmark, 28 hand-offs were required in 40 runs. Not one is
special-cased.

The reachable workspace is an annulus, not a disc. A top-down grasp spends the
wrist link vertically, cutting planar reach from 0.32 m to about 0.22 m, and
targets closer than ~0.14 m exceed the elbow stop. Reachability is decided by
solving IK — the scene generator, planner and executor all call the same solver,
so they cannot disagree.

ROBUSTNESS. Object placement, mass, friction, shape, drawer position, lighting
and background are randomized per seed. Grasps can genuinely fail: grip
stability is computed from Coulomb friction against load, so a heavy
low-friction bottle is marginal and sometimes slips. Failures propagate — the
dependent steps are skipped, not silently executed.

The planner is deterministic and no language model sits in the action path. A
model may explain a plan; it never chooses one. The same utterance against the
same seed yields a byte-identical plan, and the test suite enforces it. That is
what makes a reported success rate mean anything.

Measured: 39 of 40 seed-task combinations succeed (98%), where success requires
the command to plan with no errors, every step to execute, AND the world to end
in the requested state. The single failure is retained deliberately — on one
seed the mug lands where neither arm can reach the pouring pose within its elbow
limit, and the system says exactly that.

Runs entirely in the browser. npm install && npm run dev — no Python, no Docker,
no model download. A judge can press a preset and see it work in under a minute,
with no microphone required.
```

## 5. Problem

```
Natural-language robot commands are usually demoed with one arm, one object, and
a fixed scene. Real bimanual manipulation is harder in ways a scripted demo
hides: some instructions have preconditions you must discover, some targets are
physically unreachable by the arm currently holding the object, and the scene is
never the same twice. A system that only works when the plate happens to be
within reach has not solved anything.
```

## 6. Solution

```
A voice-first pipeline where every stage is inspectable:

  speech -> Speechmatics real-time -> segments -> utterance -> parser
        -> deterministic planner -> dependency graph -> executor

The planner emits a graph, not a list, so coordination is data rather than
imperative code: steps at equal depth run on both arms at once, and where an arm
waits you can see which edge is making it wait. Hand-offs are inserted because
IK says the holding arm cannot finish the job — not because a demo path calls
for one.
```

## 7. Technology

```
TypeScript, Next.js 16, React 19, Tailwind CSS 4, Canvas 2D, Speechmatics
Real-Time SDK, Node test runner, Vercel.

Closed-form 5-DOF SO-101 inverse kinematics with real joint limits. Seeded
mulberry32 domain randomization. Coulomb-friction grasp model. Dependency-graph
planner with topological scheduling.

No Python, no Docker, no build-time model download.
```

## 8. Innovation

```
Hand-offs are forced by geometry, not scripted. Each place setting is verified at
generation time to sit inside exactly one arm's reach envelope, so crossing the
table is physically impossible single-armed. 28 hand-offs across 40 runs, none
special-cased.

No language model in the action path. A model may explain a plan; it never
chooses one. Same utterance, same seed, byte-identical plan — enforced by tests.
That is what makes the benchmark meaningful.

The workspace is an annulus, not a disc, and every component agrees on that
because they all call the same IK solver. Sizing it to full arm extension was our
first bug and cost a 3% success rate.
```

## 9. Speechmatics usage

```
Speechmatics is the operator interface for a physical task, not a transcription
feature bolted on. Because the transcript gates a robot action, three things
follow.

ADDTRANSCRIPT IS A SEGMENT, NOT A SENTENCE. This is the detail that matters, and
getting it wrong caused a production bug we found and fixed. Speaking "Set the
dinner table." emits four separate AddTranscript messages — "Set", "the",
"dinner", "table." Dispatching on each one sent four fragments through the
planner, all rejected, flooding the command log, while the sentence the operator
actually spoke never ran. Segments are now buffered and released as one command
on the server's EndOfUtterance boundary, enabled via
conversation_config.end_of_utterance_silence_trigger, with a client-side silence
timeout as fallback. Duplicate boundaries are safe by construction: the buffer
drains on the first one, so a repeat finds nothing — while genuinely repeating a
phrase still produces two commands.

Live-verified, not mocked: 6/6 utterances transcribed, EndOfUtterance received
for each, exactly 1 command emitted for each. Reproduce with `npm run test:voice`;
raw output is committed at evidence/speechmatics/live-test.json.

PARTIALS CAPTION, UTTERANCES EXECUTE. Partial transcripts drive the live caption
so the operator can see they are being heard, but nothing is parsed until a whole
sentence is assembled. A half-heard phrase never moves an arm.

BUILT FOR ASR OUTPUT, NOT PROSE. Real transcripts arrive with no punctuation,
with fillers, and with homophones. DUET recovers clause boundaries from
command-verb onsets — so "open the drawer pick up the plate place it down"
splits correctly with zero punctuation — strips fillers, and maps "arm be" and
"arm eight" to arm B and arm A. In live testing Speechmatics returned "pick up
the plate with arm", dropping the "A"; the parser emitted a pick with no arm
binding and the planner assigned one itself by reachability. The command still
executed. That is the designed degradation path, observed live.

CREDENTIALS AND COST. The API key never reaches the browser — a server route
mints a 120-second JWT, rate-limited to 60 per hour so a reconnect loop cannot
drain free-tier credits. The microphone is requested BEFORE a token is minted,
so a refused permission prompt costs nothing. Verified absent from the
production HTML and all client bundles. Every failure path degrades to typed
input and says why, on the identical code path.
```

## 10. Bimanual reasoning

```
Intents become a dependency graph of primitive arm actions. Three responsibilities
live in the planner:

Precondition chaining — an object inside a closed drawer implies opening that
drawer first, once, however many intents depend on it.

Arm assignment by real IK — every candidate grasp is tested with the actual
solver against joint limits, not a bounding sphere, and checked at the approach
angle the step will really use. A pour executes at -45 degrees, and checking it
top-down would let the planner commit to a step the executor then refuses.

Hand-off insertion — when the holding arm cannot reach the destination and the
other can, a give/take pair is emitted through the shared zone.

Two invariants the executor depends on and the tests enforce: an arm is never
scheduled to do two things at once, and a failed step marks its dependents
skipped rather than running them anyway.
```

## 11. Robustness

```
Evaluated across 10 randomized seeds and 4 tasks with no per-seed tuning: 39/40,
98%.

Randomized per seed: object placement, mass (x0.8-1.3), friction (x0.7-1.35),
per-axis shape jitter (+/-12%), drawer position, placemat positions, lighting,
background.

Success requires all three: the command planned with zero errors, every emitted
step executed without failure, and every goal predicate satisfied on the final
world state. Scoring on goal predicates alone would let a plan that silently
dropped half the command pass whenever the scene happened to start near the
goal — that exact false pass appeared during development and is why the first
two criteria were added.

The single failure is kept. Tuning it away would make the 98% meaningless.
```

## 12. Challenges we ran into

```
The success rate went 3% -> 53% -> 73% -> 98%, and three of the four causes were
silent failures producing plausible-looking plans that were missing most of the
command.

1. The workspace was sized to the arm's full extension. A top-down grasp cannot
   use the wrist link horizontally, so almost nothing was actually reachable.
2. The elbow joint limit rejected near-field targets needing 1.84 rad on the
   elbow-down branch, and the grasp model rejected loads a real gripper holds.
3. Normalisation stripped commas BEFORE clause splitting, collapsing
   multi-command utterances into one run-on clause and discarding everything
   after the first verb.
4. An arm-binding regex matched at the word boundary before "with" and captured
   the preposition instead of the arm name.

None threw an exception. They were found by reading per-seed traces rather than
aggregate numbers. All four are now regression tests.

The hardest one came last and only appeared in production: AddTranscript is an
incremental segment, not a sentence, so every spoken command was being executed
as fragments. Our own Node harness had hidden it by joining all segments and
parsing once at the end — testing a code path the browser never used. The fix
was to buffer segments and wait for a real end-of-utterance boundary, and the
harness now mirrors the browser exactly.
```

## 13. Future work

```
- Camera-to-state perception, so the multi-modal half is addressed on the vision
  side rather than only in language.
- Port the scene and kinematics to MuJoCo for real contact dynamics and arm-arm
  collision.
- Distil the deterministic planner's traces into a learned policy (ACT or
  SmolVLA via LeRobot) and compare against the symbolic baseline on the same
  seeds.
- Quantise the perception stage to OpenVINO IR and benchmark on Intel Core Ultra
  Series 2/3 hardware.
- Multilingual command input; Speechmatics supports it and the intent layer is
  already language-agnostic.
```

## 14. Technology tags

```
TypeScript, Next.js, React, Speechmatics, Robotics, Bimanual Manipulation,
Inverse Kinematics, Task Planning, Simulation, Voice AI, Physical AI
```

## 15. Category tags

```
Physical AI, Robotics, Voice, Developer Tools
```

---

## 16. Links

| Field | Value |
|---|---|
| Public GitHub repository | `https://github.com/kmt9967/duet` |
| Application URL | `https://duet-alpha-ebon.vercel.app` |
| Demo application platform | Vercel |
| Video presentation | `<PASTE YOUTUBE URL>` |
| Slide presentation | `<PASTE SLIDES PDF/LINK>` |
| Cover image | `evidence/final-ui/00-cover.png` |

---

## 17. Rubric self-assessment (for your own reference — do not paste)

| Criterion | Pts | Position |
|---|---|---|
| End-to-end task completion & bimanual manipulation | 30 | Strong — 98%/10 seeds, 28 forced hand-offs, 2× parallelism. **Not MuJoCo.** |
| VLA / multi-modal reasoning | 20 | Partial — language side strong, **no learned policy, perception not from pixels**. |
| Robustness & generalization | 15 | Strong — 6 randomization axes, results across 10 seeds including the failure. |
| OpenVINO & Intel Core Ultra optimization | 20 | **Not claimed.** No such hardware. |
| Technical quality & reproducibility | 10 | Strong — deterministic, 53 tests, one-command setup, committed evidence. |
| Innovation & technical demonstration | 5 | Strong — geometry-forced hand-offs, zero-install live demo. |

Do not overstate the 20 unclaimed points. Judges will check.
