import { describe, it, expect } from 'vitest';
import { applyUpgrade } from './apply-upgrade.js';
import { createWorldState } from '../world/world-state.js';
import { PLANE_INITIAL_HP } from '@biplanes/shared';
import type { Plane } from '../entities/plane.js';

function makePlayer(): Plane {
  return {
    id: 1, faction: 'player',
    kinematic: { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, heading: 0, throttleOn: true },
    hp: PLANE_INITIAL_HP, maxHp: PLANE_INITIAL_HP,
    weaponCooldown: 0, alive: true,
  };
}

describe('applyUpgrade', () => {
  it('damage_plus_25 increases damageMultiplier by 25%', () => {
    const s = createWorldState(42, makePlayer());
    const after = applyUpgrade(s, 'damage_plus_25');
    expect(after.damageMultiplier).toBeCloseTo(1.25);
  });

  it('fire_rate_plus_50 increases fireRateMultiplier by 50%', () => {
    const s = createWorldState(42, makePlayer());
    const after = applyUpgrade(s, 'fire_rate_plus_50');
    expect(after.fireRateMultiplier).toBeCloseTo(1.5);
  });

  it('hp_plus_25 increases max HP and current HP proportionally', () => {
    const s = createWorldState(42, makePlayer());
    const after = applyUpgrade(s, 'hp_plus_25');
    expect(after.player.maxHp).toBeCloseTo(PLANE_INITIAL_HP * 1.25);
    expect(after.player.hp).toBeCloseTo(PLANE_INITIAL_HP * 1.25);
  });

  it('appends id to appliedUpgradeIds', () => {
    const s = createWorldState(42, makePlayer());
    const after = applyUpgrade(s, 'damage_plus_25');
    expect(after.appliedUpgradeIds).toEqual(['damage_plus_25']);
  });

  it('clears pendingLevelUp', () => {
    const s = { ...createWorldState(42, makePlayer()), pendingLevelUp: true };
    const after = applyUpgrade(s, 'damage_plus_25');
    expect(after.pendingLevelUp).toBe(false);
  });
});
