import { UPGRADE_DEFS, upgradeChoiceTitle, type UpgradeDef } from '../upgrades/upgrade-pool.js';
import type { Branch } from './branches.js';
import { branchOfUpgrade } from './branches.js';

/** The run offer only needs a uniform [0,1) source; createRng's Rng satisfies it. */
export interface PickRng {
  next(): number;
}

/** Each affinity point adds this much selection weight to that branch (§13.3 soft-spec). */
export const AFFINITY_WEIGHT = 0.5;

/**
 * Offer 3 upgrade choices for a run pick, biased toward the player's higher-affinity
 * branches. Same availability rules as the arena pool (stack caps, evolution
 * prerequisites). Deterministic given the rng. Stackable picks get their tier numeral.
 *
 * DETERMINISM CONTRACT: the caller MUST pass a CHILD-seeded rng (e.g. derived from
 * `hash(runSeed, wave)`), NOT the live combat `rngState` — otherwise rolling/​re-rolling
 * a pick would consume the replay-critical RNG stream (§13.6). For a re-roll, salt the
 * child seed (e.g. `hash(runSeed, wave, rerollIndex)`).
 *
 * DEFERRED (§13.3, Plan 3): the richer offer guarantees — a guaranteed slot for a
 * freshly-unlocked keystone/evolution (step 3), the "≥1 of 3 from an off-branch"
 * diversification rule (step 4), and pity-weighting (step 6) — are NOT implemented
 * here. This is plain affinity-weighted sampling only.
 */
export function rollRunPickChoices(
  applied: readonly string[],
  affinity: Record<Branch, number>,
  rng: PickRng,
  defs: readonly UpgradeDef[] = UPGRADE_DEFS,
): UpgradeDef[] {
  const timesTaken = (id: string) => applied.filter(a => a === id).length;

  const available = defs.filter(u => {
    const taken = timesTaken(u.id);
    if (taken >= (u.maxStacks ?? 1)) return false;
    if (u.isEvolution) return u.evolutionRequires!.every(req => applied.includes(req));
    return true;
  });

  const n = Math.min(3, available.length);
  const pool = [...available];
  const out: UpgradeDef[] = [];

  for (let k = 0; k < n; k++) {
    const weights = pool.map(d => 1 + affinity[branchOfUpgrade(d.id)] * AFFINITY_WEIGHT);
    const total = weights.reduce((s, w) => s + w, 0);
    let r = rng.next() * total;
    let idx = 0;
    while (idx < weights.length - 1 && r >= weights[idx]!) {
      r -= weights[idx]!;
      idx++;
    }
    const def = pool[idx]!;
    out.push(
      (def.maxStacks ?? 1) > 1
        ? { ...def, title: upgradeChoiceTitle(def, timesTaken(def.id) + 1) }
        : def,
    );
    pool.splice(idx, 1);
  }

  return out;
}
