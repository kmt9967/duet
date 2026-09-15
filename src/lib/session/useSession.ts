"use client";

/**
 * Session state: one scene, a history of commands, and the currently animating
 * plan.
 *
 * Commands arrive from two places — a Speechmatics transcript or the typed
 * input — and both take exactly the same path from here on. That is deliberate:
 * it means the typed fallback exercises the identical parser, planner and
 * executor, so a demo without a microphone is still a demo of the real system.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { generateScene } from "@/lib/core/scene";
import type { Scene } from "@/lib/core/types";
import { describeIntent } from "@/lib/language/intents";
import { parseCommand } from "@/lib/language/parser";
import { maxParallelism, type Plan } from "@/lib/planner/plan";
import { planIntents } from "@/lib/planner/planner";
import { executePlan, type ExecutionResult } from "@/lib/sim/executor";
import { createPlayback, type WorldSnapshot } from "@/lib/sim/playback";

export type CommandSource = "voice" | "typed" | "preset";

export type CommandRecord = {
  id: number;
  at: number;
  source: CommandSource;
  transcript: string;
  normalized: string;
  intents: string[];
  diagnostics: string[];
  planErrors: string[];
  planNotes: string[];
  stepCount: number;
  handoffCount: number;
  parallelism: number;
  /** Milliseconds spent in parse + plan, measured. */
  reasoningMs: number;
  outcome: "executed" | "partial" | "rejected";
};

export type SessionState = {
  seed: number;
  scene: Scene;
  plan: Plan | null;
  execution: ExecutionResult | null;
  snapshot: WorldSnapshot;
  history: CommandRecord[];
  isPlaying: boolean;
  playheadMs: number;
  totalMs: number;
};

/** Playback speed multiplier; the simulated clock runs faster than real time. */
const PLAYBACK_RATE = 1.6;

export function useSession(initialSeed = 1) {
  const [seed, setSeed] = useState(initialSeed);
  const [scene, setScene] = useState<Scene>(() => generateScene(initialSeed));
  const [plan, setPlan] = useState<Plan | null>(null);
  const [execution, setExecution] = useState<ExecutionResult | null>(null);
  const [history, setHistory] = useState<CommandRecord[]>([]);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const nextId = useRef(1);

  const playback = useMemo(() => {
    if (!plan || !execution) return null;
    return createPlayback(plan, execution.outcomes, scene);
  }, [plan, execution, scene]);

  const totalMs = playback?.totalMs ?? 0;

  const snapshot: WorldSnapshot = useMemo(() => {
    if (playback) return playback.sample(playheadMs);
    return { scene, active: [], completedCount: 0, totalMs: 0 };
  }, [playback, playheadMs, scene]);

  // Drive the playhead with rAF while playing.
  useEffect(() => {
    if (!isPlaying || !playback) return;

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const delta = (now - last) * PLAYBACK_RATE;
      last = now;
      setPlayheadMs((current) => {
        const next = current + delta;
        if (next >= playback.totalMs) {
          setIsPlaying(false);
          return playback.totalMs;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, playback]);

  const loadSeed = useCallback((value: number) => {
    setSeed(value);
    setScene(generateScene(value));
    setPlan(null);
    setExecution(null);
    setPlayheadMs(0);
    setIsPlaying(false);
  }, []);

  /**
   * Run one command end to end. Returns a spoken-style acknowledgement the UI
   * can show, describing what was understood and what will happen.
   */
  const submitCommand = useCallback(
    (transcript: string, source: CommandSource): string => {
      const startedAt = performance.now();

      const parsed = parseCommand(transcript);

      // Control verbs act on the session rather than the arms.
      if (parsed.intents.some((i) => i.kind === "reset")) {
        loadSeed(seed);
        return "Scene reset.";
      }
      if (parsed.intents.some((i) => i.kind === "stop")) {
        setIsPlaying(false);
        return "Stopped.";
      }

      // Plan against the scene as it stands after the last executed plan, so a
      // sequence of spoken commands composes the way an operator expects.
      const base = execution?.scene ?? scene;
      const nextPlan = planIntents(
        parsed.intents.filter(
          (i) => i.kind !== "stop" && i.kind !== "reset" && i.kind !== "query_state",
        ),
        base,
      );
      const reasoningMs = performance.now() - startedAt;

      const record: CommandRecord = {
        id: nextId.current++,
        at: Date.now(),
        source,
        transcript,
        normalized: parsed.normalized,
        intents: parsed.intents.map(describeIntent),
        diagnostics: parsed.diagnostics.map((d) => d.message),
        planErrors: nextPlan.errors.map((e) => e.message),
        planNotes: nextPlan.notes,
        stepCount: nextPlan.steps.length,
        handoffCount: nextPlan.steps.filter((s) => s.type === "handoff_take").length,
        parallelism: nextPlan.steps.length ? maxParallelism(nextPlan.steps) : 1,
        reasoningMs,
        outcome:
          nextPlan.steps.length === 0
            ? "rejected"
            : nextPlan.errors.length > 0
              ? "partial"
              : "executed",
      };

      setHistory((h) => [record, ...h].slice(0, 30));

      if (nextPlan.steps.length === 0) {
        setPlan(null);
        setExecution(null);
        return (
          record.diagnostics[0] ??
          record.planErrors[0] ??
          "I did not find anything actionable in that."
        );
      }

      const result = executePlan(nextPlan, base);
      setScene(base);
      setPlan(nextPlan);
      setExecution(result);
      setPlayheadMs(0);
      setIsPlaying(true);

      return buildAcknowledgement(record, result);
    },
    [execution, scene, seed, loadSeed],
  );

  const state: SessionState = {
    seed,
    scene,
    plan,
    execution,
    snapshot,
    history,
    isPlaying,
    playheadMs,
    totalMs,
  };

  return {
    ...state,
    loadSeed,
    submitCommand,
    setPlayheadMs,
    setIsPlaying,
  };
}

/** Compose the sentence the system reports back after planning. */
function buildAcknowledgement(
  record: CommandRecord,
  result: ExecutionResult,
): string {
  const failed = result.outcomes.filter((o) => o.status === "failed");

  const parts: string[] = [];
  parts.push(
    `Understood ${record.intents.length} instruction${record.intents.length === 1 ? "" : "s"}; planned ${record.stepCount} steps.`,
  );
  if (record.handoffCount > 0) {
    parts.push(
      `${record.handoffCount} hand-off${record.handoffCount === 1 ? "" : "s"} required because the arms cannot both reach.`,
    );
  }
  if (record.planErrors.length > 0) {
    parts.push(record.planErrors[0]!);
  }
  if (failed.length > 0) {
    parts.push(failed[0]!.detail ?? "A step failed during execution.");
  }
  if (record.planErrors.length === 0 && failed.length === 0) {
    parts.push("Executing now.");
  }
  return parts.join(" ");
}
