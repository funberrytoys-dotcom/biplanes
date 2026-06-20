import { describe, it, expect } from 'vitest';
import { createRng } from '../rng/mulberry32.js';
import { branchOfUpgrade } from './branches.js';
import { emptyAffinity } from './run-state.js';
import { rollRunPickChoices } from './pick-offer.js';

describe('rollRunPickChoices', () => {
  it('offers 3 distinct choices from a fresh pool', () => {
    const rng = createRng(123);
    const choices = rollRunPickChoices([], emptyAffinity(), rng);
    expect(choices).toHaveLength(3);
    const ids = choices.map(c => c.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('is deterministic for the same seed + inputs', () => {
    const a = rollRunPickChoices([], emptyAffinity(), createRng(42));
    const b = rollRunPickChoices([], emptyAffinity(), createRng(42));
    expect(a.map(c => c.id)).toEqual(b.map(c => c.id));
  });

  it('excludes maxed-out and prereq-locked upgrades (same rules as the arena pool)', () => {
    // gatling_evolution requires damage_plus_50 + fire_rate_plus_50; absent → never offered.
    const rng = createRng(7);
    for (let i = 0; i < 50; i++) {
      const choices = rollRunPickChoices([], emptyAffinity(), createRng(i));
      expect(choices.find(c => c.id === 'gatling_evolution')).toBeUndefined();
    }
    // damage_plus_25 has maxStacks 4; taken 4× → excluded.
    const applied = ['damage_plus_25', 'damage_plus_25', 'damage_plus_25', 'damage_plus_25'];
    const choices = rollRunPickChoices(applied, emptyAffinity(), rng);
    expect(choices.find(c => c.id === 'damage_plus_25')).toBeUndefined();
  });

  it('biases the offer toward a high-affinity branch over many rolls', () => {
    const flat = emptyAffinity();
    const skewed = { ...emptyAffinity(), bombardier: 8 };
    const countBombardier = (aff: typeof flat) => {
      let n = 0;
      for (let seed = 0; seed < 400; seed++) {
        const choices = rollRunPickChoices([], aff, createRng(seed));
        n += choices.filter(c => branchOfUpgrade(c.id) === 'bombardier').length;
      }
      return n;
    };
    expect(countBombardier(skewed)).toBeGreaterThan(countBombardier(flat));
  });

  it('tags stackable choices with their next tier numeral', () => {
    // Take damage_plus_25 once; the next offer of it should read "Урон II".
    const choices = rollRunPickChoices(['damage_plus_25'], emptyAffinity(), createRng(5));
    const dmg = choices.find(c => c.id === 'damage_plus_25');
    if (dmg) expect(dmg.title).toMatch(/II/);
  });
});
