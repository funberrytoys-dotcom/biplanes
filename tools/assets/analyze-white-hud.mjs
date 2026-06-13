import sharp from 'sharp';

async function main() {
  const image = sharp('apps/web/public/assets/biplanes/hud/cockpit_panel.png');
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  
  console.log(`Image size: ${info.width}x${info.height}`);
  
  function getAvgBrightness(xStart, xEnd, yStart, yEnd) {
    let sum = 0;
    let count = 0;
    for (let y = yStart; y < yEnd; y++) {
      for (let x = xStart; x < xEnd; x++) {
        const idx = (y * info.width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];
        if (a > 200) {
          sum += (r + g + b) / 3;
          count++;
        }
      }
    }
    return count > 0 ? sum / count : 255;
  }

  // Let's scan left bay for three dials. Left bay is X: [0, 400], Y: [30, 450]
  // We'll scan in a grid to find the coordinates that minimize average brightness in a 40x40 area.
  // The dials are circular matte black, so they are the darkest regions!
  function findDarkestRegion(xMin, xMax, yMin, yMax, r) {
    let bestX = 0, bestY = 0, minB = 255;
    for (let y = yMin; y < yMax; y += 4) {
      for (let x = xMin; x < xMax; x += 4) {
        let b = getAvgBrightness(x - r, x + r, y - r, y + r);
        if (b < minB) {
          minB = b;
          bestX = x;
          bestY = y;
        }
      }
    }
    // Refine
    let refX = bestX, refY = bestY;
    minB = 255;
    for (let y = bestY - 6; y <= bestY + 6; y++) {
      for (let x = bestX - 6; x <= bestX + 6; x++) {
        let b = getAvgBrightness(x - r, x + r, y - r, y + r);
        if (b < minB) {
          minB = b;
          refX = x;
          refY = y;
        }
      }
    }
    return { x: refX, y: refY, brightness: minB };
  }

  // Three dials in Left Bay:
  const d1 = findDarkestRegion(40, 150, 80, 300, 30);
  const d2 = findDarkestRegion(150, 260, 80, 300, 30);
  const d3 = findDarkestRegion(260, 380, 80, 300, 30);

  console.log('Dial centers:');
  console.log('Dial 1 (RPM):', d1);
  console.log('Dial 2 (Speed):', d2);
  console.log('Dial 3 (Altitude):', d3);

  // Stacked portrait frames in Center Bay (X in [390, 650], Y in [40, 450])
  // They are also dark rectangles! Let's search in X: [400, 490]
  const p1 = findDarkestRegion(400, 490, 40, 220, 25);
  const p2 = findDarkestRegion(400, 490, 220, 400, 25);
  console.log('Portrait frame centers:');
  console.log('Portrait 1 (top):', p1);
  console.log('Portrait 2 (bottom):', p2);

  // Warning lamps on the right (X in [780, 950], Y in [80, 300])
  // Let's find two unlit dark lamp housings!
  const l1 = findDarkestRegion(780, 860, 80, 250, 12);
  const l2 = findDarkestRegion(860, 950, 80, 250, 12);
  console.log('Warning lamp centers:');
  console.log('Lamp 1 (GAS):', l1);
  console.log('Lamp 2 (HEAT):', l2);

  // Let's scan for lever columns on the right (X in [660, 780])
  // We scan columns for the darkest Y lines!
  function findLeverColumn(xMin, xMax) {
    let bestX = 0, minB = 255;
    for (let x = xMin; x < xMax; x++) {
      let b = getAvgBrightness(x - 2, x + 2, 100, 280);
      if (b < minB) {
        minB = b;
        bestX = x;
      }
    }
    return bestX;
  }
  const leverX1 = findLeverColumn(670, 720);
  const leverX2 = findLeverColumn(720, 780);
  console.log('Lever slot columns:');
  console.log('Lever 1 (GAS):', leverX1);
  console.log('Lever 2 (FORSAZH):', leverX2);
}

main().catch(console.error);
