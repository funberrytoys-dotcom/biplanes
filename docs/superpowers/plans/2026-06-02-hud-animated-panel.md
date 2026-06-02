# Анимированная приборная панель (HUD) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить нарисованную кодом приборную панель HUD сборкой из готовых арт-ассетов — фон-панель + анимированные стрелки, рычаги, лампы и цифровые табло, привязанные к игровому состоянию.

**Architecture:** Новый модуль `cockpit-panel.ts` владеет всей визуальной сборкой панели (слои PixiJS Sprite/Text поверх фоновой картинки) и её per-frame анимацией. Чистая математика маппинга (значение→угол стрелки, значение→позиция рычага, демпфирование, форматирование цифр) вынесена в тестируемый `gauge-math.ts`. `hud.ts` перестаёт рисовать приборку и только композирует панель + сохраняет служебные оверлеи (стролл/респавн/RAM, стрелки на врагов/караван). Координаты посадочных мест заданы долями от размера панели в одном блоке констант и калибруются визуально.

**Tech Stack:** TypeScript, PixiJS 8, Vitest, pnpm workspaces. Спека: `docs/superpowers/specs/2026-06-02-hud-animated-panel-design.md`.

---

## File Structure

- **Create** `apps/web/public/assets/biplanes/hud/panel.png` — фон-панель (из `upscaler_00053_.png`).
- **Create** `apps/web/public/assets/biplanes/hud/needle.png`, `lever_knob.png`, `lamp_yellow.png`, `lamp_red.png` — подвижные детали.
- **Create** `packages/render/src/scene/gauge-math.ts` — чистые функции маппинга (тестируемые).
- **Create** `packages/render/src/scene/gauge-math.test.ts` — юнит-тесты.
- **Create** `packages/render/src/scene/cockpit-panel.ts` — сборка и анимация панели.
- **Create** `packages/render/vitest.config.ts` + добавить `test` script в `packages/render/package.json` — чтобы тесты render-пакета реально запускались (сейчас `render-clock.test.ts` не запускается ничем).
- **Modify** `packages/render/src/scene/hud.ts` — убрать рисование приборки, делегировать в `cockpit-panel`, сохранить служебные оверлеи.

`main.ts` НЕ меняется: публичный интерфейс `createHud` (`container`, `update`, `resize`, `showDirArrow`, `hideDirArrow`, `showEnemyArrows`, `hideEnemyArrows`, `showRamNotice`) сохраняется без изменений.

---

## Task 1: Скопировать арт-ассеты в web public

**Files:**
- Create: `apps/web/public/assets/biplanes/hud/panel.png`
- Create: `apps/web/public/assets/biplanes/hud/needle.png`
- Create: `apps/web/public/assets/biplanes/hud/lever_knob.png`
- Create: `apps/web/public/assets/biplanes/hud/lamp_yellow.png`
- Create: `apps/web/public/assets/biplanes/hud/lamp_red.png`

- [ ] **Step 1: Скопировать файлы**

Источник — Godot-проект. `upscaler_00053_.png` становится `panel.png`.

```bash
cd "C:/Users/serge/Documents/Playground/Biplanes"
SRC="C:/Users/serge/Documents/Playground/Biplanes-godot/art/ui"
DST="apps/web/public/assets/biplanes/hud"
cp "$SRC/upscaler_00053_.png" "$DST/panel.png"
cp "$SRC/needle.png"          "$DST/needle.png"
cp "$SRC/lever_knob.png"      "$DST/lever_knob.png"
cp "$SRC/lamp_yellow.png"     "$DST/lamp_yellow.png"
cp "$SRC/lamp_red.png"        "$DST/lamp_red.png"
```

- [ ] **Step 2: Проверить, что файлы на месте и ненулевые**

Run:
```bash
ls -la apps/web/public/assets/biplanes/hud/
```
Expected: пять файлов `panel.png`, `needle.png`, `lever_knob.png`, `lamp_yellow.png`, `lamp_red.png`, каждый > 0 байт.

- [ ] **Step 3: Удалить устаревшие панели**

```bash
git rm apps/web/public/assets/biplanes/hud/cockpit_panel.png apps/web/public/assets/biplanes/hud/cockpit_panel_temp.png
```
Если файлы не были в git (untracked) — удалить вручную: `rm -f apps/web/public/assets/biplanes/hud/cockpit_panel*.png`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/public/assets/biplanes/hud/
git commit -m "assets: add assembled HUD panel and animated parts; drop old cockpit_panel"
```

---

## Task 2: Включить запуск тестов в render-пакете

Сейчас `packages/render` не имеет `test` script и vitest-конфига, поэтому тесты не выполняются. Добавляем минимальный конфиг (vitest уже установлен в корне).

**Files:**
- Create: `packages/render/vitest.config.ts`
- Modify: `packages/render/package.json`

- [ ] **Step 1: Создать vitest-конфиг**

`packages/render/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: true,
  },
});
```

- [ ] **Step 2: Добавить test-скрипты в package.json**

В `packages/render/package.json` в блок `"scripts"` добавить две строки (рядом с `typecheck`/`lint`):
```json
    "test": "vitest run",
    "test:watch": "vitest",
```

- [ ] **Step 3: Проверить, что существующий тест запускается**

Run:
```bash
pnpm --filter @biplanes/render test
```
Expected: vitest находит и проходит `src/render-clock.test.ts` (несколько passed-тестов).

- [ ] **Step 4: Commit**

```bash
git add packages/render/vitest.config.ts packages/render/package.json
git commit -m "test(render): enable vitest in render package"
```

---

## Task 3: Чистая математика приборов (`gauge-math.ts`) — TDD

**Files:**
- Test: `packages/render/src/scene/gauge-math.test.ts`
- Create: `packages/render/src/scene/gauge-math.ts`

- [ ] **Step 1: Написать падающий тест**

`packages/render/src/scene/gauge-math.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  clamp01,
  normalize,
  lerp,
  gaugeAngle,
  damp,
  dampAngle,
  padDigits,
} from './gauge-math.js';

describe('clamp01', () => {
  it('clamps below 0 and above 1', () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(0.3)).toBeCloseTo(0.3);
  });
});

describe('normalize', () => {
  it('maps value across range into 0..1', () => {
    expect(normalize(50, 0, 100)).toBeCloseTo(0.5);
  });
  it('clamps out-of-range values', () => {
    expect(normalize(-10, 0, 100)).toBe(0);
    expect(normalize(200, 0, 100)).toBe(1);
  });
  it('returns 0 for degenerate range', () => {
    expect(normalize(5, 10, 10)).toBe(0);
  });
});

describe('lerp', () => {
  it('interpolates between a and b', () => {
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 1)).toBe(20);
    expect(lerp(10, 20, 0.5)).toBe(15);
  });
});

describe('gaugeAngle', () => {
  it('maps fraction across sweep from start', () => {
    expect(gaugeAngle(0, 1, 2)).toBeCloseTo(1);
    expect(gaugeAngle(1, 1, 2)).toBeCloseTo(3);
    expect(gaugeAngle(0.5, 1, 2)).toBeCloseTo(2);
  });
  it('clamps fraction', () => {
    expect(gaugeAngle(5, 0, 2)).toBeCloseTo(2);
  });
});

describe('damp', () => {
  it('moves current toward target by factor', () => {
    expect(damp(0, 10, 0.5)).toBeCloseTo(5);
  });
  it('converges over repeated application', () => {
    let v = 0;
    for (let i = 0; i < 100; i++) v = damp(v, 10, 0.3);
    expect(v).toBeCloseTo(10, 3);
  });
});

describe('dampAngle', () => {
  it('takes the short way around the circle', () => {
    // target just past +PI should move negatively (short way), not +almost-2PI
    const next = dampAngle(0, Math.PI * 1.9, 0.5);
    expect(next).toBeLessThan(0);
  });
  it('converges to target modulo 2PI', () => {
    let a = 0;
    for (let i = 0; i < 200; i++) a = dampAngle(a, 1.2, 0.3);
    expect(Math.cos(a)).toBeCloseTo(Math.cos(1.2), 3);
    expect(Math.sin(a)).toBeCloseTo(Math.sin(1.2), 3);
  });
});

describe('padDigits', () => {
  it('left-pads to width', () => {
    expect(padDigits(7, 4)).toBe('0007');
    expect(padDigits(1234, 4)).toBe('1234');
  });
  it('rounds and clamps negatives to 0', () => {
    expect(padDigits(12.6, 3)).toBe('013');
    expect(padDigits(-5, 2)).toBe('00');
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run:
```bash
pnpm --filter @biplanes/render test -- gauge-math
```
Expected: FAIL — `Cannot find module './gauge-math.js'` (файл ещё не создан).

- [ ] **Step 3: Реализовать `gauge-math.ts`**

`packages/render/src/scene/gauge-math.ts`:
```ts
/** Clamp a value into [0, 1]. */
export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Normalize `value` across [min, max] into [0, 1], clamped. Degenerate range → 0. */
export function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return clamp01((value - min) / (max - min));
}

/** Linear interpolation between a and b by t (t not clamped). */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Map a 0..1 fraction (clamped) to a needle angle across `sweep` from `startAngle`. */
export function gaugeAngle(frac: number, startAngle: number, sweep: number): number {
  return startAngle + clamp01(frac) * sweep;
}

/** Move `current` toward `target` by `factor` (0..1). Frame-based easing. */
export function damp(current: number, target: number, factor: number): number {
  return current + (target - current) * clamp01(factor);
}

/** Angular damp toward `target` taking the shortest path around the circle (radians). */
export function dampAngle(current: number, target: number, factor: number): number {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * clamp01(factor);
}

/** Round, clamp negatives to 0, and left-pad with zeros to `width` characters. */
export function padDigits(value: number, width: number): string {
  const n = Math.max(0, Math.round(value));
  return n.toString().padStart(width, '0');
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run:
```bash
pnpm --filter @biplanes/render test -- gauge-math
```
Expected: PASS (все describe-блоки зелёные).

- [ ] **Step 5: Commit**

```bash
git add packages/render/src/scene/gauge-math.ts packages/render/src/scene/gauge-math.test.ts
git commit -m "feat(hud): pure gauge math helpers (angle/lever/damp/format)"
```

---

## Task 4: Модуль сборки панели (`cockpit-panel.ts`)

Модуль строит слои панели и анимирует их. Координаты — доли от размера фоновой картинки (калибруются в Task 6). Текстуры грузятся асинхронно (как в `clouds.ts`): пока не загрузились — спрайты пустые, панель «дорисовывается» по готовности.

**Files:**
- Create: `packages/render/src/scene/cockpit-panel.ts`

- [ ] **Step 1: Создать модуль**

`packages/render/src/scene/cockpit-panel.ts`:
```ts
import { Assets, Container, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import type { WorldState } from '@biplanes/core';
import { GROUND_Y } from '@biplanes/shared';
import {
  normalize,
  clamp01,
  gaugeAngle,
  dampAngle,
  damp,
  lerp,
  padDigits,
} from './gauge-math.js';

const BASE = '/assets/biplanes/hud/';

// Нативный размер собранной панели (panel.png = upscaler_00053_.png).
const PANEL_W = 4200;
const PANEL_H = 1498;
const PANEL_ASPECT = PANEL_W / PANEL_H; // ~2.804

// Игровые опорные значения для нормирования стрелок.
const SPEED_MAX = 950;        // как G_MAX_REF в старом HUD
const STALL_LINE = 620;       // порог стролла
const ALT_REF_PX = 900;       // высота над землёй (px) → полная шкала ALT; калибруется
const OVERHEAT = 0.85;        // boostHeat ≥ → перегрев
const AMMO_PLACEHOLDER = 60;  // патронов в прототипе нет; реальный счётчик — позже

// Цифры на табло (для читаемых значений на циферблатах).
const RPM_DISPLAY_MAX = 600;  // ОБОРОТЫ: rpmFrac * RPM_DISPLAY_MAX
const ALT_DISPLAY_MAX = 20000; // ВЫСОТА: altFrac * ALT_DISPLAY_MAX (шкала ассета)

// Углы стрелок (рад, y вниз, по часовой = +). Сид как в старом HUD; точная
// привязка к рискам ассета — калибровка в Task 6.
const GAUGE_START = Math.PI * 0.75; // нижний-левый
const GAUGE_SWEEP = Math.PI * 1.5;  // 270°

// --- Посадочные места (доли от PANEL_W / PANEL_H). КАЛИБРУЮТСЯ в Task 6. ---
const NEEDLE_HUB_ANCHOR_Y = 0.82; // втулка стрелки = точка вращения (доля высоты needle.png)
const GAUGE_RADIUS_FRAC = 0.085;  // длина стрелки в долях ширины панели

interface GaugeSpec { cx: number; cy: number; }
const GAUGE_RPM: GaugeSpec = { cx: 0.075, cy: 0.42 };
const GAUGE_SPD: GaugeSpec = { cx: 0.165, cy: 0.42 };
const GAUGE_ALT: GaugeSpec = { cx: 0.255, cy: 0.42 };

interface LeverSpec { x: number; topY: number; bottomY: number; }
const LEVER_GAS: LeverSpec = { x: 0.585, topY: 0.30, bottomY: 0.72 };
const LEVER_BOOST: LeverSpec = { x: 0.645, topY: 0.30, bottomY: 0.72 };
const LEVER_W_FRAC = 0.05; // ширина ручки в долях ширины панели

const LAMP_YELLOW = { x: 0.715, y: 0.42 };
const LAMP_RED = { x: 0.715, y: 0.62 };
const LAMP_W_FRAC = 0.035;

// Цифровые окошки: { x, y } центр текста, доли панели.
const READOUT_RPM = { x: 0.075, y: 0.74 };
const READOUT_SPD = { x: 0.165, y: 0.74 };
const READOUT_ALT = { x: 0.255, y: 0.74 };
const COUNTER_KILLS = { x: 0.83, y: 0.40 };
const COUNTER_AMMO = { x: 0.83, y: 0.62 };
const RADIO_SCREEN = { x: 0.42, y: 0.30, fontFrac: 0.022 }; // верх-лево текстового блока радио

export interface CockpitPanelHandle {
  container: Container;
  update(s: WorldState): void;
  resize(w: number, h: number): void;
}

export function createCockpitPanel(width: number, height: number): CockpitPanelHandle {
  const container = new Container();

  // Фон-панель.
  const bg = new Sprite();
  bg.anchor.set(0.5, 1); // нижний центр
  container.addChild(bg);

  // Стрелки.
  const needleRpm = new Sprite();
  const needleSpd = new Sprite();
  const needleAlt = new Sprite();
  for (const n of [needleRpm, needleSpd, needleAlt]) {
    n.anchor.set(0.5, NEEDLE_HUB_ANCHOR_Y);
    container.addChild(n);
  }

  // Рычаги.
  const leverGas = new Sprite();
  const leverBoost = new Sprite();
  for (const l of [leverGas, leverBoost]) {
    l.anchor.set(0.5, 0.5);
    container.addChild(l);
  }

  // Лампы.
  const lampYellow = new Sprite();
  const lampRed = new Sprite();
  for (const l of [lampYellow, lampRed]) {
    l.anchor.set(0.5, 0.5);
    l.alpha = 0;
    container.addChild(l);
  }

  // Текстовые табло.
  const digitStyle = () => new TextStyle({
    fontFamily: 'monospace', fontSize: 18, fontWeight: 'bold',
    fill: 0xffb340, stroke: { color: 0x1a0d00, width: 2 },
  });
  const readoutRpm = new Text({ text: '0000', style: digitStyle() });
  const readoutSpd = new Text({ text: '0000', style: digitStyle() });
  const readoutAlt = new Text({ text: '00000', style: digitStyle() });
  const counterKills = new Text({ text: '0000', style: digitStyle() });
  const counterAmmo = new Text({ text: '0000', style: digitStyle() });
  for (const t of [readoutRpm, readoutSpd, readoutAlt, counterKills, counterAmmo]) {
    t.anchor.set(0.5, 0.5);
    container.addChild(t);
  }

  const radioText = new Text({
    text: '',
    style: new TextStyle({ fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold', fill: 0x33ff33 }),
  });
  radioText.anchor.set(0, 0);
  container.addChild(radioText);

  // Загрузка текстур (как clouds.ts: не блокирует, дорисовывает по готовности).
  const urls = [
    `${BASE}panel.png`, `${BASE}needle.png`, `${BASE}lever_knob.png`,
    `${BASE}lamp_yellow.png`, `${BASE}lamp_red.png`,
  ];
  Assets.load(urls)
    .then((loaded: Record<string, Texture>) => {
      bg.texture = loaded[`${BASE}panel.png`]!;
      const nt = loaded[`${BASE}needle.png`]!;
      needleRpm.texture = nt; needleSpd.texture = nt; needleAlt.texture = nt;
      const lt = loaded[`${BASE}lever_knob.png`]!;
      leverGas.texture = lt; leverBoost.texture = lt;
      lampYellow.texture = loaded[`${BASE}lamp_yellow.png`]!;
      lampRed.texture = loaded[`${BASE}lamp_red.png`]!;
      layout(width, height);
    })
    .catch(() => { /* отсутствие арта не фатально — панель просто пустая */ });

  // Текущие (демпфируемые) состояния анимации.
  let angRpm = GAUGE_START, angSpd = GAUGE_START, angAlt = GAUGE_START;
  let yGas = 0, yBoost = 0;
  let aYellow = 0, aRed = 0;
  let timeSec = 0;

  // Текущий масштаб и позиция панели (px), пересчитываются в layout().
  let panelScale = 1;
  let panelW = PANEL_W, panelH = PANEL_H;
  let panelLeft = 0, panelTop = 0;

  function px(fx: number, fy: number): { x: number; y: number } {
    return { x: panelLeft + fx * panelW, y: panelTop + fy * panelH };
  }

  function layout(w: number, h: number) {
    width = w; height = h;
    // Панель во всю ширину внизу, пропорции сохранены.
    panelW = w;
    panelH = w / PANEL_ASPECT;
    panelScale = panelW / PANEL_W;
    panelLeft = 0;
    panelTop = h - panelH;

    // bg: anchor нижний-центр.
    bg.x = w / 2;
    bg.y = h;
    if (bg.texture && bg.texture.width) {
      bg.scale.set(panelW / bg.texture.width);
    }

    // Стрелки.
    placeNeedle(needleRpm, GAUGE_RPM);
    placeNeedle(needleSpd, GAUGE_SPD);
    placeNeedle(needleAlt, GAUGE_ALT);

    // Рычаги.
    placeLeverX(leverGas, LEVER_GAS);
    placeLeverX(leverBoost, LEVER_BOOST);

    // Лампы.
    placeLamp(lampYellow, LAMP_YELLOW);
    placeLamp(lampRed, LAMP_RED);

    // Текст.
    placeText(readoutRpm, READOUT_RPM, 0.02);
    placeText(readoutSpd, READOUT_SPD, 0.02);
    placeText(readoutAlt, READOUT_ALT, 0.02);
    placeText(counterKills, COUNTER_KILLS, 0.024);
    placeText(counterAmmo, COUNTER_AMMO, 0.024);
    const rp = px(RADIO_SCREEN.x, RADIO_SCREEN.y);
    radioText.x = rp.x; radioText.y = rp.y;
    radioText.style.fontSize = Math.max(9, RADIO_SCREEN.fontFrac * panelH);
  }

  function placeNeedle(n: Sprite, g: GaugeSpec) {
    const p = px(g.cx, g.cy);
    n.x = p.x; n.y = p.y;
    if (n.texture && n.texture.height) {
      // Длина стрелки = GAUGE_RADIUS_FRAC * panelW; масштаб от высоты needle над втулкой.
      const targetLen = GAUGE_RADIUS_FRAC * panelW;
      const aboveHub = n.texture.height * NEEDLE_HUB_ANCHOR_Y;
      n.scale.set(targetLen / aboveHub);
    }
  }

  function placeLeverX(l: Sprite, spec: LeverSpec) {
    const p = px(spec.x, spec.topY);
    l.x = p.x;
    if (l.texture && l.texture.width) {
      l.scale.set((LEVER_W_FRAC * panelW) / l.texture.width);
    }
  }

  function placeLamp(l: Sprite, spec: { x: number; y: number }) {
    const p = px(spec.x, spec.y);
    l.x = p.x; l.y = p.y;
    if (l.texture && l.texture.width) {
      l.scale.set((LAMP_W_FRAC * panelW) / l.texture.width);
    }
  }

  function placeText(t: Text, spec: { x: number; y: number }, fontFrac: number) {
    const p = px(spec.x, spec.y);
    t.x = p.x; t.y = p.y;
    t.style.fontSize = Math.max(8, fontFrac * panelH);
  }

  layout(width, height);

  return {
    container,
    update(s: WorldState) {
      timeSec = s.timeSec;
      const k = s.player.kinematic;
      const throttle = k.throttleLevel ?? 0;
      const boostActive = s.player.boostActive === true;
      const heat = clamp01(s.player.boostHeat ?? 0);
      const speed = k.g;
      const stalling = speed < STALL_LINE && s.player.state === 'flying';
      const groundY = s.worldHeight ? s.worldHeight - 90 : GROUND_Y;
      const altitudePx = Math.max(0, groundY - k.position.y);

      // --- Целевые доли стрелок ---
      const rpmFrac = clamp01(throttle * 0.85 + (boostActive ? 0.15 : 0));
      const spdFrac = normalize(speed, 0, SPEED_MAX);
      const altFrac = normalize(altitudePx, 0, ALT_REF_PX);

      const trembleSpd = stalling ? (Math.random() - 0.5) * 0.16 : 0;
      const tRpm = gaugeAngle(rpmFrac, GAUGE_START, GAUGE_SWEEP);
      const tSpd = gaugeAngle(spdFrac, GAUGE_START, GAUGE_SWEEP) + trembleSpd;
      const tAlt = gaugeAngle(altFrac, GAUGE_START, GAUGE_SWEEP);
      angRpm = dampAngle(angRpm, tRpm, 0.18);
      angSpd = dampAngle(angSpd, tSpd, 0.20);
      angAlt = dampAngle(angAlt, tAlt, 0.18);
      needleRpm.rotation = angRpm;
      needleSpd.rotation = angSpd;
      needleAlt.rotation = angAlt;

      // --- Рычаги (y движется внутри прорези) ---
      const gasP = px(LEVER_GAS.x, lever01ToFrac(LEVER_GAS, throttle));
      const boostP = px(LEVER_BOOST.x, lever01ToFrac(LEVER_BOOST, heat));
      yGas = damp(yGas || gasP.y, gasP.y, 0.25);
      yBoost = damp(yBoost || boostP.y, boostP.y, 0.25);
      leverGas.y = yGas;
      leverBoost.y = yBoost;

      // --- Лампы ---
      aYellow = damp(aYellow, boostActive ? 1 : 0, 0.2);
      lampYellow.alpha = aYellow;
      const overheating = heat >= OVERHEAT;
      const redTarget = overheating && Math.floor(timeSec * 7) % 2 === 0 ? 1 : 0;
      aRed = damp(aRed, redTarget, 0.5);
      lampRed.alpha = aRed;

      // --- Цифры ---
      readoutRpm.text = padDigits(rpmFrac * RPM_DISPLAY_MAX, 4);
      readoutSpd.text = padDigits(speed, 4);
      readoutAlt.text = padDigits(altFrac * ALT_DISPLAY_MAX, 5);
      counterKills.text = padDigits(s.playerScore, 4);
      counterAmmo.text = padDigits(AMMO_PLACEHOLDER, 4);

      // --- Радио-экран: служебный статус (микро-фликер фосфора) ---
      radioText.alpha = 0.93 + 0.07 * Math.random();
      const enemyAlive = s.enemies.filter(e => e.state !== 'crashed').length;
      const heatPct = Math.round(heat * 100);
      const status = overheating
        ? 'ENGINE OVERHEAT'
        : stalling ? 'STALLING WARNING!' : 'STABLE';
      radioText.text =
        `LVL ${s.level < 10 ? '0' + s.level : s.level}   T:${s.timeSec.toFixed(1)}s   BOGEYS:${enemyAlive}\n` +
        `SPD:${Math.round(speed)}   GAS:${Math.round(throttle * 100)}%   HEAT:${heatPct}%\n` +
        `BOOST:${boostActive ? 'ON' : 'OFF'}\nSYSTEM: ${status}`;
    },
    resize(w: number, h: number) { layout(w, h); },
  };

  // value 0..1 → доля высоты внутри прорези (0 газа = bottomY, 1 = topY).
  function lever01ToFrac(spec: LeverSpec, value: number): number {
    return lerp(spec.bottomY, spec.topY, clamp01(value));
  }
}
```

- [ ] **Step 2: Проверить типы**

Run:
```bash
pnpm --filter @biplanes/render typecheck
```
Expected: PASS без ошибок. Если `worldHeight`/`boostHeat`/`boostActive`/`throttleLevel` дадут ошибку типа — сверить имена полей с `packages/core/src/world/world-state.ts` и поправить (они используются так же в текущем `hud.ts`).

- [ ] **Step 3: Lint**

Run:
```bash
pnpm --filter @biplanes/render lint
```
Expected: PASS (0 warnings). Убрать неиспользуемые импорты, если линтер укажет.

- [ ] **Step 4: Commit**

```bash
git add packages/render/src/scene/cockpit-panel.ts
git commit -m "feat(hud): animated cockpit panel module (gauges/levers/lamps/counters)"
```

---

## Task 5: Подключить панель в `hud.ts`, убрать старую приборку

Удаляем построение и per-frame рисование старой приборки; делегируем в `createCockpitPanel`. Сохраняем служебные оверлеи (overlay/arrow/dirArrow/enemyArrowLayer/ramNotice) и их логику.

**Files:**
- Modify: `packages/render/src/scene/hud.ts`

- [ ] **Step 1: Добавить импорт панели**

В начало `hud.ts`, после строки `import { Container, Graphics, Text, TextStyle } from 'pixi.js';`, добавить:
```ts
import { createCockpitPanel } from './cockpit-panel.js';
```

- [ ] **Step 2: Заменить весь блок построения приборки на создание панели**

Удалить блок от комментария `// 1. Steel-Plated Dashboard Plate ...` до конца создания `text`/`crtScanlines` включительно (в текущем файле это строки 18–217: `dashboard`, `dashPanel`, `dashBezel`, оба круглых гейджа с лейблами, иглы, рычаги/прорези, лампы, nixie, stall, `speedText`, glass-оверлей, `crtScanlines`, и создание `text`). Сразу после `const c = new Container();` (строка 17) вставить:
```ts
  // Приборная панель собирается из арт-ассетов в отдельном модуле.
  const panel = createCockpitPanel(width, height);
  c.addChild(panel.container);
```
НЕ удалять то, что идёт ниже старого блока: overlay/overlayStyle, arrow, dirArrow, enemyArrowLayer, ramNotice и их добавление в `c`. (В текущем файле блок overlay начинается со строки 219 `// Center overlay`.) Также удалить строку `c.addChild(text, crtScanlines);` (старая строка 217) — `text` и `crtScanlines` больше не существуют.

- [ ] **Step 3: Почистить `layoutHud` от ссылок на удалённые объекты**

В функции `layoutHud` удалить строки, ссылающиеся на `dashboard`, `text`, `crtScanlines` (в текущем файле: `dashboard.scale.set(...)`, `text.style.fontSize = ...`, `text.x = ...`, `text.y = ...`, `crtScanlines.visible = ...`). Добавить вызов панели. Итоговая `layoutHud`:
```ts
  function layoutHud(w: number, h: number) {
    compactHud = w < 900 || h < 520;
    panel.resize(w, h);

    ramNotice.style.fontSize = compactHud ? 24 : 32;
    ramNotice.x = (w - ramNotice.width) / 2;
    ramNotice.y = h * 0.12;
    centerOverlay(w, h);
  }
```

- [ ] **Step 4: Заменить per-frame рисование приборки в `update` на вызов панели**

В методе `update(s)` удалить весь код рисования приборки и формирования `text` (в текущем файле: блоки `// 1. Render Oil Pressure...` через `// 5. Stall emergency warning light...`, т.е. строки ~399–531, и блок формирования `text.text`/`text.alpha` строки ~551–583). Сохранить: вычисление каравана/`showCaravanArrow` (строки ~534–549), блок overlay-логики (`// 7. Announcements / overlay logic`, строки ~585–632) и затухание RAM (строки ~634–642).

В начало `update(s)` (после `pulseT += 0.15;`) добавить делегирование и локальные переменные, которые ещё нужны overlay-логике:
```ts
      panel.update(s);

      const timeSec = s.timeSec;
      const throttle = s.player.kinematic.throttleLevel ?? 0;
      const g = s.player.kinematic.g;
      const stalling = g < G_STALL_LINE && s.player.state === 'flying';
```
(Эти `timeSec`/`throttle`/`g`/`stalling` уже вычислялись в старом коде; оставить ровно по одному объявлению каждой, удалив дубли из удалённых блоков. `groundY` оставить только если он ещё используется overlay-логикой; если нет — удалить.)

- [ ] **Step 5: Убедиться, что неиспользуемые константы/переменные удалены**

Удалить ставшие неиспользуемыми top-level константы, относившиеся только к приборке (`G_MAX_REF`, координаты `HP_CX`/`SPD_CX`/`THR_X` и т.п.), если они больше нигде не читаются. Оставить `G_STALL_LINE` (используется в overlay-логике stalling). Проверка — следующий шаг (typecheck/lint поймают unused).

- [ ] **Step 6: Typecheck + lint**

Run:
```bash
pnpm --filter @biplanes/render typecheck && pnpm --filter @biplanes/render lint
```
Expected: PASS, 0 ошибок, 0 warnings. Исправить все ссылки на удалённые объекты (`text`, `dashboard`, `spdNeedle`, `boostLamp`, и т.д.), если что-то осталось.

- [ ] **Step 7: Запустить тесты пакета**

Run:
```bash
pnpm --filter @biplanes/render test
```
Expected: PASS (gauge-math + render-clock).

- [ ] **Step 8: Commit**

```bash
git add packages/render/src/scene/hud.ts
git commit -m "feat(hud): use art-based cockpit panel, drop code-drawn dashboard"
```

---

## Task 6: Визуальная калибровка и проверка

Юнит-тесты не проверяют расположение спрайтов — это делается глазами. Запускаем игру, снимаем скриншот, подгоняем координаты в блоке констант `cockpit-panel.ts`.

**Files:**
- Modify: `packages/render/src/scene/cockpit-panel.ts` (только константы посадочных мест)

- [ ] **Step 1: Запустить dev-сервер**

Run (в фоне):
```bash
pnpm dev
```
Открыть указанный Vite URL (обычно `http://localhost:5173`). Начать забег, чтобы появился HUD.

- [ ] **Step 2: Снять скриншот игрового экрана с панелью**

Через preview/computer-use сделать скриншот окна игры с активной панелью (самолёт в полёте, газ дан).

- [ ] **Step 3: Сверить и подогнать**

Проверить по скриншоту и при необходимости поправить КОНСТАНТЫ в `cockpit-panel.ts`:
- Центры стрелок `GAUGE_RPM/SPD/ALT` стоят ровно в центрах циферблатов; `GAUGE_RADIUS_FRAC` и `NEEDLE_HUB_ANCHOR_Y` дают стрелку нужной длины с втулкой в центре.
- `GAUGE_START`/`GAUGE_SWEEP` — стрелка на нуле смотрит на «0» риски ассета, на максимуме — на максимум.
- Ручки `LEVER_GAS/BOOST` (x, topY, bottomY) ездят внутри прорезей MAX..MIN.
- Лампы `LAMP_YELLOW/RED` (x, y) накрывают гнёзда; при бусте жёлтая горит, при перегреве красная мигает.
- Табло `READOUT_*`, `COUNTER_*`, `RADIO_SCREEN` стоят в своих окошках и читаются.
- Если фон `upscaler_00053_.png` имеет вжжённую горящую жёлтую лампу и она конфликтует с оверлеем — заменить `panel.png` на `upscaler_00052_.png` (обе лампы погашены) в Task 1 и переснять.

Повторять Step 2–3, пока всё не встанет по местам. Менять ТОЛЬКО константы координат, не логику.

- [ ] **Step 4: Финальная проверка реактивности**

Убедиться на живой игре: при добавлении газа стрелка RPM и ручка ГАЗ растут; скорость двигает стрелку SPD; высота — стрелку ALT; буст зажигает жёлтую лампу; перегрев мигает красной; СБИТО растёт при убийстве. Снять подтверждающий скриншот.

- [ ] **Step 5: Финальные typecheck/lint/test**

Run:
```bash
pnpm --filter @biplanes/render typecheck && pnpm --filter @biplanes/render lint && pnpm --filter @biplanes/render test
```
Expected: всё PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/render/src/scene/cockpit-panel.ts
git commit -m "fix(hud): calibrate cockpit panel placement to art assets"
```

---

## Self-Review заметки

- **Покрытие спеки:** слои (Task 4 §layers), привязка значений (Task 4 update), анимации стрелок/рычагов/ламп/цифр (Task 4 update), координаты долями + калибровка (Task 6), удаление старой приборки + сохранение служебных оверлеев (Task 5), визуальная проверка (Task 6), заглушка патронов (`AMMO_PLACEHOLDER`), радио-экран со статусом (Task 4) — покрыто.
- **Заглушки:** `AMMO_PLACEHOLDER` и `ALT_REF_PX`/координаты — намеренные, помечены как калибруемые/временные, с реальными значениями в коде (не пустые TODO).
- **Согласованность имён:** `createCockpitPanel` → `{ container, update, resize }` используется одинаково в Task 4 и Task 5. `gauge-math` экспортирует `clamp01/normalize/lerp/gaugeAngle/damp/dampAngle/padDigits` — те же имена в тестах (Task 3) и в `cockpit-panel.ts` (Task 4).
- **Калибровка по полям состояния:** имена `player.kinematic.throttleLevel`, `player.boostHeat`, `player.boostActive`, `player.kinematic.g`, `player.kinematic.position.y`, `worldHeight`, `playerScore`, `level`, `timeSec`, `enemies[].state` взяты из текущего `hud.ts` — менять при несоответствии типов (Task 4 Step 2).
