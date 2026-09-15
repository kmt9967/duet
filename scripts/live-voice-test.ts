/**
 * Live Speechmatics end-to-end test.
 *
 *   npm run test:voice
 *
 * Streams real speech audio to the live Speechmatics real-time API and verifies
 * the complete chain: JWT -> WebSocket -> partial transcripts -> final
 * transcript -> parser -> planner -> executable steps.
 *
 * Audio is synthesised with Windows SAPI (see scripts/make-test-audio.ps1) so
 * the test is reproducible and needs no microphone. It is deliberately NOT a
 * mock: the transcripts below come back from Speechmatics over the network.
 *
 * The API key is read from .env.local and never printed.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

import { createSpeechmaticsJWT } from "@speechmatics/auth";
import { RealtimeClient } from "@speechmatics/real-time-client";

import { parseCommand } from "../src/lib/language/parser";
import { planIntents } from "../src/lib/planner/planner";
import { generateScene } from "../src/lib/core/scene";
import { executePlan } from "../src/lib/sim/executor";
import { UtteranceAggregator } from "../src/lib/voice/utterance";

const AUDIO_DIR = resolve(process.cwd(), "evidence/speechmatics/audio");
const OUT_PATH = resolve(process.cwd(), "evidence/speechmatics/live-test.json");

/** Minimal .env.local reader — avoids adding a dependency just for this. */
function loadApiKey(): string {
  // Strip a UTF-8 BOM if present — PowerShell's Set-Content writes one, and it
  // would otherwise sit in front of the first key name.
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8").replace(
    /^﻿/,
    "",
  );
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^SPEECHMATICS_API_KEY\s*=\s*(.+)$/);
    if (match) return match[1]!.trim();
  }
  throw new Error("SPEECHMATICS_API_KEY not found in .env.local");
}

/** Strip the RIFF header and return raw little-endian 16-bit PCM. */
function pcmFromWav(path: string): Buffer {
  const buf = readFileSync(path);
  // Walk the chunk list rather than assuming a 44-byte header.
  let offset = 12;
  while (offset < buf.length - 8) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === "data") return buf.subarray(offset + 8, offset + 8 + size);
    offset += 8 + size;
  }
  throw new Error(`no data chunk in ${path}`);
}

const SAMPLE_RATE = 16000;
const BYTES_PER_SAMPLE = 2;
/** Send 100 ms of audio at a time, paced in real time. */
const CHUNK_MS = 100;
const CHUNK_BYTES = (SAMPLE_RATE * BYTES_PER_SAMPLE * CHUNK_MS) / 1000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Result = {
  file: string;
  partials: string[];
  /** Raw AddTranscript segments — these are NOT whole utterances. */
  finals: string[];
  /** How many EndOfUtterance boundaries the server sent. */
  endOfUtteranceCount: number;
  /**
   * Commands the browser would dispatch. Produced by the same
   * UtteranceAggregator the production hook uses, so this number is the real
   * "one sentence = one command" assertion.
   */
  commands: string[];
  transcript: string;
  firstPartialMs: number | null;
  firstFinalMs: number | null;
  intents: string[];
  planSteps: number;
  handoffs: number;
  executedSteps: number;
  planErrors: string[];
  diagnostics: string[];
};

/** Minting occasionally fails on a transient network error; retry briefly. */
async function mintJwt(apiKey: string): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await createSpeechmaticsJWT({ type: "rt", apiKey, ttl: 120 });
    } catch (error) {
      lastError = error;
      await sleep(1500 * (attempt + 1));
    }
  }
  throw lastError;
}

async function transcribe(apiKey: string, file: string): Promise<Result> {
  const jwt = await mintJwt(apiKey);
  const client = new RealtimeClient();

  const partials: string[] = [];
  const finals: string[] = [];
  const commands: string[] = [];
  let endOfUtteranceCount = 0;
  let firstPartialMs: number | null = null;
  let firstFinalMs: number | null = null;
  let done = false;
  let socketError: string | null = null;

  // Mirrors the browser hook exactly: segments accumulate, and only a boundary
  // releases a command.
  const aggregator = new UtteranceAggregator();

  client.addEventListener("receiveMessage", ({ data }) => {
    if (data.message === "AddPartialTranscript") {
      const text = data.metadata.transcript.trim();
      if (text) {
        firstPartialMs ??= Date.now() - startedAt;
        partials.push(text);
      }
    } else if (data.message === "AddTranscript") {
      const text = data.metadata.transcript.trim();
      if (text) {
        firstFinalMs ??= Date.now() - startedAt;
        finals.push(text);
        aggregator.addFinalSegment(text, Date.now());
      }
    } else if (data.message === "EndOfUtterance") {
      endOfUtteranceCount += 1;
      const utterance = aggregator.complete();
      if (utterance) commands.push(utterance);
    } else if (data.message === "EndOfTranscript") {
      done = true;
    } else if (data.message === "Error") {
      // Record rather than throw: an exception raised inside an event listener
      // escapes to the process and kills the run.
      socketError = `${data.type}${data.reason ? `: ${data.reason}` : ""}`;
      done = true;
    }
  });

  const startedAt = Date.now();

  await client.start(jwt, {
    transcription_config: {
      language: "en",
      model: "enhanced",
      enable_partials: true,
      max_delay: 1.2,
      conversation_config: { end_of_utterance_silence_trigger: 0.8 },
    },
    audio_format: {
      type: "raw",
      encoding: "pcm_s16le",
      sample_rate: SAMPLE_RATE,
    },
  });

  const speech = pcmFromWav(join(AUDIO_DIR, file));

  // Synthesised audio stops dead on the last word. A real microphone keeps
  // streaming while the speaker pauses, and that silence is exactly what the
  // server's end-of-utterance detector listens for. Without padding, the stream
  // ends before the 0.8s trigger can elapse and no EndOfUtterance is ever sent.
  const silence = Buffer.alloc(SAMPLE_RATE * BYTES_PER_SAMPLE * 2); // 2 seconds
  const pcm = Buffer.concat([speech, silence]);

  for (let i = 0; i < pcm.length && !socketError; i += CHUNK_BYTES) {
    client.sendAudio(pcm.subarray(i, Math.min(i + CHUNK_BYTES, pcm.length)));
    await sleep(CHUNK_MS);
  }

  await client.stopRecognition().catch(() => {});
  // Give the server a moment to flush any trailing final.
  for (let i = 0; i < 40 && !done && finals.length === 0; i++) await sleep(100);

  // The free tier permits very few concurrent sessions, so the socket must be
  // fully closed before the next utterance opens one.
  for (let i = 0; i < 50 && client.socketState !== "closed"; i++) await sleep(100);

  if (socketError) throw new Error(`Speechmatics error: ${socketError}`);

  // Anything still buffered when the stream ends is a complete utterance too —
  // the speaker stopped because the audio ran out.
  const trailing = aggregator.complete();
  if (trailing) commands.push(trailing);

  // The command the operator actually issued. Exactly one is expected.
  const transcript = commands.join(" ").trim();

  // --- prove that the FINAL transcript drives the robot, end to end --------
  const parsed = parseCommand(transcript);
  const scene = generateScene(1);
  const plan = planIntents(
    parsed.intents.filter(
      (i) => i.kind !== "stop" && i.kind !== "reset" && i.kind !== "query_state",
    ),
    scene,
  );
  const execution = plan.steps.length ? executePlan(plan, scene) : null;

  return {
    file,
    partials,
    finals,
    endOfUtteranceCount,
    commands,
    transcript,
    firstPartialMs,
    firstFinalMs,
    intents: parsed.intents.map((i) => i.kind),
    planSteps: plan.steps.length,
    handoffs: plan.steps.filter((s) => s.type === "handoff_take").length,
    executedSteps:
      execution?.outcomes.filter((o) => o.status === "completed").length ?? 0,
    planErrors: plan.errors.map((e) => e.message),
    diagnostics: parsed.diagnostics.map((d) => d.message),
  };
}

async function main() {
  const apiKey = loadApiKey();
  const files = readdirSync(AUDIO_DIR)
    .filter((f) => f.endsWith(".wav"))
    .sort();

  console.log("\nDUET — live Speechmatics end-to-end test");
  console.log("=".repeat(76));
  console.log(`Endpoint   wss://eu2.rt.speechmatics.com/v2 (SDK default)`);
  console.log(`Audio      ${files.length} synthesised utterances, 16 kHz mono PCM`);
  console.log("=".repeat(76));

  const results: Result[] = [];

  for (const [index, file] of files.entries()) {
    process.stdout.write(`\n${file}\n`);
    // Space sessions out; the free tier's concurrent-session limit is low and
    // the server takes a moment to release a closed session.
    if (index > 0) await sleep(3000);
    try {
      const result = await transcribe(apiKey, file);
      results.push(result);
      console.log(`  partials seen   ${result.partials.length}` +
        (result.firstPartialMs !== null ? ` (first at ${result.firstPartialMs} ms)` : ""));
      console.log(`  final segments  ${result.finals.length} -> ${result.finals.map((f) => `"${f}"`).join(" ")}`);
      console.log(`  EndOfUtterance  ${result.endOfUtteranceCount}`);
      console.log(
        `  COMMANDS        ${result.commands.length} ${result.commands.length === 1 ? "(correct)" : "(EXPECTED 1)"}` +
          ` -> ${result.commands.map((c) => `"${c}"`).join(" | ")}`,
      );
      console.log(`  intents         ${result.intents.join(", ") || "(none)"}`);
      console.log(`  plan            ${result.planSteps} steps, ${result.handoffs} hand-offs, ${result.executedSteps} executed`);
      if (result.planErrors.length) console.log(`  plan errors     ${result.planErrors[0]}`);
      if (result.diagnostics.length) console.log(`  diagnostics     ${result.diagnostics[0]}`);
    } catch (error) {
      console.log(`  FAILED: ${error instanceof Error ? error.message : error}`);
      results.push({
        file, partials: [], finals: [], endOfUtteranceCount: 0, commands: [],
        transcript: "", firstPartialMs: null, firstFinalMs: null, intents: [],
        planSteps: 0, handoffs: 0, executedSteps: 0,
        planErrors: [String(error)], diagnostics: [],
      });
    }
  }

  const transcribed = results.filter((r) => r.transcript.length > 0).length;
  const actionable = results.filter((r) => r.planSteps > 0 || r.intents.includes("stop")).length;
  const oneCommandEach = results.filter((r) => r.commands.length === 1).length;

  console.log("\n" + "=".repeat(76));
  console.log(`Transcribed          ${transcribed}/${results.length}`);
  console.log(`Actionable           ${actionable}/${results.length}`);
  console.log(
    `One command / sentence ${oneCommandEach}/${results.length}` +
      (oneCommandEach === results.length ? "  <- no fragment spam" : "  <- FRAGMENTS LEAKING"),
  );
  console.log("=".repeat(76) + "\n");

  mkdirSync(resolve(process.cwd(), "evidence/speechmatics"), { recursive: true });
  writeFileSync(
    OUT_PATH,
    JSON.stringify(
      {
        note: "Live test against the Speechmatics real-time API. Transcripts are returned over the network, not mocked. API key is not recorded here.",
        endpoint: "wss://eu2.rt.speechmatics.com/v2",
        config: { language: "en", operating_point: "enhanced", enable_partials: true, max_delay: 1.2 },
        audioFormat: { encoding: "pcm_s16le", sample_rate: SAMPLE_RATE },
        transcribed,
        total: results.length,
        results,
      },
      null,
      2,
    ),
  );
  console.log(`Wrote ${OUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
