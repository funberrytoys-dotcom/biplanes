// Generates the Biplanes app icon (home-screen / favicon) by compositing
// Chico's blue biplane onto a dieselpunk sunset sky. Run: node scripts/make-app-icon.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';

const here = dirname(fileURLToPath(import.meta.url));
const pub = resolve(here, '..', 'public');
const planePath = resolve(pub, 'assets/biplanes/plane_chico_blue.png');
const outDir = resolve(pub, 'icons');

const S = 1024;

// Dieselpunk sunset backdrop: warm amber sky up top, rose/violet haze, deep
// twilight floor — echoes the arena's "РАССВЕТ/СУМЕРКИ" palette. A soft sun
// glow anchors the upper third; thin cloud bands add depth.
const bgSvg = `
<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#ffc15a"/>
      <stop offset="30%" stop-color="#f0814f"/>
      <stop offset="58%" stop-color="#b14a86"/>
      <stop offset="82%" stop-color="#5a2c75"/>
      <stop offset="100%" stop-color="#241349"/>
    </linearGradient>
    <radialGradient id="sun" cx="50%" cy="30%" r="42%">
      <stop offset="0%"  stop-color="#fff3c8" stop-opacity="0.95"/>
      <stop offset="38%" stop-color="#ffd27a" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#ffd27a" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="vign" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#000000" stop-opacity="0.18"/>
      <stop offset="22%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="78%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.34"/>
    </linearGradient>
  </defs>
  <rect width="${S}" height="${S}" fill="url(#sky)"/>
  <rect width="${S}" height="${S}" fill="url(#sun)"/>
  <g opacity="0.5" fill="#fce0c0">
    <ellipse cx="300" cy="690" rx="360" ry="34"/>
    <ellipse cx="760" cy="780" rx="300" ry="28"/>
    <ellipse cx="540" cy="600" rx="240" ry="20" opacity="0.7"/>
  </g>
  <rect width="${S}" height="${S}" fill="url(#vign)"/>
</svg>`;

const background = await sharp(Buffer.from(bgSvg)).png().toBuffer();

// Plane scaled to ~78% of icon width, nudged slightly up so it sits on the glow.
const planeW = Math.round(S * 0.8);
const plane = await sharp(planePath)
  .resize({ width: planeW })
  .toBuffer();
const planeMeta = await sharp(plane).metadata();
const left = Math.round((S - planeW) / 2);
const top = Math.round((S - planeMeta.height) / 2 - S * 0.04);

const master = await sharp(background)
  .composite([{ input: plane, left, top }])
  .png()
  .toBuffer();

await mkdir(outDir, { recursive: true });

const sizes = [
  { name: 'icon-1024.png', size: 1024 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-192.png', size: 192 },
  { name: 'apple-touch-icon.png', size: 180 },
];
for (const { name, size } of sizes) {
  await sharp(master).resize(size, size).png().toFile(resolve(outDir, name));
  console.log('wrote', name);
}
// Small favicon for the browser tab.
await sharp(master).resize(48, 48).png().toFile(resolve(pub, 'favicon.png'));
console.log('wrote favicon.png');
