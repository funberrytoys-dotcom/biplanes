import { describe, it, expect } from 'vitest';
import {
  RUN_REROLLS,
  createRunState,
  emptyAffinity,
  recordPick,
  recordSkip,
  recordReroll,
  advanceWave,
} from './run-state.js';
import { UPGRADE_DEFS } from '../upgrades/upgrade-pool.js';

describe('run-state', () => {
  it('starts on wave 1 with full reroll budget and zero affinity', () => {
    const run = createRunState();
    expect(run.wave).toBe(1);
    expect(run.picks).toEqual([]);
    expect(run.skips).toBe(0);
    expect(run.rerollsRemaining).toBe(RUN_REROLLS);
    expect(run.affinity).toEqual(emptyAffinity());
    expect(run.affinity.assault).toBe(0);
  });

  it('recordPick appends the pick and bumps its branch affinity, without mutating', () => {
    const run = createRunState();
    const after = recordPick(run, 'gatling_evolution'); // assault
    expect(after.picks).toEqual(['gatling_evolution']);
    expect(after.affinity.assault).toBe(1);
    expect(after.affinity.bombardier).toBe(0);
    // immutability
    expect(run.picks).toEqual([]);
    expect(run.affinity.assault).toBe(0);
  });

  it('can record every upgrade offered by the pool', () => {
    for (const def of UPGRADE_DEFS) {
      const after = recordPick(createRunState(), def.id);
      expect(after.picks).toEqual([def.id]);
    }
  });

  it('accumulates affinity across multiple picks in the same branch', () => {
    let run = createRunState();
    run = recordPick(run, 'cluster_bomb'); // bombardier
    run = recordPick(run, 'flame_trail');  // bombardier
    expect(run.affinity.bombardier).toBe(2);
    expect(run.picks).toEqual(['cluster_bomb', 'flame_trail']);
  });

  it('recordSkip increments skips and grants no affinity', () => {
    const run = recordSkip(createRunState());
    expect(run.skips).toBe(1);
    expect(run.picks).toEqual([]);
    expect(run.affinity).toEqual(emptyAffinity());
  });

  it('recordReroll spends one reroll and throws when none remain', () => {
    const run = recordReroll(createRunState());
    expect(run.rerollsRemaining).toBe(RUN_REROLLS - 1);
    expect(() => recordReroll(run)).toThrow(/no rerolls/i);
  });

  it('advanceWave moves to the next wave', () => {
    const run = advanceWave(createRunState());
    expect(run.wave).toBe(2);
  });
});
