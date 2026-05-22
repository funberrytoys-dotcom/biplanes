import { describe, it, expect } from 'vitest';
import { resolvePlanePlaneCollisions } from './plane-collision.js';
import { PLANE_INITIAL_HP } from '@biplanes/shared';

function plane(id: number, faction: 'player' | 'enemy', x: number, y: number, vx: number, vy: number) {
  return {
    id, faction,
    kinematic: {
      position: { x, y },
      velocity: { x: vx, y: vy },
      heading: 0,
      throttleOn: true,
      g: 0,
      facing: 1 as const,
      throttle: true,
      throttleLevel: 1,
    },
    hp: PLANE_INITIAL_HP, maxHp: PLANE_INITIAL_HP,
    weaponCooldown: 0, alive: true,
    state: 'flying' as const,
    respawnTimer: 0,
  };
}

describe('plane-plane collision', () => {
  it('head-on at full speed kills both', () => {
    const a = plane(1, 'player', 500, 500, 900, 0);
    const b = plane(2, 'enemy', 510, 500, -900, 0);
    const { player, enemies, events } = resolvePlanePlaneCollisions(a, [b], new Map(), 0);
    expect(player.state).toBe('dying');
    expect(enemies[0]!.state).toBe('dying');
    expect(events.length).toBe(1);
  });

  it('tangential brush takes ~30-50 HP only', () => {
    const a = plane(1, 'player', 500, 500, 800, 0);
    const b = plane(2, 'enemy', 520, 510, 800, 50);
    const { player, enemies } = resolvePlanePlaneCollisions(a, [b], new Map(), 0);
    expect(player.alive).toBe(true);
    expect(enemies[0]!.alive).toBe(true);
    expect(player.hp).toBeLessThan(PLANE_INITIAL_HP);
    expect(player.hp).toBeGreaterThan(PLANE_INITIAL_HP - 60);
  });

  it('does not retrigger inside cooldown', () => {
    const a = plane(1, 'player', 500, 500, 900, 0);
    const b = plane(2, 'enemy', 510, 500, -900, 0);
    const cooldowns = new Map<string, number>([['1-2', 20]]);
    const { events } = resolvePlanePlaneCollisions(a, [b], cooldowns, 0);
    expect(events.length).toBe(0);
  });
});
