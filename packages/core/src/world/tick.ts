import { TICK_DT, type PlayerCommand } from '@biplanes/shared';
import { stepPlane } from '../physics/plane-physics.js';
import { firePlayerWeapon, stepBullets } from '../systems/weapon-system.js';
import { resolveBulletPlaneHits } from '../systems/collision-system.js';
import { chasePolicy } from '../ai/chase-policy.js';
import type { WorldState } from './world-state.js';

export function tick(state: WorldState, playerCommand: PlayerCommand): WorldState {
  if (state.gameOver) return state;

  // 1. Player physics + weapon
  const newPlayerKinematic = stepPlane(
    state.player.kinematic,
    { rotate: playerCommand.rotate },
    TICK_DT
  );

  let nextEntityId = state.nextEntityId;
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
  let enemies: typeof state.enemies = state.enemies.map(e => {
    if (!e.alive) return e;
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
  enemies = collision.enemies;

  // 4. Game over check
  const gameOver = !player.alive;

  return {
    ...state,
    timeSec: state.timeSec + TICK_DT,
    tickCount: state.tickCount + 1,
    nextEntityId,
    player,
    enemies,
    bullets: collision.bullets,
    gameOver,
  };
}
