/**
 * Utterance aggregation for Speechmatics real-time transcripts.
 *
 * The critical detail, and the source of a production bug: an `AddTranscript`
 * message is **not** a complete utterance. It is an incremental *final segment*
 * — the portion of audio the recogniser has now committed to. Speaking
 * "Set the dinner table." produces a sequence like:
 *
 *     AddTranscript "Set"
 *     AddTranscript "the"
 *     AddTranscript "dinner table."
 *
 * Treating each of those as a command sends three fragments through the parser,
 * all of which are rejected, and floods the command log.
 *
 * This module buffers those segments and emits exactly one utterance per
 * spoken sentence. The boundary comes from the server's `EndOfUtterance`
 * message where available (enabled via `conversation_config`), with a
 * client-side silence timeout as a fallback so a missing or disabled
 * end-of-utterance signal degrades to "emit after a pause" rather than
 * never emitting at all.
 *
 * Deliberately free of React and of the Speechmatics SDK so it can be tested
 * directly.
 */

/** Default silence, in milliseconds, before the fallback flush fires. */
export const DEFAULT_SILENCE_MS = 1200;

export type AggregatorOptions = {
  /** Fallback flush delay when no EndOfUtterance arrives. */
  silenceMs?: number;
};

/**
 * Join committed segments into a single sentence.
 *
 * Segments arrive pre-tokenised and may carry their own leading/trailing
 * spaces. Joining naively yields doubled spaces and floating punctuation
 * ("Set the dinner table ."), which would reach the parser.
 */
export function joinSegments(segments: readonly string[]): string {
  const joined = segments
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");

  return joined
    // Collapse any run of whitespace.
    .replace(/\s+/g, " ")
    // Pull punctuation back onto the preceding word.
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

export class UtteranceAggregator {
  private segments: string[] = [];
  private lastSegmentAt: number | null = null;
  private readonly silenceMs: number;

  constructor(options: AggregatorOptions = {}) {
    this.silenceMs = options.silenceMs ?? DEFAULT_SILENCE_MS;
  }

  /**
   * Record one committed segment from an `AddTranscript` message.
   * Empty or whitespace-only segments are ignored rather than buffered, so a
   * silent stretch cannot later emit an empty command.
   */
  addFinalSegment(text: string, nowMs = 0): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    this.segments.push(trimmed);
    this.lastSegmentAt = nowMs;
  }

  /** Text buffered so far — used to keep the live caption in sync. */
  get buffered(): string {
    return joinSegments(this.segments);
  }

  /** True when there is something worth emitting. */
  get hasPending(): boolean {
    return this.segments.length > 0;
  }

  /**
   * Close the current utterance and return it, or null when nothing is
   * buffered.
   *
   * Returning null on an empty buffer is what makes duplicate boundary events
   * safe: the first call drains the buffer, so a second `EndOfUtterance` for
   * the same utterance finds nothing and emits nothing. No timestamp
   * heuristics are involved, which means genuinely repeating a phrase — saying
   * "Stop." twice — still produces two commands.
   */
  complete(): string | null {
    if (this.segments.length === 0) return null;
    const text = joinSegments(this.segments);
    this.segments = [];
    this.lastSegmentAt = null;
    // An utterance of pure punctuation is not actionable.
    return text.replace(/[^\p{L}\p{N}]/gu, "").length > 0 ? text : null;
  }

  /**
   * Fallback boundary. Emits when `silenceMs` has passed since the last
   * segment, for servers that do not send `EndOfUtterance`.
   */
  completeIfSilent(nowMs: number): string | null {
    if (this.lastSegmentAt === null) return null;
    if (nowMs - this.lastSegmentAt < this.silenceMs) return null;
    return this.complete();
  }

  /** Discard anything buffered, e.g. when the session stops. */
  reset(): void {
    this.segments = [];
    this.lastSegmentAt = null;
  }
}
