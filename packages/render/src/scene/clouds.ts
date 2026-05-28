import { Assets, Container, Sprite, Texture } from 'pixi.js';
import { WORLD_WIDTH } from '@biplanes/shared';

// Sliced cartoon clouds (1..16 are white/grey puffs; 17..20 are stormy and kept
// out of the ambient pool so normal skies stay calm).
const SHEET_URLS = Array.from(
  { length: 16 },
  (_, i) => `/assets/biplanes/clouds/cloud_${String(i + 1).padStart(2, '0')}.png`,
);
const SOFT_URL = '/assets/biplanes/clouds/cloud_soft.png';

export interface CloudFieldOptions {
  count: number;
  yMin: number;
  yMax: number;
  widthMin: number;
  widthMax: number;
  alphaMin: number;
  alphaMax: number;
  speedMin: number;
  speedMax: number;
  /** include the soft photoreal cloud (good for dense foreground banks) */
  useSoft?: boolean;
}

export interface CloudFieldHandle {
  container: Container;
  update: (dt: number) => void;
}

interface CloudInstance {
  sprite: Sprite;
  speed: number;
  baseY: number;
  bobAmp: number;
  bobSpeed: number;
  phase: number;
}

/**
 * A field of drifting cloud sprites in WORLD space. Add the returned container
 * BELOW the plane layer for background depth, or ABOVE it so planes fly into and
 * behind the clouds (concealment feel). Cosmetic only — never touches the sim.
 */
export function createCloudField(opts: CloudFieldOptions): CloudFieldHandle {
  const container = new Container();
  const clouds: CloudInstance[] = [];
  let timeSec = 0;

  const urls = opts.useSoft ? [SOFT_URL, SOFT_URL, ...SHEET_URLS] : SHEET_URLS;

  Assets.load(urls)
    .then((loaded: Record<string, Texture>) => {
      for (let i = 0; i < opts.count; i++) {
        const url = urls[Math.floor(Math.random() * urls.length)]!;
        const tex = loaded[url];
        if (!tex) continue;
        const sprite = new Sprite(tex);
        sprite.anchor.set(0.5);
        const targetW = opts.widthMin + Math.random() * (opts.widthMax - opts.widthMin);
        sprite.scale.set(targetW / (tex.width || 320));
        sprite.alpha = opts.alphaMin + Math.random() * (opts.alphaMax - opts.alphaMin);
        const baseY = opts.yMin + Math.random() * (opts.yMax - opts.yMin);
        sprite.x = Math.random() * WORLD_WIDTH;
        sprite.y = baseY;
        if (Math.random() < 0.5) sprite.scale.x *= -1; // mirror for variety
        container.addChild(sprite);
        clouds.push({
          sprite,
          speed: opts.speedMin + Math.random() * (opts.speedMax - opts.speedMin),
          baseY,
          bobAmp: 3 + Math.random() * 7,
          bobSpeed: 0.15 + Math.random() * 0.25,
          phase: Math.random() * Math.PI * 2,
        });
      }
    })
    .catch(() => {
      // Missing cloud art is non-fatal — the field just stays empty.
    });

  return {
    container,
    update(dt: number) {
      timeSec += dt;
      for (const c of clouds) {
        c.sprite.x -= c.speed * dt;
        const margin = Math.abs(c.sprite.width);
        if (c.sprite.x < -margin) c.sprite.x = WORLD_WIDTH + margin;
        c.sprite.y = c.baseY + Math.sin(timeSec * c.bobSpeed + c.phase) * c.bobAmp;
      }
    },
  };
}
