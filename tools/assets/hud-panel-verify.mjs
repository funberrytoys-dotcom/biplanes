import sharp from 'sharp';

const SRC = 'apps/web/public/assets/biplanes/hud/panel.png';
const meta = await sharp(SRC).metadata();
const W = meta.width, H = meta.height;

// --- candidate placement constants (fractions of panel) ---
const GAUGES = [
  { cx: 0.075, cy: 0.52 },
  { cx: 0.165, cy: 0.52 },
  { cx: 0.258, cy: 0.52 },
];
const GAUGE_RADIUS_FRAC = 0.058; // needle length, fraction of panel WIDTH
const LEVERS = [
  { x: 0.605, topY: 0.43, bottomY: 0.66 }, // ГАЗ
  { x: 0.685, topY: 0.43, bottomY: 0.66 }, // ФОРСАЖ
];
const LEVER_W_FRAC = 0.045;
const LAMPS = [
  { x: 0.797, y: 0.40 }, // yellow
  { x: 0.797, y: 0.58 }, // red
];
const LAMP_W_FRAC = 0.032;
const COUNTERS = [
  { x: 0.872, y: 0.43 }, // СБИТО
  { x: 0.872, y: 0.60 }, // ПАТРОНЫ
];
const RADIO = { x: 0.315, y: 0.27 };

const px = (fx, fy) => ({ x: fx * W, y: fy * H });
let s = '';
// gauges: center dot + radius ring + needle pointing up
for (const g of GAUGES) {
  const c = px(g.cx, g.cy);
  const r = GAUGE_RADIUS_FRAC * W;
  s += `<circle cx="${c.x}" cy="${c.y}" r="6" fill="#ff0000"/>`;
  s += `<circle cx="${c.x}" cy="${c.y}" r="${r}" fill="none" stroke="#00e5ff" stroke-width="3"/>`;
  s += `<line x1="${c.x}" y1="${c.y}" x2="${c.x}" y2="${c.y - r}" stroke="#ffff00" stroke-width="4"/>`;
}
// levers: travel line + knob at mid
for (const l of LEVERS) {
  const top = px(l.x, l.topY), bot = px(l.x, l.bottomY);
  const mid = px(l.x, (l.topY + l.bottomY) / 2);
  const kw = LEVER_W_FRAC * W;
  s += `<line x1="${top.x}" y1="${top.y}" x2="${bot.x}" y2="${bot.y}" stroke="#00ff00" stroke-width="2"/>`;
  s += `<rect x="${mid.x - kw / 2}" y="${mid.y - kw / 4}" width="${kw}" height="${kw / 2}" fill="none" stroke="#ff00ff" stroke-width="3"/>`;
}
// lamps
for (const l of LAMPS) {
  const c = px(l.x, l.y);
  s += `<circle cx="${c.x}" cy="${c.y}" r="${LAMP_W_FRAC * W / 2}" fill="none" stroke="#ffffff" stroke-width="3"/>`;
}
// counters
for (const c0 of COUNTERS) {
  const c = px(c0.x, c0.y);
  s += `<rect x="${c.x - 80}" y="${c.y - 28}" width="160" height="56" fill="none" stroke="#ffaa00" stroke-width="3"/>`;
}
// radio text anchor
const rp = px(RADIO.x, RADIO.y);
s += `<rect x="${rp.x}" y="${rp.y}" width="900" height="360" fill="none" stroke="#33ff33" stroke-width="2"/>`;

const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
const composed = await sharp(SRC).composite([{ input: Buffer.from(svg), density: 72, top: 0, left: 0 }]).png().toBuffer();
await sharp(composed).resize(1600).png().toFile('tools/assets/panel_verify.png');
console.log('verify written');
