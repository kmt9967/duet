# Final checklist — DUET

**Deadline: Sep 16, 2026, 11:30 PM PST** — reconfirmed from the live event page on 2026-09-15, which showed **1D 13H 56M** remaining at time of writing.

**Live:** <https://duet-alpha-ebon.vercel.app>
**Repo:** <https://github.com/kmt9967/duet>
**Team:** Teqprotech — exists, 2 members, **no submission made yet**

---

## Done

### Rules and targeting
- [x] Rules audited against the live event page — [`docs/HACKATHON-RULES.md`](../docs/HACKATHON-RULES.md)
- [x] Confirmed the SiMa.ai track is **on-site only** and unreachable for an online build
- [x] Track selected: **Bimanual VLA Manipulation with Multi-Modal Reasoning** (the only online track)
- [x] Speechmatics bonus targeted — open to every track, no separate entry needed
- [x] Deadline reconfirmed from the official source
- [x] Team confirmed to exist (mandatory to submit)

### Product
- [x] End-to-end pipeline: transcript → parse → plan → execute
- [x] Deterministic planner; no language model in the action path
- [x] Reachability decided by real IK everywhere (scene, planner, executor)
- [x] Hand-offs forced by verified geometry — 28 across 40 benchmark runs
- [x] Concurrent execution; 2× parallelism realised on every seed of the full task
- [x] Seeded randomization across placement, mass, friction, shape, lighting, background
- [x] Grasp failure modelled from Coulomb friction, seeded and reproducible

### Speechmatics
- [x] **Live-verified against the real API — 5/5 transcribed, 5/5 actionable** (`npm run test:voice`)
- [x] Evidence committed — [`evidence/speechmatics/`](../evidence/speechmatics/) including source audio
- [x] API key server-side only; 120 s JWT to the browser
- [x] Verified the key is absent from the production HTML and all 7 client bundles
- [x] 60-per-hour quota guard protecting free-tier credits
- [x] **Microphone requested before a token is minted** — a refused prompt costs nothing
- [x] Deprecated `operating_point` replaced with `model`
- [x] Degradation path verified live in the browser (mic denied → typed input still works)

### Quality
- [x] `npm run typecheck` clean
- [x] `npm run lint` clean
- [x] `npm test` — 29 passing
- [x] `npm run bench` — 98% (39/40)
- [x] Production build succeeds
- [x] No horizontal overflow at 320 / 390 / 430 / 768 / 1280 / 1920 — verified on production
- [x] Canvas overflow bug found and fixed (it held its container open and never shrank)
- [x] Touch targets raised to 44 px on small viewports
- [x] `aria-label` on seed select, `aria-pressed` on listen toggle, visible focus rings

### Shipping
- [x] Public GitHub repo created and pushed — 4 commits
- [x] Secret scan clean on every push; only `.env.example` tracked
- [x] Deployed to Vercel **Hobby (free) tier**
- [x] `SPEECHMATICS_API_KEY` set as a Production + Preview environment variable
- [x] Production verified: page loads, presets run, token route mints real JWTs, no console errors

### Documents
- [x] README judge-ready, with live links and scope stated up front
- [x] Architecture, Speechmatics, benchmark and rules docs
- [x] Submission copy with all fields drafted
- [x] Demo script (3:30–3:50) matching the live build
- [x] Slide outline (10 slides)
- [x] One-page write-up

---

## Left for you

- [ ] **1. Capture screenshots** into `evidence/final-ui/` — recipe and exact shot list in [`evidence/final-ui/README.md`](../evidence/final-ui/README.md). Could not be automated: the headless pane does not composite frames and the browser bridge cannot write image files. ~5 minutes.

- [ ] **2. Record the demo video** — follow [`DEMO-SCRIPT.md`](DEMO-SCRIPT.md), target 3:30–3:50. Upload unlisted to YouTube.

- [ ] **3. Export the slide deck** from [`SLIDES.md`](SLIDES.md) to PDF.

- [ ] **4. Test the microphone yourself** — open the live site, press **LISTEN**, allow the permission prompt, and say *"Set the dinner table."* This is the one path no automated test could cover, because a programmatic click carries no user activation and `getUserMedia` refuses it. Everything behind the microphone is already verified live.

- [ ] **5. Optional: update the team description** on lablab from the current generic text to something DUET-specific. Not required for an online submission, but it is what judges see on the team page.

- [ ] **6. Fill the remaining links** in [`LABLAB-SUBMISSION.md`](LABLAB-SUBMISSION.md) — video URL and slide URL. GitHub and application URLs are already filled in.

- [ ] **7. Submit**, selecting the **Bimanual VLA Manipulation** online track. *Each project can be submitted to one track only* — the Speechmatics bonus layers on top and needs no separate entry.

---

## Pre-submit verification

```bash
cd E:\Hackathon\duet
npm run verify          # typecheck + lint + 29 tests + benchmark
npm run build
git status --short      # should be clean
git ls-files | findstr env   # should show only .env.example
```

Then open <https://duet-alpha-ebon.vercel.app> in a private window:

- [ ] Loads with no console errors
- [ ] A preset plans and animates
- [ ] Changing the seed changes the scene
- [ ] LISTEN works with microphone permission granted
- [ ] No horizontal scroll at 390 px

---

## Do not overstate

The README, submission copy and slides all state plainly that there are **no
OpenVINO or Intel Core Ultra results**, that this is **not MuJoCo**, and that
there is **no learned policy**. Keep that language intact. It is 20 rubric points
deliberately unclaimed, and claiming them would be false.
