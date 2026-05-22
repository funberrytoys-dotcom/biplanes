import { Container, Graphics } from 'pixi.js';

interface Particle {
  g: Graphics;
  vx: number;
  vy: number;
  life: number;       // seconds remaining
  maxLife: number;
  baseAlpha: number;
  baseRadius: number;
  type: 'smoke' | 'fire' | 'spark' | 'shockwave';
}

export class DamageFx {
  private container: Container;
  private active: Particle[] = [];
  private pool: Graphics[] = [];

  constructor(container: Container) {
    this.container = container;
  }

  private acquire(color: number, radius: number, type: Particle['type']): Graphics {
    let g = this.pool.pop();
    if (!g) {
      g = new Graphics();
    }
    g.clear();
    
    if (type === 'shockwave') {
      // Draw hollow ring with glow border
      g.circle(0, 0, 100)
       .stroke({ width: 4, color: 0xffffff, alpha: 0.95 });
    } else if (type === 'spark') {
      // Draw a tiny bright oval/circle for sparks
      g.circle(0, 0, radius)
       .fill(color);
    } else {
      // Standard smoke/fire circle
      g.circle(0, 0, radius)
       .fill(color);
    }
    
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
      const g = this.acquire(color, radius, 'smoke');
      g.x = position.x + (Math.random() - 0.5) * 8;
      g.y = position.y + (Math.random() - 0.5) * 8;
      g.scale.set(1);
      this.active.push({
        g,
        vx: (Math.random() - 0.5) * 30,
        vy: -20 - Math.random() * 30,
        life: 0.6 + Math.random() * 0.2,
        maxLife: 0.8,
        baseAlpha: 0.55,
        baseRadius: radius,
        type: 'smoke',
      });
    }
  }

  addFireTrail(position: { x: number; y: number }, count: number) {
    for (let i = 0; i < count; i++) {
      const radius = 3 + Math.random() * 5;
      const palette = [0xff5500, 0xff8800, 0xffaa22, 0xcc2200];
      const color = palette[(Math.random() * palette.length) | 0]!;
      const g = this.acquire(color, radius, 'fire');
      g.x = position.x + (Math.random() - 0.5) * 6;
      g.y = position.y + (Math.random() - 0.5) * 6;
      g.scale.set(1);
      this.active.push({
        g,
        vx: (Math.random() - 0.5) * 40,
        vy: -40 - Math.random() * 50,
        life: 0.35 + Math.random() * 0.2,
        maxLife: 0.5,
        baseAlpha: 0.85,
        baseRadius: radius,
        type: 'fire',
      });
    }
  }

  addSparks(position: { x: number; y: number }, count: number = 8) {
    const palette = [0xffffff, 0xfff455, 0xff9900, 0xffaa22];
    for (let i = 0; i < count; i++) {
      const radius = 1.5 + Math.random() * 1.5;
      const color = palette[(Math.random() * palette.length) | 0]!;
      const g = this.acquire(color, radius, 'spark');
      g.x = position.x;
      g.y = position.y;
      g.scale.set(1);
      
      const ang = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 180;
      this.active.push({
        g,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 30, // slight upward float
        life: 0.2 + Math.random() * 0.25,
        maxLife: 0.45,
        baseAlpha: 0.95,
        baseRadius: radius,
        type: 'spark',
      });
    }
  }

  addWindTrail(position: { x: number; y: number }) {
    const radius = 1.2 + Math.random() * 2.2;
    const color = 0xffffff;
    const g = this.acquire(color, radius, 'spark');
    g.x = position.x;
    g.y = position.y;
    g.scale.set(1);
    this.active.push({
      g,
      vx: (Math.random() - 0.5) * 15,
      vy: (Math.random() - 0.5) * 15,
      life: 0.15 + Math.random() * 0.15,
      maxLife: 0.3,
      baseAlpha: 0.22,
      baseRadius: radius,
      type: 'spark',
    });
  }

  addShockwave(position: { x: number; y: number }) {
    // Add an expanding shockwave ring
    const g = this.acquire(0xffffff, 100, 'shockwave');
    g.x = position.x;
    g.y = position.y;
    g.scale.set(0.05); // start very small
    
    this.active.push({
      g,
      vx: 0,
      vy: 0,
      life: 0.4,
      maxLife: 0.4,
      baseAlpha: 0.8,
      baseRadius: 100,
      type: 'shockwave',
    });
  }

  addExplosion(position: { x: number; y: number }) {
    // Standard explosion bursts
    for (let i = 0; i < 22; i++) {
      const radius = 6 + Math.random() * 10;
      const palette = [0xff4400, 0xff8800, 0xffcc00, 0xffffff];
      const color = palette[(Math.random() * palette.length) | 0]!;
      const g = this.acquire(color, radius, 'fire');
      g.x = position.x;
      g.y = position.y;
      g.scale.set(1);
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
        type: 'fire',
      });
    }
    
    for (let i = 0; i < 14; i++) {
      const radius = 8 + Math.random() * 12;
      const color = 0x333333;
      const g = this.acquire(color, radius, 'smoke');
      g.x = position.x;
      g.y = position.y;
      g.scale.set(1);
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
        type: 'smoke',
      });
    }

    // Add visual radial shockwave
    this.addShockwave(position);
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
      
      // Drag decelerates sparks and explosions
      if (p.type !== 'shockwave') {
        p.vx *= 1 - 0.5 * dt;
        p.vy *= 1 - 0.5 * dt;
      }
      
      const t = p.life / p.maxLife; // 1 to 0
      p.g.alpha = p.baseAlpha * t;
      
      if (p.type === 'shockwave') {
        // Expand circle scale from 0.05 to 1.3
        const scale = 0.05 + (1 - t) * 1.25;
        p.g.scale.set(scale);
      } else if (p.type === 'spark') {
        // Sparks fade out and shrink slightly
        p.g.scale.set(0.4 + t * 0.6);
      } else {
        // Standard fire/smoke grows slightly as it fades
        p.g.scale.set(0.6 + (1 - t) * 0.8);
      }
    }
  }
}
