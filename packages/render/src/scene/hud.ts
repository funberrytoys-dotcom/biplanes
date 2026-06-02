import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { WorldState } from '@biplanes/core';
import { findPilot } from '@biplanes/core';
import {
  PLAYER_HANGAR_X,
} from '@biplanes/shared';
import { createCockpitPanel } from './cockpit-panel.js';

const G_STALL_LINE = 620;   // stall warning threshold

export function createHud(width: number, height: number) {
  const c = new Container();

  // Приборная панель собирается из арт-ассетов в отдельном модуле.
  const panel = createCockpitPanel(width, height);
  c.addChild(panel.container);

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

  // Edge arrow that points to an off-screen dying enemy.
  const dirArrow = new Graphics();
  dirArrow.visible = false;
  const enemyArrowLayer = new Container();

  c.addChild(overlay, arrow, dirArrow, enemyArrowLayer);

  // "RAM!" notification — upper-center on player ram-kill survival (Phase 5).
  const ramStyle = new TextStyle({
    fontFamily: 'monospace',
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
    compactHud = w < 900 || h < 520;
    panel.resize(w, h);

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
        drawEdgeArrow(g, targets[i]!.x, targets[i]!.y, 0xff3030);
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

  return {
    container: c,
    update(s: WorldState) {
      pulseT += 0.15;
      panel.update(s);

      const g = s.player.kinematic.g;
      const stalling = g < G_STALL_LINE && s.player.state === 'flying';
      const throttle = s.player.kinematic.throttleLevel ?? 0;

      // Caravan off-screen tracking logic
      let showCaravanArrow = false;
      let caravanArrowDir: 1 | -1 = 1;
      if (s.caravan && s.caravan.active && s.player.state === 'flying' && s.player.alive) {
        const dx = s.caravan.position.x - s.player.kinematic.position.x;
        if (Math.abs(dx) > 900) {
          showCaravanArrow = true;
          caravanArrowDir = dx > 0 ? 1 : -1;
        }
      }

      if (showCaravanArrow) {
        drawArrow(caravanArrowDir, width, height);
      }

      // 7. Announcements / overlay logic
      const playerPilot = findPilot(s.pilots, 'player');
      overlay.alpha = 1;
      if (playerPilot) {
        overlay.style.fontSize = 36;
        if (playerPilot.state === 'parachute') {
          overlay.text = 'EJECTED - STEER LEFT/RIGHT';
          if (!showCaravanArrow) arrow.visible = false;
        } else if (playerPilot.state === 'walking' || playerPilot.state === 'safe') {
          overlay.text = 'RUN TO HANGAR - SPACE TO JUMP';
          const dir: 1 | -1 = playerPilot.position.x > PLAYER_HANGAR_X ? -1 : 1;
          drawArrow(dir, width, height);
        } else if (playerPilot.state === 'dead') {
          const remaining = Math.max(0, 5.0 - s.pilotEjectTimeSec);
          overlay.text = `PILOT DOWN\nrespawn in ${remaining.toFixed(1)}`;
          if (!showCaravanArrow) arrow.visible = false;
        }
        overlay.visible = true;
        centerOverlay(width, height);
      } else if (s.player.state === 'crashed') {
        overlay.text = `CRASHED\nrespawn in ${Math.max(0, s.player.respawnTimer).toFixed(1)}`;
        overlay.style.fontSize = 42;
        overlay.visible = true;
        if (!showCaravanArrow) arrow.visible = false;
        centerOverlay(width, height);
      } else if (s.player.state === 'taxi') {
        overlay.text = throttle < 0.15
          ? 'ENGINE IDLE\nTHROTTLE UP'
          : 'ROLLING\nPITCH UP';
        overlay.style.fontSize = 24;
        overlay.visible = true;
        if (!showCaravanArrow) arrow.visible = false;
        centerOverlay(width, height);
        overlay.y = height * (compactHud ? 0.62 : 0.68);
      } else if (stalling) {
        overlay.text = 'STALL\nDIVE TO RECOVER';
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
