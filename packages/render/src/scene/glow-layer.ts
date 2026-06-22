import { Container } from 'pixi.js';

export interface GlowLayerHandle {
  container: Container;
}

/**
 * Container for additive bloom-style FX (fire/spark/shockwave particles, muzzle
 * flashes, bullet tracers). Children set their own `blendMode = 'add'` on their
 * Graphics to get the additive glow contribution.
 *
 * NOTE (freeze fix, 2026-06-23): a `BlurFilter` used to sit on this container to
 * soften the halo. It was REMOVED. A filter on a full-screen, heavily-animated
 * container forces an offscreen render-target re-tessellated every frame, which
 * is the same mobile-GPU crash class that already froze the game once (the masked
 * emblem BlurFilter, commit a6aa08a). A throw in the render pass freezes the
 * visible game while rAF keeps re-arming ("engines spin, everything else frozen").
 * The additive blend alone still reads as a glow; if a softer bloom is wanted
 * later, do it with a PRE-blurred sprite/texture, not a runtime BlurFilter.
 */
export function createGlowLayer(): GlowLayerHandle {
  const c = new Container();
  return { container: c };
}
