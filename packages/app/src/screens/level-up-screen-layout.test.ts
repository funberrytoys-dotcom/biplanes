import { describe, expect, it } from 'vitest';
import {
  categoryLabel,
  rarityLabel,
  rarityForUpgrade,
  resolveLevelUpCardLayout,
} from './level-up-screen-layout.js';
import type { UpgradeDef } from '@biplanes/core';

describe('level-up screen layout', () => {
  it('fits three upgrade cards inside a phone landscape viewport', () => {
    const layout = resolveLevelUpCardLayout(932, 430, 3);
    const first = layout.cards[0]!;
    const last = layout.cards[2]!;

    expect(first.x - first.width / 2).toBeGreaterThanOrEqual(18);
    expect(last.x + last.width / 2).toBeLessThanOrEqual(932 - 18);
    expect(first.height).toBeGreaterThanOrEqual(210);
    expect(first.y + first.height / 2).toBeLessThanOrEqual(430 - 18);
    expect(layout.titleY).toBeLessThan(32);
  });

  it('marks evolutions as mythic rarity and plain modules by id', () => {
    const evolution: UpgradeDef = {
      id: 'gatling_evolution',
      title: 'Gatling',
      description: 'Evolution',
      category: 'weapon',
      isEvolution: true,
    };
    const basic: UpgradeDef = {
      id: 'damage_plus_25',
      title: 'Урон',
      description: '+25%',
      category: 'passive',
      isEvolution: false,
      maxStacks: 4,
    };

    expect(rarityForUpgrade(evolution)).toBe('mythic');
    expect(rarityForUpgrade(basic)).toBe('common');
    expect(rarityLabel('mythic')).toBe('МИФИЧЕСКИЙ');
    expect(rarityLabel('common')).toBe('ОБЫЧНЫЙ');
  });

  it('translates upgrade categories into short readable labels', () => {
    expect(categoryLabel('weapon')).toBe('ОРУЖИЕ');
    expect(categoryLabel('plane')).toBe('КОРПУС');
    expect(categoryLabel('passive')).toBe('СИСТЕМА');
    expect(categoryLabel('companion')).toBe('ВЕДОМЫЙ');
  });
});
