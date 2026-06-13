import sharp from 'sharp';

async function main() {
  const image = sharp('apps/web/public/assets/biplanes/hud/cockpit_panel.png');
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  
  console.log(`Image size: ${info.width}x${info.height}`);
  
  function getPixel(x, y) {
    const idx = (y * info.width + x) * 4;
    return {
      r: data[idx],
      g: data[idx + 1],
      b: data[idx + 2],
      a: data[idx + 3]
    };
  }
  
  function isDark(x, y) {
    const p = getPixel(x, y);
    return (p.r + p.g + p.b) / 3 < 50;
  }
  
  function isBrass(x, y) {
    const p = getPixel(x, y);
    return p.r > 120 && p.g > 90 && p.b < 100 && (p.r - p.b) > 40;
  }
  
  // A dial is characterized by:
  // - Dark center (radius 0 to 45)
  // - Brass/Bezel rim (radius 55 to 65)
  function evaluateDialScore(cx, cy) {
    let darkPoints = 0;
    let darkTotal = 0;
    let brassPoints = 0;
    let brassTotal = 0;
    
    // Sample inside circle
    for (let r = 5; r <= 45; r += 5) {
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
        const x = Math.round(cx + Math.cos(angle) * r);
        const y = Math.round(cy + Math.sin(angle) * r);
        if (x >= 0 && x < info.width && y >= 0 && y < info.height) {
          if (isDark(x, y)) darkPoints++;
          darkTotal++;
        }
      }
    }
    
    // Sample rim
    for (let r = 52; r <= 64; r += 3) {
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
        const x = Math.round(cx + Math.cos(angle) * r);
        const y = Math.round(cy + Math.sin(angle) * r);
        if (x >= 0 && x < info.width && y >= 0 && y < info.height) {
          if (isBrass(x, y)) brassPoints++;
          brassTotal++;
        }
      }
    }
    
    const darkPct = darkTotal > 0 ? darkPoints / darkTotal : 0;
    const brassPct = brassTotal > 0 ? brassPoints / brassTotal : 0;
    return darkPct * 0.6 + brassPct * 0.4;
  }

  console.log('Scanning Left Bay for Dials:');
  function findBestDial(xMin, xMax, yMin, yMax) {
    let bestX = 0, bestY = 0, maxScore = 0;
    for (let y = yMin; y < yMax; y += 2) {
      for (let x = xMin; x < xMax; x += 2) {
        const score = evaluateDialScore(x, y);
        if (score > maxScore) {
          maxScore = score;
          bestX = x;
          bestY = y;
        }
      }
    }
    return { x: bestX, y: bestY, score: maxScore };
  }

  const dial1 = findBestDial(50, 180, 80, 260);
  const dial2 = findBestDial(180, 300, 80, 260);
  const dial3 = findBestDial(300, 420, 80, 260);

  console.log('Detected Dial Centers:');
  console.log('Dial 1 (RPM):', dial1);
  console.log('Dial 2 (Speed):', dial2);
  console.log('Dial 3 (Altitude):', dial3);
}

main().catch(console.error);
