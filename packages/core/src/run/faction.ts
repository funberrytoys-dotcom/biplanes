import { UPGRADE_DEFS, type UpgradeDef, type UpgradeId } from '../upgrades/upgrade-pool.js';
import type { Branch } from './branches.js';

/** Which faction the player is running. С.О.В. = the original game; Алые Шакалы = the
 *  glass-cannon swarm faction (red planes, reworked builds, the «Ведомый» wingman). */
export type RunFaction = 'sov' | 'jackals';

/** Branch display labels per faction (the engine branches are the same 4). */
export const FACTION_BRANCH_LABEL: Record<RunFaction, Record<Branch, string>> = {
  sov: { assault: 'Штурмовик', bombardier: 'Бомбардир', commander: 'Командир звена', hull: 'Корпус и сила' },
  jackals: { assault: 'Налётчик', bombardier: 'Стервятник', commander: 'Атаман', hull: 'Корпус Барона' },
};

// Cards that DON'T fit the Jackals (cut list from the design council): the С.О.В. hero
// companion, the fat HP burst (anti-glass-cannon), and the basic drone (replaced by «Ведомый»).
const JACKAL_CUT: ReadonlySet<UpgradeId> = new Set<UpgradeId>(['chico_wing', 'hp_plus_50', 'drone_wingman']);

// Re-skin the reused С.О.В. effects with Jackal-flavoured names/text (same id + effect,
// so apply-upgrade / tick / evolution prereqs all keep working unchanged — only display).
const JACKAL_OVERRIDES: Partial<Record<UpgradeId, { title: string; description: string }>> = {
  damage_plus_25: { title: 'Клыкастые патроны', description: '+25% урона — Шакалы бьют первыми и больно.' },
  damage_plus_50: { title: 'Крупный калибр', description: '+50% урона разом — тонко, но злее.' },
  fire_rate_plus_25: { title: 'Бешеный спуск', description: '+25% темпа стрельбы.' },
  fire_rate_plus_50: { title: 'Раскалённый ствол', description: '+50% темпа разом, ствол визжит.' },
  tracer_belt: { title: 'Мародёрская лента', description: '+15% темпа, пули летят дальше и злее.' },
  piercing_bullets: { title: 'Потрошитель', description: 'Пули прошивают одного врага насквозь.' },
  heavy_cannon: { title: 'Костолом', description: 'Редкие, но дробящие броню выстрелы.' },
  multishot: { title: 'Веер клыков', description: 'Стреляешь широким веером — стая не уйдёт.' },
  gatling_evolution: { title: 'Гатлинг Барона', description: 'ЭВОЛЮЦИЯ: непрерывный поток огня, без пауз.' },
  bullet_storm: { title: 'Свинцовый шторм', description: 'ЭВОЛЮЦИЯ: веер + бешеный темп = стена огня.' },
  heavy_bomb: { title: 'Блок «Расплата»', description: 'Залп ракет выпускает на 2 снаряда больше.' },
  cluster_bomb: { title: 'Железный дождь', description: 'Ракеты залпа бьют мощнее и накрывают шире.' },
  homing_rocket: { title: 'Гончая ракета', description: 'Сама находит и рвёт ближайшую цель.' },
  flame_trail: { title: 'Выжженный след', description: 'За самолётом тянется горящий хвост.' },
  fire_screen: { title: 'Погребальный костёр', description: 'ЭВОЛЮЦИЯ: залп + огненный след выжигают зону.' },
  quick_salvo: { title: 'Шакалья перезарядка', description: 'Ракетный залп перезаряжается быстрее.' },
  hp_plus_25: { title: 'Латаный корпус', description: '+25% прочности — всё, что Шакал может себе позволить.' },
  magnet_range_plus: { title: 'Боевой раскрас', description: 'Машина чинит себя в полёте.' },
  reinforced_struts: { title: 'Трофейная обшивка', description: 'Меньше урона от таранов, чуть крепче.' },
  coolant_injector: { title: 'Кровью охлаждённый', description: 'Форсаж меньше греет, быстрее стынет.' },
  boost_supercharger: { title: 'Нитро Барона', description: 'Форсаж толкает заметно сильнее.' },
  redline_engine: { title: 'Красная зона Барона', description: 'ЭВОЛЮЦИЯ: длинные мощные окна форсажа.' },
  lifesteal: { title: 'Кровь за стаю', description: 'Каждый сбитый враг латает твой корпус.' },
};

/** «Ведомый» — the Jackal signature card (Jackal pool only; not in the С.О.В. pool). */
export const WINGMAN_DEF: UpgradeDef = {
  id: 'wingman',
  title: 'Ведомый',
  description: 'Ведомый садится на хвост, повторяет каждое твоё движение и бьёт вдвое.',
  category: 'companion',
  isEvolution: false,
  maxStacks: 4,
};

const JACKAL_DEFS: UpgradeDef[] = [
  ...UPGRADE_DEFS.filter(d => !JACKAL_CUT.has(d.id)).map(d => {
    const ov = JACKAL_OVERRIDES[d.id];
    return ov ? { ...d, title: ov.title, description: ov.description } : d;
  }),
  WINGMAN_DEF,
];

/** The upgrade pool a faction draws its run/arena picks from. */
export function factionUpgradePool(faction: RunFaction): UpgradeDef[] {
  return faction === 'jackals' ? JACKAL_DEFS : UPGRADE_DEFS;
}
