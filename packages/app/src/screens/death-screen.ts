import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { WorldState } from '@biplanes/core';

export function createDeathScreen(width: number, height: number, onRestart: () => void) {
  const c = new Container();
  c.visible = false;
  c.eventMode = 'static';

  const dim = new Graphics().rect(0, 0, width, height).fill({ color: 0x000000, alpha: 0.7 });
  c.addChild(dim);

  const title = new Text({ text: 'YOU DIED', style: new TextStyle({ fontFamily: 'monospace', fontSize: 48, fill: 0xe74c3c, fontWeight: 'bold' }) });
  c.addChild(title);

  const stats = new Text({ text: '', style: new TextStyle({ fontFamily: 'monospace', fontSize: 18, fill: 0xffffff, align: 'center' }) });
  c.addChild(stats);

  const button = new Container();
  button.eventMode = 'static';
  button.cursor = 'pointer';
  const btnBg = new Graphics().roundRect(0, 0, 240, 60, 12).fill(0x27ae60);
  const btnText = new Text({ text: 'TRY AGAIN', style: new TextStyle({ fontFamily: 'monospace', fontSize: 22, fill: 0xffffff, fontWeight: 'bold' }) });
  btnText.x = (240 - btnText.width) / 2;
  btnText.y = (60 - btnText.height) / 2;
  button.addChild(btnBg, btnText);
  button.on('pointerdown', onRestart);
  c.addChild(button);

  function layout(w: number, h: number) {
    dim.clear().rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0.7 });
    title.x = (w - title.width) / 2;
    title.y = h * 0.25;
    stats.x = (w - stats.width) / 2;
    stats.y = h * 0.4;
    button.x = (w - 240) / 2;
    button.y = h * 0.65;
  }
  layout(width, height);

  return {
    container: c,
    show(state: WorldState) {
      stats.text = `Survived: ${state.timeSec.toFixed(1)}s\nLevel: ${state.level}\nXP: ${state.xpCollected}\nUpgrades: ${state.appliedUpgradeIds.length}`;
      // Note: initial layout(width, height) at construction already centered stats.
      // We do not recenter on show() because c.parent.width is the children-bounds width,
      // not the screen width, which produced incorrect placement. Resize handler keeps it correct.
      c.visible = true;
    },
    hide() { c.visible = false; },
    resize(w: number, h: number) { layout(w, h); },
  };
}
