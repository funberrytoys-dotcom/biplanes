import { assetUrl } from '../asset-url.js';

/**
 * THE single source of cloud art for EVERY game mode (arena, run, campaign,
 * demos). Built by tools/assets/build-clouds.mjs from the owner-curated folder
 * `docs/references/CLOUDS FOR USE/` into apps/web/public/assets/clouds/.
 *
 * ONE consistent style only — the soft/warm clouds (owner's call 2026-06-25).
 * The cooler high-contrast cut-outs were dropped (mixing styles looked like a
 * mishmash; their edges read too dark). Do NOT add ad-hoc cloud URLs elsewhere.
 * If clouds change, re-run the build script and update CLOUD_COUNT below.
 */
const CLOUD_COUNT = 20; // cloud_01.webp .. cloud_20.webp on disk

// Phones load HALF the unique cloud textures. Each cloud is a ~1180px webp (~3-4 MB of
// GPU once drawn); the full set of 20 is ~70 MB resident — a big chunk of a weak phone's
// GPU budget that, stacked with everything else, tips low-memory devices over mid-run.
// The clouds are soft, semi-transparent and sized/placed randomly, and the per-field
// sprite COUNT is unchanged — only the number of distinct shapes drops — so 10 reads the
// same as 20 on screen. PC/Steam keep all 20.
const IS_TOUCH = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
const ACTIVE_CLOUD_COUNT = IS_TOUCH ? 10 : CLOUD_COUNT;

/** The soft cloud set actually used this session (halved on phones for GPU memory). */
export const CLOUD_URLS: string[] = Array.from(
  { length: ACTIVE_CLOUD_COUNT },
  (_, i) => assetUrl(`assets/clouds/cloud_${String(i + 1).padStart(2, '0')}.webp`),
);

// Back-compat aliases: every layer now draws from the SAME soft set (one style).
// Depth vs foreground is expressed purely through size/opacity, not a different look.
export const CLOUD_LIGHT_URLS = CLOUD_URLS;
export const CLOUD_HERO_URLS = CLOUD_URLS;
export const CLOUD_ALL_URLS = CLOUD_URLS;
