export const ARENA_WAVE_COUNTS = [1, 2, 3, 3, 5] as const;

export const ARENA_FINAL_BOSS_SCORE = ARENA_WAVE_COUNTS.reduce((sum, count) => sum + count, 0);

export function arenaWaveIndexForScore(playerScore: number): number {
  const score = Math.max(0, Math.floor(playerScore));
  let cleared = 0;
  for (let i = 0; i < ARENA_WAVE_COUNTS.length; i++) {
    cleared += ARENA_WAVE_COUNTS[i]!;
    if (score < cleared) return i;
  }
  return ARENA_WAVE_COUNTS.length;
}

export function arenaStageForScore(playerScore: number): number {
  return arenaWaveIndexForScore(playerScore) + 1;
}

export function arenaTargetEnemyCount(playerScore: number): number {
  const index = Math.min(ARENA_WAVE_COUNTS.length - 1, arenaWaveIndexForScore(playerScore));
  return ARENA_WAVE_COUNTS[index]!;
}
