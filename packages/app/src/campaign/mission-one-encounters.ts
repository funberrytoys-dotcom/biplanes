export type MissionOneEnemyRole = 'chase-player' | 'attack-caravan';

export interface MissionOneSpawnGroup {
  count: number;
  role: MissionOneEnemyRole;
}

export interface MissionOneBossPlan extends MissionOneSpawnGroup {
  hpMultiplier: number;
  retreatHpFraction: number;
}

const WAVE_PLANS: Record<string, MissionOneSpawnGroup[]> = {
  'first-claws': [
    { count: 2, role: 'chase-player' },
  ],
  'deck-raiders': [
    { count: 1, role: 'chase-player' },
    { count: 1, role: 'attack-caravan' },
  ],
  'high-dive': [
    { count: 2, role: 'chase-player' },
    { count: 1, role: 'attack-caravan' },
  ],
  crossfire: [
    { count: 2, role: 'chase-player' },
    { count: 1, role: 'attack-caravan' },
  ],
  'caravan-hunters': [
    { count: 1, role: 'chase-player' },
    { count: 2, role: 'attack-caravan' },
  ],
  'fog-cutters': [
    { count: 2, role: 'chase-player' },
    { count: 1, role: 'attack-caravan' },
  ],
  underbelly: [
    { count: 2, role: 'chase-player' },
    { count: 2, role: 'attack-caravan' },
  ],
  'carrier-screen': [
    { count: 2, role: 'chase-player' },
    { count: 2, role: 'attack-caravan' },
  ],
  'last-screen': [
    { count: 1, role: 'chase-player' },
    { count: 2, role: 'attack-caravan' },
  ],
};

const BOSS_PLAN: MissionOneBossPlan = {
  count: 1,
  role: 'attack-caravan',
  hpMultiplier: 5,
  retreatHpFraction: 0.35,
};

export function getMissionOneWavePlan(waveId: string): MissionOneSpawnGroup[] {
  return WAVE_PLANS[waveId] ?? [{ count: 1, role: 'chase-player' }];
}

export function getMissionOneBossPlan(): MissionOneBossPlan {
  return BOSS_PLAN;
}
