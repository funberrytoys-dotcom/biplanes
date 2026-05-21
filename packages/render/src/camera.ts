import { Container } from 'pixi.js';
import type { Plane } from '@biplanes/core';

/**
 * Camera that no longer follows the player (single-screen game) but still owns
 * the shake offset for hit feedback. The world layer's base x/y are set by the
 * app's letterbox layout — we apply shake as an offset on top.
 *
 * Use {@link setBase} after the layout step to record the un-shaken position.
 */
export function createCamera(worldRoot: Container, screenW: number, screenH: number) {
  let shakeAmount = 0;
  const SHAKE_CAP = 6;
  const SHAKE_DECAY = 0.7;
  let baseX = worldRoot.x;
  let baseY = worldRoot.y;

  return {
    /** No-op kept for API compat — camera does not follow in single-screen mode. */
    follow(_player: Plane) {
      // intentionally empty
    },
    /** Record the post-layout (un-shaken) world position. Call after layoutWorld(). */
    setBase(x: number, y: number) {
      baseX = x;
      baseY = y;
    },
    /** Apply per-frame shake jitter on top of the base position. */
    tickShake() {
      if (shakeAmount > 0.1) {
        worldRoot.x = baseX + (Math.random() - 0.5) * shakeAmount;
        worldRoot.y = baseY + (Math.random() - 0.5) * shakeAmount;
        shakeAmount *= SHAKE_DECAY;
      } else {
        worldRoot.x = baseX;
        worldRoot.y = baseY;
      }
    },
    shake(amount: number) { shakeAmount = Math.min(SHAKE_CAP, Math.max(shakeAmount, amount)); },
    setScreen(w: number, h: number) { screenW = w; screenH = h; },
  };
}
