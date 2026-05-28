import { Container, Graphics } from 'pixi.js';
import type { ScreenEffectsHandle } from './screen-effects.js';

export function createLightning(width: number, height: number, screenFx?: ScreenEffectsHandle, active: boolean = false) {
  const c = new Container();
  const bolt = new Graphics();
  c.addChild(bolt);
  bolt.alpha = 0;

  let cooldown = 12 + Math.random() * 13;
  let boltLife = 0;
  let isActive = active;

  function draw() {
    bolt.clear();
    const glowY = Math.random() * height * 0.12;
    bolt.rect(0, glowY, width, height * 0.24).fill({ color: 0xb9d8ff, alpha: 0.1 });
    bolt.alpha = 0.55;
    boltLife = 0.08;
    if (screenFx) screenFx.flash(0xffffff, 0.07, 0.18);
  }

  return {
    container: c,
    setActive(v: boolean) { isActive = v; if (!v) { bolt.alpha = 0; boltLife = 0; } },
    isLightningActive() { return boltLife > 0; },
    update(dt: number) {
      if (!isActive) return;
      if (boltLife > 0) {
        boltLife -= dt;
        if (boltLife <= 0) bolt.alpha = 0;
      } else {
        cooldown -= dt;
        if (cooldown <= 0) {
          draw();
          cooldown = 12 + Math.random() * 13;
        }
      }
    },
  };
}
