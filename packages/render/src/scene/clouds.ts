import { Assets, Container, Sprite, Texture } from 'pixi.js';
import { WORLD_WIDTH } from '@biplanes/shared';

const GENERATED_CLOUD_URLS = [
  '/assets/biplanes/arena/day/clouds/cloud_bank_01.png',
  '/assets/biplanes/arena/day/clouds/cloud_cumulus_01.png',
  '/assets/biplanes/arena/day/clouds/cloud_cumulus_02.png',
  '/assets/biplanes/arena/day/clouds/cloud_cumulus_03.png',
  '/assets/biplanes/arena/day/clouds/cloud_cumulus_04.png',
  '/assets/biplanes/arena/day/clouds/cloud_cumulus_05.png',
];

const GENERATED_CIRRUS_URLS = [
  '/assets/biplanes/arena/day/cirrus/cloud_cirrus_01.png',
  '/assets/biplanes/arena/day/cirrus/cloud_cirrus_02.png',
  '/assets/biplanes/arena/day/cirrus/cloud_cirrus_03.png',
  '/assets/biplanes/arena/day/cirrus/cloud_cirrus_04.png',
  '/assets/biplanes/arena/day/cirrus/cloud_cirrus_05.png',
  '/assets/biplanes/arena/day/cirrus/cloud_cirrus_06.png',
  '/assets/biplanes/arena/day/cirrus/cloud_cirrus_07.png',
];

const LEGACY_CLOUD_URLS = Array.from(
  { length: 13 },
  (_, i) => `/assets/biplanes/clouds/cloud_highres_transparent_${String(i + 1).padStart(2, '0')}.png`,
);
const CLOUD_URLS = [...GENERATED_CLOUD_URLS, ...GENERATED_CIRRUS_URLS, ...LEGACY_CLOUD_URLS.slice(0, 4)];

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
  update: (dt: number, focusX?: number) => void;
}

export interface CloudSeaOptions {
  count: number;
  yTop: number;
  span: number;
  widthMin: number;
  widthMax: number;
  alphaMin: number;
  alphaMax: number;
  driftSpeed: number;
}

export interface CloudSeaHandle {
  container: Container;
  update: (dt: number, focusX: number) => void;
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

  const urls = opts.useSoft ? [...CLOUD_URLS, ...GENERATED_CLOUD_URLS] : CLOUD_URLS;

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
    update(dt: number, focusX?: number) {
      timeSec += dt;
      const hasFocus = typeof focusX === 'number';
      const span = WORLD_WIDTH * 1.25;
      for (const c of clouds) {
        c.sprite.x -= c.speed * dt;
        const margin = Math.abs(c.sprite.width);
        if (hasFocus) {
          const left = focusX - span * 0.5 - margin;
          const right = focusX + span * 0.5 + margin;
          if (c.sprite.x < left || c.sprite.x > right + 260) {
            c.sprite.x = left + Math.random() * (right - left);
          }
        } else if (c.sprite.x < -margin) {
          c.sprite.x = WORLD_WIDTH + margin;
        }
        c.sprite.y = c.baseY + Math.sin(timeSec * c.bobSpeed + c.phase) * c.bobAmp;
      }
    },
  };
}

export function createCloudSea(opts: CloudSeaOptions): CloudSeaHandle {
  const container = new Container();
  const clouds: CloudInstance[] = [];
  let timeSec = 0;
  let ready = false;
  const urls = [...GENERATED_CLOUD_URLS, ...LEGACY_CLOUD_URLS.slice(0, 3)];

  function restyle(sprite: Sprite, loaded: Record<string, Texture>) {
    const url = urls[Math.floor(Math.random() * urls.length)]!;
    const tex = loaded[url];
    if (!tex) return;
    sprite.texture = tex;
    sprite.anchor.set(0.5);
    const targetW = opts.widthMin + Math.random() * (opts.widthMax - opts.widthMin);
    sprite.scale.set(targetW / (tex.width || 320));
    if (Math.random() < 0.5) sprite.scale.x *= -1;
    sprite.alpha = opts.alphaMin + Math.random() * (opts.alphaMax - opts.alphaMin);
  }

  Assets.load(urls)
    .then((loaded: Record<string, Texture>) => {
      const step = (opts.span * 2) / Math.max(1, opts.count);
      for (let i = 0; i < opts.count; i++) {
        const sprite = new Sprite();
        restyle(sprite, loaded);
        const baseY = opts.yTop + (Math.random() * 95 - 40);
        sprite.x = -opts.span + i * step + Math.random() * step * 0.4;
        sprite.y = baseY;
        container.addChild(sprite);
        clouds.push({
          sprite,
          speed: opts.driftSpeed * (0.7 + Math.random() * 0.6),
          baseY,
          bobAmp: 6 + Math.random() * 12,
          bobSpeed: 0.12 + Math.random() * 0.18,
          phase: Math.random() * Math.PI * 2,
        });
      }
      ready = true;
    })
    .catch(() => {
      // Missing cloud art is non-fatal.
    });

  return {
    container,
    update(dt: number, focusX: number) {
      if (!ready) return;
      timeSec += dt;
      for (const c of clouds) {
        c.sprite.x -= c.speed * dt;
        const margin = Math.max(260, Math.abs(c.sprite.width) * 0.5);
        if (c.sprite.x < focusX - opts.span - margin) {
          c.sprite.x = focusX - opts.span + Math.random() * opts.span * 2;
          c.baseY = opts.yTop + (Math.random() * 95 - 40);
          c.sprite.alpha = opts.alphaMin + Math.random() * (opts.alphaMax - opts.alphaMin);
        } else if (c.sprite.x > focusX + opts.span + margin) {
          c.sprite.x = focusX - opts.span + Math.random() * opts.span * 2;
        }
        c.sprite.y = c.baseY + Math.sin(timeSec * c.bobSpeed + c.phase) * c.bobAmp;
      }
    },
  };
}
