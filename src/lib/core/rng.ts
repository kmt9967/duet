/**
 * Deterministic pseudo-random number generation.
 *
 * Every scene in DUET is a pure function of an integer seed. The evaluation
 * harness depends on this: running seed 7 today and seed 7 tomorrow must
 * produce a byte-identical world, otherwise a reported success rate means
 * nothing.
 *
 * Implementation is mulberry32 — small, fast, and well-distributed enough for
 * scene layout. It is NOT cryptographically secure and must never be used for
 * anything security-sensitive.
 */

export type Rng = {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform float in [min, max). */
  float(min: number, max: number): number;
  /** Uniform integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Pick one element uniformly. Throws on an empty array. */
  pick<T>(items: readonly T[]): T;
  /** Returns true with probability `p`. */
  chance(p: number): boolean;
  /** Fisher-Yates shuffle into a new array. */
  shuffle<T>(items: readonly T[]): T[];
};

export function createRng(seed: number): Rng {
  // Coerce to a uint32 so negative or fractional seeds still behave.
  let state = Math.abs(Math.floor(seed)) >>> 0;
  // A zero state degenerates, so nudge it.
  if (state === 0) state = 0x9e3779b9;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const float = (min: number, max: number) => min + next() * (max - min);

  const int = (min: number, max: number) =>
    Math.floor(float(min, max + 1));

  const pick = <T,>(items: readonly T[]): T => {
    if (items.length === 0) {
      throw new Error("rng.pick called with an empty array");
    }
    return items[Math.floor(next() * items.length)]!;
  };

  const chance = (p: number) => next() < p;

  const shuffle = <T,>(items: readonly T[]): T[] => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  };

  return { next, float, int, pick, chance, shuffle };
}
