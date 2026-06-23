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
    const duration = options.duration ?? 0.1;
    const color = bullet.ownerFaction === 'player' ? 0xffe88c : 0xff5a22;
    // A small, faint motion smear so fast rounds don't strobe — deliberately NOT a long
    // tracer and with NO glow bloom. The owner's brief: «small bullets, no tracers, no
    // glow». The visible projectile itself is BulletPool's sprite (С.О.В. = small bullet,
    // Алые Шакалы = fat slow ball); this just softens the gap between frames. Faction COLOR
    // only — no white-hot core, no halos, no additive blend (those read as «свечение»).
    g.rect(-8, -0.8, 11, 1.6).fill({ color, alpha: 0.5 });
    g.x = bullet.position.x;
    g.y = bullet.position.y;
    g.rotation = Math.atan2(bullet.velocity.y, bullet.velocity.x);
    this.container.addChild(g);
    this.active.push({ g, life: duration, maxLife: duration, scale: 1 });
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
