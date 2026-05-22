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
  PLANE_RESPAWN_AFTER_PILOT_DEATH,
  ENEMY_HANGAR_X,
  XP_PER_KILL_LIGHT,
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
  type Vec2,
  type PlayerCommand,
} from '@biplanes/shared';
import { stepPlane, stepPlaneTaxi } from '../physics/plane-physics.js';
import { stepPilotParachute, stepPilotWalking, stepPilotDead } from '../physics/pilot-physics.js';
import { firePlayerWeapon, stepBullets } from '../systems/weapon-system.js';
import { resolveBulletPlaneHits, applyExplosionDamage } from '../systems/collision-system.js';
import { aiCommand, aiCommandPilotTarget, createAiState } from '../ai/chase-policy.js';
import { DIFFICULTIES } from '../ai/difficulty.js';
import type { Plane } from '../entities/plane.js';
import type { Pilot, Faction } from '../entities/pilot.js';
import { findPilot } from '../entities/pilot.js';
import type { Bomb } from '../entities/bomb.js';
import type { Rocket } from '../entities/rocket.js';
import type { Bullet } from '../entities/bullet.js';
import { distance, sub, scale, add, normalize, angleOf } from '../math/vec2.js';

import type { WorldState } from './world-state.js';

const ENEMY_RESPAWN_DELAY_SEC = 3.0;
const ENEMY_SCORE_GAME_OVER = 5;

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

function targetEnemyCount(difficulty: WorldState['difficulty'], timeSec: number, playerScore: number): number {
  const difficultyCap = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
  const pressureFromTime = 1 + Math.floor(timeSec / 45);
  const pressureFromKills = 1 + Math.floor(playerScore / 5);
  return Math.min(difficultyCap, Math.max(pressureFromTime, pressureFromKills));
}

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
      throttle: false,
      throttleLevel: 0,  // Plane starts stationary on the runway — player/AI must open throttle.
    },
    hp: p.maxHp,
    alive: true,
    state: 'taxi',
    respawnTimer: 0,
    weaponCooldown: 0,
  };
}

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
    // If pilot taxis past the runway edge without lifting off → crash.
    // Plane is destroyed, point goes to the opposing side via the standard "alive→dead" score path.
    if (kinematic.position.x < 0 || kinematic.position.x > WORLD_WIDTH) {
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
  const newKin = stepPlane(p.kinematic, { rotate: cmd.rotate }, dt);

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

function applyFireBurn(p: Plane, dt: number): Plane {
  if (!p.alive || p.state !== 'flying') return p;
  if (p.hp <= 0) return p;
  if (p.hp / p.maxHp > FIRE_THRESHOLD) return p;
  const newHp = Math.max(0, p.hp - FIRE_BURN_RATE * dt);
  const alive = newHp > 0;
  return { ...p, hp: newHp, alive };
}

function spawnEnemy(id: number, hpMultiplier: number = 1): Plane {
  const maxHp = Math.round(ENEMY_INITIAL_HP_LIGHT * hpMultiplier);
  return {
    id,
    faction: 'enemy',
    kinematic: {
      position: { x: WORLD_WIDTH - RUNWAY_X, y: RUNWAY_Y },
      velocity: { x: 0, y: 0 },
      heading: Math.PI,
      throttleOn: false,
      g: 0,
      facing: -1,
      throttle: false,
      throttleLevel: 0,  // Enemy also starts stationary — AI throttle policy will open it up.
    },
    hp: maxHp,
    maxHp,
    weaponCooldown: 0,
    alive: true,
    state: 'taxi',
    respawnTimer: 0,
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

  let nextEntityId = state.nextEntityId;
  let rngState = state.rngState;
  let pilots: Pilot[] = state.pilots.map(p => ({ ...p }));
  let pilotEjectTimeSec = state.pilotEjectTimeSec;
  let playerScore = state.playerScore;
  let enemyScore = state.enemyScore;
  let playerEjectedThisTick = false;

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
      pp = stepPilotParachute(pp, pilotInput, TICK_DT);
    } else if (pp.state === 'walking') {
      pp = stepPilotWalking(pp, pilotInput, TICK_DT);
    } else if (pp.state === 'dead') {
      pp = stepPilotDead(pp, TICK_DT);
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

    player = stepPlaneByState(playerWithThrottle, { rotate: playerCommand.rotate }, TICK_DT);

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
      const rotate: -1 | 0 | 1 = pp.position.x < ENEMY_HANGAR_X ? 1 : -1;
      return stepPilotParachute(pp, { rotate, jump: false }, TICK_DT);
    }
    if (pp.state === 'walking') {
      const rotate: -1 | 0 | 1 = pp.position.x < ENEMY_HANGAR_X ? 1 : -1;
      return stepPilotWalking(pp, { rotate, jump: false }, TICK_DT);
    }
    if (pp.state === 'dead') {
      return stepPilotDead(pp, TICK_DT);
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
  const params = DIFFICULTIES[state.difficulty];
  const playerPilotForAi = findPilot(pilots, 'player');
  const ejectedThisTick: Pilot[] = [];

  let enemies = state.enemies.map(e => {
    if (e.state === 'crashed') {
      const nextTimer = e.respawnTimer - TICK_DT;
      return { ...e, respawnTimer: nextTimer, alive: false };
    }

    const taxiPitchUp: -1 | 0 | 1 = e.kinematic.facing === 1 ? -1 : 1;
    let cmd: PlayerCommand;
    const wasFlyingThisTick = e.state === 'flying';
    if (e.state === 'taxi') {
      // While taxiing, AI always opens throttle (delta=+1 each tick) and holds pitch-up.
      cmd = { rotate: taxiPitchUp, fire: false, bomb: false, throttleDelta: 1, eject: false, jump: false };
    } else {
      let aiState = state.enemyAiStates.get(e.id);
      if (!aiState) {
        aiState = createAiState(e.id);
        state.enemyAiStates.set(e.id, aiState);
      }
      const prevHp = state.prevEnemyHp.get(e.id) ?? e.hp;
      // Priority target: ejected player pilot (it's the only target if player plane is down).
      const result = playerPilotForAi
        ? aiCommandPilotTarget(e, playerPilotForAi, params, aiState, prevHp, TICK_DT, state.timeSec, wasFlyingThisTick)
        : aiCommand(e, player, params, aiState, prevHp, TICK_DT, state.timeSec, wasFlyingThisTick);
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

    let stepped = stepPlaneByState(eWithThrottle, { rotate: cmd.rotate }, TICK_DT);
    stepped = applyFireBurn(stepped, TICK_DT);

    if (!stepped.alive && stepped.state !== 'crashed') {
      stepped = { ...stepped, state: 'crashed', respawnTimer: ENEMY_RESPAWN_DELAY_SEC };
    }

    let newCooldown = Math.max(0, stepped.weaponCooldown - TICK_DT);

    if (cmd.fire && newCooldown === 0 && stepped.state === 'flying' && stepped.alive) {
      const fakeForFire = { ...stepped, weaponCooldown: 0 };
      const result = firePlayerWeapon(
        fakeForFire, true, nextEntityId,
        params.damageMultiplier,
        params.fireRateMultiplier,
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
      if (roll.value < params.ejectChancePerSec * TICK_DT) {
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
  if (!playerPilotActive && player.state === 'flying' && player.alive && state.appliedUpgradeIds.includes('heavy_bomb')) {
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
    if (nextPos.y >= GROUND_Y) {
      nextPos.y = GROUND_Y;
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
        BOMB_EXPLOSION_RADIUS,
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
    if (nextPos.y >= GROUND_Y) {
      nextPos.y = GROUND_Y;
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

  // Collisions
  const flyingEnemies = enemies.filter(e => e.alive && e.state !== 'crashed');
  const crashedOrDeadEnemies = enemies.filter(e => !(e.alive && e.state !== 'crashed'));
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

  // Recombine enemies and map all dead ones to the 'crashed' state
  enemies = [...collision.enemies, ...crashedOrDeadEnemies].map(e => {
    if (!e.alive && e.state !== 'crashed') {
      return { ...e, state: 'crashed' as const, respawnTimer: ENEMY_RESPAWN_DELAY_SEC };
    }
    return e;
  });

  if (!player.alive && player.state !== 'crashed') {
    player = { ...player, state: 'crashed', respawnTimer: RESPAWN_DELAY_SEC };
  }

  // Pilot lifecycle resolution
  const survivingPilots: Pilot[] = [];
  for (const pp of pilots) {
    if (pp.faction === 'player') {
      if (pp.state === 'safe') {
        // Player pilot reached own hangar → respawn player plane, drop pilot.
        player = resetToRunway(player);
        pilotEjectTimeSec = 0;
        continue;
      }
      if (pp.state === 'dead' && pp.deathTimer <= 0) {
        if (pilotEjectTimeSec >= PLANE_RESPAWN_AFTER_PILOT_DEATH) {
          player = resetToRunway(player);
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
  while (enemies.length < targetEnemies && newTime > 1.0 && !enemyPilotInPlay) {
    enemies.push(spawnEnemy(nextEntityId, params.hpMultiplier));
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

  const earnedXp = (enemiesKilledThisTick + collision.playerScoreDelta) * XP_PER_KILL_LIGHT;
  let xpCollected = state.xpCollected + earnedXp;
  let level = state.level;
  let pendingLevelUp = false;
  const nextThreshold = LEVEL_UP_THRESHOLDS[level - 1];
  if (nextThreshold !== undefined && xpCollected >= nextThreshold) {
    level += 1;
    pendingLevelUp = true;
  }

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
    gameOver: enemyScore >= ENEMY_SCORE_GAME_OVER,
  };
}
