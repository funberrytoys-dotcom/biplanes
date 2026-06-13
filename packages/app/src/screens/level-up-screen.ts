import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { UpgradeDef } from '@biplanes/core';
import {
  categoryLabel,
  rarityForUpgrade,
  resolveLevelUpCardLayout,
  type UpgradeRarity,
} from './level-up-screen-layout.js';

export function createLevelUpScreen(width: number, height: number, onPick: (id: string) => void) {
  const c = new Container();
  c.visible = false;
  c.eventMode = 'static';

  const dim = new Graphics().rect(0, 0, width, height).fill({ color: 0x08090d, alpha: 0.78 });
  const vignette = new Graphics();
  c.addChild(dim, vignette);

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
  const title = new Text({ text: 'FIELD MODIFICATION', style: titleStyle });
  const subtitle = new Text({ text: 'Choose one upgrade for the next sortie', style: subtitleStyle });
  c.addChild(title, subtitle);

  interface CardHandle {
    container: Container;
    bg: Graphics;
    badge: Graphics;
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
  const pickStyle = new TextStyle({
    fontFamily: 'monospace',
    fontSize: 11,
    fill: 0x0d141a,
    fontWeight: 'bold',
    letterSpacing: 0,
  });

  function drawCard(card: CardHandle, highlighted = false) {
    const { bg, badge, width: cardW, height: cardH, rarity, pressed } = card;
    const accent = rarity === 'ace' ? 0xffd55d : 0xb97536;
    const edge = highlighted || pressed ? 0xffe1a4 : accent;
    const fill = rarity === 'ace' ? 0x29170b : 0x162231;

    bg.clear();
    bg.roundRect(0, 0, cardW, cardH, 8)
      .fill({ color: fill, alpha: highlighted ? 0.98 : 0.94 })
      .stroke({ color: 0x0a0d12, width: 5, alpha: 0.95 });
    bg.roundRect(5, 5, cardW - 10, cardH - 10)
      .stroke({ color: edge, width: highlighted || pressed ? 3 : 2, alpha: 0.92 });
    bg.rect(12, 42, cardW - 24, 1).fill({ color: accent, alpha: 0.55 });
    bg.rect(12, cardH - 42, cardW - 24, 1).fill({ color: 0x6f8792, alpha: 0.38 });
    bg.circle(cardW - 22, 22, 4).fill({ color: accent, alpha: 0.85 });
    bg.circle(22, cardH - 22, 3).fill({ color: 0x6f8792, alpha: 0.75 });

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
    const badge = new Graphics();
    const categoryText = new Text({ text: '', style: labelStyle });
    const titleText = new Text({ text: '', style: cardTitleStyle });
    const descText = new Text({ text: '', style: cardDescStyle });
    const pickText = new Text({ text: 'TAP TO INSTALL', style: pickStyle });

    btn.addChild(bg, badge, categoryText, titleText, descText, pickText);

    const card: CardHandle = {
      container: btn,
      bg,
      badge,
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
      rarity: 'standard',
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
    dim.clear().rect(0, 0, w, h).fill({ color: 0x08090d, alpha: 0.78 });
    vignette.clear()
      .rect(0, 0, w, h * 0.22).fill({ color: 0x000000, alpha: 0.3 })
      .rect(0, h * 0.78, w, h * 0.22).fill({ color: 0x000000, alpha: 0.24 });

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
      card.titleText.style.fontSize = bounds.width < 230 ? 16 : 19;
      card.descText.style.fontSize = bounds.width < 230 ? 12 : 13;
      card.categoryText.x = 19;
      card.categoryText.y = 16;
      card.badge.x = 14;
      card.badge.y = 12;
      card.titleText.x = 14;
      card.titleText.y = 52;
      card.descText.x = 14;
      card.descText.y = 100;
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
          card.titleText.text = upgrade.title;
          card.descText.text = upgrade.description;
          card.pickText.text = card.rarity === 'ace' ? 'INSTALL ACE MOD' : 'TAP TO INSTALL';
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
