import { describe, it, expect } from 'vitest';
import { tick } from './tick.js';
import { createWorldState } from './world-state.js';
import { PLANE_INITIAL_HP, type PlayerCommand } from '@biplanes/shared';

// The whole game must be reproducible from (seed, [commands]) — this is the §8 invariant
// that underpins replay, anti-cheat, and the planned multiplayer. These tests run the
// deterministic core directly (no DOM) and assert byte-identical state across runs.

function makePlayer() {
  return {
    id: 1,
    faction: 'player' as const,
    kinematic: {
      position: { x: 500, y: 500 },
      velocity: { x: 1200, y: 0 },
      heading: 0,
      throttleOn: true,
      g: 1200, facing: 1 as const, throttle: true, throttleLevel: 1,
    },
    hp: PLANE_INITIAL_HP,
    maxHp: PLANE_INITIAL_HP,
    weaponCooldown: 0,
    alive: true,
    state: 'flying' as const,
    respawnTimer: 0,
  };
}

// A varied command per tick so firing (RNG bullet spread), rotation, throttle, special
// and boost are all exercised — the more of the sim a tick touches, the stronger the
// determinism guarantee the replay proves.
function commandForTick(i: number): PlayerCommand {
  return {
    rotate: (i % 3 === 0 ? -1 : i % 3 === 1 ? 1 : 0) as -1 | 0 | 1,
    fire: i % 2 === 0,
    bomb: false,
    special: i % 47 === 0,
    boost: i % 31 < 6,
    throttleDelta: (i % 5 === 0 ? 1 : i % 7 === 0 ? -1 : 0) as -1 | 0 | 1,
    eject: false,
    jump: false,
  };
}

function runSequence(seed: number, ticks: number, cmd = commandForTick) {
  let s = createWorldState(seed, makePlayer());
  for (let i = 0; i < ticks; i++) s = tick(s, cmd(i));
  return s;
}

describe('determinism / replay (seed + commands → byte-identical state)', () => {
  it('two runs with the SAME seed and commands produce identical final state', () => {
    const a = runSequence(12345, 700);
    const b = runSequence(12345, 700);
    // toEqual deep-compares including the Maps (enemyAiStates, prevEnemyHp, cooldowns).
    expect(a).toEqual(b);
    // sanity: the run actually did work — time advanced, enemies spawned, RNG consumed.
    expect(a.tickCount).toBe(700);
    expect(a.rngState).not.toBe(12345);
    expect(a.enemies.length).toBeGreaterThan(0);
  });

  it('a DIFFERENT seed diverges (RNG genuinely drives the sim)', () => {
    expect(runSequence(12345, 400)).not.toEqual(runSequence(54321, 400));
  });

  it('the SAME seed but DIFFERENT commands diverge (a run = seed + commands)', () => {
    const base = runSequence(2024, 400);
    const other = runSequence(2024, 400, (i) => ({ ...commandForTick(i), fire: false }));
    expect(base).not.toEqual(other);
  });

  it('tick is pure — it returns a new state without mutating its input', () => {
    const s0 = createWorldState(7, makePlayer());
    const after = tick(s0, commandForTick(0));
    expect(after).not.toBe(s0);
    expect(s0.tickCount).toBe(0);   // input untouched
    expect(after.tickCount).toBe(1);
  });
});
