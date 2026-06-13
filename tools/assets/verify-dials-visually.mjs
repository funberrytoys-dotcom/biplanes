import sharp from 'sharp';

async function main() {
  const image = sharp('apps/web/public/assets/biplanes/hud/cockpit_panel.png');
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  
  const outData = Buffer.from(data);
  
  function drawCrosshair(cx, cy, color = [0, 255, 0]) {
    const size = 15;
    for (let x = Math.max(0, cx - size); x < Math.min(info.width, cx + size); x++) {
      const idx = (cy * info.width + x) * 4;
      outData[idx] = color[0]; outData[idx+1] = color[1]; outData[idx+2] = color[2]; outData[idx+3] = 255;
    }
    for (let y = Math.max(0, cy - size); y < Math.min(info.height, cy + size); y++) {
      const idx = (y * info.width + cx) * 4;
      outData[idx] = color[0]; outData[idx+1] = color[1]; outData[idx+2] = color[2]; outData[idx+3] = 255;
    }
  }

  // Draw crosshairs at candidate coordinates:
  drawCrosshair(100, 142, [255, 0, 0]); // Dial 1 (Red)
  drawCrosshair(219, 142, [255, 0, 0]); // Dial 2 (Red)
  drawCrosshair(342, 142, [255, 0, 0]); // Dial 3 (Red)
  
  // From multiscale scan
  drawCrosshair(90, 150, [0, 0, 255]); // Dial 1 (Blue)
  drawCrosshair(215, 145, [0, 0, 255]); // Dial 2 (Blue)
  drawCrosshair(338, 148, [0, 0, 255]); // Dial 3 (Blue)

  // Top portrait frame
  drawCrosshair(442, 100, [0, 255, 0]); // (Green)
  // Bottom portrait frame
  drawCrosshair(441, 208, [0, 255, 0]); // (Green)

  // Lever slots
  drawCrosshair(703, 160, [255, 255, 0]); // Lever 1 (Yellow)
  drawCrosshair(755, 160, [255, 255, 0]); // Lever 2 (Yellow)

  // Lamps
  drawCrosshair(833, 131, [255, 0, 255]); // Lamp 1 (Magenta)
  drawCrosshair(911, 136, [255, 0, 255]); // Lamp 2 (Magenta)

  // Counters
  drawCrosshair(833, 234, [0, 255, 255]); // Counter 1 (Cyan)
  drawCrosshair(911, 234, [0, 255, 255]); // Counter 2 (Cyan)

  await sharp(outData, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile('docs/references/hud_coordinates_verify.png');
    
  console.log('Saved verification overlay to docs/references/hud_coordinates_verify.png');
}

main().catch(console.error);
