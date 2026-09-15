# Final UI screenshots

**Status: not yet captured.** This directory is intentionally empty of images.

Screenshot capture could not be automated from the build environment: the
headless pane does not composite frames, and the browser bridge does not write
image files to a reachable path. Rather than ship placeholder or mocked images,
the exact recipe is recorded here — it takes about five minutes.

## Setup

```bash
npm run dev          # or use https://duet-alpha-ebon.vercel.app
```

Browser at **1440 × 900**, seed **1**, zoom 100%. Use a clean window with no
extension toolbars visible. On Windows, `Win + Shift + S` or the Snipping Tool
is sufficient; full-page shots can come from Chrome DevTools
(`Ctrl+Shift+P` → "Capture full size screenshot").

**Never capture a window showing `.env.local`, the Speechmatics portal, or a
terminal that has echoed a key.**

## Shot list

| File | State to capture |
|---|---|
| `00-cover.png` | **Cover.** Run *The brief's worked example* and pause around 40% through, when both arms are extended and holding objects. Crop to the workspace panel plus the header. This is the strongest single frame — use it as the lablab cover image. |
| `01-hero.png` | Full page at rest, seed 1, before any command. Shows the whole console. |
| `02-live-simulator.png` | Mid-execution of *Whole-task macro*, drawer open, both arms articulated, stat row visible (steps / hand-offs / parallelism / duration). |
| `03-voice-command.png` | Voice panel with a **partial** transcript mid-update — grey italic text still changing. Press LISTEN and capture while speaking. |
| `04-bimanual-parallelism.png` | Plan panel scrolled to a phase row containing **two** steps, both highlighted, one per arm. Ideally with the 2× parallelism stat in frame. |
| `05-hand-off.png` | The give/take moment: scrub to where both arms converge on the hand-off zone, with the `handoff_give` / `handoff_take` rows visible in the plan. |
| `06-task-plan.png` | The full dependency-phase list, showing P00…Pnn and the arm colour coding. |
| `07-robustness-results.png` | Terminal after `npm run bench`, with the per-seed PASS/FAIL rows and the 98% summary line visible. Include the one FAIL row. |
| `08-architecture.png` | The pipeline diagram from `docs/ARCHITECTURE.md`, rendered on GitHub or in a markdown preview. |
| `09-mobile.png` | Same page at **390 px** width. Verified free of horizontal overflow. |

## Reference values

These are the numbers that should appear in the captures, so they can be
sanity-checked against the committed evidence:

- *The brief's worked example*, seed 1 → **13 steps, 1 hand-off, 2× parallelism**
- *Whole-task macro*, seed 1 → **27 steps, 3 hand-offs, 2× parallelism, 17.9 s**
- `npm run bench` → **Overall success rate: 98%**
