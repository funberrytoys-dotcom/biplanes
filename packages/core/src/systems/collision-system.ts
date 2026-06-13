import {
  PILOT_DEATH_DURATION,
  DYING_DURATION_SEC,
  type Vec2,
} from '@biplanes/shared';
import type { Plane } from '../entities/plane.js';
import type { Bullet } from '../entities/bullet.js';
import type { Pilot } from '../entities/pilot.js';

const PLANE_HIT_RADIUS = 22;
const PILOT_HIT_RADIUS = 14;

export interface CollisionResult {
  bullets: Bullet[];
  player: Plane;
  enemies: Plane[];
  pilots: Pilot[];
  kills: number;
  // Score events from this resolution pass
  playerScoreDelta: number;  // enemy pilots killed by player bullets/explosions
  enemyScoreDelta: number;   // player pilots killed by enemy bullets/explosions
}

export function resolveBulletPlaneHits(
  bullets: readonly Bullet[],
  player: Plane,
  enemies: readonly Plane[],
  pilots: readonly Pilot[] = [],
): CollisionResult {
  let newPlayer = { ...player };
  const newEnemies = enemies.map(e => ({ ...e }));
  const newPilots: Pilot[] = pilots.map(p => ({ ...p }));
  const remainingBullets: Bullet[] = [];
  let kills = 0;
  let playerScoreDelta = 0;
  let enemyScoreDelta = 0;

  for (const b of bullets) {
    let consumed = false;
    let bulletPierceLeft = b.pierceCount ?? 0;

    // Check player plane (if bullet not from player)
    if (b.ownerId !== player.id && player.alive) {
      const dx = b.position.x - player.kinematic.position.x;
      const dy = b.position.y - player.kinematic.position.y;
      if (dx * dx + dy * dy < PLANE_HIT_RADIUS * PLANE_HIT_RADIUS) {
        newPlayer = { ...newPlayer, hp: Math.max(0, newPlayer.hp - b.damage) };
        if (newPlayer.hp === 0) {
          newPlayer.alive = false;
          newPlayer.state = 'dying';
          newPlayer.dyingTimer = DYING_DURATION_SEC;
        }

        if (bulletPierceLeft > 0) {
          bulletPierceLeft--;
        } else {
          consumed = true;
        }
      }
    }

    if (!consumed) {
      for (const e of newEnemies) {
        if (e.id === b.ownerId || !e.alive) continue;
        const dx = b.position.x - e.kinematic.position.x;
        const dy = b.position.y - e.kinematic.position.y;
        if (dx * dx + dy * dy < PLANE_HIT_RADIUS * PLANE_HIT_RADIUS) {
          e.hp = Math.max(0, e.hp - b.damage);
          if (e.hp === 0 && e.alive) {
            e.alive = false;
            e.state = 'dying';
            e.dyingTimer = DYING_DURATION_SEC;
            kills++;
          }

          if (bulletPierceLeft > 0) {
            bulletPierceLeft--;
          } else {
            consumed = true;
            break;
          }
        }
      }
    }

    // Pilot collision — bullets only hurt pilots of the OPPOSITE faction.
    if (!consumed) {
      for (const pilot of newPilots) {
        if (pilot.state !== 'parachute' && pilot.state !== 'walking') continue;
        if (pilot.faction === b.ownerFaction) continue; // friendly fire skip
        const dx = b.position.x - pilot.position.x;
        const dy = b.position.y - pilot.position.y;
        if (dx * dx + dy * dy < PILOT_HIT_RADIUS * PILOT_HIT_RADIUS) {
          pilot.hp = 0;
          pilot.state = 'dead';
          pilot.deathTimer = PILOT_DEATH_DURATION;
          pilot.velocity = { x: 0, y: 0 };
          if (b.ownerFaction === 'player') playerScoreDelta++;
          else enemyScoreDelta++;
          consumed = true;
          break;
        }
      }
    }

    if (!consumed) {
      remainingBullets.push({
        ...b,
        pierceCount: bulletPierceLeft,
      });
    }
  }

  return {
    bullets: remainingBullets,
    player: newPlayer,
    enemies: newEnemies,
    pilots: newPilots,
    kills,
    playerScoreDelta,
    enemyScoreDelta,
  };
}

export interface ExplodeResult {
  player: Plane;
  enemies: Plane[];
  pilots: Pilot[];
  playerScoreDelta: number;
  enemyScoreDelta: number;
  kills: number;
}

export function applyExplosionDamage(
  pos: Vec2,
  radius: number,
  maxDamage: number,
  ownerFaction: 'player' | 'enemy',
  player: Plane,
  enemies: readonly Plane[],
  pilots: readonly Pilot[]
): ExplodeResult {
  let newPlayer = { ...player };
  const newEnemies = enemies.map(e => ({ ...e }));
  const newPilots = pilots.map(p => ({ ...p }));
  let playerScoreDelta = 0;
  let enemyScoreDelta = 0;
  let kills = 0;

  // Damage player plane
  if (player.alive) {
    const dx = player.kinematic.position.x - pos.x;
    const dy = player.kinematic.position.y - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < radius) {
      const damage = maxDamage * (1 - dist / radius);
      newPlayer.hp = Math.max(0, newPlayer.hp - damage);
      if (newPlayer.hp === 0) {
        newPlayer.alive = false;
        newPlayer.state = 'dying';
        newPlayer.dyingTimer = DYING_DURATION_SEC;
      }
    }
  }

  // Damage enemy planes
  for (const e of newEnemies) {
    if (!e.alive) continue;
    const dx = e.kinematic.position.x - pos.x;
    const dy = e.kinematic.position.y - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < radius) {
      const damage = maxDamage * (1 - dist / radius);
      e.hp = Math.max(0, e.hp - damage);
      if (e.hp === 0 && e.alive) {
        e.alive = false;
        e.state = 'dying';
        e.dyingTimer = DYING_DURATION_SEC;
        kills++;
      }
    }
  }

  // Kill pilots
  for (const pilot of newPilots) {
    if (pilot.state !== 'parachute' && pilot.state !== 'walking') continue;
    const dx = pilot.position.x - pos.x;
    const dy = pilot.position.y - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < radius) {
      pilot.hp = 0;
      pilot.state = 'dead';
      pilot.deathTimer = PILOT_DEATH_DURATION;
      pilot.velocity = { x: 0, y: 0 };
      if (ownerFaction === 'player') playerScoreDelta++;
      else enemyScoreDelta++;
    }
  }

  return {
    player: newPlayer,
    enemies: newEnemies,
    pilots: newPilots,
    playerScoreDelta,
    enemyScoreDelta,
    kills,
  };
}
