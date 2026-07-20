import { Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';
import type { RunSummary } from '@biplanes/core';
import { BRANCH_PALETTE } from './branch-style.js';
import { assetUrl } from '../asset-url.js';
import {
  resolveRunSummaryLayout,
  RUN_SUMMARY_PANEL_W,
  RUN_SUMMARY_PANEL_H,
} from './run-summary-layout.js';

/**
 * End-of-run debrief for «Забег»: outcome banner, wave reached, and the build the
 * player assembled, grouped and colour-coded by branch. Two actions: ЗАНОВО (new
 * run) and В АНГАР (menu).
 */
export function createRunSummaryScreen(
  width: number,
  height: number,
  onRestart: () => void,
  onMenu: () => void,
) {
  const c = new Container();
  c.visible = false;
  c.eventMode = 'static';

  const dim = new Graphics();
  c.addChild(dim);

  const panel = new Container();
  c.addChild(panel);

  const W = RUN_SUMMARY_PANEL_W;
  const H = RUN_SUMMARY_PANEL_H;

  const panelBg = new Graphics();
  panelBg
    .roundRect(0, 0, W, H, 16)
    .fill({ color: 0x0c121c, alpha: 0.97 })
    .stroke({ color: 0x8b5a2b, width: 3 });
  panelBg.roundRect(8, 8, W - 16, H - 16, 12).stroke({ color: 0x4a607a, width: 1, alpha: 0.5 });
  panel.addChild(panelBg);

  const titleStyle = new TextStyle({
    fontFamily: 'Georgia, serif',
    fontSize: 44,
    fontWeight: 'bold',
    fill: 0xffffff,
    letterSpacing: 2,
    stroke: { color: 0x05070a, width: 5 },
  });
  const title = new Text({ text: '', style: titleStyle });
  panel.addChild(title);

  const subtitleStyle = new TextStyle({
    fontFamily: 'BiplanesMono, monospace',
    fontSize: 18,
    fontWeight: 'bold',
    fill: 0xf7d8a0,
    letterSpacing: 1,
  });
  const subtitle = new Text({ text: '', style: subtitleStyle });
  panel.addChild(subtitle);

  const statStyle = new TextStyle({
    fontFamily: 'BiplanesMono, monospace',
    fontSize: 14,
    fill: 0x9fb5c4,
    letterSpacing: 1,
  });
  const statline = new Text({ text: '', style: statStyle });
  panel.addChild(statline);

  const buildHeader = new Text({
    text: 'СОБРАННЫЙ БИЛД',
    style: new TextStyle({ fontFamily: 'BiplanesMono, monospace', fontSize: 12, fill: 0x6f8792, letterSpacing: 2, fontWeight: 'bold' }),
  });
  panel.addChild(buildHeader);

  const buildBox = new Container();
  panel.addChild(buildBox);

  function pill(label: string, accent: number, onTap: () => void) {
    const btn = new Container();
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    const bg = new Graphics();
    const txt = new Text({
      text: label,
      style: new TextStyle({ fontFamily: 'BiplanesMono, monospace', fontSize: 17, fill: accent, fontWeight: 'bold', letterSpacing: 1, stroke: { color: 0x05080e, width: 3 } }),
    });
    const bw = 220;
    const bh = 52;
    const redraw = (hover: boolean) => {
      bg.clear()
        .roundRect(-bw / 2, -bh / 2, bw, bh, 10)
        .fill({ color: 0x0c1420, alpha: hover ? 0.95 : 0.8 })
        .stroke({ color: accent, width: hover ? 3.5 : 2, alpha: hover ? 1 : 0.85 });
      txt.x = -txt.width / 2;
      txt.y = -txt.height / 2 - 1;
    };
    redraw(false);
    btn.addChild(bg, txt);
    btn.on('pointerover', () => { btn.scale.set(1.05); redraw(true); txt.style.fill = 0xffffff; });
    btn.on('pointerout', () => { btn.scale.set(1.0); redraw(false); txt.style.fill = accent; });
    btn.on('pointerdown', onTap);
    return { container: btn, width: bw };
  }

  const restartBtn = pill('ЗАНОВО', 0xffd07a, onRestart);
  const menuBtn = pill('В АНГАР', 0x9fb5c4, onMenu);
  panel.addChild(restartBtn.container, menuBtn.container);

  function positionStatic() {
    title.x = (W - title.width) / 2;
    title.y = 30;
    subtitle.x = (W - subtitle.width) / 2;
    subtitle.y = 88;
    statline.x = (W - statline.width) / 2;
    statline.y = 116;
    buildHeader.x = 40;
    buildHeader.y = 150;
    buildBox.x = 40;
    buildBox.y = 172;
    const gap = 24;
    const totalW = restartBtn.width + menuBtn.width + gap;
    restartBtn.container.x = W / 2 - totalW / 2 + restartBtn.width / 2;
    menuBtn.container.x = W / 2 + totalW / 2 - menuBtn.width / 2;
    restartBtn.container.y = H - 46;
    menuBtn.container.y = H - 46;
  }

  function layout(w: number, h: number) {
    dim.clear().rect(0, 0, w, h).fill({ color: 0x05070d, alpha: 0.86 });
    const l = resolveRunSummaryLayout(w, h);
    panel.scale.set(l.scale);
    panel.x = l.panelX;
    panel.y = l.panelY;
  }
  layout(width, height);

  return {
    container: c,
    show(summary: RunSummary) {
      const won = summary.outcome === 'won';
      title.text = won ? 'ПОБЕДА' : 'ЗАБЕГ ОКОНЧЕН';
      title.style.fill = won ? 0xffe07a : 0xff6a5a;
      subtitle.text = won
        ? `НЕБО ОЧИЩЕНО — ВСЕ ${summary.totalWaves} ВОЛН`
        : `ВОЛНА ${summary.waveReached} / ${summary.totalWaves}`;
      statline.text = `СБИТО ${summary.kills}   ВРЕМЯ ${summary.timeSec.toFixed(0)}С   МОДУЛЕЙ ${summary.totalPicks}` +
        (summary.skips > 0 ? `   ПРОПУЩЕНО ${summary.skips}` : '');

      // Rebuild the per-branch build rows, colour-coded.
      buildBox.removeChildren().forEach(ch => ch.destroy());
      const active = summary.branches.filter(b => b.affinity > 0);
      if (active.length === 0) {
        const none = new Text({
          text: 'Модули не установлены',
          style: new TextStyle({ fontFamily: 'BiplanesMono, monospace', fontSize: 14, fill: 0x7d8896, fontStyle: 'italic' }),
        });
        buildBox.addChild(none);
      } else {
        let y = 0;
        for (const b of active) {
          const accent = BRANCH_PALETTE[b.branch].color;
          // Branch emblem (preloaded). A colour underline + branch-coloured text are
          // the guaranteed signal, so a missing texture never leaves the row blank.
          const EM = 26;
          const emblem = Sprite.from(assetUrl(`assets/run/emblem_${b.branch}.png`));
          emblem.width = EM;
          emblem.height = EM;
          emblem.x = 0;
          emblem.y = y - 4;
          const underline = new Graphics().roundRect(0, y + EM - 6, EM, 3, 1.5).fill({ color: accent });
          const headX = EM + 12;
          const stars = '★'.repeat(b.keystoneTier);
          const head = new Text({
            text: `${b.label}  ×${b.affinity}${stars ? '  ' + stars : ''}`,
            style: new TextStyle({ fontFamily: 'BiplanesMono, monospace', fontSize: 15, fill: accent, fontWeight: 'bold', letterSpacing: 1 }),
          });
          head.x = headX;
          head.y = y;
          const picks = new Text({
            text: b.pickTitles.join(' · ') || '—',
            style: new TextStyle({ fontFamily: 'Arial, sans-serif', fontSize: 13, fill: 0xd6e2e7, wordWrap: true, wordWrapWidth: W - headX - 40, lineHeight: 17 }),
          });
          picks.x = headX;
          picks.y = y + 20;
          buildBox.addChild(emblem, underline, head, picks);
          y += Math.max(EM, 22 + Math.max(17, picks.height)) + 12;
        }
      }

      positionStatic();
      c.visible = true;
    },
    hide() {
      c.visible = false;
    },
    update(_dt: number) {
      // static panel — no animation needed
    },
    resize(w: number, h: number) {
      layout(w, h);
    },
  };
}
