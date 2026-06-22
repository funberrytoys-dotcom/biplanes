import { describe, it, expect } from 'vitest';
import {
  RUN_WAVE_COUNT,
  RUN_WAVE_ENEMY_COUNTS,
  isBossWave,
  runEnemyCountForWave,
  runEnemyHpMultiplierForWave,
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

  it('ramps enemy counts STRICTLY UP every wave 1..14 (difficulty rises each round)', () => {
    for (let w = 2; w <= 14; w++) {
      expect(runEnemyCountForWave(w)).toBeGreaterThan(runEnemyCountForWave(w - 1));
    }
  });

  it('total threat (count × HP) rises EVERY round, with a smoothly shrinking step', () => {
    const threat = (w: number) => runEnemyCountForWave(w) * runEnemyHpMultiplierForWave(w);
    let prevRatio = Infinity;
    for (let w = 2; w <= 14; w++) {
      const ratio = threat(w) / threat(w - 1);
      expect(threat(w)).toBeGreaterThan(threat(w - 1)); // постепенно: each round harder
      expect(ratio).toBeLessThanOrEqual(prevRatio + 1e-9); // gradual: step never grows
      expect(ratio).toBeLessThan(1.8); // no brutal spike
      prevRatio = ratio;
    }
  });

  it('grows enemy HP gently and stays killable late (not exponential)', () => {
    expect(runEnemyHpMultiplierForWave(1)).toBe(1);
    // Monotonic increase.
    for (let w = 2; w <= 15; w++) {
      expect(runEnemyHpMultiplierForWave(w)).toBeGreaterThan(runEnemyHpMultiplierForWave(w - 1));
    }
    // Late-game stays in a sane band (a 14-pick build can out-DPS this).
    expect(runEnemyHpMultiplierForWave(14)).toBeLessThan(10);
    expect(runEnemyHpMultiplierForWave(15)).toBeLessThan(11);
    // Clamps outside the run.
    expect(runEnemyHpMultiplierForWave(0)).toBe(1);
    expect(runEnemyHpMultiplierForWave(99)).toBe(runEnemyHpMultiplierForWave(15));
  });
});

describe('run-waves edge cases', () => {
  it('boss/escort: count list length matches RUN_WAVE_COUNT and wave 15 escort = 0', () => {
    expect(RUN_WAVE_ENEMY_COUNTS.length).toBe(RUN_WAVE_COUNT);
    expect(RUN_WAVE_ENEMY_COUNTS[RUN_WAVE_COUNT - 1]).toBe(0);
  });

  it('isBossWave is false for all out-of-range inputs', () => {
    expect(isBossWave(0)).toBe(false);
    expect(isBossWave(-1)).toBe(false);
    expect(isBossWave(RUN_WAVE_COUNT + 1)).toBe(false);
    expect(isBossWave(999)).toBe(false);
  });

  it('runEnemyCountForWave returns 0 below 1 and above RUN_WAVE_COUNT', () => {
    expect(runEnemyCountForWave(-5)).toBe(0);
    expect(runEnemyCountForWave(0)).toBe(0);
    expect(runEnemyCountForWave(RUN_WAVE_COUNT + 1)).toBe(0);
    expect(runEnemyCountForWave(999)).toBe(0);
  });

  it('runEnemyCountForWave matches the table for every in-range wave', () => {
    for (let w = 1; w <= RUN_WAVE_COUNT; w++) {
      expect(runEnemyCountForWave(w)).toBe(RUN_WAVE_ENEMY_COUNTS[w - 1]);
    }
  });

  it('runEnemyHpMultiplierForWave clamps both ends into 1..RUN_WAVE_COUNT', () => {
    expect(runEnemyHpMultiplierForWave(-10)).toBe(runEnemyHpMultiplierForWave(1));
    expect(runEnemyHpMultiplierForWave(0)).toBe(runEnemyHpMultiplierForWave(1));
    expect(runEnemyHpMultiplierForWave(RUN_WAVE_COUNT + 5)).toBe(
      runEnemyHpMultiplierForWave(RUN_WAVE_COUNT),
    );
  });
});
