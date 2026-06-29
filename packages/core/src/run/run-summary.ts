import type { Branch } from './branches.js';
import { BRANCHES, branchOfUpgrade, keystoneTier } from './branches.js';
import { RUN_WAVE_COUNT } from './run-waves.js';
import type { RunState } from './run-state.js';
import { factionUpgradePool, FACTION_BRANCH_LABEL, type RunFaction } from './faction.js';
import { getPerk, type PerkCategory } from './perks.js';
import type { PerkRunState } from './perk-run-state.js';

export interface RunSummaryBranch {
  branch: Branch;
  label: string;
  affinity: number;
  keystoneTier: number;
  pickTitles: string[];
}

export interface RunSummaryStats {
  kills: number;
  timeSec: number;
}

export interface RunSummary {
  outcome: 'won' | 'lost';
  waveReached: number;
  totalWaves: number;
  totalPicks: number;
  skips: number;
  kills: number;
  timeSec: number;
  branches: RunSummaryBranch[]; // one per branch, sorted by affinity desc
}

export function buildRunSummary(
  run: RunState,
  outcome: 'won' | 'lost',
  stats: RunSummaryStats,
  faction: RunFaction = 'sov',
): RunSummary {
  // Resolve titles + branch labels from the player's FACTION pool, so an Алые Шакалы
  // debrief shows Jackal card names ('Железный дождь', «Ведомый», …) and Jackal branch
  // labels ('Налётчик'…) instead of С.О.В. names or the raw 'wingman' token.
  const titleById: Record<string, string> = Object.fromEntries(
    factionUpgradePool(faction).map(d => [d.id, d.title]),
  );
  const branchLabel = FACTION_BRANCH_LABEL[faction];
  const branches: RunSummaryBranch[] = BRANCHES.map(branch => ({
    branch,
    label: branchLabel[branch],
    affinity: run.affinity[branch],
    keystoneTier: keystoneTier(run.affinity[branch]),
    pickTitles: run.picks
      .filter(id => branchOfUpgrade(id) === branch)
      .map(id => titleById[id] ?? id),
  })).sort((a, b) => b.affinity - a.affinity);

  return {
    outcome,
    waveReached: run.wave,
    totalWaves: RUN_WAVE_COUNT,
    totalPicks: run.picks.length,
    skips: run.skips,
    kills: stats.kills,
    timeSec: stats.timeSec,
    branches,
  };
}

/** The 5 perk categories fold onto the debrief's 4 branch buckets (Пилотаж rides in КОРПУС). */
const PERK_CATEGORY_TO_BRANCH: Record<PerkCategory, Branch> = {
  gun: 'assault', rocket: 'bombardier', squad: 'commander', hull: 'hull', aerobatics: 'hull',
};

/**
 * Debrief for the NEW 32-perk system. The legacy buildRunSummary reads run.picks as
 * UpgradeId[] + Branch affinity, which are empty for a perk run — so a new-system run
 * must use this builder, which reads perkRun.picks (PerkId[]) and groups by category.
 */
export function buildPerkRunSummary(
  run: PerkRunState,
  waveReached: number,
  outcome: 'won' | 'lost',
  stats: RunSummaryStats,
  faction: RunFaction = 'sov',
): RunSummary {
  const affinity: Record<Branch, number> = { assault: 0, bombardier: 0, commander: 0, hull: 0 };
  const picksByBranch: Record<Branch, string[]> = { assault: [], bombardier: [], commander: [], hull: [] };
  for (const id of run.picks) {
    const p = getPerk(id);
    const b = PERK_CATEGORY_TO_BRANCH[p.category];
    affinity[b] += 1;
    picksByBranch[b].push(p.name);
  }
  const branchLabel = FACTION_BRANCH_LABEL[faction];
  const branches: RunSummaryBranch[] = BRANCHES.map(branch => ({
    branch,
    label: branchLabel[branch],
    affinity: affinity[branch],
    keystoneTier: keystoneTier(affinity[branch]),
    pickTitles: picksByBranch[branch],
  })).sort((a, b) => b.affinity - a.affinity);

  return {
    outcome,
    waveReached,
    totalWaves: RUN_WAVE_COUNT,
    totalPicks: run.picks.length,
    skips: run.skips,
    kills: stats.kills,
    timeSec: stats.timeSec,
    branches,
  };
}
