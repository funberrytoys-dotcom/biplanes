import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { UpgradeDef } from '@biplanes/core';

export function createLevelUpScreen(width: number, height: number, onPick: (id: string) => void) {
  const c = new Container();
  c.visible = false;
  c.eventMode = 'static';

  // 1. Semi-transparent dark overlay
  const dim = new Graphics().rect(0, 0, width, height).fill({ color: 0x07090f, alpha: 0.85 });
  c.addChild(dim);

  // 2. Neon-orange glowing header text
  const titleStyle = new TextStyle({
    fontFamily: 'monospace',
    fontSize: 34,
    fill: 0xff8c19, // Glowing Amber/Nixie
    fontWeight: 'bold',
    stroke: { color: 0x000000, width: 3 },
  });
  const title = new Text({ text: '⚡ AVIONICS LEVEL UP — UPGRADE SLOTS ⚡', style: titleStyle });
  c.addChild(title);

  // 3. Staggered card management state
  interface CardHandle {
    container: Container;
    bg: Graphics;
    titleText: Text;
    descText: Text;
    currentId: string;
    animTimer: number; // stores stagger progress
    targetX: number;
    targetY: number;
  }

  const cards: CardHandle[] = [];
  const cardW = 280;
  const cardH = 200;

  for (let i = 0; i < 3; i++) {
    const btn = new Container();
    btn.eventMode = 'static';
    btn.cursor = 'pointer';

    // Set local pivot to center for clean zoom scaling on hover
    btn.pivot.set(cardW / 2, cardH / 2);

    const bg = new Graphics();
    btn.addChild(bg);

    const t = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: 'monospace',
        fontSize: 20,
        fill: 0xffa500, // Nixie title tint
        fontWeight: 'bold',
        wordWrap: true,
        wordWrapWidth: cardW - 28,
        stroke: { color: 0x000000, width: 1.5 },
      }),
    });
    // Center title text
    t.x = 14;
    t.y = 16;
    btn.addChild(t);

    const d = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: 'monospace',
        fontSize: 13,
        fill: 0x33ff33, // CRT monitor green spec
        wordWrap: true,
        wordWrapWidth: cardW - 28,
        lineHeight: 18,
      }),
    });
    d.x = 14;
    d.y = 56;
    btn.addChild(d);

    const card: CardHandle = {
      container: btn,
      bg,
      titleText: t,
      descText: d,
      currentId: '',
      animTimer: 0,
      targetX: 0,
      targetY: 0,
    };

    btn.on('pointerdown', () => {
      if (card.currentId) onPick(card.currentId);
    });

    // Draw blueprint background utility
    const drawCardVisuals = (borderColor: number, fillAlpha: number, isHovered: boolean) => {
      bg.clear();
      // Outer glowing frame
      bg.roundRect(0, 0, cardW, cardH, 12)
        .fill({ color: 0x0b1424, alpha: fillAlpha }) // blueprint deep blue
        .stroke({ color: borderColor, width: isHovered ? 3.5 : 2 });
      
      // Draw blueprint grid lines
      const gridSpacing = 20;
      for (let x = gridSpacing; x < cardW; x += gridSpacing) {
        bg.moveTo(x, 0).lineTo(x, cardH).stroke({ color: 0x203550, width: 0.8, alpha: 0.3 });
      }
      for (let y = gridSpacing; y < cardH; y += gridSpacing) {
        bg.moveTo(0, y).lineTo(cardW, y).stroke({ color: 0x203550, width: 0.8, alpha: 0.3 });
      }

      // Draw decorative mechanical corners (copper L brackets)
      const len = 12;
      bg.moveTo(4, 4 + len).lineTo(4, 4).lineTo(4 + len, 4).stroke({ color: 0x8b5a2b, width: 1.8 }) // Top-Left
        .moveTo(cardW - 4 - len, 4).lineTo(cardW - 4, 4).lineTo(cardW - 4, 4 + len).stroke({ color: 0x8b5a2b, width: 1.8 }) // Top-Right
        .moveTo(4, cardH - 4 - len).lineTo(4, cardH - 4).lineTo(4 + len, cardH - 4).stroke({ color: 0x8b5a2b, width: 1.8 }) // Bottom-Left
        .moveTo(cardW - 4 - len, cardH - 4).lineTo(cardW - 4, cardH - 4).lineTo(cardW - 4, cardH - 4 - len).stroke({ color: 0x8b5a2b, width: 1.8 }); // Bottom-Right
    };

    // Initial drawing of default copper frame card
    drawCardVisuals(0x8b5a2b, 0.9, false);

    // Hover interactive scale & neon blueprint highlights
    btn.on('pointerover', () => {
      btn.scale.set(1.05);
      drawCardVisuals(0x00d2ff, 0.95, true); // Neon blue glow blueprint style
      t.style.fill = 0xffffff;
    });

    btn.on('pointerout', () => {
      btn.scale.set(1.0);
      drawCardVisuals(0x8b5a2b, 0.9, false); // Restore copper
      t.style.fill = 0xffa500;
    });

    cards.push(card);
    c.addChild(btn);
  }

  function layout(w: number, h: number) {
    dim.clear().rect(0, 0, w, h).fill({ color: 0x07090f, alpha: 0.85 });
    
    title.x = (w - title.width) / 2;
    title.y = h * 0.15;

    // Horizontally space out card center anchors
    const gap = 35;
    const totalW = cardW * 3 + gap * 2;
    const startX = (w - totalW) / 2 + cardW / 2;
    
    cards.forEach((b, i) => {
      b.targetX = startX + i * (cardW + gap);
      b.targetY = h * 0.48;
      
      // If menu is closed/reopened, keep positions correct
      if (!c.visible) {
        b.container.x = b.targetX;
        b.container.y = b.targetY;
      }
    });
  }
  layout(width, height);

  return {
    container: c,
    show(choices: readonly UpgradeDef[]) {
      c.visible = true;
      cards.forEach((b, i) => {
        const u = choices[i];
        if (u) {
          b.currentId = u.id;
          b.titleText.text = `⚡ ${u.title.toUpperCase()}`;
          b.descText.text = u.description;
          
          // Trigger sliding stagger entry variables
          b.animTimer = -i * 0.18; // Stagger delay
          b.container.x = b.targetX;
          b.container.y = b.targetY + 150; // starts below
          b.container.alpha = 0;
          b.container.scale.set(1.0);
          b.container.visible = true;
        } else {
          b.container.visible = false;
        }
      });
    },
    hide() {
      c.visible = false;
    },
    update(dt: number) {
      if (!c.visible) return;

      // Animate staggered slide up of cards
      for (const card of cards) {
        if (!card.container.visible || card.animTimer >= 1.0) continue;
        
        card.animTimer += dt * 3.6; // Speed of card slide transition
        if (card.animTimer > 0) {
          // Cubic ease-out calculation
          const t = Math.min(1.0, card.animTimer);
          const ease = 1 - Math.pow(1 - t, 3);
          
          card.container.y = card.targetY + 150 * (1 - ease);
          card.container.alpha = ease;
        }
      }
    },
    resize(w: number, h: number) {
      layout(w, h);
    },
  };
}
