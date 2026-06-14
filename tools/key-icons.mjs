// One-off: chroma-key the green background out of the generated HUD icons and
// export clean transparent PNGs into the web asset folder.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const refs = join(root, 'docs', 'references');
const outDir = join(root, 'apps', 'web', 'public', 'assets', 'biplanes', 'hud', 'icons');

const jobs = [
  ['icon_src_fire.png', 'icon_fire.png'],
  ['icon_src_salvo.png', 'icon_salvo.png'],
  ['icon_src_boost.png', 'icon_boost.png'],
  ['icon_src_eject.png', 'icon_eject.png'],
];

const OUT_SIZE = 256;

await mkdir(outDir, { recursive: true });

for (const [src, dest] of jobs) {
  const { data, info } = await sharp(join(refs, src))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const greenDom = g - Math.max(r, b);
    if (g > 100 && greenDom > 40) {
      data[i + 3] = 0; // chroma-key: bright green → transparent
    } else if (greenDom > 12) {
      // De-spill green fringing on icon edges without harming teal/cream.
      data[i + 1] = Math.max(r, b);
    }
  }

  await sharp(data, { raw: { width, height, channels: 4 } })
    .resize(OUT_SIZE, OUT_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(outDir, dest));

  console.log(`keyed ${dest} (${width}x${height} -> ${OUT_SIZE})`);
}

console.log('done');
