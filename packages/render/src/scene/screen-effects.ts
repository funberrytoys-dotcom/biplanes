import { Container, Graphics, ColorMatrixFilter } from 'pixi.js';

export interface ScreenEffectsHandle {
  container: Container;
  flash(color: number, alpha: number, durSec: number): void;
  setVignette(vignettePct: number): void;
  enableDeathTint(): void;
  disableDeathTint(): void;
  update(dt: number, timeSec: number, worldRoot: Container): void;
  resize(w: number, h: number): void;
}

export function createScreenEffects(width: number, height: number): ScreenEffectsHandle {
  const c = new Container();

  let w = width;
  let h = height;

  const flashG = new Graphics().rect(0, 0, w, h).fill(0xffffff);
  flashG.alpha = 0;
  c.addChild(flashG);

  const vignetteG = new Graphics();
  const drawVignette = () => {
    vignetteG.clear();
    const edge = 80;
    vignetteG
      .rect(0, 0, w, edge).fill({ color: 0x550000, alpha: 1 })
      .rect(0, h - edge, w, edge).fill({ color: 0x550000, alpha: 1 })
      .rect(0, 0, edge, h).fill({ color: 0x550000, alpha: 1 })
      .rect(w - edge, 0, edge, h).fill({ color: 0x550000, alpha: 1 });
  };
  drawVignette();
  vignetteG.alpha = 0;
  c.addChild(vignetteG);

  const deathFilter = new ColorMatrixFilter();
  let deathTintActive = false;

  let flashLife = 0;
  let flashMaxLife = 0;
  let flashAlpha = 0;
  let baseVignette = 0;

  return {
    container: c,
    flash(color, alpha, durSec) {
      flashG.clear().rect(0, 0, w, h).fill(color);
      flashAlpha = alpha;
      flashLife = durSec;
      flashMaxLife = durSec;
    },
    setVignette(pct) {
      baseVignette = Math.max(0, Math.min(1, pct));
    },
    enableDeathTint() { deathTintActive = true; },
    disableDeathTint() { deathTintActive = false; },
    update(dt, timeSec, worldRoot) {
      if (flashLife > 0) {
        flashLife = Math.max(0, flashLife - dt);
        flashG.alpha = (flashLife / flashMaxLife) * flashAlpha;
      } else {
        flashG.alpha = 0;
      }
      const pulse = 0.8 + 0.2 * Math.sin(timeSec * 12);
      vignetteG.alpha = baseVignette * pulse;

      if (deathTintActive) {
        const hasFilter = Array.isArray(worldRoot.filters) && worldRoot.filters.includes(deathFilter);
        if (!hasFilter) {
          deathFilter.reset();
          deathFilter.saturate(-0.6, true);
          worldRoot.filters = [deathFilter];
        }
      } else if (Array.isArray(worldRoot.filters) && worldRoot.filters.includes(deathFilter)) {
        worldRoot.filters = null;
      }
    },
    resize(nw, nh) {
      w = nw;
      h = nh;
      drawVignette();
      flashG.clear().rect(0, 0, w, h).fill(0xffffff);
      flashG.alpha = 0;
    },
  };
}
