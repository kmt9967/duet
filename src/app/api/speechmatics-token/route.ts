/**
 * Mints a short-lived Speechmatics JWT for the browser.
 *
 * The API key never leaves the server. The browser receives only a temporary
 * token scoped to real-time transcription, which is the pattern Speechmatics
 * documents for client-side use — shipping the raw key to the client would
 * expose it in devtools to anyone who opens the page.
 *
 * A conservative in-process rate limit is applied because the hackathon account
 * runs on free credits: a runaway reconnect loop in a browser tab should not be
 * able to drain them.
 */

import { createSpeechmaticsJWT } from "@speechmatics/auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
/** Tokens are per-request and short-lived, so never cache this route. */
export const dynamic = "force-dynamic";

/** Token lifetime in seconds. Long enough for a demo, short enough to be safe. */
const TTL_SECONDS = 120;

/**
 * Ceiling on tokens minted per process lifetime. Each token permits one
 * real-time session, so this bounds worst-case credit burn from a client bug.
 */
const MAX_TOKENS_PER_WINDOW = 60;
const WINDOW_MS = 60 * 60 * 1000;

let windowStartedAt = Date.now();
let tokensIssued = 0;

function underQuota(): boolean {
  const now = Date.now();
  if (now - windowStartedAt > WINDOW_MS) {
    windowStartedAt = now;
    tokensIssued = 0;
  }
  return tokensIssued < MAX_TOKENS_PER_WINDOW;
}

export async function POST() {
  const apiKey = process.env.SPEECHMATICS_API_KEY;

  if (!apiKey) {
    // Not an error condition: the app is designed to run without credentials,
    // falling back to typed commands. Tell the client so it can say so plainly.
    return NextResponse.json(
      {
        configured: false,
        reason:
          "SPEECHMATICS_API_KEY is not set. Voice input is unavailable; typed commands still work.",
      },
      { status: 503 },
    );
  }

  if (!underQuota()) {
    return NextResponse.json(
      {
        configured: true,
        reason:
          "Local token quota reached for this hour. This guard protects the free-tier credit balance.",
      },
      { status: 429 },
    );
  }

  try {
    const jwt = await createSpeechmaticsJWT({
      type: "rt",
      apiKey,
      ttl: TTL_SECONDS,
    });
    tokensIssued += 1;

    return NextResponse.json({
      configured: true,
      jwt,
      ttl: TTL_SECONDS,
      issued: tokensIssued,
      remaining: MAX_TOKENS_PER_WINDOW - tokensIssued,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error minting token";
    // Never echo the key or the raw upstream payload back to the client.
    return NextResponse.json(
      { configured: true, reason: `Speechmatics rejected the request: ${message}` },
      { status: 502 },
    );
  }
}
