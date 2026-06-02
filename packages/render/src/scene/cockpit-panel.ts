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
// привязка к рискам ассета — калибровка позже.
const GAUGE_START = Math.PI * 0.75; // нижний-левый
const GAUGE_SWEEP = Math.PI * 1.5;  // 270°

// --- Посадочные места (доли от PANEL_W / PANEL_H). КАЛИБРУЮТСЯ позже. ---
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

  // value 0..1 → доля высоты внутри прорези (0 газа = bottomY, 1 = topY).
  function lever01ToFrac(spec: LeverSpec, value: number): number {
    return lerp(spec.bottomY, spec.topY, clamp01(value));
  }

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
  let panelW = PANEL_W, panelH = PANEL_H;
  let panelLeft = 0, panelTop = 0;

  function px(fx: number, fy: number): { x: number; y: number } {
    return { x: panelLeft + fx * panelW, y: panelTop + fy * panelH };
  }

  function placeNeedle(n: Sprite, g: GaugeSpec) {
    const p = px(g.cx, g.cy);
    n.x = p.x; n.y = p.y;
    if (n.texture && n.texture.height) {
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

  function layout(w: number, h: number) {
    width = w; height = h;
    // Панель во всю ширину внизу, пропорции сохранены.
    panelW = w;
    panelH = w / PANEL_ASPECT;
    panelLeft = 0;
    panelTop = h - panelH;

    bg.x = w / 2;
    bg.y = h;
    if (bg.texture && bg.texture.width) {
      bg.scale.set(panelW / bg.texture.width);
    }

    placeNeedle(needleRpm, GAUGE_RPM);
    placeNeedle(needleSpd, GAUGE_SPD);
    placeNeedle(needleAlt, GAUGE_ALT);

    placeLeverX(leverGas, LEVER_GAS);
    placeLeverX(leverBoost, LEVER_BOOST);

    placeLamp(lampYellow, LAMP_YELLOW);
    placeLamp(lampRed, LAMP_RED);

    placeText(readoutRpm, READOUT_RPM, 0.02);
    placeText(readoutSpd, READOUT_SPD, 0.02);
    placeText(readoutAlt, READOUT_ALT, 0.02);
    placeText(counterKills, COUNTER_KILLS, 0.024);
    placeText(counterAmmo, COUNTER_AMMO, 0.024);
    const rp = px(RADIO_SCREEN.x, RADIO_SCREEN.y);
    radioText.x = rp.x; radioText.y = rp.y;
    radioText.style.fontSize = Math.max(9, RADIO_SCREEN.fontFrac * panelH);
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
}
