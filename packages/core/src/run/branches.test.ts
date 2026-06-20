import { describe, it, expect } from 'vitest';
import { UPGRADE_DEFS } from '../upgrades/upgrade-pool.js';
import {
  BRANCHES,
  BRANCH_LABEL,
  UPGRADE_BRANCH,
  branchOfUpgrade,
  KEYSTONE_THRESHOLDS,
  keystoneTier,
} from './branches.js';

describe('branches', () => {
  it('has the four design branches with Russian labels', () => {
    expect(BRANCHES).toEqual(['assault', 'bombardier', 'commander', 'hull']);
    expect(BRANCH_LABEL.assault).toBe('Штурмовик');
    expect(BRANCH_LABEL.bombardier).toBe('Бомбардир');
    expect(BRANCH_LABEL.commander).toBe('Командир звена');
    expect(BRANCH_LABEL.hull).toBe('Корпус и сила');
  });

  it('tags every existing upgrade to exactly one branch', () => {
    for (const def of UPGRADE_DEFS) {
      const branch = branchOfUpgrade(def.id);
      expect(BRANCHES).toContain(branch);
    }
    // No stray ids in the map that are not real upgrades.
    const realIds = new Set(UPGRADE_DEFS.map(d => d.id));
    for (const id of Object.keys(UPGRADE_BRANCH)) {
      expect(realIds.has(id as never)).toBe(true);
    }
  });

  it('maps a few representative upgrades to the expected branch', () => {
    expect(branchOfUpgrade('gatling_evolution')).toBe('assault');
    expect(branchOfUpgrade('cluster_bomb')).toBe('bombardier');
    expect(branchOfUpgrade('drone_wingman')).toBe('commander');
    expect(branchOfUpgrade('reinforced_struts')).toBe('hull');
  });

  it('unlocks keystone tiers at 3/6/9 affinity', () => {
    expect(KEYSTONE_THRESHOLDS).toEqual([3, 6, 9]);
    expect(keystoneTier(0)).toBe(0);
    expect(keystoneTier(2)).toBe(0);
    expect(keystoneTier(3)).toBe(1);
    expect(keystoneTier(5)).toBe(1);
    expect(keystoneTier(6)).toBe(2);
    expect(keystoneTier(9)).toBe(3);
    expect(keystoneTier(14)).toBe(3);
  });
});
