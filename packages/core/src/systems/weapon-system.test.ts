import { describe, it, expect } from 'vitest';
import { firePlayerWeapon, stepBullets, makeBulletFromPlane } from './weapon-system.js';
import type { Plane } from '../entities/plane.js';
import { TICK_DT, BULLET_SPEED, HEAVY_CANNON_PIERCE, HEAVY_CANNON_COOLDOWN } from '@biplanes/shared';

function makePlayer(): Plane {
  return {
    id: 1,
    faction: 'player',
    kinematic: {
      position: { x: 500, y: 500 },
      velocity: { x: 0, y: 0 },
      heading: 0,
      throttleOn: true,
      g: 1200, facing: 1, throttle: true, throttleLevel: 1,
    },
    hp: 100,
    maxHp: 100,
    weaponCooldown: 0,
    alive: true,
    state: 'flying',
    respawnTimer: 0,
  };
}

describe('weapon-system', () => {
  it('firePlayerWeapon emits a bullet when cooldown is zero and fire is true', () => {
    const p = makePlayer();
    const result = firePlayerWeapon(p, true, 999);
    expect(result.bullets.length).toBe(1);
    expect(result.newCooldown).toBeGreaterThan(0);
  });

  it('firePlayerWeapon emits nothing when cooldown > 0', () => {
    const p = { ...makePlayer(), weaponCooldown: 0.1 };
    const result = firePlayerWeapon(p, true, 999);
    expect(result.bullets.length).toBe(0);
  });

  it('firePlayerWeapon emits nothing when fire is false', () => {
    const p = makePlayer();
    const result = firePlayerWeapon(p, false, 999);
    expect(result.bullets.length).toBe(0);
  });

  it('bullet inherits plane heading as velocity direction', () => {
    const p = makePlayer();
    const result = firePlayerWeapon(p, true, 999);
    expect(result.bullets[0]!.velocity.x).toBeCloseTo(BULLET_SPEED);
    expect(result.bullets[0]!.velocity.y).toBeCloseTo(0);
  });

  it('multishot fires a symmetric fan of extra bullets', () => {
    const p = makePlayer();
    const result = firePlayerWeapon(p, true, 999, 1, 1, false, false, 2);
    expect(result.bullets.length).toBe(3);
    // Middle bullet stays on heading; outer two fan up and down.
    const ys = result.bullets.map(b => b.velocity.y).sort((a, b) => a - b);
    expect(ys[0]).toBeLessThan(0);
    expect(ys[2]).toBeGreaterThan(0);
  });

  it('stepBullets advances bullet position and decreases lifetime', () => {
    const b = makeBulletFromPlane(makePlayer(), 999);
    const [stepped] = stepBullets([b]);
    expect(stepped!.position.x).toBeGreaterThan(b.position.x);
    expect(stepped!.lifetime).toBeLessThan(b.lifetime);
  });

  it('stepBullets removes dead bullets', () => {
    const b = { ...makeBulletFromPlane(makePlayer(), 999), lifetime: TICK_DT / 2 };
    const stepped = stepBullets([b]);
    expect(stepped).toEqual([]);
  });

  it('bullets bleed speed (drag) and arc downward (gravity)', () => {
    // Horizontal shot: starts with vy≈0 and full horizontal speed.
    const b = makeBulletFromPlane(makePlayer(), 999);
    const [stepped] = stepBullets([b]);
    // Gravity pulls it down → vy becomes positive.
    expect(stepped!.velocity.y).toBeGreaterThan(b.velocity.y);
    // Drag bleeds horizontal speed → vx shrinks.
    expect(stepped!.velocity.x).toBeLessThan(b.velocity.x);
  });
});

describe('weapon-system: multishot fan & heavy cannon', () => {
  it('multishotExtra = N yields 1 + N bullets with distinct sequential ids', () => {
    const p = makePlayer();
    const N = 3;
    const baseId = 7000;
    const result = firePlayerWeapon(p, true, baseId, 1, 1, false, false, N);
    expect(result.bullets.length).toBe(1 + N);
    const ids = result.bullets.map(b => b.id);
    // bulletId + i → distinct, contiguous from baseId.
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([baseId, baseId + 1, baseId + 2, baseId + 3]);
  });

  it('multishot fan offsets are symmetric/mirrored around the nose (sum ~0)', () => {
    const p = makePlayer(); // heading 0 → nose along +x, vy encodes the angle offset
    const N = 4; // even count, no center shot
    const result = firePlayerWeapon(p, true, 8000, 1, 1, false, false, N);
    const count = 1 + N;
    expect(result.bullets.length).toBe(count);
    // The i - (count-1)/2 pattern makes vy values mirror around zero → they cancel.
    const vys = result.bullets.map(b => b.velocity.y);
    const sum = vys.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(0);
    // Sorted vys are mirror-symmetric: outermost pair equal-and-opposite.
    const sorted = [...vys].sort((a, b) => a - b);
    expect(sorted[0]!).toBeCloseTo(-sorted[sorted.length - 1]!);
  });

  it('odd multishot keeps a true center shot on the nose (vy ~0)', () => {
    const p = makePlayer();
    const result = firePlayerWeapon(p, true, 8500, 1, 1, false, false, 2); // count = 3
    const centerVy = result.bullets[1]!.velocity.y;
    expect(centerVy).toBeCloseTo(0);
  });

  it('heavy cannon sets pierceCount to HEAVY_CANNON_PIERCE', () => {
    const p = makePlayer();
    const result = firePlayerWeapon(p, true, 9000, 1, 1, true);
    expect(result.bullets.length).toBe(1);
    expect(result.bullets[0]!.pierceCount).toBe(HEAVY_CANNON_PIERCE);
    expect(result.bullets[0]!.isHeavy).toBe(true);
  });

  it('heavy cannon cooldown is HEAVY_CANNON_COOLDOWN divided by fireRateMultiplier', () => {
    const p = makePlayer();
    const r1 = firePlayerWeapon(p, true, 9100, 1, 1, true);
    expect(r1.newCooldown).toBeCloseTo(HEAVY_CANNON_COOLDOWN);

    const fireRate = 2;
    const r2 = firePlayerWeapon(p, true, 9200, 1, fireRate, true);
    expect(r2.newCooldown).toBeCloseTo(HEAVY_CANNON_COOLDOWN / fireRate);
  });
});
