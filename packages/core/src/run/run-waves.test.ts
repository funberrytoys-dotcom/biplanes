import { describe, it, expect } from 'vitest';
import {
  RUN_WAVE_COUNT,
  RUN_WAVE_ENEMY_COUNTS,
  isBossWave,
  runEnemyCountForWave,
} from './run-waves.js';

describe('run-waves', () => {
  it('is a 15-wave run', () => {
    expect(RUN_WAVE_COUNT).toBe(15);
    expect(RUN_WAVE_ENEMY_COUNTS).toHaveLength(15);
  });

  it('treats only wave 15 as the boss wave', () => {
    for (let w = 1; w <= 14; w++) expect(isBossWave(w)).toBe(false);
    expect(isBossWave(15)).toBe(true);
  });

  it('returns the per-wave enemy count, 0 outside the run', () => {
    expect(runEnemyCountForWave(1)).toBe(RUN_WAVE_ENEMY_COUNTS[0]);
    expect(runEnemyCountForWave(14)).toBe(RUN_WAVE_ENEMY_COUNTS[13]);
    expect(runEnemyCountForWave(0)).toBe(0);
    expect(runEnemyCountForWave(16)).toBe(0);
  });

  it('ramps enemy counts non-decreasing across waves 1..14', () => {
    for (let w = 2; w <= 14; w++) {
      expect(runEnemyCountForWave(w)).toBeGreaterThanOrEqual(runEnemyCountForWave(w - 1));
    }
  });
});
