import { Container, Graphics, Text, TextStyle, Sprite, Texture } from 'pixi.js';
import type { UpgradeDef, Branch } from '@biplanes/core';
import {
  categoryLabel,
  rarityLabel,
  rarityForUpgrade,
  resolveLevelUpCardLayout,
  RARITY_PALETTE,
  type UpgradeRarity,
} from './level-up-screen-layout.js';
import { branchStyleForUpgradeId } from './branch-style.js';

export interface LevelUpRunControls {
  rerollsRemaining: number;
}

export interface LevelUpScreenOpts {
  onReroll?: () => void;
  onSkip?: () => void;
  /** Branch emblem textures, shown as a soft blurred watermark on each pick card. */
  branchEmblems?: Partial<Record<Branch, Texture>>;
}

export function createLevelUpScreen(
  width: number,
  height: number,
  onPick: (id: string) => void,
  opts: LevelUpScreenOpts = {},
) {
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
    emblem: Sprite;
    emblemMask: Graphics;
    shine: Graphics;
    badge: Graphics;
    rarityText: Text;
    categoryText: Text;
    branchText: Text;
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
    branchColor: number;
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
  const branchTextStyle = new TextStyle({
    fontFamily: 'monospace',
    fontSize: 10,
    fill: 0xffffff,
    fontWeight: 'bold',
    letterSpacing: 1,
    stroke: { color: 0x05070a, width: 3 },
  });

  function drawCard(card: CardHandle, highlighted = false) {
    const { bg, shine, badge, emblem, width: cardW, height: cardH, rarity, branchColor, pressed } = card;
    const pal = RARITY_PALETTE[rarity];
    const accent = pal.accent;
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
    // Branch colour channel: a bold spine down the left edge + a soft glow, so the
    // pick's build branch reads instantly, independent of the rarity body colour.
    bg.roundRect(8, 10, 6, cardH - 20, 3)
      .fill({ color: branchColor, alpha: highlighted || pressed ? 1 : 0.92 });
    bg.roundRect(8, 10, 6, cardH - 20, 3)
      .stroke({ color: 0x05070a, width: 1, alpha: 0.6 });
    bg.rect(12, 43, cardW - 24, 1).fill({ color: accent, alpha: 0.62 });
    // Decluttered: dropped the lower divider line + decorative rivet — the emblem
    // watermark now carries the lower half of the card.
    emblem.alpha = emblem.texture && emblem.texture !== Texture.EMPTY
      ? (highlighted || pressed ? 0.22 : 0.14)
      : 0;

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
    // Branch emblem watermark — a big, soft, blurred build icon sitting under the text,
    // clipped to the card. Reads "what build branch is this" at a glance.
    const emblem = new Sprite(Texture.EMPTY);
    emblem.anchor.set(0.5);
    emblem.alpha = 0;
    // No blur filter — BlurFilter on a masked sprite crashed the Pixi render pass on some
    // mobile GPUs (froze the game with no error banner). The low-alpha emblem reads fine raw.
    const emblemMask = new Graphics();
    emblem.mask = emblemMask;
    const shine = new Graphics();
    const badge = new Graphics();
    const rarityText = new Text({ text: '', style: rarityStyle });
    const categoryText = new Text({ text: '', style: labelStyle });
    const branchText = new Text({ text: '', style: branchTextStyle.clone() });
    const titleText = new Text({ text: '', style: cardTitleStyle });
    const descText = new Text({ text: '', style: cardDescStyle });
    const pickText = new Text({ text: 'ВЫБРАТЬ', style: pickStyle });

    btn.addChild(bg, emblem, emblemMask, shine, badge, categoryText, rarityText, branchText, titleText, descText, pickText);

    const card: CardHandle = {
      container: btn,
      bg,
      emblem,
      emblemMask,
      shine,
      badge,
      rarityText,
      categoryText,
      branchText,
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
      branchColor: 0xffffff,
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

  // === Run controls: Reroll + Skip (shown only in «Забег», via show(choices, run)) ===
  function makePillButton(label: string, accent: number, onTap: () => void) {
    const btn = new Container();
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.visible = false;
    const bg = new Graphics();
    const txt = new Text({
      text: label,
      style: new TextStyle({
        fontFamily: 'monospace',
        fontSize: 14,
        fill: accent,
        fontWeight: 'bold',
        letterSpacing: 1,
        stroke: { color: 0x05080e, width: 3 },
      }),
    });
    const W = 230;
    const H = 46;
    const redraw = (hover: boolean) => {
      bg.clear()
        .roundRect(-W / 2, -H / 2, W, H, 9)
        .fill({ color: 0x0c1420, alpha: hover ? 0.92 : 0.78 })
        .stroke({ color: accent, width: hover ? 3 : 2, alpha: hover ? 1 : 0.82 });
    };
    redraw(false);
    btn.addChild(bg, txt);
    btn.on('pointerover', () => { btn.scale.set(1.04); redraw(true); });
    btn.on('pointerout', () => { btn.scale.set(1.0); redraw(false); });
    btn.on('pointerdown', onTap);
    return {
      container: btn,
      width: W,
      setLabel(next: string) {
        txt.text = next;
        txt.x = -txt.width / 2;
        txt.y = -txt.height / 2 - 1;
      },
      setAccent(next: number) {
        txt.style.fill = next;
        redraw(false);
      },
      reposition() {
        txt.x = -txt.width / 2;
        txt.y = -txt.height / 2 - 1;
      },
    };
  }

  const rerollBtn = makePillButton('ПЕРЕБРОС', 0x6ee0a0, () => opts.onReroll?.());
  const skipBtn = makePillButton('ПРОПУСТИТЬ', 0xc8b48a, () => opts.onSkip?.());
  rerollBtn.reposition();
  skipBtn.reposition();
  c.addChild(rerollBtn.container, skipBtn.container);

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
      card.titleText.style.wordWrapWidth = bounds.width - 40;
      card.descText.style.wordWrapWidth = bounds.width - 40;
      card.titleText.style.fontSize = bounds.width < 230 ? 17 : 20;
      card.descText.style.fontSize = bounds.width < 230 ? 13 : 14;
      card.rarityText.style.fontSize = bounds.width < 230 ? 8 : 9;
      card.categoryText.x = 27;
      card.categoryText.y = 16;
      card.badge.x = 22;
      card.badge.y = 12;
      card.rarityText.x = bounds.width - card.rarityText.width - 16;
      card.rarityText.y = 16;
      card.branchText.style.fontSize = bounds.width < 230 ? 8 : 9;
      card.branchText.y = 30;
      card.branchText.x = bounds.width - card.branchText.width - 16;
      card.titleText.x = 22;
      card.titleText.y = 55;
      card.descText.x = 22;
      card.descText.y = 106;
      card.pickText.x = 22;
      card.pickText.y = bounds.height - 30;
      // Emblem watermark: large, sitting low-right, clipped to the inner card.
      const emSize = Math.min(bounds.width, bounds.height) * 1.02;
      if (card.emblem.texture && card.emblem.texture !== Texture.EMPTY) {
        const tw = card.emblem.texture.width || 1;
        const th = card.emblem.texture.height || 1;
        const scale = emSize / Math.max(tw, th);
        card.emblem.scale.set(scale);
      }
      card.emblem.x = bounds.width - emSize * 0.34;
      card.emblem.y = bounds.height - emSize * 0.36;
      card.emblemMask.clear()
        .roundRect(4, 4, bounds.width - 8, bounds.height - 8, 6)
        .fill({ color: 0xffffff });
      if (!c.visible) {
        card.container.x = bounds.x;
        card.container.y = bounds.y;
      }
      drawCard(card, false);
    });

    // Run controls sit centred just below the card row.
    const firstCard = cardLayout.cards[0]!;
    const rowBottom = firstCard.y + firstCard.height / 2;
    const ctrlY = Math.min(h - 34, rowBottom + 40);
    const gap = 18;
    const totalW = rerollBtn.width + skipBtn.width + gap;
    rerollBtn.container.x = w / 2 - totalW / 2 + rerollBtn.width / 2;
    skipBtn.container.x = w / 2 + totalW / 2 - skipBtn.width / 2;
    rerollBtn.container.y = ctrlY;
    skipBtn.container.y = ctrlY;
  }
  layout(width, height);

  return {
    container: c,
    show(choices: readonly UpgradeDef[], run?: LevelUpRunControls) {
      c.visible = true;
      if (run) {
        subtitle.text = 'Поставь модуль, перебрось выдачу или пропусти ради темпа';
        rerollBtn.container.visible = run.rerollsRemaining > 0;
        rerollBtn.setLabel(`ПЕРЕБРОС (${run.rerollsRemaining})`);
        rerollBtn.reposition();
        skipBtn.container.visible = true;
      } else {
        subtitle.text = 'Установи один модуль перед следующей волной';
        rerollBtn.container.visible = false;
        skipBtn.container.visible = false;
      }
      cards.forEach((card, i) => {
        const upgrade = choices[i];
        if (upgrade) {
          const branch = branchStyleForUpgradeId(upgrade.id);
          card.currentId = upgrade.id;
          card.rarity = rarityForUpgrade(upgrade);
          card.branchColor = branch.color;
          const emblemTex = opts.branchEmblems?.[branch.branch];
          card.emblem.texture = emblemTex ?? Texture.EMPTY;
          card.emblem.visible = !!emblemTex;
          // Re-fit the emblem to this card now that it has a real texture.
          if (emblemTex) {
            const emSize = Math.min(card.width, card.height) * 1.02;
            const scale = emSize / Math.max(emblemTex.width || 1, emblemTex.height || 1);
            card.emblem.scale.set(scale);
          }
          card.pressed = false;
          card.categoryText.text = categoryLabel(upgrade.category);
          card.rarityText.text = rarityLabel(card.rarity);
          card.branchText.text = branch.label;
          card.branchText.style.fill = branch.color;
          card.titleText.text = upgrade.title;
          card.descText.text = upgrade.description;
          card.pickText.text = upgrade.isEvolution ? 'СТАВИТЬ ЭВОЛЮЦИЮ' : 'СТАВИТЬ МОДУЛЬ';
          card.rarityText.x = card.width - card.rarityText.width - 16;
          card.branchText.x = card.width - card.branchText.width - 16;
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
      rerollBtn.container.visible = false;
      skipBtn.container.visible = false;
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
