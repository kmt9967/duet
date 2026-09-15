# Speechmatics integration

## What is used

| Item | Value |
|---|---|
| Product | Speechmatics **Real-Time** transcription |
| Transport | WebSocket, streaming PCM |
| SDK | `@speechmatics/real-time-client` 8.5.1 |
| Auth | `@speechmatics/auth` 0.1.0 — short-lived JWT |
| Audio capture | `@speechmatics/browser-audio-input-react` 2.0.4 (AudioWorklet) |
| Operating point | `enhanced` |
| Partials | enabled |
| `max_delay` | 1.2 s |
| Encoding | `pcm_f32le` at the device's native sample rate |

## Role in the product

Speechmatics is the operator interface for a physical task, not a transcription demo bolted on. The transcript gates a robot action, which shapes three decisions:

**Partials caption, finals execute.** `AddPartialTranscript` drives the live caption so the operator sees they are being heard. Only `AddTranscript` — a settled utterance — is parsed and executed. A half-recognised phrase never reaches the planner and therefore never moves an arm.

**Low delay is a functional requirement, not a nicety.** `max_delay` is set to 1.2 s because the operator is waiting on a physical outcome; latency is felt directly rather than read later.

**The parser is built for ASR output, not prose.** Real transcripts arrive without punctuation, with fillers, and with homophones. The parser recovers clause boundaries from command-verb onsets, strips fillers, and maps `"arm be"` / `"arm eight"` to arm B / arm A. See [ARCHITECTURE.md](ARCHITECTURE.md#languageparserts--asr-tolerant-understanding).

## Credential handling

**The API key never reaches the browser.**

```
browser ──POST /api/speechmatics-token──► Next.js route (server)
                                              │  SPEECHMATICS_API_KEY  (server env only)
                                              ▼
                                        createSpeechmaticsJWT({ type: 'rt', ttl: 120 })
browser ◄──────── { jwt } ────────────────────┘
   │
   └── new RealtimeClient().start(jwt, config)  ──► wss://…speechmatics…
```

- `SPEECHMATICS_API_KEY` is read only in `src/app/api/speechmatics-token/route.ts`, which runs on the Node runtime.
- The browser receives a **120-second** JWT scoped to real-time transcription.
- The route is `force-dynamic`, so a token is never cached or shared.
- Errors from Speechmatics are summarised, never echoed raw, so no upstream payload can leak the key.
- `.env.local` is gitignored. `.env.example` documents the variable with no value.

## Free-tier protection

The hackathon account runs on free credits, and a reconnect loop in a browser tab could drain them. The token route enforces an in-process quota:

```ts
MAX_TOKENS_PER_WINDOW = 60   // per rolling hour, per server process
```

Exceeding it returns HTTP 429 with an explanation rather than minting more sessions. The response includes `remaining` so the client can surface it.

This is a deliberate belt-and-braces measure: each token permits one real-time session, so the quota bounds worst-case credit burn.

## Graceful degradation

Every failure path leaves the application fully usable, and says why in plain language:

| Condition | HTTP / event | What the operator sees |
|---|---|---|
| `SPEECHMATICS_API_KEY` unset | 503 | "Voice input is unavailable; typed commands still work." |
| Hourly quota reached | 429 | "Local token quota reached for this hour. This guard protects the free-tier credit balance." |
| Speechmatics rejects the token | 502 | "Speechmatics rejected the request: …" |
| Microphone permission denied | `NotAllowedError` | "Microphone permission denied. Typed commands still work." |
| Socket drops mid-session | `socketStateChange` | Status returns to idle, no crash |

**The typed fallback is not a separate system.** A typed command takes the identical path through parser → planner → executor. A demo without a microphone is still a demo of the real pipeline.

## Measured latency

The hook records the interval from the first audio frame sent to the first transcript received and displays it in the voice panel:

```
First transcript returned in <n> ms (measured, this session)
```

This is measured live per session rather than quoted, because it depends on network path and audio device. No latency figure is asserted in this repository's documentation for that reason.

## Setup

1. Create a key at <https://portal.speechmatics.com/manage-access/>.
2. ```bash
   cp .env.example .env.local
   ```
3. Set `SPEECHMATICS_API_KEY=...` in `.env.local`.
4. Restart the dev server. Press **LISTEN** and allow microphone access.

Without step 3 the app runs normally with typed commands.

## Commands that work well spoken

```
open the top drawer
pick up the plate with arm A
place it on the right setting
pick up the mug and place it on the right setting
set the dinner table
pour water into the mug
hand the plate to arm B
stop
reset
```

Multi-clause utterances are supported and are the more interesting demo:

> *"Open the top drawer, pick up the plate with arm A, place it on the table, pick up the mug with arm B, pour water into the mug with arm A."*

## Files

| Path | Role |
|---|---|
| `src/app/api/speechmatics-token/route.ts` | Server-side JWT minting, quota guard |
| `src/lib/voice/useSpeechmatics.ts` | Socket lifecycle, PCM streaming, transcript handling |
| `src/components/Providers.tsx` | `AudioContext` + PCM recorder provider |
| `public/pcm-audio-worklet.min.js` | AudioWorklet, vendored from the Speechmatics package |
| `.env.example` | Documents the variable |
