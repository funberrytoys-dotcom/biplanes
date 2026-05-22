import { Container, Graphics } from 'pixi.js';

interface Cloud {
  g: Graphics;
  x: number;
  y: number;
  w: number;
  speed: number;
}

export function createForegroundClouds(width: number, height: number) {
  const c = new Container();
  c.alpha = 0.35;
  const clouds: Cloud[] = [];
  for (let i = 0; i < 2; i++) {
    const w = 220 + Math.random() * 140;
    const h = 50;
    const g = new Graphics()
      .ellipse(0, 0, w / 2, h / 2)
      .ellipse(-w / 3, -h / 4, w / 3, h / 2)
      .ellipse(w / 3, -h / 5, w / 3.5, h / 2)
      .fill(0xffffff);
    g.x = (i + 1) * (width / 3);
    g.y = height * 0.35 + i * 50;
    c.addChild(g);
    clouds.push({ g, x: g.x, y: g.y, w, speed: 20 + Math.random() * 15 });
  }

  return {
    container: c,
    update(dt: number) {
      for (const cl of clouds) {
        cl.x -= cl.speed * dt;
        if (cl.x < -cl.w / 2) cl.x = width + cl.w / 2;
        cl.g.x = cl.x;
      }
    },
  };
}
