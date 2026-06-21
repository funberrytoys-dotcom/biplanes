/** A run is 15 waves, one life. Wave 15 is the boss. Design §13.0. */
export const RUN_WAVE_COUNT = 15;

/**
 * Enemy count per wave (index 0 = wave 1). Draft curve, calibration stage — the
 * real numbers come from §13.4 in the balance plan (Plan 6). Wave 15 is the boss,
 * handled separately, so its escort count here is 0 (solo boss for the skeleton).
 */
export const RUN_WAVE_ENEMY_COUNTS: readonly number[] = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 0,
] as const;

export function isBossWave(wave: number): boolean {
  return wave === RUN_WAVE_COUNT;
}

export function runEnemyCountForWave(wave: number): number {
  if (wave < 1 || wave > RUN_WAVE_COUNT) return 0;
  return RUN_WAVE_ENEMY_COUNTS[wave - 1]!;
}

/** Per-wave enemy-HP growth terms (calibration stage — §13.4 / balance council). */
export const RUN_HP_SLOPE_PER_WAVE = 0.45;
export const RUN_HP_ACCEL_PER_WAVE = 0.012;

/**
 * Enemy max-HP multiplier for a run wave. Linear base + a gentle quadratic so HP
 * keeps visibly rising every round and late enemies are real walls (wave 1 = 1x,
 * wave 14 ≈ 8.9x, boss wave ≈ 9.6x) — yet still killable by a built-up 14-pick run.
 */
export function runEnemyHpMultiplierForWave(wave: number): number {
  const w = Math.max(1, Math.min(RUN_WAVE_COUNT, wave));
  const n = w - 1;
  return 1 + n * RUN_HP_SLOPE_PER_WAVE + n * n * RUN_HP_ACCEL_PER_WAVE;
}
