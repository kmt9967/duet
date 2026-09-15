# Demo video script — DUET

**Target: 3:00–3:30.** Plain English, short sentences. Everything shown is live; nothing is faked.

**Before recording**
- `npm run dev`, browser at 1440×900, seed **1** selected.
- `SPEECHMATICS_API_KEY` set in `.env.local` so the voice path is live.
- Quiet room, microphone tested once.
- Have a second terminal ready for `npm run bench`.

---

## 0:00 – 0:20 — The problem

> **On screen:** the console at rest, both arms in their home pose.

"This is the worked example from Intel's challenge brief."

> **Show the sentence on screen or read it:**
> *"Open the top drawer, pick up the plate with arm A, place it on the table, pick up the mug with arm B, pour water into the mug with arm A."*

"One sentence. But the cutlery is locked inside a closed drawer. And neither arm can reach the whole table. So the robot has to work out an order, and it has to work out when to pass things between its own two hands."

---

## 0:20 – 0:50 — Speak it

> **Click LISTEN. Speak the full sentence naturally — do not over-enunciate.**

"I'm just talking. Speechmatics is transcribing in real time."

> **Point at the live caption as partials update, then settle.**

"The grey text is a partial — it's still changing. Only the settled transcript gets executed. A half-heard phrase never moves an arm."

> **The plan appears. Point at the acknowledgement line.**

"It understood five instructions and planned thirteen steps. And it's telling me one hand-off is needed, because the arms can't both reach."

---

## 0:50 – 1:30 — Watch it run

> **Let the animation play. Do not narrate over the whole thing — let it breathe for a few seconds.**

"Watch both arms move at the same time."

> **Point at the plan panel, phase P00 — two rows highlighted at once.**

"That's not cosmetic. The plan is a dependency graph. These two steps have no ordering constraint between them, so both arms genuinely execute together. Where there *is* a constraint, one arm waits — and you can see why."

> **Point at the drawer as it opens.**

"It opened the drawer first, because the fork is inside it. Nothing told it to do that. It's a precondition the planner worked out."

---

## 1:30 – 2:00 — The hand-off

> **Run the preset "Cross-workspace transfer" — or say:** "pick up the mug and place it on the right setting".

"Now something harder. The mug is on one side. The target setting is on the other."

> **Point at the two dashed rings.**

"These are the reach envelopes. Each place setting sits inside exactly one arm's envelope. So this move is physically impossible for a single arm."

> **Watch the give/take at the centre.**

"Arm B brings it to the middle. Arm A takes it. That transfer isn't scripted — the planner checks reachability with real inverse kinematics, sees the holding arm can't finish the job, and inserts the hand-off."

---

## 2:00 – 2:30 — It's real, and it can fail

> **Change the seed dropdown — click through 3, 5, 7. The scene changes each time.**

"Every seed is a different world. Object positions, weights, friction, shapes — all randomized."

> **Run the same command on a new seed.**

"Same sentence, different world, and the plan comes out different — because it's actually reasoning about the geometry, not replaying a recording."

> **If a grasp slips, point at the red step. If not, say:**

"Grasps can fail too. Grip stability is computed from friction against load, so a heavy, low-friction bottle is genuinely marginal. When it slips, the steps that depended on it are skipped — not silently run anyway."

---

## 2:30 – 3:00 — The numbers

> **Switch to the terminal. Run `npm run bench`. Let it finish — it takes under a second.**

"Same pipeline, headless, ten randomized seeds, four tasks."

> **Point at the bottom line.**

"Thirty-nine out of forty. Ninety-eight percent."

"And 'success' here is strict: the command has to plan with no errors, every step has to execute, *and* the world has to actually end up in the state I asked for."

> **Point at the one FAIL row.**

"That failure is real and I left it in. On that seed the mug ends up somewhere neither arm can reach the pouring pose. The system says exactly that. I could have tuned it away, but then the ninety-eight percent wouldn't mean anything."

---

## 3:00 – 3:20 — What I'm not claiming

> **On screen: the README limitations section.**

"Two honest limits. This isn't MuJoCo — it's a purpose-built deterministic simulator, which is why it runs in a browser with no install. And there are no OpenVINO or Intel Core Ultra numbers, because I built this on a 2012 Core i5 with no NPU. That's twenty points of the rubric I'm not claiming."

---

## 3:20 – 3:30 — Close

"Deterministic planner. Real inverse kinematics. Forced hand-offs. Measured across ten seeds. And you drive it by talking."

> **End on the console with both arms mid-hand-off.**

"DUET. Clone it and `npm run dev` — that's the whole setup."

---

## Recording notes

- **Do not** speak the command slowly or unnaturally. The parser's filler and homophone handling is a feature — let it show.
- If transcription mis-hears once, **keep it in** and let the system either handle it or report it. That is more convincing than a clean take.
- Keep the mouse still while the animation plays.
- Show the terminal benchmark live rather than a screenshot.
