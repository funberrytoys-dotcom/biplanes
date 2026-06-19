import { describe, it, expect } from 'vitest';
import { tick } from './tick.js';
import { createWorldState } from './world-state.js';
import type { Plane } from '../entities/plane.js';
import type { Bullet } from '../entities/bullet.js';
import type { SupplyBalloon } from '../entities/pickup.js';
import { MAG_SIZE, SUPPLY_BALLOON_HP } from '@biplanes/shared';

function player(): Plane {
  return {
    id: 1, faction: 'player',
    kinematic: { position: { x: 600, y: 500 }, velocity: { x: 600, y: 0 }, heading: 0, throttleOn: true, g: 600, facing: 1, throttle: true, throttleLevel: 1 },
    hp: 100, maxHp: 100, weaponCooldown: 0, alive: true, state: 'flying', respawnTimer: 0, ammo: 40,
  };
}
const NO_CMD = { rotate: 0 as const, fire: false, bomb: false, throttleDelta: 0 as const, eject: false, jump: false };

describe('supply balloons through the real tick', () => {
  it('a player bullet pops a balloon and drops pickups (wired through tick)', () => {
    let s = createWorldState(123, player());
    // balloon far from the player, so the dropped pickups aren't instantly grabbed
    const balloon: SupplyBalloon = { id: 50, position: { x: 1400, y: 300 }, velocity: { x: 0, y: 0 }, bobPhase: 0, hp: 1, alive: true };
    const bullet: Bullet = { id: 60, ownerId: 1, ownerFaction: 'player', position: { x: 1400, y: 300 }, velocity: { x: 0, y: 0 }, lifetime: 1, damage: 10, alive: true };
    s.balloons = [balloon];
    s.bullets = [bullet];

    s = tick(s, NO_CMD);

    expect(s.balloons.length).toBe(0);            // popped
    expect(s.balloonPopEvents.length).toBe(1);    // VFX event emitted
    expect(s.pickups.length).toBeGreaterThanOrEqual(1); // dropped items float free
  });

  it('a balloon survives a single hit when it has 2 HP', () => {
    let s = createWorldState(1, player());
    s.balloons = [{ id: 50, position: { x: 640, y: 500 }, velocity: { x: 0, y: 0 }, bobPhase: 0, hp: SUPPLY_BALLOON_HP, alive: true }];
    s.bullets = [{ id: 60, ownerId: 1, ownerFaction: 'player', position: { x: 640, y: 500 }, velocity: { x: 0, y: 0 }, lifetime: 1, damage: 10, alive: true }];
    s = tick(s, NO_CMD);
    expect(s.balloons.length).toBe(1);
    expect(s.balloons[0]!.hp).toBe(SUPPLY_BALLOON_HP - 1);
  });

  it('flying over an ammo pickup collects it and refills the magazine', () => {
    let s = createWorldState(7, { ...player(), ammo: 3 });
    // pickup right on the player
    s.pickups = [{ id: 70, position: { x: 600, y: 500 }, velocity: { x: 0, y: 0 }, kind: 'ammo', lifetime: 8, bobPhase: 0, collected: false }];
    s = tick(s, NO_CMD);
    expect(s.player.ammo).toBe(MAG_SIZE);
    expect(s.pickups.length).toBe(0);
    expect(s.pickupCollectEvents.length).toBe(1);
    expect(s.pickupCollectEvents[0]!.kind).toBe('ammo');
  });

  it('a rapidfire pickup speeds up the gun (more bullets fired in a window)', () => {
    function fireFor(seconds: number, withRapid: boolean): number {
      let s = createWorldState(7, { ...player(), ammo: MAG_SIZE });
      if (withRapid) s.rapidFireSec = seconds + 1;
      let fired = 0;
      let prevAmmo = s.player.ammo ?? MAG_SIZE;
      for (let i = 0; i < Math.round(seconds * 60); i++) {
        s = tick(s, { ...NO_CMD, fire: true });
        const a = s.player.ammo ?? MAG_SIZE;
        if (a < prevAmmo) fired += prevAmmo - a;
        prevAmmo = a;
      }
      return fired;
    }
    const normal = fireFor(1, false);
    const rapid = fireFor(1, true);
    expect(rapid).toBeGreaterThan(normal);
  });

  it('does not leak balloons/pickups into a fresh non-arena world', () => {
    let s = createWorldState(1, player());
    s = tick(s, NO_CMD);
    expect(s.balloons).toEqual([]);
    expect(s.pickups).toEqual([]);
    expect(s.balloonPopEvents).toEqual([]);
  });
});
