import { Container, Graphics } from 'pixi.js';

export interface PlaneBodyHandle {
  fuselageContainer: Container;
  wingContainer: Container;
  propellerContainer: Container;
  blades: Graphics;
  blurDisk: Graphics;
}

export function createPlaneBody(faction: 'player' | 'enemy'): PlaneBodyHandle {
  const wingContainer = new Container();
  const fuselageContainer = new Container();
  const propellerContainer = new Container();

  const isPlayer = faction === 'player';
  const primaryColor = isPlayer ? 0xf4d35e : 0xc0392b;    // Warm yellow / Crimson red
  const secondaryColor = isPlayer ? 0xeab308 : 0x962d22;  // Golden ochre / Dark burgundy
  const metalColor = 0x5a5f69;                            // Steel grey for engine cylinders
  const outlineColor = 0x000000;

  // 1. Draw Exposed Cylinder Engine (Radial block at the nose)
  const engineNode = new Graphics();
  // Drawing 4 small engine cylinder caps radiating near the cowling
  engineNode.circle(13, -6, 2.5).fill(metalColor).stroke({ color: outlineColor, width: 1 });
  engineNode.circle(13, 6, 2.5).fill(metalColor).stroke({ color: outlineColor, width: 1 });
  engineNode.circle(10, -9, 2.5).fill(metalColor).stroke({ color: outlineColor, width: 1 });
  engineNode.circle(10, 9, 2.5).fill(metalColor).stroke({ color: outlineColor, width: 1 });
  fuselageContainer.addChild(engineNode);

  // 2. Draw Aerodynamic Fuselage (Body)
  const body = new Graphics();
  // Curved top cockpit hump, sleek tapered tail, and large vertical rudder
  body.moveTo(18, 0)
      .bezierCurveTo(18, -6, 8, -8, -4, -6)        // nose to cockpit hump
      .lineTo(-14, -4)                             // tail taper upper
      .lineTo(-18, -12)                            // vertical stabilizer top
      .lineTo(-15, -12)
      .lineTo(-10, -4)                             // vertical stabilizer back
      .lineTo(-12, 0)                              // tail point
      .lineTo(-12, 4)                              // lower tail taper
      .lineTo(12, 6)                               // belly
      .closePath()
      .fill(primaryColor)
      .stroke({ color: outlineColor, width: 1.8 });

  // Fuselage canopy glass / decorative stripes
  const canopy = new Graphics()
    .moveTo(4, -6)
    .lineTo(8, -6)
    .bezierCurveTo(6, -2, 2, -2, 0, -5)
    .closePath()
    .fill(isPlayer ? 0x66d9ef : 0xe74c3c); // Blue / Red canopy glass

  fuselageContainer.addChild(body, canopy);

  // 3. Draw Unique Faction Stencil Symbols on the Fuselage
  const symbol = new Graphics();
  if (isPlayer) {
    // Draw military-style stencil "01" on player plane
    symbol
      // "0"
      .rect(-6, -2, 4, 5).stroke({ color: 0xffffff, width: 1.5 })
      // "1"
      .moveTo(0, -2).lineTo(0, 3).stroke({ color: 0xffffff, width: 1.5 });
  } else {
    // Draw double crimson scratch markings / skull-ish cross on enemies
    symbol
      .moveTo(-6, -2).lineTo(-2, 2).stroke({ color: outlineColor, width: 2 })
      .moveTo(-2, -2).lineTo(-6, 2).stroke({ color: outlineColor, width: 2 })
      .moveTo(-5, -2).lineTo(-1, 2).stroke({ color: 0xff3333, width: 1 })
      .moveTo(-1, -2).lineTo(-5, 2).stroke({ color: 0xff3333, width: 1 });
  }
  fuselageContainer.addChild(symbol);

  // 4. Draw Biplane Wings with wire struts
  const wingTop = new Graphics()
    .roundRect(-10, -18, 22, 5, 2.5)
    .fill(secondaryColor)
    .stroke({ color: outlineColor, width: 1.5 });

  const wingBot = new Graphics()
    .roundRect(-10, 13, 22, 5, 2.5)
    .fill(secondaryColor)
    .stroke({ color: outlineColor, width: 1.5 });

  // Wire struts connecting top and bottom wings visually
  const wires = new Graphics()
    .moveTo(-8, -13).lineTo(-8, 13) // Left vertical strut
    .moveTo(8, -13).lineTo(8, 13)   // Right vertical strut
    .moveTo(-8, -13).lineTo(8, 13)  // Diagonal strut wire
    .stroke({ color: 0x222222, width: 1, alpha: 0.65 });

  wingContainer.addChild(wires, wingTop, wingBot);

  // 5. Draw Propeller Spinner and Blades
  // Blurred speed disk behind the propeller blades
  const blurDisk = new Graphics()
    .ellipse(20, 0, 3, 20)
    .fill({ color: 0xffffff, alpha: 0.16 });
  blurDisk.visible = false;
  propellerContainer.addChild(blurDisk);

  const blades = new Graphics();
  // Nose spinner cap
  blades.circle(20, 0, 3.5).fill(0xd3d3d3).stroke({ color: outlineColor, width: 1.2 });
  // Dynamic blades structure (starts pointing up/down)
  blades.moveTo(20, 0)
        .lineTo(19, -17).lineTo(21, -17)
        .lineTo(20, 0)
        .lineTo(19, 17).lineTo(21, 17)
        .closePath()
        .fill(0xd8d8d8)
        .stroke({ color: outlineColor, width: 1 });

  // Pivot propeller blades at the nose spinner center
  blades.pivot.set(20, 0);
  blades.x = 20;
  blades.y = 0;
  propellerContainer.addChild(blades);

  return {
    fuselageContainer,
    wingContainer,
    propellerContainer,
    blades,
    blurDisk,
  };
}
