import sharp from 'sharp';

async function main() {
  const image = sharp('apps/web/public/assets/biplanes/hud/cockpit_panel.png');
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  
  // A pixel is dark if (R+G+B)/3 < 35 and alpha is opaque
  function isDark(x, y) {
    const idx = (y * info.width + x) * 4;
    if (data[idx + 3] < 200) return false;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    return (r + g + b) / 3 < 35;
  }
  
  // Let's find columns in the left bay that are very dark (dial centers)
  // Let's print out the profile of dark pixels along X (y around 150)
  const yMid = 145;
  const darkProfileX = [];
  for (let x = 0; x < info.width; x++) {
    let darkCount = 0;
    for (let y = yMid - 50; y < yMid + 50; y++) {
      if (isDark(x, y)) darkCount++;
    }
    darkProfileX.push({ x, darkCount });
  }
  
  // Find local maxima of darkCount in X to find dial columns
  // Dial 1 column should be around x=90
  // Dial 2 column around x=210
  // Dial 3 column around x=330
  // Let's find the exact center of each peak
  function findPeak(start, end) {
    let maxVal = -1;
    let maxIdx = -1;
    for (let i = start; i < end; i++) {
      if (darkProfileX[i].darkCount > maxVal) {
        maxVal = darkProfileX[i].darkCount;
        maxIdx = i;
      }
    }
    // refine peak by averaging indices where value is near max
    let sum = 0, count = 0;
    for (let i = start; i < end; i++) {
      if (darkProfileX[i].darkCount >= maxVal * 0.9 && darkProfileX[i].darkCount > 0) {
        sum += i;
        count++;
      }
    }
    return count > 0 ? Math.round(sum / count) : maxIdx;
  }
  
  const cx1 = findPeak(40, 150);
  const cx2 = findPeak(150, 260);
  const cx3 = findPeak(260, 380);
  
  // Now find vertical centers for each dial
  function findYCenter(cx) {
    let darkProfileY = [];
    for (let y = 30; y < info.height - 30; y++) {
      let darkCount = 0;
      for (let x = cx - 30; x < cx + 30; x++) {
        if (isDark(x, y)) darkCount++;
      }
      darkProfileY.push({ y, darkCount });
    }
    let maxVal = -1, maxY = -1;
    for (const p of darkProfileY) {
      if (p.darkCount > maxVal) {
        maxVal = p.darkCount;
        maxY = p.y;
      }
    }
    let sum = 0, count = 0;
    for (const p of darkProfileY) {
      if (p.darkCount >= maxVal * 0.9 && p.darkCount > 0) {
        sum += p.y;
        count++;
      }
    }
    return count > 0 ? Math.round(sum / count) : maxY;
  }
  
  const cy1 = findYCenter(cx1);
  const cy2 = findYCenter(cx2);
  const cy3 = findYCenter(cx3);
  
  console.log(`RPM Dial Center: x=${cx1}, y=${cy1}`);
  console.log(`Speed Dial Center: x=${cx2}, y=${cy2}`);
  console.log(`Altitude Dial Center: x=${cx3}, y=${cy3}`);
  
  // Let's inspect the two portrait frames in the Center Bay
  // Center bay: x in [394, 650]. The frames are stacked on the left, let's find dark squares.
  // A frame is around 80x80 px or similar. Let's find the centers of the two stacked frames.
  // Let's sample a vertical strip in the center bay (say x = 460)
  const portraitX = 460;
  console.log('Scanning Center Bay portrait frames:');
  // We can search for the frames by looking at Y centers of the two square portrait regions.
  const cy_p1 = findYCenter(460); // wait, let's look at peaks in Y profile for x in [420, 500]
  
  // Let's scan X range [400, 500] and Y range [30, 290] for two dark squares.
  function findDarkSquare(yStart, yEnd) {
    let bestX = 0, bestY = 0, maxDark = 0;
    for (let y = yStart + 30; y < yEnd - 30; y++) {
      for (let x = 420; x < 490; x++) {
        let count = 0;
        for (let dy = -25; dy <= 25; dy++) {
          for (let dx = -25; dx <= 25; dx++) {
            if (isDark(x + dx, y + dy)) count++;
          }
        }
        if (count > maxDark) {
          maxDark = count;
          bestX = x;
          bestY = y;
        }
      }
    }
    return { x: bestX, y: bestY, count: maxDark };
  }
  
  const p1 = findDarkSquare(20, 150);
  const p2 = findDarkSquare(150, 290);
  console.log(`Portrait 1 Square Center: x=${p1.x}, y=${p1.y} (density: ${p1.count})`);
  console.log(`Portrait 2 Square Center: x=${p2.x}, y=${p2.y} (density: ${p2.count})`);

  // Let's scan the Right Bay for lamps:
  // Lamps are round unlit housings. Let's look for dark circles in x in [780, 950]
  // Lamp 1 (GAS): x around 820, y around 135 (from mockup look: they are circular dials on the right)
  // Lamp 2 (HEAT): x around 900, y around 135
  // Let's scan for circles in Y in [80, 200]
  function findLamp(xMin, xMax) {
    let bestX = 0, bestY = 0, maxDark = 0;
    for (let y = 100; y < 180; y++) {
      for (let x = xMin; x < xMax; x++) {
        let count = 0;
        for (let dy = -12; dy <= 12; dy++) {
          for (let dx = -12; dx <= 12; dx++) {
            if (isDark(x + dx, y + dy)) count++;
          }
        }
        if (count > maxDark) {
          maxDark = count;
          bestX = x;
          bestY = y;
        }
      }
    }
    return { x: bestX, y: bestY };
  }
  
  const lamp1 = findLamp(780, 860);
  const lamp2 = findLamp(860, 940);
  console.log(`Right Bay Lamp 1 (GAS) Center: x=${lamp1.x}, y=${lamp1.y}`);
  console.log(`Right Bay Lamp 2 (HEAT) Center: x=${lamp2.x}, y=${lamp2.y}`);
  
  // Let's find lever slots in Right Bay:
  // Lever 1 (GAS): vertical slot, x around 680-720
  // Lever 2 (FORSAZH): vertical slot, x around 730-760
  // Let's scan columns for maximum dark pixels in Y (height approx 80px, y in [100, 220])
  function findLeverColumn(xMin, xMax) {
    let bestX = 0, maxDark = 0;
    for (let x = xMin; x < xMax; x++) {
      let count = 0;
      for (let y = 100; y < 220; y++) {
        if (isDark(x, y)) count++;
      }
      if (count > maxDark) {
        maxDark = count;
        bestX = x;
      }
    }
    return bestX;
  }
  const leverX1 = findLeverColumn(670, 720);
  const leverX2 = findLeverColumn(720, 780);
  console.log(`Lever 1 (GAS) Column: x=${leverX1}`);
  console.log(`Lever 2 (FORSAZH) Column: x=${leverX2}`);
}

main().catch(console.error);
