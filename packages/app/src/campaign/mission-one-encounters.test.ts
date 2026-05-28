import { describe, expect, it } from 'vitest';
import { getMissionOneWavePlan, getMissionOneBossPlan } from './mission-one-encounters.js';

describe('mission one encounters', () => {
  it('splits pressure between player duelists and caravan hunters', () => {
    expect(getMissionOneWavePlan('first-claws')).toEqual([
      { count: 2, role: 'chase-player' },
    ]);
    expect(getMissionOneWavePlan('high-dive')).toEqual([
      { count: 2, role: 'chase-player' },
      { count: 1, role: 'attack-caravan' },
    ]);
    expect(getMissionOneWavePlan('underbelly')).toEqual([
      { count: 2, role: 'chase-player' },
      { count: 2, role: 'attack-caravan' },
    ]);
    expect(getMissionOneWavePlan('last-screen')).toEqual([
      { count: 1, role: 'chase-player' },
      { count: 2, role: 'attack-caravan' },
    ]);
  });

  it('keeps Scar readable as a retreat boss instead of a long hp wall', () => {
    expect(getMissionOneBossPlan()).toEqual({
      count: 1,
      role: 'attack-caravan',
      hpMultiplier: 5,
      retreatHpFraction: 0.35,
    });
  });
});
