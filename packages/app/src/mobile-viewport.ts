export interface MobileViewportInfo {
  readonly isPhoneLike: boolean;
  readonly isLandscape: boolean;
  readonly combatZoom: number;
  readonly storyZoom: number;
}

export function getMobileViewportInfo(width: number, height: number): MobileViewportInfo {
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);
  const isPhoneLike = shortSide <= 520 && longSide <= 1100;
  const isLandscape = width > height;
  const heightPressure = Math.max(0, 430 - height) / 430;
  return {
    isPhoneLike,
    isLandscape,
    combatZoom: isPhoneLike && isLandscape ? 1.38 : 1,
    storyZoom: isPhoneLike && isLandscape ? Math.max(0.88, 1.08 - heightPressure * 0.14) : 1.55,
  };
}

export function fitMobileZoom(baseZoom: number, info: MobileViewportInfo): number {
  if (!info.isPhoneLike || !info.isLandscape) return baseZoom;
  return Math.max(baseZoom, info.combatZoom);
}
