import { Container } from 'pixi.js';

export interface GlowLayerHandle {
  container: Container;
}

/**
 * Container for additive bloom-style FX (tracers, muzzle flashes, fire/spark particles).
 *
 * NOTE (freeze fix, 2026-06-23): NO BlurFilter here. A BlurFilter on this container forces
 * an offscreen render-target the size of the FX content bounds — and the arena world is 3×
 * (≈5760×3240), so as bullets/FX scatter the target exceeds the GPU's max texture size and
 * the Pixi render pass throws → the game freezes ("стабильно зависает на 4-м раунде").
 * This bit twice. Instead the children glow with their OWN additive blend (blendMode='add')
 * + layered soft halos (see bullet-tracer.ts / muzzle-flash.ts) — a filter-free bloom that
 * can't crash. If a softer bloom is ever wanted, bake it into a PRE-blurred sprite/texture,
 * never a runtime BlurFilter on this layer.
 */
export function createGlowLayer(): GlowLayerHandle {
  const c = new Container();
  return { container: c };
}
