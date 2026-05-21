import {
  TICK_DT,
  GROUND_Y,
  RUNWAY_X,
  RUNWAY_Y,
  WORLD_WIDTH,
  RESPAWN_DELAY_SEC,
  CRASH_VY_THRESHOLD,
  ENEMY_INITIAL_HP_LIGHT,
  type PlayerCommand,
} from '@biplanes/shared';
import { stepPlane, stepPlaneTaxi } from '../physics/plane-physics.js';
import { firePlayerWeapon, stepBullets } from '../systems/weapon-system.js';
import { resolveBulletPlaneHits } from '../systems/collision-system.js';
import { chasePolicy } from '../ai/chase-policy.js';
import type { Plane } from '../entities/plane.js';
import type { WorldState } from './world-state.js';

const ENEMY_RESPAWN_DELAY_SEC = 3.0;

/** Reset a plane's kinematic state back to its faction's runway, taxiing. */
function resetToRunway(p: Plane): Plane {
  const playerSide = p.faction === 'player';
  const x = playerSide ? RUNWAY_X : WORLD_WIDTH - RUNWAY_X;
  const facing: 1 | -1 = playerSide ? 1 : -1;
  const heading = playerSide ? 0 : Math.PI;
  return {
    ...p,
    kinematic: {
      position: { x, y: RUNWAY_Y },
      velocity: { x: 0, y: 0 },
      heading,
      throttleOn: true,
      g: 0,
      facing,
      throttle: true,
    },
    hp: p.maxHp,
    alive: true,
    state: 'taxi',
    respawnTimer: 0,
    weaponCooldown: 0,
  };
}

/** Advance a single plane's physics depending on its state. Returns the new plane. */
function stepPlaneByState(
  p: Plane,
  cmd: { rotate: -1 | 0 | 1 },
  dt: number
): Plane {
  if (p.state === 'crashed') {
    const nextTimer = p.respawnTimer - dt;
    if (nextTimer <= 0) {
      return resetToRunway(p);
    }
    return { ...p, respawnTimer: nextTimer };
  }

  if (p.state === 'taxi') {
    const { kinematic, readyForLiftoff } = stepPlaneTaxi(p.kinematic, { rotate: cmd.rotate }, dt);
    return { ...p, kinematic, state: readyForLiftoff ? 'flying' : 'taxi' };
  }

  // 'flying' or 'spawning' (treat spawning as flying for the tick)
  const preVy = p.kinematic.velocity.y;
  const newKin = stepPlane(p.kinematic, { rotate: cmd.rotate }, dt);

  // Crash detection: clamped to ground AND was descending fast.
  if (newKin.position.y >= GROUND_Y - 0.5 && preVy > CRASH_VY_THRESHOLD) {
    return {
      ...p,
      kinematic: newKin,
      state: 'crashed',
      respawnTimer: p.faction === 'player' ? RESPAWN_DELAY_SEC : ENEMY_RESPAWN_DELAY_SEC,
      alive: false,
      hp: 0,
    };
  }

  return { ...p, kinematic: newKin, state: 'flying' };
}

/** Spawn a fresh enemy on the right-side runway, taxiing toward the player. */
function spawnEnemy(id: number): Plane {
  return {
    id,
    faction: 'enemy',
    kinematic: {
      position: { x: WORLD_WIDTH - RUNWAY_X, y: RUNWAY_Y },
      velocity: { x: 0, y: 0 },
      heading: Math.PI,           // facing left
      throttleOn: true,
      g: 0,
      facing: -1,
      throttle: true,
    },
    hp: ENEMY_INITIAL_HP_LIGHT,
    maxHp: ENEMY_INITIAL_HP_LIGHT,
    weaponCooldown: 0,
    alive: true,
    state: 'taxi',
    respawnTimer: 0,
  };
}

export function tick(state: WorldState, playerCommand: PlayerCommand): WorldState {
  if (state.gameOver) return state;

  let nextEntityId = state.nextEntityId;

  // 1. Player physics + weapon
  let player = stepPlaneByState(state.player, { rotate: playerCommand.rotate }, TICK_DT);

  // Weapon — only fire while flying.
  const newBulletList = stepBullets(state.bullets);
  if (player.state === 'flying' && player.alive) {
    const decrementedPlayerCooldown = Math.max(0, player.weaponCooldown - TICK_DT);
    const fireResult = firePlayerWeapon(
      { ...player, weaponCooldown: decrementedPlayerCooldown },
      playerCommand.fire,
      nextEntityId,
      state.damageMultiplier,
      state.fireRateMultiplier
    );
    if (fireResult.bullet) {
      newBulletList.push(fireResult.bullet);
      nextEntityId++;
    }
    player = { ...player, weaponCooldown: fireResult.newCooldown };
  } else {
    player = { ...player, weaponCooldown: Math.max(0, player.weaponCooldown - TICK_DT) };
  }

  // 2. Enemy AI + physics + weapons
  let enemies = state.enemies.map(e => {
    // Crashed enemies just tick down their respawn timer; they don't get removed
    // (they'll be filtered out below and a new one spawned).
    if (e.state === 'crashed') {
      const nextTimer = e.respawnTimer - TICK_DT;
      return { ...e, respawnTimer: nextTimer, alive: false };
    }

    // While taxiing, hold "pitch up" — the rotate sign depends on facing.
    // Facing right (+1): rotate=-1 tips nose up.
    // Facing left  (-1): rotate=+1 tips nose up.
    const taxiPitchUp: -1 | 0 | 1 = e.kinematic.facing === 1 ? -1 : 1;
    const cmd: PlayerCommand =
      e.state === 'taxi'
        ? { rotate: taxiPitchUp, fire: false, bomb: false }
        : chasePolicy(e, player);

    const stepped = stepPlaneByState(e, { rotate: cmd.rotate }, TICK_DT);
    let newCooldown = Math.max(0, stepped.weaponCooldown - TICK_DT);

    if (cmd.fire && newCooldown === 0 && stepped.state === 'flying' && stepped.alive) {
      const fakeForFire = { ...stepped, weaponCooldown: 0 };
      const result = firePlayerWeapon(fakeForFire, true, nextEntityId);
      if (result.bullet) {
        newBulletList.push(result.bullet);
        nextEntityId++;
        newCooldown = result.newCooldown;
      }
    }
    return { ...stepped, weaponCooldown: newCooldown };
  });

  // 3. Collisions — only against living, non-crashed planes.
  const flyingEnemies = enemies.filter(e => e.alive && e.state !== 'crashed');
  const crashedOrDeadEnemies = enemies.filter(e => !(e.alive && e.state !== 'crashed'));
  const collision = resolveBulletPlaneHits(newBulletList, player, flyingEnemies);
  player = collision.player;

  // Promote enemies that just died (hp == 0) to crashed state.
  const collidedEnemies = collision.enemies.map(e => {
    if (!e.alive && e.state !== 'crashed') {
      return { ...e, state: 'crashed' as const, respawnTimer: ENEMY_RESPAWN_DELAY_SEC };
    }
    return e;
  });

  enemies = [...collidedEnemies, ...crashedOrDeadEnemies];

  // If player died by bullet, mark crashed and start respawn.
  if (!player.alive && player.state !== 'crashed') {
    player = { ...player, state: 'crashed', respawnTimer: RESPAWN_DELAY_SEC };
  }

  // 4. Drop fully-expired crashed enemies (timer ≤ 0), then ensure one enemy exists.
  enemies = enemies.filter(e => !(e.state === 'crashed' && e.respawnTimer <= 0));

  const livingEnemyCount = enemies.length;
  const newTime = state.timeSec + TICK_DT;
  if (livingEnemyCount === 0 && newTime > 1.0) {
    enemies.push(spawnEnemy(nextEntityId));
    nextEntityId++;
  }

  return {
    ...state,
    timeSec: newTime,
    tickCount: state.tickCount + 1,
    nextEntityId,
    player,
    enemies,
    bullets: collision.bullets,
    // Upgrade/XP system disabled — keep fields stable.
    xpCollected: 0,
    pendingLevelUp: false,
    gameOver: false,    // no permanent game-over; player respawns
  };
}
