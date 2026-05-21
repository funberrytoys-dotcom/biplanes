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
  type PlayerCommand,
} from '@biplanes/shared';
import { stepPlane, stepPlaneTaxi } from '../physics/plane-physics.js';
import { stepPilotParachute, stepPilotWalking, stepPilotDead } from '../physics/pilot-physics.js';
import { firePlayerWeapon, stepBullets } from '../systems/weapon-system.js';
import { resolveBulletPlaneHits } from '../systems/collision-system.js';
import { aiCommand, aiCommandPilotTarget, createAiState } from '../ai/chase-policy.js';
import { DIFFICULTIES } from '../ai/difficulty.js';
import type { Plane } from '../entities/plane.js';
import type { Pilot, Faction } from '../entities/pilot.js';
import { findPilot } from '../entities/pilot.js';
import type { WorldState } from './world-state.js';

const ENEMY_RESPAWN_DELAY_SEC = 3.0;
const ENEMY_EJECT_CHANCE_PER_SEC = 1.5;  // ~1.5 rolls per sec when burning

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

function spawnEnemy(id: number): Plane {
  return {
    id,
    faction: 'enemy',
    kinematic: {
      position: { x: WORLD_WIDTH - RUNWAY_X, y: RUNWAY_Y },
      velocity: { x: 0, y: 0 },
      heading: Math.PI,
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
  if (state.gameOver) return state;

  let nextEntityId = state.nextEntityId;
  let pilots: Pilot[] = state.pilots.map(p => ({ ...p }));
  let pilotEjectTimeSec = state.pilotEjectTimeSec;
  let playerScore = state.playerScore;
  let enemyScore = state.enemyScore;

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
    if (state.player.state === 'flying' && playerCommand.throttleDelta !== 0) {
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
    if (e.state === 'taxi') {
      cmd = { rotate: taxiPitchUp, fire: false, bomb: false, throttleDelta: 0, eject: false, jump: false };
    } else {
      let aiState = state.enemyAiStates.get(e.id);
      if (!aiState) {
        aiState = createAiState(e.id);
        state.enemyAiStates.set(e.id, aiState);
      }
      const prevHp = state.prevEnemyHp.get(e.id) ?? e.hp;
      // Priority target: ejected player pilot (it's the only target if player plane is down).
      const result = playerPilotForAi
        ? aiCommandPilotTarget(e, playerPilotForAi, params, aiState, prevHp, TICK_DT, state.timeSec)
        : aiCommand(e, player, params, aiState, prevHp, TICK_DT, state.timeSec);
      cmd = result.cmd;
      state.enemyAiStates.set(e.id, result.aiState);
    }
    state.prevEnemyHp.set(e.id, e.hp);

    let stepped = stepPlaneByState(e, { rotate: cmd.rotate }, TICK_DT);
    stepped = applyFireBurn(stepped, TICK_DT);

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
      && Math.random() < ENEMY_EJECT_CHANCE_PER_SEC * TICK_DT
    ) {
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

    return { ...stepped, weaponCooldown: newCooldown };
  });

  // Add any newly-ejected enemy pilots to the list.
  pilots = [...pilots, ...ejectedThisTick];

  // Collisions
  const flyingEnemies = enemies.filter(e => e.alive && e.state !== 'crashed');
  const crashedOrDeadEnemies = enemies.filter(e => !(e.alive && e.state !== 'crashed'));
  const collision = resolveBulletPlaneHits(newBulletList, player, flyingEnemies, pilots);
  player = collision.player;
  pilots = collision.pilots;
  playerScore += collision.playerScoreDelta;
  enemyScore += collision.enemyScoreDelta;

  const collidedEnemies = collision.enemies.map(e => {
    if (!e.alive && e.state !== 'crashed') {
      return { ...e, state: 'crashed' as const, respawnTimer: ENEMY_RESPAWN_DELAY_SEC };
    }
    return e;
  });

  enemies = [...collidedEnemies, ...crashedOrDeadEnemies];

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

  const livingEnemyCount = enemies.length;
  const newTime = state.timeSec + TICK_DT;
  const enemyPilotInPlay = findPilot(pilots, 'enemy') !== undefined;
  if (livingEnemyCount === 0 && newTime > 1.0 && !enemyPilotInPlay) {
    enemies.push(spawnEnemy(nextEntityId));
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

  return {
    ...state,
    timeSec: newTime,
    tickCount: state.tickCount + 1,
    nextEntityId,
    player,
    enemies,
    bullets: collision.bullets,
    pilots,
    pilotEjectTimeSec,
    playerScore,
    enemyScore,
    blimp,
    xpCollected: 0,
    pendingLevelUp: false,
    gameOver: false,
  };
}
