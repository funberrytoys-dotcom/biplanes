import json, os, sys

REPO = r"C:\Users\serge\Documents\Playground\Biplanes"
BASE = r"C:\Users\serge\AppData\Local\Temp\claude\C--Users-serge-Documents-Playground-Biplanes\882b20d1-942a-41ff-b96c-218c1c8afa45\scratchpad\3d"
BODY = os.path.join(REPO, "packages", "render", "src", "scene", "plane-sprite", "body.ts")
MAIN = os.path.join(REPO, "packages", "app", "src", "main.ts")
rep = json.load(open(os.path.join(BASE, "sheet_report.json"), encoding="utf-8"))

def bobsrc(b):
    return "[" + ", ".join("[%s, %s]" % (p[0], p[1]) for p in b) + "]"

sov, jkl, jkl2 = rep["sov"], rep["jkl"], rep["jkl2"]
COCK_H = {"sov": 56, "jkl": 62, "jkl2": 62}

block = """
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
  bob: readonly (readonly number[])[];
};

const PLANE_ART_3D: { player: PlaneArtDef; enemy: PlaneArtDef; enemy2: PlaneArtDef } = {
  player: {
    url: assetUrl('assets/biplanes/%(sov_file)s'),
    width: 512,
    noseX: 0.43,
    frameWidth: %(sov_fw)d,
    frameHeight: %(sov_fh)d,
    frameCount: %(sov_n)d,
    columns: %(sov_cols)d,
    fps: 24,
    cockpit: { x: %(sov_cx)d, y: %(sov_cy)d, h: %(sov_ch)d },
    bob: %(sov_bob)s,
  },
  enemy: {
    url: assetUrl('assets/biplanes/%(jkl_file)s'),
    width: 512,
    noseX: 0.43,
    frameWidth: %(jkl_fw)d,
    frameHeight: %(jkl_fh)d,
    frameCount: %(jkl_n)d,
    columns: %(jkl_cols)d,
    fps: 24,
    cockpit: { x: %(jkl_cx)d, y: %(jkl_cy)d, h: %(jkl_ch)d },
    bob: %(jkl_bob)s,
  },
  // Second Jackal squadron - same airframe, crimson wings instead of black.
  enemy2: {
    url: assetUrl('assets/biplanes/%(j2_file)s'),
    width: 512,
    noseX: 0.43,
    frameWidth: %(j2_fw)d,
    frameHeight: %(j2_fh)d,
    frameCount: %(j2_n)d,
    columns: %(j2_cols)d,
    fps: 24,
    cockpit: { x: %(j2_cx)d, y: %(j2_cy)d, h: %(j2_ch)d },
    bob: %(j2_bob)s,
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
""" % {
    "sov_file": sov["file"], "sov_fw": sov["frame"][0], "sov_fh": sov["frame"][1],
    "sov_n": sov["frames"], "sov_cols": sov["columns"],
    "sov_cx": sov["cockpit_xy"][0], "sov_cy": sov["cockpit_xy"][1], "sov_ch": COCK_H["sov"],
    "sov_bob": bobsrc(sov["bob"]),
    "jkl_file": jkl["file"], "jkl_fw": jkl["frame"][0], "jkl_fh": jkl["frame"][1],
    "jkl_n": jkl["frames"], "jkl_cols": jkl["columns"],
    "jkl_cx": jkl["cockpit_xy"][0], "jkl_cy": jkl["cockpit_xy"][1], "jkl_ch": COCK_H["jkl"],
    "jkl_bob": bobsrc(jkl["bob"]),
    "j2_file": jkl2["file"], "j2_fw": jkl2["frame"][0], "j2_fh": jkl2["frame"][1],
    "j2_n": jkl2["frames"], "j2_cols": jkl2["columns"],
    "j2_cx": jkl2["cockpit_xy"][0], "j2_cy": jkl2["cockpit_xy"][1], "j2_ch": COCK_H["jkl2"],
    "j2_bob": bobsrc(jkl2["bob"]),
}

src = open(BODY, encoding="utf-8").read()
if "PLANE_ART_3D" in src:
    # rewrite the previously injected block
    a = src.index("\n// ---------------------------------------------------------------------------\n// 3D-baked plane art.")
    b = src.index("const USE_3D_ART = use3dPlaneArt();") + len("const USE_3D_ART = use3dPlaneArt();\n")
    src = src[:a] + block + src[b:]
else:
    anchor = "// Cockpit pilot busts (Codex art, face left like the plane sheets)."
    assert anchor in src, "cockpit-bust anchor missing"
    src = src.replace(anchor, block + "\n" + anchor, 1)
    src = src.replace("function getPlaneFrames(art: typeof PLANE_ART.player | typeof PLANE_ART.enemy): Texture[] {",
                      "function getPlaneFrames(art: PlaneArtDef): Texture[] {")
    src = src.replace("function createAnimatedPlaneArt(art: typeof PLANE_ART.player | typeof PLANE_ART.enemy): { sprite: Sprite; update: (dt: number) => number } {",
                      "function createAnimatedPlaneArt(art: PlaneArtDef): { sprite: Sprite; update: (dt: number) => number } {")
    src = src.replace("  const art = PLANE_ART[faction];",
                      "  const art: PlaneArtDef = USE_3D_ART ? PLANE_ART_3D[faction] : PLANE_ART[faction];")
open(BODY, "w", encoding="utf-8").write(src)

msrc = open(MAIN, encoding="utf-8").read()
preload = """
// The 3D-baked plane sheets are only fetched when the ?art=3d experiment is on,
// so the default build downloads exactly what it did before.
if (typeof window !== 'undefined' && use3dPlaneArt()) {
  VISUAL_ASSET_URLS.push(
    assetUrl('assets/biplanes/%s'),
    assetUrl('assets/biplanes/%s'),
    assetUrl('assets/biplanes/%s'),
  );
}
""" % (sov["file"], jkl["file"], jkl2["file"])
if "use3dPlaneArt()" not in msrc:
    anchor = "\nconst STORY_INTRO_LINES: DialogueLine[] = ["
    assert anchor in msrc, "story anchor missing"
    msrc = msrc.replace(anchor, "\n" + preload + anchor, 1)
    tail = "} from '@biplanes/render';"
    assert tail in msrc, "render import missing"
    msrc = msrc.replace(tail, tail + "\nimport { use3dPlaneArt } from '@biplanes/render';", 1)
    open(MAIN, "w", encoding="utf-8").write(msrc)

# re-export the flag helper from the render package
IDX = os.path.join(REPO, "packages", "render", "src", "scene", "plane-sprite", "index.ts")
isrc = open(IDX, encoding="utf-8").read()
if "use3dPlaneArt" not in isrc:
    isrc = isrc.replace("export interface PlaneSpriteUpdateOpts {",
                        "export { use3dPlaneArt } from './body.js';\n\nexport interface PlaneSpriteUpdateOpts {", 1)
    open(IDX, "w", encoding="utf-8").write(isrc)

print(json.dumps({"body_patched": True, "main_patched": "use3dPlaneArt()" in open(MAIN, encoding="utf-8").read(),
                  "sov_cockpit": sov["cockpit_xy"], "jkl_cockpit": jkl["cockpit_xy"]}))
