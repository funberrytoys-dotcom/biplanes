import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { UpgradeDef } from '@biplanes/core';

export function createLevelUpScreen(width: number, height: number, onPick: (id: string) => void) {
  const c = new Container();
  c.visible = false;
  c.eventMode = 'static';

  const dim = new Graphics().rect(0, 0, width, height).fill({ color: 0x000000, alpha: 0.6 });
  c.addChild(dim);

  const titleStyle = new TextStyle({ fontFamily: 'monospace', fontSize: 32, fill: 0xffffff, fontWeight: 'bold' });
  const title = new Text({ text: 'LEVEL UP — CHOOSE ONE', style: titleStyle });
  title.x = (width - title.width) / 2;
  title.y = height * 0.15;
  c.addChild(title);

  const buttons: { container: Container; setUpgrade: (u: UpgradeDef) => void }[] = [];

  for (let i = 0; i < 3; i++) {
    const btn = new Container();
    btn.x = (width / 3) * i + width / 6 - 140;
    btn.y = height * 0.35;
    btn.eventMode = 'static';
    btn.cursor = 'pointer';

    const bg = new Graphics().roundRect(0, 0, 280, 180, 12).fill(0x2c3e50).stroke({ width: 3, color: 0xf1c40f });
    btn.addChild(bg);

    const t = new Text({
      text: '', style: new TextStyle({ fontFamily: 'monospace', fontSize: 20, fill: 0xffffff, fontWeight: 'bold', wordWrap: true, wordWrapWidth: 260 }),
    });
    t.x = 14; t.y = 14;
    btn.addChild(t);

    const d = new Text({
      text: '', style: new TextStyle({ fontFamily: 'monospace', fontSize: 14, fill: 0xbdc3c7, wordWrap: true, wordWrapWidth: 260 }),
    });
    d.x = 14; d.y = 60;
    btn.addChild(d);

    let currentId = '';
    btn.on('pointerdown', () => { if (currentId) onPick(currentId); });

    buttons.push({
      container: btn,
      setUpgrade(u: UpgradeDef) {
        currentId = u.id;
        t.text = u.title;
        d.text = u.description;
      },
    });

    c.addChild(btn);
  }

  return {
    container: c,
    show(choices: readonly UpgradeDef[]) {
      c.visible = true;
      buttons.forEach((b, i) => {
        const u = choices[i];
        if (u) { b.setUpgrade(u); b.container.visible = true; }
        else { b.container.visible = false; }
      });
    },
    hide() { c.visible = false; },
    resize(w: number, h: number) {
      dim.clear().rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0.6 });
      title.x = (w - title.width) / 2;
      title.y = h * 0.15;
      buttons.forEach((b, i) => {
        b.container.x = (w / 3) * i + w / 6 - 140;
        b.container.y = h * 0.35;
      });
    },
  };
}
