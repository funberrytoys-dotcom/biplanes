import type { UpgradeDef } from '@biplanes/core';

export type UpgradeRarity = 'standard' | 'ace';

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
  return upgrade.isEvolution ? 'ace' : 'standard';
}

export function rarityLabel(rarity: UpgradeRarity): string {
  return rarity === 'ace' ? 'ACE EVOLUTION' : 'FIELD MOD';
}

export function categoryLabel(category: UpgradeDef['category']): string {
  switch (category) {
    case 'weapon':
      return 'WEAPON';
    case 'plane':
      return 'AIRFRAME';
    case 'passive':
      return 'SYSTEM';
    case 'companion':
      return 'WINGMAN';
  }
}
