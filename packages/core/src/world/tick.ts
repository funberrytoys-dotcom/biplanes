import {
  TICK_DT,
  XP_PER_KILL_LIGHT,
  LEVEL_UP_THRESHOLDS,
  type PlayerCommand,
} from '@biplanes/shared';
import { stepPlane } from '../physics/plane-physics.js';
import { firePlayerWeapon, stepBullets } from '../systems/weapon-system.js';
import { resolveBulletPlaneHits } from '../systems/collision-system.js';
import { computeSpawnsThisTick, makeEnemyPlane } from '../systems/spawn-system.js';
import { chasePolicy } from '../ai/chase-policy.js';
import { createRng } from '../rng/mulberry32.js';
import type { WorldState } from './world-state.js';

export function tick(state: WorldState, playerCommand: PlayerCommand): WorldState {
  if (state.gameOver || state.pendingLevelUp) return state;

  let nextEntityId = state.nextEntityId;

  // 1. Player physics + weapon
  const newPlayerKinematic = stepPlane(
    state.player.kinematic,
    { rotate: playerCommand.rotate },
    TICK_DT
  );

  const newBulletList = stepBullets(state.bullets);

  // Decrement cooldown every tick regardless of firing
  const decrementedPlayerCooldown = Math.max(0, state.player.weaponCooldown - TICK_DT);
  const fireResult = firePlayerWeapon(
    { ...state.player, weaponCooldown: decrementedPlayerCooldown },
    playerCommand.fire,
    nextEntityId
  );
  if (fireResult.bullet) {
    newBulletList.push(fireResult.bullet);
    nextEntityId++;
  }

  let player = {
    ...state.player,
    kinematic: newPlayerKinematic,
    weaponCooldown: fireResult.newCooldown,
  };

  // 2. Enemy AI + physics + weapons
  let enemies = state.enemies
    .filter(e => e.alive)
    .map(e => {
      const cmd = chasePolicy(e, player);
      const newKin = stepPlane(e.kinematic, { rotate: cmd.rotate }, TICK_DT);
      let newCooldown = Math.max(0, e.weaponCooldown - TICK_DT);

      if (cmd.fire && newCooldown === 0) {
        const fakeForFire = { ...e, weaponCooldown: 0, kinematic: newKin };
        const result = firePlayerWeapon(fakeForFire, true, nextEntityId);
        if (result.bullet) {
          newBulletList.push(result.bullet);
          nextEntityId++;
          newCooldown = result.newCooldown;
        }
      }
      return { ...e, kinematic: newKin, weaponCooldown: newCooldown };
    });

  // 3. Collisions
  const collision = resolveBulletPlaneHits(newBulletList, player, enemies);
  player = collision.player;
  enemies = collision.enemies.filter(e => e.alive);

  // 4. Award XP
  const xpCollected = state.xpCollected + collision.kills * XP_PER_KILL_LIGHT;

  // 5. Level-up check
  let level = state.level;
  let pendingLevelUp = false;
  const nextThreshold = LEVEL_UP_THRESHOLDS[level - 1];
  if (nextThreshold !== undefined && xpCollected >= nextThreshold) {
    level += 1;
    pendingLevelUp = true;
  }

  // 6. Spawning
  const rng = createRng(state.rngState);
  const spawn = computeSpawnsThisTick(state.timeSec + TICK_DT, state.timeSec, rng, player.kinematic.position);
  for (let i = 0; i < spawn.count; i++) {
    enemies.push(makeEnemyPlane(nextEntityId, player.kinematic.position, rng));
    nextEntityId++;
  }

  // Advance RNG state — coarse but deterministic
  let newRngState = state.rngState;
  for (let i = 0; i < spawn.count + 1; i++) newRngState = (newRngState + 0x6d2b79f5) >>> 0;

  return {
    ...state,
    timeSec: state.timeSec + TICK_DT,
    tickCount: state.tickCount + 1,
    nextEntityId,
    rngState: newRngState,
    player,
    enemies,
    bullets: collision.bullets,
    xpCollected,
    level,
    pendingLevelUp,
    gameOver: !player.alive,
  };
}
