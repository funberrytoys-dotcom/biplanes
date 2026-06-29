import { describe, it, expect } from 'vitest';
import { createRng } from '../rng/mulberry32.js';
import {
  rollPerkOffer, availablePerks, isPerkAvailable, emptyPerkAffinity, perkMaxStacks,
} from './perk-pool.js';
import { PERK_BY_ID, type PerkId } from './perks.js';

describe('perk offer / gating (anti-imba)', () => {
  it('offers 3 distinct perks from a fresh wave-1 pool', () => {
    const offer = rollPerkOffer('sov', [], 1, emptyPerkAffinity(), createRng(123));
    expect(offer).toHaveLength(3);
    expect(new Set(offer.map((p) => p.id)).size).toBe(3);
  });

  it('NEVER offers an imba (node/legend) at wave 1 — anti-imba floor', () => {
    for (let seed = 0; seed < 200; seed++) {
      for (const f of ['sov', 'jackals'] as const) {
        const offer = rollPerkOffer(f, [], 1, emptyPerkAffinity(), createRng(seed));
        for (const p of offer) {
          expect(p.tier === 'node' || p.tier === 'legend').toBe(false);
        }
      }
    }
  });

  it('gates a crown behind its foundation: Полный рой needs Осиное гнездо', () => {
    // Without the foundation, the legend is unavailable at any wave.
    expect(isPerkAvailable(PERK_BY_ID['polnyy-roy']!, [], 15)).toBe(false);
    // With the foundation owned and wave past the floor, it becomes available.
    expect(isPerkAvailable(PERK_BY_ID['polnyy-roy']!, ['osinoe-gnezdo'], 8)).toBe(true);
  });

  it('respects the per-perk wave floor (Феникс only from wave 9)', () => {
    expect(isPerkAvailable(PERK_BY_ID['feniks']!, [], 8)).toBe(false);
    expect(isPerkAvailable(PERK_BY_ID['feniks']!, [], 9)).toBe(true);
  });

  it('recipe guarantee: an unlocked crown is always present in the offer', () => {
    // Foundation owned + past the floor → Полный рой is owed and must appear every pick.
    for (let seed = 0; seed < 50; seed++) {
      const offer = rollPerkOffer('sov', ['osinoe-gnezdo'], 10, emptyPerkAffinity(), createRng(seed));
      expect(offer.some((p) => p.id === 'polnyy-roy')).toBe(true);
    }
  });

  it('never leaks the other faction into an offer', () => {
    for (let seed = 0; seed < 100; seed++) {
      const sov = rollPerkOffer('sov', [], 5, emptyPerkAffinity(), createRng(seed));
      expect(sov.some((p) => p.faction === 'jackals')).toBe(false);
      const jak = rollPerkOffer('jackals', [], 5, emptyPerkAffinity(), createRng(seed));
      expect(jak.some((p) => p.faction === 'sov')).toBe(false);
    }
  });

  it('is deterministic for the same seed + inputs', () => {
    const a = rollPerkOffer('sov', [], 4, emptyPerkAffinity(), createRng(42));
    const b = rollPerkOffer('sov', [], 4, emptyPerkAffinity(), createRng(42));
    expect(a.map((p) => p.id)).toEqual(b.map((p) => p.id));
  });

  it('category affinity biases the offer toward that branch over many rolls', () => {
    const countGun = (aff: ReturnType<typeof emptyPerkAffinity>) => {
      let n = 0;
      for (let seed = 0; seed < 300; seed++) {
        const offer = rollPerkOffer('sov', [], 2, aff, createRng(seed));
        n += offer.filter((p) => p.category === 'gun').length;
      }
      return n;
    };
    const flat = emptyPerkAffinity();
    const gunLean = { ...emptyPerkAffinity(), gun: 6 };
    expect(countGun(gunLean)).toBeGreaterThan(countGun(flat));
  });

  it('drops a perk from the pool once maxed (Бронепластины stacks to 3, then leaves)', () => {
    expect(perkMaxStacks('broneplastiny')).toBe(3);
    const maxed: PerkId[] = ['broneplastiny', 'broneplastiny', 'broneplastiny'];
    expect(isPerkAvailable(PERK_BY_ID['broneplastiny']!, maxed, 5)).toBe(false);
    // A single-stack perk leaves after one copy.
    expect(perkMaxStacks('raskrutka')).toBe(1);
    expect(isPerkAvailable(PERK_BY_ID['raskrutka']!, ['raskrutka'], 5)).toBe(false);
  });

  it('availablePerks only returns offerable perks for the faction', () => {
    const avail = availablePerks('jackals', [], 1);
    expect(avail.length).toBeGreaterThan(0);
    expect(avail.every((p) => (p.faction === 'jackals' || p.faction === 'common'))).toBe(true);
    expect(avail.every((p) => p.minWave <= 1)).toBe(true);
  });
});
