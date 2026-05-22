import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { WorldState } from '@biplanes/core';
import { findPilot } from '@biplanes/core';
import { PLAYER_HANGAR_X, LEVEL_UP_THRESHOLDS, GROUND_Y } from '@biplanes/shared';

const G_MAX_REF = 950;      // max speed for gauge scale
const G_STALL_LINE = 620;   // stall warning threshold

export function createHud(width: number, height: number) {
  const c = new Container();

  // 1. Steel-Plated Dashboard Plate (Glassmorphism + Copper Trim)
  const dashboard = new Container();
  c.addChild(dashboard);

  const dashPanel = new Graphics()
    .roundRect(15, 15, 290, 165, 14)
    .fill({ color: 0x0d121d, alpha: 0.82 })
    .stroke({ color: 0x8b5a2b, width: 2 }); // Copper border
  
  // Dashboard inner shadow/glow edge
  const dashBezel = new Graphics()
    .roundRect(17, 17, 286, 161, 12)
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

  // 3. Circular Speed (RPM / Wind Speed) Gauge
  const SPD_CX = 155;
  const SPD_CY = 75;

  const spdGauge = new Graphics();
  dashboard.addChild(spdGauge);

  // 4. Needles Nodes
  const hpNeedle = new Graphics();
  const spdNeedle = new Graphics();
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
    fontFamily: 'monospace',
    fontSize: 10,
    fill: 0xa0a5b5,
    fontWeight: 'bold',
  });
  const thrLabel = new Text({ text: 'THR', style: thrLabelStyle });
  thrLabel.x = THR_X - 4;
  thrLabel.y = THR_Y + THR_H + 4;
  dashboard.addChild(thrLabel);

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
    fontFamily: 'monospace',
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

  // 7. Phosphorescent CRT Monitor Terminal Readout (Below dashboard)
  const textStyle = new TextStyle({
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: 'bold',
    fill: 0x33ff33, // Retro phosphor green
  });
  const text = new Text({ text: '', style: textStyle });
  text.x = 20;
  text.y = 192;
  c.addChild(text);

  // Center overlay
  const overlayStyle = new TextStyle({
    fontFamily: 'monospace',
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

  c.addChild(overlay, arrow);

  let pulseT = 0;

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

  return {
    container: c,
    update(s: WorldState) {
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
      const hpText = new Text({
        text: 'OIL',
        style: new TextStyle({ fontFamily: 'monospace', fontSize: 8, fill: 0x8890a0, fontWeight: 'bold' }),
      });
      hpText.x = HP_CX - hpText.width / 2;
      hpText.y = HP_CY + 14;
      hpGauge.addChild(hpText);

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
      const spdText = new Text({
        text: 'RPM',
        style: new TextStyle({ fontFamily: 'monospace', fontSize: 8, fill: 0x8890a0, fontWeight: 'bold' }),
      });
      spdText.x = SPD_CX - spdText.width / 2;
      spdText.y = SPD_CY + 14;
      spdGauge.addChild(spdText);

      // 3. Render Needles with physical behavior (trembling on stall/low-HP)
      hpNeedle.clear();
      const hpAngle = SWEEP_START + hpPct * SWEEP_LEN;
      // Trembling oil pressure needle at low HP
      const hpTremble = isHpCritical ? (Math.random() - 0.5) * 0.08 : 0;
      const hpNeedleLength = GAUGE_R - 6;
      hpNeedle.moveTo(HP_CX, HP_CY)
              .lineTo(HP_CX + Math.cos(hpAngle + hpTremble) * hpNeedleLength, HP_CY + Math.sin(hpAngle + hpTremble) * hpNeedleLength)
              .stroke({ color: 0xe74c3c, width: 2.2 });
      hpNeedle.circle(HP_CX, HP_CY, 4.5).fill(0x8b5a2b); // Copper needle cap

      spdNeedle.clear();
      const spdAngle = SWEEP_START + speedPct * SWEEP_LEN;
      // Tremble needle aggressively when stalling!
      const spdTremble = stalling ? (Math.random() - 0.5) * 0.16 : 0;
      const spdNeedleLength = GAUGE_R - 6;
      spdNeedle.moveTo(SPD_CX, SPD_CY)
              .lineTo(SPD_CX + Math.cos(spdAngle + spdTremble) * spdNeedleLength, SPD_CY + Math.sin(spdAngle + spdTremble) * spdNeedleLength)
              .stroke({ color: 0x66d9ef, width: 2.2 });
      spdNeedle.circle(SPD_CX, SPD_CY, 4.5).fill(0x8b5a2b); // Copper needle cap

      // 4. Render Throttle Slider Lever Knob
      const throttle = s.player.kinematic.throttleLevel ?? 0.0;
      thrLever.clear();
      const knobY = THR_Y + THR_H * (1 - throttle);
      // Rectangular red mechanical knob with black center pin
      thrLever.roundRect(THR_X - 4, knobY - 5, THR_W + 8, 10, 3)
              .fill(0xc0392b)
              .stroke({ color: 0x000000, width: 1.2 })
              .rect(THR_X - 1, knobY - 1, THR_W + 2, 2)
              .fill(0xffffff);

      // 5. Update Nixie tube display
      const displayLvl = s.level < 10 ? `0${s.level}` : `${s.level}`;
      nixieText.text = `LVL ${displayLvl}`;
      
      const prevThreshold = s.level >= 2 ? LEVEL_UP_THRESHOLDS[s.level - 2] ?? 0 : 0;
      const nextThreshold = LEVEL_UP_THRESHOLDS[s.level - 1] ?? Math.max(s.xpCollected, 1);
      const xpPct = nextThreshold <= prevThreshold
        ? 1
        : Math.max(0, Math.min(1, (s.xpCollected - prevThreshold) / (nextThreshold - prevThreshold)));
      
      xpFill.clear().rect(NIXIE_X + 96, NIXIE_Y + 18, 102 * xpPct, 6).fill(s.pendingLevelUp ? 0xffffff : 0xff8c19);

      // 6. CRT readouts below Dashboard
      const enemyAlive = s.enemies.filter(e => e.state !== 'crashed').length;
      const h = s.player.kinematic.heading;
      const inverted = s.player.state === 'flying' && Math.abs(h) > Math.PI / 2 + 0.4 && Math.abs(h) < Math.PI - 0.4;
      
      text.text = `[${s.difficulty.toUpperCase()}]   YOU: ${s.playerScore}  |  ENEMY: ${s.enemyScore}/5\nTIME: ${timeSec.toFixed(1)}s   BOGEYS: ${enemyAlive}\nALTITUDE: ${Math.round(GROUND_Y - s.player.kinematic.position.y)} ft\nSYSTEM: ${stalling ? 'STALLING WARNING!' : inverted ? 'INVERTED FLIGHT' : 'STABLE'}`;

      // 7. Announcements / overlay logic
      const playerPilot = findPilot(s.pilots, 'player');
      if (playerPilot) {
        overlay.style.fontSize = 36;
        if (playerPilot.state === 'parachute') {
          overlay.text = 'EJECTED — STEER LEFT/RIGHT';
          arrow.visible = false;
        } else if (playerPilot.state === 'walking' || playerPilot.state === 'safe') {
          overlay.text = 'RUN TO HANGAR — SPACE TO JUMP';
          const dir: 1 | -1 = playerPilot.position.x > PLAYER_HANGAR_X ? -1 : 1;
          drawArrow(dir, width, height);
        } else if (playerPilot.state === 'dead') {
          const remaining = Math.max(0, 5.0 - s.pilotEjectTimeSec);
          overlay.text = `PILOT DOWN\nrespawn in ${remaining.toFixed(1)}`;
          arrow.visible = false;
        }
        overlay.visible = true;
        centerOverlay(width, height);
      } else if (s.player.state === 'crashed') {
        overlay.text = `CRASHED\nrespawn in ${Math.max(0, s.player.respawnTimer).toFixed(1)}`;
        overlay.style.fontSize = 42;
        overlay.visible = true;
        arrow.visible = false;
        centerOverlay(width, height);
      } else if (s.player.state === 'taxi') {
        overlay.text = 'PRESS W TO START ENGINE — A to pitch up';
        overlay.style.fontSize = 28;
        overlay.visible = true;
        arrow.visible = false;
        centerOverlay(width, height);
      } else {
        overlay.visible = false;
        arrow.visible = false;
        overlay.style.fontSize = 42;
      }
    },
    resize(w: number, h: number) { width = w; height = h; centerOverlay(w, h); },
  };
}
