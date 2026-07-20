import { Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';
import type { WorldState } from '@biplanes/core';
import { findPilot } from '@biplanes/core';
import { assetUrl } from '../asset-url.js';
import { formatHudReadout, type HudStatus } from './hud-readout.js';
import { getHudChromeLayout } from './hud-layout.js';
import {
  GROUND_Y,
  LEVEL_UP_THRESHOLDS,
  PLAYER_HANGAR_X,
  WORLD_WIDTH,
  MAG_SIZE,
} from '@biplanes/shared';

const G_MAX_REF = 950;      // max speed for gauge scale
const G_STALL_LINE = 620;   // stall warning threshold

export function createHud(width: number, height: number) {
  const c = new Container();

  // 1. Steel-Plated Dashboard Plate (Glassmorphism + Copper Trim)
  const dashboard = new Container();
  c.addChild(dashboard);

  const dashPanel = new Graphics()
    .roundRect(15, 15, 335, 165, 14)
    .fill({ color: 0x0d121d, alpha: 0.82 })
    .stroke({ color: 0x8b5a2b, width: 2 }); // Copper border
  
  // Dashboard inner shadow/glow edge
  const dashBezel = new Graphics()
    .roundRect(17, 17, 331, 161, 12)
    .stroke({ color: 0x3d4a66, width: 1.5, alpha: 0.5 });
  
  dashboard.addChild(dashPanel, dashBezel);

  // 2. Circular HP (Engine Oil Pressure) Gauge
  const HP_CX = 65;
  const HP_CY = 75;
  const GAUGE_R = 36;
  const SWEEP_START = Math.PI * 0.75; // 135 degrees
  const SWEEP_LEN = Math.PI * 1.5;   // 270 degrees sweep

  const hpGauge = new Graphics();
  dashboard.addChild(hpGauge);
  const hpGaugeLabel = new Text({
    text: 'OIL',
    style: new TextStyle({ fontFamily: 'BiplanesMono, monospace', fontSize: 8, fill: 0x8890a0, fontWeight: 'bold' }),
  });
  hpGaugeLabel.x = HP_CX - hpGaugeLabel.width / 2;
  hpGaugeLabel.y = HP_CY + 14;
  dashboard.addChild(hpGaugeLabel);

  // 3. Circular Speed (RPM / Wind Speed) Gauge
  const SPD_CX = 155;
  const SPD_CY = 75;

  const spdGauge = new Graphics();
  dashboard.addChild(spdGauge);
  const spdGaugeLabel = new Text({
    text: 'RPM',
    style: new TextStyle({ fontFamily: 'BiplanesMono, monospace', fontSize: 8, fill: 0x8890a0, fontWeight: 'bold' }),
  });
  spdGaugeLabel.x = SPD_CX - spdGaugeLabel.width / 2;
  spdGaugeLabel.y = SPD_CY + 14;
  dashboard.addChild(spdGaugeLabel);

  // 4. Needle sprites (brass needle art) — pivot disc sits at the gauge centre.
  const NEEDLE_URL = assetUrl('assets/biplanes/hud/needle.png');
  const NEEDLE_PIVOT_Y = 0.86; // pivot disc is ~86% down the art
  const NEEDLE_SCALE = (GAUGE_R - 3) / (708 * NEEDLE_PIVOT_Y);
  const hpNeedle = Sprite.from(NEEDLE_URL);
  const spdNeedle = Sprite.from(NEEDLE_URL);
  for (const nd of [hpNeedle, spdNeedle]) {
    nd.anchor.set(0.5, NEEDLE_PIVOT_Y);
    nd.scale.set(NEEDLE_SCALE);
  }
  dashboard.addChild(hpNeedle, spdNeedle);

  // 5. Vertical Mechanical Throttle Slot & Slider Lever
  const THR_X = 248;
  const THR_Y = 28;
  const THR_W = 12;
  const THR_H = 92;

  const thrSlot = new Graphics()
    .roundRect(THR_X, THR_Y, THR_W, THR_H, 6)
    .fill(0x05080f)
    .stroke({ color: 0x5a5f69, width: 1.5 });
  
  // Tick lines next to the throttle slot
  const thrTicks = new Graphics();
  for (let k = 0; k <= 4; k++) {
    const ty = THR_Y + (THR_H * k) / 4;
    thrTicks.moveTo(THR_X - 5, ty).lineTo(THR_X - 1, ty).stroke({ color: 0x5a5f69, width: 1.2 });
  }
  
  const thrLever = new Graphics(); // Red slider lever knob
  dashboard.addChild(thrSlot, thrTicks, thrLever);

  const thrLabelStyle = new TextStyle({
    fontFamily: 'BiplanesMono, monospace',
    fontSize: 10,
    fill: 0xa0a5b5,
    fontWeight: 'bold',
  });
  const thrLabel = new Text({ text: 'THR', style: thrLabelStyle });
  thrLabel.x = THR_X - 4;
  thrLabel.y = THR_Y + THR_H + 4;
  dashboard.addChild(thrLabel);

  const BST_X = 292;
  const BST_Y = THR_Y;
  const BST_W = 12;
  const BST_H = THR_H;
  const bstSlot = new Graphics()
    .roundRect(BST_X, BST_Y, BST_W, BST_H, 6)
    .fill(0x05080f)
    .stroke({ color: 0x5a5f69, width: 1.5 });
  const bstTicks = new Graphics();
  for (let k = 0; k <= 4; k++) {
    const ty = BST_Y + (BST_H * k) / 4;
    bstTicks.moveTo(BST_X + BST_W + 1, ty).lineTo(BST_X + BST_W + 5, ty).stroke({ color: 0x5a5f69, width: 1.2 });
  }
  const bstLever = new Graphics();
  const bstLabel = new Text({ text: 'BST', style: thrLabelStyle });
  bstLabel.x = BST_X - 4;
  bstLabel.y = BST_Y + BST_H + 4;
  dashboard.addChild(bstSlot, bstTicks, bstLever, bstLabel);

  // 6. Nixie Tube Level and XP Progress Slot at the bottom
  const NIXIE_X = 28;
  const NIXIE_Y = 128;
  const NIXIE_W = 210;
  const NIXIE_H = 40;

  const nixieSlot = new Graphics()
    .roundRect(NIXIE_X, NIXIE_Y, NIXIE_W, NIXIE_H, 8)
    .fill(0x1a0d05) // Dark copper-brown glow slot
    .stroke({ color: 0x8b5a2b, width: 1.8 });
  
  const nixieBezel = new Graphics()
    .roundRect(NIXIE_X + 1, NIXIE_Y + 1, NIXIE_W - 2, NIXIE_H - 2, 7)
    .stroke({ color: 0xff7700, width: 1, alpha: 0.25 }); // Orange internal shadow glow
  
  dashboard.addChild(nixieSlot, nixieBezel);

  // Nixie digits text
  const nixieStyle = new TextStyle({
    fontFamily: 'BiplanesMono, monospace',
    fontSize: 20,
    fontWeight: 'bold',
    fill: 0xff8c19, // Glowing Amber/Neon Orange
    stroke: { color: 0x3d1000, width: 2 },
  });
  const nixieText = new Text({ text: 'LVL 01', style: nixieStyle });
  nixieText.x = NIXIE_X + 12;
  nixieText.y = NIXIE_Y + 7;
  
  // Nixie XP Progress Bar inside the Nixie Tube
  const xpBg = new Graphics().rect(NIXIE_X + 96, NIXIE_Y + 18, 102, 6).fill(0x2d1a0f);
  const xpFill = new Graphics().rect(NIXIE_X + 96, NIXIE_Y + 18, 0, 6).fill(0xffa500);
  const xpBorder = new Graphics().rect(NIXIE_X + 95, NIXIE_Y + 17, 104, 8).stroke({ color: 0x8b5a2b, width: 1 });
  dashboard.addChild(nixieText, xpBg, xpFill, xpBorder);

  // 12. Mechanical Warning Lamp "STALL / ENGINE" (Phase 5.3)
  const stallHousing = new Graphics()
    .circle(110, 42, 7.5).fill(0x424652).stroke({ color: 0x000000, width: 1.2 }) // bezel
    .circle(110, 42, 5).fill(0x220202); // dark red unlit bulb
  dashboard.addChild(stallHousing);

  const stallGlow = new Graphics();
  dashboard.addChild(stallGlow);

  const overheatHousing = new Graphics()
    .circle(286, 42, 7.5).fill(0x424652).stroke({ color: 0x000000, width: 1.2 })
    .circle(286, 42, 5).fill(0x220202);
  const overheatGlow = new Graphics();
  dashboard.addChild(overheatHousing, overheatGlow);

  // 13. Glass Dome Reflection Overlay on the Dashboard (Phase 5.1)
  const glassG = new Graphics()
    .roundRect(15, 15, 335, 165, 14)
    .fill({ color: 0xffffff, alpha: 0.05 }) // subtle glass tint
    // diagonal glare stripes
    .moveTo(15, 15)
    .lineTo(130, 15)
    .lineTo(15, 130)
    .closePath()
    .moveTo(85, 15)
    .lineTo(240, 15)
    .lineTo(15, 240)
    .closePath()
    .fill({ color: 0xffffff, alpha: 0.04 })
    // shiny white highlight outline
    .roundRect(16, 16, 333, 163, 13)
    .stroke({ color: 0xffffff, width: 1, alpha: 0.14 });
  glassG.blendMode = 'add';
  dashboard.addChild(glassG);

  // 14. Horizonal CRT Scanline grid (Phase 5.2)
  const crtBack = new Graphics()
    .roundRect(15, 186, 335, 82, 8)
    .fill({ color: 0x07101a, alpha: 0.58 })
    .stroke({ color: 0x8b5a2b, width: 1.2, alpha: 0.5 });
  const crtScanlines = new Graphics();
  for (let y = 190; y < 264; y += 4) {
    crtScanlines.moveTo(18, y).lineTo(346, y).stroke({ color: 0x000000, width: 1, alpha: 0.2 });
  }

  // 7. Phosphorescent CRT Monitor Terminal Readout (Below dashboard)
  const textStyle = new TextStyle({
    fontFamily: 'BiplanesMono, monospace',
    fontSize: 12,
    fontWeight: 'bold',
    fill: 0xc8ffb0,
    stroke: { color: 0x001108, width: 2 },
  });
  const text = new Text({ text: '', style: textStyle });
  text.x = 20;
  text.y = 192;
  c.addChild(crtBack, text, crtScanlines);

  // Center overlay
  const overlayStyle = new TextStyle({
    fontFamily: 'BiplanesMono, monospace',
    fontSize: 42,
    fill: 0xffffff,
    fontWeight: 'bold',
    stroke: { color: 0x000000, width: 4 },
    align: 'center',
  });
  const overlay = new Text({ text: '', style: overlayStyle });
  overlay.visible = false;

  const arrow = new Graphics();
  arrow.visible = false;

  // Edge arrow that points to an off-screen dying enemy.
  const dirArrow = new Graphics();
  dirArrow.visible = false;
  const enemyArrowLayer = new Container();

  c.addChild(overlay, arrow, dirArrow, enemyArrowLayer);

  // "RAM!" notification — upper-center on player ram-kill survival (Phase 5).
  const ramStyle = new TextStyle({
    fontFamily: 'BiplanesMono, monospace',
    fontSize: 32,
    fill: 0xffc24a,
    fontWeight: 'bold',
    stroke: { color: 0x000000, width: 4 },
  });
  const ramNotice = new Text({ text: 'RAM!', style: ramStyle });
  ramNotice.visible = false;
  ramNotice.x = (width - ramNotice.width) / 2;
  ramNotice.y = height * 0.12;
  c.addChild(ramNotice);

  let ramLife = 0;
  let compactHud = false;

  function layoutHud(w: number, h: number) {
    const chromeLayout = getHudChromeLayout(w, h);
    compactHud = chromeLayout.compact;

    dashboard.scale.set(chromeLayout.dashboardScale);
    text.style.fontSize = chromeLayout.readoutFontSize;
    text.x = chromeLayout.readoutX + 5;
    text.y = chromeLayout.readoutY + 6;
    crtBack.clear()
      .roundRect(chromeLayout.readoutX, chromeLayout.readoutY, chromeLayout.readoutWidth, chromeLayout.readoutHeight, 8)
      .fill({ color: 0x07101a, alpha: 0.58 })
      .stroke({ color: 0x8b5a2b, width: 1.2, alpha: 0.5 });
    crtBack.visible = chromeLayout.readoutVisible;
    text.visible = chromeLayout.readoutVisible;
    crtScanlines.visible = chromeLayout.readoutVisible;

    ramNotice.style.fontSize = compactHud ? 24 : 32;
    ramNotice.x = (w - ramNotice.width) / 2;
    ramNotice.y = h * 0.12;
    centerOverlay(w, h);
  }

  function showRamNotice() {
    ramLife = 1.2;
    ramNotice.visible = true;
    ramNotice.alpha = 1;
    ramNotice.x = (width - ramNotice.width) / 2;
    ramNotice.y = height * 0.12;
  }

  let pulseT = 0;

  function showDirArrow(targetScreenX: number, targetScreenY: number) {
    const cx = width / 2;
    const cy = height / 2;
    const dx = targetScreenX - cx;
    const dy = targetScreenY - cy;
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
      dirArrow.visible = false;
      return;
    }
    // Find the edge intersection from screen center toward the target.
    const sx = Math.abs(dx) / Math.max(1, width / 2 - 40);
    const sy = Math.abs(dy) / Math.max(1, height / 2 - 40);
    const sc = Math.max(sx, sy, 1);
    const ex = cx + dx / sc;
    const ey = cy + dy / sc;
    const ang = Math.atan2(dy, dx);
    dirArrow.clear()
      .moveTo(0, 0)
      .lineTo(-14, -7)
      .lineTo(-10, 0)
      .lineTo(-14, 7)
      .closePath()
      .fill({ color: 0xffaa44, alpha: 0.9 })
      .stroke({ color: 0x000000, width: 2 });
    dirArrow.x = ex;
    dirArrow.y = ey;
    dirArrow.rotation = ang;
    dirArrow.visible = true;
  }

  function hideDirArrow() {
    dirArrow.visible = false;
  }

  function drawEdgeArrow(g: Graphics, targetScreenX: number, targetScreenY: number, color: number) {
    const cx = width / 2;
    const cy = height / 2;
    const dx = targetScreenX - cx;
    const dy = targetScreenY - cy;
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
      g.visible = false;
      return;
    }
    const sx = Math.abs(dx) / Math.max(1, width / 2 - 42);
    const sy = Math.abs(dy) / Math.max(1, height / 2 - 42);
    const sc = Math.max(sx, sy, 1);
    const ex = cx + dx / sc;
    const ey = cy + dy / sc;
    const ang = Math.atan2(dy, dx);
    g.clear()
      .moveTo(0, 0)
      .lineTo(-18, -9)
      .lineTo(-13, 0)
      .lineTo(-18, 9)
      .closePath()
      .fill({ color, alpha: 0.95 })
      .stroke({ color: 0x000000, width: 2 });
    g.x = ex;
    g.y = ey;
    g.rotation = ang;
    g.visible = true;
  }

  function showEnemyArrows(targets: { x: number; y: number }[]) {
    const maxArrows = Math.min(5, targets.length);
    while (enemyArrowLayer.children.length < maxArrows) {
      const g = new Graphics();
      g.visible = false;
      enemyArrowLayer.addChild(g);
    }
    for (let i = 0; i < enemyArrowLayer.children.length; i++) {
      const g = enemyArrowLayer.children[i] as Graphics;
      if (i < maxArrows) {
        const spread = (i - (maxArrows - 1) / 2) * 24;
        drawEdgeArrow(g, targets[i]!.x, targets[i]!.y + spread, 0xff3030);
      } else {
        g.visible = false;
      }
    }
  }

  function hideEnemyArrows() {
    for (const child of enemyArrowLayer.children) {
      child.visible = false;
    }
  }

  function centerOverlay(w: number, h: number) {
    overlay.x = (w - overlay.width) / 2;
    overlay.y = h * 0.4;
  }

  function drawArrow(direction: 1 | -1, w: number, h: number) {
    arrow.clear();
    const cx = w / 2;
    const cy = h * 0.55;
    const size = 50;
    const dir = direction;
    arrow
      .moveTo(cx - size * dir, cy - 14)
      .lineTo(cx + size * dir, cy)
      .lineTo(cx - size * dir, cy + 14)
      .closePath()
      .fill({ color: 0xfff44a, alpha: 0.95 })
      .stroke({ color: 0x000000, width: 3 });
    arrow.visible = true;
  }

  layoutHud(width, height);

  // In the arena the player installs one module per round, so the cockpit counter
  // tracks the ROUND (set by the host) instead of the XP level — that's what the
  // player intuitively expects ("why is it LVL 5 on round 7?").
  let arenaRoundDisplay: number | null = null;

  return {
    container: c,
    setArenaRound(round: number | null) { arenaRoundDisplay = round; },
    update(s: WorldState, opts?: { suppressTaxiPrompt?: boolean }) {
      pulseT += 0.15;
      const timeSec = s.timeSec;

      // 1. Render Oil Pressure HP Gauge Backing & Ticks
      const hpPct = Math.max(0, s.player.hp / s.player.maxHp);
      const isHpCritical = hpPct <= 0.25;
      // Red flash on critical HP
      const hpBacking = isHpCritical && Math.floor(timeSec * 5) % 2 === 0 ? 0x4a0505 : 0x070b12;
      
      hpGauge.clear();
      // Outer rim and backplate
      hpGauge.circle(HP_CX, HP_CY, GAUGE_R)
             .fill(hpBacking)
             .stroke({ color: 0x5a5f69, width: 2.2 });
      
      // Draw HP tick markings
      const hpTickCount = 9;
      for (let i = 0; i < hpTickCount; i++) {
        const angle = SWEEP_START + (i / (hpTickCount - 1)) * SWEEP_LEN;
        const tickLength = i % 2 === 0 ? 6 : 4;
        const startR = GAUGE_R - 2;
        const endR = GAUGE_R - 2 - tickLength;
        const isRedZone = i >= hpTickCount - 3;
        const color = isRedZone ? 0xe74c3c : 0xa0a5b5;
        
        hpGauge.moveTo(HP_CX + Math.cos(angle) * startR, HP_CY + Math.sin(angle) * startR)
               .lineTo(HP_CX + Math.cos(angle) * endR, HP_CY + Math.sin(angle) * endR)
               .stroke({ color, width: 1.5 });
      }
      
      // HP Label
      hpGauge.circle(HP_CX, HP_CY + 18, 5).fill(0x05070a);

      // 2. Render RPM Speed Gauge Backing & Ticks
      const g = s.player.kinematic.g;
      const speedPct = Math.max(0, Math.min(1, g / G_MAX_REF));
      const stalling = g < G_STALL_LINE && s.player.state === 'flying';
      const spdBacking = stalling && Math.floor(timeSec * 5) % 2 === 0 ? 0x4a2a05 : 0x070b12;

      spdGauge.clear();
      spdGauge.circle(SPD_CX, SPD_CY, GAUGE_R)
              .fill(spdBacking)
              .stroke({ color: 0x5a5f69, width: 2.2 });
      
      // Draw Speed tick markings
      const spdTickCount = 11;
      for (let i = 0; i < spdTickCount; i++) {
        const angle = SWEEP_START + (i / (spdTickCount - 1)) * SWEEP_LEN;
        const tickLength = i % 2 === 0 ? 6 : 4;
        const startR = GAUGE_R - 2;
        const endR = GAUGE_R - 2 - tickLength;
        const isStallZone = i < 3;
        const color = isStallZone ? 0xe74c3c : 0xa0a5b5;
        
        spdGauge.moveTo(SPD_CX + Math.cos(angle) * startR, SPD_CY + Math.sin(angle) * startR)
               .lineTo(SPD_CX + Math.cos(angle) * endR, SPD_CY + Math.sin(angle) * endR)
               .stroke({ color, width: 1.5 });
      }
      
      // Speed Label
      spdGauge.circle(SPD_CX, SPD_CY + 18, 5).fill(0x05070a);

      // 3. Point the needle sprites at the gauge values (the art points "up", so
      // rotation = value angle + 90°). Trembling on stall / low-HP stays.
      const hpAngle = SWEEP_START + hpPct * SWEEP_LEN;
      const hpTremble = isHpCritical ? (Math.random() - 0.5) * 0.08 : 0;
      hpNeedle.x = HP_CX; hpNeedle.y = HP_CY;
      hpNeedle.rotation = hpAngle + hpTremble + Math.PI / 2;

      const spdAngle = SWEEP_START + speedPct * SWEEP_LEN;
      const spdTremble = stalling ? (Math.random() - 0.5) * 0.16 : 0;
      spdNeedle.x = SPD_CX; spdNeedle.y = SPD_CY;
      spdNeedle.rotation = spdAngle + spdTremble + Math.PI / 2;

      // 4. Render Throttle Slider Lever Knob
      const throttle = s.player.kinematic.throttleLevel ?? 0.0;
      const boostActive = s.player.boostActive === true;
      const boostHeat = Math.max(0, Math.min(1, s.player.boostHeat ?? 0));
      thrLever.clear();
      const knobY = THR_Y + THR_H * (1 - throttle);
      // Rectangular red mechanical knob with black center pin
      thrLever.roundRect(THR_X - 4, knobY - 5, THR_W + 8, 10, 3)
              .fill(0xc0392b)
              .stroke({ color: 0x000000, width: 1.2 })
              .rect(THR_X - 1, knobY - 1, THR_W + 2, 2)
              .fill(0xffffff);

      bstLever.clear();
      const boostY = BST_Y + BST_H * (1 - boostHeat);
      const boostColor = boostHeat >= 0.85 ? 0xe74c3c : boostActive ? 0xffc24a : 0x697080;
      bstLever.roundRect(BST_X - 4, boostY - 5, BST_W + 8, 10, 3)
              .fill(boostColor)
              .stroke({ color: 0x000000, width: 1.2 })
              .rect(BST_X - 1, boostY - 1, BST_W + 2, 2)
              .fill(0xffffff);

      // 5. Update Nixie tube display — show the arena round when the host set it,
      // otherwise the XP level (story / labs).
      const shownLvl = arenaRoundDisplay ?? s.level;
      const displayLvl = shownLvl < 10 ? `0${shownLvl}` : `${shownLvl}`;
      nixieText.text = `LVL ${displayLvl}`;
      
      const prevThreshold = s.level >= 2 ? LEVEL_UP_THRESHOLDS[s.level - 2] ?? 0 : 0;
      const nextThreshold = LEVEL_UP_THRESHOLDS[s.level - 1] ?? Math.max(s.xpCollected, 1);
      const xpPct = nextThreshold <= prevThreshold
        ? 1
        : Math.max(0, Math.min(1, (s.xpCollected - prevThreshold) / (nextThreshold - prevThreshold)));
      
      xpFill.clear().rect(NIXIE_X + 96, NIXIE_Y + 18, 102 * xpPct, 6).fill(s.pendingLevelUp ? 0xffffff : 0xff8c19);

      // 5. Stall emergency warning light (Phase 5.3)
      stallGlow.clear();
      if (stalling) {
        const flashState = Math.floor(timeSec * 7) % 2 === 0;
        if (flashState) {
          stallGlow.circle(110, 42, 5.2).fill(0xff0033);
          stallGlow.circle(110, 42, 16).fill({ color: 0xff0033, alpha: 0.32 }); // glows additively
        }
      }

      overheatGlow.clear();
      const overheating = boostHeat >= 0.85;
      if (overheating && Math.floor(timeSec * 7) % 2 === 0) {
        overheatGlow.circle(286, 42, 5.2).fill(0xff0033);
        overheatGlow.circle(286, 42, 17).fill({ color: 0xff0033, alpha: 0.38 });
      }

      // Caravan off-screen tracking logic
      let showCaravanArrow = false;
      let caravanArrowDir: 1 | -1 = 1;
      let caravanDist = 0;
      if (s.caravan && s.caravan.active && s.player.state === 'flying' && s.player.alive) {
        const dx = s.caravan.position.x - s.player.kinematic.position.x;
        caravanDist = Math.abs(dx);
        if (caravanDist > 900) {
          showCaravanArrow = true;
          caravanArrowDir = dx > 0 ? 1 : -1;
        }
      }

      if (showCaravanArrow) {
        drawArrow(caravanArrowDir, width, height);
      }

      // 6. CRT readouts below Dashboard (with scanlines & phosphor micro-flicker - Phase 5.2)
      text.alpha = 0.93 + 0.07 * Math.random();
      const enemyAlive = s.enemies.filter(e => e.state !== 'crashed').length;
      const h = s.player.kinematic.heading;
      const inverted = s.player.state === 'flying' && Math.abs(h) > Math.PI / 2 + 0.4 && Math.abs(h) < Math.PI - 0.4;
      const salvoReady = (s.player.specialCooldown ?? 0) <= 0.001;
      const ammo = s.player.ammo ?? MAG_SIZE;
      const reloadLeft = s.player.reloadTimer ?? 0;
      const mgTag = reloadLeft > 0 ? `ПЕРЕЗАРЯДКА ${Math.ceil(reloadLeft)}С` : `ПАТРОНЫ ${ammo}`;
      const weaponTags = [
        mgTag,
        s.hasHeavyCannon ? 'CANNON' : null,
        `SALVO ${salvoReady ? 'READY' : 'RLD'}`,
        s.hasHomingRockets ? 'ROCKETS' : null,
        s.hasDrone ? 'WINGMAN' : null,
      ].filter(Boolean).join('  |  ');
      
      const worldGroundY = (s.worldHeight ?? GROUND_Y + 90) - 90;
      const altitudeFt = Math.round(worldGroundY - s.player.kinematic.position.y);
      const heatPct = Math.round(boostHeat * 100);
      const hudStatus: HudStatus = overheating
        ? 'overheat'
        : stalling
          ? 'stall'
          : s.caravan && s.caravan.active && s.caravan.hp < s.caravan.maxHp * 0.3
            ? 'caravan-critical'
            : inverted
              ? 'inverted'
              : 'stable';

      if (s.caravan && s.caravan.active) {
        const caravanHpPct = Math.round(s.caravan.hp / s.caravan.maxHp * 100);
        // Calculate progress dynamically based on scroll world boundaries if world is wide
        const isWide = s.worldWidth && s.worldWidth > 2000;
        const progressPct = isWide
          ? Math.round((s.caravan.position.x - 1200) / 9000 * 100)
          : Math.round((s.caravan.position.x - WORLD_WIDTH * 0.16) / (WORLD_WIDTH * 0.6) * 100);
        
        text.text = formatHudReadout({
          mode: 'escort',
          level: s.level,
          timeSec,
          enemyAlive,
          playerScore: s.playerScore,
          enemyScore: s.enemyScore,
          caravanHpPct,
          progressPct: Math.min(100, Math.max(0, progressPct)),
          altitudeFt,
          weaponTags: weaponTags ? weaponTags.split('  |  ') : [],
          boostActive,
          boostHeatPct: heatPct,
          status: hudStatus,
        });
      } else {
        text.text = formatHudReadout({
          mode: 'arena',
          level: s.level,
          timeSec,
          enemyAlive,
          playerScore: s.playerScore,
          enemyScore: s.enemyScore,
          altitudeFt,
          weaponTags: weaponTags ? weaponTags.split('  |  ') : [],
          boostActive,
          boostHeatPct: heatPct,
          status: hudStatus,
        });
      }

      // 7. Announcements / overlay logic
      const playerPilot = findPilot(s.pilots, 'player');
      overlay.alpha = 1;
      if (playerPilot) {
        overlay.style.fontSize = 36;
        if (playerPilot.state === 'parachute') {
          overlay.text = 'КАТАПУЛЬТА — РУЛИ ВЛЕВО/ВПРАВО';
          if (!showCaravanArrow) arrow.visible = false;
        } else if (playerPilot.state === 'walking' || playerPilot.state === 'safe') {
          overlay.text = 'БЕГИ К АНГАРУ — ПРЫЖОК НА SPACE';
          const dir: 1 | -1 = playerPilot.position.x > PLAYER_HANGAR_X ? -1 : 1;
          drawArrow(dir, width, height);
        } else if (playerPilot.state === 'dead') {
          const remaining = Math.max(0, 5.0 - s.pilotEjectTimeSec);
          overlay.text = `ПИЛОТ ВЫБЫЛ\nвозврат через ${remaining.toFixed(1)}`;
          if (!showCaravanArrow) arrow.visible = false;
        }
        overlay.visible = true;
        centerOverlay(width, height);
      } else if (s.player.state === 'crashed') {
        overlay.text = `СБИТ\nвозврат через ${Math.max(0, s.player.respawnTimer).toFixed(1)}`;
        overlay.style.fontSize = 42;
        overlay.visible = true;
        if (!showCaravanArrow) arrow.visible = false;
        centerOverlay(width, height);
      } else if (s.player.state === 'taxi') {
        if (opts?.suppressTaxiPrompt) {
          // The onboarding hint line is already telling the player to throttle up —
          // a second «ДАЙ ГАЗ» on top of it read as UI clutter on phones.
          overlay.visible = false;
          if (!showCaravanArrow) arrow.visible = false;
        } else {
          overlay.text = compactHud
            ? (throttle < 0.15 ? 'ДАЙ ГАЗ' : 'ТЯНИ ВВЕРХ')
            : (throttle < 0.15 ? 'МОТОР НА ХОЛОСТОМ\nПОДНИМИ РЫЧАГ ГАЗА' : 'РАЗБЕГ\nТЯНИ НОС ВВЕРХ');
          overlay.style.fontSize = compactHud ? 18 : 24;
          overlay.visible = true;
          if (!showCaravanArrow) arrow.visible = false;
          centerOverlay(width, height);
          overlay.y = height * (compactHud ? 0.44 : 0.68);
        }
      } else if (stalling) {
        overlay.text = 'СВАЛИВАНИЕ\nПИКИРУЙ ДЛЯ ВЫХОДА';
        overlay.style.fontSize = 24;
        overlay.alpha = 0.65 + 0.35 * Math.abs(Math.sin(pulseT));
        overlay.visible = true;
        if (!showCaravanArrow) arrow.visible = false;
        centerOverlay(width, height);
        overlay.y = height * 0.18;
      } else {
        overlay.visible = false;
        if (!showCaravanArrow) arrow.visible = false;
        overlay.style.fontSize = 42;
        overlay.alpha = 1;
      }

      // RAM! notice fade — HUD update has no dt, approximate at 60Hz.
      if (ramLife > 0) {
        ramLife -= 1 / 60;
        if (ramLife <= 0) {
          ramNotice.visible = false;
        } else {
          ramNotice.alpha = Math.min(1, ramLife * 1.5);
        }
      }
    },
    resize(w: number, h: number) { width = w; height = h; layoutHud(w, h); },
    showDirArrow,
    hideDirArrow,
    showEnemyArrows,
    hideEnemyArrows,
    showRamNotice,
  };
}
