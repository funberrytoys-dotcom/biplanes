import { describe, it, expect } from 'vitest';
import { UPGRADE_DEFS } from '../upgrades/upgrade-pool.js';
import { WINGMAN_DEF } from './faction.js';
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
    // No stray ids in the map that are not real upgrades (incl. faction-only ids).
    const realIds = new Set([...UPGRADE_DEFS, WINGMAN_DEF].map(d => d.id));
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

describe('keystoneTier boundary behavior', () => {
  // Thresholds drive the boundaries; tier counts how many are met (<3, <6, <9... gates).
  const [t1, t2, t3] = KEYSTONE_THRESHOLDS;

  it('returns 0 below the first threshold', () => {
    expect(keystoneTier(0)).toBe(0);
    expect(keystoneTier(t1 - 1)).toBe(0); // 2 -> 0
  });

  it('returns 1 from the first threshold up to (but not including) the second', () => {
    expect(keystoneTier(t1)).toBe(1); // 3 -> 1
    expect(keystoneTier(t2 - 1)).toBe(1); // 5 -> 1
  });

  it('returns 2 from the second threshold up to (but not including) the third', () => {
    expect(keystoneTier(t2)).toBe(2); // 6 -> 2
    expect(keystoneTier(t3 - 1)).toBe(2); // 8 -> 2
  });

  it('returns 3 at and above the third threshold', () => {
    expect(keystoneTier(t3)).toBe(3); // 9 -> 3
    expect(keystoneTier(100)).toBe(3);
  });

  it('is never negative for any affinity >= 0', () => {
    for (let affinity = 0; affinity <= 120; affinity++) {
      expect(keystoneTier(affinity)).toBeGreaterThanOrEqual(0);
    }
  });

  it('never exceeds the number of thresholds', () => {
    for (let affinity = 0; affinity <= 120; affinity++) {
      expect(keystoneTier(affinity)).toBeLessThanOrEqual(KEYSTONE_THRESHOLDS.length);
    }
  });
});

describe('branchOfUpgrade known mappings', () => {
  it('maps known upgrade ids to their UPGRADE_BRANCH branch', () => {
    // Assert against the source-of-truth map, not copied literals.
    expect(branchOfUpgrade('damage_plus_25')).toBe(UPGRADE_BRANCH.damage_plus_25);
    expect(branchOfUpgrade('damage_plus_25')).toBe('assault');
    expect(branchOfUpgrade('homing_rocket')).toBe(UPGRADE_BRANCH.homing_rocket);
    expect(branchOfUpgrade('homing_rocket')).toBe('bombardier');
    expect(branchOfUpgrade('wingman')).toBe(UPGRADE_BRANCH.wingman);
    expect(branchOfUpgrade('wingman')).toBe('commander');
    expect(branchOfUpgrade('lifesteal')).toBe(UPGRADE_BRANCH.lifesteal);
    expect(branchOfUpgrade('lifesteal')).toBe('hull');
  });
});
