import { describe, it, expect } from 'vitest';
import { tick } from './tick.js';
import { createWorldState } from './world-state.js';
import { TICK_DT, PLANE_INITIAL_HP } from '@biplanes/shared';

function makePlayer() {
  return {
    id: 1,
    faction: 'player' as const,
    kinematic: {
      position: { x: 500, y: 500 },
      velocity: { x: 200, y: 0 },
      heading: 0,
      throttleOn: true,
    },
    hp: PLANE_INITIAL_HP,
    maxHp: PLANE_INITIAL_HP,
    weaponCooldown: 0,
    alive: true,
  };
}

describe('world tick', () => {
  it('advances time', () => {
    const s = createWorldState(42, makePlayer());
    const after = tick(s, { rotate: 0, fire: false, bomb: false });
    expect(after.timeSec).toBeCloseTo(TICK_DT);
    expect(after.tickCount).toBe(1);
  });

  it('moves player plane based on physics', () => {
    const s = createWorldState(42, makePlayer());
    const after = tick(s, { rotate: 0, fire: false, bomb: false });
    expect(after.player.kinematic.position.x).toBeGreaterThan(500);
  });

  it('is deterministic for same input', () => {
    const s = createWorldState(42, makePlayer());
    const a = tick(s, { rotate: 1, fire: false, bomb: false });
    const b = tick(s, { rotate: 1, fire: false, bomb: false });
    expect(a).toEqual(b);
  });

  it('does not mutate input state', () => {
    const s = createWorldState(42, makePlayer());
    const before = JSON.stringify(s);
    tick(s, { rotate: 1, fire: false, bomb: false });
    expect(JSON.stringify(s)).toBe(before);
  });
});
