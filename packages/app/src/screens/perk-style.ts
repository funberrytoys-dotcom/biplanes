import type { PerkRarity, PerkCategory, PerkTier } from '@biplanes/core';

/**
 * Visual style for the new 32-perk run cards. Owner's fixed 5-colour rarity ladder:
 *   🟢 common · 🔵 rare · 🟣 epic · 🟡 legendary · 🔴 mythic («самые крутые»).
 * The card BODY + border are coloured by rarity; the category (Пушка/Ракеты/Звено/
 * Корпус/Пилотаж) and tier (Деталь/Модуль/Узел/Легенда) ride as text chips.
 */
export interface RarityStyle {
  accent: number;   // border / highlights
  fill: number;     // card body
  deep: number;     // inner panel
  label: string;    // shown top-right
}

export const PERK_RARITY_PALETTE: Record<PerkRarity, RarityStyle> = {
  common:    { accent: 0x5fd98a, fill: 0x0e2417, deep: 0x163420, label: 'ОБЫЧНЫЙ' },     // green
  rare:      { accent: 0x55b9ff, fill: 0x0d1f30, deep: 0x163148, label: 'РЕДКИЙ' },       // blue
  epic:      { accent: 0xb070ff, fill: 0x1b1233, deep: 0x281a47, label: 'ЭПИЧЕСКИЙ' },    // purple
  legendary: { accent: 0xffd24a, fill: 0x2b2206, deep: 0x40340b, label: 'ЛЕГЕНДАРНЫЙ' },  // gold
  mythic:    { accent: 0xff5570, fill: 0x2e0d1a, deep: 0x451327, label: 'МИФИЧЕСКИЙ' },    // red
};

export function rarityStyle(rarity: PerkRarity): RarityStyle {
  return PERK_RARITY_PALETTE[rarity] ?? PERK_RARITY_PALETTE.common;
}

export const PERK_CATEGORY_LABEL: Record<PerkCategory, string> = {
  gun: 'ПУШКА',
  rocket: 'РАКЕТЫ',
  squad: 'ЗВЕНО',
  hull: 'КОРПУС',
  aerobatics: 'ПИЛОТАЖ',
};

export const PERK_TIER_LABEL: Record<PerkTier, string> = {
  detail: 'ДЕТАЛЬ',
  module: 'МОДУЛЬ',
  node: 'УЗЕЛ',
  legend: 'ЛЕГЕНДА',
};
