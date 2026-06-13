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
  | 'gatling_evolution'
  | 'tracer_belt'
  | 'cluster_bomb'
  | 'coolant_injector'
  | 'boost_supercharger'
  | 'reinforced_struts'
  | 'chico_wing'
  | 'fire_screen'
  | 'redline_engine';

export interface UpgradeDef {
  id: UpgradeId;
  title: string;
  description: string;
  category: 'weapon' | 'plane' | 'passive' | 'companion';
  isEvolution: boolean;
  evolutionRequires?: UpgradeId[]; // both must be present
}

export const UPGRADE_DEFS: UpgradeDef[] = [
  { id: 'damage_plus_25', title: '+25% урона', description: 'Пули заметно больнее пробивают врага.', category: 'passive', isEvolution: false },
  { id: 'damage_plus_50', title: '+50% урона', description: 'Главный ствол становится основой билда.', category: 'passive', isEvolution: false },
  { id: 'fire_rate_plus_25', title: '+25% скорострельности', description: 'Пулемет чаще держит врага под давлением.', category: 'passive', isEvolution: false },
  { id: 'fire_rate_plus_50', title: '+50% скорострельности', description: 'Очереди становятся плотнее и опаснее.', category: 'passive', isEvolution: false },
  { id: 'hp_plus_25', title: '+25% прочности', description: 'Фюзеляж переживает больше попаданий.', category: 'plane', isEvolution: false },
  { id: 'hp_plus_50', title: '+50% брони', description: 'Усиленная рама для тяжелых раундов.', category: 'plane', isEvolution: false },
  { id: 'magnet_range_plus', title: 'Магнит опыта', description: 'Легче собирать опыт после рискованных атак.', category: 'passive', isEvolution: false },
  { id: 'drone_wingman', title: 'Ведомый дрон', description: 'Малый помощник стреляет рядом с тобой.', category: 'companion', isEvolution: false },
  { id: 'piercing_bullets', title: 'Бронебойные пули', description: 'Пули прошивают одного врага насквозь.', category: 'weapon', isEvolution: false },
  { id: 'heavy_bomb', title: 'Тяжелая бомба', description: 'Кидай бомбы клавишей B или кнопкой бомбы.', category: 'weapon', isEvolution: false },
  { id: 'heavy_cannon', title: 'Тяжелая пушка', description: 'Редкие, но мощные пробивающие выстрелы.', category: 'weapon', isEvolution: false },
  { id: 'homing_rocket', title: 'Самонаводящаяся ракета', description: 'Автоматически выпускает ракету по цели.', category: 'weapon', isEvolution: false },
  { id: 'flame_trail', title: 'Огненный след', description: 'За самолетом остается опасный горящий хвост.', category: 'passive', isEvolution: false },
  { id: 'tracer_belt', title: 'Трассирующая лента', description: 'Пули дольше живут в лобовых атаках.', category: 'weapon', isEvolution: false },
  { id: 'cluster_bomb', title: 'Кассетная бомба', description: 'Взрыв накрывает более широкую зону.', category: 'weapon', isEvolution: false },
  { id: 'coolant_injector', title: 'Инжектор охлаждения', description: 'Форсаж медленнее греет мотор и быстрее остывает.', category: 'plane', isEvolution: false },
  { id: 'boost_supercharger', title: 'Нагнетатель форсажа', description: 'Форсаж толкает сильнее, но требует дисциплины.', category: 'plane', isEvolution: false },
  { id: 'reinforced_struts', title: 'Усиленные стойки', description: 'Больше прочности и меньше урона от таранов.', category: 'plane', isEvolution: false },
  { id: 'gatling_evolution', title: 'Гатлинг', description: 'ЭВОЛЮЦИЯ: непрерывный поток огня.', category: 'weapon', isEvolution: true, evolutionRequires: ['damage_plus_50', 'fire_rate_plus_50'] },
  { id: 'fire_screen', title: 'Огненная завеса', description: 'ЭВОЛЮЦИЯ: бомбы и огненный след создают зону смерти.', category: 'weapon', isEvolution: true, evolutionRequires: ['heavy_bomb', 'flame_trail'] },
  { id: 'chico_wing', title: 'Крыло Чико', description: 'ЭВОЛЮЦИЯ: ведомый и магнит опыта становятся машиной выживания.', category: 'companion', isEvolution: true, evolutionRequires: ['drone_wingman', 'magnet_range_plus'] },
  { id: 'redline_engine', title: 'Красная зона', description: 'ЭВОЛЮЦИЯ: длинные и мощные окна форсажа.', category: 'plane', isEvolution: true, evolutionRequires: ['coolant_injector', 'boost_supercharger'] },

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
  }).sort((a, b) => Number(b.isEvolution) - Number(a.isEvolution));

  if (available.length === 0) return [];
  const n = Math.min(3, available.length);
  return rng.pickN(available, n);
}
