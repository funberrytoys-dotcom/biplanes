import type { PlaneState } from '@biplanes/core';
import type { MissionOnePhase } from './mission-one-controller.js';

export type MissionOneOutcome = 'running' | 'victory' | 'caravan-lost' | 'pilot-lost';

export interface MissionOneOutcomeInput {
  phase: MissionOnePhase;
  routeProgress: number;
  bossAlive: boolean;
  playerAlive: boolean;
  playerState: PlaneState;
  playerScore: number;
}

export function resolveMissionOneOutcome(input: MissionOneOutcomeInput): MissionOneOutcome {
  if (input.phase === 'failure') return 'caravan-lost';
  if (!input.playerAlive || input.playerState === 'crashed' || input.playerState === 'dying') {
    return 'pilot-lost';
  }
  if (input.phase === 'victory') return 'victory';
  if (input.routeProgress >= 0.92 && !input.bossAlive && input.playerScore >= 5) return 'victory';
  return 'running';
}
