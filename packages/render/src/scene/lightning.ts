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
    const startX = Math.random() * width;
    const startY = Math.random() * height * 0.2;
    let x = startX, y = startY;
    bolt.moveTo(x, y);
    const segs = 4 + (Math.random() * 3 | 0);
    for (let i = 0; i < segs; i++) {
      x += (Math.random() - 0.5) * 60;
      y += 30 + Math.random() * 40;
      bolt.lineTo(x, y);
    }
    bolt.stroke({ color: 0xffffff, width: 1.5, alpha: 1 });
    bolt.alpha = 1;
    boltLife = 0.08;
    if (screenFx) screenFx.flash(0xffffff, 0.12, 0.2);
  }

  return {
    container: c,
    setActive(v: boolean) { isActive = v; if (!v) { bolt.alpha = 0; boltLife = 0; } },
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
