import sharp from 'sharp';

async function main() {
  const image = sharp('apps/web/public/assets/biplanes/hud/cockpit_panel.png');
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  
  function getBrightness(x, y) {
    const idx = (y * info.width + x) * 4;
    if (data[idx + 3] < 150) return 255;
    return (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
  }
  
  function getDarkCirclePct(cx, cy, r) {
    let dark = 0, total = 0;
    for (let dy = -r; dy <= r; dy += 3) {
      for (let dx = -r; dx <= r; dx += 3) {
        if (dx*dx + dy*dy <= r*r) {
          const x = cx + dx;
          const y = cy + dy;
          if (x >= 0 && x < info.width && y >= 0 && y < info.height) {
            if (getBrightness(x, y) < 110) dark++; // Dark grey dial face
            total++;
          }
        }
      }
    }
    return total > 0 ? dark / total : 0;
  }

  // Scan Left Bay for circular dials of radius 60, 70, 80, 90
  const radii = [60, 70, 80, 90];
  console.log('Multi-scale Dial Center Scan (Threshold < 110):');
  
  for (const r of radii) {
    const candidates = [];
    for (let y = r + 20; y < info.height - r - 20; y += 6) {
      for (let x = r + 20; x < 400; x += 6) {
        const pct = getDarkCirclePct(x, y, r);
        if (pct > 0.88) {
          candidates.push({ x, y, pct });
        }
      }
    }
    
    // Group candidates by X coordinate
    const d1 = candidates.filter(c => c.x < 160).sort((a,b) => b.pct - a.pct)[0];
    const d2 = candidates.filter(c => c.x >= 160 && c.x <= 280).sort((a,b) => b.pct - a.pct)[0];
    const d3 = candidates.filter(c => c.x > 280).sort((a,b) => b.pct - a.pct)[0];
    
    if (d1 || d2 || d3) {
      console.log(`Radius R=${r}:`);
      if (d1) console.log(`  Dial 1 (RPM): x=${d1.x}, y=${d1.y} (pct=${d1.pct.toFixed(3)})`);
      if (d2) console.log(`  Dial 2 (SPD): x=${d2.x}, y=${d2.y} (pct=${d2.pct.toFixed(3)})`);
      if (d3) console.log(`  Dial 3 (ALT): x=${d3.x}, y=${d3.y} (pct=${d3.pct.toFixed(3)})`);
    }
  }
}

main().catch(console.error);
