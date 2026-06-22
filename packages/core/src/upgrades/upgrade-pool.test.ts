import { describe, expect, it } from 'vitest';
import { rollUpgradeChoices, type UpgradeId, type UpgradeDef } from './upgrade-pool.js';

const pickFirst = {
  pickN<T>(items: readonly T[], n: number): T[] {
    return items.slice(0, n);
  },
};

describe('rollUpgradeChoices', () => {
  it('keeps offering upgrades across many level-ups (stacking refills the pool)', () => {
    const applied: UpgradeId[] = [];
    for (let i = 0; i < 20; i++) {
      const choices = rollUpgradeChoices(applied, pickFirst);
      expect(choices.length).toBeGreaterThan(0);
      applied.push(choices[0]!.id);
    }
  });

  it('lets a stackable upgrade be taken up to its max, then exhausts it', () => {
    const applied: UpgradeId[] = [];
    const damageAvailable = () =>
      rollUpgradeChoices(applied, { pickN: items => [...items] }).some(u => u.id === 'damage_plus_25');
    for (let i = 0; i < 4; i++) {
      expect(damageAvailable()).toBe(true); // maxStacks: 4
      applied.push('damage_plus_25');
    }
    expect(damageAvailable()).toBe(false);
  });

  it('shows a tier numeral on stackable picks', () => {
    const choices = rollUpgradeChoices(['damage_plus_25'], { pickN: items => [...items] });
    const dmg = choices.find(u => u.id === 'damage_plus_25');
    expect(dmg?.title).toBe('Урон II');
  });

  it('offers enough picks to support gunner, boost, and ordnance builds', () => {
    const ids = rollUpgradeChoices([], { pickN: items => [...items] }).map(u => u.id);
    expect(ids).toContain('heavy_cannon');
    expect(ids).toContain('coolant_injector');
    expect(ids).toContain('homing_rocket');
    expect(ids).toContain('multishot');
  });

  it('unlocks evolutions only when both prerequisites are present', () => {
    expect(rollUpgradeChoices([], { pickN: items => [...items] }).map(u => u.id)).not.toContain('redline_engine');
    const choices = rollUpgradeChoices(['coolant_injector', 'boost_supercharger'], { pickN: items => [...items] });
    expect(choices.map(u => u.id)).toContain('redline_engine');
  });

  it('fails closed (no throw, not offered) for a malformed evolution with no prereq list', () => {
    const malformed: UpgradeDef = {
      id: 'gatling_evolution', title: 'Bad Evo', description: '',
      category: 'weapon', isEvolution: true, // intentionally NO evolutionRequires
    };
    const normal: UpgradeDef = {
      id: 'damage_plus_25', title: 'Dmg', description: '', category: 'weapon', isEvolution: false, maxStacks: 4,
    };
    const pool = [normal, malformed];
    expect(() => rollUpgradeChoices([], { pickN: items => [...items] }, pool)).not.toThrow();
    const ids = rollUpgradeChoices([], { pickN: items => [...items] }, pool).map(u => u.id);
    expect(ids).toContain('damage_plus_25');
    expect(ids).not.toContain('gatling_evolution');
  });
});
