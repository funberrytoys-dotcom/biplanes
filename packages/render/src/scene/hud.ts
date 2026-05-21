import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { WorldState } from '@biplanes/core';
import { findPilot } from '@biplanes/core';
import { PLAYER_HANGAR_X } from '@biplanes/shared';

const G_MAX_REF = 950;      // dive max for bar scale (matches G_MAX_DIVE)
const G_STALL_LINE = 620;   // stall warning threshold (matches G_STALL)

export function createHud(width: number, height: number) {
  const c = new Container();

  // HP bar
  const hpBg = new Graphics().rect(20, 20, 240, 20).fill(0x000000);
  const hpFill = new Graphics().rect(22, 22, 236, 16).fill(0xe74c3c);

  // Speed bar
  const speedBg = new Graphics().rect(20, 50, 240, 10).fill(0x000000);
  const speedFill = new Graphics().rect(22, 52, 0, 6).fill(0x66d9ef);

  // Throttle bar
  const THR_X = 20;
  const THR_Y = 66;
  const THR_W = 240;
  const THR_H = 18;
  const throttleBorder = new Graphics()
    .rect(THR_X - 1, THR_Y - 1, THR_W + 2, THR_H + 2)
    .stroke({ color: 0xffffff, width: 1 });
  const throttleBg = new Graphics().rect(THR_X, THR_Y, THR_W, THR_H).fill(0x1a1a1a);
  const throttleFill = new Graphics().rect(THR_X, THR_Y, 0, THR_H).fill(0xff8c19);
  const tickLayer = new Graphics();
  for (const frac of [0.25, 0.5, 0.75]) {
    const tx = THR_X + THR_W * frac;
    tickLayer.moveTo(tx, THR_Y - 2).lineTo(tx, THR_Y + THR_H + 2).stroke({ color: 0xffffff, width: 1 });
  }
  const thrLabelStyle = new TextStyle({
    fontFamily: 'monospace',
    fontSize: 13,
    fill: 0xffffff,
    fontWeight: 'bold',
  });
  const thrLabel = new Text({ text: 'THR', style: thrLabelStyle });
  thrLabel.x = THR_X + THR_W + 8;
  thrLabel.y = THR_Y + 2;

  const style = new TextStyle({ fontFamily: 'monospace', fontSize: 16, fill: 0xffffff });
  const text = new Text({ text: '', style });
  text.x = 20; text.y = THR_Y + THR_H + 8;

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

  c.addChild(
    hpBg, hpFill, speedBg, speedFill,
    throttleBorder, throttleBg, throttleFill, tickLayer, thrLabel,
    text, overlay, arrow,
  );

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
      const hpPct = Math.max(0, s.player.hp / s.player.maxHp);
      hpFill.clear().rect(22, 22, 236 * hpPct, 16).fill(0xe74c3c);

      const g = s.player.kinematic.g;
      const speedPct = Math.max(0, Math.min(1, g / G_MAX_REF));
      const stalling = g < G_STALL_LINE && s.player.state === 'flying';
      pulseT += 0.15;
      const pulse = stalling ? 0.6 + 0.4 * Math.abs(Math.sin(pulseT)) : 1;
      const baseColor = stalling ? 0xff3030 : 0x66d9ef;
      const r = Math.round(((baseColor >> 16) & 0xff) * pulse);
      const gC = Math.round(((baseColor >> 8) & 0xff) * pulse);
      const b = Math.round((baseColor & 0xff) * pulse);
      const speedColor = (r << 16) | (gC << 8) | b;
      speedFill.clear().rect(22, 52, 236 * speedPct, 6).fill(speedColor);

      const throttle = s.player.kinematic.throttleLevel ?? 1;
      throttleFill.clear().rect(THR_X, THR_Y, THR_W * throttle, THR_H).fill(0xff8c19);

      const enemyAlive = s.enemies.filter(e => e.state !== 'crashed').length;
      const h = s.player.kinematic.heading;
      const inverted = s.player.state === 'flying' && Math.abs(h) > Math.PI / 2 + 0.4 && Math.abs(h) < Math.PI - 0.4;
      text.text = `[${s.difficulty.toUpperCase()}]  YOU ${s.playerScore} — ENEMY ${s.enemyScore}  TIME ${s.timeSec.toFixed(1)}s  ENEMIES ${enemyAlive}  SPD ${Math.round(g)}  THR ${Math.round(throttle * 100)}%${stalling ? ' STALL!' : ''}${inverted ? ' INVERTED' : ''}`;

      // Pilot-overlay: prioritise player pilot for the center messaging.
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
        overlay.text = 'TAXI — pull UP to take off';
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
