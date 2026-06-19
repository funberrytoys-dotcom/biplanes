import { describe, it, expect } from 'vitest';
import {
  stepSupplyBalloons,
  resolveBulletBalloonHits,
  stepPickups,
  resolvePlayerPickups,
} from './supply-system.js';
import type { SupplyBalloon, Pickup } from '../entities/pickup.js';
import type { Bullet } from '../entities/bullet.js';
import type { Plane } from '../entities/plane.js';
import {
  SUPPLY_BALLOON_HP,
  PICKUP_LIFETIME,
  MAG_SIZE,
  PICKUP_REPAIR_FRACTION,
  RAPIDFIRE_DURATION_SEC,
  WORLD_WIDTH,
  WORLD_HEIGHT,
} from '@biplanes/shared';

function balloon(over: Partial<SupplyBalloon> = {}): SupplyBalloon {
  return { id: 100, position: { x: 500, y: 300 }, velocity: { x: 20, y: 0 }, bobPhase: 0, hp: SUPPLY_BALLOON_HP, alive: true, ...over };
}
function bullet(over: Partial<Bullet> = {}): Bullet {
  return { id: 1, ownerId: 1, ownerFaction: 'player', position: { x: 500, y: 300 }, velocity: { x: 0, y: 0 }, lifetime: 1, damage: 10, alive: true, ...over };
}
function flyingPlayer(over: Partial<Plane> = {}): Plane {
  return {
    id: 1, faction: 'player',
    kinematic: { position: { x: 500, y: 300 }, velocity: { x: 0, y: 0 }, heading: 0, throttleOn: true, g: 600, facing: 1, throttle: true, throttleLevel: 1 },
    hp: 50, maxHp: 100, weaponCooldown: 0, alive: true, state: 'flying', respawnTimer: 0, ammo: 3, ...over,
  };
}

describe('supply-system', () => {
  it('drifts balloons and wraps around the world', () => {
    const [b] = stepSupplyBalloons([balloon({ position: { x: WORLD_WIDTH - 1, y: 200 }, velocity: { x: 600, y: 0 } })], 0.1, WORLD_WIDTH);
    expect(b!.position.x).toBeLessThan(WORLD_WIDTH); // wrapped to the left
  });

  it('a player bullet hitting a balloon chips its HP, not popping until 0', () => {
    const r = resolveBulletBalloonHits([bullet()], [balloon({ hp: 2 })], 1, 200);
    expect(r.balloons[0]!.hp).toBe(1);
    expect(r.balloons[0]!.alive).toBe(true);
    expect(r.newPickups.length).toBe(0);
    expect(r.bullets.length).toBe(0); // bullet consumed
  });

  it('popping a balloon drops 1-3 pickups and emits a pop event', () => {
    const r = resolveBulletBalloonHits([bullet()], [balloon({ hp: 1 })], 42, 200);
    expect(r.balloons.length).toBe(0);
    expect(r.popEvents.length).toBe(1);
    expect(r.newPickups.length).toBeGreaterThanOrEqual(1);
    expect(r.newPickups.length).toBeLessThanOrEqual(3);
    for (const p of r.newPickups) expect(['ammo', 'repair', 'rapidfire']).toContain(p.kind);
  });

  it('is deterministic for the same seed', () => {
    const a = resolveBulletBalloonHits([bullet()], [balloon({ hp: 1 })], 777, 200);
    const b = resolveBulletBalloonHits([bullet()], [balloon({ hp: 1 })], 777, 200);
    expect(a.newPickups.map(p => p.kind)).toEqual(b.newPickups.map(p => p.kind));
  });

  it('enemy bullets never pop balloons', () => {
    const r = resolveBulletBalloonHits([bullet({ ownerFaction: 'enemy' })], [balloon({ hp: 1 })], 1, 200);
    expect(r.balloons.length).toBe(1);
    expect(r.bullets.length).toBe(1); // passes through
  });

  it('pickups fall and despawn when their lifetime runs out', () => {
    const p: Pickup = { id: 5, position: { x: 500, y: 200 }, velocity: { x: 0, y: 0 }, kind: 'ammo', lifetime: 0.01, bobPhase: 0, collected: false };
    expect(stepPickups([p], 0.1, WORLD_HEIGHT).length).toBe(0);
  });

  it('ammo pickup refills the magazine and clears reload', () => {
    const player = flyingPlayer({ ammo: 0, reloadTimer: 5 });
    const p: Pickup = { id: 5, position: { x: 500, y: 300 }, velocity: { x: 0, y: 0 }, kind: 'ammo', lifetime: PICKUP_LIFETIME, bobPhase: 0, collected: false };
    const r = resolvePlayerPickups(player, [p], 0);
    expect(r.player.ammo).toBe(MAG_SIZE);
    expect(r.player.reloadTimer).toBe(0);
    expect(r.pickups.length).toBe(0);
    expect(r.collectEvents[0]!.kind).toBe('ammo');
  });

  it('repair pickup heals, capped at max HP', () => {
    const player = flyingPlayer({ hp: 50, maxHp: 100 });
    const p: Pickup = { id: 5, position: { x: 500, y: 300 }, velocity: { x: 0, y: 0 }, kind: 'repair', lifetime: PICKUP_LIFETIME, bobPhase: 0, collected: false };
    const r = resolvePlayerPickups(player, [p], 0);
    expect(r.player.hp).toBeCloseTo(50 + 100 * PICKUP_REPAIR_FRACTION);
  });

  it('rapidfire pickup starts the rapid-fire window', () => {
    const p: Pickup = { id: 5, position: { x: 500, y: 300 }, velocity: { x: 0, y: 0 }, kind: 'rapidfire', lifetime: PICKUP_LIFETIME, bobPhase: 0, collected: false };
    const r = resolvePlayerPickups(flyingPlayer(), [p], 0);
    expect(r.rapidFireSec).toBe(RAPIDFIRE_DURATION_SEC);
  });

  it('does not collect when the player is not flying', () => {
    const player = flyingPlayer({ state: 'crashed', alive: false });
    const p: Pickup = { id: 5, position: { x: 500, y: 300 }, velocity: { x: 0, y: 0 }, kind: 'ammo', lifetime: PICKUP_LIFETIME, bobPhase: 0, collected: false };
    const r = resolvePlayerPickups(player, [p], 0);
    expect(r.pickups.length).toBe(1);
    expect(r.collectEvents.length).toBe(0);
  });

  it('only collects pickups within range', () => {
    const far: Pickup = { id: 5, position: { x: 5000, y: 300 }, velocity: { x: 0, y: 0 }, kind: 'ammo', lifetime: PICKUP_LIFETIME, bobPhase: 0, collected: false };
    const r = resolvePlayerPickups(flyingPlayer(), [far], 0);
    expect(r.pickups.length).toBe(1);
  });
});
