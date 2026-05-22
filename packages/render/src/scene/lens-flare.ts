import { Container, Graphics } from 'pixi.js';

export function createLensFlare(width: number, height: number, active: boolean = false) {
  const c = new Container();
  const sunX = width * 0.78;
  const sunY = height * 0.15;

  const sun = new Graphics().circle(0, 0, 26).fill({ color: 0xffe9a0, alpha: 0.85 });
  sun.x = sunX; sun.y = sunY;
  sun.blendMode = 'add';
  c.addChild(sun);

  const flares: { g: Graphics; baseAlpha: number; size: number; offset: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const off = (i + 1) * 60;
    const sz = 8 + i * 4;
    const g = new Graphics();
    const verts: number[] = [];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      verts.push(Math.cos(a) * sz, Math.sin(a) * sz);
    }
    g.poly(verts).fill({ color: 0xffd28c, alpha: 0.15 });
    g.x = sunX + off * 0.2;
    g.y = sunY + off * 0.15;
    g.blendMode = 'add';
    c.addChild(g);
    flares.push({ g, baseAlpha: 0.15, size: sz, offset: off });
  }
  c.visible = active;

  return {
    container: c,
    setActive(v: boolean) { c.visible = v; },
    update(_dt: number, timeSec: number, playerX: number) {
      const breath = 1 + 0.05 * Math.sin(timeSec * 0.8);
      sun.scale.set(breath);
      const proximity = Math.max(0, 1 - Math.abs(playerX - sunX) / 80);
      for (const f of flares) {
        f.g.alpha = f.baseAlpha + proximity * 0.2;
      }
    },
  };
}
