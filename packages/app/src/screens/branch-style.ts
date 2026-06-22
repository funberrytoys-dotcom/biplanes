import type { Branch, UpgradeId } from '@biplanes/core';
import { branchOfUpgrade } from '@biplanes/core';

export interface BranchStyle {
  branch: Branch;
  color: number;  // signature colour used for the card spine / chips / labels
  label: string;  // short uppercase RU tag
}

/**
 * Signature colour + short label per §13 build branch. Distinct from the rarity
 * palette (which colours the card body) — the branch is a SECOND visual channel
 * shown as a coloured spine + tag, so the player can read "what kind of build is
 * this pick" at a glance.
 */
export const BRANCH_PALETTE: Record<Branch, { color: number; label: string }> = {
  assault: { color: 0xff5a4d, label: 'ШТУРМОВИК' },
  bombardier: { color: 0xff9d2e, label: 'БОМБАРДИР' },
  commander: { color: 0x44c8ff, label: 'КОМАНДИР' },
  hull: { color: 0x6ee0a0, label: 'КОРПУС' },
};

export function branchStyle(branch: Branch): BranchStyle {
  return { branch, ...BRANCH_PALETTE[branch] };
}

export function branchStyleForUpgradeId(id: string): BranchStyle {
  // branchOfUpgrade is typed Branch but returns undefined at runtime for an id not in
  // UPGRADE_BRANCH (e.g. a future faction pick). Fall back to a neutral 'hull' style so
  // the level-up card render never dereferences an undefined palette entry (a throw in
  // the Pixi draw path freezes the game).
  const branch = branchOfUpgrade(id as UpgradeId) as Branch | undefined;
  return branchStyle(branch && BRANCH_PALETTE[branch] ? branch : 'hull');
}
