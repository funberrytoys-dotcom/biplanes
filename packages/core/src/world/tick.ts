import { TICK_DT, type PlayerCommand } from '@biplanes/shared';
import { stepPlane } from '../physics/plane-physics.js';
import { firePlayerWeapon, stepBullets } from '../systems/weapon-system.js';
import type { WorldState } from './world-state.js';

export function tick(state: WorldState, playerCommand: PlayerCommand): WorldState {
  // Player physics
  const newPlayerKinematic = stepPlane(
    state.player.kinematic,
    { rotate: playerCommand.rotate },
    TICK_DT
  );

  // Player weapon
  const fireResult = firePlayerWeapon(
    state.player,
    playerCommand.fire,
    state.nextEntityId
  );

  const newBullets = stepBullets(state.bullets);
  if (fireResult.bullet) newBullets.push(fireResult.bullet);

  const newPlayer = {
    ...state.player,
    kinematic: newPlayerKinematic,
    weaponCooldown: fireResult.newCooldown,
  };

  return {
    ...state,
    timeSec: state.timeSec + TICK_DT,
    tickCount: state.tickCount + 1,
    nextEntityId: state.nextEntityId + (fireResult.bullet ? 1 : 0),
    player: newPlayer,
    bullets: newBullets,
  };
}
