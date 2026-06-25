import { describe, it, expect } from 'vitest';
import { applyUpgrade } from './apply-upgrade.js';
import { createWorldState } from '../world/world-state.js';
import { PLANE_INITIAL_HP } from '@biplanes/shared';
import type { Plane } from '../entities/plane.js';

function makePlayer(): Plane {
  return {
    id: 1, faction: 'player',
    kinematic: {
      position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, heading: 0, throttleOn: true,
      g: 1200, facing: 1, throttle: true, throttleLevel: 1,
    },
    hp: PLANE_INITIAL_HP, maxHp: PLANE_INITIAL_HP,
    weaponCooldown: 0, alive: true,
    state: 'flying',
    respawnTimer: 0,
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

  it('can build into an engine boost archetype', () => {
    const s = createWorldState(42, makePlayer());
    const cooled = applyUpgrade(s, 'coolant_injector');
    const tuned = applyUpgrade(cooled, 'boost_supercharger');

    expect(tuned.boostHeatMultiplier).toBeLessThan(1);
    expect(tuned.boostCoolingMultiplier).toBeGreaterThan(1);
    expect(tuned.boostPowerMultiplier).toBeGreaterThan(1);
  });

  it('can build into a survivable armored archetype', () => {
    const s = createWorldState(42, makePlayer());
    const after = applyUpgrade(s, 'reinforced_struts');

    expect(after.collisionDamageMultiplier).toBeLessThan(1);
    expect(after.player.maxHp).toBeGreaterThan(PLANE_INITIAL_HP);
  });

  it('multishot stacks extra bullets', () => {
    let s = createWorldState(42, makePlayer());
    s = applyUpgrade(s, 'multishot');
    expect(s.multishotExtra).toBe(1);
    s = applyUpgrade(s, 'multishot');
    expect(s.multishotExtra).toBe(2);
  });

  it('lifesteal grants per-kill healing', () => {
    const after = applyUpgrade(createWorldState(42, makePlayer()), 'lifesteal');
    expect(after.lifestealPerKill).toBeGreaterThan(0);
  });

  it('quick_salvo speeds up the salvo cooldown', () => {
    const after = applyUpgrade(createWorldState(42, makePlayer()), 'quick_salvo');
    expect(after.salvoCooldownMultiplier).toBeLessThan(1);
  });

  it('chico_wing evolution grants two drones', () => {
    const after = applyUpgrade(createWorldState(42, makePlayer()), 'chico_wing');
    expect(after.droneCount).toBe(2);
    expect(after.hasDrone).toBe(true);
  });
});

describe('applyUpgrade — wingman (Алые Шакалы signature)', () => {
  it('spawns one real ally plane (NOT a drone) on first apply', () => {
    const after = applyUpgrade(createWorldState(42, makePlayer()), 'wingman');
    expect(after.wingmanCount).toBe(1);
    expect(after.allies).toHaveLength(1);
    expect(after.allies[0]!.faction).toBe('player');
    expect(after.allies[0]!.alive).toBe(true);
    expect(after.allies[0]!.maxHp).toBeGreaterThan(0);
    // It must NOT fall back to the С.О.В. companion-drone path.
    expect(after.droneCount).toBe(0);
    expect(after.hasDrone).toBe(false);
  });

  it('stacks to a звено of two wingmen when applied twice', () => {
    let s = createWorldState(42, makePlayer());
    s = applyUpgrade(s, 'wingman');
    s = applyUpgrade(s, 'wingman');
    expect(s.wingmanCount).toBe(2);
    expect(s.allies).toHaveLength(2);
    // distinct entity ids
    expect(s.allies[0]!.id).not.toBe(s.allies[1]!.id);
  });

  it('fires the heavy Jackal gun when the player flies Алые Шакалы', () => {
    const s = { ...createWorldState(42, makePlayer()), playerFaction: 'jackals' as const };
    const after = applyUpgrade(s, 'wingman');
    expect(after.allies[0]!.heavyGun).toBe(true);
  });
});
