"use client";

import { useCallback, useMemo, useState } from "react";

import { WorkspaceCanvas, ARM_COLOR } from "@/components/WorkspaceCanvas";
import { stepDepths } from "@/lib/planner/plan";
import { useSession } from "@/lib/session/useSession";
import { useSpeechmatics } from "@/lib/voice/useSpeechmatics";

const PRESETS = [
  {
    label: "The brief's worked example",
    text: "open the top drawer, pick up the plate with arm A, place it on the table, pick up the mug with arm B, pour water into the mug with arm A",
  },
  {
    label: "Cross-workspace transfer",
    text: "pick up the mug and place it on the right setting",
  },
  {
    label: "Full place setting",
    text: "open the top drawer, pick up the plate with arm A, place it on the right setting, then put the fork on the right setting",
  },
  { label: "Whole-task macro", text: "set the dinner table" },
];

export default function Home() {
  const session = useSession(1);
  const [typed, setTyped] = useState("");
  const [reply, setReply] = useState<string | null>(null);

  const handleUtterance = useCallback(
    (text: string) => {
      setReply(session.submitCommand(text, "voice"));
    },
    [session],
  );

  const voice = useSpeechmatics({ onUtterance: handleUtterance });

  const run = (text: string, source: "typed" | "preset") => {
    if (!text.trim()) return;
    setReply(session.submitCommand(text, source));
  };

  const { snapshot, plan, execution } = session;

  // Group plan steps by graph depth so concurrent phases are visible as rows.
  const phases = useMemo(() => {
    if (!plan || !execution) return [];
    const depths = stepDepths(plan.steps);
    const byDepth = new Map<number, typeof execution.outcomes>();
    for (const outcome of execution.outcomes) {
      const d = depths.get(outcome.stepId) ?? 0;
      if (!byDepth.has(d)) byDepth.set(d, []);
      byDepth.get(d)!.push(outcome);
    }
    return [...byDepth.entries()].sort((a, b) => a[0] - b[0]);
  }, [plan, execution]);

  const activeIds = new Set(snapshot.active.map((o) => o.stepId));

  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
      <Header voiceStatus={voice.status} />

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        {/* ---------------- workspace ---------------- */}
        <section className="panel min-w-0 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="panel-title">Workspace — plan view</h2>
              <p className="mt-1 text-xs text-slate-500">
                Dual SO-101 arms. Dashed rings are reach envelopes; the hole at each
                centre is real, set by the elbow stop.
              </p>
            </div>
            <SeedPicker seed={session.seed} onChange={session.loadSeed} />
          </div>

          <WorkspaceCanvas scene={snapshot.scene} active={snapshot.active} />

          <Transport
            isPlaying={session.isPlaying}
            playheadMs={session.playheadMs}
            totalMs={session.totalMs}
            onToggle={() => session.setIsPlaying(!session.isPlaying)}
            onScrub={session.setPlayheadMs}
          />

          {execution && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Steps" value={`${execution.outcomes.length}`} />
              <Stat label="Hand-offs" value={`${execution.handoffCount}`} />
              <Stat
                label="Parallelism"
                value={`${execution.realisedParallelism}x`}
              />
              <Stat
                label="Sim duration"
                value={`${(execution.simulatedDurationMs / 1000).toFixed(1)}s`}
              />
            </div>
          )}
        </section>

        {/* ---------------- command column ---------------- */}
        <div className="flex min-w-0 flex-col gap-5">
          <VoicePanel voice={voice} />

          <section className="panel p-4">
            <h2 className="panel-title">Command</h2>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(typed, "typed");
                setTyped("");
              }}
            >
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="pick up the mug and place it on the right setting"
                aria-label="Type a command"
                className="mono min-w-0 flex-1 rounded-lg border border-slate-700/70 bg-slate-950/60 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600"
              />
              <button
                type="submit"
                className="shrink-0 rounded-lg bg-sky-500 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-sky-400"
              >
                Run
              </button>
            </form>

            <div className="mt-3 flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => run(preset.text, "preset")}
                  className="rounded-md border border-slate-700/70 px-2.5 py-1.5 text-[11px] text-slate-400 transition hover:border-sky-500/60 hover:text-sky-300"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {reply && (
              <p className="mt-3 rounded-lg border border-sky-500/25 bg-sky-500/5 px-3 py-2 text-xs leading-relaxed text-sky-200">
                {reply}
              </p>
            )}
          </section>

          <PlanPanel phases={phases} activeIds={activeIds} notes={plan?.notes ?? []} />
        </div>
      </div>

      <HistoryPanel history={session.history} />

      <footer className="mono mt-8 border-t border-slate-800/70 pt-4 text-[11px] leading-relaxed text-slate-600">
        Simulation-first. The arms, planner and success criteria are real and
        deterministic; this is not a video. Transcription is live Speechmatics
        when a key is configured, and typed commands take the identical path
        through parser, planner and executor.
      </footer>
    </main>
  );
}

/* ------------------------------------------------------------------ */

function Header({ voiceStatus }: { voiceStatus: string }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="mono text-[11px] uppercase tracking-[0.2em] text-sky-400">
          Intel Physical AI · Bimanual VLA Challenge
        </div>
        <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-slate-100 sm:text-4xl">
          DUET
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Dual-arm Execution from Everyday Talk — say a dinner-table instruction,
          watch two SO-101 arms reason, hand off, and carry it out.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Chip label="Planner" value="deterministic" tone="sky" />
        <Chip
          label="Voice"
          value={voiceStatus}
          tone={voiceStatus === "listening" ? "green" : "slate"}
        />
        <Chip label="Seeds" value="10 randomized" tone="slate" />
      </div>
    </header>
  );
}

function Chip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "sky" | "green" | "slate";
}) {
  const tones = {
    sky: "border-sky-500/40 text-sky-300",
    green: "border-emerald-500/50 text-emerald-300",
    slate: "border-slate-700 text-slate-400",
  } as const;
  return (
    <span
      className={`mono rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider ${tones[tone]}`}
    >
      {label}: {value}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
      <div className="mono text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="mono mt-0.5 text-sm text-slate-200">{value}</div>
    </div>
  );
}

function SeedPicker({
  seed,
  onChange,
}: {
  seed: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="mono flex items-center gap-2 text-[11px] text-slate-500">
      SEED
      <select
        value={seed}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
      >
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}

function Transport({
  isPlaying,
  playheadMs,
  totalMs,
  onToggle,
  onScrub,
}: {
  isPlaying: boolean;
  playheadMs: number;
  totalMs: number;
  onToggle: () => void;
  onScrub: (ms: number) => void;
}) {
  return (
    <div className="mt-3 flex items-center gap-3">
      <button
        onClick={onToggle}
        disabled={totalMs === 0}
        className="mono shrink-0 rounded-md border border-slate-700 px-3 py-1.5 text-[11px] text-slate-300 transition enabled:hover:border-sky-500/60 enabled:hover:text-sky-300 disabled:opacity-40"
      >
        {isPlaying ? "PAUSE" : "PLAY"}
      </button>
      <input
        type="range"
        min={0}
        max={Math.max(1, totalMs)}
        value={playheadMs}
        onChange={(e) => onScrub(Number(e.target.value))}
        aria-label="Scrub execution timeline"
        className="h-1 min-w-0 flex-1 accent-sky-400"
      />
      <span className="mono shrink-0 text-[11px] tabular-nums text-slate-500">
        {(playheadMs / 1000).toFixed(1)}s / {(totalMs / 1000).toFixed(1)}s
      </span>
    </div>
  );
}

function VoicePanel({
  voice,
}: {
  voice: ReturnType<typeof useSpeechmatics>;
}) {
  const listening = voice.status === "listening";
  return (
    <section className="panel p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="panel-title">Voice — Speechmatics real-time</h2>
        <button
          onClick={() => (listening ? voice.stop() : voice.start())}
          className={`mono rounded-md px-3 py-1.5 text-[11px] font-semibold transition ${
            listening
              ? "bg-rose-500 text-slate-950 hover:bg-rose-400"
              : "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
          }`}
        >
          {listening ? "STOP" : "LISTEN"}
        </button>
      </div>

      <div className="mt-3 min-h-[68px] rounded-lg border border-slate-800 bg-slate-950/60 p-3">
        {voice.partial || voice.final ? (
          <p className="text-sm leading-relaxed text-slate-200">
            {voice.final && <span>{voice.final}</span>}
            {voice.partial && (
              <span className="text-slate-500 italic"> {voice.partial}</span>
            )}
          </p>
        ) : (
          <p className="mono text-[11px] text-slate-600">
            {listening
              ? "Listening — speak a command."
              : "Press LISTEN, or type a command below."}
          </p>
        )}
      </div>

      {voice.message && (
        <p className="mt-2 rounded-md border border-amber-500/25 bg-amber-500/5 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-200">
          {voice.message}
        </p>
      )}

      {voice.firstTranscriptLatencyMs !== null && (
        <p className="mono mt-2 text-[10px] text-slate-500">
          First transcript returned in{" "}
          {Math.round(voice.firstTranscriptLatencyMs)} ms (measured, this session)
        </p>
      )}
    </section>
  );
}

function PlanPanel({
  phases,
  activeIds,
  notes,
}: {
  phases: Array<[number, Array<{ stepId: string; arm: "A" | "B"; description: string; status: string; detail?: string }>]>;
  activeIds: Set<string>;
  notes: string[];
}) {
  return (
    <section className="panel p-4">
      <h2 className="panel-title">Plan — dependency phases</h2>
      <p className="mt-1 text-xs text-slate-500">
        Steps on one row have no ordering constraint between them, so both arms
        move together.
      </p>

      {phases.length === 0 ? (
        <p className="mono mt-3 text-[11px] text-slate-600">
          No plan yet. Run a command.
        </p>
      ) : (
        <ol className="mt-3 space-y-1.5">
          {phases.map(([depth, steps]) => (
            <li key={depth} className="flex gap-2">
              <span className="mono w-9 shrink-0 pt-1.5 text-[10px] text-slate-600">
                P{String(depth).padStart(2, "0")}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                {steps.map((step) => (
                  <div
                    key={step.stepId}
                    className={`rounded-md border px-2.5 py-1.5 text-[11px] leading-snug transition ${
                      activeIds.has(step.stepId)
                        ? "border-sky-400/70 bg-sky-500/10 text-slate-100"
                        : step.status === "failed"
                          ? "border-rose-500/40 bg-rose-500/5 text-rose-200"
                          : step.status === "skipped"
                            ? "border-slate-800 bg-slate-900/40 text-slate-600"
                            : "border-slate-800 bg-slate-950/40 text-slate-400"
                    }`}
                  >
                    <span
                      className="mono mr-1.5 text-[10px]"
                      style={{ color: ARM_COLOR[step.arm] }}
                    >
                      {step.arm}
                    </span>
                    {step.description}
                    {step.detail && (
                      <span className="mt-0.5 block text-[10px] text-rose-300/80">
                        {step.detail}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}

      {notes.length > 0 && (
        <ul className="mono mt-3 space-y-1 border-t border-slate-800 pt-2 text-[10px] text-amber-300/80">
          {notes.map((note, i) => (
            <li key={i}>• {note}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function HistoryPanel({
  history,
}: {
  history: ReturnType<typeof useSession>["history"];
}) {
  if (history.length === 0) return null;

  return (
    <section className="panel mt-5 p-4">
      <h2 className="panel-title">Command log</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[11px]">
          <thead className="mono text-[10px] uppercase tracking-wider text-slate-600">
            <tr>
              <th className="pb-2 pr-3 font-normal">Source</th>
              <th className="pb-2 pr-3 font-normal">Transcript</th>
              <th className="pb-2 pr-3 font-normal">Understood</th>
              <th className="pb-2 pr-3 font-normal">Steps</th>
              <th className="pb-2 pr-3 font-normal">Reasoning</th>
              <th className="pb-2 font-normal">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {history.map((record) => (
              <tr key={record.id} className="align-top">
                <td className="mono py-2 pr-3 text-[10px] uppercase text-slate-500">
                  {record.source}
                </td>
                <td className="py-2 pr-3 text-slate-300">{record.transcript}</td>
                <td className="py-2 pr-3 text-slate-400">
                  {record.intents.length > 0 ? (
                    <ul className="space-y-0.5">
                      {record.intents.map((intent, i) => (
                        <li key={i}>• {intent}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                  {record.diagnostics.map((d, i) => (
                    <div key={i} className="mt-0.5 text-amber-300/80">
                      {d}
                    </div>
                  ))}
                </td>
                <td className="mono py-2 pr-3 tabular-nums text-slate-400">
                  {record.stepCount}
                  {record.handoffCount > 0 && (
                    <span className="text-amber-300/80">
                      {" "}
                      +{record.handoffCount} h/o
                    </span>
                  )}
                </td>
                <td className="mono py-2 pr-3 tabular-nums text-slate-400">
                  {record.reasoningMs.toFixed(2)} ms
                </td>
                <td className="mono py-2 text-[10px] uppercase">
                  <span
                    className={
                      record.outcome === "executed"
                        ? "text-emerald-400"
                        : record.outcome === "partial"
                          ? "text-amber-400"
                          : "text-rose-400"
                    }
                  >
                    {record.outcome}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
