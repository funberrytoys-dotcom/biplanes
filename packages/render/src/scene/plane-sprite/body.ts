import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { elevIndex, poseFrame, rollIndex, type Stick } from './pose.js';
import { easePropRev, nextPropPhase, propFrameIndex, propRevsPerSecond } from './prop-spin.js';
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
  updateArt: (dt: number, pose?: PlanePose, engineOn?: boolean, throttle?: number) => void;
  /** The airframe sprite itself — the ground shadow reuses its current frame so
   *  the shadow is the aircraft's own silhouette instead of a blob. */
  artSprite: Sprite;
  /** Scale the sheet is drawn at, so the shadow can match its footprint. */
  artScale: number;
}

const PLANE_ART = {
  player: {
    url: assetUrl('assets/biplanes/plane_player_sov_sheet.png'),
    width: 512,
    noseX: 0.43,
    frameWidth: 512,
    frameHeight: 286,
    frameCount: 50,
    // 5×10 grid (2560×2860): the old 10-column sheet was 5120px wide, which is
    // over the 4096 GPU max-texture limit on weak mobile chips → black plane.
    columns: 5,
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


// ---------------------------------------------------------------------------
// 3D-baked plane art. Same 512-wide frames as the painted sheets, rendered from
// the rigged Blender models (real 2-blade prop, spinning with motion blur), so
// the two can be compared side by side in the running game.
// Opt in with ?art=3d, back out with ?art=classic; the choice sticks.
// ---------------------------------------------------------------------------
export type PlaneArtDef = {
  url: string;
  width: number;
  noseX: number;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  columns: number;
  fps: number;
  cockpit: { x: number; y: number; h: number };
  /** Per-frame drift of the airframe INSIDE the frames, so the pilot bust can
   *  ride along. Empty when the bake holds the airframe level. */
  bob: readonly (readonly number[])[];
  /** The pose grid baked into the sheet: roll angles crossed with elevator
   *  throws, in degrees. Frame index is rollIndex * elev.length + elevIndex.
   *  Nothing on the airframe animates by itself — the renderer picks the cell. */
  poses?: { roll: readonly number[]; elev: readonly number[] };
  /** The propeller, on its own sheet, drawn over the airframe. Same camera and
   *  same frame size as the airframe sheet, so it needs no offset. The first
   *  `steps` frames are crisp blades across a half turn; the rest are the
   *  smeared fast frames, softest first. */
  prop?: {
    url: string;
    frameWidth: number;
    frameHeight: number;
    /** Where the cropped propeller sits inside the airframe frame. */
    originX: number;
    originY: number;
    frameCount: number;
    columns: number;
    steps: number;
  };
};

const PLANE_ART_3D: { player: PlaneArtDef; enemy: PlaneArtDef; enemy2: PlaneArtDef } = {
  player: {
    url: assetUrl('assets/biplanes/plane_player_sov_3d_sheet.png'),
    width: 512,
    noseX: 0.43,
    frameWidth: 512,
    frameHeight: 400,
    frameCount: 27,
    columns: 6,
    fps: 24,
    cockpit: { x: 251, y: 174, h: 56 },
    bob: [[0.0, 0.0], [0.0, 0.0], [0.0, 0.0], [0.0, -1.5], [0.0, -1.5], [0.0, -1.5], [0.0, -2.2], [0.0, -2.2], [0.0, -2.2], [0.0, -2.5], [0.0, -2.5], [0.0, -2.5], [0.0, -2.7], [0.0, -2.7], [0.0, -2.7], [0.0, -2.7], [0.0, -2.7], [0.0, -2.7], [0.0, -2.6], [0.0, -2.6], [0.0, -2.6], [0.0, -2.2], [0.0, -2.2], [0.0, -2.2], [0.0, -1.1], [0.0, -1.1], [0.0, -1.1]],
    poses: { roll: [-22.0, -14.0, -8.0, -3.5, 0.0, 3.5, 8.0, 14.0, 22.0], elev: [34.0, 0.0, -34.0] },
    prop: {
      url: assetUrl('assets/biplanes/prop_player_sov_3d_sheet.png'),
      frameWidth: 234, frameHeight: 257, originX: 30, originY: 54,
      frameCount: 13, columns: 4, steps: 10,
    },
  },
  enemy: {
    url: assetUrl('assets/biplanes/plane_enemy_crimson_3d_sheet.png'),
    width: 512,
    noseX: 0.43,
    frameWidth: 512,
    frameHeight: 400,
    frameCount: 27,
    columns: 6,
    fps: 24,
    cockpit: { x: 257, y: 169, h: 62 },
    bob: [[0.0, 0.0], [0.0, 0.0], [0.0, 0.0], [0.0, -1.7], [0.0, -1.7], [0.0, -1.7], [0.0, -2.6], [0.0, -2.6], [0.0, -2.6], [0.0, -3.0], [0.0, -3.0], [0.0, -3.0], [0.0, -3.1], [0.0, -3.1], [0.0, -3.1], [0.0, -3.2], [0.0, -3.2], [0.0, -3.2], [0.0, -3.1], [0.0, -3.1], [0.0, -3.1], [0.0, -2.6], [0.0, -2.6], [0.0, -2.6], [0.0, -1.3], [0.0, -1.3], [0.0, -1.3]],
    poses: { roll: [-22.0, -14.0, -8.0, -3.5, 0.0, 3.5, 8.0, 14.0, 22.0], elev: [34.0, 0.0, -34.0] },
    prop: {
      url: assetUrl('assets/biplanes/prop_enemy_crimson_3d_sheet.png'),
      frameWidth: 233, frameHeight: 274, originX: 30, originY: 45,
      frameCount: 13, columns: 4, steps: 10,
    },
  },
  // Second Jackal squadron - same airframe, crimson wings instead of black.
  enemy2: {
    url: assetUrl('assets/biplanes/plane_enemy_crimson_3d_b_sheet.png'),
    width: 512,
    noseX: 0.43,
    frameWidth: 512,
    frameHeight: 400,
    frameCount: 27,
    columns: 6,
    fps: 24,
    cockpit: { x: 257, y: 169, h: 62 },
    bob: [[0.0, 0.0], [0.0, 0.0], [0.0, 0.0], [0.0, -1.7], [0.0, -1.7], [0.0, -1.7], [0.0, -2.6], [0.0, -2.6], [0.0, -2.6], [0.0, -3.0], [0.0, -3.0], [0.0, -3.0], [0.0, -3.1], [0.0, -3.1], [0.0, -3.1], [0.0, -3.2], [0.0, -3.2], [0.0, -3.2], [0.0, -3.1], [0.0, -3.1], [0.0, -3.1], [0.0, -2.6], [0.0, -2.6], [0.0, -2.6], [0.0, -1.3], [0.0, -1.3], [0.0, -1.3]],
    poses: { roll: [-22.0, -14.0, -8.0, -3.5, 0.0, 3.5, 8.0, 14.0, 22.0], elev: [34.0, 0.0, -34.0] },
    prop: {
      url: assetUrl('assets/biplanes/prop_enemy_crimson_3d_b_sheet.png'),
      frameWidth: 233, frameHeight: 274, originX: 30, originY: 45,
      frameCount: 13, columns: 4, steps: 10,
    },
  },
};

// Enemy planes alternate between the two Jackal squadrons by id so a fight is
// not a row of identical aircraft. Bosses always fly squadron one.
export function pick3dArt(faction: 'player' | 'enemy', variant: number): PlaneArtDef {
  if (faction === 'enemy' && variant === 1) return PLANE_ART_3D.enemy2;
  return PLANE_ART_3D[faction];
}

export function use3dPlaneArt(): boolean {
  try {
    const q = new URLSearchParams(window.location.search).get('art');
    if (q === '3d') { window.localStorage.setItem('biplanes.art3d', 'on'); return true; }
    if (q === 'classic') { window.localStorage.setItem('biplanes.art3d', 'off'); return false; }
    return window.localStorage.getItem('biplanes.art3d') === 'on';
  } catch {
    return false;
  }
}
const USE_3D_ART = use3dPlaneArt();

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

// Frame slices are shared across ALL plane sprites of a faction — re-slicing 50
// Texture objects for every enemy (re)spawn was per-kill garbage and a mid-fight
// hitch on phones.
const planeFrameCache = new Map<string, Texture[]>();

const LEVEL_POSE: PlanePose = { rollDeg: 0, stick: 0 };

function getPlaneFrames(art: PlaneArtDef): Texture[] {
  const cached = planeFrameCache.get(art.url);
  if (cached) return cached;
  const frames = sliceSheet(art.url, art.frameWidth, art.frameHeight, art.columns, art.frameCount);
  planeFrameCache.set(art.url, frames);
  return frames;
}

function sliceSheet(url: string, fw: number, fh: number, columns: number, count: number): Texture[] {
  const sheet = Texture.from(url);
  return Array.from({ length: count }, (_, i) => new Texture({
    source: sheet.source,
    frame: new Rectangle((i % columns) * fw, Math.floor(i / columns) * fh, fw, fh),
  }));
}

function getPropFrames(prop: NonNullable<PlaneArtDef['prop']>): Texture[] {
  const cached = planeFrameCache.get(prop.url);
  if (cached) return cached;
  const frames = sliceSheet(prop.url, prop.frameWidth, prop.frameHeight, prop.columns, prop.frameCount);
  planeFrameCache.set(prop.url, frames);
  return frames;
}

/** How the airframe is being flown, as far as the art is concerned. */
export interface PlanePose {
  /** Bank in degrees; negative dips the near wing. */
  rollDeg: number;
  /** Stick back, centred or forward. */
  stick: Stick;
}

function createAnimatedPlaneArt(art: PlaneArtDef): {
  sprite: Sprite;
  update: (dt: number, pose: PlanePose) => number;
} {
  const frames = getPlaneFrames(art);
  const firstFrame = frames[0];
  if (!firstFrame) throw new Error(`Plane spritesheet ${art.url} has no frames`);
  const sprite = new Sprite(firstFrame);
  let time = 0;

  return {
    sprite,
    // Returns the frame index shown this tick (the pilot bob table is keyed on it).
    // A sheet of POSES is picked from; a painted sheet is an animation and just
    // runs end to end on the clock.
    update(dt: number, pose: PlanePose): number {
      time += dt;
      const poses = art.poses;
      const frame = poses
        ? poseFrame(rollIndex(pose.rollDeg, poses.roll), elevIndex(pose.stick, poses.elev.length),
                    poses.elev.length)
        : Math.floor(time * art.fps) % frames.length;
      sprite.texture = frames[frame] ?? firstFrame;
      return frame;
    },
  };
}

export function createPlaneBody(faction: 'player' | 'enemy', heroPilot = false, variant = 0): PlaneBodyHandle {
  const wingContainer = new Container();
  const fuselageContainer = new Container();
  const propellerContainer = new Container();

  const isPlayer = faction === 'player';
  const art: PlaneArtDef = USE_3D_ART ? pick3dArt(faction, variant) : PLANE_ART[faction];
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

  // The propeller comes on its own sheet so the throttle can spin it: slow
  // enough to count the blades at idle, a translucent smear at full gas (see
  // prop-spin.ts). It was rendered on the same camera as the airframe and then
  // cropped to the blades, so it lands by its recorded origin — no fudging — and
  // sits ON TOP, because from abeam nothing on the aeroplane is in front of it.
  const propArt = art.prop;
  const propFrames = propArt ? getPropFrames(propArt) : [];
  const propSprite = propArt && propFrames[0] ? new Sprite(propFrames[0]) : null;
  let propRev = 0;
  let propPhase = 0;
  if (propSprite && propArt) {
    propSprite.anchor.set(0.5);
    propSprite.scale.set(-artScale, artScale);
    propSprite.x = (propArt.originX + propArt.frameWidth / 2 - art.frameWidth / 2) * -artScale;
    propSprite.y = (propArt.originY + propArt.frameHeight / 2 - art.frameHeight / 2) * artScale;
    fuselageContainer.addChild(propSprite);
  }

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
    artSprite: planeArt,
    artScale,
    updateArt(dt: number, pose: PlanePose = LEVEL_POSE, engineOn = true, throttle = 1) {
      const frame = artHandle.update(dt, pose);
      if (propSprite && propArt) {
        propRev = easePropRev(propRev, propRevsPerSecond(engineOn, throttle), dt);
        propPhase = nextPropPhase(propPhase, propRev, dt);
        const idx = propFrameIndex(propRev, propPhase, propArt.steps, propArt.frameCount - propArt.steps);
        propSprite.texture = propFrames[idx] ?? propFrames[0]!;
      }
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
      pilotSprite.x = (cockpit.x + (bob[0] ?? 0) - art.frameWidth / 2) * -artScale;
      pilotSprite.y = (cockpit.y + (bob[1] ?? 0) - art.frameHeight / 2) * artScale;
    },
  };
}
