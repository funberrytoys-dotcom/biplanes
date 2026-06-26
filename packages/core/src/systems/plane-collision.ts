import {
  PLANE_COLLISION_RADIUS,
  COLLISION_DAMAGE_K,
  COLLISION_MAX_HP_FRACTION,
  COLLISION_MIN_DAMAGE,
  COLLISION_COOLDOWN_TICKS,
  COLLISION_BOUNCE_VELOCITY_RETAIN,
  COLLISION_BOUNCE_HEADING_JITTER,
  DYING_DURATION_SEC,
} from '@biplanes/shared';
import type { Plane } from '../entities/plane.js';

export interface PlaneCollisionEvent {
  posX: number;
  posY: number;
  aFaction: 'player' | 'enemy';
  bFaction: 'player' | 'enemy';
  aDied: boolean;
  bDied: boolean;
}

function keyFor(a: number, b: number) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

// Deterministic jitter helper using a passed seed (NOT Math.random).
function jitter(seed: number) {
  const t = Math.sin(seed * 12.9898) * 43758.5453;
  return t - Math.floor(t);
}

export function resolvePlanePlaneCollisions(
  player: Plane,
  enemies: readonly Plane[],
  cooldowns: Map<string, number>,
  rngSeed: number,
  playerDamageMultiplier: number = 1,
): { player: Plane; enemies: Plane[]; events: PlaneCollisionEvent[]; newCooldowns: Map<string, number> } {
  // Decrement cooldowns from previous tick
  const newCooldowns = new Map(cooldowns);
  for (const [k, v] of newCooldowns) {
    if (v <= 1) newCooldowns.delete(k);
    else newCooldowns.set(k, v - 1);
  }

  const events: PlaneCollisionEvent[] = [];

  // Clone all planes so we don't mutate inputs
  const p: Plane = {
    ...player,
    kinematic: {
      ...player.kinematic,
      velocity: { ...player.kinematic.velocity },
      position: { ...player.kinematic.position },
    },
  };
  const out: Plane[] = enemies.map(e => ({
    ...e,
    kinematic: {
      ...e.kinematic,
      velocity: { ...e.kinematic.velocity },
      position: { ...e.kinematic.position },
    },
  }));

  const allPlanes = [p, ...out];

  for (let i = 0; i < allPlanes.length; i++) {
    for (let j = i + 1; j < allPlanes.length; j++) {
      const A = allPlanes[i]!;
      const B = allPlanes[j]!;
      if (A.state !== 'flying' || B.state !== 'flying') continue;
      if (!A.alive || !B.alive) continue;

      const dx = B.kinematic.position.x - A.kinematic.position.x;
      const dy = B.kinematic.position.y - A.kinematic.position.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > PLANE_COLLISION_RADIUS * PLANE_COLLISION_RADIUS) continue;

      const key = keyFor(A.id, B.id);
      if (newCooldowns.has(key)) continue;

      // Relative velocity along line of centers (closing speed)
      const rvx = A.kinematic.velocity.x - B.kinematic.velocity.x;
      const rvy = A.kinematic.velocity.y - B.kinematic.velocity.y;
      const distMag = Math.max(1, Math.sqrt(distSq));
      let nx = dx / distMag, ny = dy / distMag;
      if (distSq < 0.0001) {
        const rvMag = Math.hypot(rvx, rvy);
        if (rvMag > 0.0001) {
          nx = -rvx / rvMag;
          ny = -rvy / rvMag;
        } else {
          nx = Math.cos(A.kinematic.heading);
          ny = Math.sin(A.kinematic.heading);
        }
      }
      const closingSpeed = rvx * nx + rvy * ny;
      const impact = Math.max(0, closingSpeed);
      // Per-plane damage scales with closing speed but is CAPPED at a fraction of THAT
      // plane's own maxHp — so a collision is a real bite (and a hard ram costs a fragile
      // enemy most of its life) but can never one-shot the player in this one-life mode.
      const raw = impact * COLLISION_DAMAGE_K;
      const dmgA = Math.min(A.maxHp * COLLISION_MAX_HP_FRACTION, Math.max(COLLISION_MIN_DAMAGE, raw));
      const dmgB = Math.min(B.maxHp * COLLISION_MAX_HP_FRACTION, Math.max(COLLISION_MIN_DAMAGE, raw));

      const damageToA = dmgA * (A.faction === 'player' ? playerDamageMultiplier : 1) * (A.incomingDamageMultiplier ?? 1);
      const damageToB = dmgB * (B.faction === 'player' ? playerDamageMultiplier : 1) * (B.incomingDamageMultiplier ?? 1);
      A.hp = Math.max(0, A.hp - damageToA);
      B.hp = Math.max(0, B.hp - damageToB);

      const aDied = A.hp === 0;
      const bDied = B.hp === 0;
      if (aDied) {
        A.alive = false;
        A.state = 'dying';
        A.dyingTimer = DYING_DURATION_SEC;
      }
      if (bDied) {
        B.alive = false;
        B.state = 'dying';
        B.dyingTimer = DYING_DURATION_SEC;
      }

      // Velocity dampening (bounce)
      A.kinematic.velocity.x *= COLLISION_BOUNCE_VELOCITY_RETAIN;
      A.kinematic.velocity.y *= COLLISION_BOUNCE_VELOCITY_RETAIN;
      B.kinematic.velocity.x *= COLLISION_BOUNCE_VELOCITY_RETAIN;
      B.kinematic.velocity.y *= COLLISION_BOUNCE_VELOCITY_RETAIN;
      A.kinematic.heading += (jitter(rngSeed + A.id) - 0.5) * 2 * COLLISION_BOUNCE_HEADING_JITTER;
      B.kinematic.heading += (jitter(rngSeed + B.id) - 0.5) * 2 * COLLISION_BOUNCE_HEADING_JITTER;

      // A ram is an impulse, not a sticky overlap. Without positional separation two
      // planes can stay interpenetrating for the cooldown window and the player can
      // appear frozen on the stall edge while trying to finish an enemy.
      const separation = Math.max(0, PLANE_COLLISION_RADIUS - Math.sqrt(distSq));
      if (separation > 0) {
        const push = separation / 2 + 0.5;
        A.kinematic.position.x -= nx * push;
        A.kinematic.position.y -= ny * push;
        B.kinematic.position.x += nx * push;
        B.kinematic.position.y += ny * push;
      }

      newCooldowns.set(key, COLLISION_COOLDOWN_TICKS);

      events.push({
        posX: (A.kinematic.position.x + B.kinematic.position.x) / 2,
        posY: (A.kinematic.position.y + B.kinematic.position.y) / 2,
        aFaction: A.faction,
        bFaction: B.faction,
        aDied,
        bDied,
      });
    }
  }

  return {
    player: allPlanes[0]!,
    enemies: allPlanes.slice(1),
    events,
    newCooldowns,
  };
}
