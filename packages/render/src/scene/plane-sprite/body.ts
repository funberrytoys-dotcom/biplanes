import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { assetUrl } from '../../asset-url.js';

export interface PlaneBodyHandle {
  fuselageContainer: Container;
  wingContainer: Container;
  propellerContainer: Container;
  usesFullSpriteArt: boolean;
  blades: Graphics;
  blurDisk: Graphics;
  wingShadow: Graphics;
  fuselageGlint: Graphics;
  propellerX: number;
  updateArt: (dt: number) => void;
}

const PLANE_ART = {
  player: {
    url: assetUrl('assets/biplanes/plane_player_sov_sheet.png'),
    width: 512,
    noseX: 0.43,
    frameWidth: 512,
    frameHeight: 286,
    frameCount: 50,
    columns: 10,
    fps: 24,
    // Cockpit opening in FRAME pixels (art faces left): bust bottom-center sits
    // here, tucked behind the painted rim. h = bust display HEIGHT — normalizing
    // by height keeps heads level across busts with different aspect ratios.
    cockpit: { x: 274, y: 132, h: 58 },
    // Per-frame drift of the airframe INSIDE the sheet frames (alpha-centroid of
    // the aft fuselage, measured offline). The pilot follows it so he trembles
    // with the plane instead of hovering still while the art bobs.
    bob: [[0.0, 0.0], [0.3, 0.8], [0.5, 2.3], [0.7, 3.1], [0.8, 3.9], [0.7, 5.1], [0.6, 5.7], [0.3, 6.8], [0.1, 7.4], [-0.2, 7.8], [-0.6, 8.5], [-0.9, 8.9], [-1.4, 9.7], [-1.8, 10.3], [-2.1, 9.9], [-1.9, 7.6], [-2.0, 5.7], [-1.6, 3.1], [-1.4, 1.6], [-1.2, -0.1], [-0.8, -2.6], [-0.6, -4.1], [-0.1, -6.4], [0.1, -7.7], [0.4, -8.5], [0.7, -7.7], [0.7, -7.0], [0.8, -6.0], [0.6, -5.6], [0.5, -4.8], [0.2, -4.7], [-0.1, -5.1], [-0.5, -5.6], [-0.9, -6.1], [-1.1, -6.3], [-1.4, -6.7], [-1.5, -6.7], [-1.1, -5.7], [-0.8, -4.8], [-0.7, -3.5], [-0.3, -2.1], [0.0, -1.0], [0.2, 0.6], [0.4, 1.3], [0.6, 2.3], [0.7, 3.5], [0.7, 3.5], [0.5, 2.5], [0.5, 1.4], [0.2, 0.5]],
  },
  enemy: {
    url: assetUrl('assets/biplanes/plane_enemy_crimson_sheet.png'),
    width: 512,
    noseX: 0.43,
    frameWidth: 512,
    frameHeight: 306,
    frameCount: 17,
    columns: 6,
    fps: 12,
    cockpit: { x: 270, y: 135, h: 73 },
    bob: [[0.0, 0.0], [-1.6, 6.2], [-1.8, 8.3], [-1.6, 6.3], [-0.7, 1.9], [0.0, -1.4], [-1.6, 6.3], [-1.9, 9.2], [-1.8, 9.3], [-1.8, 7.7], [-0.7, 1.7], [0.7, -4.2], [1.0, -5.4], [-0.1, -0.9], [-1.1, 4.0], [-1.7, 7.2], [-1.4, 5.4]],
  },
} as const;

// Cockpit pilot busts (Codex art, face left like the plane sheets). Heroes fly
// hero planes: the player's own plane and bosses; everyone else is a grunt.
const COCKPIT_PILOT_ART = {
  player: {
    hero: assetUrl('assets/biplanes/pilot_cockpit_chico.png'),
    grunt: assetUrl('assets/biplanes/pilot_cockpit_cat.png'),
  },
  enemy: {
    hero: assetUrl('assets/biplanes/pilot_cockpit_baron.png'),
    grunt: assetUrl('assets/biplanes/pilot_cockpit_jackal.png'),
  },
} as const;

function createAnimatedPlaneArt(art: typeof PLANE_ART.player | typeof PLANE_ART.enemy): { sprite: Sprite; update: (dt: number) => number } {
  const sheet = Texture.from(art.url);
  const frames = Array.from({ length: art.frameCount }, (_, i) => {
    const x = (i % art.columns) * art.frameWidth;
    const y = Math.floor(i / art.columns) * art.frameHeight;
    return new Texture({
      source: sheet.source,
      frame: new Rectangle(x, y, art.frameWidth, art.frameHeight),
    });
  });
  const firstFrame = frames[0];
  if (!firstFrame) throw new Error(`Plane spritesheet ${art.url} has no frames`);
  const sprite = new Sprite(firstFrame);
  let time = 0;

  return {
    sprite,
    // Returns the frame index shown this tick (the pilot bob table is keyed on it).
    update(dt: number): number {
      time += dt;
      const frame = Math.floor(time * art.fps) % frames.length;
      sprite.texture = frames[frame] ?? firstFrame;
      return frame;
    },
  };
}

export function createPlaneBody(faction: 'player' | 'enemy', heroPilot = false): PlaneBodyHandle {
  const wingContainer = new Container();
  const fuselageContainer = new Container();
  const propellerContainer = new Container();

  const isPlayer = faction === 'player';
  const art = PLANE_ART[faction];
  const artHandle = createAnimatedPlaneArt(art);
  const planeArt = artHandle.sprite;
  planeArt.anchor.set(0.5);
  const artScale = 104 / art.width;
  planeArt.scale.set(-artScale, artScale);

  // Cockpit pilot bust — layered UNDER the painted fuselage so the cockpit rim
  // covers the lower torso and the pilot genuinely sits inside the opening.
  // Same left-facing orientation + mirror as the plane sheet itself.
  const pilotSprite = Sprite.from(heroPilot ? COCKPIT_PILOT_ART[faction].hero : COCKPIT_PILOT_ART[faction].grunt);
  pilotSprite.anchor.set(0.5, 1);
  const cockpit = art.cockpit;
  pilotSprite.x = (cockpit.x - art.frameWidth / 2) * -artScale;
  pilotSprite.y = (cockpit.y - art.frameHeight / 2) * artScale;
  pilotSprite.visible = false; // shown once the texture has real dimensions (see update below)
  fuselageContainer.addChild(pilotSprite, planeArt);

  const primaryColor = isPlayer ? 0xf4d35e : 0xc0392b;    // Warm yellow / Crimson red
  const secondaryColor = isPlayer ? 0xeab308 : 0x962d22;  // Golden ochre / Dark burgundy
  const metalColor = 0x8a929e;                            // Chrome grey for engine cylinders
  const outlineColor = 0x000000;

  // 1. Draw Exposed Cylinder Engine (Radial block at the nose) with metallic specular shading
  const engineNode = new Graphics();
  // Draw 4 shiny engine cylinder caps with highlights (outer rim, inner metal, specular dot)
  const drawCylinder = (x: number, y: number) => {
    engineNode.circle(x, y, 3.5).fill({ color: outlineColor });
    engineNode.circle(x, y, 2.5).fill({ color: metalColor });
    engineNode.circle(x - 0.8, y - 0.8, 0.6).fill({ color: 0xffffff }); // Specular highlight
  };
  drawCylinder(13, -6);
  drawCylinder(13, 6);
  drawCylinder(10, -9);
  drawCylinder(10, 9);
  engineNode.alpha = 0;
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
      .fill({ color: primaryColor })
      .stroke({ color: outlineColor, width: 1.8 });

  // Fuselage canopy glass / decorative stripes with premium reflective look
  const canopy = new Graphics()
    .moveTo(4, -6)
    .lineTo(8, -6)
    .bezierCurveTo(6, -2, 2, -2, 0, -5)
    .closePath()
    .fill({ color: isPlayer ? 0x33bfe5 : 0xd63031 }); // Sleek cyan / Crimson red base

  // Canopy gloss / reflections (diagonal shiny white stripes)
  const canopyGlare = new Graphics()
    .moveTo(2, -4.5)
    .lineTo(5, -5.8)
    .lineTo(6, -5.8)
    .lineTo(3, -4.5)
    .closePath()
    .moveTo(4.8, -4.8)
    .lineTo(6.8, -5.6)
    .lineTo(7.4, -5.6)
    .lineTo(5.4, -4.8)
    .closePath()
    .fill({ color: 0xffffff, alpha: 0.65 });
  canopyGlare.blendMode = 'add';
  canopy.addChild(canopyGlare);

  // Dynamic wing shadow cast by the upper wing onto the fuselage (Phase 1.1)
  const wingShadow = new Graphics()
    .rect(-4, -14, 8, 22)
    .fill({ color: 0x000000, alpha: 0.24 });
  wingShadow.visible = false;
  
  // Dynamic fuselage specular metallic glint (Phase 1.1)
  const fuselageGlint = new Graphics()
    .moveTo(15, -2.5)
    .bezierCurveTo(15, -5.5, 7, -7.5, -2, -5.5)
    .lineTo(-11, -3.5)
    .stroke({ color: 0xffffff, width: 1.6, alpha: 0.7 });
  fuselageGlint.blendMode = 'add';
  fuselageGlint.visible = false;

  body.alpha = 0;
  canopy.alpha = 0;
  wingShadow.alpha = 0.18;
  fuselageContainer.addChild(body, canopy, wingShadow, fuselageGlint);

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
  symbol.alpha = 0;
  fuselageContainer.addChild(symbol);

  // 4. Draw Biplane Wings with wire struts and premium gradients
  const wingTop = new Graphics()
    .roundRect(-10, -18, 22, 5, 2.5)
    .fill({ color: secondaryColor })
    .stroke({ color: outlineColor, width: 1.5 });

  const wingBot = new Graphics()
    .roundRect(-10, 13, 22, 5, 2.5)
    .fill({ color: secondaryColor })
    .stroke({ color: outlineColor, width: 1.5 });

  // Wire struts connecting top and bottom wings visually
  const wires = new Graphics()
    .moveTo(-8, -13).lineTo(-8, 13) // Left vertical strut
    .moveTo(8, -13).lineTo(8, 13)   // Right vertical strut
    .moveTo(-8, -13).lineTo(8, 13)  // Diagonal strut wire
    .stroke({ color: 0x222222, width: 1, alpha: 0.65 });

  wires.alpha = 0;
  wingTop.alpha = 0;
  wingBot.alpha = 0;
  wingContainer.addChild(wires, wingTop, wingBot);

  // 5. Draw Propeller Spinner and Blades
  // Blurred speed disk behind the propeller blades
  const noseX = 104 * art.noseX;
  const blurDisk = new Graphics()
    .ellipse(noseX, 0, 3.2, 28)
    .fill({ color: 0xffffff, alpha: 0.16 });
  blurDisk.visible = false;
  propellerContainer.addChild(blurDisk);

  const blades = new Graphics();
  // Nose spinner cap
  blades.circle(noseX, 0, 3.5).fill({ color: 0xd3d3d3 }).stroke({ color: outlineColor, width: 1.2 });
  // Dynamic blades structure (starts pointing up/down)
  blades.moveTo(noseX, 0)
        .lineTo(noseX - 1.2, -26).lineTo(noseX + 1.2, -26)
        .lineTo(noseX, 0)
        .lineTo(noseX - 1.2, 26).lineTo(noseX + 1.2, 26)
        .closePath()
        .fill({ color: 0xc47a2c })
        .stroke({ color: outlineColor, width: 1 });

  // Pivot propeller blades at the nose spinner center
  blades.pivot.set(noseX, 0);
  blades.x = noseX;
  blades.y = 0;
  propellerContainer.addChild(blades);
  propellerContainer.visible = false;

  return {
    fuselageContainer,
    wingContainer,
    propellerContainer,
    usesFullSpriteArt: true,
    blades,
    blurDisk,
    wingShadow,
    fuselageGlint,
    propellerX: noseX,
    updateArt(dt: number) {
      const frame = artHandle.update(dt);
      if (!pilotSprite.visible) {
        const tex = pilotSprite.texture;
        if (tex && tex !== Texture.EMPTY && tex.width > 2) {
          const s = (cockpit.h * artScale) / tex.height;
          pilotSprite.scale.set(-s, s); // mirrored together with the plane art
          pilotSprite.visible = true;
        }
      }
      // Ride the airframe's baked bob so the pilot trembles WITH the plane.
      const bob = art.bob[frame] ?? [0, 0];
      pilotSprite.x = (cockpit.x + bob[0] - art.frameWidth / 2) * -artScale;
      pilotSprite.y = (cockpit.y + bob[1] - art.frameHeight / 2) * artScale;
    },
  };
}
