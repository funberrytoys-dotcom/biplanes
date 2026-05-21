import { describe, it, expect } from 'vitest';
import { resolveBulletPlaneHits } from './collision-system.js';
import type { Plane } from '../entities/plane.js';
import type { Bullet } from '../entities/bullet.js';

function makePlane(id: number, x: number, y: number, faction: 'player' | 'enemy', hp = 30): Plane {
  return {
    id, faction,
    kinematic: {
      position: { x, y }, velocity: { x: 0, y: 0 },
      heading: 0, throttleOn: true,
      g: 1200, facing: 1, throttle: true,
    },
    hp, maxHp: hp,
    weaponCooldown: 0, alive: true,
  };
}

function makeBullet(id: number, x: number, y: number, ownerId: number, damage = 10): Bullet {
  return {
    id, ownerId,
    position: { x, y }, velocity: { x: 100, y: 0 },
    lifetime: 1.0, damage, alive: true,
  };
}

describe('collision-system', () => {
  it('bullet from player hits enemy and deals damage', () => {
    const player = makePlane(1, 500, 500, 'player');
    const enemy = makePlane(2, 510, 500, 'enemy', 30);
    const bullet = makeBullet(99, 510, 500, 1, 10);

    const result = resolveBulletPlaneHits([bullet], player, [enemy]);
    expect(result.enemies[0]!.hp).toBe(20);
    expect(result.bullets).toHaveLength(0);
    expect(result.kills).toBe(0);
  });

  it('bullet from enemy hits player and deals damage', () => {
    const player = makePlane(1, 500, 500, 'player', 100);
    const enemy = makePlane(2, 800, 500, 'enemy');
    const bullet = makeBullet(99, 505, 500, 2, 15);

    const result = resolveBulletPlaneHits([bullet], player, [enemy]);
    expect(result.player.hp).toBe(85);
    expect(result.bullets).toHaveLength(0);
  });

  it('bullet does not hit its owner', () => {
    const player = makePlane(1, 500, 500, 'player', 100);
    const enemy = makePlane(2, 800, 500, 'enemy');
    const bullet = makeBullet(99, 500, 500, 1, 10); // owned by player, at player

    const result = resolveBulletPlaneHits([bullet], player, [enemy]);
    expect(result.player.hp).toBe(100);
    expect(result.bullets).toHaveLength(1);
  });

  it('kill is counted when hp drops to 0', () => {
    const player = makePlane(1, 500, 500, 'player');
    const enemy = makePlane(2, 510, 500, 'enemy', 5);
    const bullet = makeBullet(99, 510, 500, 1, 10);

    const result = resolveBulletPlaneHits([bullet], player, [enemy]);
    expect(result.enemies[0]!.alive).toBe(false);
    expect(result.enemies[0]!.hp).toBe(0);
    expect(result.kills).toBe(1);
  });

  it('bullet far from any plane passes through', () => {
    const player = makePlane(1, 500, 500, 'player', 100);
    const enemy = makePlane(2, 1000, 1000, 'enemy');
    const bullet = makeBullet(99, 0, 0, 99, 10);

    const result = resolveBulletPlaneHits([bullet], player, [enemy]);
    expect(result.bullets).toHaveLength(1);
    expect(result.player.hp).toBe(100);
    expect(result.enemies[0]!.hp).toBe(30);
  });
});
