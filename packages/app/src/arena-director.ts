export interface FinalBossSpawnState {
  playerScore: number;
  finalBossScore: number;
  bossAlreadySpawned: boolean;
  gameOver: boolean;
  pendingLevelUp: boolean;
  choicesShowing: boolean;
}

export type ArenaRoundPhase = 'takeoff' | 'duel' | 'upgradeDelay' | 'upgrade' | 'victoryFlight';

export interface ArenaDuelFlowState {
  phase: ArenaRoundPhase;
  round: number;
  previousScore: number;
  currentScore: number;
  enemyAliveCount: number;
  playerPilotActive: boolean;
  choicesShowing: boolean;
  gameOver: boolean;
  upgradeDelaySec: number;
  requiredUpgradeDelaySec: number;
  victoryFlightSec: number;
  requiredVictoryFlightSec: number;
}

export interface ArenaDuelFlowResult {
  phase: ArenaRoundPhase;
  round: number;
  shouldShowUpgrade: boolean;
  shouldLaunchNextRound: boolean;
  shouldStartVictoryFlight: boolean;
}

export interface ArenaEnemyResolutionState {
  alive: boolean;
  state: string;
}

export function countUnresolvedArenaEnemies(enemies: readonly ArenaEnemyResolutionState[]) {
  return enemies.filter(enemy => enemy.state !== 'crashed').length;
}

export function shouldSpawnArenaFinalBoss(state: FinalBossSpawnState) {
  return (
    state.playerScore >= state.finalBossScore &&
    !state.bossAlreadySpawned &&
    !state.gameOver &&
    !state.pendingLevelUp &&
    !state.choicesShowing
  );
}

export function shouldHoldArenaAutoSpawnForFinalBoss(
  state: Pick<FinalBossSpawnState, 'playerScore' | 'finalBossScore' | 'gameOver'>,
) {
  return state.playerScore >= state.finalBossScore && !state.gameOver;
}

export function arenaEnemyHpMultiplierForRound(round: number): number {
  return 1.15 * Math.pow(1.42, Math.max(0, round - 1));
}

export function arenaEnemyCountForRound(round: number): number {
  return Math.min(5, 1 + Math.floor(Math.max(0, round - 1) / 2));
}

export function arenaDifficultyForRound(round: number): 'easy' | 'medium' | 'hard' {
  if (round <= 1) return 'easy';
  if (round <= 4) return 'medium';
  return 'hard';
}

export function resolveArenaDuelFlow(state: ArenaDuelFlowState): ArenaDuelFlowResult {
  if (state.gameOver) {
    return {
      phase: state.phase,
      round: state.round,
      shouldShowUpgrade: false,
      shouldLaunchNextRound: false,
      shouldStartVictoryFlight: false,
    };
  }

  if (
    state.phase === 'duel'
    && state.enemyAliveCount === 0
    && !state.playerPilotActive
    && !state.choicesShowing
  ) {
    return {
      phase: 'upgradeDelay',
      round: state.round,
      shouldShowUpgrade: false,
      shouldLaunchNextRound: false,
      shouldStartVictoryFlight: true,
    };
  }

  if (
    state.phase === 'upgradeDelay'
    && state.upgradeDelaySec >= state.requiredUpgradeDelaySec
    && !state.playerPilotActive
    && !state.choicesShowing
  ) {
    return {
      phase: 'upgrade',
      round: state.round,
      shouldShowUpgrade: true,
      shouldLaunchNextRound: false,
      shouldStartVictoryFlight: false,
    };
  }

  if (
    state.phase === 'victoryFlight'
    && state.victoryFlightSec >= state.requiredVictoryFlightSec
    && !state.playerPilotActive
    && !state.choicesShowing
  ) {
    return {
      phase: 'takeoff',
      round: state.round + 1,
      shouldShowUpgrade: false,
      shouldLaunchNextRound: true,
      shouldStartVictoryFlight: false,
    };
  }

  if (state.phase === 'upgrade' && !state.choicesShowing) {
    return {
      phase: 'takeoff',
      round: state.round + 1,
      shouldShowUpgrade: false,
      shouldLaunchNextRound: true,
      shouldStartVictoryFlight: false,
    };
  }

  return {
    phase: state.phase,
    round: state.round,
    shouldShowUpgrade: false,
    shouldLaunchNextRound: false,
    shouldStartVictoryFlight: false,
  };
}
