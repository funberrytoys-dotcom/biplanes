/** A run is 15 waves, one life. Wave 15 is the boss. Design §13.0. */
export const RUN_WAVE_COUNT = 15;

/**
 * Enemy count per wave (index 0 = wave 1). Draft curve, calibration stage — the
 * real numbers come from §13.4 in the balance plan (Plan 6). Wave 15 is the boss,
 * handled separately, so its escort count here is 0 (solo boss for the skeleton).
 */
export const RUN_WAVE_ENEMY_COUNTS: readonly number[] = [
  2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 0,
] as const;

export function isBossWave(wave: number): boolean {
  return wave === RUN_WAVE_COUNT;
}

export function runEnemyCountForWave(wave: number): number {
  if (wave < 1 || wave > RUN_WAVE_COUNT) return 0;
  return RUN_WAVE_ENEMY_COUNTS[wave - 1]!;
}
