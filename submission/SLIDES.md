# Slide deck — DUET

Ten slides, one idea each. Dark background, monospace for technical labels, matching the console.

**Live:** <https://duet-alpha-ebon.vercel.app> · **Repo:** <https://github.com/kmt9967/duet>

---

## 1 — DUET

> # DUET
> ### Dual-arm Execution from Everyday Talk
>
> **Say it. Two arms do it.**
>
> `AI Infra Summit Hackathon 2026`
> `Intel — Bimanual VLA Manipulation · Best Use of Speechmatics`

**Visual:** full-bleed console screenshot, both arms mid-hand-off.

---

## 2 — Problem

> *"Open the top drawer, pick up the plate with arm A, place it on the table, pick up the mug with arm B, pour water into the mug with arm A."*
>
> — Intel challenge brief
>
> **One sentence. Three hidden problems.**
>
> 1. The cutlery is locked inside a **closed drawer**
> 2. **Neither arm can reach the whole table**
> 3. The world is **different every run**

**Visual:** the sentence large; the three problems small beneath it.

---

## 3 — Voice-first solution

> Speak it. The robot works out the rest.
>
> - **Speechmatics real-time** — partials caption, **finals execute**
> - A half-heard phrase **never moves an arm**
> - Parser built for **ASR output, not prose**: no punctuation, fillers, homophones
> - Typed input takes the **identical** path — the fallback is not a different system
>
> ### Verified live: 5/5 transcribed, 5/5 actionable

**Visual:** voice panel with a partial transcript mid-update.

---

## 4 — System architecture

> ```
> speech ─► Speechmatics RT ─► transcript
>                                  │
>                            parser (deterministic)
>                                  │ intents
>                            planner (deterministic)
>                                  │ dependency graph
>                            executor (IK + grasp model)
>                                  │
>                    ┌─────────────┴─────────────┐
>              animated plan view         benchmark harness
> ```
>
> **No language model in the action path.** A model may *explain* a plan; it never chooses one.
>
> Same seed → byte-identical plan. Enforced by tests.

**Visual:** the pipeline diagram, annotated.

---

## 5 — Bimanual task planning

> A plan is a **dependency graph**, not a list.
>
> - **Preconditions chain** — a closed drawer opens once, however many steps need it
> - **Arms assigned by real IK**, against actual joint limits
> - Steps at equal graph depth run **concurrently**
>
> ### 2× parallelism realised on every seed
>
> Where an arm waits, the graph shows you *why*.

**Visual:** plan panel with two steps highlighted on one row.

---

## 6 — Speechmatics integration

> | Spoken | Returned | Result |
> |---|---|---|
> | "Set the dinner table." | *Set the dinner table.* | 27 steps, 3 hand-offs |
> | "Stop." | *Stop.* | control intent — correctly **not** planned |
> | "…plate with arm **A**" | *"…plate with arm."* | **"A" lost — still executed** |
>
> The third row is the important one: the parser emitted a pick with no arm binding, and the planner assigned one itself by reachability.
>
> **Key never reaches the browser.** 120 s JWT, 60/hour quota guard. Microphone requested *before* a token is minted, so a refused prompt costs nothing.

**Visual:** terminal output of `npm run test:voice`.

---

## 7 — Hand-offs and parallelism

> Each place setting is **verified at generation time** to sit inside exactly one arm's reach envelope.
>
> Cross-table moves are **physically impossible single-armed.**
>
> ### 28 hand-offs required across 40 runs
> Not one of them special-cased.
>
> The reachable area is an **annulus, not a disc** — 0.22 m planar reach from 0.32 m of extension, and a 0.14 m hole set by the elbow stop.

**Visual:** the two dashed envelopes with the overlap zone highlighted, arrow showing the transfer.

---

## 8 — Robustness benchmark

> ### 39 / 40 — 98% across 10 randomized seeds
>
> | Task | Success |
> |---|---|
> | Full place setting | 10/10 |
> | Cross-workspace transfer | 10/10 |
> | The brief's worked example | 9/10 |
> | `set the dinner table` | 10/10 |
>
> Randomized per seed: placement, mass, friction, shape, lighting, background.
>
> **"Success" = planned with no errors AND every step executed AND the world ended in the requested state.**
>
> The one failure is **retained deliberately.**

**Visual:** terminal benchmark output, the FAIL row visible.

---

## 9 — Technical honesty

> **What we are not claiming:**
>
> - **No OpenVINO / Intel Core Ultra results.** Built on a 2012 Core i5, no NPU. **20 rubric points we are not claiming.**
> - **Not MuJoCo.** A purpose-built deterministic simulator — which is why it runs in a browser with zero install.
> - **No learned policy.** Reasoning is symbolic.
> - **Perception reads scene state, not pixels.**
>
> **What is real:** kinematics, joint limits, the reach annulus, hand-off logic, friction-based grasp failure, domain randomization, concurrency, and every number reported.

**Visual:** plain text, no imagery. This slide should feel deliberate.

---

## 10 — Why DUET

> - **Deterministic** — same seed, same plan, byte for byte. Test-enforced.
> - **Honest** — 29 tests, committed evidence, limitations up front.
> - **Reproducible** — `npm install && npm run dev`. No Python, no Docker, no downloads.
> - **Live** — real Speechmatics, verified end to end.
>
> ### A judge can run the whole thing in a browser in under a minute.
>
> **duet-alpha-ebon.vercel.app**

**Visual:** console screenshot, clean state, QR code to the live URL.
