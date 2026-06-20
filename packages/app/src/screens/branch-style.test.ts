import { describe, it, expect } from 'vitest';
import { UPGRADE_DEFS } from '@biplanes/core';
import { BRANCH_PALETTE, branchStyleForUpgradeId } from './branch-style.js';

describe('branch-style', () => {
  it('has a colour + label for all four branches', () => {
    expect(Object.keys(BRANCH_PALETTE).sort()).toEqual(['assault', 'bombardier', 'commander', 'hull']);
    for (const entry of Object.values(BRANCH_PALETTE)) {
      expect(typeof entry.color).toBe('number');
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });

  it('resolves a branch style for every existing upgrade', () => {
    for (const def of UPGRADE_DEFS) {
      const s = branchStyleForUpgradeId(def.id);
      expect(['assault', 'bombardier', 'commander', 'hull']).toContain(s.branch);
      expect(typeof s.color).toBe('number');
      expect(s.label.length).toBeGreaterThan(0);
    }
  });
});
