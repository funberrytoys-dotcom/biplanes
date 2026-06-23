# Миссия «Волчья комета» — дизайн + HANDOFF для новой сессии

> **Как продолжить:** открой НОВЫЙ чат и скажи «продолжаем дирижабль / Wolf Comet». Следующая
> сессия читает этот файл + память `project-ai-improvement-pass` и подхватывает отсюда.
> Игрок С.О.В. (синий) уничтожает дирижабль-носитель Шакалов «Волчья комета» + его истребители.

---

## 1. СТАТУС АРТА (что уже есть / что нужно)
Папки: `apps/web/public/assets/airships/` (модули дирижабля), `apps/web/public/assets/fx/` (взрывы).

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
