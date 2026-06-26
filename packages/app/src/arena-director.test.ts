import { describe, expect, it } from 'vitest';
import {
  arenaDifficultyForRound,
  arenaEnemyCountForRound,
  arenaEnemyHpMultiplierForRound,
  arenaEnemyRoleForRound,
  arenaEnemyRoleTuning,
  arenaRunRequiresFinalBoss,
  shouldSpawnArenaFinalBossForRound,
  countUnresolvedArenaEnemies,
  resolveArenaDuelFlow,
  runDifficultyForWave,
  shouldClearRunLegacyGameOver,
  shouldEnemyCarryRockets,
  shouldHoldArenaAutoSpawnForFinalBoss,
  shouldSpawnArenaFinalBoss,
} from './arena-director.js';

describe('shouldSpawnArenaFinalBoss', () => {
  const ready = {
    playerScore: 14,
    finalBossScore: 14,
    bossAlreadySpawned: false,
    gameOver: false,
    pendingLevelUp: false,
    choicesShowing: false,
  };

  it('spawns once the final score gate is reached and upgrades are resolved', () => {
    expect(shouldSpawnArenaFinalBoss(ready)).toBe(true);
  });

  it('waits while the upgrade choice is pending', () => {
    expect(shouldSpawnArenaFinalBoss({ ...ready, pendingLevelUp: true })).toBe(false);
    expect(shouldSpawnArenaFinalBoss({ ...ready, choicesShowing: true })).toBe(false);
  });

  it('does not spawn before the final score gate or after the boss already exists', () => {
    expect(shouldSpawnArenaFinalBoss({ ...ready, playerScore: 13 })).toBe(false);
    expect(shouldSpawnArenaFinalBoss({ ...ready, bossAlreadySpawned: true })).toBe(false);
  });

  it('holds ordinary auto-spawn once the final boss gate is reached', () => {
    expect(shouldHoldArenaAutoSpawnForFinalBoss(ready)).toBe(true);
    expect(shouldHoldArenaAutoSpawnForFinalBoss({ ...ready, playerScore: 13 })).toBe(false);
    expect(shouldHoldArenaAutoSpawnForFinalBoss({ ...ready, gameOver: true })).toBe(false);
  });
});

describe('shouldClearRunLegacyGameOver', () => {
  it('clears legacy game-over flags in a live run while the player is still alive', () => {
    expect(shouldClearRunLegacyGameOver({ hasRunSession: true, gameOver: true, playerAlive: true })).toBe(true);
  });

  it('does not clear a real run loss when the player is dead', () => {
    expect(shouldClearRunLegacyGameOver({ hasRunSession: true, gameOver: true, playerAlive: false })).toBe(false);
  });
});

describe('arena duel round flow', () => {
  function baseFlowState() {
    return {
      phase: 'duel' as const,
      round: 1,
      previousScore: 0,
      currentScore: 1,
      enemyAliveCount: 0,
      playerPilotActive: false,
      choicesShowing: false,
      gameOver: false,
      upgradeDelaySec: 0,
      requiredUpgradeDelaySec: 3,
      victoryFlightSec: 0,
      requiredVictoryFlightSec: 3,
    };
  }

  it('keeps the round active while an enemy death animation is still exploding', () => {
    const unresolved = countUnresolvedArenaEnemies([
      { alive: false, state: 'dying' },
      { alive: false, state: 'crashed' },
    ]);

    expect(unresolved).toBe(1);
  });

  it('starts a three-second trophy delay after the enemies in a round fully explode', () => {
    const next = resolveArenaDuelFlow({
      ...baseFlowState(),
    });

    expect(next.phase).toBe('upgradeDelay');
    expect(next.shouldStartVictoryFlight).toBe(true);
    expect(next.shouldShowUpgrade).toBe(false);
    expect(next.shouldLaunchNextRound).toBe(false);
  });

  it('does not open the build choice before the three-second trophy delay is complete', () => {
    const next = resolveArenaDuelFlow({
      ...baseFlowState(),
      phase: 'upgradeDelay',
      upgradeDelaySec: 2.9,
    });

    expect(next.phase).toBe('upgradeDelay');
    expect(next.shouldShowUpgrade).toBe(false);
  });

  it('opens the build choice after three seconds over the cleared arena', () => {
    const next = resolveArenaDuelFlow({
      ...baseFlowState(),
      phase: 'upgradeDelay',
      upgradeDelaySec: 3,
    });

    expect(next.phase).toBe('upgrade');
    expect(next.shouldShowUpgrade).toBe(true);
    expect(next.shouldLaunchNextRound).toBe(false);
  });

  it('launches the next round immediately after the build choice is resolved', () => {
    const next = resolveArenaDuelFlow({
      ...baseFlowState(),
      phase: 'upgrade',
      round: 3,
      previousScore: 2,
      currentScore: 2,
    });

    expect(next.phase).toBe('takeoff');
    expect(next.round).toBe(4);
    expect(next.shouldStartVictoryFlight).toBe(false);
    expect(next.shouldShowUpgrade).toBe(false);
    expect(next.shouldLaunchNextRound).toBe(true);
  });

  it('keeps the duel alive while the player pilot is still trying to reach the hangar', () => {
    const next = resolveArenaDuelFlow({
      ...baseFlowState(),
      phase: 'duel',
      round: 3,
      previousScore: 2,
      currentScore: 3,
      playerPilotActive: true,
    });

    expect(next.phase).toBe('duel');
    expect(next.shouldShowUpgrade).toBe(false);
    expect(next.shouldLaunchNextRound).toBe(false);
  });

  it('ramps enemy toughness without changing the player build', () => {
    expect(arenaEnemyHpMultiplierForRound(1)).toBeLessThan(arenaEnemyHpMultiplierForRound(4));
    expect(arenaEnemyHpMultiplierForRound(6)).toBeGreaterThan(arenaEnemyHpMultiplierForRound(3) * 1.8);
    expect(arenaEnemyCountForRound(1)).toBe(1);
    expect(arenaEnemyCountForRound(5)).toBe(3);
    expect(arenaDifficultyForRound(1)).toBe('easy');
    expect(arenaDifficultyForRound(4)).toBe('medium');
    expect(arenaDifficultyForRound(8)).toBe('hard');
  });

  it('keeps run wave 5 medium instead of suddenly jumping to hard', () => {
    expect(runDifficultyForWave(5)).toBe('medium');
    expect(runDifficultyForWave(6)).toBe('medium');
    expect(runDifficultyForWave(7)).toBe('hard');
  });

  it('delays enemy rockets in run mode until the mid-run', () => {
    expect(shouldEnemyCarryRockets({ role: 'ace', round: 5, lane: 1, isRun: true })).toBe(false);
    expect(shouldEnemyCarryRockets({ role: 'ace', round: 8, lane: 1, isRun: true })).toBe(true);
    expect(shouldEnemyCarryRockets({ role: 'ace', round: 4, lane: 1, isRun: false })).toBe(true);
  });

  it('ramps enemy roles from rookies into hunters and aces', () => {
    expect(arenaEnemyRoleForRound(1, 0)).toBe('rookie');
    expect(arenaEnemyRoleForRound(2, 0)).toBe('hunter');
    expect(arenaEnemyRoleForRound(4, 1)).toBe('ace');
    expect(arenaEnemyRoleForRound(9, 0)).toBe('ace');
    expect(arenaEnemyRoleForRound(9, 0, true)).toBe('boss');
  });

  it('keeps role tuning readable instead of turning enemies into hp walls', () => {
    const rookie = arenaEnemyRoleTuning('rookie');
    const hunter = arenaEnemyRoleTuning('hunter');
    const ace = arenaEnemyRoleTuning('ace');
    const boss = arenaEnemyRoleTuning('boss');

    expect(rookie.hpScale).toBeLessThan(hunter.hpScale);
    expect(ace.weaponCooldownScale).toBeLessThan(hunter.weaponCooldownScale);
    expect(ace.speedScale).toBeGreaterThan(hunter.speedScale);
    expect(boss.visualScale).toBeGreaterThan(ace.visualScale);
    expect(ace.hpScale).toBeLessThanOrEqual(1.18);
  });

  it('requires the final boss gate before the arena can be considered cleared', () => {
    expect(arenaRunRequiresFinalBoss(13, 14)).toBe(false);
    expect(arenaRunRequiresFinalBoss(14, 14)).toBe(true);
  });

  it('spawns the final boss before a normal wave can skip past the win score', () => {
    expect(shouldSpawnArenaFinalBossForRound({
      playerScore: 12,
      finalBossScore: 14,
      playerWinScore: 15,
      roundEnemyCount: 4,
      bossAlreadySpawned: false,
      gameOver: false,
      pendingLevelUp: false,
      choicesShowing: false,
    })).toBe(true);
  });
});
