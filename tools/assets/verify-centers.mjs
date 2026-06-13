import sharp from 'sharp';

async function main() {
  const image = sharp('apps/web/public/assets/biplanes/hud/cockpit_panel.png');
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  
  // Draw red overlay markers on a copy of the buffer
  const outData = Buffer.from(data);
  
  function drawDot(cx, cy, r, color) {
    for (let y = Math.max(0, cy - r); y < Math.min(info.height, cy + r); y++) {
      for (let x = Math.max(0, cx - r); x < Math.min(info.width, cx + r); x++) {
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        if (dist <= r) {
          const idx = (y * info.width + x) * 4;
          outData[idx] = color[0];     // R
          outData[idx + 1] = color[1]; // G
          outData[idx + 2] = color[2]; // B
          outData[idx + 3] = 255;      // A
        }
      }
    }
  }

  // Draw RPM, Speed, Altitude centers
  drawDot(98, 157, 5, [255, 0, 0]); // RPM (estimated)
  drawDot(216, 157, 5, [255, 0, 0]); // Speed (estimated)
  drawDot(338, 157, 5, [255, 0, 0]); // Altimeter (estimated)

  // From precise-hud.mjs
  drawDot(84, 181, 4, [0, 0, 255]); // RPM (from pixel scan)
  drawDot(193, 171, 4, [0, 0, 255]); // Speed (from pixel scan)
  drawDot(317, 187, 4, [0, 0, 255]); // Altimeter (from pixel scan)

  // Let's also draw the actual Dial centers by manually inspecting the green screen image or
  // using a visual overlay.
  // Let's save this file so we can view it, or we can check the layout.
  await sharp(outData, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile('docs/references/hud_verify.png');
    
  console.log('Saved verification overlay to docs/references/hud_verify.png');
}

main().catch(console.error);
