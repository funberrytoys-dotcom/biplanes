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

  await keyedPng(
    path.join(srcDir, 'airship_extra_3_source.png'),
    path.join(outDir, 'airship_sov_large.png'),
    keyChecker,
    { resizeWidth: 780 },
  );

  for (const [source, target] of [
    ['airship_extra_1_source.png', 'airship_sov_variant_1.png'],
    ['airship_extra_2_source.png', 'airship_sov_variant_2.png'],
  ]) {
    await sharp(path.join(srcDir, source))
      .ensureAlpha()
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 4 })
      .resize({ width: 760, withoutEnlargement: true })
      .png()
      .toFile(path.join(outDir, target));
  }

  await copyIslandFrames();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
