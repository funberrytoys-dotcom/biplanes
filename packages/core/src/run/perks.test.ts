import { describe, it, expect } from 'vitest';
import {
  PERKS, PERK_BY_ID, perksForFaction, startingCoresForFaction, tierRarity,
  type PerkCategory, type PerkId,
} from './perks.js';

const ALL_IDS = new Set(PERKS.map((p) => p.id));

describe('perk catalog', () => {
  it('has exactly 32 perks: 12 С.О.В. + 12 Шакалы + 8 Общих', () => {
    expect(PERKS).toHaveLength(32);
    expect(PERKS.filter((p) => p.faction === 'sov')).toHaveLength(12);
    expect(PERKS.filter((p) => p.faction === 'jackals')).toHaveLength(12);
    expect(PERKS.filter((p) => p.faction === 'common')).toHaveLength(8);
  });

  it('has unique ids and a matching PERK_BY_ID index', () => {
    expect(ALL_IDS.size).toBe(32);
    for (const p of PERKS) expect(PERK_BY_ID[p.id]).toBe(p);
  });

  it('every icon filename is unique and ends in .png', () => {
    const icons = PERKS.map((p) => p.icon);
    expect(new Set(icons).size).toBe(32);
    for (const i of icons) expect(i).toMatch(/\.png$/);
  });

  it('maps tiers to the owner rarity ladder; the two universal crowns are mythic', () => {
    expect(tierRarity('detail')).toBe('common');
    expect(tierRarity('module')).toBe('rare');
    expect(tierRarity('node')).toBe('epic');
    expect(tierRarity('legend')).toBe('legendary');
    expect(PERK_BY_ID['feniks']!.rarity).toBe('mythic');
    expect(PERK_BY_ID['zahvat-tseley']!.rarity).toBe('mythic');
    // Faction legends stay legendary (gold), not mythic.
    expect(PERK_BY_ID['gatling-shtorm']!.rarity).toBe('legendary');
    expect(PERK_BY_ID['grom-pushka']!.rarity).toBe('legendary');
  });

  it('prereqs and synergies only reference real perk ids, never themselves', () => {
    for (const p of PERKS) {
      for (const req of p.prereqs) {
        expect(ALL_IDS.has(req as PerkId)).toBe(true);
        expect(req).not.toBe(p.id);
      }
      for (const syn of p.synergies) {
        expect(ALL_IDS.has(syn as PerkId)).toBe(true);
        expect(syn).not.toBe(p.id);
      }
    }
  });

  it('a faction sees its own perks plus the shared «Общие» (20 each)', () => {
    expect(perksForFaction('sov')).toHaveLength(20);
    expect(perksForFaction('jackals')).toHaveLength(20);
    // No cross-faction leak.
    expect(perksForFaction('sov').some((p) => p.faction === 'jackals')).toBe(false);
    expect(perksForFaction('jackals').some((p) => p.faction === 'sov')).toBe(false);
  });

  it('each faction has a starting core in every category (a real choice of direction)', () => {
    for (const f of ['sov', 'jackals'] as const) {
      const cats = new Set<PerkCategory>(startingCoresForFaction(f).map((p) => p.category));
      // Every faction can open gun / rocket / squad / hull / aerobatics from the start.
      expect(cats.has('gun')).toBe(true);
      expect(cats.has('rocket')).toBe(true);
      expect(cats.has('squad')).toBe(true);
      expect(cats.has('hull')).toBe(true);
      expect(cats.has('aerobatics')).toBe(true);
    }
  });

  it('no prereq cycles (a perk never depends on something that depends back on it)', () => {
    const reaches = (start: PerkId, target: PerkId, seen = new Set<PerkId>()): boolean => {
      if (start === target) return true;
      if (seen.has(start)) return false;
      seen.add(start);
      return PERK_BY_ID[start]!.prereqs.some((r) => reaches(r as PerkId, target, seen));
    };
    for (const p of PERKS) {
      for (const req of p.prereqs) {
        // req must NOT reach back to p.
        expect(reaches(req as PerkId, p.id)).toBe(false);
      }
    }
  });
});
