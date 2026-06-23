import { Container, Sprite, Texture, Rectangle } from 'pixi.js';
import { assetUrl } from '../asset-url.js';

interface ActiveExplosion {
  sprite: Sprite;
  frames: Texture[];
  t: number;
  dur: number;
}

/** Slice a grid sprite sheet into per-frame textures (shares the GPU source). */
function sliceSheet(url: string, frame: number, cols: number, rows: number): Texture[] {
  const sheet = Texture.from(url);
  const out: Texture[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push(new Texture({ source: sheet.source, frame: new Rectangle(c * frame, r * frame, frame, frame) }));
    }
  }
  return out;
}

/**
 * Plays the procedural explosion sprite sheets (assets/fx/explosion_{small,large}.png) as
 * one-shot animations at a world position. Small = planes/turrets, large = big objects
 * (airship sections, boss). Normal blend (the sheet has its own fire + smoke + alpha).
 */
export class SpriteExplosions {
  private active: ActiveExplosion[] = [];
  private small: Texture[];
  private large: Texture[];

  constructor(private container: Container) {
    this.small = sliceSheet(assetUrl('assets/fx/explosion_small.png'), 128, 4, 2); // 8 frames
    this.large = sliceSheet(assetUrl('assets/fx/explosion_large.png'), 256, 4, 4); // 16 frames
  }

  spawn(x: number, y: number, big = false, scale = 1): void {
    const frames = big ? this.large : this.small;
    const first = frames[0];
    if (!first) return;
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
