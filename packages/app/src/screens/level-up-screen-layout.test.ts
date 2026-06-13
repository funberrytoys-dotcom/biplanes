import { describe, expect, it } from 'vitest';
import {
  categoryLabel,
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
    expect(first.height).toBeLessThanOrEqual(196);
    expect(layout.titleY).toBeLessThan(56);
  });

  it('marks evolutions as rare ace modifications', () => {
    const upgrade: UpgradeDef = {
      id: 'gatling_evolution',
      title: 'Gatling',
      description: 'Evolution',
      category: 'weapon',
      isEvolution: true,
    };

    expect(rarityForUpgrade(upgrade)).toBe('ace');
  });

  it('translates upgrade categories into short readable labels', () => {
    expect(categoryLabel('weapon')).toBe('WEAPON');
    expect(categoryLabel('plane')).toBe('AIRFRAME');
    expect(categoryLabel('passive')).toBe('SYSTEM');
    expect(categoryLabel('companion')).toBe('WINGMAN');
  });
});
