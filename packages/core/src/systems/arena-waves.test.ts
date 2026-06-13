import { describe, expect, it } from 'vitest';
import { ARENA_FINAL_BOSS_SCORE, arenaStageForScore, arenaTargetEnemyCount } from './arena-waves.js';

describe('arena waves', () => {
  it('keeps each wave active until all enemies in that wave are down', () => {
    expect(arenaTargetEnemyCount(0)).toBe(1);
    expect(arenaTargetEnemyCount(1)).toBe(2);
    expect(arenaTargetEnemyCount(2)).toBe(2);
    expect(arenaTargetEnemyCount(3)).toBe(3);
    expect(arenaTargetEnemyCount(5)).toBe(3);
    expect(arenaTargetEnemyCount(6)).toBe(3);
    expect(arenaTargetEnemyCount(8)).toBe(3);
    expect(arenaTargetEnemyCount(9)).toBe(5);
    expect(arenaTargetEnemyCount(13)).toBe(5);
  });

  it('advances the visible arena stage only at wave clear thresholds', () => {
    expect(arenaStageForScore(0)).toBe(1);
    expect(arenaStageForScore(1)).toBe(2);
    expect(arenaStageForScore(2)).toBe(2);
    expect(arenaStageForScore(3)).toBe(3);
    expect(arenaStageForScore(5)).toBe(3);
    expect(arenaStageForScore(6)).toBe(4);
    expect(arenaStageForScore(8)).toBe(4);
    expect(arenaStageForScore(9)).toBe(5);
    expect(arenaStageForScore(13)).toBe(5);
    expect(arenaStageForScore(ARENA_FINAL_BOSS_SCORE)).toBe(6);
  });
});
