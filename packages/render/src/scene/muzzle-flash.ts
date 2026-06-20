import { Container, Graphics } from 'pixi.js';

interface Flash {
  g: Graphics;
  life: number;
  maxLife: number;
  scale: number;
}

export interface MuzzleFlashOptions {
  scale?: number;
  duration?: number;
}

export class MuzzleFlashes {
  private active: Flash[] = [];
  private pool: Graphics[] = [];

  constructor(private container: Container) {}

  spawn(x: number, y: number, headingRad: number, options: MuzzleFlashOptions = {}) {
    let g = this.pool.pop();
    if (!g) g = new Graphics();
    g.clear();
    const scale = options.scale ?? 1;
    const duration = options.duration ?? 0.08;
    const r1 = 14, r2 = 4.5;
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      const r = i % 2 === 0 ? r1 : r2;
      if (i === 0) g.moveTo(Math.cos(ang) * r, Math.sin(ang) * r);
      else g.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
    }
    g.closePath().fill({ color: 0xffd05a, alpha: 0.82 });
    // Forward "cone of fire" plume shooting out along the barrel (Godot-style).
    const L = 38, H = 8;
    g.moveTo(0, 0)
      .lineTo(L * 0.5, -H * 0.7)
      .lineTo(L, -H * 0.25)
      .lineTo(L * 1.08, 0)
      .lineTo(L, H * 0.25)
      .lineTo(L * 0.5, H * 0.7)
      .closePath()
      .fill({ color: 0xffe08a, alpha: 0.7 });
    g.circle(0, 0, 9).fill({ color: 0xff7426, alpha: 0.34 });
    g.circle(0, 0, 5.4).fill({ color: 0xfff5a0, alpha: 0.92 });
    g.circle(0, 0, 2.4).fill({ color: 0xffffff, alpha: 0.96 });
    g.rect(2, -1.4, 18, 2.8).fill({ color: 0xffffff, alpha: 0.5 });
    g.x = x;
    g.y = y;
    g.rotation = headingRad;
    g.blendMode = 'add';
    g.alpha = 1;
    g.scale.set(scale);
    this.container.addChild(g);
    this.active.push({ g, life: duration, maxLife: duration, scale });
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
      f.g.scale.set((0.35 + t * 0.75) * f.scale);
    }
  }
}
