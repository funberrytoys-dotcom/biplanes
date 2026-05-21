import { Container, Graphics } from 'pixi.js';

/**
 * Lightweight particle system for plane damage feedback.
 *  - Smoke: gray, slow rise, ~0.6s life.
 *  - Fire: orange/red, fast flicker, ~0.4s life.
 *  - Explosion: short burst of both.
 *
 * Particles are pooled to avoid GC churn at 60Hz.
 */
interface Particle {
  g: Graphics;
  vx: number;
  vy: number;
  life: number;       // seconds remaining
  maxLife: number;
  baseAlpha: number;
  baseRadius: number;
}

export class DamageFx {
  private container: Container;
  private active: Particle[] = [];
  private pool: Graphics[] = [];

  constructor(container: Container) {
    this.container = container;
  }

  private acquire(color: number, radius: number): Graphics {
    let g = this.pool.pop();
    if (!g) {
      g = new Graphics();
    }
    g.clear();
    g.circle(0, 0, radius).fill(color);
    this.container.addChild(g);
    return g;
  }

  private release(g: Graphics) {
    if (g.parent) g.parent.removeChild(g);
    this.pool.push(g);
  }

  addSmokeTrail(position: { x: number; y: number }, count: number) {
    for (let i = 0; i < count; i++) {
      const radius = 4 + Math.random() * 5;
      const color = 0x444444 + ((Math.random() * 0x333333) | 0);
      const g = this.acquire(color, radius);
      g.x = position.x + (Math.random() - 0.5) * 8;
      g.y = position.y + (Math.random() - 0.5) * 8;
      this.active.push({
        g,
        vx: (Math.random() - 0.5) * 30,
        vy: -20 - Math.random() * 30,
        life: 0.6 + Math.random() * 0.2,
        maxLife: 0.8,
        baseAlpha: 0.55,
        baseRadius: radius,
      });
    }
  }

  addFireTrail(position: { x: number; y: number }, count: number) {
    for (let i = 0; i < count; i++) {
      const radius = 3 + Math.random() * 5;
      // orange/red palette
      const palette = [0xff5500, 0xff8800, 0xffaa22, 0xcc2200];
      const color = palette[(Math.random() * palette.length) | 0]!;
      const g = this.acquire(color, radius);
      g.x = position.x + (Math.random() - 0.5) * 6;
      g.y = position.y + (Math.random() - 0.5) * 6;
      this.active.push({
        g,
        vx: (Math.random() - 0.5) * 40,
        vy: -40 - Math.random() * 50,
        life: 0.35 + Math.random() * 0.2,
        maxLife: 0.5,
        baseAlpha: 0.85,
        baseRadius: radius,
      });
    }
  }

  addExplosion(position: { x: number; y: number }) {
    // Bigger burst — fire core + outer smoke ring.
    for (let i = 0; i < 22; i++) {
      const radius = 6 + Math.random() * 10;
      const palette = [0xff4400, 0xff8800, 0xffcc00, 0xffffff];
      const color = palette[(Math.random() * palette.length) | 0]!;
      const g = this.acquire(color, radius);
      g.x = position.x;
      g.y = position.y;
      const ang = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 220;
      this.active.push({
        g,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.8,
        baseAlpha: 1.0,
        baseRadius: radius,
      });
    }
    for (let i = 0; i < 14; i++) {
      const radius = 8 + Math.random() * 12;
      const color = 0x333333;
      const g = this.acquire(color, radius);
      g.x = position.x;
      g.y = position.y;
      const ang = Math.random() * Math.PI * 2;
      const sp = 30 + Math.random() * 80;
      this.active.push({
        g,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 20,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1.0,
        baseAlpha: 0.55,
        baseRadius: radius,
      });
    }
  }

  update(dt: number) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i]!;
      p.life -= dt;
      if (p.life <= 0) {
        this.release(p.g);
        this.active.splice(i, 1);
        continue;
      }
      p.g.x += p.vx * dt;
      p.g.y += p.vy * dt;
      // light drag
      p.vx *= 1 - 0.5 * dt;
      p.vy *= 1 - 0.5 * dt;
      const t = p.life / p.maxLife;
      p.g.alpha = p.baseAlpha * t;
      p.g.scale.set(0.6 + (1 - t) * 0.8);
    }
  }
}
