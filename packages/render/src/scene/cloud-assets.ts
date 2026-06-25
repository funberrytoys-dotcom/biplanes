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
const CLOUD_COUNT = 20; // cloud_01.webp .. cloud_20.webp

/** The whole soft cloud set. */
export const CLOUD_URLS: string[] = Array.from(
  { length: CLOUD_COUNT },
  (_, i) => assetUrl(`assets/clouds/cloud_${String(i + 1).padStart(2, '0')}.webp`),
);

// Back-compat aliases: every layer now draws from the SAME soft set (one style).
// Depth vs foreground is expressed purely through size/opacity, not a different look.
export const CLOUD_LIGHT_URLS = CLOUD_URLS;
export const CLOUD_HERO_URLS = CLOUD_URLS;
export const CLOUD_ALL_URLS = CLOUD_URLS;
