import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const outDir = path.join(root, 'apps/web/public/assets/biplanes/arena/backgrounds');
const referenceDir = path.join(root, 'docs/references/generated-arena-assets');
const width = 4800;
const height = 1620;

const SOURCES = {
  clear: 'C:/Comnfy/v14/ComfyUI/comfyui/ComfyUI/output/upscaler/upscaler_00017_.png',
  pink: 'C:/Comnfy/v14/ComfyUI/comfyui/ComfyUI/output/upscaler/upscaler_00015_.png',
  fire: 'C:/Comnfy/v14/ComfyUI/comfyui/ComfyUI/output/upscaler/upscaler_00016_.png',
  night: 'C:/Comnfy/v14/ComfyUI/comfyui/ComfyUI/output/upscaler/upscaler_00014_.png',
};

const variants = [
  {
    name: 'arena_01_clear_morning.jpg',
    source: SOURCES.clear,
    modulate: { brightness: 1.08, saturation: 1.08, hue: -4 },
    tint: { color: '#ffe1a8', alpha: 0.055 },
  },
  {
    name: 'arena_02_rose_sunset.jpg',
    source: SOURCES.pink,
    modulate: { brightness: 1.03, saturation: 1.2, hue: -4 },
    tint: { color: '#ff77b6', alpha: 0.05 },
  },
  {
    name: 'arena_03_star_night.jpg',
    source: SOURCES.night,
    modulate: { brightness: 1.02, saturation: 1.08, hue: 0 },
    tint: { color: '#061642', alpha: 0.04 },
    stars: true,
  },
  {
    name: 'arena_04_burning_horizon.jpg',
    source: SOURCES.fire,
    modulate: { brightness: 1.0, saturation: 1.16, hue: 0 },
    tint: { color: '#ff6a32', alpha: 0.02 },
  },
  {
    name: 'arena_05_snow_squall.jpg',
    source: SOURCES.clear,
    modulate: { brightness: 1.12, saturation: 0.52, hue: 8 },
    tint: { color: '#d9f3ff', alpha: 0.24 },
    haze: 'snow',
  },
  {
    name: 'arena_06_final_storm.jpg',
    source: SOURCES.night,
    modulate: { brightness: 0.56, saturation: 0.8, hue: 22 },
    tint: { color: '#101a36', alpha: 0.34 },
    glow: { color: '#dbe9ff', alpha: 0.2, cx: 0.7, cy: 0.18, r: 0.36 },
    lightning: true,
  },
  {
    name: 'arena_07_high_cloud_sea.jpg',
    source: SOURCES.clear,
    modulate: { brightness: 1.03, saturation: 1.12, hue: 0 },
    tint: { color: '#78c8ff', alpha: 0.02 },
  },
  {
    name: 'arena_08_violet_twilight.jpg',
    source: SOURCES.pink,
    modulate: { brightness: 0.88, saturation: 1.08, hue: 22 },
    tint: { color: '#4b2f9a', alpha: 0.18 },
    stars: true,
  },
  {
    name: 'arena_09_storm_front.jpg',
    source: SOURCES.night,
    modulate: { brightness: 0.7, saturation: 0.62, hue: 10 },
    tint: { color: '#202b42', alpha: 0.24 },
  },
  {
    name: 'arena_10_thunderheads.jpg',
    source: SOURCES.night,
    modulate: { brightness: 0.62, saturation: 0.78, hue: 18 },
    tint: { color: '#111b35', alpha: 0.3 },
    glow: { color: '#dbe9ff', alpha: 0.16, cx: 0.72, cy: 0.18, r: 0.34 },
    lightning: true,
  },
  {
    name: 'arena_11_ember_sea.jpg',
    source: SOURCES.fire,
    modulate: { brightness: 0.9, saturation: 1.22, hue: -9 },
    tint: { color: '#9b174c', alpha: 0.11 },
  },
  {
    name: 'arena_12_moonlit_fog.jpg',
    source: SOURCES.night,
    modulate: { brightness: 0.86, saturation: 0.72, hue: 8 },
    tint: { color: '#9bb8ff', alpha: 0.1 },
    haze: 'moonFog',
    stars: true,
  },
  {
    name: 'arena_13_cold_front.jpg',
    source: SOURCES.clear,
    modulate: { brightness: 0.96, saturation: 0.48, hue: 18 },
    tint: { color: '#c8eaff', alpha: 0.28 },
    haze: 'cold',
  },
  {
    name: 'arena_14_golden_break.jpg',
    source: SOURCES.clear,
    modulate: { brightness: 1.12, saturation: 0.98, hue: -13 },
    tint: { color: '#ffd36e', alpha: 0.13 },
    glow: { color: '#ffe9a8', alpha: 0.1, cx: 0.5, cy: 0.58, r: 0.46 },
  },
  {
    name: 'arena_15_boss_approach.jpg',
    source: SOURCES.night,
    modulate: { brightness: 0.48, saturation: 0.9, hue: 30 },
    tint: { color: '#210b2f', alpha: 0.34 },
    glow: { color: '#ff496e', alpha: 0.12, cx: 0.52, cy: 0.68, r: 0.45 },
    stars: true,
  },
];

function svgOverlay(width, height, color, alpha, extra = '') {
  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="${color}" opacity="${alpha}"/>
      ${extra}
    </svg>
  `);
}

function starsSvg(width, height) {
  let stars = '';
  for (let i = 0; i < 240; i++) {
    const x = (i * 997) % width;
    const y = ((i * 433) % Math.floor(height * 0.5)) + 18;
    const r = 0.65 + ((i * 17) % 24) / 24;
    const a = 0.18 + ((i * 31) % 62) / 100;
    stars += `<circle cx="${x}" cy="${y}" r="${r.toFixed(2)}" fill="#ffffff" opacity="${a.toFixed(2)}"/>`;
  }
  return stars;
}

function softGlowSvg(width, height, glow) {
  const cx = `${Math.round(glow.cx * 100)}%`;
  const cy = `${Math.round(glow.cy * 100)}%`;
  const r = `${Math.round(glow.r * 100)}%`;
  return `
    <defs>
      <radialGradient id="softGlow" cx="${cx}" cy="${cy}" r="${r}">
        <stop offset="0%" stop-color="${glow.color}" stop-opacity="${glow.alpha}"/>
        <stop offset="45%" stop-color="${glow.color}" stop-opacity="${glow.alpha * 0.42}"/>
        <stop offset="100%" stop-color="${glow.color}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#softGlow)"/>
  `;
}

function hazeSvg(width, height, kind) {
  const stops = kind === 'snow'
    ? [
      ['0%', 0], ['42%', 0.08], ['72%', 0.2], ['100%', 0.26],
    ]
    : kind === 'moonFog'
      ? [
        ['0%', 0], ['38%', 0.03], ['78%', 0.15], ['100%', 0.22],
      ]
      : [
        ['0%', 0], ['48%', 0.06], ['80%', 0.18], ['100%', 0.24],
      ];
  const stopSvg = stops
    .map(([offset, opacity]) => `<stop offset="${offset}" stop-color="#ffffff" stop-opacity="${opacity}"/>`)
    .join('');
  return `
    <defs>
      <linearGradient id="haze" x1="0" y1="0" x2="0" y2="1">${stopSvg}</linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#haze)"/>
  `;
}

function lightningSvg(width, height) {
  return `
    <path d="M ${Math.round(width * 0.68)} ${Math.round(height * 0.06)}
             L ${Math.round(width * 0.64)} ${Math.round(height * 0.22)}
             L ${Math.round(width * 0.68)} ${Math.round(height * 0.2)}
             L ${Math.round(width * 0.62)} ${Math.round(height * 0.42)}"
          fill="none" stroke="#eaf4ff" stroke-width="7" stroke-linecap="round" opacity="0.32"/>
    <path d="M ${Math.round(width * 0.68)} ${Math.round(height * 0.06)}
             L ${Math.round(width * 0.64)} ${Math.round(height * 0.22)}
             L ${Math.round(width * 0.68)} ${Math.round(height * 0.2)}
             L ${Math.round(width * 0.62)} ${Math.round(height * 0.42)}"
          fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" opacity="0.56"/>
  `;
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(referenceDir, { recursive: true });

  for (const variant of variants) {
    let extra = '';
    if (variant.stars) extra += starsSvg(width, height);
    if (variant.glow) extra += softGlowSvg(width, height, variant.glow);
    if (variant.haze) extra += hazeSvg(width, height, variant.haze);
    if (variant.lightning) extra += lightningSvg(width, height);

    const overlays = [{ input: svgOverlay(width, height, variant.tint.color, variant.tint.alpha, extra), blend: 'over' }];
    const outPath = path.join(outDir, variant.name);

    await sharp(variant.source)
      .resize(width, height, { fit: 'cover', position: 'center', kernel: 'lanczos3' })
      .modulate(variant.modulate)
      .composite(overlays)
      .jpeg({ quality: 88, mozjpeg: true })
      .toFile(outPath);

    await sharp(outPath)
      .jpeg({ quality: 92, mozjpeg: true })
      .toFile(path.join(referenceDir, variant.name));
  }
}

await main();
