# Slide deck — DUET

Ten slides. One idea each. Dark background, monospace for technical labels, matching the console.

---

## 1 — Title

> # DUET
> ### Dual-arm Execution from Everyday Talk
>
> Say a dinner-table instruction. Two SO-101 arms work out how to do it.
>
> `AI Infra Summit Hackathon 2026 · Intel Bimanual VLA Challenge · Speechmatics`

**Visual:** full-bleed console screenshot, both arms mid-hand-off.

---

## 2 — The sentence

> *"Open the top drawer, pick up the plate with arm A, place it on the table, pick up the mug with arm B, pour water into the mug with arm A."*
>
> — Intel challenge brief
>
> **Three hidden problems:**
> 1. The cutlery is locked in a closed drawer
> 2. Neither arm can reach the whole table
> 3. The world is different every run

**Visual:** the sentence large, the three problems small underneath.

---

## 3 — What it does

> ```
> speech ──► parse ──► plan ──► execute
> ```
>
> - **Speechmatics real-time** — partials caption, finals execute
> - **Deterministic parser** — no punctuation, fillers, homophones
> - **Dependency-graph planner** — preconditions, IK arm assignment, hand-offs
> - **Concurrent executor** — both arms where the graph allows

**Visual:** the pipeline diagram, annotated.

---

## 4 — Hand-offs are forced, not scripted

> Each place setting is **verified at generation time** to sit inside exactly one arm's reach envelope.
>
> Cross-table moves are **physically impossible single-armed.**
>
> The planner detects it and inserts a give/take transfer.
>
> ### 28 hand-offs required across 40 runs
> Not one of them special-cased.

**Visual:** the two dashed reach envelopes with the overlap zone highlighted; arrow showing the transfer.

---

## 5 — The workspace is an annulus

> A top-down grasp spends the wrist link **vertically**.
>
> | | |
> |---|---|
> | Full extension | 0.32 m |
> | **Planar reach at table height** | **0.22 m** |
> | **Minimum, set by the elbow stop** | **0.14 m** |
>
> Reachability is decided by **solving IK** — never a radius test.
>
> *Getting this wrong cost us a 3% success rate on the first run.*

**Visual:** annulus diagram, hole at the centre clearly marked.

---

## 6 — Voice as an operator interface

> The transcript **gates a physical action.** That changes the design:
>
> - Only **settled** transcripts execute — a half-heard phrase never moves an arm
> - `max_delay: 1.2s` — the operator is waiting on an outcome
> - Parser built for **ASR output, not prose**
> - API key never reaches the browser — 120 s JWT, 60/hour quota guard
> - Every failure degrades to typed input, on the identical code path

**Visual:** voice panel screenshot with a live partial mid-update.

---

## 7 — It can fail, and it says so

> Grip stability from Coulomb friction against load:
>
> ```
> stability = (friction × 18 N) / (mass × 9.81 × 1.2)
> ```
>
> Below 1.0, the grasp is marginal and may slip — seeded, so reproducible.
>
> Failed steps mark their dependents **skipped**, never silently executed.
>
> > *"The bottle slipped: grip stability 0.63 is below the reliable threshold of 1.00 at 482 g."*

**Visual:** a failed step rendered in red in the plan panel.

---

## 8 — Measured, not asserted

> ### 39 / 40 — 98% across 10 randomized seeds
>
> | Task | Success |
> |---|---|
> | Full place setting | 10/10 |
> | Cross-workspace transfer | 10/10 |
> | The brief's worked example | 9/10 |
> | `set the dinner table` | 10/10 |
>
> **"Success" = planned with no errors AND every step executed AND the world ended in the requested state.**
>
> The one failure is retained deliberately.

**Visual:** terminal benchmark output.

---

## 9 — What we are not claiming

> - **No OpenVINO / Intel Core Ultra results.** Built on a 2012 Core i5, no NPU. That is **20 rubric points we are not claiming.**
> - **Not MuJoCo.** A purpose-built deterministic simulator — which is why it runs in a browser with zero install.
> - **No learned policy.** Reasoning is symbolic, not a fine-tuned VLA.
> - **Perception reads scene state, not pixels.**
>
> Everything else — kinematics, joint limits, hand-offs, grasp failure, randomization, concurrency — is real.

**Visual:** plain text. No imagery. This slide should feel deliberate.

---

## 10 — Why DUET

> - **Deterministic** — same seed, same plan, byte for byte. Enforced by tests.
> - **No LLM in the action path** — a model may explain a plan, never choose one.
> - **Reproducible** — `npm install && npm run dev`. No Python, no Docker, no downloads.
> - **Honest** — 29 tests, committed evidence, limitations stated up front.
>
> ### A judge can run the whole thing in a browser in under a minute.
>
> `github.com/<user>/duet`

**Visual:** console screenshot, clean state, QR code to the live URL.
