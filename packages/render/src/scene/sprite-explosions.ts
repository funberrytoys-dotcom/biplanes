import { Assets, Container, Sprite, Texture, Rectangle } from 'pixi.js';
import { assetUrl } from '../asset-url.js';

/** Explosion size tiers: turrets → small, planes → medium, big objects → large. */
export type ExplosionTier = 'small' | 'medium' | 'large';

interface ActiveExplosion {
  sprite: Sprite;
  frames: Texture[];
  t: number;
  dur: number;
}

interface TierCfg {
  url: string;
  baseScale: number; // on-screen scale of the 256px frame for this tier
  dur: number;       // seconds for the full 24-frame play
}

// All three sheets are a clean 4-col x 6-row grid of 24 frames, 256px cells
// (built by tools/assets/build-explosions.mjs from the owner's frames).
const SHEET_FRAME = 256;
const SHEET_COLS = 4;
const SHEET_ROWS = 6;

// dur = seconds to play all 24 frames. Kept long enough that every frame breathes
// (owner: the 24-frame sheets must animate SMOOTH, not flash by). ~24 frames over
// these times ≈ 27 / 21 / 16 fps — slow, weighty blasts.
const TIERS: Record<ExplosionTier, TierCfg> = {
  small: { url: assetUrl('assets/fx/explosion_small.webp'), baseScale: 0.62, dur: 0.9 },
  medium: { url: assetUrl('assets/fx/explosion_medium.webp'), baseScale: 0.95, dur: 1.15 },
  large: { url: assetUrl('assets/fx/explosion_large.webp'), baseScale: 1.7, dur: 1.5 },
};

/**
 * Plays the explosion sprite sheets as one-shot animations at a world position.
 * Three size tiers (assets/fx/explosion_{small,medium,large}.webp).
 *
 * Sheets load ASYNC via Assets.load with a try/catch + guards — slicing a not-yet-
 * loaded Texture.from() crashed the whole game at startup ('undefined is not an object,
 * n.source'). This class must NEVER throw: if a sheet is missing/slow, explosions simply
 * don't show and the game keeps running; spawns before load are skipped.
 */
export class SpriteExplosions {
  private active: ActiveExplosion[] = [];
  private frames: Record<ExplosionTier, Texture[]> = { small: [], medium: [], large: [] };

  constructor(private container: Container) {
    for (const tier of Object.keys(TIERS) as ExplosionTier[]) {
      void this.loadSheet(tier);
    }
  }

  private async loadSheet(tier: ExplosionTier): Promise<void> {
    try {
      const base = await Assets.load<Texture>(TIERS[tier].url);
      const source = base?.source;
      if (!source) return;
      const frames: Texture[] = [];
      for (let r = 0; r < SHEET_ROWS; r++) {
        for (let c = 0; c < SHEET_COLS; c++) {
          frames.push(new Texture({
            source,
            frame: new Rectangle(c * SHEET_FRAME, r * SHEET_FRAME, SHEET_FRAME, SHEET_FRAME),
          }));
        }
      }
      this.frames[tier] = frames;
    } catch {
      /* asset missing/slow — explosions just don't show; the game keeps running */
    }
  }

  /** tier: 'small' (turrets) | 'medium' (planes) | 'large' (objects). scale multiplies the tier base. */
  spawn(x: number, y: number, tier: ExplosionTier = 'medium', scale = 1): void {
    const cfg = TIERS[tier];
    const frames = this.frames[tier];
    const first = frames[0];
    if (!first) return; // not loaded yet / failed — skip safely
    const s = new Sprite(first);
    s.anchor.set(0.5);
    s.x = x;
    s.y = y;
    s.scale.set(scale * cfg.baseScale);
    this.container.addChild(s);
    this.active.push({ sprite: s, frames, t: 0, dur: cfg.dur });
  }

  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i]!;
      a.t += dt;
      const idx = Math.min(a.frames.length - 1, Math.floor((a.t / a.dur) * a.frames.length));
      a.sprite.texture = a.frames[idx]!;
      if (a.t >= a.dur) {
        a.sprite.parent?.removeChild(a.sprite);
        a.sprite.destroy();
        this.active.splice(i, 1);
      }
    }
  }

  clear(): void {
    for (const a of this.active) {
      a.sprite.parent?.removeChild(a.sprite);
      a.sprite.destroy();
    }
    this.active = [];
  }
}
