import sharp from 'sharp';

const SRC = 'apps/web/public/assets/biplanes/hud/panel.png';
const meta = await sharp(SRC).metadata();
const W = meta.width, H = meta.height;
const outW = 1600;
const outH = Math.round(H * outW / W);

let lines = '';
for (let i = 0; i <= 20; i++) {
  const x = Math.round((i / 20) * outW);
  const major = i % 2 === 0;
  lines += `<line x1="${x}" y1="0" x2="${x}" y2="${outH}" stroke="${major ? '#00ff88' : '#007744'}" stroke-width="${major ? 2 : 1}" opacity="0.75"/>`;
  if (major) lines += `<text x="${x + 2}" y="16" fill="#00ff88" font-size="15" font-family="monospace">${(i / 20).toFixed(2)}</text>`;
}
for (let j = 0; j <= 10; j++) {
  const y = Math.round((j / 10) * outH);
  lines += `<line x1="0" y1="${y}" x2="${outW}" y2="${y}" stroke="#ff3399" stroke-width="1" opacity="0.7"/>`;
  lines += `<text x="2" y="${Math.max(12, y - 2)}" fill="#ff3399" font-size="15" font-family="monospace">${(j / 10).toFixed(1)}</text>`;
}
const svg = `<svg width="${outW}" height="${outH}" xmlns="http://www.w3.org/2000/svg">${lines}</svg>`;
await sharp(SRC).resize(outW, outH).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toFile('tools/assets/panel_grid.png');
console.log('panel', `${W}x${H}`, '-> grid', `${outW}x${outH}`, 'aspect', (W / H).toFixed(3));
