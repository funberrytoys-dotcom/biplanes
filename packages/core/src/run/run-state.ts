import type { UpgradeId } from '../upgrades/upgrade-pool.js';
import type { Branch } from './branches.js';
import { BRANCHES, branchOfUpgrade } from './branches.js';

/** Reroll budget per run (§13.4: one reroll per забег). */
export const RUN_REROLLS = 1;

/** One run = 15 waves, one life. Tracks progression + build affinity. Design §13. */
export interface RunState {
  wave: number;                      // current wave, 1..15
  picks: UpgradeId[];                // upgrades chosen this run, in order
  skips: number;                     // picks the player chose to skip
  rerollsRemaining: number;          // reroll budget left
  affinity: Record<Branch, number>;  // +1 per pick in that branch
}

export function emptyAffinity(): Record<Branch, number> {
  const a = {} as Record<Branch, number>;
  for (const b of BRANCHES) a[b] = 0;
  return a;
}

export function createRunState(): RunState {
  return {
    wave: 1,
    picks: [],
    skips: 0,
    rerollsRemaining: RUN_REROLLS,
    affinity: emptyAffinity(),
  };
}

/** Record an upgrade pick: append it and bump its branch affinity. Pure. */
export function recordPick(run: RunState, id: UpgradeId): RunState {
  const branch = branchOfUpgrade(id);
  return {
    ...run,
    picks: [...run.picks, id],
    affinity: { ...run.affinity, [branch]: run.affinity[branch] + 1 },
  };
}

/** Player skipped the pick (no upgrade, no affinity). Pure. */
export function recordSkip(run: RunState): RunState {
  return { ...run, skips: run.skips + 1 };
}

/** Spend one reroll. Throws if none remain (caller gates on rerollsRemaining). Pure. */
export function recordReroll(run: RunState): RunState {
  if (run.rerollsRemaining <= 0) throw new Error('no rerolls remaining');
  return { ...run, rerollsRemaining: run.rerollsRemaining - 1 };
}

/** Advance to the next wave after a pick is resolved. Pure. */
export function advanceWave(run: RunState): RunState {
  return { ...run, wave: run.wave + 1 };
}
