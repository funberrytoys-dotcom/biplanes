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
      // Don't RE-STACK overlapping flashes into a continuous bright wash (rapid fire / rapid
      // kills used to keep re-arming the overlay before it decayed → a constant ~8 Hz full-screen
      // luminance ripple = eye strain). Keep the STRONGER of current vs incoming so it still
      // decays back to zero between events.
      flashAlpha = Math.max(flashAlpha, alpha);
      flashLife = Math.max(flashLife, durSec);
      flashMaxLife = Math.max(flashMaxLife, durSec);
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
    update(dt, _timeSec, worldRoot) {
      if (flashLife > 0) {
        flashLife = Math.max(0, flashLife - dt);
        flashG.alpha = (flashLife / flashMaxLife) * flashAlpha;
      } else {
        flashG.alpha = 0;
      }

      // Low-HP vignette held STEADY. It used to throb at 0.8+0.2*sin(timeSec*12) (~1.9 Hz), which
      // ran for whole rounds while damaged (esp. one-life «Забег») = a persistent peripheral
      // brightness oscillation. The steady red ring still clearly reads as "low HP".
      if (vignetteSprite) {
        vignetteSprite.alpha = baseVignette;
      }

      // Hit-glitch chromatic split — CALMED. It used a ~22 Hz sine strobe (sin(timeSec*140)) that,
      // retriggered on every hit in a firefight, became a near-constant high-saturation colour
      // flicker. Now it just fades out smoothly (monotonic decay, smaller offset + alpha).
      if (glitchLife > 0) {
        glitchLife -= dt;
        glitchG.visible = true;
        glitchG.clear();
        const alphaFrac = Math.max(0, glitchLife / GLITCH_DURATION);
        const shiftX = alphaFrac * 3;
        glitchG.rect(shiftX, 0, w, h).fill({ color: 0xff0066, alpha: 0.08 * alphaFrac });
        glitchG.rect(-shiftX, 0, w, h).fill({ color: 0x00ffcc, alpha: 0.08 * alphaFrac });
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
      if (oilDmg > 0 && oilDrops.length < 16) {
        oilSpawnAcc += oilDmg * 9 * dt;
        while (oilSpawnAcc >= 1 && oilDrops.length < 16) {
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
        
        drop.x += drop.vx * dt;
        drop.y += drop.vy * dt;

        // Bead head only — the per-drop drip TRAIL (a stroke per drop, every frame) was
        // the framerate killer at low HP. Beads read fine as windscreen oil on their own.
        oilDropsG.circle(drop.x, drop.y, drop.size)
                 .fill({ color: 0x0f0904, alpha: 0.82 * (drop.life / drop.maxLife) });
      }

      // Desaturation death filter. Splice deathFilter in/out of whatever filters the
      // worldRoot already has instead of replacing/nulling the whole array, so a filter
      // owned by another system isn't clobbered on enable or wiped on disable.
      const current = worldRoot.filters;
      const arr = Array.isArray(current) ? [...current] : current ? [current] : [];
      const hasFilter = arr.includes(deathFilter);
      if (deathTintActive) {
        if (!hasFilter) {
          deathFilter.reset();
          deathFilter.saturate(-0.6, true);
          worldRoot.filters = [...arr, deathFilter];
        }
      } else if (hasFilter) {
        const remaining = arr.filter(f => f !== deathFilter);
        worldRoot.filters = remaining.length > 0 ? remaining : null;
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
