// Build the SINGLE unified cloud library used by every game mode.
//
// Owner picked ONE consistent style (2026-06-25): the SOFT / warm clouds
// (`cloud_hires_*` in docs/references/CLOUDS FOR USE/). The cooler high-contrast
// cut-outs (`*_transparent_*`) are intentionally NOT shipped — mixing the two
// styles looked like a mishmash and the cut-out edges read too dark.
//
// Output (web build): apps/web/public/assets/clouds/cloud_NN.webp — one coherent
// soft set. WebP keeps the soft alpha gradients crisp at a fraction of PNG weight.
// Run: node tools/assets/build-clouds.mjs
import sharp from 'sharp';
import { readdirSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

const SRC = 'docs/references/CLOUDS FOR USE';
const OUT = 'apps/web/public/assets/clouds';
const MAX = 1180; // longest-side cap
const WEBP = { quality: 84, alphaQuality: 94, effort: 5 };

const soft = readdirSync(SRC)
  .filter((f) => f.toLowerCase().endsWith('.png') && f.includes('hires') && !f.includes('transparent'))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// The upscaler baked a dark, cool-grey matte into the semi-transparent rim of the
// source PNGs, which reads as a dirty dark fringe on a blue sky. Lift ONLY the
// low-alpha edge pixels toward a neutral light grey; the opaque core and ALL alpha
// values are left untouched (so clouds stay exactly as dense, never paler).
const LO = 20, HI = 200, STR = 0.85;
const TARGET = [202, 202, 202];
const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

let total = 0;
let n = 0;
for (const f of soft) {
  n += 1;
  const { data, info } = await sharp(join(SRC, f))
    .resize({ width: MAX, height: MAX, fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a <= 0) continue;
    const w = smooth((HI - a) / (HI - LO)) * STR; // 1 at low alpha -> 0 at high alpha
    if (w <= 0) continue;
    data[i] = Math.round(data[i] * (1 - w) + TARGET[0] * w);
    data[i + 1] = Math.round(data[i + 1] * (1 - w) + TARGET[1] * w);
    data[i + 2] = Math.round(data[i + 2] * (1 - w) + TARGET[2] * w);
    // alpha (data[i+3]) intentionally UNCHANGED -> density preserved
  }
  const out = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .webp(WEBP)
    .toFile(join(OUT, `cloud_${String(n).padStart(2, '0')}.webp`));
  total += out.size;
}
console.log(`clouds: ${n} files, ${Math.round(total / 1024)} KB`);
console.log(`COUNT ${n}`);
