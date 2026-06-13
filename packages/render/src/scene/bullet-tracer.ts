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
    g.rect(-34, -2.0, 48, 4.0).fill({ color, alpha: heavy ? 0.9 : 0.78 });
    g.rect(-16, -0.9, 34, 1.8).fill({ color: 0xffffff, alpha: heavy ? 0.76 : 0.62 });
    g.circle(9, 0, heavy ? 4.6 : 3.4).fill({ color: 0xffffff, alpha: 0.86 });
    g.x = bullet.position.x;
    g.y = bullet.position.y;
    g.rotation = Math.atan2(bullet.velocity.y, bullet.velocity.x);
    g.blendMode = 'add';
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
