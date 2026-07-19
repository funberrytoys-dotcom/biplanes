/**
 * «Забег» is one life — the PILOT's life, not the airframe's.
 *
 * A parachute bail is therefore NOT a loss: while the player pilot entity is out
 * (canopy / walking / reached the hangar), the run keeps going — the core will
 * respawn the plane with all upgrades once the pilot walks home. The run is lost
 * the moment the plane goes down with the pilot still inside, or the ejected
 * pilot is killed.
 */
export interface RunLifeSnapshot {
  /** player.alive on the previous frame */
  prevPlayerAlive: boolean;
  /** player.alive now */
  playerAlive: boolean;
  /** a player pilot entity exists in any state (parachute/walking/dead/safe) */
  pilotOut: boolean;
  /** the player pilot is in the 'dead' state */
  pilotDead: boolean;
}

export function runLostThisFrame(s: RunLifeSnapshot): boolean {
  if (s.pilotDead) return true;
  return s.prevPlayerAlive && !s.playerAlive && !s.pilotOut;
}
