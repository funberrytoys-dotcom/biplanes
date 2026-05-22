import { Container, Graphics } from 'pixi.js';

interface Particle {
  g: Graphics;
  vx: number;
  vy: number;
  life: number;       // seconds remaining
  maxLife: number;
  baseAlpha: number;
  baseRadius: number;
  type: 'smoke' | 'fire' | 'spark' | 'shockwave' | 'chunk' | 'casing';
}

export class DamageFx {
  private opaqueContainer: Container;
  private glowContainer: Container;
  private active: Particle[] = [];
  private pool: Graphics[] = [];
  private pendingShockwaves: { remainingTime: number; pos: { x: number; y: number } }[] = [];

  constructor(opaqueContainer: Container, glowContainer: Container) {
    this.opaqueContainer = opaqueContainer;
    this.glowContainer = glowContainer;
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
    } else if (type === 'chunk') {
      g.rect(-2, -1, 4, 2).fill(color);
    } else if (type === 'casing') {
      g.rect(-2, -0.75, 4, 1.5).fill(color);
    } else {
      // Standard smoke/fire circle
      g.circle(0, 0, radius)
       .fill(color);
    }

    const useGlow = type === 'fire' || type === 'spark' || type === 'shockwave';
    g.blendMode = useGlow ? 'add' : 'normal';
    const container = useGlow ? this.glowContainer : this.opaqueContainer;
    container.addChild(g);
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

  addHeatWave(position: { x: number; y: number }) {
    const g = this.acquire(0xffffff, 4, 'spark');
    g.x = position.x + (Math.random() - 0.5) * 6;
    g.y = position.y;
    g.alpha = 0.18;
    this.active.push({
      g,
      vx: 0,
      vy: -40,
      life: 0.4,
      maxLife: 0.4,
      baseAlpha: 0.18,
      baseRadius: 4,
      type: 'spark',
    });
  }

  addImpactFlash(position: { x: number; y: number }) {
    const g = this.acquire(0xffffff, 14, 'spark'); // routes through glow container via type=spark
    g.x = position.x;
    g.y = position.y;
    g.scale.set(1);
    this.active.push({
      g,
      vx: 0,
      vy: 0,
      life: 0.08,
      maxLife: 0.08,
      baseAlpha: 1.0,
      baseRadius: 14,
      type: 'spark',
    });
  }

  addCasing(position: { x: number; y: number }, heading: number) {
    const g = this.acquire(0xc89c4a, 0, 'casing');
    g.x = position.x;
    g.y = position.y;
    const back = heading + Math.PI;
    const downA = back + Math.PI * 0.3;
    const sp = 80 + Math.random() * 40;
    this.active.push({
      g,
      vx: Math.cos(downA) * sp,
      vy: Math.sin(downA) * sp,
      life: 0.6,
      maxLife: 0.6,
      baseAlpha: 1,
      baseRadius: 2,
      type: 'casing',
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
    // 1. White core flash
    {
      const g = this.acquire(0xffffff, 28, 'spark');
      g.x = position.x;
      g.y = position.y;
      g.scale.set(1);
      this.active.push({
        g,
        vx: 0,
        vy: 0,
        life: 0.08,
        maxLife: 0.08,
        baseAlpha: 1,
        baseRadius: 28,
        type: 'spark',
      });
    }

    // 2. Double shockwave: now + 80ms later (delay driven via update(dt) for determinism)
    this.addShockwave(position);
    this.pendingShockwaves.push({ remainingTime: 0.08, pos: { x: position.x, y: position.y } });

    // 3. Fire bursts
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

    // 4. Smoke
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

    // 5. Small chunks
    for (let i = 0; i < 7; i++) {
      const g = this.acquire(0x8a6a3a, 0, 'chunk');
      g.x = position.x;
      g.y = position.y;
      const ang = Math.random() * Math.PI * 2;
      const sp = 140 + Math.random() * 200;
      g.rotation = Math.random() * Math.PI * 2;
      this.active.push({
        g,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 80,
        life: 0.8,
        maxLife: 0.8,
        baseAlpha: 1,
        baseRadius: 2,
        type: 'chunk',
      });
    }
  }

  update(dt: number) {
    for (let i = this.pendingShockwaves.length - 1; i >= 0; i--) {
      const ps = this.pendingShockwaves[i]!;
      ps.remainingTime -= dt;
      if (ps.remainingTime <= 0) {
        this.addShockwave(ps.pos);
        this.pendingShockwaves.splice(i, 1);
      }
    }

    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i]!;
      p.life -= dt;
      if (p.life <= 0) {
        this.release(p.g);
        this.active.splice(i, 1);
        continue;
      }
      
      if (p.type === 'chunk') {
        p.vy += 600 * dt;
        p.g.rotation += 6 * dt;
      }
      if (p.type === 'casing') {
        p.vy += 600 * dt;
        p.g.rotation += 8 * dt;
      }

      p.g.x += p.vx * dt;
      p.g.y += p.vy * dt;

      // Drag decelerates sparks and explosions
      if (p.type !== 'shockwave' && p.type !== 'chunk' && p.type !== 'casing') {
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
      } else if (p.type === 'chunk') {
        // Chunks keep their size, just tumble + fall
        p.g.scale.set(1);
      } else if (p.type === 'casing') {
        // Casings keep their size, tumble + fall, fade out at end
        p.g.scale.set(1);
      } else {
        // Standard fire/smoke grows slightly as it fades
        p.g.scale.set(0.6 + (1 - t) * 0.8);
      }
    }
  }
}
