import { Container } from 'pixi.js';
import type { Plane } from '@biplanes/core';

export function createCamera(worldRoot: Container, screenW: number, screenH: number) {
  let shakeAmount = 0;
  const SHAKE_CAP = 6;     // was effectively unlimited
  const SHAKE_DECAY = 0.7; // was 0.85 — faster decay

  return {
    follow(player: Plane) {
      const tx = -player.kinematic.position.x + screenW / 2;
      const ty = -player.kinematic.position.y + screenH / 2;
      // Smoother follow — was 0.15
      worldRoot.x += (tx - worldRoot.x) * 0.08;
      worldRoot.y += (ty - worldRoot.y) * 0.08;

      if (shakeAmount > 0.1) {
        worldRoot.x += (Math.random() - 0.5) * shakeAmount;
        worldRoot.y += (Math.random() - 0.5) * shakeAmount;
        shakeAmount *= SHAKE_DECAY;
      }
    },
    shake(amount: number) { shakeAmount = Math.min(SHAKE_CAP, Math.max(shakeAmount, amount)); },
    setScreen(w: number, h: number) { screenW = w; screenH = h; },
  };
}
