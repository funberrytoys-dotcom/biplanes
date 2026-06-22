/** A run is 15 waves, one life. Wave 15 is the boss. Design §13.0. */
export const RUN_WAVE_COUNT = 15;

/**
 * Enemy count per wave (index 0 = wave 1). Smooth ramp: **+1 enemy every round** so the
 * difficulty visibly rises EACH wave (owner: "сложность должна расти постепенно каждый
 * раунд"). The old curve repeated 12,12 and 13,13 → those rounds were no harder than the
 * previous (a threat dip). Strictly increasing fixes that; combined with the HP curve the
 * total threat (count×HP) rises every wave with a smoothly-shrinking step (≈×1.7 early →
 * ×1.16 late), i.e. steep onboarding then a gentle grind — matching §13.4. Wave 15 is the
 * boss (handled separately) so its escort count is 0.
 */
export const RUN_WAVE_ENEMY_COUNTS: readonly number[] = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 0,
] as const;

export function isBossWave(wave: number): boolean {
  return wave === RUN_WAVE_COUNT;
}

export function runEnemyCountForWave(wave: number): number {
  if (wave < 1 || wave > RUN_WAVE_COUNT) return 0;
  return RUN_WAVE_ENEMY_COUNTS[wave - 1]!;
}

/** Per-wave enemy-HP growth terms (calibration stage — §13.4 / balance council).
 *  Flattened (was 0.45/0.012) because the run enemy BASE HP was raised (RUN_ENEMY_BASE_HP
 *  in the app) so even wave-1 enemies take a few hits — keeps late waves from ballooning. */
export const RUN_HP_SLOPE_PER_WAVE = 0.30;
export const RUN_HP_ACCEL_PER_WAVE = 0.008;

/**
 * Enemy max-HP multiplier for a run wave. Linear base + a gentle quadratic so HP
 * keeps visibly rising every round (wave 1 = 1x, wave 14 ≈ 5.6x) — applied on top of
 * the raised run enemy base HP, so early enemies take ~3 hits and late ones are walls.
 */
export function runEnemyHpMultiplierForWave(wave: number): number {
  const w = Math.max(1, Math.min(RUN_WAVE_COUNT, wave));
  const n = w - 1;
  return 1 + n * RUN_HP_SLOPE_PER_WAVE + n * n * RUN_HP_ACCEL_PER_WAVE;
}
