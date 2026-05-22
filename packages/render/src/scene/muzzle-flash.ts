import { Container, Graphics } from 'pixi.js';

interface Flash {
  g: Graphics;
  life: number;
  maxLife: number;
}

export class MuzzleFlashes {
  private active: Flash[] = [];
  private pool: Graphics[] = [];

  constructor(private container: Container) {}

  spawn(x: number, y: number, headingRad: number) {
    let g = this.pool.pop();
    if (!g) g = new Graphics();
    g.clear();
    const r1 = 11, r2 = 4;
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      const r = i % 2 === 0 ? r1 : r2;
      if (i === 0) g.moveTo(Math.cos(ang) * r, Math.sin(ang) * r);
      else g.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
    }
    g.closePath().fill({ color: 0xfff5a0, alpha: 0.95 });
    g.circle(0, 0, 5).fill({ color: 0xffffff, alpha: 0.9 });
    g.x = x;
    g.y = y;
    g.rotation = headingRad;
    g.blendMode = 'add';
    g.alpha = 1;
    g.scale.set(1);
    this.container.addChild(g);
    this.active.push({ g, life: 0.08, maxLife: 0.08 });
  }

  update(dt: number) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const f = this.active[i]!;
      f.life -= dt;
      if (f.life <= 0) {
        if (f.g.parent) f.g.parent.removeChild(f.g);
        this.pool.push(f.g);
        this.active.splice(i, 1);
        continue;
      }
      const t = f.life / f.maxLife;
      f.g.alpha = t;
      f.g.scale.set(0.4 + t * 0.6);
    }
  }
}
