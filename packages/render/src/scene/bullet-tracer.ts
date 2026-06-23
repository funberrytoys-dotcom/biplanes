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
    // Filter-free glow: a soft colored haze (normal blend, so it reads on ANY sky) around a
    // solid bright core — fakes the old BlurFilter bloom without the GPU-crashing filter.
    g.rect(-50, -8, 70, 16).fill({ color, alpha: heavy ? 0.16 : 0.12 });        // wide soft halo
    g.rect(-44, -5.2, 62, 10.4).fill({ color, alpha: heavy ? 0.30 : 0.24 });    // mid halo
    g.rect(-40, -3.4, 58, 6.8).fill({ color: 0x2a1208, alpha: heavy ? 0.50 : 0.42 }); // dark base (pops on bright sky)
    g.rect(-36, -2.6, 52, 5.2).fill({ color, alpha: heavy ? 0.96 : 0.88 });     // bright body
    g.rect(-18, -1.4, 40, 2.8).fill({ color: 0xfff4d0, alpha: heavy ? 0.9 : 0.78 }); // hot streak
    g.circle(11, 0, heavy ? 6.0 : 4.4).fill({ color: 0xffffff, alpha: 0.95 });  // bright head
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
