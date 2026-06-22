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
  | 'redline_engine'
  | 'multishot'
  | 'lifesteal'
  | 'quick_salvo'
  | 'bullet_storm'
  | 'wingman'; // Алые Шакалы — signature stackable mirror-plane (Jackal pool only)

export interface UpgradeDef {
  id: UpgradeId;
  title: string;
  description: string;
  category: 'weapon' | 'plane' | 'passive' | 'companion';
  isEvolution: boolean;
  /** How many times this upgrade can be taken (default 1). >1 = stackable tiers. */
  maxStacks?: number;
  evolutionRequires?: UpgradeId[]; // all must be present
}

export const UPGRADE_DEFS: UpgradeDef[] = [
  // --- Stackable stat lines (tiered) ---
  { id: 'damage_plus_25', title: 'Урон', description: '+25% урона по врагу.', category: 'passive', isEvolution: false, maxStacks: 4 },
  { id: 'fire_rate_plus_25', title: 'Скорострельность', description: '+25% темпа стрельбы.', category: 'passive', isEvolution: false, maxStacks: 4 },
  { id: 'hp_plus_25', title: 'Прочность', description: '+25% прочности корпуса.', category: 'plane', isEvolution: false, maxStacks: 3 },
  { id: 'magnet_range_plus', title: 'Полевой ремонт', description: 'Самолёт чинит себя в полёте.', category: 'plane', isEvolution: false, maxStacks: 3 },
  { id: 'tracer_belt', title: 'Трассирующая лента', description: '+15% темпа, пули летят дальше.', category: 'weapon', isEvolution: false, maxStacks: 2 },
  { id: 'coolant_injector', title: 'Инжектор охлаждения', description: 'Форсаж меньше греет, быстрее стынет.', category: 'plane', isEvolution: false, maxStacks: 2 },
  { id: 'boost_supercharger', title: 'Нагнетатель форсажа', description: 'Форсаж толкает сильнее.', category: 'plane', isEvolution: false, maxStacks: 2 },
  { id: 'reinforced_struts', title: 'Усиленные стойки', description: 'Меньше урона от таранов, +прочность.', category: 'plane', isEvolution: false, maxStacks: 2 },

  // --- Big one-shot stat picks ---
  { id: 'damage_plus_50', title: 'Тяжёлые патроны', description: '+50% урона разом.', category: 'passive', isEvolution: false },
  { id: 'fire_rate_plus_50', title: 'Перегретый ствол', description: '+50% темпа разом.', category: 'passive', isEvolution: false },
  { id: 'hp_plus_50', title: 'Броня', description: '+50% прочности разом.', category: 'plane', isEvolution: false },

  // --- Weapon unlocks / new mechanics ---
  { id: 'multishot', title: 'Веер пуль', description: 'Стреляешь веером из нескольких пуль.', category: 'weapon', isEvolution: false, maxStacks: 2 },
  { id: 'lifesteal', title: 'Кровосос', description: 'Каждый сбитый враг латает твой корпус.', category: 'passive', isEvolution: false, maxStacks: 2 },
  { id: 'quick_salvo', title: 'Скорый залп', description: 'Ракетный залп перезаряжается быстрее.', category: 'weapon', isEvolution: false, maxStacks: 2 },
  { id: 'piercing_bullets', title: 'Бронебойные пули', description: 'Пули прошивают одного врага насквозь.', category: 'weapon', isEvolution: false },
  { id: 'heavy_cannon', title: 'Тяжёлая пушка', description: 'Редкие, но мощные пробивающие выстрелы.', category: 'weapon', isEvolution: false },
  { id: 'homing_rocket', title: 'Самонаводящаяся ракета', description: 'Автоматически выпускает ракету по цели.', category: 'weapon', isEvolution: false },
  { id: 'flame_trail', title: 'Огненный след', description: 'За самолётом тянется горящий хвост.', category: 'passive', isEvolution: false },
  { id: 'drone_wingman', title: 'Ведомый дрон', description: 'Дрон летит рядом и стреляет по врагам.', category: 'companion', isEvolution: false },
  { id: 'heavy_bomb', title: 'Ракетный блок', description: 'Залп ракет выпускает на 2 снаряда больше.', category: 'weapon', isEvolution: false },
  { id: 'cluster_bomb', title: 'Тяжёлые БЧ', description: 'Ракеты залпа бьют мощнее и накрывают шире.', category: 'weapon', isEvolution: false },

  // --- Evolutions (need two prerequisites) ---
  { id: 'gatling_evolution', title: 'Гатлинг', description: 'ЭВОЛЮЦИЯ: непрерывный поток огня.', category: 'weapon', isEvolution: true, evolutionRequires: ['damage_plus_50', 'fire_rate_plus_50'] },
  { id: 'bullet_storm', title: 'Свинцовый шквал', description: 'ЭВОЛЮЦИЯ: веер + бешеный темп = стена огня.', category: 'weapon', isEvolution: true, evolutionRequires: ['multishot', 'fire_rate_plus_50'] },
  { id: 'fire_screen', title: 'Огненная завеса', description: 'ЭВОЛЮЦИЯ: залп + огненный след выжигают зону.', category: 'weapon', isEvolution: true, evolutionRequires: ['heavy_bomb', 'flame_trail'] },
  { id: 'chico_wing', title: 'Крыло Чико', description: 'ЭВОЛЮЦИЯ: второй дрон + ускоренный ремонт.', category: 'companion', isEvolution: true, evolutionRequires: ['drone_wingman', 'magnet_range_plus'] },
  { id: 'redline_engine', title: 'Красная зона', description: 'ЭВОЛЮЦИЯ: длинные и мощные окна форсажа.', category: 'plane', isEvolution: true, evolutionRequires: ['coolant_injector', 'boost_supercharger'] },
];

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

/** Display title with a tier numeral for stackable upgrades (e.g., "Урон II"). */
export function upgradeChoiceTitle(def: UpgradeDef, nextTier: number): string {
  if ((def.maxStacks ?? 1) > 1) {
    return `${def.title} ${ROMAN[Math.min(nextTier, ROMAN.length - 1)]}`.trim();
  }
  return def.title;
}

export function rollUpgradeChoices(
  applied: readonly string[],
  rng: { pickN: <T>(items: readonly T[], n: number) => T[] },
  pool: readonly UpgradeDef[] = UPGRADE_DEFS,
): UpgradeDef[] {
  const timesTaken = (id: string) => applied.filter(a => a === id).length;

  const available = pool.filter(u => {
    const taken = timesTaken(u.id);
    if (taken >= (u.maxStacks ?? 1)) return false;
    if (u.isEvolution) {
      // Fail closed: an evolution with no prereq list is malformed and must not be
      // offered for free (and must not throw inside the level-up roll).
      const reqs = u.evolutionRequires;
      return Array.isArray(reqs) && reqs.length > 0 && reqs.every(req => applied.includes(req));
    }
    return true;
  }).sort((a, b) => Number(b.isEvolution) - Number(a.isEvolution));

  if (available.length === 0) return [];
  const n = Math.min(3, available.length);
  // Decorate stackable picks with their tier numeral so the UI shows progression.
  return rng.pickN(available, n).map(def =>
    (def.maxStacks ?? 1) > 1
      ? { ...def, title: upgradeChoiceTitle(def, timesTaken(def.id) + 1) }
      : def
  );
}
