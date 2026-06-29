/**
 * PERK OFFER / GATING — the «1 из 3» roll for the new 32-perk run system.
 *
 * Anti-imba contract (owner: «глупо получить имбу в самом начале забега»):
 *   1. FOUNDATION GATE — a perk is only offered when ALL its prereqs are owned.
 *   2. WAVE FLOOR      — and the current wave ≥ its minWave (Узлы/Легенды start later).
 *   3. RARITY FREQUENCY — commons are frequent, crowns are rare (base weight by rarity).
 *   4. RECIPE GUARANTEE — once a node/legend has become available, it is GUARANTEED a slot
 *      in the offer (it can't be «stolen» by RNG). Re-guaranteed each pick until taken, so
 *      a player who builds the foundation always gets their crown.
 *   5. CATEGORY LEAN — the starting-core choice biases early offers toward its branch via
 *      affinity weighting.
 *
 * Deterministic given the rng (replay contract): the caller MUST pass a CHILD-seeded rng
 * derived from (runSeed, wave[, rerollIndex]) — never the live combat rng stream.
 */

import {
  PERKS, type PerkCategory, type PerkDef, type PerkId, type PerkRarity,
} from './perks.js';

/** Uniform [0,1) source (createRng's Rng satisfies this). */
export interface PickRng {
  next(): number;
}

/** Base selection weight by rarity — commons frequent, crowns rare. */
export const RARITY_BASE_WEIGHT: Record<PerkRarity, number> = {
  common: 1.0,
  rare: 0.6,
  epic: 0.34,
  legendary: 0.18,
  mythic: 0.12,
};

/** Each affinity point in a perk's category adds this much weight (starting-core lean). */
export const CATEGORY_AFFINITY_WEIGHT = 0.45;

export type PerkAffinity = Record<PerkCategory, number>;

export function emptyPerkAffinity(): PerkAffinity {
  return { gun: 0, rocket: 0, squad: 0, hull: 0, aerobatics: 0 };
}

/** Бронепластины is the single intentional durability stacker (×3 breakpoint). All else ×1. */
export function perkMaxStacks(id: PerkId): number {
  return id === 'broneplastiny' ? 3 : 1;
}

function ownedCount(owned: readonly PerkId[], id: PerkId): number {
  let n = 0;
  for (const o of owned) if (o === id) n++;
  return n;
}

/** Is this perk offerable right now? (faction handled by the caller's pool selection.) */
export function isPerkAvailable(perk: PerkDef, owned: readonly PerkId[], wave: number): boolean {
  if (ownedCount(owned, perk.id) >= perkMaxStacks(perk.id)) return false;
  if (wave < perk.minWave) return false;
  for (const req of perk.prereqs) if (!owned.includes(req)) return false;
  return true;
}

/** The faction's offerable perks at this wave (own faction + Общие), foundation/wave-gated. */
export function availablePerks(
  faction: 'sov' | 'jackals',
  owned: readonly PerkId[],
  wave: number,
): PerkDef[] {
  return PERKS.filter(
    (p) =>
      (p.faction === faction || p.faction === 'common') &&
      isPerkAvailable(p, owned, wave),
  );
}

/** A node/legend whose foundation is now met but that the player doesn't yet own = a crown
 *  owed by the recipe guarantee. Highest tier first, then earliest unlocked (lowest minWave). */
function pendingCrowns(available: readonly PerkDef[]): PerkDef[] {
  const order: Record<string, number> = { legend: 0, node: 1, module: 2, detail: 3 };
  return available
    .filter((p) => p.tier === 'legend' || p.tier === 'node')
    .slice()
    .sort((a, b) => (order[a.tier]! - order[b.tier]!) || (a.minWave - b.minWave) || a.id.localeCompare(b.id));
}

function weightOf(perk: PerkDef, affinity: PerkAffinity): number {
  return RARITY_BASE_WEIGHT[perk.rarity] * (1 + affinity[perk.category] * CATEGORY_AFFINITY_WEIGHT);
}

/** Weighted sample WITHOUT replacement from `pool` into `out`, up to `need`. Deterministic. */
function sampleWeighted(pool: PerkDef[], affinity: PerkAffinity, rng: PickRng, need: number, out: PerkDef[]): void {
  const work = pool.slice();
  for (let k = 0; k < need && work.length > 0; k++) {
    const weights = work.map((p) => weightOf(p, affinity));
    const total = weights.reduce((s, w) => s + w, 0);
    let r = rng.next() * total;
    let idx = 0;
    while (idx < weights.length - 1 && r >= weights[idx]!) {
      r -= weights[idx]!;
      idx++;
    }
    out.push(work[idx]!);
    work.splice(idx, 1);
  }
}

/**
 * Roll `count` (default 3) perk offers for a run pick.
 * Recipe guarantee: the top pending crown takes one slot; the rest are affinity/rarity-weighted.
 */
export function rollPerkOffer(
  faction: 'sov' | 'jackals',
  owned: readonly PerkId[],
  wave: number,
  affinity: PerkAffinity,
  rng: PickRng,
  count = 3,
): PerkDef[] {
  const available = availablePerks(faction, owned, wave);
  if (available.length === 0) return [];

  const out: PerkDef[] = [];

  // 4. RECIPE GUARANTEE — reserve one slot for the owed crown (if any).
  const crowns = pendingCrowns(available);
  if (crowns.length > 0 && count > 1) {
    out.push(crowns[0]!);
  }

  // Fill the rest by weighted sampling, excluding anything already chosen.
  const chosen = new Set(out.map((p) => p.id));
  const rest = available.filter((p) => !chosen.has(p.id));
  sampleWeighted(rest, affinity, rng, count - out.length, out);

  return out;
}
