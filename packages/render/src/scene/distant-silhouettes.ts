import { Container, Graphics } from 'pixi.js';

export function createDistantSilhouettes(width: number, height: number, color: number) {
  const c = new Container();

  const mountains = new Graphics();
  let px = 0;
  mountains.moveTo(0, height * 0.55);
  while (px < width + 50) {
    const peakH = 30 + Math.random() * 50;
    mountains.lineTo(px + 50, height * 0.55 - peakH);
    px += 50;
    mountains.lineTo(px + 50, height * 0.55);
    px += 50;
  }
  mountains.lineTo(width, height);
  mountains.lineTo(0, height);
  mountains.closePath().fill({ color, alpha: 0.7 });
  c.addChild(mountains);

  const blimps: { g: Graphics; x: number; y: number; speed: number; nav: Graphics }[] = [];
  for (let i = 0; i < 2; i++) {
    const b = new Graphics().ellipse(0, 0, 26, 7).fill({ color, alpha: 0.7 });
    b.x = Math.random() * width;
    b.y = height * 0.18 + i * 22;
    const nav = new Graphics().circle(20, 0, 1.2).fill(i === 0 ? 0xff3333 : 0x66aaff);
    b.addChild(nav);
    c.addChild(b);
    blimps.push({ g: b, x: b.x, y: b.y, speed: 5 + Math.random() * 4, nav });
  }

  const crosser = new Graphics()
    .moveTo(-8, 0).lineTo(8, 0).stroke({ color, width: 2 })
    .rect(-4, -2, 8, 4).fill({ color, alpha: 0.7 });
  crosser.alpha = 0;
  crosser.y = height * 0.3;
  c.addChild(crosser);

  let crosserX = -50;
  let crosserActive = false;
  let crosserCooldown = 60 + Math.random() * 60;

  return {
    container: c,
    update(dt: number, timeSec: number) {
      for (const b of blimps) {
        b.x -= b.speed * dt;
        if (b.x < -40) b.x = width + 40;
        b.g.x = b.x;
        b.nav.alpha = 0.4 + 0.6 * Math.abs(Math.sin(timeSec * 3));
      }
      if (crosserActive) {
        crosserX += 35 * dt;
        crosser.x = crosserX;
        crosser.alpha = 0.7;
        if (crosserX > width + 50) {
          crosserActive = false;
          crosserX = -50;
          crosser.alpha = 0;
          crosserCooldown = 60 + Math.random() * 60;
        }
      } else {
        crosserCooldown -= dt;
        if (crosserCooldown <= 0) crosserActive = true;
      }
    },
  };
}
