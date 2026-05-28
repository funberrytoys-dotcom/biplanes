import { Container, Graphics } from 'pixi.js';
import type { Bullet } from '@biplanes/core';

interface TrailParticle {
  g: Graphics;
  life: number;
  maxLife: number;
}

export class BulletTracers {
  private active: TrailParticle[] = [];
  private pool: Graphics[] = [];

  constructor(private container: Container) {}

  emit(bullet: Bullet) {
    let g = this.pool.pop();
    if (!g) g = new Graphics();
    g.clear();
    const color = bullet.ownerFaction === 'player' ? 0xffe88c : 0xff5a22;
    g.rect(-12, -1.1, 16, 2.2).fill({ color, alpha: 0.62 });
    g.circle(3, 0, 2.6).fill({ color: 0xffffff, alpha: 0.72 });
    g.x = bullet.position.x;
    g.y = bullet.position.y;
    g.rotation = Math.atan2(bullet.velocity.y, bullet.velocity.x);
    g.blendMode = 'add';
    this.container.addChild(g);
    this.active.push({ g, life: 0.1, maxLife: 0.1 });
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
      p.g.scale.set(0.3 + t * 0.7);
    }
  }
}
