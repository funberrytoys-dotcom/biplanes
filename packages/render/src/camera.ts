import { Container } from 'pixi.js';
import type { Plane } from '@biplanes/core';

export function createCamera(worldRoot: Container, screenW: number, screenH: number) {
  let shakeAmount = 0;
  return {
    follow(player: Plane) {
      const tx = -player.kinematic.position.x + screenW / 2;
      const ty = -player.kinematic.position.y + screenH / 2;
      worldRoot.x += (tx - worldRoot.x) * 0.15;
      worldRoot.y += (ty - worldRoot.y) * 0.15;

      if (shakeAmount > 0) {
        worldRoot.x += (Math.random() - 0.5) * shakeAmount;
        worldRoot.y += (Math.random() - 0.5) * shakeAmount;
        shakeAmount *= 0.85;
      }
    },
    shake(amount: number) { shakeAmount = Math.max(shakeAmount, amount); },
    setScreen(w: number, h: number) { screenW = w; screenH = h; },
  };
}
