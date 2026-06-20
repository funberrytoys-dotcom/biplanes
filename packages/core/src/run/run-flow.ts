import { RUN_WAVE_COUNT } from './run-waves.js';

export type RunPhase =
  | 'duel'       // fighting the current wave
  | 'pickDelay'  // brief beat after clearing, before the pick screen
  | 'pick'       // pick screen up, waiting on the player
  | 'complete'   // boss down — run won
  | 'failed';    // player died — run lost

export type RunOutcome = 'won' | 'lost' | null;

export interface RunFlowInput {
  phase: RunPhase;
  wave: number;            // 1..15
  enemyAliveCount: number;
  playerDead: boolean;     // one life — true the moment the player is gone
  pickResolved: boolean;   // player chose or skipped on the pick screen
  pickDelaySec: number;
  requiredPickDelaySec: number;
}

export interface RunFlowResult {
  phase: RunPhase;
  wave: number;
  shouldOfferPick: boolean;
  shouldAdvanceWave: boolean;
  outcome: RunOutcome;
}

function hold(input: RunFlowInput): RunFlowResult {
  return {
    phase: input.phase,
    wave: input.wave,
    shouldOfferPick: false,
    shouldAdvanceWave: false,
    outcome: null,
  };
}

export function resolveRunFlow(input: RunFlowInput): RunFlowResult {
  // One life: death ends the run from any active phase. A finished run is sticky.
  if (input.playerDead && input.phase !== 'failed' && input.phase !== 'complete') {
    return { phase: 'failed', wave: input.wave, shouldOfferPick: false, shouldAdvanceWave: false, outcome: 'lost' };
  }

  // Wave cleared.
  if (input.phase === 'duel' && input.enemyAliveCount === 0) {
    if (input.wave >= RUN_WAVE_COUNT) {
      // Boss wave down → run won. No pick after the boss (§13: 14 picks total).
      return { phase: 'complete', wave: input.wave, shouldOfferPick: false, shouldAdvanceWave: false, outcome: 'won' };
    }
    return { phase: 'pickDelay', wave: input.wave, shouldOfferPick: false, shouldAdvanceWave: false, outcome: null };
  }

  // Pick beat elapsed → raise the pick screen.
  if (input.phase === 'pickDelay' && input.pickDelaySec >= input.requiredPickDelaySec) {
    return { phase: 'pick', wave: input.wave, shouldOfferPick: true, shouldAdvanceWave: false, outcome: null };
  }

  // Pick resolved (chosen or skipped) → advance to the next wave.
  if (input.phase === 'pick' && input.pickResolved) {
    return { phase: 'duel', wave: input.wave + 1, shouldOfferPick: false, shouldAdvanceWave: true, outcome: null };
  }

  return hold(input);
}
