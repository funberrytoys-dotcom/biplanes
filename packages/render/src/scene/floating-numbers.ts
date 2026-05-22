import { Container, BitmapText, TextStyle } from 'pixi.js';

interface Num {
  t: BitmapText;
  life: number;
  maxLife: number;
  vy: number;
}

const MAX_ACTIVE = 30;

// Single shared style — BitmapText auto-builds a glyph atlas once per unique
// style. Coloring per-instance is done with `tint`, which is GPU-cheap and does
// NOT re-rasterize the atlas.
const STYLE = new TextStyle({
  fontFamily: 'monospace',
  fontSize: 14,
  fontWeight: 'bold',
  stroke: { color: 0x000000, width: 2 },
  fill: 0xffffff,
});

/**
 * Pooled floating damage numbers using `BitmapText` so that updating `.text`
 * doesn't trigger a per-spawn canvas re-rasterization (the killer for `Text`).
 */
export class FloatingNumbers {
  private active: Num[] = [];
  private pool: BitmapText[] = [];

  constructor(private container: Container) {
    // Pre-warm the BitmapText atlas with every glyph we'll ever use. The first
    // spawn would otherwise rasterize the glyph atlas synchronously — that's
    // the visible hitch the user reported when "numbers appear".
    const warmup = new BitmapText({ text: '-0123456789', style: STYLE });
    warmup.alpha = 0;
    container.addChild(warmup);
    container.removeChild(warmup);
    warmup.destroy();
  }

  spawn(x: number, y: number, value: number, isPlayerDealing: boolean) {
    if (this.active.length >= MAX_ACTIVE) {
      const old = this.active.shift()!;
      if (old.t.parent) old.t.parent.removeChild(old.t);
      this.pool.push(old.t);
    }
    let t = this.pool.pop();
    if (!t) {
      t = new BitmapText({ text: '', style: STYLE });
    }
    t.text = `-${Math.round(value)}`;
    t.tint = isPlayerDealing ? 0xffe066 : 0xff5544;
    t.x = x - t.width / 2;
    t.y = y - 8;
    t.alpha = 1;
    this.container.addChild(t);
    this.active.push({ t, life: 0.6, maxLife: 0.6, vy: -30 });
  }

  update(dt: number) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const n = this.active[i]!;
      n.life -= dt;
      if (n.life <= 0) {
        if (n.t.parent) n.t.parent.removeChild(n.t);
        this.pool.push(n.t);
        this.active.splice(i, 1);
        continue;
      }
      n.t.y += n.vy * dt;
      n.t.alpha = n.life / n.maxLife;
    }
  }
}
