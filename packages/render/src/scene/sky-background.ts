import { Container, Graphics } from 'pixi.js';

export function createSkyBackground(width: number, height: number): Container {
  const c = new Container();

  // Gradient sky via tinted graphics (simple two-band for prototype)
  const top = new Graphics().rect(0, 0, width, height * 0.6).fill(0x1f4f8b);
  const bottom = new Graphics().rect(0, height * 0.6, width, height * 0.4).fill(0xd8985c);
  c.addChild(top, bottom);

  // Cloud silhouettes (parallax placeholders)
  for (let i = 0; i < 8; i++) {
    const cloud = new Graphics()
      .ellipse((i * width) / 8, height * 0.2 + Math.random() * height * 0.3, 80 + Math.random() * 60, 20 + Math.random() * 15)
      .fill({ color: 0xffffff, alpha: 0.25 });
    c.addChild(cloud);
  }

  // Floating rock silhouettes (parallax)
  for (let i = 0; i < 4; i++) {
    const rock = new Graphics()
      .ellipse((i * width) / 4 + 200, height * 0.7, 180, 50)
      .fill({ color: 0x000000, alpha: 0.4 });
    c.addChild(rock);
  }

  return c;
}
