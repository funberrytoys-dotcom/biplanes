import sharp from 'sharp';

async function main() {
  const image = sharp('apps/web/public/assets/biplanes/hud/cockpit_panel.png');
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  
  // Find brass pixels: R > 130, G > 90, B < 90, and R - B > 50, R - G < 80
  function isBrass(x, y) {
    const idx = (y * info.width + x) * 4;
    if (data[idx + 3] < 200) return false;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    return r > 120 && g > 90 && b < 100 && (r - b) > 40;
  }
  
  // Group brass pixels into three dials based on X ranges
  // Dial 1: x in [40, 160]
  // Dial 2: x in [160, 280]
  // Dial 3: x in [280, 400]
  function getCentroid(xMin, xMax, yMin, yMax) {
    let sumX = 0, sumY = 0, count = 0;
    for (let y = yMin; y < yMax; y++) {
      for (let x = xMin; x < xMax; x++) {
        if (isBrass(x, y)) {
          sumX += x;
          sumY += y;
          count++;
        }
      }
    }
    return count > 0 ? { x: Math.round(sumX / count), y: Math.round(sumY / count), count } : null;
  }
  
  const dial1 = getCentroid(40, 160, 50, 240);
  const dial2 = getCentroid(160, 280, 50, 240);
  const dial3 = getCentroid(280, 400, 50, 240);
  
  console.log('Centroids of Dial Brass Rings:');
  console.log('Dial 1 (RPM):', dial1);
  console.log('Dial 2 (Speed):', dial2);
  console.log('Dial 3 (Altitude):', dial3);

  // Let's do the same for the two Center Bay portrait frames
  // Portrait 1: x in [400, 500], y in [40, 160]
  // Portrait 2: x in [400, 500], y in [160, 280]
  const port1 = getCentroid(400, 500, 40, 160);
  const port2 = getCentroid(400, 500, 160, 280);
  console.log('Centroids of Portrait Frames (Brass):');
  console.log('Portrait 1:', port1);
  console.log('Portrait 2:', port2);

  // Let's do the same for the two lamps on the right:
  // Lamp 1: x in [780, 860], y in [80, 200]
  // Lamp 2: x in [860, 960], y in [80, 200]
  const lamp1 = getCentroid(780, 860, 80, 200);
  const lamp2 = getCentroid(860, 960, 80, 200);
  console.log('Centroids of Right Lamps (Brass):');
  console.log('Lamp 1:', lamp1);
  console.log('Lamp 2:', lamp2);
}

main().catch(console.error);
