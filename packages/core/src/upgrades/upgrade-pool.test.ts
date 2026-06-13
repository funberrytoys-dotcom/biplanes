import { describe, expect, it } from 'vitest';
import { rollUpgradeChoices, type UpgradeId } from './upgrade-pool.js';

const pickFirst = {
  pickN<T>(items: readonly T[], n: number): T[] {
    return items.slice(0, n);
  },
};

describe('rollUpgradeChoices', () => {
  it('can feed every pre-boss arena level-up with at least one upgrade', () => {
    const applied: UpgradeId[] = [];

    for (let i = 0; i < 14; i++) {
      const choices = rollUpgradeChoices(applied, pickFirst);
      expect(choices.length).toBeGreaterThan(0);
      applied.push(choices[0]!.id);
    }

    expect(new Set(applied).size).toBe(14);
    expect(applied).toContain('gatling_evolution');
  });

  it('offers enough picks to support gunner, boost, and ordnance builds', () => {
    const ids = rollUpgradeChoices([], { pickN: items => [...items] }).map(u => u.id);

    expect(ids).toContain('heavy_cannon');
    expect(ids).toContain('coolant_injector');
    expect(ids).toContain('homing_rocket');
  });

  it('unlocks the boost evolution from its engine prerequisites', () => {
    const choices = rollUpgradeChoices(['coolant_injector', 'boost_supercharger'], { pickN: items => [...items] });

    expect(choices.map(u => u.id)).toContain('redline_engine');
  });
});
