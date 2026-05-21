import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { WorldState } from '@biplanes/core';

const G_MAX_REF = 1710;     // dive max for bar scale
const G_STALL_LINE = 1120;  // stall warning threshold

export function createHud(width: number, height: number) {
  const c = new Container();
  const hpBg = new Graphics().rect(20, 20, 240, 20).fill(0x000000);
  const hpFill = new Graphics().rect(22, 22, 236, 16).fill(0xe74c3c);
  const speedBg = new Graphics().rect(20, 50, 240, 10).fill(0x000000);
  const speedFill = new Graphics().rect(22, 52, 0, 6).fill(0x66d9ef);

  const style = new TextStyle({ fontFamily: 'monospace', fontSize: 16, fill: 0xffffff });
  const text = new Text({ text: '', style });
  text.x = 20; text.y = 68;

  // Center overlay (crashed / takeoff hint)
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

  c.addChild(hpBg, hpFill, speedBg, speedFill, text, overlay);

  let pulseT = 0;

  function centerOverlay(w: number, h: number) {
    overlay.x = (w - overlay.width) / 2;
    overlay.y = h * 0.4;
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

      const enemyAlive = s.enemies.filter(e => e.state !== 'crashed').length;
      text.text = `TIME ${s.timeSec.toFixed(1)}s   ENEMIES ${enemyAlive}   SPD ${Math.round(g)}${stalling ? ' STALL!' : ''}`;

      // Overlay: crash countdown, or takeoff hint while taxiing.
      if (s.player.state === 'crashed') {
        overlay.text = `CRASHED\nrespawn in ${Math.max(0, s.player.respawnTimer).toFixed(1)}`;
        overlay.visible = true;
        centerOverlay(width, height);
      } else if (s.player.state === 'taxi') {
        overlay.text = 'TAXI — pull UP to take off';
        overlay.style.fontSize = 28;
        overlay.visible = true;
        centerOverlay(width, height);
      } else {
        overlay.visible = false;
        overlay.style.fontSize = 42;
      }
    },
    resize(w: number, h: number) { width = w; height = h; centerOverlay(w, h); },
  };
}
