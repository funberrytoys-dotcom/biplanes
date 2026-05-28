import path from 'node:path';
import fs from 'node:fs/promises';
import sharp from 'sharp';

// Focused re-key for the SOV caravan/escort airships, whose source art ships on
// a solid hot-magenta backdrop. The general prepare-campaign-assets.mjs run also
// regenerates island animation frames from an external desktop folder; this
// script keys just the airships so it can run without that dependency.
//
// Run: node tools/assets/prepare-airship-assets.mjs

const root = process.cwd();
const srcDir = path.join(root, 'tools', 'assets');
const outDir = path.join(root, 'apps', 'web', 'public', 'assets', 'campaign');

const SOLID = 110;
const EDGE = 16;
const DESPILL = 8; // pull any faintly pink-leaning pixel back toward neutral

function keyMagentaInPlace(data) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const magentaness = (r + b) / 2 - g;
    if (magentaness > SOLID) {
      data[i + 3] = 0;
      continue;
    }
    if (magentaness > EDGE) {
      // Feather alpha toward transparent across the magenta edge band.
      const t = (magentaness - EDGE) / (SOLID - EDGE);
      data[i + 3] = Math.round(data[i + 3] * (1 - t));
    }
    // Despill: only true magenta spill carries BOTH red and blue above green
    // (a magenta key, not a blue hull). Clamp red/blue down to green for those
    // so the antialiased outline keeps no pink tint. Pure-blue hull pixels
    // (red below green) are left untouched.
    if (magentaness > DESPILL && r > g && b > g) {
      data[i] = g;
      data[i + 2] = g;
    }
  }
}

async function keyedFeatherPng(input, output, resizeWidth) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  keyMagentaInPlace(data);
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 6 })
    .resize({ width: resizeWidth, withoutEnlargement: true })
    .png()
    .toFile(output);
  console.log(`keyed ${path.basename(output)}`);
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  await keyedFeatherPng(path.join(srcDir, 'airship_extra_3_source.png'), path.join(outDir, 'airship_sov_large.png'), 780);
  await keyedFeatherPng(path.join(srcDir, 'airship_extra_1_source.png'), path.join(outDir, 'airship_sov_variant_1.png'), 760);
  await keyedFeatherPng(path.join(srcDir, 'airship_extra_2_source.png'), path.join(outDir, 'airship_sov_variant_2.png'), 760);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
