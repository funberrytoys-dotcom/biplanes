import { TICK_DT, type PlayerCommand } from '@biplanes/shared';
import { stepPlane } from '../physics/plane-physics.js';
import type { WorldState } from './world-state.js';

export function tick(state: WorldState, playerCommand: PlayerCommand): WorldState {
  // Step 1: Advance player physics
  const newPlayerKinematic = stepPlane(
    state.player.kinematic,
    { rotate: playerCommand.rotate },
    TICK_DT
  );

  const newPlayer = {
    ...state.player,
    kinematic: newPlayerKinematic,
    weaponCooldown: Math.max(0, state.player.weaponCooldown - TICK_DT),
  };

  // Future tasks add: enemies stepping, bullets advancing, collisions, spawning, XP, etc.

  return {
    ...state,
    timeSec: state.timeSec + TICK_DT,
    tickCount: state.tickCount + 1,
    player: newPlayer,
  };
}
