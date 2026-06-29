import { describe, it, expect } from 'vitest';
import {
  createPerkRunState, recordPerkPick, recordStartingCore, recordPerkSkip, recordPerkReroll,
} from './perk-run-state.js';

describe('perk run state', () => {
  it('starts empty with one reroll and no starting core', () => {
    const r = createPerkRunState();
    expect(r.picks).toHaveLength(0);
    expect(r.rerollsRemaining).toBe(1);
    expect(r.startingCore).toBeNull();
  });

  it('records a pick and bumps its category affinity', () => {
    const r = recordPerkPick(createPerkRunState(), 'raskrutka'); // gun
    expect(r.picks).toEqual(['raskrutka']);
    expect(r.affinity.gun).toBe(1);
    expect(r.affinity.hull).toBe(0);
  });

  it('records the free starting core as an owned pick + remembers it', () => {
    const r = recordStartingCore(createPerkRunState(), 'osinoe-gnezdo'); // squad
    expect(r.startingCore).toBe('osinoe-gnezdo');
    expect(r.picks).toEqual(['osinoe-gnezdo']);
    expect(r.affinity.squad).toBe(1);
  });

  it('skips and rerolls update budgets; reroll throws when exhausted', () => {
    let r = recordPerkSkip(createPerkRunState());
    expect(r.skips).toBe(1);
    r = recordPerkReroll(r);
    expect(r.rerollsRemaining).toBe(0);
    expect(() => recordPerkReroll(r)).toThrow();
  });

  it('is pure — recording does not mutate the input', () => {
    const r0 = createPerkRunState();
    recordPerkPick(r0, 'domna');
    expect(r0.picks).toHaveLength(0);
  });
});
