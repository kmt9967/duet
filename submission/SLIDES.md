# Slide deck — FINAL (10 slides)

Built from the current production state. Every number below is measured and
reproducible. Dark background, monospace for technical labels, matching the
console.

**Live:** <https://duet-alpha-ebon.vercel.app> · **Repo:** <https://github.com/kmt9967/duet>

---

## 1 — DUET

> # DUET
> ### Dual-arm Execution from Everyday Talk
>
> **Say it. Two arms do it.**
>
> `AI Infra Summit Hackathon 2026`
> `Intel — Bimanual VLA Manipulation with Multi-Modal Reasoning`
> `Bonus — Best Use of Speechmatics`

**Visual:** `00-cover.png` — console mid-execution, both arms extended.

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

**Visual:** the sentence large; three problems small beneath.

---

## 3 — Voice-first solution

> Speak a sentence. The robot works out the rest.
>
> **"Set the dinner table."** → **27 steps · 3 hand-offs · 2× parallelism · EXECUTED**
>
> - **One spoken sentence = exactly one command**
> - Partials caption only — a half-heard phrase never moves an arm
> - Typed input takes the **identical** path; the fallback is not a different system
>
> ### Live-verified: 6/6 utterances, 1 command each

**Visual:** `04-one-command.png` — command log with a single EXECUTED row.

---

## 4 — System architecture

> ```
> speech ─► Speechmatics RT ─► segments ─► utterance ─► parser
>                                                          │ intents
>                                                    planner (deterministic)
>                                                          │ dependency graph
>                                                    executor (IK + grasp model)
>                                              ┌───────────┴───────────┐
>                                        plan view            benchmark harness
> ```
>
> **No language model in the action path.** A model may *explain* a plan; it never chooses one.
>
> Same seed → byte-identical plan. Enforced by tests.

**Visual:** `09-architecture.png`.

---

## 5 — Bimanual task planning

> A plan is a **dependency graph**, not a list.
>
> - **Preconditions chain** — the drawer opens once, however many steps need it
> - **Arms assigned by real IK**, against actual joint limits
> - Steps at equal graph depth execute **concurrently**
>
> ### 2× parallelism on every seed
>
> Where an arm waits, the graph shows you *why*.

**Visual:** `06-bimanual-parallelism.png`.

---

## 6 — Speechmatics integration

> **`AddTranscript` is a segment, not a sentence.** "Set the dinner table." arrives as:
>
> ```
> "Set"  "the"  "dinner"  "table."   → EndOfUtterance → ONE command
> ```
>
> Segments are buffered and released on the server's `EndOfUtterance` boundary, with a silence timeout as fallback. Duplicate boundaries are safe by construction.
>
> | Spoken | Segments | Commands |
> |---|---|---|
> | "Set the dinner table." | 4 | **1** |
> | "Pick up the mug and place it…" | 7 | **1** |
> | "Stop." | 2 | **1** |
> | "Continue." | 1 | **1** |
>
> **Key never reaches the browser.** 120 s JWT, 60/hour quota guard, mic requested *before* a token is minted.

**Visual:** `11-live-voice-test.png` — `COMMANDS 1 (correct)` for all six.

---

## 7 — Hand-offs and parallelism

> Each place setting is **verified at generation time** to sit inside exactly one arm's envelope.
>
> Cross-table moves are **physically impossible single-armed.**
>
> ### 28 hand-offs required across 40 runs — none scripted
>
> The reachable area is an **annulus, not a disc**: 0.22 m planar reach out of 0.32 m extension, with a 0.14 m hole set by the elbow stop.

**Visual:** `05-hand-off.png`.

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
> **Success = planned with no errors AND every step executed AND the world ended in the requested state.**
>
> The one failure is **retained deliberately.**

**Visual:** `08-robustness-results.png` with the FAIL row visible.

---

## 9 — Technical honesty

> **What we are not claiming:**
>
> - **No OpenVINO / Intel Core Ultra results.** Built on a 2012 Core i5, no NPU. **20 rubric points unclaimed.**
> - **Not MuJoCo.** A purpose-built deterministic simulator — which is why it runs in a browser with zero install.
> - **No learned policy.** Reasoning is symbolic.
> - **Perception reads scene state, not pixels.**
>
> **What is real:** kinematics, joint limits, the reach annulus, hand-off logic, friction-based grasp failure, domain randomization, concurrency, and every number in this deck.

**Visual:** plain text, no imagery.

---

## 10 — Why DUET

> - **Deterministic** — same seed, same plan, byte for byte. Test-enforced.
> - **Verified** — 53 tests, live Speechmatics, committed evidence.
> - **Reproducible** — `npm install && npm run dev`. No Python, no Docker, no downloads.
> - **Honest** — limitations stated on the slide before this one.
>
> ### A judge can run the whole thing in a browser in under a minute.
>
> **duet-alpha-ebon.vercel.app**

**Visual:** `01-hero.png` + QR code to the live URL.
