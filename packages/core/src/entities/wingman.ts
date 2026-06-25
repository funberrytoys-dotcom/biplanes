import type { EntityId } from '@biplanes/shared';
import { WINGMAN_HP } from '@biplanes/shared';
import type { Plane } from './plane.js';

/**
 * Spawn a «Ведомый» — an AI-flown ALLY plane (the Jackal signature module).
 *
 * It is a real plane, not a companion drone: it flies the player's wing, hunts
 * enemies on its own (see the ally loop in tick.ts), and is MORTAL — it has its
 * own HP and dies when shot down. The host clears wingmen between rounds, so a
 * downed wingman stays gone until the next round relaunches a fresh one.
 *
 * `index` fans multiple wingmen out behind the player into a loose vee. `heavy`
 * gives it the fat Jackal "ball" gun (set when the player flies Алые Шакалы).
 */
export function createWingman(
  id: EntityId,
  player: Plane,
  index: number,
  heavy: boolean,
): Plane {
  const pk = player.kinematic;
  const side = index % 2 === 0 ? 1 : -1;
  const rank = Math.floor(index / 2) + 1;
  // Loose vee just behind the player, on the side away from the nose.
  const back = pk.heading + Math.PI;
  const cos = Math.cos(back), sin = Math.sin(back);
  const along = 120 * rank;
  const lateral = 90 * side;
  const x = pk.position.x + cos * along - Math.sin(back) * lateral;
  const y = pk.position.y + sin * along + Math.cos(back) * lateral;
  // Match the player's airborne energy so it doesn't stall on spawn.
  const g = Math.max(pk.g, 360);
  return {
    id,
    faction: 'player',
    kinematic: {
      position: { x, y },
      velocity: { x: Math.cos(pk.heading) * g, y: Math.sin(pk.heading) * g },
      heading: pk.heading,
      throttleOn: true,
      g,
      facing: pk.facing,
      throttle: true,
      throttleLevel: 0.85,
    },
    hp: WINGMAN_HP,
    maxHp: WINGMAN_HP,
    weaponCooldown: 0,
    alive: true,
    state: 'flying',
    respawnTimer: 0,
    heavyGun: heavy,
  };
}
