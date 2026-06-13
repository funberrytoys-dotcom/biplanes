import sharp from 'sharp';

async function main() {
  const image = sharp('apps/web/public/assets/biplanes/hud/cockpit_panel.png');
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  
  function getBrightness(x, y) {
    const idx = (y * info.width + x) * 4;
    if (data[idx + 3] < 150) return 255;
    return (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
  }
  
  // A dial face is a dark circle of radius ≈ 55
  function getDarkCirclePct(cx, cy, r) {
    let dark = 0, total = 0;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx*dx + dy*dy <= r*r) {
          const x = cx + dx;
          const y = cy + dy;
          if (x >= 0 && x < info.width && y >= 0 && y < info.height) {
            if (getBrightness(x, y) < 45) dark++;
            total++;
          }
        }
      }
    }
    return total > 0 ? dark / total : 0;
  }

  // Restrict search Y to [100, 300] to avoid bottom odometers
  const candidates = [];
  for (let y = 100; y < 300; y += 4) {
    for (let x = 60; x < 400; x += 4) {
      const pct = getDarkCirclePct(x, y, 55);
      if (pct > 0.75) {
        candidates.push({ x, y, pct });
      }
    }
  }
  
  // Group candidates into 3 distinct peaks based on X distance
  function getBestInGroup(filterFn) {
    const group = candidates.filter(filterFn);
    let best = null;
    for (const c of group) {
      if (!best || c.pct > best.pct) best = c;
    }
    if (best) {
      let refX = best.x, refY = best.y, maxPct = best.pct;
      for (let y = best.y - 3; y <= best.y + 3; y++) {
        for (let x = best.x - 3; x <= best.x + 3; x++) {
          const pct = getDarkCirclePct(x, y, 55);
          if (pct > maxPct) {
            maxPct = pct;
            refX = x;
            refY = y;
          }
        }
      }
      return { x: refX, y: refY, pct: maxPct };
    }
    return null;
  }
  
  const dial1 = getBestInGroup(c => c.x < 180);
  const dial2 = getBestInGroup(c => c.x >= 180 && c.x <= 290);
  const dial3 = getBestInGroup(c => c.x > 290);
  
  console.log('Dial Centers in range Y [100, 300]:');
  console.log('Dial 1 (RPM):', dial1);
  console.log('Dial 2 (Speed):', dial2);
  console.log('Dial 3 (Altitude):', dial3);

  // Stacked portrait frames in Center Bay (X in [390, 650])
  // Restrict X to [400, 480], search for square centroids
  function getSquareDarkPct(cx, cy, size) {
    let dark = 0, total = 0;
    const half = Math.floor(size / 2);
    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < info.width && y >= 0 && y < info.height) {
          if (getBrightness(x, y) < 45) dark++;
          total++;
        }
      }
    }
    return total > 0 ? dark / total : 0;
  }
  
  const portCandidates = [];
  for (let y = 80; y < 400; y += 4) {
    for (let x = 410; x < 470; x += 4) {
      const pct = getSquareDarkPct(x, y, 80);
      if (pct > 0.70) {
        portCandidates.push({ x, y, pct });
      }
    }
  }
  
  const p1 = portCandidates.filter(c => c.y < 240).sort((a,b) => b.pct - a.pct)[0];
  const p2 = portCandidates.filter(c => c.y >= 240).sort((a,b) => b.pct - a.pct)[0];
  console.log('Portrait Centers:');
  console.log('Portrait 1 (top):', p1);
  console.log('Portrait 2 (bottom):', p2);
}

main().catch(console.error);
