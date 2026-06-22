export interface Rng {
  next(): number;
  range(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  pickN<T>(items: readonly T[], n: number): T[];
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function range(min: number, max: number): number {
    // Clamp the span to >=0 so a degenerate (max<=min) range yields `min` instead of
    // a wrong/negative index. Still consumes exactly one next() draw in every case, so
    // the deterministic RNG stream (and replay) is unaffected.
    const span = Math.max(0, max - min);
    return Math.floor(next() * span) + min;
  }

  function pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('pick from empty array');
    return items[range(0, items.length)]!;
  }

  function pickN<T>(items: readonly T[], n: number): T[] {
    if (n > items.length) throw new Error('pickN: n > items.length');
    const pool = [...items];
    const out: T[] = [];
    for (let i = 0; i < n; i++) {
      const idx = range(0, pool.length);
      out.push(pool[idx]!);
      pool.splice(idx, 1);
    }
    return out;
  }

  return { next, range, pick, pickN };
}
