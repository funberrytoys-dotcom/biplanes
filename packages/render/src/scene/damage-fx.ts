import { Container, Graphics } from 'pixi.js';

interface Particle {
  g: Graphics;
  vx: number;
  vy: number;
  life: number;       // seconds remaining
  maxLife: number;
  baseAlpha: number;
  baseRadius: number;
  type: 'smoke' | 'fire' | 'spark' | 'shockwave' | 'chunk' | 'casing' | 'windstreak' | 'debris';
}

// Hard cap on simultaneously-active particles. At low HP the fire+smoke
// trails can balloon the active list and tank mobile framerate, so we trim
// the oldest particles back to the pool once we exceed this.
const MAX_ACTIVE_PARTICLES = 48;

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
      g.rect(-3, -1.1, 6, 2.2).fill(color).stroke({ color: 0x4a3308, width: 0.6, alpha: 0.6 });
    } else if (type === 'windstreak') {
      g.rect(0, -0.5, 50, 1).fill({ color: 0xffffff, alpha: 0.2 });
    } else if (type === 'debris') {
      // Chunkier panel shard (randomised so a shed reads as torn metal, not uniform bars).
      const wHalf = 6 + Math.random() * 5;
      const hHalf = 2 + Math.random() * 2.5;
      g.rect(-wHalf, -hHalf, wHalf * 2, hHalf * 2).fill(color).stroke({ color: 0x1a1208, width: 0.8, alpha: 0.5 });
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

  addEngineExhaust(position: { x: number; y: number }, throttle: number = 0.5) {
    // 1. Thick smoke with wavy expansion (Phase 3.2)
    const radius = (2.2 + Math.random() * 3.0) * (0.7 + throttle * 0.8);
    const palette = [0x7f8c8d, 0x95a5a6, 0xbdc3c7, 0x5a5f69];
    const color = palette[Math.floor(Math.random() * palette.length)]!;
    
    const g = this.acquire(color, radius, 'smoke');
    g.x = position.x + (Math.random() - 0.5) * 4;
    g.y = position.y + (Math.random() - 0.5) * 4;
    g.scale.set(1);
    
    // Add sinusoidal wave movement to Y (wind sway)
    const waveAmp = (Math.random() - 0.5) * 15;
    
    this.active.push({
      g,
      vx: -20 * (0.5 + throttle) + (Math.random() - 0.5) * 12,
      vy: -6 - Math.random() * 10 + waveAmp,
      life: 0.38 + Math.random() * 0.22,
      maxLife: 0.6,
      baseAlpha: 0.16 + throttle * 0.14,
      baseRadius: radius,
      type: 'smoke',
    });

    // 2. Spawn rare glowing orange sparks at high throttle
    if (throttle > 0.78 && Math.random() < 0.32) {
      const sparkRadius = 0.8 + Math.random() * 1.2;
      const sparkG = this.acquire(0xff8800, sparkRadius, 'spark');
      sparkG.x = position.x;
      sparkG.y = position.y;
      sparkG.scale.set(1);
      
      this.active.push({
        g: sparkG,
        vx: -38 * throttle + (Math.random() - 0.5) * 20,
        vy: -12 + (Math.random() - 0.5) * 25,
        life: 0.12 + Math.random() * 0.15,
        maxLife: 0.27,
        baseAlpha: 0.95,
        baseRadius: sparkRadius,
        type: 'spark',
      });
    }
  }

  addVaporSegment(p1: { x: number; y: number }, p2: { x: number; y: number }, size: number = 2.6) {
    const g = this.acquire(0xffffff, 0, 'windstreak'); // routes to glow layer additively
    g.x = 0;
    g.y = 0;
    
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.2) {
      this.release(g);
      return;
    }
    
    g.moveTo(p1.x, p1.y)
     .lineTo(p2.x, p2.y)
     .stroke({ color: 0xf2f6ff, width: size, alpha: 0.5 });

    this.active.push({
      g,
      vx: 0, vy: 0,
      life: 0.55, maxLife: 0.55,
      baseAlpha: 0.5,
      baseRadius: size,
      type: 'windstreak', // keeps scale at 1, only fades alpha
    });
  }

  addRunwayDust(position: { x: number; y: number }, count: number = 1) {
    for (let i = 0; i < count; i++) {
      const radius = 5 + Math.random() * 7;
      const g = this.acquire(0x8a6244, radius, 'smoke');
      g.x = position.x + (Math.random() - 0.5) * 12;
      g.y = position.y + (Math.random() - 0.5) * 4;
      g.scale.set(1);
      this.active.push({
        g,
        vx: -35 - Math.random() * 35,
        vy: -12 - Math.random() * 18,
        life: 0.45 + Math.random() * 0.25,
        maxLife: 0.7,
        baseAlpha: 0.32,
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

  addDirectionalSparks(
    position: { x: number; y: number },
    direction: { x: number; y: number },
    count: number = 10,
    intensity: number = 1,
  ) {
    const palette = [0xffffff, 0xfff6a8, 0xffc34a, 0xff6a22];
    const len = Math.hypot(direction.x, direction.y) || 1;
    const baseA = Math.atan2(direction.y / len, direction.x / len);
    for (let i = 0; i < count; i++) {
      const radius = (1.4 + Math.random() * 2.2) * Math.min(1.7, intensity);
      const color = palette[(Math.random() * palette.length) | 0]!;
      const g = this.acquire(color, radius, 'spark');
      g.x = position.x + (Math.random() - 0.5) * 6;
      g.y = position.y + (Math.random() - 0.5) * 6;
      g.scale.set(1);
      const spread = (Math.random() - 0.5) * Math.PI * 0.9;
      const ang = baseA + spread;
      const sp = (150 + Math.random() * 260) * intensity;
      this.active.push({
        g,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 25,
        life: 0.18 + Math.random() * 0.24,
        maxLife: 0.42,
        baseAlpha: 1,
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

  addWindStreak(position: { x: number; y: number }, heading: number) {
    const g = this.acquire(0xffffff, 0, 'windstreak');
    g.x = position.x;
    g.y = position.y;
    g.rotation = heading + Math.PI;
    this.active.push({
      g, vx: -Math.cos(heading) * 200, vy: -Math.sin(heading) * 200,
      life: 0.15, maxLife: 0.15, baseAlpha: 0.2, baseRadius: 0, type: 'windstreak',
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

  addImpactFlash(position: { x: number; y: number }, radius: number = 8) {
    const g = this.acquire(0xffffff, radius, 'spark'); // routes through glow container via type=spark
    g.x = position.x;
    g.y = position.y;
    g.scale.set(1);
    this.active.push({
      g,
      vx: 0,
      vy: 0,
      life: 0.06,
      maxLife: 0.06,
      baseAlpha: 1.0,
      baseRadius: radius,
      type: 'spark',
    });
  }

  addCasing(position: { x: number; y: number }, heading: number) {
    const g = this.acquire(0xe6bf5e, 0, 'casing'); // brighter brass
    g.x = position.x;
    g.y = position.y;
    g.rotation = Math.random() * Math.PI * 2;
    const back = heading + Math.PI;
    const downA = back + Math.PI * 0.3;
    const sp = 110 + Math.random() * 70; // tossed a bit harder, more visible arc
    this.active.push({
      g,
      vx: Math.cos(downA) * sp,
      vy: Math.sin(downA) * sp - 20,
      life: 0.95,
      maxLife: 0.95,
      baseAlpha: 1,
      baseRadius: 2,
      type: 'casing',
    });
  }

  addDebris(position: { x: number; y: number }, color: number, count: number = 2) {
    for (let i = 0; i < count; i++) {
      const g = this.acquire(color, 0, 'debris');
      g.x = position.x;
      g.y = position.y;
      g.rotation = Math.random() * Math.PI * 2;
      const ang = Math.random() * Math.PI * 2;
      const sp = 130 + Math.random() * 240;
      this.active.push({
        g,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 120,
        life: 1.4 + Math.random() * 0.5,
        maxLife: 1.9,
        baseAlpha: 1,
        baseRadius: 0,
        type: 'debris',
      });
    }
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
      const g = this.acquire(0xffffff, 36, 'spark');
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
        baseRadius: 36,
        type: 'spark',
      });
    }

    // 2. Double shockwave: now + 80ms later (delay driven via update(dt) for determinism)
    this.addShockwave(position);
    this.pendingShockwaves.push({ remainingTime: 0.08, pos: { x: position.x, y: position.y } });

    // 3. Fire bursts
    for (let i = 0; i < 34; i++) {
      const radius = 7 + Math.random() * 13;
      const palette = [0xff3300, 0xff6600, 0xff9c18, 0xffd36a, 0xffffff];
      const color = palette[(Math.random() * palette.length) | 0]!;
      const g = this.acquire(color, radius, 'fire');
      g.x = position.x;
      g.y = position.y;
      g.scale.set(1);
      const ang = Math.random() * Math.PI * 2;
      const sp = 100 + Math.random() * 280;
      this.active.push({
        g,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life: 0.5 + Math.random() * 0.42,
        maxLife: 0.92,
        baseAlpha: 1.0,
        baseRadius: radius,
        type: 'fire',
      });
    }

    // 4. Smoke
    for (let i = 0; i < 24; i++) {
      const radius = 10 + Math.random() * 18;
      const color = Math.random() < 0.55 ? 0x23262d : 0x3a332c;
      const g = this.acquire(color, radius, 'smoke');
      g.x = position.x;
      g.y = position.y;
      g.scale.set(1);
      const ang = Math.random() * Math.PI * 2;
      const sp = 35 + Math.random() * 110;
      this.active.push({
        g,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 20,
        life: 0.9 + Math.random() * 0.65,
        maxLife: 1.55,
        baseAlpha: 0.66,
        baseRadius: radius,
        type: 'smoke',
      });
    }

    // 5. Small chunks
    for (let i = 0; i < 13; i++) {
      const g = this.acquire(0x8a6a3a, 0, 'chunk');
      g.x = position.x;
      g.y = position.y;
      const ang = Math.random() * Math.PI * 2;
      const sp = 150 + Math.random() * 280;
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
      if (p.type === 'debris') {
        p.vy += 400 * dt;
        p.g.rotation += 4 * dt;
      }

      p.g.x += p.vx * dt;
      p.g.y += p.vy * dt;

      // Drag decelerates sparks and explosions
      if (p.type !== 'shockwave' && p.type !== 'chunk' && p.type !== 'casing' && p.type !== 'debris') {
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
      } else if (p.type === 'debris') {
        // Debris chunks keep their size — alpha already fades via baseAlpha * t.
        p.g.scale.set(1);
      } else if (p.type === 'windstreak') {
        // Wind streaks keep their length; alpha already fades via baseAlpha * t.
        p.g.scale.set(1);
      } else {
        // Standard fire/smoke grows slightly as it fades
        p.g.scale.set(0.6 + (1 - t) * 0.8);
      }
    }

    // Cap the active particle count: release the OLDEST particles (front of the
    // array) back to the pool until we're within budget. Mirrors the normal
    // expiry path so pooling stays intact.
    if (this.active.length > MAX_ACTIVE_PARTICLES) {
      const excess = this.active.length - MAX_ACTIVE_PARTICLES;
      for (let i = 0; i < excess; i++) {
        this.release(this.active[i]!.g);
      }
      this.active.splice(0, excess);
    }
  }
}
