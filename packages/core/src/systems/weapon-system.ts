import {
  TICK_DT,
  BULLET_SPEED,
  BULLET_LIFETIME,
  MACHINE_GUN_COOLDOWN,
  MACHINE_GUN_DAMAGE,
  type EntityId,
} from '@biplanes/shared';
import type { Plane } from '../entities/plane.js';
import type { Bullet } from '../entities/bullet.js';

export function makeBulletFromPlane(plane: Plane, id: EntityId): Bullet {
  const cos = Math.cos(plane.kinematic.heading);
  const sin = Math.sin(plane.kinematic.heading);
  // Spawn slightly in front of plane nose
  const offset = 28;
  return {
    id,
    ownerId: plane.id,
    position: {
      x: plane.kinematic.position.x + cos * offset,
      y: plane.kinematic.position.y + sin * offset,
    },
    velocity: {
      x: cos * BULLET_SPEED + plane.kinematic.velocity.x * 0.3,
      y: sin * BULLET_SPEED + plane.kinematic.velocity.y * 0.3,
    },
    lifetime: BULLET_LIFETIME,
    damage: MACHINE_GUN_DAMAGE,
    alive: true,
  };
}

export interface FireResult {
  bullet?: Bullet;
  newCooldown: number;
}

export function firePlayerWeapon(
  plane: Plane,
  fireInput: boolean,
  bulletId: EntityId
): FireResult {
  if (!fireInput || plane.weaponCooldown > 0 || !plane.alive) {
    return { newCooldown: plane.weaponCooldown };
  }
  return {
    bullet: makeBulletFromPlane(plane, bulletId),
    newCooldown: MACHINE_GUN_COOLDOWN,
  };
}

export function stepBullets(bullets: readonly Bullet[]): Bullet[] {
  const out: Bullet[] = [];
  for (const b of bullets) {
    const newLifetime = b.lifetime - TICK_DT;
    if (newLifetime <= 0) continue;
    out.push({
      ...b,
      position: {
        x: b.position.x + b.velocity.x * TICK_DT,
        y: b.position.y + b.velocity.y * TICK_DT,
      },
      lifetime: newLifetime,
    });
  }
  return out;
}
