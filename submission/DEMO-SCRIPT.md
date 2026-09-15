# Demo recording script — FINAL

**Target 3:30–3:50.** Record against **production**: <https://duet-alpha-ebon.vercel.app>
Repository: <https://github.com/kmt9967/duet>

Plain English. Short sentences. Everything shown is live — no edits that imply
something the build does not do.

## Before you hit record

- Production open, window **1440 × 900**, zoom 100%, seed **1**.
- Microphone tested once. Quiet room.
- Second terminal at the repo root, ready with `npm run bench` typed but not run.
- Nothing on screen that shows a key: no `.env.local`, no Speechmatics portal,
  no Vercel settings.
- Do one silent practice run of the voice section. The recogniser needs a short
  pause after each sentence to close the utterance — speak, then stop.

---

## 0:00 – 0:20 · The problem

> Console at rest, both arms home.

"This is the worked example from Intel's challenge brief."

> Read it aloud:
> *"Open the top drawer, pick up the plate with arm A, place it on the table, pick up the mug with arm B, pour water into the mug with arm A."*

"One sentence. It hides three problems. The cutlery is locked in a closed drawer. Neither arm can reach the whole table. And the world is different every run."

---

## 0:20 – 0:45 · The workspace

> Point at the two dashed rings.

"Two SO-101 arms, seen from above. These rings are what each arm can actually reach."

> Point at the hole in the middle of a ring.

"That hole is real. Reaching too close to the base needs more elbow bend than the motor allows. So the reachable area is a ring, not a circle."

> Point at the two placemats.

"And here's what matters. Each place setting sits inside only one arm's ring. So moving something across the table is impossible for a single arm."

---

## 0:45 – 1:20 · Speak one sentence

> Click **LISTEN**, allow the mic. Say clearly, then **pause**:

**"Set the dinner table."**

"I'm just talking. Speechmatics is transcribing live."

> Point at the grey partial text while it is still moving.

"The grey text is a partial. It's still changing, so it never reaches the robot."

> The plan appears.

"And that's one command. Not five."

> Point at the command log — **one row**.

"Speechmatics actually sends that sentence in four pieces — 'Set', 'the', 'dinner', 'table'. The app waits for the end of the sentence before it does anything. One sentence in, one command out."

---

## 1:20 – 1:50 · Two arms at once

> Let it play. Say nothing for a few seconds.

"Twenty-seven steps. Watch both arms move together."

> Point at a plan row with two highlighted steps.

"That's not decoration. The plan is a dependency graph. These two steps have no ordering constraint, so both arms genuinely run at the same time."

> Point at **PARALLELISM 2×**.

> Point at the drawer as it opens.

"It opened the drawer first, because the fork is inside it. Nothing told it to. It worked that out as a precondition."

---

## 1:50 – 2:20 · The forced hand-off

> Scrub to the give/take moment. Point at both arms at the centre.

"Three hand-offs in this plan. Here's one. Arm B brings the plate to the middle. Arm A takes it."

> Point at the overlap of the two rings.

"That's the only zone both arms can reach."

"This isn't animation. The planner checked reachability with real inverse kinematics, found the holding arm couldn't finish, and inserted the transfer. Across the benchmark, twenty-eight hand-offs were needed in forty runs. None are scripted."

---

## 2:20 – 2:50 · More voice, including failure

> Click **LISTEN**. Say, pausing between each:

**"Stop."** → "Stop is a control command. It halts playback and produces no robot steps at all."

**"Continue."** → "And it picks up where it left off."

**"Pick up the mug and place it on the right setting."**

"Same pipeline, spoken."

"And when transcription isn't perfect it degrades instead of breaking. In our live test Speechmatics returned 'pick up the plate with arm' — it dropped the 'A'. The system just assigned an arm itself by reachability and carried on."

> Optionally type a command.

"Typing takes the identical path. Same parser, same planner, same executor."

---

## 2:50 – 3:15 · Robustness

> Change the seed: 3, then 5, then 7.

"Every seed is a different world. Positions, weights, friction, shapes — all randomized."

> Switch to the terminal. Run `npm run bench`. Under a second.

"Same pipeline, headless, ten seeds, four tasks."

> Point at the last line.

"Thirty-nine out of forty. Ninety-eight percent."

"Success is strict here: it has to plan with no errors, every step has to execute, *and* the world has to end up how I asked."

> Point at the one FAIL row.

"That failure is real and I kept it. On that seed the mug lands where neither arm can reach the pouring angle, and the system says exactly that. I could have tuned it away — then the ninety-eight wouldn't mean anything."

---

## 3:15 – 3:35 · Architecture and honesty

"Speech, to parser, to planner, to executor. The planner is deterministic — same seed, same plan, byte for byte, and the tests enforce it. No language model sits in the action path. A model can explain a plan; it never chooses one."

> On screen: the README scope section.

"Two honest limits. This isn't MuJoCo — it's a purpose-built deterministic simulator, which is why it runs in a browser with no install. And there are no OpenVINO or Intel Core Ultra numbers, because I built this on a 2012 Core i5 with no NPU. That's twenty points of the rubric I'm not claiming."

---

## 3:35 – 3:50 · Close

"Real inverse kinematics. Hand-offs forced by geometry. Fifty-three tests. Ninety-eight percent across ten seeds. Live Speechmatics. And you drive it by talking."

> End on the console mid-hand-off.

"DUET. It's deployed — open the link and press a preset. No install, no sign-up, no microphone needed."

---

## Recording notes

- **Pause after each spoken sentence.** The end-of-utterance detector needs a
  moment of silence to close the sentence. Running two sentences together will
  merge them into one command.
- **Do not over-enunciate.** The filler and homophone handling is a feature.
- If transcription mis-hears once, **keep it in**. It is more convincing than a
  clean take, and the system handles it.
- Keep the mouse still while the animation plays.
- Run the benchmark live in a terminal, not as a screenshot.
- Do not show any key on screen at any point.
