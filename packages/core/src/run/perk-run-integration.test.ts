import { describe, it, expect } from 'vitest';
import { createRng } from '../rng/mulberry32.js';
import { createWorldState, type WorldState } from '../world/world-state.js';
import { PLANE_INITIAL_HP } from '@biplanes/shared';
import type { Plane } from '../entities/plane.js';
import { rollPerkOffer } from './perk-pool.js';
import { applyPerk } from './apply-perk.js';
import {
  createPerkRunState, recordStartingCore, recordPerkPick, type PerkRunState,
} from './perk-run-state.js';
import { getPerk, type PerkId } from './perks.js';

function makePlayer(): Plane {
  return {
    id: 1, faction: 'player',
    kinematic: {
      position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, heading: 0, throttleOn: true,
      g: 1200, facing: 1, throttle: true, throttleLevel: 1,
    },
    hp: PLANE_INITIAL_HP, maxHp: PLANE_INITIAL_HP,
    weaponCooldown: 0, alive: true, state: 'flying', respawnTimer: 0,
  };
}

/** Simulate a full 15-wave run on the new system: pick a core, then greedily take the
 *  first offer each wave. Returns the picked sequence + final state for assertions. */
function simulateRun(faction: 'sov' | 'jackals', core: PerkId, seed: number) {
  let state: WorldState = createWorldState(seed, makePlayer());
  state = { ...state, playerFaction: faction };
  let run: PerkRunState = recordStartingCore(createPerkRunState(), core);
  state = applyPerk(state, core);
  const picked: PerkId[] = [core];

  // Across the offer-able run waves (picks happen after waves 1..14).
  for (let wave = 1; wave <= 14; wave++) {
    const rng = createRng((seed ^ (wave * 0x9e3779b9)) >>> 0);
    const offer = rollPerkOffer(faction, run.picks, wave, run.affinity, rng);
    expect(offer.length).toBeGreaterThan(0);
    expect(offer.length).toBeLessThanOrEqual(3);
    expect(new Set(offer.map((p) => p.id)).size).toBe(offer.length); // distinct

    // Anti-imba: early waves (1-2) must never surface an epic/legendary/mythic OFFER.
    if (wave <= 2) {
      for (const p of offer) expect(p.tier === 'detail' || p.tier === 'module').toBe(true);
    }
    // Every offered perk's foundation must be satisfied (gate holds all run long).
    for (const p of offer) {
      for (const req of p.prereqs) expect(run.picks).toContain(req);
    }

    const choice = offer[0]!.id;
    state = applyPerk(state, choice);
    run = recordPerkPick(run, choice);
    picked.push(choice);
  }

  // Modifiers must stay finite & sane after a whole run of stacking.
  expect(Number.isFinite(state.damageMultiplier)).toBe(true);
  expect(state.damageMultiplier).toBeGreaterThan(0);
  expect(Number.isFinite(state.player.maxHp)).toBe(true);
  expect(state.player.maxHp).toBeGreaterThan(0);
  return { picked, state, run };
}

describe('full run on the new 32-perk system', () => {
  it('С.О.В. plays a whole run (gun core) without throwing or breaking gating', () => {
    const { picked } = simulateRun('sov', 'raskrutka', 7);
    expect(picked.length).toBe(15); // 1 core + 14 wave picks
  });

  it('Шакалы play a whole run (heat-cannon core) without throwing or breaking gating', () => {
    const { picked } = simulateRun('jackals', 'domna', 11);
    expect(picked.length).toBe(15);
  });

  it('a squad core unlocks its branch crown by the end of the run (recipe guarantee path)', () => {
    // Starting Осиное гнездо → Полный рой (legend) is reachable; greedy picks should land it.
    const { run } = simulateRun('sov', 'osinoe-gnezdo', 3);
    expect(run.picks).toContain('polnyy-roy');
  });

  it('is fully deterministic — same faction/core/seed → identical pick sequence', () => {
    const a = simulateRun('jackals', 'zveno-asov', 99);
    const b = simulateRun('jackals', 'zveno-asov', 99);
    expect(a.picked).toEqual(b.picked);
  });

  it('never offers a perk whose category leaks the wrong faction over a full run', () => {
    const { run } = simulateRun('sov', 'chistyy-sryv', 5);
    for (const id of run.picks) {
      const f = getPerk(id).faction;
      expect(f === 'sov' || f === 'common').toBe(true);
    }
  });
});
