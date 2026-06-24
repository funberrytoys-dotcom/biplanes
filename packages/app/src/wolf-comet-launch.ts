/**
 * «Волчья комета» deck-launch milestones.
 *
 * The carrier's parked Jackal fighters take off in three scripted beats as the player
 * tears the airship apart (NOT on a timer):
 *   1. APPROACH    — the player flies up to the bridge → the first fighter launches.
 *   2. HALF-TURRETS — 50% of the gun turrets are destroyed → two more launch.
 *   3. BOSS         — the bridge AND the propeller are destroyed → the last one launches,
 *                     and it is the arena-finals boss («Шрам», the red Baron).
 *
 * Pure + deterministic so it can be unit-tested away from the Pixi render loop. The caller
 * tracks which beats have already fired (firedApproach / firedHalfTurrets / firedBoss) and
 * acts on whichever beat this call reports as newly triggered.
 */
export interface WolfCometLaunchInput {
  /** Player has flown within reach of the bridge (conning tower). */
  reachedBridge: boolean;
  /** Total gun turrets on the airship. */
  turretsTotal: number;
  /** Turrets destroyed so far. */
  turretsDead: number;
  /** The bridge-core has been destroyed. */
  bridgeDestroyed: boolean;
  /** The propeller has been destroyed. */
  propellerDestroyed: boolean;
  /** Beats already fired (so each launches exactly once). */
  firedApproach: boolean;
  firedHalfTurrets: boolean;
  firedBoss: boolean;
}

export interface WolfCometLaunchResult {
  approach: boolean;
  halfTurrets: boolean;
  boss: boolean;
}

export function resolveWolfCometLaunch(s: WolfCometLaunchInput): WolfCometLaunchResult {
  return {
    approach: !s.firedApproach && s.reachedBridge,
    halfTurrets:
      !s.firedHalfTurrets &&
      s.turretsTotal > 0 &&
      s.turretsDead >= Math.ceil(s.turretsTotal / 2),
    boss: !s.firedBoss && s.bridgeDestroyed && s.propellerDestroyed,
  };
}
