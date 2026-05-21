import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { Difficulty } from '@biplanes/core';

export function createStartScreen(width: number, height: number, onPick: (d: Difficulty) => void) {
  const c = new Container();
  c.eventMode = 'static';
  const dim = new Graphics().rect(0, 0, width, height).fill(0x0a1428);
  c.addChild(dim);

  const title = new Text({
    text: 'BIPLANES PROTOTYPE',
    style: new TextStyle({ fontFamily: 'monospace', fontSize: 48, fill: 0xf4d35e, fontWeight: 'bold' }),
  });
  const subtitle = new Text({
    text: 'Choose difficulty',
    style: new TextStyle({ fontFamily: 'monospace', fontSize: 22, fill: 0xffffff }),
  });
  c.addChild(title, subtitle);

  const buttons: Container[] = [];
  const levels: { label: string; d: Difficulty; color: number }[] = [
    { label: 'EASY',   d: 'easy',   color: 0x27ae60 },
    { label: 'MEDIUM', d: 'medium', color: 0xf39c12 },
    { label: 'HARD',   d: 'hard',   color: 0xe74c3c },
  ];

  for (const { label, d, color } of levels) {
    const btn = new Container();
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    const bg = new Graphics().roundRect(0, 0, 220, 80, 12).fill(color);
    const t = new Text({
      text: label,
      style: new TextStyle({ fontFamily: 'monospace', fontSize: 28, fill: 0xffffff, fontWeight: 'bold' }),
    });
    t.x = (220 - t.width) / 2; t.y = (80 - t.height) / 2;
    btn.addChild(bg, t);
    btn.on('pointerdown', () => onPick(d));
    buttons.push(btn);
    c.addChild(btn);
  }

  function layout(w: number, h: number) {
    dim.clear().rect(0, 0, w, h).fill(0x0a1428);
    title.x = (w - title.width) / 2;
    title.y = h * 0.20;
    subtitle.x = (w - subtitle.width) / 2;
    subtitle.y = h * 0.35;
    const gap = 30;
    const totalW = 220 * 3 + gap * 2;
    const startX = (w - totalW) / 2;
    buttons.forEach((b, i) => {
      b.x = startX + i * (220 + gap);
      b.y = h * 0.5;
    });
  }
  layout(width, height);

  return {
    container: c,
    show() { c.visible = true; },
    hide() { c.visible = false; },
    resize(w: number, h: number) { layout(w, h); },
  };
}
