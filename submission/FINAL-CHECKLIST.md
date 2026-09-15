# Final checklist — DUET

**Deadline: Sep 16, 2026, 11:30 PM PST.** Verify the countdown on the event page before submitting.

---

## Done

- [x] Rules audited against the live event page — [`docs/HACKATHON-RULES.md`](../docs/HACKATHON-RULES.md)
- [x] Track selected: **Bimanual VLA Manipulation with Multi-Modal Reasoning** (the only online track)
- [x] Speechmatics bonus targeted (open to every track, no assignment needed)
- [x] Working end-to-end pipeline: transcript → parse → plan → execute
- [x] Real Speechmatics real-time integration, API key server-side only
- [x] Free-tier credit guard on the token route (60/hour)
- [x] Graceful degradation to typed input on every voice failure path
- [x] Seeded domain randomization across all the brief's robustness axes
- [x] Hand-offs forced by verified geometry, not scripted
- [x] Benchmark: 39/40 (98%) across 10 seeds — [`evidence/benchmarks/`](../evidence/benchmarks/)
- [x] 29 tests passing — [`evidence/tests/`](../evidence/tests/)
- [x] `npm run typecheck` clean
- [x] `npm run lint` clean
- [x] Production build succeeds
- [x] Secret scan clean; only `.env.example` tracked
- [x] README judge-ready, with limitations stated up front
- [x] Architecture, Speechmatics and benchmark docs written
- [x] Submission copy, demo script and slide outline drafted
- [x] Local git repository committed

## Blocked — needs you

These require interactive login, which cannot be done from the agent session. `winget` on this machine is the inaccessible Microsoft Store stub, so the GitHub CLI could not be installed either.

- [ ] **1. Create the GitHub repo and push**

  Create an empty **public** repo named `duet` at <https://github.com/new> (no README, no .gitignore), then:

  ```bash
  cd E:\Hackathon\duet
  git remote add origin https://github.com/<your-username>/duet.git
  git branch -M main
  git push -u origin main
  ```

  A browser credential prompt will appear on first push — that is expected.

- [ ] **2. Deploy to Vercel**

  Easiest path, no CLI needed: go to <https://vercel.com/new>, import the `duet` repo, accept the detected Next.js defaults, and deploy.

  Then add the environment variable so voice works in production:

  | Name | Value | Environments |
  |---|---|---|
  | `SPEECHMATICS_API_KEY` | your key | Production, Preview |

  Redeploy after adding it. Without the key the site still works with typed commands.

- [ ] **3. Capture screenshots** into `evidence/screenshots/`

  Run `npm run dev` at 1440×900 and capture:

  | File | State |
  |---|---|
  | `01-command-center.png` | Mid-execution of "The brief's worked example" — both arms articulated, parallel phase P00 visible. **Use this as the lablab cover image.** |
  | `02-handoff.png` | "Cross-workspace transfer" at the moment of give/take, both arms at the centre |
  | `03-plan-graph.png` | Plan panel scrolled to show the hand-off give/take pair |
  | `04-voice.png` | Voice panel with a live partial transcript mid-update |
  | `05-benchmark.png` | Terminal after `npm run bench` |
  | `06-mobile.png` | Same page at 390 px width |

- [ ] **4. Record the demo video** — follow [`DEMO-SCRIPT.md`](DEMO-SCRIPT.md), target 3:00–3:30. Upload unlisted to YouTube.

- [ ] **5. Build the slide deck** from [`SLIDES.md`](SLIDES.md) and export to PDF.

- [ ] **6. Confirm the lablab team exists** — a team is mandatory to submit. Solo entry means creating a one-person team.

- [ ] **7. Fill the `<FILL IN>` links** in [`LABLAB-SUBMISSION.md`](LABLAB-SUBMISSION.md) — GitHub URL, application URL, video URL.

- [ ] **8. Submit**, selecting the **Bimanual VLA Manipulation** online track. Remember: *each project can be submitted to one track only.* The Speechmatics bonus layers on top and needs no separate entry.

---

## Pre-submit verification

Run immediately before submitting:

```bash
cd E:\Hackathon\duet
npm run verify          # typecheck + lint + 29 tests + benchmark
npm run build           # production build
git status --short      # should be clean
git ls-files | grep env # should show only .env.example
```

Then open the deployed URL in a private window and confirm:

- [ ] Page loads with no console errors
- [ ] A preset command plans and animates
- [ ] Changing the seed changes the scene
- [ ] Without `SPEECHMATICS_API_KEY`, pressing LISTEN shows the fallback message rather than breaking
- [ ] No horizontal scroll at 390 px

---

## Do not overstate

The README, submission copy and slides all state plainly that there are **no OpenVINO or Intel Core Ultra results**, that this is **not MuJoCo**, and that there is **no learned policy**. Keep that language intact. It is 20 rubric points we are deliberately not claiming, and claiming them would be false.
