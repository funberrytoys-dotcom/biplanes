import sharp from 'sharp';

const SRC = 'apps/web/public/assets/biplanes/hud/panel.png';
const meta = await sharp(SRC).metadata();
const W = meta.width, H = meta.height;

// crops defined in fractions of the panel: [fx0, fx1]
const crops = {
  left: [0.0, 0.35],   // gauges
  mid: [0.55, 0.78],   // levers + lamps
  right: [0.78, 1.0],  // counters
};

for (const [name, [fx0, fx1]] of Object.entries(crops)) {
  const x0 = Math.round(fx0 * W);
  const cw = Math.round((fx1 - fx0) * W);
  const outW = 1200;
  const outH = Math.round(H * outW / cw);
  let lines = '';
  // vertical lines every 0.01 of PANEL width across this crop
  for (let f = Math.ceil(fx0 * 100); f <= Math.floor(fx1 * 100); f++) {
    const fx = f / 100;
    const x = Math.round((fx - fx0) / (fx1 - fx0) * outW);
    const major = f % 5 === 0;
    lines += `<line x1="${x}" y1="0" x2="${x}" y2="${outH}" stroke="${major ? '#00ff88' : '#005533'}" stroke-width="${major ? 2 : 1}" opacity="0.8"/>`;
    if (major) lines += `<text x="${x + 1}" y="18" fill="#00ff88" font-size="16" font-family="monospace">${fx.toFixed(2)}</text>`;
  }
  // horizontal lines every 0.05 of PANEL height
  for (let j = 0; j <= 20; j++) {
    const fy = j / 20;
    const y = Math.round(fy * outH);
    const major = j % 2 === 0;
    lines += `<line x1="0" y1="${y}" x2="${outW}" y2="${y}" stroke="${major ? '#ff3399' : '#883355'}" stroke-width="1" opacity="0.8"/>`;
    if (major) lines += `<text x="2" y="${Math.max(14, y - 2)}" fill="#ff3399" font-size="16" font-family="monospace">${fy.toFixed(2)}</text>`;
  }
  const svg = `<svg width="${outW}" height="${outH}" xmlns="http://www.w3.org/2000/svg">${lines}</svg>`;
  await sharp(SRC)
    .extract({ left: x0, top: 0, width: cw, height: H })
    .resize(outW, outH)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png().toFile(`tools/assets/panel_crop_${name}.png`);
  console.log(`crop ${name}: panel x ${fx0}..${fx1} -> ${outW}x${outH}`);
}
