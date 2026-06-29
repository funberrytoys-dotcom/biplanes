/**
 * THE 32-PERK CATALOG — «Забег» first pool (design: docs/zabeg-perks-first-pool.json).
 *
 * This is the NEW run-perk system. It lives ALONGSIDE the legacy arena pool
 * (upgrade-pool.ts / branches.ts / faction.ts) which is left untouched so the run can
 * be toggled back to the old system at any time (rollback contract — see runPerkSystem
 * flag in the app). Nothing here imports the legacy pool.
 *
 * Composition (Codex MVP framing): 12 С.О.В. + 12 Алые Шакалы + 8 Общих = 32.
 * Тиры Деталь→Модуль→Узел→Легенда map to a fixed 5-colour rarity ladder (owner's call):
 *   Деталь → common (зелёный), Модуль → rare (синий), Узел → epic (фиолетовый),
 *   Легенда → legendary (золотой); the two universal crowns (Феникс, Захват целей) are
 *   mythic (красный — «самые крутые»).
 *
 * Appearance is gated so an imba perk never drops at the start (owner: «глупо получить
 * имбу в самом начале забега»): every Узел/Легенда has prereqs (foundation must be
 * owned) AND a minWave floor. See perk-pool.ts for the offer/gating logic.
 */

export type PerkFaction = 'sov' | 'jackals' | 'common';

/** Card category (the JSON's «Пулемёт/Ракеты/Звено/Корпус/Пилотаж»). */
export type PerkCategory = 'gun' | 'rocket' | 'squad' | 'hull' | 'aerobatics';

/** Design hierarchy tier. Maps to a rarity colour (see tierRarity). */
export type PerkTier = 'detail' | 'module' | 'node' | 'legend';

/** Rarity colour ladder (owner's palette). green<blue<purple<gold<red. */
export type PerkRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export type PerkId =
  // --- С.О.В. (12) ---
  | 'raskrutka' | 'sparennyy-stvol' | 'trassiruyuschiy-zamok' | 'radiator-turbina'
  | 'gatling-shtorm' | 'osinyy-zalp' | 'osinoe-gnezdo' | 'zhalo-roya'
  | 'remontnyy-dron' | 'polnyy-roy' | 'perezalp' | 'britva'
  // --- Алые Шакалы (12) ---
  | 'domna' | 'peregrev-zalp' | 'dvustvolka-kartech' | 'grom-pushka'
  | 'chugunnyy-gostinets' | 'napalmovyy-kover' | 'ipritnyy-kolokol' | 'zveno-asov'
  | 'ognevoy-prikaz' | 'bratskaya-bronya' | 'bronenos' | 'tarannyy-kil'
  // --- Общие (8) ---
  | 'broneplastiny' | 'polevoy-remont' | 'feniks' | 'chistyy-sryv'
  | 'egida' | 'dymzavesa' | 'mertvaya-petlya' | 'zahvat-tseley';

export interface PerkDef {
  id: PerkId;
  name: string;             // RU display name
  faction: PerkFaction;
  category: PerkCategory;
  tier: PerkTier;
  rarity: PerkRarity;       // fixed; derived from tier with the two mythic crowns overridden
  /** ALL of these must already be owned before this perk can be OFFERED (foundation gate). */
  prereqs: PerkId[];
  /** Shown on the card (highlighted if already owned); marquee pairs grant real bonuses. */
  synergies: PerkId[];
  /** Offered on the run-start «выбор стартового ядра» screen (branch openers). */
  startingCore: boolean;
  /** Earliest wave this perk can be offered (anti-imba floor; 1 = from the first pick). */
  minWave: number;
  human: string;            // player-facing flavour («что чувствует игрок»)
  effect: string;           // mechanical description with the designed numbers
  note: string;             // honest weakness / condition (anti-meta)
  icon: string;             // PNG filename in the perk-icons asset folder
}

/** Tier → rarity colour (with the two universal-crown mythic overrides applied per-perk below). */
export function tierRarity(tier: PerkTier): PerkRarity {
  switch (tier) {
    case 'detail': return 'common';
    case 'module': return 'rare';
    case 'node': return 'epic';
    case 'legend': return 'legendary';
  }
}

// Default minWave floor per tier (anti-imba) — individual perks override where the design
// is explicit (Феникс=9, Захват целей=11). Foundation prereqs gate the rest naturally.
const TIER_MIN_WAVE: Record<PerkTier, number> = { detail: 1, module: 1, node: 3, legend: 6 };

// Compact authoring rows → expanded into full PerkDef below (rarity + minWave defaulted).
interface PerkRow {
  id: PerkId; name: string; faction: PerkFaction; category: PerkCategory; tier: PerkTier;
  prereqs?: PerkId[]; synergies: PerkId[]; startingCore?: boolean; minWave?: number;
  rarity?: PerkRarity; human: string; effect: string; note: string; icon: string;
}

const ROWS: PerkRow[] = [
  // ============================ С.О.В. — Пулемёт ============================
  {
    id: 'raskrutka', name: 'Раскрутка', faction: 'sov', category: 'gun', tier: 'detail',
    startingCore: true, synergies: ['trassiruyuschiy-zamok', 'radiator-turbina', 'gatling-shtorm'],
    human: 'Чем дольше держишь врага под прицелом и не отпускаешь гашетку — тем злее льётся очередь. Награда за дисциплину огня.',
    effect: 'Непрерывный огонь раскручивает темп: +40% скорострельности за 2с стрельбы. Каждый 6-й выстрел на раскрутке — двойной (×2). Пауза >0.4с сбрасывает раскрутку.',
    note: 'Сброс при любой паузе наказывает за дёрганый огонь. Греет ствол.',
    icon: '01-raskrutka.png',
  },
  {
    id: 'sparennyy-stvol', name: 'Спаренный ствол', faction: 'sov', category: 'gun', tier: 'detail',
    synergies: ['raskrutka', 'osinoe-gnezdo', 'gatling-shtorm'],
    human: 'Второй ствол рядом — пули летят веером. Прощает прицел по близким и плотным целям.',
    effect: 'Стрельба веером: 2 снаряда ±4°. Урон каждого −15%, суммарный залп +70%.',
    note: 'Веер размазывает урон: против одиночного толстяка хуже одноствола, тратит магазин вдвое быстрее.',
    icon: '02-sparennyy-stvol.png',
  },
  {
    id: 'trassiruyuschiy-zamok', name: 'Трассирующий замок', faction: 'sov', category: 'gun', tier: 'module',
    synergies: ['raskrutka', 'zhalo-roya', 'radiator-turbina'],
    human: 'Держишь нос на ОДНОЙ цели, попадаешь подряд — она «загорается» меткой, и каждая следующая пуля по ней больнее.',
    effect: '5 попаданий подряд по одной цели → метка: +30% урона по ней на 1.2с. Промах/переключение цели — метка спадает.',
    note: 'Только одна метка. В свалке роя метка рвётся — слаба против толпы, сильна на дуэли/боссе.',
    icon: '05-trassiruyuschiy-zamok.png',
  },
  {
    id: 'radiator-turbina', name: 'Радиатор-турбина', faction: 'sov', category: 'gun', tier: 'module',
    synergies: ['raskrutka', 'britva', 'chistyy-sryv'],
    human: 'Набегающий поток охлаждает ствол: летишь быстрее — стреляешь чаще. Скорость кормит пулемёт.',
    effect: '+1% темпа за каждые 5% скорости выше крейсерской. На форсаже потолок +25%. На малой скорости/в срыве бонуса нет.',
    note: 'В медленном вираже/срыве преимущество исчезает — конфликтует с кайт-стилем.',
    icon: '06-radiator-turbina.png',
  },
  {
    id: 'gatling-shtorm', name: 'Гатлинг-шторм', faction: 'sov', category: 'gun', tier: 'legend',
    prereqs: ['raskrutka'], synergies: ['raskrutka', 'radiator-turbina', 'sparennyy-stvol'],
    human: 'Корона пулемётчика. На пике раскрутки самолёт превращается в воющую косилку — стена свинца.',
    effect: 'При полной раскрутке: 4с темп ×2.2, разброс −30%, отдача 0, магазин не убывает. Откат 16с, после — 1.5с остывания (−50% темпа).',
    note: 'Нужно сперва раскрутиться. Жёсткий 16с откат + окно остывания = уязвим.',
    icon: '13-gatling-shtorm.png',
  },
  // ============================ С.О.В. — Ракеты / Звено / Пилотаж ============================
  {
    id: 'osinyy-zalp', name: 'Осиный залп', faction: 'sov', category: 'rocket', tier: 'detail',
    startingCore: true, synergies: ['osinoe-gnezdo', 'zhalo-roya', 'perezalp'],
    human: 'Вместо пары ракет — рой жалящих микро-ракет. Не каждая больно, но их МНОГО, и они веером накрывают сектор.',
    effect: 'Залп = 6 микро-ракет: урон 22 каждая (~132 всего), веер ±18°, лёгкое самонаведение. Откат залпа −20%.',
    note: 'Урон размазан: одиночную толстую цель дробит хуже одной тяжёлой ракеты.',
    icon: '07-osinyy-zalp.png',
  },
  {
    id: 'osinoe-gnezdo', name: 'Осиное гнездо', faction: 'sov', category: 'squad', tier: 'detail',
    startingCore: true, synergies: ['zhalo-roya', 'polnyy-roy', 'remontnyy-dron'],
    human: 'Пара лёгких дронов-ос отрывается от крыльев и кружит рядом, огрызаясь по ближним врагам. Вход в ветку Звена.',
    effect: '2 дрона-осы: автоогонь по ближайшему врагу, ~6 урона, темп 0.4с. Дроны хрупкие (30 HP), возрождаются между волнами.',
    note: 'Дроны смертны и легко выбиваются в плотном бою. Ценны как фундамент ветки.',
    icon: '08-osinoe-gnezdo.png',
  },
  {
    id: 'zhalo-roya', name: 'Жало роя', faction: 'sov', category: 'squad', tier: 'module',
    prereqs: ['osinoe-gnezdo'], synergies: ['osinoe-gnezdo', 'trassiruyuschiy-zamok', 'polnyy-roy'],
    human: 'Дроны больше не бьют врассыпную — они фокусят цель, которую ты пометил носом. Управляемое жало.',
    effect: 'Дроны фокусят цель под прицелом (метку): +50% урона и +30% темпа по ней. Без метки бьют по ближнему.',
    note: 'Нужны живые дроны (без Гнезда бесполезен) и удержание метки носом.',
    icon: '04-zhalo-roya.png',
  },
  {
    id: 'remontnyy-dron', name: 'Ремонтный дрон', faction: 'sov', category: 'squad', tier: 'module',
    prereqs: ['osinoe-gnezdo'], synergies: ['osinoe-gnezdo', 'polnyy-roy', 'polevoy-remont'],
    human: 'Один из дронов — не стрелок, а медик: латает твой корпус в полёте.',
    effect: 'Конвертирует дрона в ремонтный: 2 HP/с пока цел и рядом (радиус 220). Если не били 5с — 4 HP/с. Не стреляет.',
    note: 'Минус один ствол роя. Под фокусом врага медик гибнет первым.',
    icon: '12-remontnyy-dron.png',
  },
  {
    id: 'polnyy-roy', name: 'Полный рой', faction: 'sov', category: 'squad', tier: 'legend',
    prereqs: ['osinoe-gnezdo'], synergies: ['osinoe-gnezdo', 'zhalo-roya', 'remontnyy-dron'],
    human: 'Корона командира роя. Вокруг тебя — маленькая воздушная армия из ос. Ты центр вихря.',
    effect: 'Рой до 5 дронов: +25% HP, +20% урона, +15% темпа. Раз/волну «Сжатие роя»: 3с плотное кольцо-щит вокруг тебя + залп.',
    note: 'Требует ветку Гнезда. Рой смертен — против AoE Шакалов выкашивается пачкой.',
    icon: '14-polnyy-roy.png',
  },
  {
    id: 'perezalp', name: 'Перезалп', faction: 'sov', category: 'aerobatics', tier: 'module',
    prereqs: ['chistyy-sryv'], synergies: ['osinyy-zalp', 'chistyy-sryv', 'mertvaya-petlya'],
    human: 'Чистый выход из срыва мгновенно перезаряжает ракеты. Пилотаж становится темпом, а не множителем урона.',
    effect: 'Чистый выход из stall → мгновенная перезарядка ракетного залпа. Откат 4с. Урон ракет не меняет.',
    note: 'Требует владения stall — грязный выход не срабатывает. Бесполезен без ракет.',
    icon: '33-perezalp.png',
  },
  {
    id: 'britva', name: 'Бритва', faction: 'sov', category: 'aerobatics', tier: 'module',
    synergies: ['radiator-turbina', 'trassiruyuschiy-zamok', 'chistyy-sryv'],
    human: 'Самолёт становится острее и легче: чётче входит в довираж, точнее держит нос. Филигрань управления.',
    effect: '+12% угловой скорости, −20% инерции в доводке носа, порог входа в stall на 8% позже. Без прямого урона.',
    note: 'Чисто манёвренный — проигрывает в «голых цифрах» dps-перкам. Чуть менее стабилен на ветру.',
    icon: '34-britva.png',
  },
  // ============================ Шакалы — Пушка ============================
  {
    id: 'domna', name: 'Домна', faction: 'jackals', category: 'gun', tier: 'node',
    startingCore: true, synergies: ['peregrev-zalp', 'grom-pushka', 'dvustvolka-kartech'],
    human: 'Жар пушки — больше не штраф, а РЕСУРС. Стреляешь — копится домна. Чем горячее ствол, тем злее огненные шары.',
    effect: 'Шкала «Домна» 0–100: +8/выстрел, −12/с в простое. На 100 домны +35% урона и +20% радиуса поджога, но −15% точности. Сладкая зона 60–85.',
    note: 'Красная зона роняет точность — нельзя тупо зажимать. Простой остужает.',
    icon: '16-domna.png',
  },
  {
    id: 'peregrev-zalp', name: 'Перегрев = залп', faction: 'jackals', category: 'gun', tier: 'node',
    synergies: ['domna', 'grom-pushka', 'chugunnyy-gostinets'],
    human: 'Переворачивает перегрев из наказания в награду. Догнал ствол до пика — выпускаешь сокрушительный огненный ЗАЛП.',
    effect: 'На 100 домны (или штатном перегреве) — авто-выброс: огнешар ×3 урона + поджог R140, сброс жара в 0 + 1.2с «продув».',
    note: 'После залпа 1.2с ты безоружен — окно уязвимости. Сильнее всего с Домной.',
    icon: '17-peregrev-zalp.png',
  },
  {
    id: 'dvustvolka-kartech', name: 'Двустволка-картечь', faction: 'jackals', category: 'gun', tier: 'module',
    synergies: ['domna', 'napalmovyy-kover', 'ipritnyy-kolokol'],
    human: 'Пушка плюётся картечью огнешаров, которые шлёпаются и оставляют горящие лужи. Метла ближнего боя для бугая.',
    effect: 'Выстрел → 3 огнешара ±10°, урон 18 каждый (54 всего). Каждый оставляет лужу: 6 урона/с, 2.5с. +1 заряд магазина за выстрел.',
    note: 'Жрёт малый магазин (60) вдвое быстрее. Слаба по дальней одиночке.',
    icon: '18-dvustvolka-kartech.png',
  },
  {
    id: 'grom-pushka', name: 'Гром-пушка', faction: 'jackals', category: 'gun', tier: 'legend',
    prereqs: ['domna'], synergies: ['domna', 'peregrev-zalp', 'tarannyy-kil'],
    human: 'Корона тяжёлого удара. Каждый пятый выстрел — ГРОМ: чугунное ядро, что пробивает строй насквозь.',
    effect: 'Каждый 5-й выстрел — снаряд ×3 урона (90), пробитие насквозь, отбрасывание (~180), оглушение мелочи 0.5с. На пике Домны — каждый 4-й.',
    note: 'Между громами — обычный медленный темп. Сбитый ритм (перезарядка) обнуляет счётчик.',
    icon: '19-grom-pushka.png',
  },
  // ============================ Шакалы — Ракеты ============================
  {
    id: 'chugunnyy-gostinets', name: 'Чугунный гостинец', faction: 'jackals', category: 'rocket', tier: 'node',
    startingCore: true, synergies: ['napalmovyy-kover', 'ipritnyy-kolokol', 'tarannyy-kil'],
    human: 'Вместо россыпи ракет — одна ТЯЖЁЛАЯ чугунная бомба-ракета. Не рой, а единственный сокрушительный гостинец.',
    effect: 'Залп = 1 тяжёлая ракета: урон 190, радиус 130, оглушение 0.6с. Летит медленнее по крутой дуге. Откат +30%.',
    note: 'Одна ракета = один шанс: промах тратит весь залп. Против юрких мелких бьёт мимо.',
    icon: '21-chugunnyy-gostinets.png',
  },
  {
    id: 'napalmovyy-kover', name: 'Напалмовый ковёр', faction: 'jackals', category: 'rocket', tier: 'module',
    synergies: ['chugunnyy-gostinets', 'dvustvolka-kartech', 'ipritnyy-kolokol'],
    human: 'Твой маршрут становится огненной чертой: за самолётом тянется горящая полоса напалма. Рисуешь линии огня.',
    effect: 'Спецсброс → огненная трасса вдоль траектории (живёт 4с, ширина ~50): 14 урона/с. Длина = путь за 2.5с. Откат 9с.',
    note: 'Урон по площади, не бурст — против босса слаб. Жжёт и зону вокруг тебя.',
    icon: '22-napalmovyy-kov-r.png',
  },
  {
    id: 'ipritnyy-kolokol', name: 'Ипритный колокол', faction: 'jackals', category: 'rocket', tier: 'module',
    synergies: ['ognevoy-prikaz', 'chugunnyy-gostinets', 'grom-pushka'],
    human: 'Клеймо зоны: накрываешь участок неба «колоколом», и все враги в нём получают БОЛЬШЕ урона от всего.',
    effect: 'Снаряд-колокол метит зону (R160) на 5с: враги внутри получают +30% входящего урона от всех источников. Сам не бьёт. Откат 12с.',
    note: 'Мёртв без второго источника урона по зоне. Враги могут выйти из круга.',
    icon: '23-ipritnyy-kolokol.png',
  },
  // ============================ Шакалы — Звено / Корпус ============================
  {
    id: 'zveno-asov', name: 'Звено асов', faction: 'jackals', category: 'squad', tier: 'node',
    startingCore: true, synergies: ['ognevoy-prikaz', 'bratskaya-bronya', 'ipritnyy-kolokol'],
    human: 'Не рой — ЗВЕНО. Живой ас-ведомый на тяжёлой машине летит рядом, бьёт редко но больно, и реально гибнет.',
    effect: 'Призывает 1 ведомого-аса (тяжёлый борт, 120 HP, пушка ×0.55 урона Барона). Смертен — возрождается ТОЛЬКО между волнами.',
    note: 'Всего один (не рой) — точечный фокус его убивает. Медленный, отстаёт на форсаже.',
    icon: '26-zveno-asov.png',
  },
  {
    id: 'ognevoy-prikaz', name: 'Огневой приказ', faction: 'jackals', category: 'squad', tier: 'node',
    prereqs: ['zveno-asov'], synergies: ['zveno-asov', 'ipritnyy-kolokol', 'grom-pushka'],
    human: 'Командный приём: рявкаешь приказ — и звено асов на миг сосредотачивает весь огонь на одной цели.',
    effect: 'Активация → 3с ведомые фокусят цель под прицелом: их урон ×2 и темп +40%. Без асов — твоя пушка +25% на 3с. Откат 14с.',
    note: 'Сила зависит от живых асов — без звена лишь слабый соло-баф.',
    icon: '27-ognevoy-prikaz.png',
  },
  {
    id: 'bratskaya-bronya', name: 'Братская броня', faction: 'jackals', category: 'squad', tier: 'module',
    prereqs: ['zveno-asov'], synergies: ['zveno-asov', 'ognevoy-prikaz', 'bronenos'],
    human: 'Звено прикрывает командира телами: пока асы живы — ты крепче. А когда брат гибнет, ты звереешь от ярости.',
    effect: 'За каждого живого ведомого: −10% входящего урона (макс −20%). Гибель ведомого → «Ярость потери»: +25% урона на 5с.',
    note: 'Защита исчезает, как только асов выбили. «Ярость» соблазняет жертвовать звеном.',
    icon: '28-bratskaya-bronya.png',
  },
  {
    id: 'bronenos', name: 'Броненос', faction: 'jackals', category: 'hull', tier: 'module',
    startingCore: true, synergies: ['bratskaya-bronya', 'tarannyy-kil', 'broneplastiny'],
    human: 'Навешиваешь броню до предела: самолёт становится летающим дотом — почти не пробить, но ползёт как утюг.',
    effect: '+40% макс HP и −25% входящего урона. Цена: −18% скорости, −15% поворота. Таран об тебя враги получают +50% урона.',
    note: 'Становишься медленной мишенью, кайт почти невозможен. Против луж не спасает.',
    icon: '31-bronenos.png',
  },
  {
    id: 'tarannyy-kil', name: 'Таранный киль', faction: 'jackals', category: 'hull', tier: 'node',
    synergies: ['bronenos', 'grom-pushka', 'chugunnyy-gostinets'],
    human: 'Нос — таран. Лобовое столкновение из самоубийства превращается в приём: киль протыкает врага, ты переживаешь удар.',
    effect: 'Таран 120 урона + отброс, тебе −70% урона от своего тарана. Разгон на форсаже → ×1.8 (216). Пробивает мелочь насквозь. Откат 3с.',
    note: 'Против толстой цели всё равно ловишь остаток. С лёгким корпусом самоубийственно — нужен Броненос.',
    icon: '30-tarannyy-kil.png',
  },
  // ============================ Общие — Корпус ============================
  {
    id: 'broneplastiny', name: 'Бронепластины', faction: 'common', category: 'hull', tier: 'detail',
    startingCore: true, synergies: ['polevoy-remont', 'feniks', 'bronenos'],
    human: 'Базовая навеска брони: просто крепче корпус. Универсальный фундамент выживания, чтобы дотянуть до босса.',
    effect: '+25% макс HP. На 3-й копии порог: дополнительно −5% входящего урона. Честный durability-кирпич.',
    note: 'Скучный «+%»-перк (намеренно). Не спасает от бурста-вантапа.',
    icon: '35-broneplastiny.png',
  },
  {
    id: 'polevoy-remont', name: 'Полевой ремонт', faction: 'common', category: 'hull', tier: 'module',
    synergies: ['broneplastiny', 'remontnyy-dron', 'feniks'],
    human: 'Латаешь машину прямо в небе между схватками и потихоньку зализываешь раны, если тебя оставили в покое.',
    effect: 'Между волнами +30% макс HP мгновенно. В бою: если не били 4с — реген 1 HP/с до первого попадания.',
    note: 'Реген требует 4с без урона — в свалке почти не тикает. Не аварийная кнопка.',
    icon: '36-polevoy-remont.png',
  },
  {
    id: 'feniks', name: 'Феникс', faction: 'common', category: 'hull', tier: 'legend', rarity: 'mythic', minWave: 9,
    synergies: ['broneplastiny', 'polevoy-remont', 'tarannyy-kil'],
    human: 'Детерминированный второй шанс. Один раз за забег, когда тебя должны сбить — ты вспыхиваешь и выныриваешь живым.',
    effect: '1 раз за забег: при падении HP до 0 выживаешь с 1 HP + 2с неуязвимости + сброс жара/откатов. Доступен с волны 9.',
    note: 'Одноразовый и только с 9-й волны. После — снова смертен в том же замесе.',
    icon: '37-feniks.png',
  },
  // ============================ Общие — Пилотаж ============================
  {
    id: 'chistyy-sryv', name: 'Чистый срыв', faction: 'common', category: 'aerobatics', tier: 'detail',
    startingCore: true, synergies: ['egida', 'perezalp', 'britva'],
    human: 'Награда за владение фишкой игры. Чисто вышел из срыва — самолёт огрызается рывком скорости. Открывает ветку Пилотажа.',
    effect: 'Чистый выход из stall → рывок +30% скорости на 1.5с. Откат 4с. Не урон. Открывает Эгиду, Дымзавесу, Мёртвую петлю.',
    note: 'Грязный срыв не даёт ничего — нужен навык. Сам по себе только мобильность.',
    icon: '54-chistyy-sryv.png',
  },
  {
    id: 'egida', name: 'Эгида', faction: 'common', category: 'aerobatics', tier: 'module',
    prereqs: ['chistyy-sryv'], synergies: ['chistyy-sryv', 'dymzavesa', 'mertvaya-petlya'],
    human: 'Чисто выскользнул из-под огня — и на тебе на миг вспыхивает щит на один удар. Награда за грамотный выход.',
    effect: 'Чистый выход из опасной зоны через stall-манёвр → щит на 1 удар, держится 2с. Откат 5с. Не урон.',
    note: 'Один удар и только 2с — против потока пуль спадает мгновенно. Требует stall-навыка.',
    icon: '52-egida.png',
  },
  {
    id: 'dymzavesa', name: 'Дымзавеса', faction: 'common', category: 'aerobatics', tier: 'module',
    prereqs: ['chistyy-sryv'], synergies: ['chistyy-sryv', 'egida', 'zveno-asov'],
    human: 'Резко крутанул у грани срыва — и за тобой повисает дымное облако. Враги теряют захват, ракеты мажут.',
    effect: 'Резкий разворот у порога stall → облако дыма на 3с: враги теряют lock (ракеты срываются), их разброс ×2.5. Откат 7с.',
    note: 'Чистый обман — нулевой урон. Облако статично, быстрый враг его облетает.',
    icon: '53-dymzavesa.png',
  },
  {
    id: 'mertvaya-petlya', name: 'Мёртвая петля', faction: 'common', category: 'aerobatics', tier: 'node',
    prereqs: ['chistyy-sryv'], synergies: ['perezalp', 'chistyy-sryv', 'gatling-shtorm'],
    human: 'Высший пилотаж как ресурс: крутанул чистую петлю 360° — и спецы/коронка мгновенно подзаряжаются.',
    effect: 'Чистая петля 360° → сброс кулдауна одного спеца ИЛИ +35% заряда Легенды. Откат 6с. Не урон сам по себе.',
    note: 'Сложный триггер: грязная петля не считается, в свалке выписать круг опасно.',
    icon: '51-m-rtvaya-petlya.png',
  },
  {
    id: 'zahvat-tseley', name: 'Захват целей', faction: 'common', category: 'rocket', tier: 'legend', rarity: 'mythic', minWave: 11,
    synergies: ['osinyy-zalp', 'chugunnyy-gostinets', 'mertvaya-petlya'],
    human: 'Общая коронка-фантазия: время замирает, ты тапаешь до нескольких целей — и веер самонаводов расчищает небо.',
    effect: 'Заряд 25с боя → time-scale ×0.25 на 2с, метишь до 3 целей (до 5 с копиями) → веер самонаводов (~80 урона) по каждой. Простой 10с.',
    note: 'Долгий заряд + простой = редкое окно. Время для всех замедляется — тебя тоже видно. Технически сложный — в пул последним.',
    icon: '55-zahvat-tseley.png',
  },
];

/** All 32 perks, expanded with defaulted rarity (by tier) and minWave (by tier). */
export const PERKS: PerkDef[] = ROWS.map((r) => ({
  id: r.id,
  name: r.name,
  faction: r.faction,
  category: r.category,
  tier: r.tier,
  rarity: r.rarity ?? tierRarity(r.tier),
  prereqs: r.prereqs ?? [],
  synergies: r.synergies,
  startingCore: r.startingCore ?? false,
  minWave: r.minWave ?? TIER_MIN_WAVE[r.tier],
  human: r.human,
  effect: r.effect,
  note: r.note,
  icon: r.icon,
}));

export const PERK_BY_ID: Record<PerkId, PerkDef> = PERKS.reduce((acc, p) => {
  acc[p.id] = p;
  return acc;
}, {} as Record<PerkId, PerkDef>);

export function getPerk(id: PerkId): PerkDef {
  const p = PERK_BY_ID[id];
  if (!p) throw new Error(`unknown perk id: ${id}`);
  return p;
}

/** Perks a faction can see: its own + the shared «Общие». */
export function perksForFaction(faction: 'sov' | 'jackals'): PerkDef[] {
  return PERKS.filter((p) => p.faction === faction || p.faction === 'common');
}

/** Branch-opener cores offered on the run-start «выбор стартового ядра» screen. */
export function startingCoresForFaction(faction: 'sov' | 'jackals'): PerkDef[] {
  return perksForFaction(faction).filter((p) => p.startingCore);
}
