import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const srcDir = path.join(root, 'tools', 'assets');
const outDir = path.join(root, 'apps', 'web', 'public', 'assets', 'campaign');
const islandOutDir = path.join(outDir, 'island_brynn');
const islandSrcDir = 'C:/Users/serge/Downloads/sprite/sprite';

async function ensureDirs() {
  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(islandOutDir, { recursive: true });
}

function keyMagenta({ r, g, b, a = 255 }) {
  const isHotPink = r > 180 && b > 150 && g < 100;
  const isPinkEdge = r > 150 && b > 130 && g < 135 && r - g > 45 && b - g > 40;
  const isMutedMagentaEdge = r > 95 && b > 95 && g < 115 && r - g > 28 && b - g > 28 && Math.abs(r - b) < 95;
  return isHotPink || isPinkEdge || isMutedMagentaEdge ? 0 : a;
}

function keyChecker({ r, g, b, a = 255 }) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max - min;
  const isLightNeutral = max > 232 && saturation < 18;
  return isLightNeutral ? 0 : a;
}

// Hot-magenta chroma key with edge feather + magenta despill, mirroring the
// green-screen approach in prepare-cloud-assets.mjs. Magentaness = how far the
// red+blue average sits above green. Solid key (>SOLID) → transparent; edge band
// (EDGE..SOLID) → feather alpha toward 0. Despill clamps red/blue down to green
// for pixels that lean magenta in BOTH channels (true spill, not a blue hull),
// so the antialiased outline keeps no pink halo. In-place on a raw RGBA buffer.
function keyMagentaInPlace(data) {
  const SOLID = 110;
  const EDGE = 16;
  const DESPILL = 8;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const magentaness = (r + b) / 2 - g;
    if (magentaness > SOLID) {
      data[i + 3] = 0; // solid magenta background → transparent
      continue;
    }
    if (magentaness > EDGE) {
      const t = (magentaness - EDGE) / (SOLID - EDGE);
      data[i + 3] = Math.round(data[i + 3] * (1 - t));
    }
    // Only true magenta spill has red AND blue above green; pure-blue hull
    // pixels (red below green) are left untouched.
    if (magentaness > DESPILL && r > g && b > g) {
      data[i] = g;
      data[i + 2] = g;
    }
  }
}

async function keyedFeatherPng(input, output, keyInPlace, { resizeWidth = null, extract = null, trimThreshold = 6 } = {}) {
  let image = sharp(input).ensureAlpha();
  if (extract) image = image.extract(extract);
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  keyInPlace(data);
  let out = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
  out = out.trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: trimThreshold });
  if (resizeWidth) out = out.resize({ width: resizeWidth, withoutEnlargement: true });
  await out.png().toFile(output);
}

async function keyedPng(input, output, keyFn, { trim = true, resizeWidth = null, extract = null } = {}) {
  let image = sharp(input).ensureAlpha();
  if (extract) image = image.extract(extract);
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    data[i + 3] = keyFn({
      r: data[i],
      g: data[i + 1],
      b: data[i + 2],
      a: data[i + 3],
    });
  }

  let out = sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  });
  if (trim) out = out.trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 4 });
  if (resizeWidth) out = out.resize({ width: resizeWidth, withoutEnlargement: true });
  await out.png().toFile(output);
}

async function copyIslandFrames() {
  const files = (await fs.readdir(islandSrcDir))
    .filter((name) => /^sprite_\d+\.png$/i.test(name))
    .sort((a, b) => a.localeCompare(b));

  let index = 0;
  for (const file of files) {
    index += 1;
    const input = path.join(islandSrcDir, file);
    const output = path.join(islandOutDir, `frame_${String(index).padStart(4, '0')}.png`);
    await sharp(input)
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 4 })
      .resize({ width: 420, withoutEnlargement: true })
      .png()
      .toFile(output);
  }
  await fs.writeFile(path.join(islandOutDir, 'frames.json'), JSON.stringify({ count: index, fps: 18 }, null, 2));
}

async function main() {
  await ensureDirs();

  await keyedPng(
    path.join(srcDir, 'portrait_chico_source.png'),
    path.join(outDir, 'portrait_chico.png'),
    keyMagenta,
    { resizeWidth: 420 },
  );

  await keyedPng(
    path.join(srcDir, 'plane_scar_source.png'),
    path.join(outDir, 'plane_scar.png'),
    keyMagenta,
    { resizeWidth: 720, extract: { left: 0, top: 0, width: 2520, height: 1460 } },
  );

  await keyedPng(
    path.join(srcDir, 'caravan_source.png'),
    path.join(outDir, 'caravan_sov.png'),
    keyChecker,
    { resizeWidth: 780 },
  );

  // The airship_extra_* sources ship on a solid hot-magenta backdrop, so they
  // need the magenta chroma key with edge feather (plain trim / light-neutral
  // key left the magenta box intact in-game).
  await keyedFeatherPng(
    path.join(srcDir, 'airship_extra_3_source.png'),
    path.join(outDir, 'airship_sov_large.png'),
    keyMagentaInPlace,
    { resizeWidth: 780 },
  );

  for (const [source, target] of [
    ['airship_extra_1_source.png', 'airship_sov_variant_1.png'],
    ['airship_extra_2_source.png', 'airship_sov_variant_2.png'],
  ]) {
    await keyedFeatherPng(
      path.join(srcDir, source),
      path.join(outDir, target),
      keyMagentaInPlace,
      { resizeWidth: 760 },
    );
  }

  await copyIslandFrames();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
