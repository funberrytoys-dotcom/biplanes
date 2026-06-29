/**
 * PERK RUN STATE — the new 32-perk system's per-run bookkeeping (owned perks + category
 * affinity for the offer lean). Mirrors the legacy run-state.ts but keyed by PerkId /
 * PerkCategory, so both systems coexist and the run can be toggled between them.
 */

import { getPerk, type PerkId } from './perks.js';
import { emptyPerkAffinity, type PerkAffinity } from './perk-pool.js';

/** Reroll budget per run (matches the legacy RUN_REROLLS). */
export const PERK_RUN_REROLLS = 1;

export interface PerkRunState {
  picks: PerkId[];           // perks chosen this run, in order (Бронепластины may repeat)
  skips: number;
  rerollsRemaining: number;
  affinity: PerkAffinity;    // +1 per pick in that perk's category (offer lean)
  /** The starting core chosen before wave 1 (granted free); null until chosen. */
  startingCore: PerkId | null;
}

export function createPerkRunState(): PerkRunState {
  return {
    picks: [],
    skips: 0,
    rerollsRemaining: PERK_RUN_REROLLS,
    affinity: emptyPerkAffinity(),
    startingCore: null,
  };
}

/** Record a perk pick: append it and bump its category affinity. Pure. */
export function recordPerkPick(run: PerkRunState, id: PerkId): PerkRunState {
  const cat = getPerk(id).category;
  return {
    ...run,
    picks: [...run.picks, id],
    affinity: { ...run.affinity, [cat]: run.affinity[cat] + 1 },
  };
}

/** Record the free starting-core choice (counts as an owned pick + sets the lean). Pure. */
export function recordStartingCore(run: PerkRunState, id: PerkId): PerkRunState {
  return { ...recordPerkPick(run, id), startingCore: id };
}

export function recordPerkSkip(run: PerkRunState): PerkRunState {
  return { ...run, skips: run.skips + 1 };
}

export function recordPerkReroll(run: PerkRunState): PerkRunState {
  if (run.rerollsRemaining <= 0) throw new Error('no rerolls remaining');
  return { ...run, rerollsRemaining: run.rerollsRemaining - 1 };
}
