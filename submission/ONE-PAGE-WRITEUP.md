# DUET — one-page write-up

**Dual-arm Execution from Everyday Talk**
AI Infra Summit Hackathon 2026 · Intel *Bimanual VLA Manipulation* (online) · Speechmatics bonus

---

### The problem

Intel's brief gives one sentence as the worked example:

> *"Open the top drawer, pick up the plate with arm A, place it on the table, pick up the mug with arm B, pour water into the mug with arm A."*

Three things make it hard, none of them speech recognition. The cutlery is locked in a closed drawer, so there is a precondition to discover. Neither arm can reach the whole table, so objects must sometimes be passed between them. And the world is different on every run.

### What we built

Speak the sentence. Speechmatics transcribes it live. A deterministic parser turns it into structured intents. A planner compiles those into a **dependency graph** of arm actions — chaining preconditions, assigning arms by solving real inverse kinematics, and inserting hand-offs where needed. An executor runs the graph with genuine concurrency: steps on different arms at the same graph depth move together.

### Three decisions that define it

**No language model in the action path.** A model may explain a plan; it never chooses one. The same utterance against the same seed produces a byte-identical plan, which is what makes the benchmark mean anything. The test suite enforces it.

**Reachability is solved, not approximated.** Scene generation, planning and execution all call the same IK solver. The usable workspace turns out to be an *annulus*, not a disc — a target closer than ~0.14 m needs more elbow flexion than the servo allows, and a top-down grasp spends the wrist link vertically, leaving ~0.22 m of planar reach out of 0.32 m of extension. Sizing the workspace to full extension was our first bug and cost a 3% success rate.

**Hand-offs are forced by geometry.** Each place setting is verified at generation time to sit inside exactly one arm's envelope, so crossing the table is physically impossible single-armed. 28 hand-offs were required across 40 benchmark runs. None are special-cased.

### Results

**39/40 — 98%** across 10 randomized seeds and 4 tasks, where success requires the command to plan with no errors, **and** every step to execute, **and** the world to end in the requested state. 2× arm parallelism realised on every seed of the full-table task.

The single failure is kept deliberately: on one seed the mug lands where neither arm can reach the pouring pose within its elbow limit, and the system reports precisely that.

### Voice

Speechmatics real-time over WebSocket. Partials caption, finals execute — a half-heard phrase never moves an arm. The parser is built for ASR output rather than prose: it recovers clause boundaries from verb onsets when punctuation is absent, strips fillers, and maps homophones like *"arm be"* to arm B. The API key never reaches the browser; a server route mints a 120-second JWT with a 60-per-hour quota guard so a reconnect loop cannot drain free-tier credits. Every failure degrades to typed input on the identical code path.

### What we are not claiming

There are **no OpenVINO or Intel Core Ultra results** — this was built on a 2012 Core i5 with no NPU, so 20 of the rubric's 100 points are deliberately unclaimed. It is **not MuJoCo** but a purpose-built deterministic simulator, which is why it runs in any browser with zero install. There is **no learned policy**; the reasoning is symbolic. Perception reads scene state, not pixels.

Everything else — the kinematics, joint limits, reach annulus, hand-off logic, friction-based grasp failure, domain randomization, concurrency and success criterion — is real and reproducible.

### Running it

```bash
npm install && npm run dev     # no Python, no Docker, no model download
npm run verify                 # typecheck + lint + 29 tests + benchmark
```
