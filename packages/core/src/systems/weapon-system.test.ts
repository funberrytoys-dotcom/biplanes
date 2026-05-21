import { describe, it, expect } from 'vitest';
import { firePlayerWeapon, stepBullets, makeBulletFromPlane } from './weapon-system.js';
import type { Plane } from '../entities/plane.js';
import { TICK_DT, BULLET_SPEED } from '@biplanes/shared';

function makePlayer(): Plane {
  return {
    id: 1,
    faction: 'player',
    kinematic: {
      position: { x: 500, y: 500 },
      velocity: { x: 0, y: 0 },
      heading: 0,
      throttleOn: true,
      g: 1200, facing: 1, throttle: true,
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
    expect(result.bullet).toBeDefined();
    expect(result.newCooldown).toBeGreaterThan(0);
  });

  it('firePlayerWeapon emits nothing when cooldown > 0', () => {
    const p = { ...makePlayer(), weaponCooldown: 0.1 };
    const result = firePlayerWeapon(p, true, 999);
    expect(result.bullet).toBeUndefined();
  });

  it('firePlayerWeapon emits nothing when fire is false', () => {
    const p = makePlayer();
    const result = firePlayerWeapon(p, false, 999);
    expect(result.bullet).toBeUndefined();
  });

  it('bullet inherits plane heading as velocity direction', () => {
    const p = makePlayer();
    const result = firePlayerWeapon(p, true, 999);
    expect(result.bullet!.velocity.x).toBeCloseTo(BULLET_SPEED);
    expect(result.bullet!.velocity.y).toBeCloseTo(0);
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
});
