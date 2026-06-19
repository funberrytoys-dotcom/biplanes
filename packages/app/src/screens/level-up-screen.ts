import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { UpgradeDef } from '@biplanes/core';
import {
  categoryLabel,
  rarityLabel,
  rarityForUpgrade,
  resolveLevelUpCardLayout,
  RARITY_PALETTE,
  type UpgradeRarity,
} from './level-up-screen-layout.js';

export function createLevelUpScreen(width: number, height: number, onPick: (id: string) => void) {
  const c = new Container();
  c.visible = false;
  c.eventMode = 'static';

  const dim = new Graphics().rect(0, 0, width, height).fill({ color: 0x08090d, alpha: 0.66 });
  const vignette = new Graphics();
  const rays = new Graphics();
  c.addChild(dim, vignette, rays);

  const titleStyle = new TextStyle({
    fontFamily: 'Georgia, serif',
    fontSize: 26,
    fill: 0xf7d69a,
    fontWeight: 'bold',
    letterSpacing: 0,
    stroke: { color: 0x1a0f08, width: 3 },
  });
  const subtitleStyle = new TextStyle({
    fontFamily: 'monospace',
    fontSize: 12,
    fill: 0x9fb5c4,
    letterSpacing: 0,
  });
  const title = new Text({ text: 'ВОЗДУШНАЯ МАСТЕРСКАЯ', style: titleStyle });
  const subtitle = new Text({ text: 'Установи один модуль перед следующей волной', style: subtitleStyle });
  c.addChild(title, subtitle);

  interface CardHandle {
    container: Container;
    bg: Graphics;
    shine: Graphics;
    badge: Graphics;
    rarityText: Text;
    categoryText: Text;
    titleText: Text;
    descText: Text;
    pickText: Text;
    currentId: string;
    animTimer: number;
    targetX: number;
    targetY: number;
    width: number;
    height: number;
    rarity: UpgradeRarity;
    pressed: boolean;
  }

  const cards: CardHandle[] = [];
  const cardTitleStyle = new TextStyle({
    fontFamily: 'Georgia, serif',
    fontSize: 19,
    fill: 0xffe0a4,
    fontWeight: 'bold',
    wordWrap: true,
    wordWrapWidth: 240,
    letterSpacing: 0,
    stroke: { color: 0x180e08, width: 2 },
  });
  const cardDescStyle = new TextStyle({
    fontFamily: 'Arial, sans-serif',
    fontSize: 13,
    fill: 0xd6e2e7,
    wordWrap: true,
    wordWrapWidth: 240,
    lineHeight: 17,
    letterSpacing: 0,
  });
  const labelStyle = new TextStyle({
    fontFamily: 'monospace',
    fontSize: 10,
    fill: 0x251307,
    fontWeight: 'bold',
    letterSpacing: 0,
  });
  const rarityStyle = new TextStyle({
    fontFamily: 'monospace',
    fontSize: 9,
    fill: 0xffe7ad,
    fontWeight: 'bold',
    letterSpacing: 0,
    stroke: { color: 0x120804, width: 2 },
  });
  const pickStyle = new TextStyle({
    fontFamily: 'monospace',
    fontSize: 11,
    fill: 0x0d141a,
    fontWeight: 'bold',
    letterSpacing: 0,
  });

  function drawCard(card: CardHandle, highlighted = false) {
    const { bg, shine, badge, width: cardW, height: cardH, rarity, pressed } = card;
    const pal = RARITY_PALETTE[rarity];
    const accent = pal.accent;
    const secondary = pal.secondary;
    const edge = highlighted || pressed ? 0xfff0bd : accent;
    const fill = pal.fill;

    bg.clear();
    bg.roundRect(0, 0, cardW, cardH, 8)
      .fill({ color: fill, alpha: highlighted ? 0.98 : 0.94 })
      .stroke({ color: 0x05070a, width: 5, alpha: 0.98 });
    bg.roundRect(4, 4, cardW - 8, cardH - 8, 6)
      .fill({ color: pal.deep, alpha: 0.52 });
    bg.roundRect(5, 5, cardW - 10, cardH - 10)
      .stroke({ color: edge, width: highlighted || pressed ? 3 : 2, alpha: 0.92 });
    bg.rect(12, 43, cardW - 24, 1).fill({ color: accent, alpha: 0.62 });
    bg.rect(12, cardH - 48, cardW - 24, 1).fill({ color: 0x6f8792, alpha: 0.42 });
    // Single decorative rivet bottom-right only (the old top-right + bottom-left
    // rivets collided with the rarity label and the "СТАВИТЬ" button text).
    bg.circle(cardW - 22, cardH - 22, 3.4).fill({ color: secondary, alpha: 0.65 });

    shine.clear()
      .moveTo(8, 8)
      .lineTo(cardW - 8, 8)
      .lineTo(cardW - 34, 32)
      .lineTo(32, 32)
      .closePath()
      .fill({ color: 0xffffff, alpha: highlighted || pressed ? 0.075 : 0.045 });

    badge.clear();
    badge.roundRect(0, 0, Math.min(92, cardW - 24), 22, 5)
      .fill({ color: accent, alpha: 0.95 })
      .stroke({ color: 0x1a0d05, width: 1.5, alpha: 0.85 });
  }

  for (let i = 0; i < 3; i++) {
    const btn = new Container();
    btn.eventMode = 'static';
    btn.cursor = 'pointer';

    const bg = new Graphics();
    const shine = new Graphics();
    const badge = new Graphics();
    const rarityText = new Text({ text: '', style: rarityStyle });
    const categoryText = new Text({ text: '', style: labelStyle });
    const titleText = new Text({ text: '', style: cardTitleStyle });
    const descText = new Text({ text: '', style: cardDescStyle });
    const pickText = new Text({ text: 'ВЫБРАТЬ', style: pickStyle });

    btn.addChild(bg, shine, badge, categoryText, rarityText, titleText, descText, pickText);

    const card: CardHandle = {
      container: btn,
      bg,
      shine,
      badge,
      rarityText,
      categoryText,
      titleText,
      descText,
      pickText,
      currentId: '',
      animTimer: 0,
      targetX: 0,
      targetY: 0,
      width: 260,
      height: 190,
      rarity: 'common',
      pressed: false,
    };

    btn.on('pointerover', () => {
      btn.scale.set(1.035);
      drawCard(card, true);
    });
    btn.on('pointerout', () => {
      card.pressed = false;
      btn.scale.set(1.0);
      drawCard(card, false);
    });
    btn.on('pointerdown', () => {
      card.pressed = true;
      btn.scale.set(0.985);
      drawCard(card, true);
      if (card.currentId) onPick(card.currentId);
    });
    btn.on('pointerupoutside', () => {
      card.pressed = false;
      btn.scale.set(1.0);
      drawCard(card, false);
    });

    cards.push(card);
    c.addChild(btn);
  }

  function layout(w: number, h: number) {
    dim.clear().rect(0, 0, w, h).fill({ color: 0x08090d, alpha: 0.66 });
    vignette.clear()
      .rect(0, 0, w, h * 0.22).fill({ color: 0x000000, alpha: 0.34 })
      .rect(0, h * 0.74, w, h * 0.26).fill({ color: 0x000000, alpha: 0.34 });
    rays.clear();
    for (let i = 0; i < 9; i++) {
      const x = (i + 0.5) * (w / 9);
      rays
        .moveTo(x - 18, h)
        .lineTo(x + 16, h)
        .lineTo(w * 0.5 + (i - 4) * 24, h * 0.08)
        .closePath()
        .fill({ color: 0xffd87a, alpha: i % 2 === 0 ? 0.035 : 0.022 });
    }

    const cardLayout = resolveLevelUpCardLayout(w, h, cards.length);
    title.style.fontSize = Math.max(20, Math.min(30, w * 0.03));
    subtitle.style.fontSize = Math.max(10, Math.min(13, w * 0.013));
    title.x = (w - title.width) / 2;
    title.y = cardLayout.titleY;
    subtitle.x = (w - subtitle.width) / 2;
    subtitle.y = title.y + title.height + 2;

    cards.forEach((card, i) => {
      const bounds = cardLayout.cards[i]!;
      card.width = bounds.width;
      card.height = bounds.height;
      card.container.pivot.set(bounds.width / 2, bounds.height / 2);
      card.targetX = bounds.x;
      card.targetY = bounds.y;
      card.titleText.style.wordWrapWidth = bounds.width - 28;
      card.descText.style.wordWrapWidth = bounds.width - 28;
      card.titleText.style.fontSize = bounds.width < 230 ? 17 : 20;
      card.descText.style.fontSize = bounds.width < 230 ? 13 : 14;
      card.rarityText.style.fontSize = bounds.width < 230 ? 8 : 9;
      card.categoryText.x = 19;
      card.categoryText.y = 16;
      card.badge.x = 14;
      card.badge.y = 12;
      card.rarityText.x = bounds.width - card.rarityText.width - 16;
      card.rarityText.y = 16;
      card.titleText.x = 14;
      card.titleText.y = 55;
      card.descText.x = 14;
      card.descText.y = 106;
      card.pickText.x = 14;
      card.pickText.y = bounds.height - 30;
      if (!c.visible) {
        card.container.x = bounds.x;
        card.container.y = bounds.y;
      }
      drawCard(card, false);
    });
  }
  layout(width, height);

  return {
    container: c,
    show(choices: readonly UpgradeDef[]) {
      c.visible = true;
      cards.forEach((card, i) => {
        const upgrade = choices[i];
        if (upgrade) {
          card.currentId = upgrade.id;
          card.rarity = rarityForUpgrade(upgrade);
          card.pressed = false;
          card.categoryText.text = categoryLabel(upgrade.category);
          card.rarityText.text = rarityLabel(card.rarity);
          card.titleText.text = upgrade.title;
          card.descText.text = upgrade.description;
          card.pickText.text = upgrade.isEvolution ? 'СТАВИТЬ ЭВОЛЮЦИЮ' : 'СТАВИТЬ МОДУЛЬ';
          card.rarityText.x = card.width - card.rarityText.width - 16;
          card.animTimer = -i * 0.12;
          card.container.x = card.targetX;
          card.container.y = card.targetY + 72;
          card.container.alpha = 0;
          card.container.scale.set(1.0);
          card.container.visible = true;
          drawCard(card, false);
        } else {
          card.container.visible = false;
        }
      });
    },
    hide() {
      c.visible = false;
    },
    update(dt: number) {
      if (!c.visible) return;

      for (const card of cards) {
        if (!card.container.visible || card.animTimer >= 1.0) continue;

        card.animTimer += dt * 4.2;
        if (card.animTimer > 0) {
          const t = Math.min(1.0, card.animTimer);
          const ease = 1 - Math.pow(1 - t, 3);
          card.container.y = card.targetY + 72 * (1 - ease);
          card.container.alpha = ease;
        }
      }
    },
    resize(w: number, h: number) {
      layout(w, h);
    },
  };
}
