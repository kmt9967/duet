# Hackathon Rules Audit — AI Infra Summit Hackathon 2026

**Audited:** 2026-09-15
**Sources:** https://lablab.ai/ai-hackathons/ai-infra-summit-hackathon (logged-in session, rendered DOM)
**Status of this document:** verified against the live event page. Items marked *UNVERIFIED* were not found on official sources.

---

## 1. Event identity

| Field | Value |
|---|---|
| Event | AI Infra Summit Hackathon |
| Organizers | Kisaco Research + lablab.ai |
| Format | Hybrid |
| Online build | September 10–16, 2026 |
| On-site phase | September 15–17, 2026 |
| On-site venue | Santa Clara Convention Center, 5001 Great America Pkwy, Santa Clara, CA |
| Platform | lablab.ai + lablab.ai Discord |

## 2. Deadline (VERIFIED — quoted from page)

> **Submission deadline — Sep 16, 11:30 PM PST**

As displayed by the live countdown element on the event page. Note the page labels it
"PST"; September falls in Pacific *Daylight* Time, so the literal wall-clock string is
what the platform will enforce. **Treat Sep 16, 23:30 America/Los_Angeles as the hard cut-off.**

## 3. Teams

- Teams are **1–5 people**. Solo entry is allowed via a one-person team.
- A team on lablab.ai is **mandatory** in order to submit.
- Team name and description can be changed at any time.

## 4. Track structure (VERIFIED — this is the critical section)

The event separates **on-site** tracks from **online** tracks, with one cross-cutting bonus.

### On-site tracks — "REQUIRES ASSIGNMENT"

| Track | Notes as published |
|---|---|
| Physical AI Challenge | Robotic defect detection, VLA reasoning, optimized on-device execution. SO-101 arm provided. |
| **Build Physical AI That Sees, Understands, and Acts** (SiMa.ai) | "An open brief on SiMa.ai's Modalix MLSoC DevKit and Palette Neat". Tags: **Onsite**, **Modalix DevKit per team**, **SiMa.ai mentors on site**. |
| Model-to-Device Innovation (Qualcomm) | Snapdragon X Elite + Arduino UNO Q. "This track is onsite only." |

### Online tracks — "OPEN BUILD — NO ASSIGNMENT NEEDED"

| Track | Notes as published |
|---|---|
| Bimanual VLA Manipulation with Multi-Modal Reasoning | Challenge option: setting up a dinner table. Simulation-first. Intermediate–Advanced. |

### Bonus award — "OPEN TO EVERY TRACK"

| Award | Notes as published |
|---|---|
| **Best Use of Speechmatics** | "Build something people talk to — add it to whichever track you're building in." Tags: **Bonus Award**, **Onsite + Online**, **No assignment needed**. |

## 5. Prizes (VERIFIED)

Total pool: **$31,650** — $21,250 cash, $10,400 hardware/devices, plus 1,750 Speechmatics API credits.

- **Onsite — Physical AI Challenge:** $5,000 / $3,000 / $2,000
- **Online — Bimanual VLA Manipulation:** $3,000 / $2,000 / $1,000
- **Onsite — Build Physical AI That Sees, Understands, and Acts (SiMa.ai), $5,000 in hardware:**
  - 1st Gold Bundle — Modalix MLSoC DevKit + Webcam + Maker Robot Arm Kit ($2,000)
  - 2nd Silver Bundle — Modalix MLSoC DevKit + Webcam ($1,600)
  - 3rd Bronze Bundle — Modalix MLSoC DevKit ($1,500)
- **Onsite — Qualcomm Challenge Track:** awarded per participant; $6,500 / $1,900 / $1,500 for a full team of five.
- **Bonus — Best Use of Speechmatics ($750 cash + 1,750 credits):**
  - 1st — $500 + 1,000 Speechmatics API credits per team
  - 2nd — $250 + 500 Speechmatics API credits per team
  - 3rd — Speechmatics API credits

## 6. Submission requirements (VERIFIED — exact form fields)

**Basic information**
- Project title
- Short description
- Long description
- Technology & category tags

**Cover image and presentation**
- Cover image
- Video presentation
- Slide presentation

**App hosting and repository**
- Public GitHub repository
- Demo application platform
- Application URL

## 7. Judging criteria (VERIFIED — quoted)

1. **Application of Technology** — "How effectively the chosen model(s) are integrated into the solution."
2. **Presentation** — "The clarity and effectiveness of the project presentation."
3. **Business Value** — "The impact and practical value, considering how well it fits into business areas."
4. **Originality** — "The uniqueness and creativity of the solution, highlighting approaches and ability to demonstrate behaviors."

> "Partner tracks are scored against their own published rubric in addition to these criteria."

## 8. Rules with direct impact on project strategy

### 8.1 One track per project (VERIFIED — quoted)

> "Submit your project on lablab.ai before the deadline and select the online track you built for.
> **Each project can be submitted to one track only.**"

The Speechmatics award is explicitly structured as a **bonus that layers on top of** whichever
track you choose ("add it to whichever track you're building in"), so pursuing Speechmatics
*alongside* a track is consistent with this rule. Pursuing **two tracks** is not.

### 8.2 The SiMa.ai track is on-site only (VERIFIED)

The SiMa.ai brief is listed under **Onsite Tracks**, is marked **REQUIRES ASSIGNMENT**, allocates a
**Modalix DevKit per team**, and its prizes are published under
"**ONSITE AWARDS** — BUILD PHYSICAL AI THAT SEES, UNDERSTANDS, AND ACTS".

Gating conditions, all of which must hold:
- On-site participation is **by invitation only**.
- Physical presence at Santa Clara Convention Center, Sept 15–17.
- Track assignment by organizers via the Confirm & Apply for Track Form.
- "Travel and accommodation expenses will not be covered."

**There is no published online variant of the SiMa.ai track, and no online award line item for it.**

### 8.3 Speechmatics is reachable online (VERIFIED)

"Best Use of Speechmatics" is tagged **Onsite + Online**, **No assignment needed**, and **open to every track**.

## 9. Unverified / not found

The following were requested in the project brief but are **not published** on the event page.
Do not assert them without a source.

- *UNVERIFIED:* mandatory demo-video length
- *UNVERIFIED:* mandatory slide count
- *UNVERIFIED:* social-media post requirement
- *UNVERIFIED:* blog/article requirement
- *UNVERIFIED:* required submission tags
- *UNVERIFIED:* per-track published rubrics (page refers to them; text not located)
- *UNVERIFIED:* whether SDK-only SiMa work is accepted for judging (moot — track is on-site)
- *UNVERIFIED:* sponsor credit codes / SiMa developer credits for online participants

The page also notes, for on-site logistics: "the Track Selection Form link, and the submission
deadline are still being finalized and will be communicated before the hackathon."

## 10. Account status (observed)

- lablab.ai account: **Enrolled**, status **Approved** for this event.
- "Team Dashboard" and "Submit Project" actions are available on the event page.

## 11. Local environment audit (2026-09-15)

| Component | State |
|---|---|
| OS | Windows 11 Pro 10.0.22000 |
| Node.js | v24.15.0 |
| npm | 11.12.1 |
| Git | present |
| **Python** | **not installed** (only the Microsoft Store stub, which hangs on exec) |
| **Docker** | **not installed** |
| **WSL** | wsl.exe present but **no distro / feature not enabled** (prints usage text) |
| winget | available |
| GitHub CLI | not installed |
| Drive `F:` | **does not exist** — project root relocated to `E:\Hackathon\edgeops-guardian` |
| Free space | C: 29.7 GB, E: 78.7 GB |

**Consequence:** the SiMa.ai Palette / Neat SDK toolchain is container-based and expects a
Linux/WSL2 + Docker host. None of that is present, and enabling WSL2 requires administrator
rights and a reboot — a human action, not an agent action.
