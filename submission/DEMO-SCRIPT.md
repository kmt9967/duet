# Demo video script — DUET

**Target: 3:30–3:50.** Plain English, short sentences. Everything shown is live; nothing is faked.

**Live demo:** <https://duet-alpha-ebon.vercel.app>
**Repository:** <https://github.com/kmt9967/duet>

**Before recording**
- `npm run dev` (or use the production URL), browser at 1440×900, seed **1**.
- `SPEECHMATICS_API_KEY` set in `.env.local` so the voice path is live.
- Quiet room, microphone tested once.
- Second terminal ready at the repo root for `npm run bench`.

---

## 0:00 – 0:20 — DUET, and the problem

> **On screen:** the console at rest, both arms in their home pose.

"This is the worked example from Intel's challenge brief."

> **Read it:**
> *"Open the top drawer, pick up the plate with arm A, place it on the table, pick up the mug with arm B, pour water into the mug with arm A."*

"One sentence. But it hides three problems. The cutlery is locked in a closed drawer. Neither arm can reach the whole table. And the world is different every single run."

---

## 0:20 – 0:45 — The dinner-table environment

> **Point at the workspace panel.**

"Two SO-101 arms, seen from above. The dashed rings are what each arm can actually reach."

> **Point at the hole in the middle of a ring.**

"That hole is real. Reaching too close to the base needs more elbow bend than the motor allows. So the reachable area is a ring, not a circle."

> **Point at the two placemats.**

"Here's the important part. Each place setting sits inside only one arm's ring. So moving something across the table is physically impossible for one arm."

---

## 0:45 – 1:20 — Speak the command

> **Click LISTEN. Say clearly and naturally:** "Set the dinner table."

"I'm just talking. Speechmatics is transcribing live."

> **Point at the caption as partials update, then settle.**

"The grey text is a partial — still changing. Only the settled transcript gets executed. A half-heard phrase never moves an arm."

> **The plan appears. Point at the acknowledgement.**

"One instruction. Twenty-seven steps planned. And it's already telling me three hand-offs are needed, because the arms can't both reach."

---

## 1:20 – 1:50 — Two arms at once

> **Let it play. Stay quiet for a few seconds and let the motion read.**

"Watch both arms move together."

> **Point at the plan panel, a row with two highlighted steps.**

"That's not decoration. The plan is a dependency graph. These two steps have no ordering constraint, so both arms genuinely run at the same time."

> **Point at the PARALLELISM stat showing 2×.**

"Where there *is* a constraint, one arm waits — and the graph shows you exactly why."

> **Point at the drawer opening.**

"It opened the drawer first, because the fork is inside. Nothing told it to. That's a precondition it worked out."

---

## 1:50 – 2:20 — The forced hand-off

> **Scroll the plan to the give/take pair. Point at both rows.**

"Here's the moment that matters. Arm B brings the plate to the middle. Arm A takes it."

> **Point at the overlap between the two dashed rings.**

"That's the only zone both arms can reach."

"This isn't a scripted animation. The planner checked reachability with real inverse kinematics, found the holding arm couldn't finish the job, and inserted the transfer. Across the benchmark, twenty-eight hand-offs were needed in forty runs. None of them are special-cased."

---

## 2:20 – 2:50 — Live voice, including when it goes wrong

> **Click LISTEN again. Say:** "Pick up the mug and place it on the right setting."

> **Let it transcribe and run.**

"Same pipeline, spoken."

> **Then say:** "Stop."

"Stop is a control command. It halts playback and produces no robot steps at all — the planner never sees it."

"And when transcription isn't perfect, it degrades instead of breaking. In our live test Speechmatics returned 'pick up the plate with arm' — it dropped the 'A'. The system just assigned an arm itself by reachability and carried on."

> **Optional:** type a command to show the fallback.

"Typing takes the identical path. Same parser, same planner, same executor."

---

## 2:50 – 3:15 — Robustness

> **Change the seed dropdown — 3, then 5, then 7.**

"Every seed is a different world. Positions, weights, friction, shapes — all randomized."

> **Switch to the terminal. Run `npm run bench`. It finishes in under a second.**

"Same pipeline, headless, ten seeds, four tasks."

> **Point at the final line.**

"Thirty-nine out of forty. Ninety-eight percent."

"And success is strict here: it has to plan with no errors, every step has to execute, *and* the world has to end up how I asked."

> **Point at the one FAIL row.**

"That failure is real and I kept it. On that seed the mug ends up where neither arm can reach the pouring angle. The system says exactly that. I could have tuned it away — then the ninety-eight wouldn't mean anything."

---

## 3:15 – 3:35 — Architecture, and what I'm not claiming

"Speech, to parser, to planner, to executor. The planner is deterministic — same seed, same plan, byte for byte, and the tests enforce it. No language model sits in the action path. A model can explain a plan; it never chooses one."

> **On screen: the README scope section.**

"Two honest limits. This isn't MuJoCo — it's a purpose-built deterministic simulator, which is why it runs in a browser with no install. And there are no OpenVINO or Intel Core Ultra numbers, because I built this on a 2012 Core i5 with no NPU. That's twenty points of the rubric I'm not claiming."

---

## 3:35 – 3:50 — Close

"Real inverse kinematics. Hand-offs forced by geometry. Measured across ten seeds. Live Speechmatics. And you drive it by talking."

> **End on the console mid-hand-off.**

"DUET. It's deployed — open the link and press a preset. No install, no sign-up, no microphone needed."

---

## Recording notes

- **Do not** over-enunciate. The filler and homophone handling is a feature — let it show.
- If transcription mis-hears once, **keep it in**. It is more convincing than a clean take, and the system handles it.
- Keep the mouse still while the animation plays.
- Run the benchmark live in a terminal, not as a screenshot.
- Do not show `.env.local` or any key on screen at any point.
