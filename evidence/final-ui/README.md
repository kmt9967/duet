# Screenshot capture list — FINAL

**Source of truth: production.** <https://duet-alpha-ebon.vercel.app>

**Status: not captured.** Automated capture is not possible from the build
environment (the headless pane does not composite frames; the browser bridge
cannot write image files). Nothing here is mocked or placeholder — capture the
real thing using the recipe below. Budget ~10 minutes.

---

## Setup

- Open **production**, not localhost, so what a judge sees is what you capture.
- Window **1440 × 900**, zoom **100%**, seed **1**.
- Clean browser window: no bookmarks bar, no extension icons, no devtools.
- **Never** capture a window showing `.env.local`, the Speechmatics portal, a
  Vercel environment-variable page, or a terminal that has echoed a key.
- Dark mode is the only theme; nothing to switch.

---

## Shot list — capture in this order

| # | File | Exact state to capture |
|---|---|---|
| 1 | `01-hero.png` | Fresh load, seed 1, **before any command**. Whole page. Header, workspace with both arms at rest, voice panel, command panel. |
| 2 | `02-live-simulator.png` | Click **Whole-task macro**. Let it run to roughly **6–8 s** on the scrubber, then **PAUSE**. Both arms extended, drawer open, cutlery visible. Stat row must read **27 / 3 / 2× / 17.9s**. |
| 3 | `00-cover.png` | **Same moment as #2**, cropped to the header + workspace panel only. This is the strongest single frame — **use it as the lablab cover image.** |
| 4 | `03-voice-command.png` | Press **LISTEN**, allow the mic, and begin saying *"Set the dinner table."* Capture **mid-sentence**, while grey italic partial text is still visible in the voice panel. |
| 5 | `04-one-command.png` | Immediately after that sentence finishes. The command log must show **exactly one row** — transcript "Set the dinner table.", source `voice`, understood `set the dinner table`, steps `27 +3 h/o`, result **EXECUTED**. This is the fixed-bug evidence; do not skip it. |
| 6 | `05-hand-off.png` | Scrub to the give/take moment: both arms converging on the dashed **HAND-OFF** circle. Plan panel showing `presents the object at the hand-off zone` / `takes the object from arm B`. |
| 7 | `06-bimanual-parallelism.png` | Plan panel scrolled to a phase row containing **two** steps, one per arm, both highlighted. Keep the **PARALLELISM 2×** stat in frame. |
| 8 | `07-task-plan.png` | Full dependency-phase list, P00 downward, showing the A/B colour coding and the depth labels. |
| 9 | `08-robustness-results.png` | Terminal after `npm run bench`. Must include the per-seed PASS/FAIL rows, **the one FAIL row**, and the `Overall success rate: 98%` line. |
| 10 | `09-architecture.png` | The pipeline diagram from `docs/ARCHITECTURE.md`, rendered on GitHub. |
| 11 | `10-mobile.png` | Production at **390 px** width. Verified free of horizontal overflow. |

---

## Values that must appear (sanity check before you submit)

If a capture disagrees with these, recapture — do not edit the image.

| Where | Value |
|---|---|
| "Set the dinner table." / Whole-task macro, seed 1 | **27 steps · 3 hand-offs · 2× parallelism · 17.9 s** |
| Command log after one spoken sentence | **exactly 1 row**, result **EXECUTED** |
| The brief's worked example, seed 1 | 13 steps · 1 hand-off · 2× |
| `npm run bench` | **Overall success rate: 98%** (39/40) |
| `npm test` | **53 passing, 0 failing** |

---

## Optional but strong

`11-live-voice-test.png` — terminal output of `npm run test:voice`, showing the
`final segments` and `COMMANDS 1 (correct)` columns for all six utterances. It
is the clearest single proof that one spoken sentence produces one command.
