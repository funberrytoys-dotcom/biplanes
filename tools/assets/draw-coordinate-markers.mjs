import sharp from 'sharp';

async function main() {
  const image = sharp('apps/web/public/assets/biplanes/hud/cockpit_panel.png');
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  
  const outData = Buffer.from(data);
  
  // Draw green crosshairs on a grid of coordinates
  function drawCrosshair(cx, cy, label) {
    const size = 10;
    const color = [0, 255, 0]; // Green
    
    // Draw horizontal line
    for (let x = Math.max(0, cx - size); x < Math.min(info.width, cx + size); x++) {
      const idx = (cy * info.width + x) * 4;
      outData[idx] = color[0];
      outData[idx + 1] = color[1];
      outData[idx + 2] = color[2];
      outData[idx + 3] = 255;
    }
    
    // Draw vertical line
    for (let y = Math.max(0, cy - size); y < Math.min(info.height, cy + size); y++) {
      const idx = (y * info.width + cx) * 4;
      outData[idx] = color[0];
      outData[idx + 1] = color[1];
      outData[idx + 2] = color[2];
      outData[idx + 3] = 255;
    }
  }

  // Let's sweep coordinates for dials
  // Let's guess:
  // Dial 1 (RPM): x=120, y=240
  // Dial 2 (SPD): x=240, y=240
  // Dial 3 (ALT): x=360, y=240
  // Portraits:
  // p1: x=480, y=160
  // p2: x=480, y=320
  // Levers:
  // l1: x=680, y=240
  // l2: x=740, y=240
  // Lamps:
  // lamp1: x=840, y=160
  // lamp2: x=920, y=160
  // Counters:
  // c1: x=840, y=320
  // c2: x=920, y=320

  const guesses = [
    { x: 120, y: 240 },
    { x: 240, y: 240 },
    { x: 360, y: 240 },
    { x: 480, y: 160 },
    { x: 480, y: 320 },
    { x: 680, y: 240 },
    { x: 740, y: 240 },
    { x: 840, y: 160 },
    { x: 920, y: 160 },
    { x: 840, y: 320 },
    { x: 920, y: 320 }
  ];

  for (const g of guesses) {
    drawCrosshair(g.x, g.y);
  }

  await sharp(outData, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile('docs/references/hud_coordinates.png');
    
  console.log('Saved crosshair coordinate verification to docs/references/hud_coordinates.png');
}

main().catch(console.error);
