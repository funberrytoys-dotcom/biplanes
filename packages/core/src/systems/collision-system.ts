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
  pilot: Pilot | null;
  kills: number;
}

export function resolveBulletPlaneHits(
  bullets: readonly Bullet[],
  player: Plane,
  enemies: readonly Plane[],
  pilot: Pilot | null = null
): CollisionResult {
  let newPlayer = { ...player };
  const newEnemies = enemies.map(e => ({ ...e }));
  let newPilot: Pilot | null = pilot ? { ...pilot } : null;
  const remainingBullets: Bullet[] = [];
  let kills = 0;

  for (const b of bullets) {
    let consumed = false;

    // Check player (if bullet not from player)
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

    // Pilot collision — bullets from anybody (including stray friendly fire) kill an
    // ejected pilot. Only vulnerable while parachuting or walking.
    if (!consumed && newPilot && (newPilot.state === 'parachute' || newPilot.state === 'walking')) {
      const dx = b.position.x - newPilot.position.x;
      const dy = b.position.y - newPilot.position.y;
      if (dx * dx + dy * dy < PILOT_HIT_RADIUS * PILOT_HIT_RADIUS) {
        newPilot = {
          ...newPilot,
          hp: 0,
          state: 'dead',
          deathTimer: PILOT_DEATH_DURATION,
          velocity: { x: 0, y: 0 },
        };
        consumed = true;
      }
    }

    if (!consumed) remainingBullets.push(b);
  }

  return { bullets: remainingBullets, player: newPlayer, enemies: newEnemies, pilot: newPilot, kills };
}
