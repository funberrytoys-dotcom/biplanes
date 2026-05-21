import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { WorldState } from '@biplanes/core';

const G_MAX_REF = 1710;     // dive max for bar scale
const G_STALL_LINE = 1120;  // stall warning threshold

export function createHud(width: number, height: number) {
  const c = new Container();
  const hpBg = new Graphics().rect(20, 20, 240, 20).fill(0x000000);
  const hpFill = new Graphics().rect(22, 22, 236, 16).fill(0xe74c3c);
  const xpBg = new Graphics().rect(20, 50, 240, 10).fill(0x000000);
  const xpFill = new Graphics().rect(22, 52, 0, 6).fill(0xf1c40f);
  const speedBg = new Graphics().rect(20, 80, 240, 10).fill(0x000000);
  const speedFill = new Graphics().rect(22, 82, 0, 6).fill(0x66d9ef);

  const style = new TextStyle({ fontFamily: 'monospace', fontSize: 16, fill: 0xffffff });
  const text = new Text({ text: '', style });
  text.x = 20; text.y = 100;

  c.addChild(hpBg, hpFill, xpBg, xpFill, speedBg, speedFill, text);

  let pulseT = 0;

  return {
    container: c,
    update(s: WorldState) {
      const hpPct = Math.max(0, s.player.hp / s.player.maxHp);
      hpFill.clear().rect(22, 22, 236 * hpPct, 16).fill(0xe74c3c);

      const prevThreshold = s.level >= 2 ? [10, 25, 50, 90, 150, 230, 330, 450][s.level - 2] ?? 0 : 0;
      const nextThreshold = [10, 25, 50, 90, 150, 230, 330, 450][s.level - 1] ?? 999999;
      const xpPct = Math.max(0, Math.min(1, (s.xpCollected - prevThreshold) / (nextThreshold - prevThreshold)));
      xpFill.clear().rect(22, 52, 236 * xpPct, 6).fill(0xf1c40f);

      const g = s.player.kinematic.g;
      const speedPct = Math.max(0, Math.min(1, g / G_MAX_REF));
      const stalling = g < G_STALL_LINE;
      // Pulse stall color so it draws attention
      pulseT += 0.15;
      const pulse = stalling ? 0.6 + 0.4 * Math.abs(Math.sin(pulseT)) : 1;
      const baseColor = stalling ? 0xff3030 : 0x66d9ef;
      // Apply pulse by darkening (multiply each channel)
      const r = Math.round(((baseColor >> 16) & 0xff) * pulse);
      const gC = Math.round(((baseColor >> 8) & 0xff) * pulse);
      const b = Math.round((baseColor & 0xff) * pulse);
      const speedColor = (r << 16) | (gC << 8) | b;
      speedFill.clear().rect(22, 82, 236 * speedPct, 6).fill(speedColor);

      text.text = `LVL ${s.level}   TIME ${s.timeSec.toFixed(1)}s   ENEMIES ${s.enemies.length}   SPD ${Math.round(g)}${stalling ? ' STALL!' : ''}`;
    },
    resize(w: number, h: number) { width = w; height = h; },
  };
}
