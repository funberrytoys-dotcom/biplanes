import { Container, Graphics } from 'pixi.js';
import type { Bullet } from '@biplanes/core';

interface TrailParticle {
  g: Graphics;
  life: number;
  maxLife: number;
  scale: number;
}

export interface BulletTracerOptions {
  scale?: number;
  duration?: number;
}

export class BulletTracers {
  private active: TrailParticle[] = [];
  private pool: Graphics[] = [];

  constructor(private container: Container) {}

  emit(bullet: Bullet, options: BulletTracerOptions = {}) {
    let g = this.pool.pop();
    if (!g) g = new Graphics();
    g.clear();
    const scale = options.scale ?? 1;
    const duration = options.duration ?? 0.1;
    const color = bullet.ownerFaction === 'player' ? 0xffe88c : 0xff5a22;
    const heavy = bullet.isHeavy === true;
    // Filter-free glow: additive blend + layered soft halo (wide-faint → narrow-bright)
    // fakes the bloom the BlurFilter used to give, but can't crash the GPU (see glow-layer.ts).
    g.blendMode = 'add';
    g.rect(-46, -8.5, 66, 17).fill({ color, alpha: heavy ? 0.10 : 0.07 });   // wide soft halo
    g.rect(-40, -4.6, 56, 9.2).fill({ color, alpha: heavy ? 0.22 : 0.16 });  // mid halo
    g.rect(-34, -2.3, 48, 4.6).fill({ color, alpha: heavy ? 0.58 : 0.46 });  // core glow
    g.rect(-16, -1.0, 34, 2.0).fill({ color: 0xfff4d0, alpha: heavy ? 0.85 : 0.7 }); // bright streak
    g.circle(9, 0, heavy ? 5.0 : 3.6).fill({ color: 0xffffff, alpha: 0.95 }); // hot head
    g.x = bullet.position.x;
    g.y = bullet.position.y;
    g.rotation = Math.atan2(bullet.velocity.y, bullet.velocity.x);
    g.scale.set(scale);
    this.container.addChild(g);
    this.active.push({ g, life: duration, maxLife: duration, scale });
  }

  update(dt: number) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i]!;
      p.life -= dt;
      if (p.life <= 0) {
        if (p.g.parent) p.g.parent.removeChild(p.g);
        this.pool.push(p.g);
        this.active.splice(i, 1);
        continue;
      }
      const t = p.life / p.maxLife;
      p.g.alpha = t * 0.85;
      p.g.scale.set((0.28 + t * 0.72) * p.scale);
    }
  }
}
