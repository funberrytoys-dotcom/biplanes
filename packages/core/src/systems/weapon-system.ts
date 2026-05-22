import {
  TICK_DT,
  BULLET_SPEED,
  BULLET_LIFETIME,
  MACHINE_GUN_COOLDOWN,
  MACHINE_GUN_DAMAGE,
  HEAVY_CANNON_COOLDOWN,
  HEAVY_CANNON_DAMAGE,
  HEAVY_CANNON_PIERCE,
  type EntityId,
} from '@biplanes/shared';
import type { Plane } from '../entities/plane.js';
import type { Bullet } from '../entities/bullet.js';

export function makeBulletFromPlane(
  plane: Plane,
  id: EntityId,
  isHeavy: boolean = false,
  pierceCount: number = 0
): Bullet {
  const cos = Math.cos(plane.kinematic.heading);
  const sin = Math.sin(plane.kinematic.heading);
  // Spawn slightly in front of plane nose
  const offset = 28;
  return {
    id,
    ownerId: plane.id,
    ownerFaction: plane.faction,
    position: {
      x: plane.kinematic.position.x + cos * offset,
      y: plane.kinematic.position.y + sin * offset,
    },
    velocity: {
      x: cos * BULLET_SPEED + plane.kinematic.velocity.x * 0.3,
      y: sin * BULLET_SPEED + plane.kinematic.velocity.y * 0.3,
    },
    lifetime: BULLET_LIFETIME,
    damage: isHeavy ? HEAVY_CANNON_DAMAGE : MACHINE_GUN_DAMAGE,
    alive: true,
    isHeavy,
    pierceCount,
  };
}

export interface FireResult {
  bullet?: Bullet;
  newCooldown: number;
}

export function firePlayerWeapon(
  plane: Plane,
  fireInput: boolean,
  bulletId: EntityId,
  damageMultiplier: number = 1,
  fireRateMultiplier: number = 1,
  hasHeavyCannon: boolean = false,
  hasPiercing: boolean = false
): FireResult {
  if (!fireInput || plane.weaponCooldown > 0 || !plane.alive) {
    return { newCooldown: plane.weaponCooldown };
  }

  const isHeavy = hasHeavyCannon;
  const pierceCount = isHeavy ? HEAVY_CANNON_PIERCE : (hasPiercing ? 1 : 0);

  const bullet = makeBulletFromPlane(plane, bulletId, isHeavy, pierceCount);
  bullet.damage = bullet.damage * damageMultiplier;

  const baseCooldown = isHeavy ? HEAVY_CANNON_COOLDOWN : MACHINE_GUN_COOLDOWN;

  return {
    bullet,
    newCooldown: baseCooldown / fireRateMultiplier,
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
