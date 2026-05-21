import {
  TICK_DT,
  GROUND_Y,
  RUNWAY_X,
  RUNWAY_Y,
  WORLD_WIDTH,
  RESPAWN_DELAY_SEC,
  CRASH_VY_THRESHOLD,
  ENEMY_INITIAL_HP_LIGHT,
  THROTTLE_CHANGE_RATE,
  FIRE_THRESHOLD,
  FIRE_BURN_RATE,
  PILOT_DEATH_DURATION,
  PLANE_RESPAWN_AFTER_PILOT_DEATH,
  type PlayerCommand,
} from '@biplanes/shared';
import { stepPlane, stepPlaneTaxi } from '../physics/plane-physics.js';
import { stepPilotParachute, stepPilotWalking, stepPilotDead } from '../physics/pilot-physics.js';
import { firePlayerWeapon, stepBullets } from '../systems/weapon-system.js';
import { resolveBulletPlaneHits } from '../systems/collision-system.js';
import { aiCommand, createAiState } from '../ai/chase-policy.js';
import { DIFFICULTIES } from '../ai/difficulty.js';
import type { Plane } from '../entities/plane.js';
import type { Pilot } from '../entities/pilot.js';
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
      throttleLevel: 1,
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

/** Apply fire burn-damage tick when plane HP is at/below FIRE_THRESHOLD. */
function applyFireBurn(p: Plane, dt: number): Plane {
  if (!p.alive || p.state !== 'flying') return p;
  if (p.hp <= 0) return p;
  if (p.hp / p.maxHp > FIRE_THRESHOLD) return p;
  const newHp = Math.max(0, p.hp - FIRE_BURN_RATE * dt);
  const alive = newHp > 0;
  return { ...p, hp: newHp, alive };
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
      throttleLevel: 1,
    },
    hp: ENEMY_INITIAL_HP_LIGHT,
    maxHp: ENEMY_INITIAL_HP_LIGHT,
    weaponCooldown: 0,
    alive: true,
    state: 'taxi',
    respawnTimer: 0,
  };
}

/** Build a fresh pilot under canopy at the given position. */
function spawnPilot(id: number, x: number, y: number): Pilot {
  return {
    id,
    position: { x, y },
    velocity: { x: 0, y: 0 },
    state: 'parachute',
    facing: 1,
    hp: 1,
    deathTimer: 0,
  };
}

export function tick(state: WorldState, playerCommand: PlayerCommand): WorldState {
  if (state.gameOver) return state;

  let nextEntityId = state.nextEntityId;
  let pilot = state.pilot;
  let pilotEjectTimeSec = state.pilotEjectTimeSec;

  // ---- Player branch ----
  // When a pilot is active, the player plane sits in 'crashed' but does NOT auto-respawn
  // until the pilot is resolved. Player input is redirected to the pilot.
  let player: Plane;

  if (pilot !== null) {
    // Don't auto-respawn plane while pilot is in play; freeze its respawn timer.
    // Keep state 'crashed' but ensure the timer doesn't expire.
    player = {
      ...state.player,
      state: 'crashed',
      alive: false,
      hp: 0,
      respawnTimer: Math.max(state.player.respawnTimer, 1.0), // hold above zero
    };

    // Step pilot using player input (rotate is the only meaningful axis).
    const pilotInput = { rotate: playerCommand.rotate };
    if (pilot.state === 'parachute') {
      pilot = stepPilotParachute(pilot, pilotInput, TICK_DT);
    } else if (pilot.state === 'walking') {
      pilot = stepPilotWalking(pilot, pilotInput, TICK_DT);
    } else if (pilot.state === 'dead') {
      pilot = stepPilotDead(pilot, TICK_DT);
    }
    pilotEjectTimeSec += TICK_DT;
  } else {
    // 1. Player throttle adjustment (only while flying — taxi has auto-throttle)
    let playerThrottleLevel = state.player.kinematic.throttleLevel;
    if (state.player.state === 'flying' && playerCommand.throttleDelta !== 0) {
      playerThrottleLevel = Math.max(0, Math.min(1,
        playerThrottleLevel + playerCommand.throttleDelta * THROTTLE_CHANGE_RATE * TICK_DT
      ));
    }
    const playerWithThrottle: Plane = {
      ...state.player,
      kinematic: { ...state.player.kinematic, throttleLevel: playerThrottleLevel },
    };

    // 2. Player physics
    player = stepPlaneByState(playerWithThrottle, { rotate: playerCommand.rotate }, TICK_DT);

    // 2a. Eject — pressed while flying and alive → spawn pilot, mark plane crashed.
    if (
      playerCommand.eject &&
      player.state === 'flying' &&
      player.alive
    ) {
      const ejectX = player.kinematic.position.x;
      const ejectY = player.kinematic.position.y;
      pilot = spawnPilot(nextEntityId, ejectX, ejectY);
      nextEntityId++;
      pilotEjectTimeSec = 0;
      player = {
        ...player,
        state: 'crashed',
        alive: false,
        hp: 0,
        respawnTimer: Math.max(RESPAWN_DELAY_SEC, 1.0),
      };
    }
  }

  // 3. Fire-burn damage on player (only meaningful when no pilot, i.e. player still flying)
  if (pilot === null) {
    player = applyFireBurn(player, TICK_DT);
  }

  // 4. Bullets step
  const newBulletList = stepBullets(state.bullets);

  // 5. Player weapon — only fire while flying (and no pilot active).
  if (pilot === null && player.state === 'flying' && player.alive) {
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

  // 6. Enemy AI + physics + weapons + fire-burn
  const params = DIFFICULTIES[state.difficulty];
  // NOTE: We mutate state.enemyAiStates and state.prevEnemyHp in place. See
  // world-state.ts for rationale (AI state is not on the determinism path).
  let enemies = state.enemies.map(e => {
    if (e.state === 'crashed') {
      const nextTimer = e.respawnTimer - TICK_DT;
      return { ...e, respawnTimer: nextTimer, alive: false };
    }

    const taxiPitchUp: -1 | 0 | 1 = e.kinematic.facing === 1 ? -1 : 1;
    let cmd: PlayerCommand;
    if (e.state === 'taxi') {
      cmd = { rotate: taxiPitchUp, fire: false, bomb: false, throttleDelta: 0, eject: false };
    } else {
      let aiState = state.enemyAiStates.get(e.id);
      if (!aiState) {
        aiState = createAiState(e.id);
        state.enemyAiStates.set(e.id, aiState);
      }
      const prevHp = state.prevEnemyHp.get(e.id) ?? e.hp;
      const result = aiCommand(e, player, params, aiState, prevHp, TICK_DT, state.timeSec);
      cmd = result.cmd;
      state.enemyAiStates.set(e.id, result.aiState);
    }
    state.prevEnemyHp.set(e.id, e.hp);

    let stepped = stepPlaneByState(e, { rotate: cmd.rotate }, TICK_DT);
    stepped = applyFireBurn(stepped, TICK_DT);

    // If burn killed it, transition to crashed.
    if (!stepped.alive && stepped.state !== 'crashed') {
      stepped = { ...stepped, state: 'crashed', respawnTimer: ENEMY_RESPAWN_DELAY_SEC };
    }

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

  // 7. Collisions — also handle pilot.
  const flyingEnemies = enemies.filter(e => e.alive && e.state !== 'crashed');
  const crashedOrDeadEnemies = enemies.filter(e => !(e.alive && e.state !== 'crashed'));
  const collision = resolveBulletPlaneHits(newBulletList, player, flyingEnemies, pilot);
  player = collision.player;
  pilot = collision.pilot;

  // Promote enemies that just died (hp == 0) to crashed state.
  const collidedEnemies = collision.enemies.map(e => {
    if (!e.alive && e.state !== 'crashed') {
      return { ...e, state: 'crashed' as const, respawnTimer: ENEMY_RESPAWN_DELAY_SEC };
    }
    return e;
  });

  enemies = [...collidedEnemies, ...crashedOrDeadEnemies];

  // If player died by bullet, mark crashed and start respawn (unless a pilot is already in play).
  if (!player.alive && player.state !== 'crashed') {
    player = { ...player, state: 'crashed', respawnTimer: RESPAWN_DELAY_SEC };
  }

  // 8. Pilot lifecycle resolution
  if (pilot !== null) {
    if (pilot.state === 'safe') {
      // Pilot reached hangar → respawn plane, clear pilot.
      player = resetToRunway(player);
      pilot = null;
      pilotEjectTimeSec = 0;
    } else if (pilot.state === 'dead' && pilot.deathTimer <= 0) {
      // Dead pilot fully expired — but enforce minimum total time since eject
      // for the plane respawn (so the player can't immediately re-fly).
      if (pilotEjectTimeSec >= PLANE_RESPAWN_AFTER_PILOT_DEATH) {
        player = resetToRunway(player);
        pilot = null;
        pilotEjectTimeSec = 0;
      } else {
        // Keep pilot around (corpse on the ground) until the longer timer matures.
        pilot = { ...pilot, deathTimer: 0 };
      }
    }
  }

  // 9. Drop fully-expired crashed enemies (timer ≤ 0), then ensure one enemy exists.
  const droppedEnemies = enemies.filter(e => (e.state === 'crashed' && e.respawnTimer <= 0));
  for (const e of droppedEnemies) {
    state.enemyAiStates.delete(e.id);
    state.prevEnemyHp.delete(e.id);
  }
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
    pilot,
    pilotEjectTimeSec,
    xpCollected: 0,
    pendingLevelUp: false,
    gameOver: false,
  };
}
