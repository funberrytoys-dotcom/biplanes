import type { UpgradeId } from '../upgrades/upgrade-pool.js';

export type Branch = 'assault' | 'bombardier' | 'commander' | 'hull';

export const BRANCHES: readonly Branch[] = ['assault', 'bombardier', 'commander', 'hull'] as const;

/** Russian display labels per design spec §13. */
export const BRANCH_LABEL: Record<Branch, string> = {
  assault: 'Штурмовик',
  bombardier: 'Бомбардир',
  commander: 'Командир звена',
  hull: 'Корпус и сила',
};

/**
 * Every existing upgrade tagged to exactly one §13 branch. Typed as
 * Record<UpgradeId, Branch>, so adding/removing an upgrade id is a compile error
 * here until this map is updated — keeps the tagging exhaustive.
 */
export const UPGRADE_BRANCH: Record<UpgradeId, Branch> = {
  // Штурмовик — front-DPS / guns
  damage_plus_25: 'assault',
  damage_plus_50: 'assault',
  fire_rate_plus_25: 'assault',
  fire_rate_plus_50: 'assault',
  tracer_belt: 'assault',
  piercing_bullets: 'assault',
  heavy_cannon: 'assault',
  multishot: 'assault',
  gatling_evolution: 'assault',
  bullet_storm: 'assault',
  // Бомбардир — zonal / rockets / fire
  heavy_bomb: 'bombardier',
  cluster_bomb: 'bombardier',
  homing_rocket: 'bombardier',
  flame_trail: 'bombardier',
  fire_screen: 'bombardier',
  quick_salvo: 'bombardier',
  // Командир звена — drones
  drone_wingman: 'commander',
  chico_wing: 'commander',
  // Корпус и сила — survival / passive
  hp_plus_25: 'hull',
  hp_plus_50: 'hull',
  magnet_range_plus: 'hull',
  reinforced_struts: 'hull',
  coolant_injector: 'hull',
  boost_supercharger: 'hull',
  redline_engine: 'hull',
  lifesteal: 'hull',
};

export function branchOfUpgrade(id: UpgradeId): Branch {
  return UPGRADE_BRANCH[id];
}

/** Affinity thresholds that unlock keystone tiers (design §13.0 / §13.3). */
export const KEYSTONE_THRESHOLDS = [3, 6, 9] as const;

/** How many keystone tiers a given branch affinity has unlocked (0..3). */
export function keystoneTier(affinity: number): number {
  let tier = 0;
  for (const t of KEYSTONE_THRESHOLDS) if (affinity >= t) tier++;
  return tier;
}
