import { Container, Graphics, Text, TextStyle, Sprite, Texture } from 'pixi.js';
import type { PerkRarity, PerkCategory, PerkTier } from '@biplanes/core';
import { resolveLevelUpCardLayout } from './level-up-screen-layout.js';
import { rarityStyle, PERK_CATEGORY_LABEL, PERK_TIER_LABEL } from './perk-style.js';

/** View-model for one perk card (host maps a PerkDef → this). */
export interface PerkCardVM {
  id: string;
  name: string;
  rarity: PerkRarity;
  category: PerkCategory;
  tier: PerkTier;
  icon: string;            // PNG filename in the perk-icons folder
  human: string;           // player-facing description
  synergies: { name: string; owned: boolean }[];
}

export type PerkPickMode =
  | { kind: 'wave'; rerollsRemaining: number }
  | { kind: 'core' }
  | { kind: 'bonus' };

export interface PerkPickScreenOpts {
  onReroll?: () => void;
  onSkip?: () => void;
  /** Resolve a perk icon filename to a Pixi texture (host wires assetUrl + Texture.from). */
  resolveIcon: (iconFile: string) => Texture;
}

/**
 * The new 32-perk pick screen. Renders icon-hero cards coloured by the 5-rarity ladder,
 * with category/tier chips and synergy highlights. Used both for the per-wave «1 из 3»
 * pick (with reroll/skip) and the run-start «выбор стартового ядра» (no controls).
 *
 * Kept deliberately filter-free (no BlurFilter — it froze the Pixi render on some mobile
 * GPUs). Plain sprites/graphics/text only.
 */
export function createPerkPickScreen(
  width: number,
  height: number,
  onPick: (id: string) => void,
  opts: PerkPickScreenOpts,
) {
  const c = new Container();
  c.visible = false;
  c.eventMode = 'static';

  const dim = new Graphics();
  const vignette = new Graphics();
  c.addChild(dim, vignette);

  const titleStyle = new TextStyle({
    fontFamily: 'Georgia, serif', fontSize: 26, fill: 0xf7d69a, fontWeight: 'bold',
    stroke: { color: 0x1a0f08, width: 3 },
  });
  const subtitleStyle = new TextStyle({ fontFamily: 'monospace', fontSize: 12, fill: 0x9fb5c4 });
  const title = new Text({ text: 'ВОЗДУШНАЯ МАСТЕРСКАЯ', style: titleStyle });
  const subtitle = new Text({ text: '', style: subtitleStyle });
  c.addChild(title, subtitle);

  const chipStyle = new TextStyle({ fontFamily: 'monospace', fontSize: 9, fill: 0x0d141a, fontWeight: 'bold' });
  const rarityTextStyle = new TextStyle({
    fontFamily: 'monospace', fontSize: 9, fill: 0xffe7ad, fontWeight: 'bold',
    stroke: { color: 0x120804, width: 2 },
  });
  const nameStyle = new TextStyle({
    fontFamily: 'Georgia, serif', fontSize: 18, fill: 0xffe0a4, fontWeight: 'bold',
    wordWrap: true, wordWrapWidth: 220, stroke: { color: 0x180e08, width: 2 },
  });
  const descStyle = new TextStyle({
    fontFamily: 'Arial, sans-serif', fontSize: 12, fill: 0xd6e2e7,
    wordWrap: true, wordWrapWidth: 220, lineHeight: 16,
  });
  const synStyle = new TextStyle({ fontFamily: 'monospace', fontSize: 10, fill: 0x8fa6b4, wordWrap: true, wordWrapWidth: 220 });
  const pickStyle = new TextStyle({ fontFamily: 'monospace', fontSize: 11, fill: 0x0d141a, fontWeight: 'bold' });

  interface CardHandle {
    container: Container;
    bg: Graphics;
    iconRing: Graphics;
    icon: Sprite;
    catChip: Graphics; catText: Text;
    tierText: Text;
    rarityText: Text;
    nameText: Text;
    descText: Text;
    synText: Text;
    pickText: Text;
    currentId: string;
    accent: number;
    bodyFill: number; bodyDeep: number;
    width: number; height: number;
    targetX: number; targetY: number;
    animTimer: number;
    pressed: boolean;
  }

  const cards: CardHandle[] = [];

  function drawCard(card: CardHandle, highlighted: boolean) {
    const { bg, iconRing, width: cw, height: ch, accent } = card;
    const edge = highlighted || card.pressed ? 0xfff0bd : accent;
    bg.clear();
    bg.roundRect(0, 0, cw, ch, 9).fill({ color: card.bodyFill, alpha: highlighted ? 0.98 : 0.95 })
      .stroke({ color: 0x05070a, width: 5, alpha: 0.98 });
    bg.roundRect(4, 4, cw - 8, ch - 8, 7).fill({ color: card.bodyDeep, alpha: 0.5 });
    bg.roundRect(5, 5, cw - 10, ch - 10, 7).stroke({ color: edge, width: highlighted || card.pressed ? 3 : 2, alpha: 0.92 });
    // Icon halo ring (rarity-tinted) behind the hero icon.
    const iconCx = cw / 2;
    const iconCy = 14 + (ch * 0.34) / 2 + 8;
    const r = Math.min(cw * 0.34, ch * 0.22);
    iconRing.clear()
      .circle(iconCx, iconCy, r + 6).fill({ color: accent, alpha: highlighted ? 0.22 : 0.13 })
      .circle(iconCx, iconCy, r + 6).stroke({ color: accent, width: 1.5, alpha: 0.5 });
  }

  for (let i = 0; i < 5; i++) {
    const btn = new Container();
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    const bg = new Graphics();
    const iconRing = new Graphics();
    const icon = new Sprite(Texture.EMPTY);
    icon.anchor.set(0.5);
    const catChip = new Graphics();
    const catText = new Text({ text: '', style: chipStyle });
    const tierText = new Text({ text: '', style: chipStyle.clone() });
    const rarityText = new Text({ text: '', style: rarityTextStyle });
    const nameText = new Text({ text: '', style: nameStyle });
    const descText = new Text({ text: '', style: descStyle });
    const synText = new Text({ text: '', style: synStyle });
    const pickText = new Text({ text: 'ВЫБРАТЬ', style: pickStyle });
    btn.addChild(bg, iconRing, icon, catChip, catText, tierText, rarityText, nameText, descText, synText, pickText);

    const card: CardHandle = {
      container: btn, bg, iconRing, icon, catChip, catText, tierText, rarityText,
      nameText, descText, synText, pickText,
      currentId: '', accent: 0x5fd98a, bodyFill: 0x0e2417, bodyDeep: 0x163420,
      width: 240, height: 250, targetX: 0, targetY: 0, animTimer: 0, pressed: false,
    };

    btn.on('pointerover', () => { btn.scale.set(1.03); drawCard(card, true); });
    btn.on('pointerout', () => { card.pressed = false; btn.scale.set(1.0); drawCard(card, false); });
    btn.on('pointerdown', () => {
      card.pressed = true; btn.scale.set(0.985); drawCard(card, true);
      if (card.currentId) onPick(card.currentId);
    });
    btn.on('pointerupoutside', () => { card.pressed = false; btn.scale.set(1.0); drawCard(card, false); });

    cards.push(card);
    c.addChild(btn);
  }

  // --- Reroll / Skip pills (wave mode only) ---
  function makePill(label: string, accent: number, onTap: () => void) {
    const btn = new Container();
    btn.eventMode = 'static'; btn.cursor = 'pointer'; btn.visible = false;
    const bg = new Graphics();
    const txt = new Text({ text: label, style: new TextStyle({
      fontFamily: 'monospace', fontSize: 14, fill: accent, fontWeight: 'bold',
      stroke: { color: 0x05080e, width: 3 },
    }) });
    const W = 220, H = 44;
    const redraw = (hover: boolean) => {
      bg.clear().roundRect(-W / 2, -H / 2, W, H, 9)
        .fill({ color: 0x0c1420, alpha: hover ? 0.92 : 0.78 })
        .stroke({ color: accent, width: hover ? 3 : 2, alpha: hover ? 1 : 0.82 });
    };
    redraw(false);
    btn.addChild(bg, txt);
    btn.on('pointerover', () => { btn.scale.set(1.04); redraw(true); });
    btn.on('pointerout', () => { btn.scale.set(1.0); redraw(false); });
    btn.on('pointerdown', onTap);
    const reposition = () => { txt.x = -txt.width / 2; txt.y = -txt.height / 2 - 1; };
    reposition();
    return { container: btn, width: W, setLabel(s: string) { txt.text = s; reposition(); }, reposition };
  }
  const rerollBtn = makePill('ПЕРЕБРОС', 0x6ee0a0, () => opts.onReroll?.());
  const skipBtn = makePill('ПРОПУСТИТЬ', 0xc8b48a, () => opts.onSkip?.());
  c.addChild(rerollBtn.container, skipBtn.container);

  function layoutCard(card: CardHandle) {
    const cw = card.width, ch = card.height;
    const iconCx = cw / 2;
    const iconRegionH = ch * 0.34;
    const iconCy = 14 + iconRegionH / 2 + 8;
    const tex = card.icon.texture;
    if (tex && tex !== Texture.EMPTY && (tex.width || 0) > 1) {
      const target = Math.min(cw * 0.62, iconRegionH * 1.5);
      card.icon.scale.set(target / Math.max(tex.width, tex.height));
    } else {
      card.icon.scale.set(0); // texture not loaded yet; update() sizes it once it resolves
    }
    card.icon.x = iconCx; card.icon.y = iconCy;
    // top-left category chip + tier text
    card.catChip.x = 12; card.catChip.y = 10;
    card.catText.x = 18; card.catText.y = 13;
    card.tierText.x = 12; card.tierText.y = 26;
    card.rarityText.x = cw - card.rarityText.width - 12; card.rarityText.y = 12;
    const textTop = 14 + iconRegionH + 18;
    card.nameText.style.wordWrapWidth = cw - 28;
    card.descText.style.wordWrapWidth = cw - 28;
    card.synText.style.wordWrapWidth = cw - 28;
    card.nameText.x = 14; card.nameText.y = textTop;
    card.descText.x = 14; card.descText.y = textTop + 30;
    card.synText.x = 14; card.synText.y = ch - 52;
    card.pickText.x = 14; card.pickText.y = ch - 24;
  }

  function layout(w: number, h: number) {
    dim.clear().rect(0, 0, w, h).fill({ color: 0x08090d, alpha: 0.7 });
    vignette.clear()
      .rect(0, 0, w, h * 0.2).fill({ color: 0x000000, alpha: 0.34 })
      .rect(0, h * 0.78, w, h * 0.22).fill({ color: 0x000000, alpha: 0.34 });

    const count = cards.filter((c2) => c2.container.visible).length || 3;
    const cardLayout = resolveLevelUpCardLayout(w, h, count);
    title.style.fontSize = Math.max(20, Math.min(30, w * 0.03));
    title.x = (w - title.width) / 2; title.y = cardLayout.titleY;
    subtitle.x = (w - subtitle.width) / 2; subtitle.y = title.y + title.height + 2;

    let vi = 0;
    cards.forEach((card) => {
      if (!card.container.visible) return;
      const bounds = cardLayout.cards[vi]!;
      vi++;
      // give perk cards extra height for the icon (clamped ≥120 so a degenerate tiny
      // viewport can't produce negative roundRect geometry)
      card.width = bounds.width;
      card.height = Math.max(120, Math.min(h - 40, bounds.height + 56));
      card.container.pivot.set(card.width / 2, card.height / 2);
      card.targetX = bounds.x; card.targetY = Math.min(h - card.height / 2 - 16, bounds.y + 20);
      layoutCard(card);
      drawCard(card, false);
      if (!c.visible) { card.container.x = card.targetX; card.container.y = card.targetY; }
    });

    const firstVisible = cards.find((c2) => c2.container.visible);
    const ctrlY = Math.min(h - 30, (firstVisible ? firstVisible.targetY + firstVisible.height / 2 : h * 0.8) + 34);
    const gap = 16;
    const totalW = rerollBtn.width + skipBtn.width + gap;
    rerollBtn.container.x = w / 2 - totalW / 2 + rerollBtn.width / 2;
    skipBtn.container.x = w / 2 + totalW / 2 - skipBtn.width / 2;
    rerollBtn.container.y = ctrlY; skipBtn.container.y = ctrlY;
  }
  layout(width, height);

  return {
    container: c,
    show(perks: readonly PerkCardVM[], mode: PerkPickMode) {
      c.visible = true;
      const isCore = mode.kind === 'core';
      title.text = mode.kind === 'core' ? 'ВЫБЕРИ СТАРТОВОЕ ЯДРО'
        : mode.kind === 'bonus' ? 'БОНУСНАЯ КАРТА' : 'ВОЗДУШНАЯ МАСТЕРСКАЯ';
      subtitle.text = mode.kind === 'core'
        ? 'С этого начнётся твой билд — ядро даётся бесплатно и открывает ветку'
        : mode.kind === 'bonus' ? 'Бонусная карта — лови прямо в бою'
        : 'Поставь модуль, перебрось выдачу или пропусти ради темпа';
      rerollBtn.container.visible = mode.kind === 'wave' && mode.rerollsRemaining > 0;
      skipBtn.container.visible = mode.kind === 'wave';
      if (mode.kind === 'wave') { rerollBtn.setLabel(`ПЕРЕБРОС (${mode.rerollsRemaining})`); }

      cards.forEach((card, i) => {
        const vm = perks[i];
        if (!vm) { card.container.visible = false; return; }
        const rs = rarityStyle(vm.rarity);
        card.currentId = vm.id;
        card.accent = rs.accent;
        card.bodyFill = rs.fill; card.bodyDeep = rs.deep;
        card.pressed = false;
        card.icon.texture = opts.resolveIcon(vm.icon);
        card.icon.visible = true;
        card.catText.text = PERK_CATEGORY_LABEL[vm.category];
        card.tierText.text = PERK_TIER_LABEL[vm.tier];
        card.tierText.style.fill = rs.accent;
        card.rarityText.text = rs.label;
        card.nameText.text = vm.name;
        card.descText.text = vm.human;
        const ownedCount = vm.synergies.filter((s) => s.owned).length;
        card.synText.text = vm.synergies.length
          ? `СИНЕРГИЯ ${ownedCount}/${vm.synergies.length}: ${vm.synergies.map((s) => s.name).join(' · ')}`
          : '';
        card.synText.style.fill = ownedCount > 0 ? rs.accent : 0x6b7c89;
        card.pickText.text = isCore ? 'ВЗЯТЬ ЯДРО' : 'ВЫБРАТЬ';
        // category chip background
        card.catChip.clear().roundRect(0, 0, Math.min(82, card.width - 24), 18, 5)
          .fill({ color: rs.accent, alpha: 0.95 });
        card.container.visible = true;
        card.animTimer = -i * 0.1;
        card.container.alpha = 0;
      });
      layout(width, height);
      // re-fit icons now that textures are set
      cards.forEach((card) => { if (card.container.visible) layoutCard(card); });
      cards.forEach((card) => {
        if (!card.container.visible) return;
        card.container.x = card.targetX;
        card.container.y = card.targetY + 60;
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
        if (!card.container.visible) continue;
        // Re-fit the icon once its async (Texture.from) texture resolves — sizing against an
        // unloaded 1×1 texture would otherwise leave a giant icon covering the whole card.
        const tex = card.icon.texture;
        if (tex && tex !== Texture.EMPTY && (tex.width || 0) > 1 && card.icon.scale.x === 0) {
          const target = Math.min(card.width * 0.62, (card.height * 0.34) * 1.5);
          card.icon.scale.set(target / Math.max(tex.width, tex.height));
        }
        if (card.animTimer >= 1.0) continue;
        card.animTimer += dt * 4.2;
        if (card.animTimer > 0) {
          const t = Math.min(1.0, card.animTimer);
          const ease = 1 - Math.pow(1 - t, 3);
          card.container.y = card.targetY + 60 * (1 - ease);
          card.container.alpha = ease;
        }
      }
    },
    resize(w: number, h: number) { width = w; height = h; layout(w, h); },
  };
}
