import {
  TICK_DT,
  RUNWAY_X,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  RESPAWN_DELAY_SEC,
  CRASH_VY_THRESHOLD,
  ENEMY_INITIAL_HP_LIGHT,
  THROTTLE_CHANGE_RATE,
  BOOST_OVERHEAT_SEC,
  BOOST_COOL_SEC,
  NO_THROTTLE_STALL_SEC,
  FIRE_THRESHOLD,
  FIRE_BURN_RATE,
  PLANE_RESPAWN_AFTER_PILOT_DEATH,
  ENEMY_SCORE_TO_LOSE,
  XP_PER_KILL_LIGHT,
  PLAYER_SCORE_TO_WIN,
  LEVEL_UP_THRESHOLDS,
  BOMB_GRAVITY,
  BOMB_COOLDOWN,
  BOMB_LIFETIME,
  BOMB_EXPLOSION_RADIUS,
  BOMB_DAMAGE,
  ROCKET_SPEED,
  ROCKET_TURN_RATE,
  ROCKET_COOLDOWN,
  ROCKET_LIFETIME,
  ROCKET_EXPLOSION_RADIUS,
  ROCKET_DAMAGE,
  DRONE_COOLDOWN,
  DRONE_DAMAGE,
  DRONE_RANGE,
  BULLET_SPEED,
  BULLET_LIFETIME,
  DYING_SPIN_RATE,
  DYING_GRAVITY_MULTIPLIER,
  DYING_DURATION_SEC,
  TAKEOFF_LIFTOFF_SPEED,
  type Vec2,
  type PlayerCommand,
} from '@biplanes/shared';
import { stepPlane, stepPlaneTaxi } from '../physics/plane-physics.js';
import { stepPilotParachute, stepPilotWalking, stepPilotDead } from '../physics/pilot-physics.js';
import { firePlayerWeapon, stepBullets } from '../systems/weapon-system.js';
import { resolveBulletPlaneHits, applyExplosionDamage } from '../systems/collision-system.js';
import { resolvePlanePlaneCollisions } from '../systems/plane-collision.js';
import { arenaTargetEnemyCount } from '../systems/arena-waves.js';
import { aiCommand, aiCommandPilotTarget, createAiState } from '../ai/chase-policy.js';
import { DIFFICULTIES, aiParamsForRole } from '../ai/difficulty.js';
import type { Plane } from '../entities/plane.js';
import type { Pilot, Faction } from '../entities/pilot.js';
import { findPilot } from '../entities/pilot.js';
import type { Bomb } from '../entities/bomb.js';
import type { Rocket } from '../entities/rocket.js';
import type { Bullet } from '../entities/bullet.js';
import { distance, sub, angleOf } from '../math/vec2.js';

import type { WorldState } from './world-state.js';

const ENEMY_RESPAWN_DELAY_SEC = 3.0;
function nextRandom(rngState: number): { value: number; rngState: number } {
  const nextState = (rngState + 0x6d2b79f5) >>> 0;
  let t = nextState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return {
    value: ((t ^ (t >>> 14)) >>> 0) / 4294967296,
    rngState: nextState,
  };
}

function targetEnemyCount(_difficulty: WorldState['difficulty'], _timeSec: number, playerScore: number): number {
  return arenaTargetEnemyCount(playerScore);
}

function hasBombWeapon(appliedUpgradeIds: readonly string[]): boolean {
  return appliedUpgradeIds.includes('heavy_bomb')
    || appliedUpgradeIds.includes('cluster_bomb')
    || appliedUpgradeIds.includes('fire_screen');
}

function bombExplosionRadius(appliedUpgradeIds: readonly string[]): number {
  return appliedUpgradeIds.includes('cluster_bomb') || appliedUpgradeIds.includes('fire_screen')
    ? BOMB_EXPLOSION_RADIUS * 1.45
    : BOMB_EXPLOSION_RADIUS;
}

/** Reset a plane's kinematic state back to its faction's runway, taxiing. */
/** Reset a plane's kinematic state back to its faction's runway, taxiing. */
function resetToRunway(p: Plane, worldWidth: number = WORLD_WIDTH, worldHeight: number = WORLD_HEIGHT): Plane {
  const playerSide = p.faction === 'player';
  const x = playerSide ? RUNWAY_X : worldWidth - RUNWAY_X;
  const y = worldHeight - 90;
  const facing: 1 | -1 = playerSide ? 1 : -1;
  const heading = playerSide ? 0 : Math.PI;
  return {
    ...p,
    kinematic: {
      position: { x, y },
      velocity: { x: 0, y: 0 },
      heading,
      throttleOn: false,
      g: 0,
      facing,
      throttle: false,
      throttleLevel: 0,
    },
    hp: p.maxHp,
    alive: true,
    state: 'taxi',
    respawnTimer: 0,
    weaponCooldown: 0,
    boostHeat: 0,
    boostActive: false,
    noThrottleSec: 0,
  };
}

function stepPlaneByState(
  p: Plane,
  cmd: { rotate: -1 | 0 | 1; boost?: boolean; boostMultiplier?: number },
  dt: number,
  worldWidth: number = WORLD_WIDTH,
  softFloor: boolean = false,
  worldHeight: number = WORLD_HEIGHT
): Plane {
  if (p.state === 'crashed') {
    const nextTimer = p.respawnTimer - dt;
    if (nextTimer <= 0) {
      return resetToRunway(p, worldWidth, worldHeight);
    }
    return { ...p, respawnTimer: nextTimer };
  }

  if (p.state === 'dying') {
    // Run death-spin physics: ignore input, rotate in place, gravity-accelerate downward.
    // No physics from stepPlane (which expects controlled flight).
    const t = (p.dyingTimer ?? 0) - dt;
    if (t <= 0) {
      // Transition to crashed; the caller decides respawnTimer based on faction.
      return {
        ...p,
        state: 'crashed',
        alive: false,
        dyingTimer: 0,
        respawnTimer: p.faction === 'player' ? RESPAWN_DELAY_SEC : ENEMY_RESPAWN_DELAY_SEC,
      };
    }
    const k = p.kinematic;
    return {
      ...p,
      dyingTimer: t,
      kinematic: {
        ...k,
        heading: k.heading + DYING_SPIN_RATE * dt,
        velocity: {
          x: k.velocity.x * 0.99,
          // gravity in px/sec² is 9.8 * multiplier * 60 (the 60 scales m/s² → px/s² for our world)
          y: k.velocity.y + 9.8 * DYING_GRAVITY_MULTIPLIER * 60 * dt,
        },
        position: {
          x: k.position.x + k.velocity.x * dt,
          y: k.position.y + k.velocity.y * dt,
        },
      },
    };
  }

  if (p.state === 'taxi') {
    const { kinematic, readyForLiftoff } = stepPlaneTaxi(p.kinematic, { rotate: cmd.rotate }, dt);
    // If pilot taxis past the runway edge without lifting off → crash.
    // Plane is destroyed, point goes to the opposing side via the standard "alive→dead" score path.
    if (kinematic.position.x < 0 || kinematic.position.x > worldWidth) {
      return {
        ...p,
        kinematic,
        state: 'crashed',
        respawnTimer: p.faction === 'player' ? RESPAWN_DELAY_SEC : ENEMY_RESPAWN_DELAY_SEC,
        alive: false,
        hp: 0,
      };
    }
    return { ...p, kinematic, state: readyForLiftoff ? 'flying' : 'taxi' };
  }

  const preVy = p.kinematic.velocity.y;
  const newKin = stepPlane(p.kinematic, {
    rotate: cmd.rotate,
    boost: cmd.boost,
    boostMultiplier: cmd.boostMultiplier,
  }, dt, worldWidth, softFloor, worldHeight);

  if (!softFloor && newKin.position.y >= worldHeight - 90 - 0.5 && preVy > CRASH_VY_THRESHOLD) {
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

function killByEngineFailure(p: Plane): Plane {
  if (!p.alive || p.state !== 'flying') return p;
  return {
    ...p,
    hp: 0,
    alive: false,
    state: 'dying',
    dyingTimer: DYING_DURATION_SEC,
  };
}

function igniteByEngineOverheat(p: Plane): Plane {
  if (!p.alive || p.state !== 'flying') return p;
  const fireHp = Math.max(1, Math.floor(p.maxHp * FIRE_THRESHOLD));
  return {
    ...p,
    hp: Math.min(p.hp, fireHp),
    alive: true,
    state: 'flying',
    boostHeat: 0.72,
    boostActive: false,
    noThrottleSec: 0,
  };
}

function applyPlayerEngineStress(
  p: Plane,
  boost: boolean,
  dt: number,
  worldHeight: number,
  heatMultiplier: number = 1,
  coolingMultiplier: number = 1,
  overheatRoll: number | null = null,
): Plane {
  if (p.state !== 'flying' || !p.alive) {
    return { ...p, boostHeat: 0, boostActive: false, noThrottleSec: 0 };
  }

  const heat = Math.max(0, Math.min(1,
    (p.boostHeat ?? 0) + (boost
      ? dt / BOOST_OVERHEAT_SEC * heatMultiplier
      : -dt / BOOST_COOL_SEC * coolingMultiplier)
  ));
  const noThrottleSec = p.kinematic.throttleLevel <= 0.02
    ? (p.noThrottleSec ?? 0) + dt
    : 0;
  const stressed = { ...p, boostHeat: heat, boostActive: boost, noThrottleSec };

  if (heat >= 1) {
    if (overheatRoll !== null && overheatRoll < 0.5) {
      return igniteByEngineOverheat(stressed);
    }
    return killByEngineFailure(stressed);
  }

  const lowerDangerY = (worldHeight - 90) * 0.55;
  if (noThrottleSec >= NO_THROTTLE_STALL_SEC && p.kinematic.position.y >= lowerDangerY) {
    return killByEngineFailure(stressed);
  }
  return stressed;
}

function applyFireBurn(p: Plane, dt: number): Plane {
  if (!p.alive || p.state !== 'flying') return p;
  if (p.hp <= 0) return p;
  if (p.hp / p.maxHp > FIRE_THRESHOLD) return p;
  const newHp = Math.max(0, p.hp - FIRE_BURN_RATE * dt);
  const alive = newHp > 0;
  return { ...p, hp: newHp, alive };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function spawnEnemy(
  id: number,
  hpMultiplier: number = 1,
  worldWidth: number = WORLD_WIDTH,
  worldHeight: number = WORLD_HEIGHT,
  targetPosition: Vec2 = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 },
  lane: number = 0,
): Plane {
  const maxHp = Math.round(ENEMY_INITIAL_HP_LIGHT * hpMultiplier);
  const side = lane % 2 === 0 ? 1 : -1;
  const offset = WORLD_WIDTH * 0.72 + Math.floor(lane / 2) * 180;
  let x = targetPosition.x + side * offset;
  while (x < 0) x += worldWidth;
  while (x >= worldWidth) x -= worldWidth;
  const groundY = worldHeight - 90;
  const y = clamp(targetPosition.y - 260 + (lane % 3) * 150, 160, groundY - 170);
  const heading = side === 1 ? Math.PI : 0;
  const speed = 600;
  return {
    id,
    faction: 'enemy',
    kinematic: {
      position: { x, y },
      velocity: { x: Math.cos(heading) * speed, y: Math.sin(heading) * speed },
      heading,
      throttleOn: true,
      g: speed,
      facing: side === 1 ? -1 : 1,
      throttle: true,
      throttleLevel: 0.85,
    },
    hp: maxHp,
    maxHp,
    weaponCooldown: 0,
    alive: true,
    state: 'flying',
    respawnTimer: 0,
    boostHeat: 0,
    boostActive: false,
    noThrottleSec: 0,
  };
}

/** Build a fresh pilot under canopy at the given position for the given faction. */
function spawnPilot(id: number, x: number, y: number, faction: Faction): Pilot {
  return {
    id,
    faction,
    position: { x, y },
    velocity: { x: 0, y: 0 },
    state: 'parachute',
    facing: faction === 'player' ? 1 : -1,
    hp: 1,
    deathTimer: 0,
    groundedJumpCooldown: 0,
  };
}

export function tick(state: WorldState, playerCommand: PlayerCommand): WorldState {
  if (state.gameOver || state.pendingLevelUp) return state;

  const worldWidth = state.worldWidth || WORLD_WIDTH;
  const worldHeight = state.worldHeight || WORLD_HEIGHT;
  const softFloor = state.softFloor ?? false;

  let nextEntityId = state.nextEntityId;
  let rngState = state.rngState;
  let pilots: Pilot[] = state.pilots.map(p => ({ ...p }));
  let pilotEjectTimeSec = state.pilotEjectTimeSec;
  let playerScore = state.playerScore;
  let enemyScore = state.enemyScore;
  let playerEjectedThisTick = false;
  let caravan = state.caravan ? { ...state.caravan } : undefined;

  // ---- Player branch ----
  // When a player pilot is active, the player plane sits in 'crashed' and does NOT
  // auto-respawn until the pilot is resolved. Player input is redirected to the pilot.
  let player: Plane;
  const playerPilotIdx = pilots.findIndex(p => p.faction === 'player');
  const playerPilotActive = playerPilotIdx !== -1;

  if (playerPilotActive) {
    player = {
      ...state.player,
      state: 'crashed',
      alive: false,
      hp: 0,
      respawnTimer: Math.max(state.player.respawnTimer, 1.0),
    };

    const pilotInput = { rotate: playerCommand.rotate, jump: playerCommand.jump };
    let pp = pilots[playerPilotIdx]!;
    if (pp.state === 'parachute') {
      pp = stepPilotParachute(pp, pilotInput, TICK_DT, worldWidth, worldHeight);
    } else if (pp.state === 'walking') {
      pp = stepPilotWalking(pp, pilotInput, TICK_DT, worldWidth, worldHeight);
    } else if (pp.state === 'dead') {
      pp = stepPilotDead(pp, TICK_DT, worldHeight);
    }
    pilots[playerPilotIdx] = pp;
    pilotEjectTimeSec += TICK_DT;
  } else {
    let playerThrottleLevel = state.player.kinematic.throttleLevel;
    if (
      (state.player.state === 'flying' || state.player.state === 'taxi')
      && playerCommand.throttleDelta !== 0
    ) {
      playerThrottleLevel = Math.max(0, Math.min(1,
        playerThrottleLevel + playerCommand.throttleDelta * THROTTLE_CHANGE_RATE * TICK_DT
      ));
    }
    const playerWithThrottle: Plane = {
      ...state.player,
      kinematic: { ...state.player.kinematic, throttleLevel: playerThrottleLevel },
    };

    const boostActive = playerCommand.boost === true && playerThrottleLevel > 0.2;
    player = stepPlaneByState(playerWithThrottle, {
      rotate: playerCommand.rotate,
      boost: boostActive,
      boostMultiplier: state.boostPowerMultiplier,
    }, TICK_DT, worldWidth, softFloor, worldHeight);
    let overheatRoll: number | null = null;
    const willOverheat = player.state === 'flying'
      && player.alive
      && boostActive
      && ((player.boostHeat ?? 0) + TICK_DT / BOOST_OVERHEAT_SEC * state.boostHeatMultiplier) >= 1;
    if (willOverheat) {
      const roll = nextRandom(rngState);
      rngState = roll.rngState;
      overheatRoll = roll.value;
    }
    player = applyPlayerEngineStress(
      player,
      boostActive,
      TICK_DT,
      worldHeight,
      state.boostHeatMultiplier,
      state.boostCoolingMultiplier,
      overheatRoll,
    );

    // Eject player → spawn player pilot
    if (playerCommand.eject && player.state === 'flying' && player.alive) {
      const ejectX = player.kinematic.position.x;
      const ejectY = player.kinematic.position.y;
      pilots.push(spawnPilot(nextEntityId, ejectX, ejectY, 'player'));
      nextEntityId++;
      pilotEjectTimeSec = 0;
      playerEjectedThisTick = true;
      player = {
        ...player,
        state: 'crashed',
        alive: false,
        hp: 0,
        respawnTimer: Math.max(RESPAWN_DELAY_SEC, 1.0),
      };
    }
  }

  // Fire-burn on player plane only when no player pilot
  if (!playerPilotActive) {
    player = applyFireBurn(player, TICK_DT);
  }

  // Step enemy pilots (AI-controlled: walk toward own hangar)
  pilots = pilots.map(pp => {
    if (pp.faction !== 'enemy') return pp;
    if (pp.state === 'parachute') {
      // Enemy AI under canopy: drift toward enemy hangar.
      const enemyHangarX = worldWidth - RUNWAY_X;
      const rotate: -1 | 0 | 1 = pp.position.x < enemyHangarX ? 1 : -1;
      return stepPilotParachute(pp, { rotate, jump: false }, TICK_DT, worldWidth, worldHeight);
    }
    if (pp.state === 'walking') {
      const enemyHangarX = worldWidth - RUNWAY_X;
      const rotate: -1 | 0 | 1 = pp.position.x < enemyHangarX ? 1 : -1;
      return stepPilotWalking(pp, { rotate, jump: false }, TICK_DT, worldWidth, worldHeight);
    }
    if (pp.state === 'dead') {
      return stepPilotDead(pp, TICK_DT, worldHeight);
    }
    return pp;
  });

  // Bullets step
  const newBulletList = stepBullets(state.bullets);

  // Player weapon
  if (!playerPilotActive && player.state === 'flying' && player.alive) {
    const decrementedPlayerCooldown = Math.max(0, player.weaponCooldown - TICK_DT);
    const fireResult = firePlayerWeapon(
      { ...player, weaponCooldown: decrementedPlayerCooldown },
      playerCommand.fire,
      nextEntityId,
      state.damageMultiplier,
      state.fireRateMultiplier,
      state.hasHeavyCannon,
      state.appliedUpgradeIds.includes('piercing_bullets')
    );
    if (fireResult.bullet) {
      newBulletList.push(fireResult.bullet);
      nextEntityId++;
    }
    player = { ...player, weaponCooldown: fireResult.newCooldown };
  } else {
    player = { ...player, weaponCooldown: Math.max(0, player.weaponCooldown - TICK_DT) };
  }

  // Enemy AI + physics + weapons + fire-burn + ejection
  const baseParams = DIFFICULTIES[state.difficulty];
  const playerPilotForAi = findPilot(pilots, 'player');
  const ejectedThisTick: Pilot[] = [];

  let enemies = state.enemies.map(e => {
    if (e.state === 'crashed') {
      const nextTimer = e.respawnTimer - TICK_DT;
      return { ...e, respawnTimer: nextTimer, alive: false };
    }

    if (e.state === 'dying') {
      // Skip AI/weapon path; just run death-spin via stepPlaneByState.
      return stepPlaneByState(e, { rotate: 0 }, TICK_DT, worldWidth, softFloor, worldHeight);
    }

    const taxiPitchUp: -1 | 0 | 1 = e.kinematic.facing === 1 ? -1 : 1;
    let cmd: PlayerCommand;
    const wasFlyingThisTick = e.state === 'flying';
    if (e.state === 'taxi') {
      // Realistic takeoff: build ground speed first, only rotate the nose up
      // once we're close to liftoff speed. Otherwise the plane visually points
      // skyward while still rolling, which looks absurd.
      const closeToLiftoff = e.kinematic.g >= TAKEOFF_LIFTOFF_SPEED * 0.85;
      const rotate: -1 | 0 | 1 = closeToLiftoff ? taxiPitchUp : 0;
      cmd = { rotate, fire: false, bomb: false, throttleDelta: 1, eject: false, jump: false };
    } else {
      let aiState = state.enemyAiStates.get(e.id);
      if (!aiState) {
        aiState = createAiState(e.id);
        state.enemyAiStates.set(e.id, aiState);
      }
      const prevHp = state.prevEnemyHp.get(e.id) ?? e.hp;

      // Escort mission target override
      let target = player;
      let targetPilot = playerPilotForAi;

      let role = e.aiRole;
      if (e.maxHp >= ENEMY_INITIAL_HP_LIGHT * 4) {
        // Boss-class enemies alternate between pressuring the caravan and dueling the player.
        const cycle = Math.floor(state.timeSec / 8);
        role = cycle % 2 === 0 ? 'attack-caravan' : 'chase-player';
      }

      if (role === 'attack-caravan' && caravan && caravan.active) {
        target = {
          id: -99,
          faction: 'player',
          kinematic: {
            position: { ...caravan.position },
            velocity: { ...caravan.velocity },
            heading: 0,
            throttleOn: false,
            g: 220,
            facing: 1,
            throttle: false,
            throttleLevel: 0.5,
          },
          hp: caravan.hp,
          maxHp: caravan.maxHp,
          weaponCooldown: 0,
          alive: caravan.hp > 0,
          state: 'flying',
          respawnTimer: 0,
        };
        targetPilot = undefined;
      }

      // Priority target: ejected player pilot (it's the only target if player plane is down).
      const params = aiParamsForRole(state.difficulty, role);
      const result = targetPilot
        ? aiCommandPilotTarget(e, targetPilot, params, aiState, prevHp, TICK_DT, state.timeSec, wasFlyingThisTick)
        : aiCommand(e, target, params, aiState, prevHp, TICK_DT, state.timeSec, wasFlyingThisTick, worldHeight);
      cmd = result.cmd;
      state.enemyAiStates.set(e.id, result.aiState);
    }
    state.prevEnemyHp.set(e.id, e.hp);

    // Apply AI throttle BEFORE stepping physics (mirrors how the player branch
    // handles throttleDelta). Only effective when the AI bothers to manage throttle
    // (manageThrottle=false → throttleDelta stays 0 → no change).
    let eWithThrottle = e;
    if (cmd.throttleDelta !== 0 && (e.state === 'flying' || e.state === 'taxi')) {
      const newThrottle = Math.max(0, Math.min(1,
        e.kinematic.throttleLevel + cmd.throttleDelta * THROTTLE_CHANGE_RATE * TICK_DT
      ));
      eWithThrottle = { ...e, kinematic: { ...e.kinematic, throttleLevel: newThrottle } };
    }

    let stepped = stepPlaneByState(eWithThrottle, { rotate: cmd.rotate }, TICK_DT, worldWidth, softFloor, worldHeight);
    stepped = applyFireBurn(stepped, TICK_DT);

    if (!stepped.alive && stepped.state !== 'crashed') {
      stepped = { ...stepped, state: 'crashed', respawnTimer: ENEMY_RESPAWN_DELAY_SEC };
    }

    let newCooldown = Math.max(0, stepped.weaponCooldown - TICK_DT);

    if (cmd.fire && newCooldown === 0 && stepped.state === 'flying' && stepped.alive) {
      const fakeForFire = { ...stepped, weaponCooldown: 0 };
      const result = firePlayerWeapon(
        fakeForFire, true, nextEntityId,
        baseParams.damageMultiplier,
        baseParams.fireRateMultiplier,
      );
      if (result.bullet) {
        newBulletList.push(result.bullet);
        nextEntityId++;
        newCooldown = result.newCooldown;
      }
    }

    // === Enemy eject when burning ===
    // If plane is flying, alive, at/below FIRE_THRESHOLD, and there isn't
    // already an enemy pilot in play — roll for ejection.
    const enemyPilotAlreadyOut = findPilot(pilots, 'enemy') !== undefined
      || ejectedThisTick.some(p => p.faction === 'enemy');
    if (
      stepped.alive
      && stepped.state === 'flying'
      && stepped.hp / stepped.maxHp <= FIRE_THRESHOLD
      && !enemyPilotAlreadyOut
    ) {
      const roll = nextRandom(rngState);
      rngState = roll.rngState;
      if (roll.value < baseParams.ejectChancePerSec * TICK_DT) {
        const ejectX = stepped.kinematic.position.x;
        const ejectY = stepped.kinematic.position.y;
        const newPilot = spawnPilot(nextEntityId, ejectX, ejectY, 'enemy');
        nextEntityId++;
        ejectedThisTick.push(newPilot);
        stepped = {
          ...stepped,
          state: 'crashed',
          alive: false,
          hp: 0,
          respawnTimer: Math.max(ENEMY_RESPAWN_DELAY_SEC, 1.0),
        };
      }
    }

    return { ...stepped, weaponCooldown: newCooldown };
  });

  // Add any newly-ejected enemy pilots to the list.
  pilots = [...pilots, ...ejectedThisTick];

  // === Player Bomb Dropping ===
  let bombCooldown = player.bombCooldown ?? 0;
  const currentBombs = [...state.bombs];
  if (!playerPilotActive && player.state === 'flying' && player.alive && hasBombWeapon(state.appliedUpgradeIds)) {
    bombCooldown = Math.max(0, bombCooldown - TICK_DT);
    if (playerCommand.bomb && bombCooldown <= 0) {
      const newBomb: Bomb = {
        id: nextEntityId,
        ownerId: player.id,
        ownerFaction: 'player',
        position: { ...player.kinematic.position },
        velocity: { ...player.kinematic.velocity },
        lifetime: BOMB_LIFETIME,
        alive: true,
      };
      currentBombs.push(newBomb);
      nextEntityId++;
      bombCooldown = BOMB_COOLDOWN;
    }
  } else {
    bombCooldown = Math.max(0, bombCooldown - TICK_DT);
  }
  player = { ...player, bombCooldown };

  // === Player Companion Drone Firing ===
  let droneTimer = state.droneTimer;
  if (state.hasDrone && player.alive && player.state === 'flying') {
    droneTimer = Math.max(0, droneTimer - TICK_DT);
    if (droneTimer <= 0) {
      const dronePos = {
        x: player.kinematic.position.x + Math.cos(state.timeSec * 3) * 45,
        y: player.kinematic.position.y + Math.sin(state.timeSec * 3) * 45,
      };

      let closestDist = Infinity;
      let target: Plane | null = null;
      for (const e of enemies) {
        if (e.alive && e.state === 'flying') {
          const dist = distance(dronePos, e.kinematic.position);
          if (dist < closestDist) {
            closestDist = dist;
            target = e;
          }
        }
      }

      if (target && closestDist <= DRONE_RANGE) {
        const toTarget = sub(target.kinematic.position, dronePos);
        const angle = angleOf(toTarget);
        const bulletVel = {
          x: Math.cos(angle) * BULLET_SPEED,
          y: Math.sin(angle) * BULLET_SPEED,
        };
        const droneBullet: Bullet = {
          id: nextEntityId,
          ownerId: player.id,
          ownerFaction: 'player',
          position: dronePos,
          velocity: bulletVel,
          lifetime: BULLET_LIFETIME,
          damage: DRONE_DAMAGE * state.damageMultiplier,
          alive: true,
        };
        newBulletList.push(droneBullet);
        nextEntityId++;
        droneTimer = DRONE_COOLDOWN;
      }
    }
  } else {
    droneTimer = Math.max(0, droneTimer - TICK_DT);
  }

  // === Player Flame Trail damage ===
  const PLANE_HIT_RADIUS = 22;

  if (state.hasFlameTrail && player.alive && player.state === 'flying') {
    const headingCos = Math.cos(player.kinematic.heading);
    const headingSin = Math.sin(player.kinematic.heading);
    const tailStart = {
      x: player.kinematic.position.x - headingCos * 20,
      y: player.kinematic.position.y - headingSin * 20,
    };
    const tailEnd = {
      x: player.kinematic.position.x - headingCos * 120,
      y: player.kinematic.position.y - headingSin * 120,
    };

    const distToSegment = (pt: Vec2, s0: Vec2, s1: Vec2): number => {
      const l2 = (s0.x - s1.x) * (s0.x - s1.x) + (s0.y - s1.y) * (s0.y - s1.y);
      if (l2 === 0) return distance(pt, s0);
      let t = ((pt.x - s0.x) * (s1.x - s0.x) + (pt.y - s0.y) * (s1.y - s0.y)) / l2;
      t = Math.max(0, Math.min(1, t));
      const proj = {
        x: s0.x + t * (s1.x - s0.x),
        y: s0.y + t * (s1.y - s0.y),
      };
      return distance(pt, proj);
    };

    const FLAME_DAMAGE_PER_SEC = 50;
    enemies = enemies.map(e => {
      if (e.alive && e.state === 'flying') {
        const dist = distToSegment(e.kinematic.position, tailStart, tailEnd);
        if (dist < PLANE_HIT_RADIUS) {
          const newHp = Math.max(0, e.hp - FLAME_DAMAGE_PER_SEC * TICK_DT);
          const alive = newHp > 0;
          return { ...e, hp: newHp, alive };
        }
      }
      return e;
    });
  }

  // === Bomb and Rocket stepping + explosions ===
  const nextExplosionEvents = [...state.explosionEvents];
  const groundY = worldHeight - 90;

  // 1. Step bombs
  const activeBombs: Bomb[] = [];
  for (const b of currentBombs) {
    let nextLifetime = b.lifetime - TICK_DT;
    let nextPos = {
      x: b.position.x + b.velocity.x * TICK_DT,
      y: b.position.y + b.velocity.y * TICK_DT,
    };
    let nextVel = {
      x: b.velocity.x,
      y: b.velocity.y + BOMB_GRAVITY * TICK_DT,
    };

    let exploded = false;
    if (nextPos.y >= groundY) {
      nextPos.y = groundY;
      exploded = true;
    }
    if (!exploded) {
      if (player.alive && b.ownerFaction !== 'player') {
        if (distance(nextPos, player.kinematic.position) < PLANE_HIT_RADIUS) {
          exploded = true;
        }
      }
      for (const e of enemies) {
        if (e.alive && b.ownerFaction !== 'enemy') {
          if (distance(nextPos, e.kinematic.position) < PLANE_HIT_RADIUS) {
            exploded = true;
            break;
          }
        }
      }
    }
    if (nextLifetime <= 0) {
      exploded = true;
    }

    if (exploded) {
      const explodeRes = applyExplosionDamage(
        nextPos,
        bombExplosionRadius(state.appliedUpgradeIds),
        BOMB_DAMAGE,
        b.ownerFaction,
        player,
        enemies,
        pilots
      );
      player = explodeRes.player;
      enemies = explodeRes.enemies;
      pilots = explodeRes.pilots;
      playerScore += explodeRes.playerScoreDelta;
      enemyScore += explodeRes.enemyScoreDelta;
      nextExplosionEvents.push(nextPos);
    } else {
      activeBombs.push({
        ...b,
        position: nextPos,
        velocity: nextVel,
        lifetime: nextLifetime,
      });
    }
  }

  // 2. Step homing rockets
  let activeRockets: Rocket[] = [];
  for (const r of state.rockets) {
    let nextLifetime = r.lifetime - TICK_DT;
    let nextPos = {
      x: r.position.x + r.velocity.x * TICK_DT,
      y: r.position.y + r.velocity.y * TICK_DT,
    };

    let heading = r.heading;
    let targetPlane: Plane | null = null;
    if (r.ownerFaction === 'player') {
      let closestDist = Infinity;
      for (const e of enemies) {
        if (e.alive && e.state === 'flying') {
          const dist = distance(nextPos, e.kinematic.position);
          if (dist < closestDist) {
            closestDist = dist;
            targetPlane = e;
          }
        }
      }
    } else {
      if (player.alive && player.state === 'flying') {
        targetPlane = player;
      }
    }

    if (targetPlane) {
      const toTarget = sub(targetPlane.kinematic.position, nextPos);
      const desiredAngle = angleOf(toTarget);
      let angleDiff = desiredAngle - heading;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;

      const maxTurn = ROCKET_TURN_RATE * TICK_DT;
      const actualTurn = Math.max(-maxTurn, Math.min(maxTurn, angleDiff));
      heading += actualTurn;
    }

    let nextVel = {
      x: Math.cos(heading) * ROCKET_SPEED,
      y: Math.sin(heading) * ROCKET_SPEED,
    };

    let exploded = false;
    if (nextPos.y >= groundY) {
      nextPos.y = groundY;
      exploded = true;
    }
    if (!exploded) {
      if (player.alive && r.ownerFaction !== 'player') {
        if (distance(nextPos, player.kinematic.position) < PLANE_HIT_RADIUS) {
          exploded = true;
        }
      }
      for (const e of enemies) {
        if (e.alive && r.ownerFaction !== 'enemy') {
          if (distance(nextPos, e.kinematic.position) < PLANE_HIT_RADIUS) {
            exploded = true;
            break;
          }
        }
      }
    }
    if (nextLifetime <= 0) {
      exploded = true;
    }

    if (exploded) {
      const explodeRes = applyExplosionDamage(
        nextPos,
        ROCKET_EXPLOSION_RADIUS,
        ROCKET_DAMAGE,
        r.ownerFaction,
        player,
        enemies,
        pilots
      );
      player = explodeRes.player;
      enemies = explodeRes.enemies;
      pilots = explodeRes.pilots;
      playerScore += explodeRes.playerScoreDelta;
      enemyScore += explodeRes.enemyScoreDelta;
      nextExplosionEvents.push(nextPos);
    } else {
      activeRockets.push({
        ...r,
        position: nextPos,
        velocity: nextVel,
        heading,
        lifetime: nextLifetime,
      });
    }
  }

  // 3. Player homing rocket auto-firing
  let homingRocketTimer = state.homingRocketTimer;
  if (state.hasHomingRockets && player.alive && player.state === 'flying') {
    homingRocketTimer = Math.max(0, homingRocketTimer - TICK_DT);
    if (homingRocketTimer <= 0) {
      let closestDist = Infinity;
      let target: Plane | null = null;
      for (const e of enemies) {
        if (e.alive && e.state === 'flying') {
          const dist = distance(player.kinematic.position, e.kinematic.position);
          if (dist < closestDist) {
            closestDist = dist;
            target = e;
          }
        }
      }

      if (target) {
        const heading = player.kinematic.heading;
        const rocketVel = {
          x: Math.cos(heading) * ROCKET_SPEED,
          y: Math.sin(heading) * ROCKET_SPEED,
        };
        const newRocket: Rocket = {
          id: nextEntityId,
          ownerId: player.id,
          ownerFaction: 'player',
          position: { ...player.kinematic.position },
          velocity: rocketVel,
          heading,
          lifetime: ROCKET_LIFETIME,
          alive: true,
          damage: ROCKET_DAMAGE,
        };
        activeRockets.push(newRocket);
        nextEntityId++;
        homingRocketTimer = ROCKET_COOLDOWN;
      }
    }
  } else {
    homingRocketTimer = Math.max(0, homingRocketTimer - TICK_DT);
  }

  // Collisions — dying planes are no longer valid bullet targets (they're already dead, just animating out).
  const flyingEnemies = enemies.filter(e => e.alive && e.state !== 'crashed' && e.state !== 'dying');
  const crashedOrDeadEnemies = enemies.filter(e => !(e.alive && e.state !== 'crashed' && e.state !== 'dying'));
  const collision = resolveBulletPlaneHits(newBulletList, player, flyingEnemies, pilots);

  // ---- Score plane kills as well as pilot kills ----
  // Count enemies that transitioned alive→dead this tick (regardless of cause: bullets,
  // ground crash, ceiling, fire-burn, bomb, rocket, flame). Subtract any that ejected — they got away.
  const wasPlayerAliveBefore = state.player.alive;
  const enemyAliveCountBefore = state.enemies.filter(e => e.alive).length;
  const enemyAliveCountAfter = collision.enemies.filter(e => e.alive).length;
  const enemyEjectsThisTick = ejectedThisTick.length;
  const enemiesKilledThisTick = Math.max(0, enemyAliveCountBefore - enemyAliveCountAfter - enemyEjectsThisTick);

  player = collision.player;
  pilots = collision.pilots;
  playerScore += collision.playerScoreDelta + enemiesKilledThisTick;
  enemyScore += collision.enemyScoreDelta;

  // If the player plane just died this tick AND they didn't choose to eject → +1 to enemy.
  if (wasPlayerAliveBefore && !player.alive && !playerEjectedThisTick) {
    enemyScore += 1;
  }

  // Recombine enemies and map dead-but-uncrashed-and-not-dying ones to the 'crashed' state
  // (e.g. ground crash or fire-burn deaths that bypass the bullet/explosion 'dying' path).
  enemies = [...collision.enemies, ...crashedOrDeadEnemies].map(e => {
    if (!e.alive && e.state !== 'crashed' && e.state !== 'dying') {
      return { ...e, state: 'crashed' as const, respawnTimer: ENEMY_RESPAWN_DELAY_SEC };
    }
    return e;
  });

  if (!player.alive && player.state !== 'crashed' && player.state !== 'dying') {
    player = { ...player, state: 'crashed', respawnTimer: RESPAWN_DELAY_SEC };
  }

  // === Plane-vs-plane collision (Phase 5) ===
  // Run after bullet collisions + recombine so the resolver sees the authoritative
  // alive/state of each plane this tick. Events drive VFX (sparks/shake/RAM!).
  const planeCol = resolvePlanePlaneCollisions(
    player,
    enemies,
    state.planeCollisionCooldowns,
    rngState,
    state.collisionDamageMultiplier,
  );
  player = planeCol.player;
  enemies = planeCol.enemies;
  const planeCollisionEvents = planeCol.events;
  const planeCollisionCooldowns = planeCol.newCooldowns;

  // Score from plane-vs-plane collisions:
  //   - enemy dies in collision involving player  → +1 player (whether or not player survived)
  //   - player dies in collision, enemy survives  → +1 enemy (the standard "player died this
  //                                                  tick" credit at line ~796 ran BEFORE the
  //                                                  collision resolver, so it misses this case)
  for (const ev of planeCollisionEvents) {
    const playerIsA = ev.aFaction === 'player';
    const playerIsB = ev.bFaction === 'player';
    const playerInvolved = playerIsA || playerIsB;
    if (!playerInvolved) continue;
    const enemyDied = (playerIsA && ev.bDied) || (playerIsB && ev.aDied);
    const playerDied = (playerIsA && ev.aDied) || (playerIsB && ev.bDied);
    if (enemyDied) playerScore++;
    if (playerDied) enemyScore++;
  }

  const bossWasAliveBefore = state.enemies.some(e => e.isBoss && e.alive);
  const bossDestroyedThisTick = bossWasAliveBefore && enemies.some(e => e.isBoss && !e.alive);
  if (bossDestroyedThisTick) {
    playerScore = Math.max(playerScore, PLAYER_SCORE_TO_WIN);
  }

  // Pilot lifecycle resolution
  const survivingPilots: Pilot[] = [];
  for (const pp of pilots) {
    if (pp.faction === 'player') {
      if (pp.state === 'safe') {
        // Player pilot reached own hangar → respawn player plane, drop pilot.
        player = resetToRunway(player, worldWidth, worldHeight);
        pilotEjectTimeSec = 0;
        continue;
      }
      if (pp.state === 'dead' && pp.deathTimer <= 0) {
        if (pilotEjectTimeSec >= PLANE_RESPAWN_AFTER_PILOT_DEATH) {
          player = resetToRunway(player, worldWidth, worldHeight);
          pilotEjectTimeSec = 0;
          continue;
        } else {
          survivingPilots.push({ ...pp, deathTimer: 0 });
          continue;
        }
      }
      survivingPilots.push(pp);
    } else {
      // enemy pilot
      if (pp.state === 'safe') {
        // Enemy pilot reached own hangar — drop it; the enemy plane respawn loop
        // below will spawn a fresh enemy once livingEnemyCount hits 0.
        continue;
      }
      if (pp.state === 'dead' && pp.deathTimer <= 0) {
        continue;
      }
      survivingPilots.push(pp);
    }
  }
  pilots = survivingPilots;

  // Drop fully-expired crashed enemies, then ensure one enemy exists.
  // BUT — don't spawn a fresh enemy plane while an enemy pilot is still in play.
  const droppedEnemies = enemies.filter(e => (e.state === 'crashed' && e.respawnTimer <= 0));
  for (const e of droppedEnemies) {
    state.enemyAiStates.delete(e.id);
    state.prevEnemyHp.delete(e.id);
  }
  enemies = enemies.filter(e => !(e.state === 'crashed' && e.respawnTimer <= 0));

  const newTime = state.timeSec + TICK_DT;
  const enemyPilotInPlay = findPilot(pilots, 'enemy') !== undefined;
  const targetEnemies = targetEnemyCount(state.difficulty, newTime, playerScore);
  while (!state.disableAutoEnemySpawn && !caravan && enemies.length < targetEnemies && newTime > 1.0 && !enemyPilotInPlay) {
    nextEntityId = Math.max(nextEntityId, 1 + Math.max(
      player.id,
      ...enemies.map(e => e.id),
      ...pilots.map(p => p.id),
      ...newBulletList.map(b => b.id),
      ...state.bombs.map(b => b.id),
      ...state.rockets.map(r => r.id),
    ));
    enemies.push(spawnEnemy(
      nextEntityId,
      baseParams.hpMultiplier,
      worldWidth,
      worldHeight,
      player.kinematic.position,
      enemies.length
    ));
    nextEntityId++;
  }

  // Blimp drift (decorative — wraps horizontally)
  let blimpX = state.blimp.position.x + state.blimp.velocity.x * TICK_DT;
  if (blimpX > WORLD_WIDTH + 100) blimpX = -100;
  if (blimpX < -100) blimpX = WORLD_WIDTH + 100;
  const blimp = {
    ...state.blimp,
    position: { x: blimpX, y: state.blimp.position.y },
  };

  // ---- Caravan Escort Mission logic ----
  if (caravan && caravan.active) {
    // 1. Move caravan
    const nextCaravanPos = {
      x: caravan.position.x + caravan.velocity.x * TICK_DT,
      y: caravan.position.y + caravan.velocity.y * TICK_DT,
    };
    
    // 2. Resolve bullet collisions against caravan
    let caravanHp = caravan.hp;
    const caravanDamageMultiplier = caravan.incomingDamageMultiplier ?? 1;
    const CARAVAN_HIT_RADIUS = 50;
    const remainingBulletsAfterCaravan: Bullet[] = [];
    for (const b of collision.bullets) {
      if (b.ownerFaction === 'enemy') {
        const dx = b.position.x - nextCaravanPos.x;
        const dy = b.position.y - nextCaravanPos.y;
        if (dx * dx + dy * dy < CARAVAN_HIT_RADIUS * CARAVAN_HIT_RADIUS) {
          caravanHp = Math.max(0, caravanHp - b.damage * caravanDamageMultiplier);
          continue;
        }
      }
      remainingBulletsAfterCaravan.push(b);
    }
    collision.bullets = remainingBulletsAfterCaravan;

    // 3. Resolve explosion collisions against caravan
    for (const expPos of nextExplosionEvents) {
      const dx = expPos.x - nextCaravanPos.x;
      const dy = expPos.y - nextCaravanPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 100) {
        const damage = 40 * (1 - dist / 100);
        caravanHp = Math.max(0, caravanHp - damage * caravanDamageMultiplier);
      }
    }

    caravan = {
      ...caravan,
      position: nextCaravanPos,
      hp: caravanHp,
    };
  }

  const earnedXp = (enemiesKilledThisTick + collision.playerScoreDelta) * XP_PER_KILL_LIGHT;
  let xpCollected = state.xpCollected + earnedXp;
  let level = state.level;
  let pendingLevelUp = false;
  const nextThreshold = LEVEL_UP_THRESHOLDS[level - 1];
  if (nextThreshold !== undefined && xpCollected >= nextThreshold) {
    level += 1;
    pendingLevelUp = true;
  }

  const caravanDead = caravan !== undefined && caravan.active && caravan.hp <= 0;

  return {
    ...state,
    timeSec: newTime,
    tickCount: state.tickCount + 1,
    nextEntityId,
    rngState,
    player,
    enemies,
    bullets: collision.bullets,
    bombs: activeBombs,
    rockets: activeRockets,
    homingRocketTimer,
    droneTimer,
    explosionEvents: nextExplosionEvents,
    pilots,
    pilotEjectTimeSec,
    playerScore,
    enemyScore,
    blimp,
    xpCollected,
    level,
    pendingLevelUp,
    gameOver: playerScore >= PLAYER_SCORE_TO_WIN || enemyScore >= ENEMY_SCORE_TO_LOSE || caravanDead,
    planeCollisionCooldowns,
    planeCollisionEvents,
    caravan,
  };
}
