import { Container } from 'pixi.js';
import type { Plane } from '@biplanes/core';

/**
 * Camera for the single-screen game. Owns shake, directional punch, and a
 * short-lived zoom punch (ease-out) on top of the layout-driven base position.
 *
 * Call {@link setBase} after the letterbox layout to record the un-shaken
 * world-root position. Each frame call {@link tickShake} to apply offsets.
 */
export function createCamera(worldRoot: Container, screenW: number, screenH: number) {
  let shakeAmount = 0;
  let punchVX = 0;
  let punchVY = 0;
  let zoomFrom = 1;
  let zoomTo = 1;
  let zoomTime = 0;
  let zoomDur = 0;
  const SHAKE_CAP = 12;
  let baseX = worldRoot.x;
  let baseY = worldRoot.y;
  let baseScale = worldRoot.scale.x;

  return {
    /** No-op kept for API compat — camera does not follow in single-screen mode. */
    follow(_p: Plane) {
      // intentionally empty
    },
    /** Record the post-layout (un-shaken) world position and scale. */
    setBase(x: number, y: number) {
      baseX = x;
      baseY = y;
      baseScale = worldRoot.scale.x;
    },
    /** Apply per-frame shake jitter, punch decay, and zoom-punch ease-out. */
    tickShake() {
      if (shakeAmount > 0.05) {
        worldRoot.x = baseX + (Math.random() - 0.5) * shakeAmount + punchVX;
        worldRoot.y = baseY + (Math.random() - 0.5) * shakeAmount + punchVY;
        shakeAmount *= Math.pow(0.55, 1 / 60);
        punchVX *= 0.7;
        punchVY *= 0.7;
      } else {
        worldRoot.x = baseX + punchVX;
        worldRoot.y = baseY + punchVY;
        punchVX *= 0.7;
        punchVY *= 0.7;
        if (Math.abs(punchVX) < 0.05 && Math.abs(punchVY) < 0.05) {
          punchVX = 0;
          punchVY = 0;
        }
      }
      if (zoomTime > 0) {
        zoomTime -= 1 / 60;
        const t = Math.max(0, zoomTime / zoomDur);
        const ease = 1 - (1 - t) * (1 - t);
        const z = zoomFrom + (zoomTo - zoomFrom) * ease;
        worldRoot.scale.set(z);
      } else if (worldRoot.scale.x !== baseScale) {
        worldRoot.scale.set(baseScale);
      }
    },
    shake(amount: number) {
      shakeAmount = Math.min(SHAKE_CAP, Math.max(shakeAmount, amount));
    },
    punch(dirX: number, dirY: number, amount: number) {
      const len = Math.hypot(dirX, dirY) || 1;
      punchVX = (dirX / len) * amount;
      punchVY = (dirY / len) * amount;
    },
    zoomPunch(targetMultiplier: number, durSec: number) {
      zoomFrom = baseScale * targetMultiplier;
      zoomTo = baseScale;
      zoomTime = durSec;
      zoomDur = durSec;
    },
    setScreen(w: number, h: number) {
      screenW = w;
      screenH = h;
    },
  };
}
