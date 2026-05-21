import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { WorldState } from '@biplanes/core';

export function createHud(width: number, height: number) {
  const c = new Container();
  const hpBg = new Graphics().rect(20, 20, 240, 20).fill(0x000000);
  const hpFill = new Graphics().rect(22, 22, 236, 16).fill(0xe74c3c);
  const xpBg = new Graphics().rect(20, 50, 240, 10).fill(0x000000);
  const xpFill = new Graphics().rect(22, 52, 0, 6).fill(0xf1c40f);

  const style = new TextStyle({ fontFamily: 'monospace', fontSize: 16, fill: 0xffffff });
  const text = new Text({ text: '', style });
  text.x = 20; text.y = 70;

  c.addChild(hpBg, hpFill, xpBg, xpFill, text);

  return {
    container: c,
    update(s: WorldState) {
      const hpPct = Math.max(0, s.player.hp / s.player.maxHp);
      hpFill.clear().rect(22, 22, 236 * hpPct, 16).fill(0xe74c3c);

      const prevThreshold = s.level >= 2 ? [10, 25, 50, 90, 150, 230, 330, 450][s.level - 2] ?? 0 : 0;
      const nextThreshold = [10, 25, 50, 90, 150, 230, 330, 450][s.level - 1] ?? 999999;
      const xpPct = Math.max(0, Math.min(1, (s.xpCollected - prevThreshold) / (nextThreshold - prevThreshold)));
      xpFill.clear().rect(22, 52, 236 * xpPct, 6).fill(0xf1c40f);

      text.text = `LVL ${s.level}   TIME ${s.timeSec.toFixed(1)}s   ENEMIES ${s.enemies.length}`;
    },
    resize(w: number, h: number) { width = w; height = h; },
  };
}
