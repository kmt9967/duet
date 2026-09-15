"use client";

/**
 * Speechmatics real-time transcription hook.
 *
 * Flow: the browser asks our own server for a short-lived JWT, opens a
 * WebSocket to Speechmatics with it, and streams raw PCM captured from the
 * microphone. Partial transcripts drive the live caption; final transcripts are
 * what actually get parsed into robot commands, so a half-recognised phrase
 * never reaches the planner.
 *
 * Every failure mode degrades to typed input rather than breaking the app:
 * missing API key, denied microphone, quota guard, or a dropped socket all
 * surface as a status string the UI shows verbatim.
 */

import { RealtimeClient } from "@speechmatics/real-time-client";
import { usePCMAudioListener, usePCMAudioRecorderContext } from "@speechmatics/browser-audio-input-react";
import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "stopping"
  | "unavailable"
  | "error";

export type VoiceState = {
  status: VoiceStatus;
  /** Live, still-changing text from AddPartialTranscript. */
  partial: string;
  /** Most recent settled utterance from AddTranscript. */
  final: string;
  /** Human-readable explanation when status is unavailable or error. */
  message: string | null;
  /** Round-trip from first audio frame to first transcript, milliseconds. */
  firstTranscriptLatencyMs: number | null;
};

export type UseSpeechmaticsOptions = {
  /** Called once per settled utterance, with the full transcript text. */
  onUtterance: (text: string) => void;
  /** BCP-47 language code passed to Speechmatics. */
  language?: string;
};

export function useSpeechmatics({
  onUtterance,
  language = "en",
}: UseSpeechmaticsOptions) {
  const [state, setState] = useState<VoiceState>({
    status: "idle",
    partial: "",
    final: "",
    message: null,
    firstTranscriptLatencyMs: null,
  });

  const clientRef = useRef<RealtimeClient | null>(null);
  const { startRecording, stopRecording, isRecording, audioContext } =
    usePCMAudioRecorderContext();

  // Keep the newest callback without forcing the socket to reconnect.
  const onUtteranceRef = useRef(onUtterance);
  useEffect(() => {
    onUtteranceRef.current = onUtterance;
  }, [onUtterance]);

  const audioStartedAt = useRef<number | null>(null);
  const gotFirstTranscript = useRef(false);

  /** Stream captured PCM frames straight to the open socket. */
  usePCMAudioListener((audio: Float32Array) => {
    const client = clientRef.current;
    if (!client || client.socketState !== "open") return;
    audioStartedAt.current ??= performance.now();
    client.sendAudio(audio);
  });

  const stop = useCallback(async () => {
    setState((s) => ({ ...s, status: "stopping" }));
    try {
      stopRecording();
    } catch {
      // The recorder may already be stopped; not an error worth surfacing.
    }
    const client = clientRef.current;
    clientRef.current = null;
    if (client) {
      try {
        await client.stopRecognition({ noTimeout: true });
      } catch {
        // A socket that already closed is fine.
      }
    }
    audioStartedAt.current = null;
    gotFirstTranscript.current = false;
    setState((s) => ({ ...s, status: "idle", partial: "" }));
  }, [stopRecording]);

  const start = useCallback(async () => {
    if (!audioContext) {
      setState((s) => ({
        ...s,
        status: "error",
        message: "Audio context unavailable in this browser.",
      }));
      return;
    }

    setState((s) => ({ ...s, status: "connecting", message: null }));

    // 1. Open the microphone FIRST.
    //
    // Ordering matters for cost: minting a token and opening the socket before
    // knowing whether we can actually capture audio would consume a Speechmatics
    // session every time permission is denied. Asking for the microphone first
    // means a refused prompt costs nothing.
    try {
      await startRecording({});
    } catch (error) {
      setState((s) => ({
        ...s,
        status: "unavailable",
        message:
          error instanceof Error && error.name === "NotAllowedError"
            ? "Microphone permission denied. Typed commands still work."
            : "Could not open the microphone. Typed commands still work.",
      }));
      return;
    }

    // 2. Ask our server for a temporary token. The API key stays server-side.
    let jwt: string;
    try {
      const response = await fetch("/api/speechmatics-token", { method: "POST" });
      const body = await response.json();
      if (!response.ok || !body.jwt) {
        stopRecording();
        setState((s) => ({
          ...s,
          status: "unavailable",
          message: body.reason ?? "Could not obtain a Speechmatics token.",
        }));
        return;
      }
      jwt = body.jwt as string;
    } catch {
      stopRecording();
      setState((s) => ({
        ...s,
        status: "unavailable",
        message: "Token endpoint unreachable. Typed commands still work.",
      }));
      return;
    }

    // 3. Open the real-time socket.
    const client = new RealtimeClient();
    clientRef.current = client;

    client.addEventListener("receiveMessage", ({ data }) => {
      if (data.message === "AddPartialTranscript") {
        const text = data.metadata.transcript;
        setState((s) => ({ ...s, partial: text }));
      } else if (data.message === "AddTranscript") {
        const text = data.metadata.transcript.trim();

        if (!gotFirstTranscript.current && audioStartedAt.current !== null) {
          gotFirstTranscript.current = true;
          const latency = performance.now() - audioStartedAt.current;
          setState((s) => ({ ...s, firstTranscriptLatencyMs: latency }));
        }

        if (text) {
          setState((s) => ({ ...s, final: text, partial: "" }));
          onUtteranceRef.current(text);
        }
      } else if (data.message === "Error") {
        setState((s) => ({
          ...s,
          status: "error",
          message: `Speechmatics: ${data.reason ?? data.type}`,
        }));
      }
    });

    client.addEventListener("socketStateChange", () => {
      if (client.socketState === "closed" && clientRef.current === client) {
        setState((s) =>
          s.status === "listening" ? { ...s, status: "idle" } : s,
        );
      }
    });

    try {
      await client.start(jwt, {
        transcription_config: {
          language,
          // `model` supersedes the deprecated `operating_point` field; the API
          // emits a deprecation warning if the old name is used.
          model: "enhanced",
          enable_partials: true,
          // Low delay matters here: the transcript gates a physical action, so
          // latency is felt directly by the operator.
          max_delay: 1.2,
        },
        audio_format: {
          type: "raw",
          encoding: "pcm_f32le",
          sample_rate: audioContext.sampleRate,
        },
      });
    } catch (error) {
      clientRef.current = null;
      stopRecording();
      setState((s) => ({
        ...s,
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to start recognition.",
      }));
      return;
    }

    setState((s) => ({ ...s, status: "listening", message: null }));
  }, [audioContext, language, startRecording, stopRecording]);

  // Tear the socket down if the component unmounts mid-session.
  useEffect(() => {
    return () => {
      const client = clientRef.current;
      clientRef.current = null;
      client?.stopRecognition({ noTimeout: true }).catch(() => {});
    };
  }, []);

  return { ...state, isRecording, start, stop };
}
