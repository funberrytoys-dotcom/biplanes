import { Container, BlurFilter } from 'pixi.js';

export interface GlowLayerHandle {
  container: Container;
}

/**
 * Container that gets bloom-style soft glow via BlurFilter + additive blend on children.
 * Children rendered into this layer should set their own blendMode = 'add' on Graphics
 * to get the additive contribution; the BlurFilter provides the soft halo.
 */
export function createGlowLayer(): GlowLayerHandle {
  const c = new Container();
  // strength: how soft the halo is. quality: number of blur passes.
  // quality=2 is the sweet spot — quality=4 doubles GPU cost for marginal softness gain.
  const blur = new BlurFilter({ strength: 5, quality: 2 });
  c.filters = [blur];
  return { container: c };
}
