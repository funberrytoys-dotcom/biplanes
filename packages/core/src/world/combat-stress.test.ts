import { describe, it, expect } from 'vitest';
import { tick } from './tick.js';
import { createWorldState } from './world-state.js';
import { applyUpgrade } from '../upgrades/apply-upgrade.js';
import { PLANE_INITIAL_HP, WORLD_WIDTH, WORLD_HEIGHT } from '@biplanes/shared';
import type { Plane } from '../entities/plane.js';
import type { SupplyBalloon } from '../entities/pickup.js';

function player(): Plane {
  return {
    id: 1, faction: 'player',
    kinematic: { position: { x: 600, y: 1500 }, velocity: { x: 700, y: 0 }, heading: 0, throttleOn: true, g: 800, facing: 1, throttle: true, throttleLevel: 1 },
    hp: PLANE_INITIAL_HP, maxHp: PLANE_INITIAL_HP, weaponCooldown: 0, alive: true, state: 'flying', respawnTimer: 0, ammo: 60, reloadTimer: 0,
  };
}
function ace(id: number, x: number, y: number): Plane {
  return {
    id, faction: 'enemy',
    kinematic: { position: { x, y }, velocity: { x: -700, y: 0 }, heading: Math.PI, throttleOn: true, g: 800, facing: -1, throttle: true, throttleLevel: 1 },
    hp: 200, maxHp: 200, weaponCooldown: 0, alive: true, state: 'flying', respawnTimer: 0,
    aiRole: 'ace', firesRockets: id % 3 === 0, rocketCooldown: 0,
  };
}
function balloon(id: number, x: number, y: number): SupplyBalloon {
  return { id, position: { x, y }, velocity: { x: 12, y: 0 }, bobPhase: 0, hp: 3, alive: true };
}

const CMD = { rotate: 1 as const, fire: true, bomb: false, throttleDelta: 0 as const, eject: false, jump: false, special: true };

describe('freeze hunt — full Jackal-ish run combat', () => {
  it('ticks 4000 frames of heavy combat without throwing or hanging', () => {
    let s = createWorldState(11, player());
    // Jackal-ish build by ~round 4: swarm + guns + rockets.
    for (const id of ['wingman', 'wingman', 'wingman', 'wingman', 'multishot', 'damage_plus_50', 'fire_rate_plus_50', 'homing_rocket', 'heavy_bomb', 'piercing_bullets', 'lifesteal'] as const) {
      s = applyUpgrade(s, id);
    }
    s = {
      ...s,
      worldWidth: WORLD_WIDTH * 3, worldHeight: WORLD_HEIGHT * 3,
      enemies: [ace(10, 1400, 1500), ace(11, 1600, 1300), ace(12, 1800, 1700), ace(13, 2000, 1400), ace(14, 1500, 1600), ace(15, 1700, 1200), ace(16, 1900, 1800)],
      balloons: [balloon(50, 1200, 1000), balloon(51, 1400, 900), balloon(52, 1600, 1100), balloon(53, 1800, 950)],
    };
    let maxBullets = 0, maxRockets = 0;
    for (let i = 0; i < 4000; i++) {
      // vary steering so headings sweep the full circle (stress the angle wrap)
      const cmd = { ...CMD, rotate: (i % 120 < 60 ? 1 : -1) as -1 | 1 };
      s = tick(s, cmd);
      maxBullets = Math.max(maxBullets, s.bullets.length);
      maxRockets = Math.max(maxRockets, s.rockets.length);
      // sanity: no NaN/Infinity creeping into the player heading (would hang the angle wrap)
      expect(Number.isFinite(s.player.kinematic.heading)).toBe(true);
      for (const e of s.enemies) expect(Number.isFinite(e.kinematic.heading)).toBe(true);
    }
    expect(maxBullets).toBeLessThan(5000);
    expect(maxRockets).toBeLessThan(200);
  });
});
