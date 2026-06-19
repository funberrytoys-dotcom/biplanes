/**
 * Pure, functional mulberry32 step — same algorithm as `createRng`, but threads
 * the state explicitly so callers stay deterministic and replay-safe (no hidden
 * closures). `tick()` uses its own inline copy; shared systems use this.
 */
export function nextRandom(rngState: number): { value: number; rngState: number } {
  const nextState = (rngState + 0x6d2b79f5) >>> 0;
  let t = nextState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return {
    value: ((t ^ (t >>> 14)) >>> 0) / 4294967296,
    rngState: nextState,
  };
}
