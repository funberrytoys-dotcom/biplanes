import { Container } from 'pixi.js';
import type { Plane } from '@biplanes/core';
import { WORLD_WIDTH, WORLD_HEIGHT } from '@biplanes/shared';

/**
 * Camera for the game. Supports custom panning, dynamic focal point,
 * dynamic zoom leveling, shake, and zoom punches.
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
  let baseScale = worldRoot.scale.x;
  let worldWidth = WORLD_WIDTH;
  let worldHeight = WORLD_HEIGHT;

  const snapToPixel = (v: number) => Math.round(v);

  // Custom pan and focus targets
  let targetFocusX = WORLD_WIDTH / 2;
  let targetFocusY = WORLD_HEIGHT / 2;
  let currentFocusX = WORLD_WIDTH / 2;
  let currentFocusY = WORLD_HEIGHT / 2;

  let targetZoom = 1.0;
  let currentZoom = 1.0;

  return {
    /** Smoothly pans/zooms to standard or custom coordinates. */
    setFocus(x: number, y: number, zoom: number) {
      targetFocusX = x;
      targetFocusY = y;
      targetZoom = zoom;
    },
    /** Reset focus and zoom to center. */
    resetFocus() {
      targetFocusX = WORLD_WIDTH / 2;
      targetFocusY = WORLD_HEIGHT / 2;
      targetZoom = 1.0;
    },
    /** Jump current focus/zoom to the target immediately (no smoothing). */
    snap() {
      currentFocusX = targetFocusX;
      currentFocusY = targetFocusY;
      currentZoom = targetZoom;
    },
    setWorldWidth(w: number) {
      worldWidth = w;
    },
    setWorldSize(w: number, h: number) {
      worldWidth = w;
      worldHeight = h;
    },
    get currentFocusX() {
      return currentFocusX;
    },
    /** No-op kept for API compat. */
    follow(_p: Plane) {
      // intentionally empty
    },
    /** Record the post-layout (un-shaken) world position and scale. */
    setBase(_x: number, _y: number) {
      baseScale = worldRoot.scale.x;
    },
    /** Apply per-frame shake jitter, punch decay, and smooth camera focal tracking. */
    tickShake(dt: number) {
      // Smoothly interpolate focus point and zoom level using exponential decay
      const k = 1 - Math.pow(0.000003, dt); // camera damping factor
      currentFocusX += (targetFocusX - currentFocusX) * k;
      currentFocusY += (targetFocusY - currentFocusY) * k;
      currentZoom += (targetZoom - currentZoom) * k;

      // Check zoom punch
      let activeZoom = currentZoom;
      if (zoomTime > 0) {
        zoomTime -= dt;
        const t = Math.max(0, zoomTime / zoomDur);
        const ease = 1 - (1 - t) * (1 - t);
        const zMultiplier = (zoomFrom / baseScale) + ((zoomTo / baseScale) - (zoomFrom / baseScale)) * ease;
        activeZoom *= zMultiplier;
      }

      const scale = baseScale * activeZoom;

      // Clamp the focus on BOTH axes so the camera never looks past the backdrop
      // (no black bars), and so the focus can't overshoot the world edge and
      // shimmer against the clamp. If the world is smaller than the viewport on
      // an axis, center it. Clamp the live focus in place so the parallax getter
      // and the projection stay in agreement at the edges.
      const halfW = screenW / (2 * scale);
      const halfH = screenH / (2 * scale);
      currentFocusX = worldWidth > 2 * halfW
        ? Math.max(halfW, Math.min(worldWidth - halfW, currentFocusX))
        : worldWidth / 2;
      currentFocusY = worldHeight > 2 * halfH
        ? Math.max(halfH, Math.min(worldHeight - halfH, currentFocusY))
        : worldHeight / 2;

      // Project world focus point into screen center
      const bx = screenW / 2 - currentFocusX * scale;
      const by = screenH / 2 - currentFocusY * scale;

      // Apply shake and punch
      if (shakeAmount > 0.05) {
        worldRoot.x = snapToPixel(bx + (Math.random() - 0.5) * shakeAmount + punchVX);
        worldRoot.y = snapToPixel(by + (Math.random() - 0.5) * shakeAmount + punchVY);
        shakeAmount *= Math.pow(0.55, dt);
        punchVX *= 0.7;
        punchVY *= 0.7;
      } else {
        worldRoot.x = snapToPixel(bx + punchVX);
        worldRoot.y = snapToPixel(by + punchVY);
        punchVX *= 0.7;
        punchVY *= 0.7;
        if (Math.abs(punchVX) < 0.05 && Math.abs(punchVY) < 0.05) {
          punchVX = 0;
          punchVY = 0;
        }
      }

      worldRoot.scale.set(scale);
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
