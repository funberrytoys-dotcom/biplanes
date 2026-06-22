import { describe, it, expect } from 'vitest';
import { factionUpgradePool } from './faction.js';

describe('faction upgrade pools', () => {
  it('С.О.В. uses the base pool unchanged', () => {
    const sov = factionUpgradePool('sov');
    expect(sov.some(d => d.id === 'chico_wing')).toBe(true);
    expect(sov.some(d => d.id === 'wingman')).toBe(false);
    expect(sov.find(d => d.id === 'damage_plus_25')?.title).toBe('Урон');
  });

  it('Jackals cut С.О.В.-brand/anti-glass cards and add «Ведомый»', () => {
    const jk = factionUpgradePool('jackals');
    const ids = new Set(jk.map(d => d.id));
    expect(ids.has('wingman')).toBe(true);
    expect(ids.has('chico_wing')).toBe(false); // Chico brand — not the Baron's pack
    expect(ids.has('hp_plus_50')).toBe(true);  // heavy brawler — fat armor is on-theme
    expect(ids.has('drone_wingman')).toBe(false); // replaced by «Ведомый»
  });

  it('Jackals re-skin reused cards but keep the same id/effect', () => {
    const jk = factionUpgradePool('jackals');
    const dmg = jk.find(d => d.id === 'damage_plus_25');
    expect(dmg?.title).toBe('Клыкастые патроны'); // re-skinned title
    expect(dmg?.id).toBe('damage_plus_25');        // same id → same engine effect
  });

  it('«Ведомый» is a single commander companion (not a swarm)', () => {
    const w = factionUpgradePool('jackals').find(d => d.id === 'wingman');
    expect(w?.maxStacks).toBe(1);
    expect(w?.category).toBe('companion');
  });
});
