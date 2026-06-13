import sharp from 'sharp';

async function main() {
  const image = sharp('apps/web/public/assets/biplanes/hud/cockpit_panel.png');
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  
  console.log(`Image size: ${info.width}x${info.height}`);
  
  // Let's sample horizontal lines to find dividing frames or bays
  // We can search for brass-colored rivets or borders, or black regions.
  // Dials are very dark circular regions. Let's find centers of circles in the left bay.
  // Left bay is roughly [0, 400] x [0, 314]
  // Let's print out some grid intensities to help us place elements.
  
  // Let's find the centers of the three left dials by scanning for minimum brightness (matte black dial faces)
  // inside local regions.
  // Dial 1: x in [0, 150], y in [50, 200]
  // Dial 2: x in [120, 270], y in [50, 200]
  // Dial 3: x in [240, 390], y in [50, 200]
  
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
  
  console.log('Left bay search:');
  // Let's find center of Dial 1
  let bestX1 = 0, bestY1 = 0, minB1 = 255;
  for (let x = 50; x < 150; x++) {
    for (let y = 80; y < 180; y++) {
      let b = getAvgBrightness(x - 20, x + 20, y - 20, y + 20);
      if (b < minB1) { minB1 = b; bestX1 = x; bestY1 = y; }
    }
  }
  console.log(`Dial 1 RPM center: x=${bestX1}, y=${bestY1}`);
  
  // Dial 2
  let bestX2 = 0, bestY2 = 0, minB2 = 255;
  for (let x = 160; x < 260; x++) {
    for (let y = 80; y < 180; y++) {
      let b = getAvgBrightness(x - 20, x + 20, y - 20, y + 20);
      if (b < minB2) { minB2 = b; bestX2 = x; bestY2 = y; }
    }
  }
  console.log(`Dial 2 SPD center: x=${bestX2}, y=${bestY2}`);

  // Dial 3
  let bestX3 = 0, bestY3 = 0, minB3 = 255;
  for (let x = 270; x < 370; x++) {
    for (let y = 80; y < 180; y++) {
      let b = getAvgBrightness(x - 20, x + 20, y - 20, y + 20);
      if (b < minB3) { minB3 = b; bestX3 = x; bestY3 = y; }
    }
  }
  console.log(`Dial 3 ALT center: x=${bestX3}, y=${bestY3}`);

  // Mechanical odometers are below the dials. Let's find their centers by looking for black boxes below
  // odometer 1 is under dial 1 (around bestX1), y in [200, 260]
  // odometer 2 is under dial 2 (around bestX2), y in [200, 260]
  // odometer 3 is under dial 3 (around bestX3), y in [200, 260]
  
  // Let's print out average values inside center bay
  // Center bay is roughly x in [394, 650]
  // 2 square portrait frames stacked on the left of the center bay, empty text lines on the right.
  // Let's find the frames stacked on the left of center bay (around x in [400, 500])
  // Let's scan for the two frames
  console.log('Center bay search:');
  let minB_p1 = 255, p1_y = 0;
  for (let y = 50; y < 150; y++) {
    let b = getAvgBrightness(420, 480, y - 10, y + 10);
    if (b < minB_p1) { minB_p1 = b; p1_y = y; }
  }
  let minB_p2 = 255, p2_y = 0;
  for (let y = 150; y < 270; y++) {
    let b = getAvgBrightness(420, 480, y - 10, y + 10);
    if (b < minB_p2) { minB_p2 = b; p2_y = y; }
  }
  console.log(`Portrait 1 Y center (approx): y=${p1_y}`);
  console.log(`Portrait 2 Y center (approx): y=${p2_y}`);
}

main().catch(console.error);
