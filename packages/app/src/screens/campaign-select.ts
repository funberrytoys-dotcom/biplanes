import { Container, Graphics, Text, TextStyle } from 'pixi.js';

/**
 * «Кампания» level-select overlay. A simple vertical list of campaign levels (Уровень 1,
 * Демо: Дирижабль, …) shown when the player opens Campaign from the main menu. New campaign
 * levels are added by extending the `levels` array passed in from main.ts — this is the hub
 * we drop future missions into.
 */
export interface CampaignLevelDef {
  id: string;
  label: string;
  note: string;
  enabled: boolean;
}

export function createCampaignSelect(
  width: number,
  height: number,
  levels: CampaignLevelDef[],
  onPick: (id: string) => void,
  onBack: () => void,
) {
  const c = new Container();
  c.eventMode = 'static';
  c.visible = false;

  const dim = new Graphics();
  const panel = new Container();
  c.addChild(dim, panel);

  const title = new Text({
    text: 'КАМПАНИЯ',
    style: new TextStyle({
      fontFamily: 'Georgia, Times New Roman, serif',
      fontSize: 46, fontWeight: 'bold', fill: 0xfff0c0,
      stroke: { color: 0x1b0d05, width: 5 },
    }),
  });
  const hint = new Text({
    text: 'Выбери миссию',
    style: new TextStyle({
      fontFamily: 'BiplanesMono, monospace', fontSize: 16, fill: 0xf7d8a0,
      stroke: { color: 0x000000, width: 3 },
    }),
  });
  panel.addChild(title, hint);

  const ROW_W = 560, ROW_H = 66, ROW_GAP = 14;

  function rowStyle(bg: Graphics, enabled: boolean, hovered: boolean) {
    const color = enabled ? 0xffb44a : 0x8390a8;
    bg.clear()
      .roundRect(-ROW_W / 2, -ROW_H / 2, ROW_W, ROW_H, 10)
      .fill({ color: 0x0a1320, alpha: enabled ? (hovered ? 0.92 : 0.78) : 0.5 })
      .stroke({ color, width: hovered && enabled ? 3 : 2, alpha: enabled ? (hovered ? 1 : 0.82) : 0.4 });
  }

  const rows: Container[] = [];
  for (const lvl of levels) {
    const row = new Container();
    row.eventMode = 'static';
    row.cursor = lvl.enabled ? 'pointer' : 'default';
    const bg = new Graphics();
    const label = new Text({
      text: lvl.label,
      style: new TextStyle({
        fontFamily: 'BiplanesMono, monospace', fontSize: 22, fontWeight: 'bold',
        fill: lvl.enabled ? 0xffd07a : 0x9ca6ba, stroke: { color: 0x05080e, width: 4 },
      }),
    });
    const note = new Text({
      text: lvl.note,
      style: new TextStyle({
        fontFamily: 'BiplanesMono, monospace', fontSize: 12, fill: lvl.enabled ? 0xcdd6e6 : 0x7a8398,
        stroke: { color: 0x000000, width: 2 }, wordWrap: true, wordWrapWidth: ROW_W - 40,
      }),
    });
    rowStyle(bg, lvl.enabled, false);
    label.x = -ROW_W / 2 + 20; label.y = -ROW_H / 2 + 9;
    note.x = -ROW_W / 2 + 20; note.y = 4;
    row.addChild(bg, label, note);
    row.on('pointerover', () => { if (lvl.enabled) { row.scale.set(1.02); rowStyle(bg, true, true); } });
    row.on('pointerout', () => { row.scale.set(1); rowStyle(bg, lvl.enabled, false); });
    row.on('pointerdown', () => { if (lvl.enabled) onPick(lvl.id); });
    rows.push(row);
    panel.addChild(row);
  }

  const back = new Container();
  back.eventMode = 'static';
  back.cursor = 'pointer';
  const backBg = new Graphics();
  const backTxt = new Text({
    text: '‹ НАЗАД',
    style: new TextStyle({ fontFamily: 'BiplanesMono, monospace', fontSize: 18, fontWeight: 'bold', fill: 0xffd07a, stroke: { color: 0x05080e, width: 4 } }),
  });
  function drawBack(hovered: boolean) {
    backBg.clear().roundRect(-90, -24, 180, 48, 8)
      .fill({ color: 0x0a1320, alpha: hovered ? 0.92 : 0.72 })
      .stroke({ color: 0xffb44a, width: hovered ? 3 : 2, alpha: hovered ? 1 : 0.8 });
  }
  drawBack(false);
  backTxt.x = -backTxt.width / 2; backTxt.y = -backTxt.height / 2 - 1;
  back.addChild(backBg, backTxt);
  back.on('pointerover', () => { back.scale.set(1.04); drawBack(true); });
  back.on('pointerout', () => { back.scale.set(1); drawBack(false); });
  back.on('pointerdown', () => onBack());
  panel.addChild(back);

  function layout(w: number, h: number) {
    dim.clear().rect(0, 0, w, h).fill({ color: 0x040b14, alpha: 0.82 });
    const cx = w / 2;
    const totalH = rows.length * ROW_H + (rows.length - 1) * ROW_GAP;
    const startY = Math.max(150, h / 2 - totalH / 2 + 20);
    title.x = cx - title.width / 2; title.y = startY - 120;
    hint.x = cx - hint.width / 2; hint.y = startY - 58;
    rows.forEach((row, i) => { row.x = cx; row.y = startY + i * (ROW_H + ROW_GAP) + ROW_H / 2; });
    back.x = cx; back.y = startY + totalH + 52;
  }
  layout(width, height);

  return {
    container: c,
    show() { c.visible = true; },
    hide() { c.visible = false; },
    resize(w: number, h: number) { layout(w, h); },
  };
}
