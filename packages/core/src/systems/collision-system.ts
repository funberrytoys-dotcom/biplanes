import { PILOT_DEATH_DURATION } from '@biplanes/shared';
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
  // Score events from this resolution pass — caller adds these to running totals.
  playerScoreDelta: number;  // enemy pilots killed by player bullets this pass
  enemyScoreDelta: number;   // player pilots killed by enemy bullets this pass
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

    // Check player plane (if bullet not from player)
    if (b.ownerId !== player.id && player.alive) {
      const dx = b.position.x - player.kinematic.position.x;
      const dy = b.position.y - player.kinematic.position.y;
      if (dx * dx + dy * dy < PLANE_HIT_RADIUS * PLANE_HIT_RADIUS) {
        newPlayer = { ...newPlayer, hp: Math.max(0, newPlayer.hp - b.damage) };
        if (newPlayer.hp === 0) newPlayer.alive = false;
        consumed = true;
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
            kills++;
          }
          consumed = true;
          break;
        }
      }
    }

    // Pilot collision — bullets only hurt pilots of the OPPOSITE faction.
    // (No friendly fire on pilots; bullet continues past same-faction pilots.)
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

    if (!consumed) remainingBullets.push(b);
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
