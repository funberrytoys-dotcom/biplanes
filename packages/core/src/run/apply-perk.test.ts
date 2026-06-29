import { describe, it, expect } from 'vitest';
import { applyPerk } from './apply-perk.js';
import { PERKS } from './perks.js';
import { createWorldState, type WorldState } from '../world/world-state.js';
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

/** Fingerprint of gameplay-affecting fields (excludes appliedUpgradeIds, which always grows). */
function fingerprint(s: WorldState): string {
  return JSON.stringify([
    s.damageMultiplier, s.fireRateMultiplier, s.boostHeatMultiplier, s.boostCoolingMultiplier,
    s.boostPowerMultiplier, s.collisionDamageMultiplier, s.hpRegenPerSec, s.lifestealPerKill,
    s.salvoCooldownMultiplier, s.multishotExtra, s.hasDrone, s.droneCount, s.wingmanCount,
    s.hasHomingRockets, s.hasFlameTrail, s.hasHeavyCannon, s.player.maxHp, s.allies.length,
  ]);
}

describe('applyPerk', () => {
  it('every one of the 32 perks has a REAL effect (no no-op) and never throws', () => {
    for (const p of PERKS) {
      const s = createWorldState(42, makePlayer());
      const before = fingerprint(s);
      const after = applyPerk(s, p.id);
      expect(after.appliedUpgradeIds).toContain(p.id);
      expect(fingerprint(after)).not.toBe(before); // each perk changes some gameplay field
    }
  });

  it('is pure — does not mutate the input state', () => {
    const s = createWorldState(42, makePlayer());
    const beforeDmg = s.damageMultiplier;
    applyPerk(s, 'domna');
    expect(s.damageMultiplier).toBe(beforeDmg);
    expect(s.appliedUpgradeIds).toHaveLength(0);
  });

  it('Осиное гнездо spawns the С.О.В. drone swarm', () => {
    const after = applyPerk(createWorldState(1, makePlayer()), 'osinoe-gnezdo');
    expect(after.hasDrone).toBe(true);
    expect(after.droneCount).toBeGreaterThanOrEqual(2);
  });

  it('Звено асов launches a mortal ace ally plane', () => {
    const after = applyPerk(createWorldState(1, makePlayer()), 'zveno-asov');
    expect(after.wingmanCount).toBe(1);
    expect(after.allies).toHaveLength(1);
  });

  it('Бронепластины stacks: three copies compound the HP bonus', () => {
    let s = createWorldState(1, makePlayer());
    s = applyPerk(s, 'broneplastiny');
    s = applyPerk(s, 'broneplastiny');
    s = applyPerk(s, 'broneplastiny');
    expect(s.player.maxHp).toBeCloseTo(PLANE_INITIAL_HP * 1.25 ** 3, 1);
  });

  it('flame-trail and heavy-cannon perks flip their real flags', () => {
    expect(applyPerk(createWorldState(1, makePlayer()), 'napalmovyy-kover').hasFlameTrail).toBe(true);
    expect(applyPerk(createWorldState(1, makePlayer()), 'grom-pushka').hasHeavyCannon).toBe(true);
  });

  it('a completed marquee synergy pair grants its bonus on top of both perks', () => {
    // Раскрутка (×1.22) then Радиатор-турбина (×1.12) → product 1.3664; the synergy adds ×1.1.
    let s = createWorldState(1, makePlayer());
    s = applyPerk(s, 'raskrutka');
    s = applyPerk(s, 'radiator-turbina');
    expect(s.fireRateMultiplier).toBeGreaterThan(1.22 * 1.12 + 0.05);
  });
});
