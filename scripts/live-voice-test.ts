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
  finals: string[];
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

async function transcribe(apiKey: string, file: string): Promise<Result> {
  const jwt = await createSpeechmaticsJWT({ type: "rt", apiKey, ttl: 120 });
  const client = new RealtimeClient();

  const partials: string[] = [];
  const finals: string[] = [];
  let firstPartialMs: number | null = null;
  let firstFinalMs: number | null = null;
  let done = false;
  let socketError: string | null = null;

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
      }
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
    },
    audio_format: {
      type: "raw",
      encoding: "pcm_s16le",
      sample_rate: SAMPLE_RATE,
    },
  });

  const pcm = pcmFromWav(join(AUDIO_DIR, file));
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

  const transcript = finals.join(" ").trim();

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
      console.log(`  final           "${result.transcript}"`);
      console.log(`  intents         ${result.intents.join(", ") || "(none)"}`);
      console.log(`  plan            ${result.planSteps} steps, ${result.handoffs} hand-offs, ${result.executedSteps} executed`);
      if (result.planErrors.length) console.log(`  plan errors     ${result.planErrors[0]}`);
      if (result.diagnostics.length) console.log(`  diagnostics     ${result.diagnostics[0]}`);
    } catch (error) {
      console.log(`  FAILED: ${error instanceof Error ? error.message : error}`);
      results.push({
        file, partials: [], finals: [], transcript: "",
        firstPartialMs: null, firstFinalMs: null, intents: [],
        planSteps: 0, handoffs: 0, executedSteps: 0,
        planErrors: [String(error)], diagnostics: [],
      });
    }
  }

  const transcribed = results.filter((r) => r.transcript.length > 0).length;
  const actionable = results.filter((r) => r.planSteps > 0 || r.intents.includes("stop")).length;

  console.log("\n" + "=".repeat(76));
  console.log(`Transcribed   ${transcribed}/${results.length}`);
  console.log(`Actionable    ${actionable}/${results.length}`);
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
