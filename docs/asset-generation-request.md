# Biplanes — Asset Brief

**Версия:** v5 (компактный, исправлен gameplay side-view)
**Дата:** 2026-05-24
**Заменяет:** v3 (распух до 1451 строки бюрократии). Старый `docs/art-bible.md` тоже не использовать.

---

## 0. Как пользоваться

1. Один раз — прочитать §1 (стиль), §2 (палитра), §5 (лор).
2. Скопировать `STYLE LOCK` из §3 — фирменная преамбула для всех промптов.
3. По каталогу §6 — для каждого ассета: `[STYLE LOCK]` + Subject + подгрузить референсные картинки в MJ/Flux.
4. Готовые PNG → `packages/render/src/assets/` (структура §4.4).
5. Когда наберётся 5-7 ассетов — скажешь «встраивай».

---

## 1. Стиль одной фразой

**Bright polished 2D cartoon game art with soft volume** — чистый тёмный контур, насыщенные тёплые цвета, мягкие блики, премиальное mobile-game качество. Для персонажей можно больше mascot-объёма и выразительных глаз. Для gameplay-техники нужен **строгий плоский вид сбоку**, не псевдо-3D и не hero-render.

Чико — референс общего качества, яркости и чистоты рендера. Самолёт, дирижабль или остров **не должны брать форму от Чико**. Для техники форма берётся только из отдельного технического референса: самолёт, дирижабль, остров.

**Главный референс — твои собственные картинки.** Положи их сюда:

```
docs/references/style/
├── chico-portrait.png        ← Чико в форме (canon персонажа)
├── plane-blue-hero.png       ← синий биплан 3/4 (canon формы самолёта)
└── plane-red-jackals.png     ← красный пиратский (canon врага)
```

И подгружай как image reference в MJ (`--cref`) / Flux / DALL-E при каждой генерации. Это даст единый визуальный язык лучше любых слов в промпте.

---

## 2. Палитра

| Роль | Hex |
|---|---|
| Небо день — верх / горизонт | `#7ca7c8` / `#f4d9a8` |
| Небо закат — верх / горизонт | `#7a4488` / `#ff9550` |
| Облака свет / тень | `#fff4dc` / `#e8b890` |
| Кобальт СОВ primary / тёмный | `#2E6BC6` / `#11305a` |
| Красный Шакалов / бордо | `#c0392b` / `#7a1a1a` |
| Латунь | `#c89438` |
| Охра / кожа Чико | `#d4a04a` |
| Графит (силуэты вдали) | `#2a2f3a` |
| Контур объектов | `#1a1a24` |

---

## 3. Универсальные блоки (копи-паста)

### STYLE LOCK

```
Bright polished 2D cartoon game art with soft volume, clean dark contour
lines (#1a1a24), smooth digital shading, glossy highlights, saturated warm
colors, premium mobile game quality. Use attached Chico images only for
rendering style, palette warmth, lighting quality, and friendly game-art
finish. Do not copy Chico anatomy into vehicles. Warm dieselpunk
sky-adventure mood inspired by BioShock Infinite Columbia — cream, brass,
cobalt, crimson, ochre, sunset pinks. SOLID PURE MAGENTA BACKGROUND (#FF00FF) — flat uniform color
filling the entire frame behind the subject, no gradient, no texture,
no shadow on the background. Centered subject, generous magenta padding
around all sides.
```

### Universal Negative

```
photorealistic, octane render, unreal engine, ray tracing, flat vector,
pixel art, anime, cel-shading, disney cartoon, gritty, dirty, rusty,
weathered, war-torn, cyberpunk, neon, oil painting, watercolor, blurry,
deformed, text, watermark, signature
```

### Side-profile lock (только для gameplay-техники)

```
STRICT ORTHOGRAPHIC 2D SIDE VIEW, dead-on left side profile, facing LEFT,
horizontal, no perspective, no 3/4, no top view, no bottom view, no diagonal
camera, no visible upper wing surface in perspective, no visible underside
of wings. Like a clean side-view game sprite / technical profile. Full object
visible nose to tail.
```

---

## 4. Технические правила

### 4.1 Формат и фон

PNG, sRGB, **без текста на ассете**.

**Фон для генерации — единый сплошной цвет, не «прозрачный»:**

| Категория ассета | Фон при генерации | Почему |
|---|---|---|
| Персонажи, самолёты, дирижабли, острова, облака, снаряды, иконки | **`#FF00FF` pure magenta** | Magenta никогда не встречается в нашей палитре — key-out в один клик через threshold-color в Photoshop / GIMP / remove.bg |
| VFX (дым, огонь, искры, вспышки, взрывы) | **`#000000` pure black** | У VFX мягкие альфа-края — magenta их убьёт. Чёрный + additive blending в Pixi даёт нативную прозрачность |
| Фоны неба (`sky-*.png`) | n/a — opaque фон самой картинки | Это и есть фон, ничего вырезать не надо |

**Почему так, а не «transparent background»:** image-gen AI (MJ, Flux, DALL-E) на запрос «transparent» в 90% случаев генерит белый/серый фон с halo по краям. Сплошной цвет — AI рисует ровно его, никакого мусора по краям, чистый key.

**Постобработка перед укладкой в `assets/`:**
1. Открыть в Photoshop / GIMP / Photopea
2. Magic Wand с tolerance ~5 на фон → Delete → Save as PNG with alpha
3. Или загнать через remove.bg / Squoosh (они тоже умеют по сплошному цвету)
4. Проверить что по краям нет розовых/чёрных follow-up пикселей

### 4.2 Два класса ракурса

- **Gameplay sprite** (самолёт в бою) → строгий side profile, нос влево, **без пилота** внутри (кабина пустая — пилот рисуется отдельным overlay).
- **Hero shot** (меню, level-up, маркетинг) → 3/4 ракурс как у твоего синего референса, **можно с пилотом** в кабине.

### 4.2.1 Разделение референсов

- **Chico reference** → только стиль рендера: чистота, цвет, мягкий свет, дружелюбный game-art finish.
- **Vehicle reference** → форма техники: силуэт, крылья, кабина, винт, пропорции, детали.
- Для gameplay-самолёта нельзя сохранять 3/4-ракурс из красивого референса. Нужно взять дизайн и **перевести его в строгий боковой профиль**.
- Не добавлять технике глаза, рот, лапы, морду, анатомию Чико или “живого маскота”.

### 4.3 Размеры (2× retina)

| Тип | Генерация |
|---|---|
| Самолёт gameplay | 1024 × 512 |
| Самолёт hero shot | 1536 × 1024 |
| Босс gameplay | 1280 × 640 |
| Чико full body | 768 × 1152 |
| Чико bust | 768 × 768 |
| Чико с парашютом | 256 × 384 |
| Облако | 512 × 256 |
| Остров | 1024 × 512 |
| Фон неба (opaque) | 2048 × 1024 |
| Снаряд | 128 × 64 |
| VFX-текстура | 256 × 256 |

### 4.4 Куда складывать

```
packages/render/src/assets/
├── characters/   ← Чико и пилоты
├── planes/       ← самолёты
├── world/        ← небо, облака, острова
├── projectiles/  ← пули, бомбы, ракеты
└── vfx/          ← дым, огонь, искры
```

Naming: `category-name-variant.png` (например `plane-player-side.png`).

### 4.5 Важно про спрайт-листы

**Не пытайся генерить 4×3 спрайт-листы одним промптом.** Image-gen AI (MJ, Flux) не умеют делать консистентные кадры в сетке — каждая ячейка получается в разном стиле и масштабе. Генерируй **по одной картинке за раз**, потом собирай атлас вручную в Aseprite/Photoshop, если понадобится. Большинство ассетов в этой игре — одиночные PNG, шиты для анимации появятся позже на этапе полировки.

---

## 5. Лор-канон

### 5.1 СОВ — Содружество объединённых видов

Фракция игрока. По лору разные виды животных перестали враждовать и объединились в Содружество. Чико — капитан звена в СОВ.

**Цвета СОВ:** кобальт `#2E6BC6` + латунь `#c89438`.

**Логотип-эмблема СОВ** (на каждом самолёте, дирижабле, форме):

```
Flat vector logo: solid cobalt blue circle (#2E6BC6), negative-space silhouette
of a five-toed reptile/frog footprint cut out from the center, each toe ending
in a round pad, toes radiating from a central palm, bottom-left of the circle
has a sharp wedge bite cut out. Minimalist 2-color design, no gradient.
```

**Важно:** это **не** обычная кошачья/собачья paw-print. Именно след амфибии/рептилии с круглыми подушечками и клиновидным укусом снизу-слева.

### 5.2 Багровые Шакалы — главный враг

Пиратская фракция. Лидер — **Барон Рудольф фон Клык** (короткое имя: **Клык**), аристократичный шакал-ас, харизматичный мультяшный злодей: вежливый, театральный, самодовольный, с хищной улыбкой. **Не монстр** — обаятельный villain в стиле Брикбэка из Hot Wheels или Капитана Крюка.

**Цвета Шакалов:** кроваво-красный `#c0392b` + графит `#1a1a24` + латунь.

**Эмблема Шакалов:** белый оскал шакала на красном поле + shark-mouth-зубы вокруг носа самолёта.

### 5.3 Остальные фракции (P1, после прототипа)

- **Латунный Картель** — золото `#c89438` + бордо `#7a1a1a`. Аристократы-наёмники с цеппелинами-казино.
- **Стая Альбатроса** — белый + графит + бирюза. Технократы с тесла-оружием.

---

## 6. Каталог P0 — прототип боёвки (13 ассетов)

### 6.1 `chico-portrait.png` — Чико full body

Главный портрет для меню/сплеша. **Размер:** 768 × 1152.

```
[STYLE LOCK]

Subject: Chico the orange salamander pilot — bipedal lizard with big round
blue eyes, soft cream belly, warm orange spotted skin, small fin-crests on
cheeks, short tail. Wearing cobalt blue flight jacket with brass buttons,
cream silk scarf, brown leather aviator cap with brass goggles on forehead.
Confident heroic standing pose, hands on hips, full body shot, slight
low-angle.

Negative: [NEGATIVE]
```

### 6.2 `chico-cockpit.png` — Чико в кабине (bust)

Для интро перед миссией / экрана паузы. **Размер:** 768 × 768.

```
[STYLE LOCK]

Subject: Chico the orange salamander pilot, chest-up portrait, brown leather
aviator cap with brass goggles pulled down over his big blue eyes, cream
silk scarf flowing in wind. Cobalt flight jacket. Inside open biplane
cockpit — hints of brass instrument dials and curved windshield frame.
Determined focused expression. 3/4 angle, slight upward tilt.

Negative: [NEGATIVE]
```

### 6.3 `chico-parachute.png` — Чико с парашютом

Спрайт когда самолёт сбит и пилот выпрыгнул. **Размер:** 256 × 384.

```
[STYLE LOCK]
[SIDE-PROFILE LOCK]

Subject: Chico the salamander pilot dangling from open round parachute
canopy in cream and crimson stripes with brass cords. Chico small below in
cobalt jacket and cap, arms slightly out, relaxed. Side profile facing left.

Negative: [NEGATIVE]
```

### 6.4 `plane-player-side.png` — самолёт Чико (gameplay) ⭐ КРИТИЧНЫЙ

Главный gameplay-спрайт всего боя. **Размер:** 1024 × 512.

```
[STYLE LOCK]
[SIDE-PROFILE LOCK]

Use the attached blue SOV biplane image as the MAIN design reference for
aircraft proportions, brass engine, cockpit, landing gear, struts, color
placement, and premium finish. Do NOT keep its 3/4 camera angle. Convert
that design into a strict flat orthographic side-view gameplay sprite.
Use Chico character references only for color warmth and clean rendering style.
Do not add eyes, mouth, creature face, paws, or mascot anatomy to the plane.

Subject: Captain Chico's heroic SOV biplane fighter — TWO STACKED WINGS with
rigging wires and brass struts, slightly swept-back wings, single radial nose
engine with visible cylinder heads, two-blade wooden propeller, fixed landing
gear in spats, single open cockpit with cream/cobalt glass and brass frame.
EMPTY cockpit (no pilot inside — separate overlay). Deep cobalt blue body
(#11305a), cobalt wing panels (#2E6BC6), brass cowling (#c89438), golden
yellow squadron stripes. Exact SOV emblem on fuselage: solid cobalt blue
circle (#2E6BC6) with a negative-space five-toed reptile/frog footprint cut
out from the center, round pad at the end of each toe, toes radiating from
a central palm, sharp wedge bite cut out at the bottom-left of the circle.
It must NOT look like a cat paw, dog paw, bear paw, or generic four-toe paw
print. Twin wing-mounted machine guns.

Negative: [NEGATIVE], extra wings, extra propellers, pilot inside, monoplane,
3/4 view, perspective, top view, bottom view, diagonal camera, visible upper wing
surface in perspective, wrong paw logo, cat paw, dog paw, generic paw print,
eyes on plane, mouth on plane, creature plane
```

Сгенери минимум 10 вариаций — это база всего боя.

### 6.5 `plane-player-hero.png` — самолёт Чико (hero shot для меню)

**Размер:** 1536 × 1024.

```
[STYLE LOCK]

Subject: Same SOV biplane as gameplay version — cobalt body, brass, paw
emblem, two stacked wings, radial engine. Dynamic 3/4 hero shot from
front-left, slight low-angle, soaring forward, propeller motion blur,
Chico visible in cockpit with goggles on and scarf streaming. Heroic
adventurous composition.

Negative: [NEGATIVE]
```

### 6.6 `plane-jackals-side.png` — самолёт Шакалов (gameplay)

**Размер:** 1024 × 512.

```
[STYLE LOCK]
[SIDE-PROFILE LOCK]

Use the attached red Jackals biplane image as the MAIN design reference for
aircraft proportions, aggressive silhouette, brass engine, landing gear,
struts, black wings, red body, shark-mouth nose, and faction attitude. Do NOT
keep its 3/4 camera angle. Convert that design into a strict flat orthographic
side-view gameplay sprite. Use Chico character references only for clean
colorful rendering style, not for vehicle shape.

Subject: Crimson Jackals pirate biplane — TWO STACKED WINGS with rigging,
single radial nose engine, two-blade propeller, open cockpit with dark
crimson glass, EMPTY cockpit (no detailed pilot). Blood-red body (#c0392b),
matte graphite-black wings (#1a1a24), dark burgundy shadows. White snarling
jackal head emblem on fuselage, shark-mouth teeth painted around nose, twin
wing-mounted machine guns. Hungry aggressive silhouette but still clean
polished cartoon art — not dirty, not realistic.

Negative: [NEGATIVE], pilot inside, monoplane, 3/4 view, perspective, top view,
bottom view, diagonal camera, visible upper wing surface in perspective, cute
animal plane, eyes on plane, creature plane
```

### 6.7 `plane-klyk-boss.png` — самолёт Барона Клыка (босс)

**Размер:** 1280 × 640 (крупнее обычного — босс).

```
[STYLE LOCK]
[SIDE-PROFILE LOCK]

Use the attached red Jackals biplane image as the MAIN design reference, but
make it larger, more aristocratic, and boss-like. Do NOT keep any 3/4 camera
angle from the reference. Convert the design into a strict flat orthographic
side-view gameplay boss sprite. Empty cockpit, no pilot inside.

Subject: Baron Rudolf von Klyk's elite boss biplane — larger and more ornate
than standard Jackals plane, TWO STACKED WINGS with brass-trimmed struts,
twin radial engines on wings (not single nose engine), three-blade propellers,
armored cockpit, sharp blade-like nose spike. Deep crimson (#c0392b) with
matte black accents, gold filigree trim, aristocratic heraldic crest with
crowned jackal on fuselage. Imposing, regal, dangerous.

Negative: [NEGATIVE], pilot inside, monoplane, weathered, 3/4 view, perspective,
top view, bottom view, diagonal camera, visible upper wing surface in perspective,
cute animal plane, eyes on plane, creature plane
```

### 6.8 `sky-sunset.png` — фон неба (закат)

**Размер:** 2048 × 1024, **opaque**.

```
[STYLE LOCK]
OVERRIDE: ignore the "solid pure magenta background" rule from style lock.
This asset IS the background itself — render as an opaque full-frame sky scene.

Subject: Dramatic sunset sky panorama in Alto's Odyssey style — smooth
vertical gradient from deep magenta-purple zenith (#7a4488), through warm
rose (#d96f7a), to glowing orange-amber horizon (#ff9550). A few tiny
distant graphite (#2a2f3a) island silhouettes at horizon line. Subtle haze.
No foreground clouds — clouds added as separate layer.

Negative: [NEGATIVE], planes, characters, detailed foreground, magenta backdrop
```

Дополнительно сгенерь `sky-noon.png` (день) и `sky-night.png` (ночь со звёздами и луной) — те же промпты с другими цветами.

### 6.9 Облака — 3 PNG

`cloud-far.png`, `cloud-mid.png`, `cloud-near.png`. **Размер:** 512 × 256.

```
[STYLE LOCK]

Subject: A single stylized cumulus cloud — 5-6 rounded soft lobes, cream-white
top (#fff4dc), warm ochre underbelly shading (#e8b890), thin dark contour on
top edges only, soft interior gradient. Isolated single cloud.

Negative: [NEGATIVE], multiple clouds, sky background, planes
```

Для FAR — без контура, светлее, мельче. Для NEAR — сильнее контур, плотнее тень, крупнее. Сгенери по 3 варианта формы для каждого слоя.

### 6.10 Острова — 3 PNG

`island-lighthouse.png`, `island-tavern.png`, `island-bare.png`. **Размер:** 1024 × 512.

```
[STYLE LOCK]

Subject: A small floating rock island hovering in the sky — stylized inverted-
pyramid rock formation, graphite-brown body (#2a2f3a) with olive vegetation
tufts (#5a6a3a), flat grassy top with a small brass-roofed lighthouse and a
few stylized cypress trees. Side view, isolated.

Negative: [NEGATIVE], multiple islands, sky background
```

Для tavern — заменить маяк на деревянный домик с трубой. Для bare — голая скала без построек.

### 6.11 Снаряды — 4 PNG

`bullet-player.png`, `bullet-jackals.png`, `bomb.png`, `rocket.png`. **Размер:** 128 × 64.

```
[STYLE LOCK]

Subject (bullet-player): Glowing tracer bullet — elongated capsule, bright
warm yellow-white core (#fff5a0), amber glow halo, motion-blur trail tapering
off the back. Horizontal, moving right.

Negative: [NEGATIVE], gun, character
```

Для врага: красно-оранжевые `#ff5a22 → #c02a08`. Бомба: тёмная капля с латунным фитилём. Ракета: коническая с реактивным шлейфом.

### 6.12 VFX-текстуры — 5 PNG

`vfx-smoke.png`, `vfx-fire.png`, `vfx-spark.png`, `vfx-muzzle-flash.png`, `vfx-explosion.png`. **Размер:** 256 × 256.

```
[STYLE LOCK]
OVERRIDE: ignore the "solid pure magenta background" rule. For VFX use
SOLID PURE BLACK BACKGROUND (#000000) — VFX has soft alpha edges that
magenta-key would destroy; black + additive blending in-game gives clean
transparency.

Subject: A single stylized VFX particle on solid black background —
[smoke puff / fire flame / yellow spark / muzzle flash star / explosion bloom].
Soft glowing edges, bright centre fading smoothly to pure black at the
edges (this gradient IS the transparency — do not surround it with anything
else). No hard contour line.

Negative: [NEGATIVE], multiple particles, gritty, magenta background, white background
```

---

## 7. P1 — после прототипа

Когда боёвка зайдёт и захочется развивать:

- Самолёты Латунного Картеля + Стаи Альбатроса (gameplay + hero для каждой)
- Дирижабль-авианосец СОВ (база Чико)
- Пиратские дирижабли-налётчики
- HUD-приборка (cockpit panel)
- Иконки апгрейдов (~20 штук)
- Эмблемы фракций (4 штуки)
- Title screen art и логотип игры

Не генерим заранее — пока непонятно как игра будет ощущаться.

---

## 8. Workflow

**Порядок генерации:**

1. **Чико-портрет** (6.1) — это canon персонажа, всё остальное опирается на него.
2. **Самолёт игрока gameplay** (6.4) — самый критичный ассет, влияет на восприятие всего боя.
3. **Фон неба + 1 облако** — атмосфера.
4. Дальше по списку.

**После каждых 5-7 генераций** разложи их рядом и проверь:

- Палитра одна?
- Стиль один (polished 2D cartoon game art with soft volume, а не псевдо-3D/3/4 gameplay)?
- Контуры одинаковой толщины?
- Узнаётся Чико-вселенная?

Один явный выпад — перегенерь, не оставляй «и так сойдёт».

**Стратегия батчей:** для каждого ассета генерь 6 вариаций, выбирай 1 лучшую. Не меняй Style Lock между ассетами одной категории — иначе разъедутся.

---

**Конец. Всё что не уместилось — добавим отдельной задачей по запросу.**
