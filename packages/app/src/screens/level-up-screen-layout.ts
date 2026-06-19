import type { UpgradeDef } from '@biplanes/core';

// RPG-style rarity ladder. The card is COLOURED by rarity; the module TYPE
// (КОРПУС/ОРУЖИЕ/СИСТЕМА/ВЕДОМЫЙ) stays in the left-hand category label.
export type UpgradeRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export interface RarityPalette {
  accent: number;   // border / highlights
  secondary: number; // rivets / minor accents
  fill: number;     // card body
  deep: number;     // inner panel
  label: string;    // shown top-right
}

export const RARITY_PALETTE: Record<UpgradeRarity, RarityPalette> = {
  common:    { accent: 0x5fd98a, secondary: 0x2e7a4d, fill: 0x0e2417, deep: 0x163420, label: 'ОБЫЧНЫЙ' },
  uncommon:  { accent: 0x55b9ff, secondary: 0x2f6f9e, fill: 0x0d1f30, deep: 0x163148, label: 'НЕОБЫЧНЫЙ' },
  rare:      { accent: 0xb070ff, secondary: 0x6a3fa6, fill: 0x1b1233, deep: 0x281a47, label: 'РЕДКИЙ' },
  epic:      { accent: 0xff944a, secondary: 0xb45a23, fill: 0x2a160a, deep: 0x3d2210, label: 'ЭПИЧЕСКИЙ' },
  legendary: { accent: 0xffd24a, secondary: 0xc09322, fill: 0x2b2206, deep: 0x40340b, label: 'ЛЕГЕНДА' },
  mythic:    { accent: 0xff5570, secondary: 0xb33050, fill: 0x2e0d1a, deep: 0x451327, label: 'МИФИЧЕСКИЙ' },
};

// Per-upgrade rarity. Evolutions are always mythic (handled below).
const RARITY_BY_ID: Record<string, UpgradeRarity> = {
  damage_plus_25: 'common', fire_rate_plus_25: 'common', hp_plus_25: 'common',
  magnet_range_plus: 'common', tracer_belt: 'common', coolant_injector: 'common',
  boost_supercharger: 'common', reinforced_struts: 'common',
  damage_plus_50: 'uncommon', fire_rate_plus_50: 'uncommon', hp_plus_50: 'uncommon',
  multishot: 'uncommon', lifesteal: 'uncommon', quick_salvo: 'uncommon',
  piercing_bullets: 'rare', heavy_bomb: 'rare', cluster_bomb: 'rare', drone_wingman: 'rare',
  heavy_cannon: 'epic', flame_trail: 'epic',
  homing_rocket: 'legendary', wing_rockets: 'legendary',
};

export interface LevelUpCardBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LevelUpCardLayout {
  titleY: number;
  cards: LevelUpCardBounds[];
}

export function resolveLevelUpCardLayout(width: number, height: number, count: number): LevelUpCardLayout {
  const safeX = Math.max(18, Math.min(42, width * 0.035));
  const gap = Math.max(12, Math.min(24, width * 0.022));
  const compactPhone = width > height && height <= 520;
  const titleY = compactPhone ? Math.max(12, Math.min(28, height * 0.045)) : Math.max(18, Math.min(54, height * 0.08));
  const availableW = width - safeX * 2 - gap * Math.max(0, count - 1);
  const cardW = Math.max(196, Math.min(compactPhone ? 292 : 284, availableW / Math.max(1, count)));
  const cardH = Math.max(170, Math.min(compactPhone ? 226 : 204, height * (compactPhone ? 0.5 : 0.44)));
  const totalW = cardW * count + gap * Math.max(0, count - 1);
  const startX = (width - totalW) / 2 + cardW / 2;
  const y = Math.min(height - cardH / 2 - (compactPhone ? 18 : 26), Math.max(titleY + (compactPhone ? 92 : 98), height * (compactPhone ? 0.59 : 0.56)));

  return {
    titleY,
    cards: Array.from({ length: count }, (_, i) => ({
      x: startX + i * (cardW + gap),
      y,
      width: cardW,
      height: cardH,
    })),
  };
}

export function rarityForUpgrade(upgrade: UpgradeDef): UpgradeRarity {
  if (upgrade.isEvolution) return 'mythic';
  return RARITY_BY_ID[upgrade.id] ?? 'common';
}

export function rarityLabel(rarity: UpgradeRarity): string {
  return RARITY_PALETTE[rarity].label;
}

export function categoryLabel(category: UpgradeDef['category']): string {
  switch (category) {
    case 'weapon':
      return 'ОРУЖИЕ';
    case 'plane':
      return 'КОРПУС';
    case 'passive':
      return 'СИСТЕМА';
    case 'companion':
      return 'ВЕДОМЫЙ';
  }
}
