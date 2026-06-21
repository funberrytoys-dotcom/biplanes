import { Container, Graphics, ColorMatrixFilter, Texture, Sprite } from 'pixi.js';

export interface ScreenEffectsHandle {
  container: Container;
  flash(color: number, alpha: number, durSec: number): void;
  setVignette(vignettePct: number): void;
  enableDeathTint(): void;
  disableDeathTint(): void;
  triggerOilSplatter(): void;
  /** Ambient windshield oil whose density tracks the player's HP (1 = clean glass). */
  setDamageOil(hpRatio: number): void;
  triggerHitGlitch(): void;
  update(dt: number, timeSec: number, worldRoot: Container): void;
  resize(w: number, h: number): void;
}

interface OilDrop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  trail: { x: number; y: number }[];
}

export function createScreenEffects(width: number, height: number): ScreenEffectsHandle {
  const c = new Container();

  let w = width;
  let h = height;

  // 1. Flash Overlay
  const flashG = new Graphics().rect(0, 0, w, h).fill(0xffffff);
  flashG.alpha = 0;
  c.addChild(flashG);

  // 2. Premium Radial Vignette (Canvas-generated smooth gradient)
  let vignetteSprite: Sprite | null = null;
  let vignetteTexture: Texture | null = null;

  const rebuildRadialVignette = () => {
    if (vignetteSprite) {
      c.removeChild(vignetteSprite);
      vignetteSprite.destroy();
    }
    if (vignetteTexture) {
      vignetteTexture.destroy(true);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Create a gorgeous radial gradient (transparent center, deep blood-red edges)
    const grad = ctx.createRadialGradient(256, 256, 120, 256, 256, 256);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.55, 'rgba(100, 10, 10, 0.15)');
    grad.addColorStop(0.85, 'rgba(60, 4, 4, 0.7)');
    grad.addColorStop(1, 'rgba(18, 0, 0, 0.95)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    vignetteTexture = Texture.from(canvas);
    vignetteSprite = new Sprite(vignetteTexture);
    vignetteSprite.width = w;
    vignetteSprite.height = h;
    vignetteSprite.alpha = 0;
    c.addChild(vignetteSprite);
  };

  rebuildRadialVignette();

  // 3. Chromatic Aberration Hit Glitch overlay (neon pink / cyan rapid alternate frames)
  const glitchG = new Graphics();
  glitchG.visible = false;
  c.addChild(glitchG);
  let glitchLife = 0;
  const GLITCH_DURATION = 0.16; // 160ms flash

  // 4. Physical Oil Splatters
  const oilDropsG = new Graphics();
  c.addChild(oilDropsG);
  let oilDrops: OilDrop[] = [];
  let oilHpRatio = 1;     // 1 = full HP / clean glass
  let oilSpawnAcc = 0;

  const deathFilter = new ColorMatrixFilter();
  let deathTintActive = false;

  let flashLife = 0;
  let flashMaxLife = 0;
  let flashAlpha = 0;
  let baseVignette = 0;

  return {
    container: c,
    flash(color, alpha, durSec) {
      flashG.clear().rect(0, 0, w, h).fill(color);
      flashAlpha = alpha;
      flashLife = durSec;
      flashMaxLife = durSec;
    },
    setVignette(pct) {
      baseVignette = Math.max(0, Math.min(1, pct));
    },
    enableDeathTint() { deathTintActive = true; },
    disableDeathTint() { deathTintActive = false; },
    triggerOilSplatter() {
      // Spawn 2-4 oil droplets at random spots on the screen
      const count = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        oilDrops.push({
          x: Math.random() * w,
          y: Math.random() * (h * 0.4), // upper viewport
          vx: (Math.random() - 0.5) * 8,
          vy: 12 + Math.random() * 20, // downward slide speed
          life: 3.0 + Math.random() * 2.5,
          maxLife: 5.5,
          size: 2.2 + Math.random() * 2.8,
          trail: []
        });
      }
    },
    setDamageOil(hpRatio) {
      oilHpRatio = Math.max(0, Math.min(1, hpRatio));
    },
    triggerHitGlitch() {
      glitchLife = GLITCH_DURATION;
    },
    update(dt, timeSec, worldRoot) {
      if (flashLife > 0) {
        flashLife = Math.max(0, flashLife - dt);
        flashG.alpha = (flashLife / flashMaxLife) * flashAlpha;
      } else {
        flashG.alpha = 0;
      }

      // Pulse radial vignette on low HP (Task 1.7)
      const pulse = 0.8 + 0.2 * Math.sin(timeSec * 12);
      if (vignetteSprite) {
        vignetteSprite.alpha = baseVignette * pulse;
      }

      // Chromatic Aberration RGB split visual trick (Phase 2.3)
      if (glitchLife > 0) {
        glitchLife -= dt;
        glitchG.visible = true;
        glitchG.clear();
        
        // High frequency flicker offset
        const phase = Math.sin(timeSec * 140);
        const shiftX = phase * 6.5;
        const alphaFrac = glitchLife / GLITCH_DURATION;

        // Draw neon magenta shifted left, neon cyan shifted right
        glitchG.rect(shiftX, 0, w, h).fill({ color: 0xff0066, alpha: 0.16 * alphaFrac });
        glitchG.rect(-shiftX, 0, w, h).fill({ color: 0x00ffcc, alpha: 0.16 * alphaFrac });
      } else {
        glitchG.visible = false;
      }

      // Ambient windshield oil — density scales with player damage (clean glass above
      // 60% HP, heavily splattered toward 20%), like rain beads on a fast windscreen.
      // Beads keep respawning as old ones slide off, so low HP stays persistently oily.
      // Starts with light damage (below ~85% HP) and ramps to heavy near 15% — so it's
      // clearly visible after the first couple of hits, not just at near-death.
      const oilDmg = Math.max(0, Math.min(1, (0.85 - oilHpRatio) / (0.85 - 0.15)));
      // Capped LOW + short trails (below) — this whole Graphics is re-tessellated every
      // frame, so a big drop count is what tanked the framerate at low HP.
      if (oilDmg > 0 && oilDrops.length < 26) {
        oilSpawnAcc += oilDmg * 9 * dt;
        while (oilSpawnAcc >= 1 && oilDrops.length < 26) {
          oilSpawnAcc -= 1;
          oilDrops.push({
            x: Math.random() * w,
            y: Math.random() * (h * 0.82),
            vx: (Math.random() - 0.5) * 10,
            vy: 8 + Math.random() * 18,
            life: 2.6 + Math.random() * 2.4,
            maxLife: 5.0,
            size: 2.4 + Math.random() * 3.0,
            trail: [],
          });
        }
      } else {
        oilSpawnAcc = 0;
      }

      // Physical Oil Drops Simulation (Phase 2.2)
      oilDropsG.clear();
      for (let i = oilDrops.length - 1; i >= 0; i--) {
        const drop = oilDrops[i]!;
        drop.life -= dt;
        if (drop.life <= 0) {
          oilDrops.splice(i, 1);
          continue;
        }

        // Drop Y movement with gravity and deceleration
        drop.vy *= 1 - 0.25 * dt;
        drop.vx *= 1 - 0.2 * dt;
        
        // Save trail coordinates before moving
        drop.trail.push({ x: drop.x, y: drop.y });
        if (drop.trail.length > 5) {
          drop.trail.shift();
        }

        drop.x += drop.vx * dt;
        drop.y += drop.vy * dt;

        // Draw drip trail (thickest near droplet, thins out upward)
        if (drop.trail.length > 1) {
          oilDropsG.moveTo(drop.trail[0]!.x, drop.trail[0]!.y);
          for (let k = 1; k < drop.trail.length; k++) {
            const pt = drop.trail[k]!;
            oilDropsG.lineTo(pt.x, pt.y);
          }
          oilDropsG.stroke({ color: 0x180f08, width: drop.size * 0.35, alpha: 0.55 * (drop.life / drop.maxLife) });
        }

        // Draw droplet head (solid dark amber/brown color)
        oilDropsG.circle(drop.x, drop.y, drop.size)
                 .fill({ color: 0x0f0904, alpha: 0.82 * (drop.life / drop.maxLife) });
      }

      // Desaturation death filter
      if (deathTintActive) {
        const hasFilter = Array.isArray(worldRoot.filters) && worldRoot.filters.includes(deathFilter);
        if (!hasFilter) {
          deathFilter.reset();
          deathFilter.saturate(-0.6, true);
          worldRoot.filters = [deathFilter];
        }
      } else if (Array.isArray(worldRoot.filters) && worldRoot.filters.includes(deathFilter)) {
        worldRoot.filters = null;
      }
    },
    resize(nw, nh) {
      w = nw;
      h = nh;
      // Reuse the existing vignette texture — the radial gradient is
      // scale-independent, so we only stretch the sprite instead of rebuilding
      // a fresh 512x512 canvas + Texture every resize.
      if (vignetteSprite) {
        vignetteSprite.width = w;
        vignetteSprite.height = h;
      }
      flashG.clear().rect(0, 0, w, h).fill(0xffffff);
      flashG.alpha = 0;
    },
  };
}
