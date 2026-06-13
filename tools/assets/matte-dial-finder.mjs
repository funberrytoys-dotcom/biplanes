import sharp from 'sharp';

async function main() {
  const image = sharp('apps/web/public/assets/biplanes/hud/cockpit_panel.png');
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  
  function getBrightness(x, y) {
    const idx = (y * info.width + x) * 4;
    if (data[idx + 3] < 150) return 255; // transparent is not dark
    return (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
  }
  
  // A dial face is a dark circle of radius ≈ 75
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

  // Scan Left Bay (x in [50, 420], y in [80, 400]) for Dial 1, 2, 3
  // Dials should have radius ≈ 75
  const R_DIAL = 72;
  
  console.log('Scanning for 3 large matte black circular dials (Radius 72)...');
  
  // Let's sweep on a 5px grid to find candidates
  const candidates = [];
  for (let y = 100; y < info.height - 100; y += 5) {
    for (let x = 80; x < 420; x += 5) {
      const pct = getDarkCirclePct(x, y, R_DIAL);
      if (pct > 0.75) {
        candidates.push({ x, y, pct });
      }
    }
  }
  
  // Group candidates into 3 distinct peaks based on X distance
  // Peak 1: x < 180
  // Peak 2: x in [180, 300]
  // Peak 3: x > 300
  function getBestInGroup(filterFn) {
    const group = candidates.filter(filterFn);
    let best = null;
    for (const c of group) {
      if (!best || c.pct > best.pct) best = c;
    }
    // Refine around the best candidate
    if (best) {
      let refX = best.x, refY = best.y, maxPct = best.pct;
      for (let y = best.y - 4; y <= best.y + 4; y++) {
        for (let x = best.x - 4; x <= best.x + 4; x++) {
          const pct = getDarkCirclePct(x, y, R_DIAL);
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
  const dial2 = getBestInGroup(c => c.x >= 180 && c.x <= 300);
  const dial3 = getBestInGroup(c => c.x > 300);
  
  console.log('Dial 1:', dial1);
  console.log('Dial 2:', dial2);
  console.log('Dial 3:', dial3);
  
  // Let's search for the two portrait frames in the Center Bay!
  // Center Bay X range is around [400, 650]. Portrait frames are squares of size ≈ 90x90.
  // Let's scan for two dark squares of size 85x85.
  console.log('Scanning for 2 stacked square portrait frames (90x90)...');
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
  for (let y = 60; y < info.height - 60; y += 4) {
    for (let x = 400; x < 500; x += 4) {
      const pct = getSquareDarkPct(x, y, 90);
      if (pct > 0.65) {
        portCandidates.push({ x, y, pct });
      }
    }
  }
  
  // Peak 1: y < info.height / 2
  // Peak 2: y >= info.height / 2
  const p1 = portCandidates.filter(c => c.y < info.height / 2).sort((a,b) => b.pct - a.pct)[0];
  const p2 = portCandidates.filter(c => c.y >= info.height / 2).sort((a,b) => b.pct - a.pct)[0];
  console.log('Portrait 1 (top):', p1);
  console.log('Portrait 2 (bottom):', p2);
}

main().catch(console.error);
