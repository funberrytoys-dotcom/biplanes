import { Assets, Container, Sprite, Texture, Rectangle } from 'pixi.js';
import { assetUrl } from '../asset-url.js';

interface ActiveExplosion {
  sprite: Sprite;
  frames: Texture[];
  t: number;
  dur: number;
}

/**
 * Plays the procedural explosion sprite sheets (assets/fx/explosion_{small,large}.png) as
 * one-shot animations at a world position. Small = planes/turrets, large = big objects.
 *
 * Sheets are loaded ASYNC via Assets.load with a try/catch + guards — slicing a not-yet-
 * loaded Texture.from() crashed the whole game at startup ('undefined is not an object,
 * n.source'). This class must NEVER throw: if a sheet is missing/slow, explosions simply
 * don't show and the game keeps running; spawns before load are skipped.
 */
export class SpriteExplosions {
  private active: ActiveExplosion[] = [];
  private small: Texture[] = [];
  private large: Texture[] = [];

  constructor(private container: Container) {
    void this.loadSheet(assetUrl('assets/fx/explosion_small.png'), 128, 4, 2, 'small'); // 8 frames
    void this.loadSheet(assetUrl('assets/fx/explosion_large.png'), 256, 4, 4, 'large'); // 16 frames
  }

  private async loadSheet(url: string, frame: number, cols: number, rows: number, which: 'small' | 'large'): Promise<void> {
    try {
      const base = await Assets.load<Texture>(url);
      const source = base?.source;
      if (!source) return;
      const frames: Texture[] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          frames.push(new Texture({ source, frame: new Rectangle(c * frame, r * frame, frame, frame) }));
        }
      }
      if (which === 'small') this.small = frames;
      else this.large = frames;
    } catch {
      /* asset missing/slow — explosions just don't show; the game keeps running */
    }
  }

  spawn(x: number, y: number, big = false, scale = 1): void {
    const frames = big ? this.large : this.small;
    const first = frames[0];
    if (!first) return; // not loaded yet / failed — skip safely
    const s = new Sprite(first);
    s.anchor.set(0.5);
    s.x = x;
    s.y = y;
    s.scale.set(scale * (big ? 1.1 : 1.3));
    this.container.addChild(s);
    this.active.push({ sprite: s, frames, t: 0, dur: big ? 0.55 : 0.42 });
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
