import {
  TICK_DT,
  BULLET_SPEED,
  BULLET_LIFETIME,
  BULLET_DRAG,
  BULLET_GRAVITY,
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
  pierceCount: number = 0,
  angleOffset: number = 0,
): Bullet {
  const heading = plane.kinematic.heading + angleOffset;
  const cos = Math.cos(heading);
  const sin = Math.sin(heading);
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
  bullets: Bullet[];
  newCooldown: number;
}

const MULTISHOT_SPREAD = 0.12; // rad between fanned shots

export function firePlayerWeapon(
  plane: Plane,
  fireInput: boolean,
  bulletId: EntityId,
  damageMultiplier: number = 1,
  fireRateMultiplier: number = 1,
  hasHeavyCannon: boolean = false,
  hasPiercing: boolean = false,
  multishotExtra: number = 0,
): FireResult {
  if (!fireInput || plane.weaponCooldown > 0 || !plane.alive) {
    return { bullets: [], newCooldown: plane.weaponCooldown };
  }

  const isHeavy = hasHeavyCannon;
  const pierceCount = isHeavy ? HEAVY_CANNON_PIERCE : (hasPiercing ? 1 : 0);

  // Multishot fans an odd number of bullets symmetrically around the nose.
  const count = 1 + Math.max(0, multishotExtra);
  const bullets: Bullet[] = [];
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? (i - (count - 1) / 2) : 0;
    const b = makeBulletFromPlane(plane, bulletId + i, isHeavy, pierceCount, t * MULTISHOT_SPREAD);
    b.damage = b.damage * damageMultiplier;
    bullets.push(b);
  }

  const baseCooldown = isHeavy ? HEAVY_CANNON_COOLDOWN : MACHINE_GUN_COOLDOWN;

  return {
    bullets,
    newCooldown: baseCooldown / fireRateMultiplier,
  };
}

export function stepBullets(bullets: readonly Bullet[]): Bullet[] {
  const out: Bullet[] = [];
  const drag = Math.max(0, 1 - BULLET_DRAG * TICK_DT);
  for (const b of bullets) {
    const newLifetime = b.lifetime - TICK_DT;
    if (newLifetime <= 0) continue;
    // Semi-implicit Euler: bleed speed (drag), then arc down (gravity), then move.
    const vx = b.velocity.x * drag;
    const vy = b.velocity.y * drag + BULLET_GRAVITY * (b.gravityScale ?? 1) * TICK_DT;
    out.push({
      ...b,
      position: {
        x: b.position.x + vx * TICK_DT,
        y: b.position.y + vy * TICK_DT,
      },
      velocity: { x: vx, y: vy },
      lifetime: newLifetime,
    });
  }
  return out;
}
