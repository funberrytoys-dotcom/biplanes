# Миссия «Волчья комета» — дизайн + HANDOFF для новой сессии

> **Как продолжить:** открой НОВЫЙ чат и скажи «продолжаем дирижабль / Wolf Comet». Следующая
> сессия читает этот файл + память `project-ai-improvement-pass` и подхватывает отсюда.
> Игрок С.О.В. (синий) уничтожает дирижабль-носитель Шакалов «Волчья комета» + его истребители.

---

## 1. СТАТУС АРТА (что уже есть / что нужно)
Папки: `apps/web/public/assets/airships/` (модули дирижабля), `apps/web/public/assets/fx/` (взрывы).

> **ОБНОВЛЕНИЕ 2026-06-23:** Сергей сгенерил ВСЕ 13 модулей (исходники в `WOLF COMET ASSETS/`, апскейленные ~7МБ, БЕЗ альфы — апскейлер запёк светлый фон). Claude вернул прозрачность (edge-флудфилл по светлому фону — сохраняет внутренние белые волки), ужал и разложил game-ready в `apps/web/public/assets/airships/wolfcomet/` (13 PNG, прозрачные, всего ~2.3МБ): `balloon, gondola, bridge_intact/damaged/destroyed, engine, propeller, banner_vertical, pennant_horizontal, turret_cannon_intact/wreck, turret_mg_intact/wreck`. Покрытие полное (все 3 стадии рубки + обе турели целые/обломки). НЕ хватает: двигатель-обломок (минор), тросы баллон↔гондола (рисуем кодом). Собран статичный превью-композит `WOLF COMET ASSETS/_PREVIEW_assembled.png` (по раскладке секций из `wolf-comet.ts` + самолёт для масштаба). Следующее: вкладка меню «Первый вылет»→«Кампания» (level-select: Уровень 1 + Демо: Дирижабль) и сам демо-уровень в `main.ts` (фон-слой, секции-цели по `wolfCometSectionWorldPos`, палубные истребители, финал-каскад взрывов).

> **ОБНОВЛЕНИЕ 2026-06-24 (СДЕЛАНО + ПЛАН БОЯ):** Готово и работает в `packages/app/src/main.ts` (демо-режим `?wolfcomet`, кнопка меню «Кампания» → «Демо: Дирижабль», `startWolfCometDemo()`):
> - **Меню**: «Первый вылет»→«Кампания» (action `campaign`, `screens/campaign-select.ts` — level-select: Уровень 1 = `startStoryMissionOne()`, Демо = `startWolfCometDemo()`).
> - **Редактор сборки**: `apps/web/public/wolfcomet-editor.html` — палитра модулей, drag/scale/наклон(Q/E)/зеркало(F)/копипаст(Ctrl+C/V)/слои/самолёт-эталон(масштаб не меняем)/тросы веером+экспорт. Сергей собрал дирижабль в нём; раскладка вставлена в `buildWolfComet`.
> - **Дирижабль из модулей** по раскладке Сергея: `wcBalloon` + `wcGondola` (два **независимо качающихся** блока), `wcCables` (веер, рисую кодом, ПЕРЕД блоками → за баллоном/гондолой, видно только в просвете, redraw каждый кадр с учётом sway), `wcFlags` (вымпел+знамя колышутся skew). Sway+флаги — в render-loop (`if (wolfCometGroup.visible)`). `add(file,srcW,targetW,x,y,rot,flipX)` поддерживает наклон+зеркало. Масштаб `positionWolfComet` 0.95 (Сергей одобрил).
> - **Старт в облаках, БЕЗ земли**: игрок появляется уже в полёте (`state:'flying'`, скорость `G_MAX_LEVEL`, высоко), арена-враги выключены (`disableAutoEnemySpawn`, enemies/bullets очищены). Камера на игрока, дирижабль справа. (Позже: взлёт → защита своего дирижабля → атака на Комету.)
>
> **ПЛАН БОЯ (СТРОЮ, спец Сергея):** движок `core/src/run/wolf-comet.ts` готов (секции: 6 турелей+2 движка+core-рубка, `damageWolfCometSection` — рубка неуязвима пока живы турели+движки, `wolfCometTurretsReadyToFire`, `wolfCometHealthFraction`). Надо: (1) **турели стреляют** — враж. пули с мировых позиций турелей по игроку; (2) **палубные Шакалы взлетают** с посадочных мест как живые ИИ-враги; (3) **HP-бар над КАЖДЫМ** разрушаемым элементом (турели/движки/рубка); (4) при уничтожении — **МНОГО взрывов**, потом **подмена модели на обломок** (`turret_*_wreck`); **рубка = 3 стадии** intact→damaged→destroyed (взрывы на каждом переходе); (5) финал — **каскад взрывов**, дирижабль тонет (`defeated`). ВНИМАНИЕ: бой в детерминированном ядре — собирать по шагам, помнить про зависания.

> **ОБНОВЛЕНИЕ 2026-06-24 #2 (БОЙ ЧАСТИЧНО ГОТОВ + ночной автономный финиш):** В `main.ts`, демо `?wolfcomet`, СДЕЛАНО и компилируется/собирается чисто:
> - **Секции-цели**: каждая турель/двигатель/рубка — объект `WCSection` (sprite, hp, fireCooldown/Interval, wreckFile, stages, bar). HP: турель 80, движок 150, рубка(core) 700. Массив `wcSections`, HP-бары в `wcHud` (worldLayer).
> - **Турели стреляют (по-разному, как просил Сергей)**: пулемёт = ДВА ствола, лёгкая очередь (мелкие пули, `WC_MG_DMG 5`, speed 880, +9/-9 перпенд. сдвиг); пушка = ОДИН большой снаряд `heavyRound:true` (огненный шар, `WC_CANNON_DMG 16`, speed 620). Враж. пули с мировых позиций (`worldLayer.toLocal(sprite.getGlobalPosition())`) с упреждением, вспышка. Поле `weapon:'mg'|'cannon'` (по имени файла).
> - **Урон по секциям**: пули игрока (`ownerFaction:'player'`) по радиусу `targetW*scale*0.45` → -damage; на стадии рубки подмена `bridge_damaged`→`bridge_destroyed` + взрыв; на смерти — 5 взрывов + подмена на `*_wreck` (у движка нет wreck-арта → alpha 0.35). Рубка(core) неуязвима, пока живы все турели+движки (`stripDead`). Уник. id пуль `wcBulletId` (отрицательные).
> - **Старт в воздухе, без земли**: игрок `state:'flying'`, скорость `G_MAX_LEVEL`, `sx=ww*0.20, sy=wh*0.52` (уровень гондолы). Арена-флоу ОТКЛЮЧЁН: `updateArenaDirector` ранний `return` при `wolfCometGroup.visible` (нет волн/апгрейда). Облака `fgClouds.alpha=0.4` в демо (reset=1 в `startArena`).
> - **Покачивание**: `wcBalloon`/`wcGondola` (sin-bob+rot), флаги skew, тросы `wcCables` redraw за корпусом. `positionWolfComet` scale 0.95 (Сергей одобрил размер).
>
> **ОСТАЛОСЬ (делаю ночью, потом deploy):** (1) **постоянный дым** на уничтоженных турелях/рубке (скрыть шероховатости) — emit каждый кадр из мёртвых секций (`damageFx.addSmokeTrail`); (2) **взлёт палубных Шакалов** — спавнить враж. самолёты с палубных позиций по таймеру (живые ИИ, `makeArenaRoundEnemy`-style, inject в `state.enemies`); (3) **финал-каскад** взрывов когда всё уничтожено (`defeated`) → дирижабль тонет → победа; (4) **остров-цель**: фон-спрайт нашего острова СОВ справа (картинка `Biplanes-godot/pitching/ChatGPT Image 24 мая 2026...png` или видео `Sky island SOV.mp4` с рабочего стола — выкусить magenta-фон chroma-key как у модулей), дирижабль **дрейфует вправо к острову**; цель — уничтожить ПОКА не дошёл; дошёл = поражение. **СЮЖЕТ**: дирижабль плывёт к нашему острову-базе чтобы уничтожить; пред. миссия = защита авианосца от налёта; эта = старт в воздухе, сбить Комету до острова. Сергей спит, велел финишировать + выложить, вопросов не задавать.

> **ОБНОВЛЕНИЕ 2026-06-24 #3 (РЕДИЗАЙН БОЯ ПО ТЗ Сергея + 3 общих бага — всё проверено в браузере, 360 тестов зелёные, НЕ задеплоено):**
> - **Старт от острова, в воздухе** (как и было) + **новый арт острова**: пиксель-остров Сергея (`Biplanes-godot/pitсhing/ChatGPT…23_10_37.png` — маяк, флаг С.О.В., причал) → magenta вырезан **edge-флудфиллом** (`tools/assets/prepare-sov-island.py`, Pillow) → `assets/airships/wolfcomet/island_sov.png` (в предзагрузке; `wolfCometIsland` указывает сюда). Выглядит отлично.
> - **Взлёт с палубы — теперь ПО СОБЫТИЯМ, не по таймеру** (`packages/app/src/wolf-comet-launch.ts` `resolveWolfCometLaunch` — чистая функция + 9 тестов). **4 истребителя Шакалов СТОЯТ на палубе гондолы** (`wcDeckPlanes`, `createPlaneSprite('enemy','enemy')` как дети `wcGondola`; позиции на палубе подогнаны в браузере). Взлетают по битам: **(1)** игрок долетел до рубки (близость `WC_REACH_DIST`) → 1-й; **(2)** уничтожено 50% турелей → +2; **(3)** уничтожены рубка + винт → последний = **БОСС «Шрам»** (`makeArenaScarBoss(...,'sov')`, красный Барон из финала арены, ~950 HP @ round 4 — число легко крутить). **Победа = добить Барона** (потом каскад + дирижабль тонет/гаснет); как рубка пала — Комета **перестаёт дрейфовать** (искалечена). Поражение = Комета дошла до острова, пока рубка цела.
> - **Винт — теперь РАЗРУШАЕМАЯ секция** (`kind:'prop'`, `WC_PROP_HP`) — крутится пока жив, гаснет при уничтожении. Секции: 10 турелей + 1 движок + рубка + винт = 13. Рубка под щитом, пока живо ВСЁ не-core (включая винт).
> - **3 общих бага (та же сессия):** (а) **Шакалы ВСЕГДА бьют тяжёлой пушкой** в ЛЮБОМ режиме — игрок когда `chosenFaction==='jackals'` (ставим `state.playerFaction` в `startArena`, не только `startRun`), И все красные враги-Шакалы (`e.heavyGun = chosenFaction==='sov'` на спавне арены/забега + скриптовые враги миссии-1 + взлёт с палубы). (б) **Фракция не протекает**: Кампания + Обучение всегда С.О.В. (`forceSovForCampaign()` в `startStoryMissionOne`/`startFlightLab`; `chosenFaction='sov'` в `startWolfCometDemo`). (в) **Остров больше не висит в небе** в Арене/Забеге (`startArena` прячет `wolfCometIsland`+`wcHud`).
> - **ОСТАЛОСЬ подкрутить на устройстве Сергея:** точная высота парковки палубных самолётов (сейчас сидят чуть выше палубы, у такелажа); HP/тайминги босса; баланс «дойти до острова». Превью в headless не даёт нормально полетать (управление = тач-рычаг газа при `?phone`), поэтому ДИНАМИКУ боя (тяжёлые шары в бою, взлёт по битам, бой с боссом) Сергей проверяет на телефоне.

**Готово (в `airships/new/`, прозрачный фон, боковой вид):**
- `wolf_comet_carrier.png` — целый носитель (баллон + линкор-гондола). Отличный, эталон стиля.
- `wolf_comet_turret.png` — турель (запасная/первая).
- `wolf_comet_sideview.png` — альтернативный корпус (резерв).
- Баллон (Сергей сгенерил отдельно, 1916×821) — кидал в чат; **нужно положить файл в папку**.
- Рубка: **целая** + **повреждённая** (Сергей сгенерил, отлично). Нужна **3-я: уничтоженная**.

**Готово (взрывы, в `fx/`, нарисованы кодом `tools/fx/gen-explosions.py`):**
- `explosion_small.png` — 512×256, 8 кадров (4×2 @128px) — самолёты/турели.
- `explosion_large.png` — 1024×1024, 16 кадров (4×4 @256px) — рубка/баллон/гондола.
- **Уже встроены в игру** (малый — на гибель самолёта, большой — на взрыв бомб/ракет).

**Нужно догенерить (модули):** гондола-корпус, винт, двигатель (целый+обломок), голова-волк,
вертикальное знамя (для гондолы), горизонтальный вымпел (на мачту), 3-я стадия рубки,
турели рабочие (пушка+пулемёт, целые+обломки).

---

## 2. ПОЛНАЯ ПАЧКА ПРОМТОВ
**Размер задаётся в инструменте** (не в тексте). Мелочь = 1024×1024; длинные куски (баллон,
гондола) = максимально широкий (1536×1024+). Рабочую+обломок одного типа — один размер/основание.

**Префикс — в начало КАЖДОГО промта:**
> `Dieselpunk pirate sky-carrier «Wolf Comet» asset. Strict flat 2D SIDE-VIEW profile (NOT 3/4 angle). Weathered battle-scarred metal, crimson + brass + gunmetal palette, white wolf motif. Bold readable game sprite, clean crisp edges, FULLY TRANSPARENT background (alpha), no sky / clouds / ground, centered with small padding. NO text, NO letters, NO words, NO numbers, NO writing or signage anywhere — imagery only.`

1. **Баллон** (1536×1024+): `the red armored ZEPPELIN ENVELOPE only — riveted crimson hull, brass banding, a large white snarling wolf emblem, a blank brass nameplate plaque with NO text, a top mast. NO gondola, NO propellers, NO banners. Long horizontal shape.`
2. **Гондола-корпус** (1536×1024+): `the dark armored BATTLESHIP gondola hull only — gunmetal plating, a row of round amber-glowing portholes, gun-deck with empty turret MOUNTS (no barrels), anchors, rails. NO balloon, NO propellers, NO gun barrels.`
3a. **Рубка целая** (1024): `a fortified CONNING-TOWER BRIDGE — armored amber-glowing windows, riveted plating, antennae and a tall mast on top. Intact and proud. NO flag, NO banner.`
3b. **Рубка повреждённая** (1024): `the SAME conning-tower bridge but BATTLE-DAMAGED — cracked and scorched plating, broken antennae and bent mast, fire and black smoke, windows dark. NO flag.`
3c. **Рубка уничтожена** (1024, ТОТ ЖЕ размер): `the SAME conning-tower bridge but UTTERLY DESTROYED — collapsed into a burnt-out twisted-metal wreck, caved in and toppled, jagged torn plating, gaping holes, charred metal, dying embers and thin smoke, snapped antennae, rubble at the base. Same footprint/base as intact. NO flag.`
4. **Винт** (1024): `a single large brass multi-blade AIRSHIP PROPELLER on a hub, clean symmetric blades, gunmetal + brass, centered (one clean still — spun in code).`
5a. **Пушка-турель целая** (1024): `a heavy single big-bore CANNON turret — one huge wide cannon barrel with a glowing molten-orange charged muzzle, thick brass + gunmetal armored mount, riveted plating, crimson trim, round rotating base. Barrel aimed slightly up to the right. Intact.`
5b. **Пушка-турель обломок** (1024): `the SAME heavy cannon turret but DESTROYED — barrel split and bent down, mount torn open and scorched black, fire and smoke. Same size/base as intact.`
6a. **Пулемёт-турель целая** (1024): `a smaller rapid-fire MACHINE-GUN turret — twin slim barrels side by side, compact armored brass + gunmetal mount with an ammo drum, crimson trim, round rotating base. Barrels aimed slightly up to the right. Intact.`
6b. **Пулемёт-турель обломок** (1024): `the SAME twin-barrel machine-gun turret but DESTROYED — barrels snapped and drooping, mount cracked and scorched, fire and smoke. Same size/base as intact.`
7a. **Двигатель целый** (1024): `an armored ENGINE POD / nacelle with exhaust stacks and a central hub for a propeller, brass + gunmetal, riveted.`
7b. **Двигатель обломок** (1024): `a WRECKED engine pod — torn open, fire and black smoke, broken hub.`
8. **Вертикальный стяг** (1024 или 1024×1536, для боков гондолы): `a tattered crimson war BANNER with a white wolf-head, hanging down from a horizontal crossbar pole.`
9. **Горизонтальный вымпел** (1024×512, на мачту): `a tattered crimson war PENNANT flying HORIZONTALLY sideways in the wind from a vertical brass FLAGPOLE on the LEFT — cloth streams and ripples to the RIGHT, frayed swallow-tail end, white wolf-head emblem, NOT hanging down. One still — rippled in code.`
10. **Голова-волк-таран** (1024): `a massive armored WOLF-HEAD battering RAM for the bow — iron fangs, glowing red eyes, brass plating, snarling, facing LEFT.`

---

## 3. WORKFLOW АРТА (Сергей → Claude)
- Сергей генерит куски (любой фон — Claude вырежет в прозрачность; главное — **строго боковой вид**).
- Кидает файлы в `apps/web/public/assets/airships/` (имена вольные) → пишет «готово».
- Claude: чистит прозрачность, режет/совмещает, вставляет в миссию.
- **Качество/размер:** «огромность» от размера МИРА, не текстуры — игрок видит ~1 экран за раз,
  поэтому 1024–1536px на кусок хватает (показывается ~1:1). Длинный баллон — шире или 3 секции.

## 4. РАЗРУШЕНИЕ СЕКЦИЙ (решено — БЕЗ морф-анимации)
3 картинки-стадии (целая/повреждённая/уничтожена). При переходе **мгновенно подменяем
картинку, прикрыв пачкой взрывов** (мешаем малые+большие из готовой системы). Турель = обломок
+ малый взрыв; рубка/большое = стадии + большой взрыв. Система взрывов уже встроена.

---

## 5. ТЕХНИЧЕСКИЙ ФУНДАМЕНТ (готов, протестирован)
- **Движок босса:** `packages/core/src/run/wolf-comet.ts` (+8 тестов). Дирижабль из СЕКЦИЙ:
  6 турелей + 2 двигателя + ЯДРО(рубка). Ядро неуязвимо, пока живы турели+движки; добил ядро = победа.
  Дрейф, тайминг огня турелей, HUD-доля HP. Позиции секций — доли габарита (0..1).
- **Взрывы:** `packages/render/src/scene/sprite-explosions.ts` — играет листы, грузит через
  `Assets.load` (защищённо). Уже в `VISUAL_ASSET_URLS` (предзагрузка).
- **Следующий шаг сборки:** скрытый режим `?mission=wolfcomet` (как `?gunfeelLab`) — переиспользует
  пайплайн «Арены»: ползущий корпус-спрайт + секции как стационарные «враги», приколоченные к
  `wolfCometSectionWorldPos` (готовая коллизия/смерть/взрыв), волны истребителей, победа по `defeated`,
  босс-полоска. Когда ощущение ОК — кнопка в меню кампании. Изолированно, прод не трогает.

## 6. КОНСТРЕЙНТЫ (НЕ сломать)
- **НИКОГДА не возвращать `BlurFilter`** на slim/glow-слой — морозил игру на 4-м раунде дважды
  (offscreen-таргет > лимита GPU в 3× мире). Свечение делать запечённым (как у пуль сейчас).
- **Стрельба (только что доведена):** С.О.В. = тонкие СВЕТЯЩИЕСЯ пули, далеко; Шакалы = большие
  огненные шары, дальность ~80% от С.О.В. (`JACKAL_BULLET_LIFETIME_MULT`). Свечение — без фильтра.
- **Проверять рендер в браузере перед деплоем** (превью РЕНДЕРИТ игру; `?gunfeelLab` авто-стреляет;
  держать Space — очередь). Старт-краши видны в консоли. Не деплоить рендер вслепую.
- **Кэш телефона:** после деплоя открывать `…/?v=N` (меняя N) — телефон держит старое. В index.html
  уже стоит `no-cache`.

## 7. БЕЗОПАСНОСТЬ / ВЕТКИ
Вся работа в ветке `ai/improvements` (локально). Деплой: ff-merge в `feat/hud-animated-panel` →
push (авто-деплой на gh-pages, `funberrytoys-dotcom.github.io/biplanes/`). Откат: тег `pre-ai-backup`
+ физ.копия `..\Biplanes_BACKUP_2026-06-22`. Подробности — `_AI_WORKLOG.md`.
