import type { EntityId, Vec2 } from '@biplanes/shared';
import {
  SUPPLY_BALLOON_RADIUS,
  SUPPLY_BALLOON_BOB_SPEED,
  SUPPLY_DROP_MIN,
  SUPPLY_DROP_MAX,
  PICKUP_RADIUS,
  PICKUP_FALL_SPEED,
  PICKUP_GRAVITY,
  PICKUP_LIFETIME,
  PICKUP_BOB_SPEED,
  PICKUP_AMMO_REFILL,
  PICKUP_REPAIR_FRACTION,
  RAPIDFIRE_DURATION_SEC,
} from '@biplanes/shared';
import type { Plane } from '../entities/plane.js';
import type { Bullet } from '../entities/bullet.js';
import type { Pickup, PickupKind, SupplyBalloon } from '../entities/pickup.js';
import { nextRandom } from '../rng/next-random.js';

const PICKUP_KINDS: readonly PickupKind[] = ['ammo', 'repair', 'rapidfire'];

/** Drift balloons horizontally (wrapping the world) and advance their bob phase. */
export function stepSupplyBalloons(
  balloons: readonly SupplyBalloon[],
  dt: number,
  worldWidth: number,
): SupplyBalloon[] {
  return balloons
    .filter(b => b.alive)
    .map(b => {
      let x = b.position.x + b.velocity.x * dt;
      if (x < -SUPPLY_BALLOON_RADIUS) x += worldWidth;
      else if (x > worldWidth + SUPPLY_BALLOON_RADIUS) x -= worldWidth;
      return {
        ...b,
        position: { x, y: b.position.y },
        bobPhase: b.bobPhase + dt * SUPPLY_BALLOON_BOB_SPEED,
      };
    });
}

export interface BalloonHitResult {
  bullets: Bullet[];
  balloons: SupplyBalloon[];
  newPickups: Pickup[];
  popEvents: Vec2[];
  rngState: number;
  nextEntityId: EntityId;
}

/**
 * Player bullets pop balloons (enemy fire ignores them). A balloon at 0 HP pops,
 * emits a pop event, and drops SUPPLY_DROP_MIN..MAX floating pickups of random
 * kinds — all chosen via the seeded RNG so the run stays reproducible.
 */
export function resolveBulletBalloonHits(
  bullets: readonly Bullet[],
  balloons: readonly SupplyBalloon[],
  rngState: number,
  nextEntityId: EntityId,
): BalloonHitResult {
  const working = balloons.map(b => ({ ...b }));
  const remainingBullets: Bullet[] = [];
  const newPickups: Pickup[] = [];
  const popEvents: Vec2[] = [];
  let rng = rngState;
  let nid = nextEntityId;

  for (const bullet of bullets) {
    if (bullet.ownerFaction !== 'player') {
      remainingBullets.push(bullet);
      continue;
    }
    let consumed = false;
    for (const b of working) {
      if (!b.alive) continue;
      const dx = bullet.position.x - b.position.x;
      const dy = bullet.position.y - b.position.y;
      if (dx * dx + dy * dy >= SUPPLY_BALLOON_RADIUS * SUPPLY_BALLOON_RADIUS) continue;

      consumed = true;
      b.hp -= 1;
      if (b.hp <= 0) {
        b.alive = false;
        popEvents.push({ x: b.position.x, y: b.position.y });
        const rc = nextRandom(rng);
        rng = rc.rngState;
        const span = SUPPLY_DROP_MAX - SUPPLY_DROP_MIN + 1;
        const count = SUPPLY_DROP_MIN + Math.min(span - 1, Math.floor(rc.value * span));
        for (let i = 0; i < count; i++) {
          const rk = nextRandom(rng); rng = rk.rngState;
          const kind = PICKUP_KINDS[Math.min(PICKUP_KINDS.length - 1, Math.floor(rk.value * PICKUP_KINDS.length))]!;
          const ra = nextRandom(rng); rng = ra.rngState;
          const angle = (ra.value - 0.5) * Math.PI * 0.8;  // fan out left/right
          const rs = nextRandom(rng); rng = rs.rngState;
          const speed = 70 + rs.value * 90;
          newPickups.push({
            id: nid++,
            position: { x: b.position.x, y: b.position.y },
            // pop outward & slightly up, then gravity in stepPickups pulls it down
            velocity: { x: Math.sin(angle) * speed, y: -Math.abs(Math.cos(angle)) * speed * 0.5 },
            kind,
            lifetime: PICKUP_LIFETIME,
            bobPhase: ra.value * Math.PI * 2,
            collected: false,
          });
        }
      }
      break;
    }
    if (!consumed) remainingBullets.push(bullet);
  }

  return {
    bullets: remainingBullets,
    balloons: working.filter(b => b.alive),
    newPickups,
    popEvents,
    rngState: rng,
    nextEntityId: nid,
  };
}

/** Fall (capped at terminal speed) with a little air-drag on the pop-out velocity. */
export function stepPickups(
  pickups: readonly Pickup[],
  dt: number,
  worldHeight: number,
): Pickup[] {
  const groundY = worldHeight - 90;
  const out: Pickup[] = [];
  for (const p of pickups) {
    if (p.collected) continue;
    const vy = Math.min(PICKUP_FALL_SPEED, p.velocity.y + PICKUP_GRAVITY * dt);
    const vx = p.velocity.x * 0.985;
    const next: Pickup = {
      ...p,
      position: { x: p.position.x + vx * dt, y: p.position.y + vy * dt },
      velocity: { x: vx, y: vy },
      lifetime: p.lifetime - dt,
      bobPhase: p.bobPhase + dt * PICKUP_BOB_SPEED,
    };
    if (next.lifetime > 0 && next.position.y < groundY + 20) out.push(next);
  }
  return out;
}

export interface PickupCollectResult {
  player: Plane;
  pickups: Pickup[];
  collectEvents: { position: Vec2; kind: PickupKind }[];
  rapidFireSec: number;
}

/** The player grabs any pickup within PICKUP_RADIUS and gets its effect. */
export function resolvePlayerPickups(
  player: Plane,
  pickups: readonly Pickup[],
  rapidFireSec: number,
): PickupCollectResult {
  if (!player.alive || player.state !== 'flying') {
    return { player, pickups: [...pickups], collectEvents: [], rapidFireSec };
  }
  let p = player;
  let rf = rapidFireSec;
  const collectEvents: { position: Vec2; kind: PickupKind }[] = [];
  const remaining: Pickup[] = [];

  for (const pk of pickups) {
    const dx = pk.position.x - p.kinematic.position.x;
    const dy = pk.position.y - p.kinematic.position.y;
    if (dx * dx + dy * dy >= PICKUP_RADIUS * PICKUP_RADIUS) {
      remaining.push(pk);
      continue;
    }
    collectEvents.push({ position: { x: pk.position.x, y: pk.position.y }, kind: pk.kind });
    if (pk.kind === 'ammo') {
      p = { ...p, ammo: PICKUP_AMMO_REFILL, reloadTimer: 0 };
    } else if (pk.kind === 'repair') {
      p = { ...p, hp: Math.min(p.maxHp, p.hp + p.maxHp * PICKUP_REPAIR_FRACTION) };
    } else {
      rf = Math.max(rf, RAPIDFIRE_DURATION_SEC);
    }
  }

  return { player: p, pickups: remaining, collectEvents, rapidFireSec: rf };
}
