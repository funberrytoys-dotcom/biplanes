export type UpgradeId =
  | 'damage_plus_25'
  | 'damage_plus_50'
  | 'fire_rate_plus_25'
  | 'fire_rate_plus_50'
  | 'hp_plus_25'
  | 'hp_plus_50'
  | 'magnet_range_plus'
  | 'drone_wingman'
  | 'piercing_bullets'
  | 'heavy_bomb'
  | 'heavy_cannon'
  | 'homing_rocket'
  | 'flame_trail'
  | 'gatling_evolution';

export interface UpgradeDef {
  id: UpgradeId;
  title: string;
  description: string;
  category: 'weapon' | 'plane' | 'passive' | 'companion';
  isEvolution: boolean;
  evolutionRequires?: UpgradeId[]; // both must be present
}

export const UPGRADE_DEFS: UpgradeDef[] = [
  { id: 'damage_plus_25', title: '+25% Damage', description: 'Bullets hurt more.', category: 'passive', isEvolution: false },
  { id: 'damage_plus_50', title: '+50% Damage', description: 'Bullets hurt a lot more.', category: 'passive', isEvolution: false },
  { id: 'fire_rate_plus_25', title: '+25% Fire Rate', description: 'Shoot faster.', category: 'passive', isEvolution: false },
  { id: 'fire_rate_plus_50', title: '+50% Fire Rate', description: 'Shoot much faster.', category: 'passive', isEvolution: false },
  { id: 'hp_plus_25', title: '+25% Max HP', description: 'Tougher airframe.', category: 'plane', isEvolution: false },
  { id: 'hp_plus_50', title: '+50% Max HP', description: 'Reinforced armor.', category: 'plane', isEvolution: false },
  { id: 'magnet_range_plus', title: 'XP Magnet', description: 'Wider XP pickup range.', category: 'passive', isEvolution: false },
  { id: 'drone_wingman', title: 'Drone Wingman', description: 'A small drone fires alongside you.', category: 'companion', isEvolution: false },
  { id: 'piercing_bullets', title: 'Piercing Bullets', description: 'Bullets pass through one enemy.', category: 'weapon', isEvolution: false },
  { id: 'heavy_bomb', title: 'Heavy Bomb', description: 'Drop bombs using Shift / B.', category: 'weapon', isEvolution: false },
  { id: 'heavy_cannon', title: 'Heavy Cannon', description: 'Slow, high-damage piercing shots.', category: 'weapon', isEvolution: false },
  { id: 'homing_rocket', title: 'Homing Rocket', description: 'Auto-fires seeking missiles at targets.', category: 'weapon', isEvolution: false },
  { id: 'flame_trail', title: 'Flame Trail', description: 'Leaves a burning tail that harms enemies.', category: 'passive', isEvolution: false },
  { id: 'gatling_evolution', title: 'Gatling Gun', description: 'EVOLUTION: continuous stream of fire.', category: 'weapon', isEvolution: true, evolutionRequires: ['damage_plus_50', 'fire_rate_plus_50'] },

];


export function rollUpgradeChoices(
  applied: readonly string[],
  rng: { pickN: <T>(items: readonly T[], n: number) => T[] }
): UpgradeDef[] {
  const available = UPGRADE_DEFS.filter(u => {
    if (applied.includes(u.id)) return false;
    if (u.isEvolution) {
      return u.evolutionRequires!.every(req => applied.includes(req));
    }
    return true;
  });

  if (available.length === 0) return [];
  const n = Math.min(3, available.length);
  return rng.pickN(available, n);
}
