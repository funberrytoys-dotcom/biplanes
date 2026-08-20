import bpy, math, json, os
from mathutils import Vector, Matrix

TAG = "%TAG%"
OUTLINE = False   # the ink line was what made it read as a cartoon
BASE = os.environ.get("BIPLANES_3D_BASE", r"C:\Users\serge\Documents\Playground\Biplanes\.3dwork")
TOOLS = os.environ.get("BIPLANES_3D_TOOLS", r"C:\Users\serge\Documents\Playground\Biplanes\tools\3d")
FRAMES = 50
FW, FH = 512, 310
FILL = 0.905           # fraction of frame width the plane spans
HALF_TURNS = 7        # over the whole loop -> seamless for a 2-blade prop

bpy.ops.wm.open_mainfile(filepath=os.path.join(BASE, "plane_%s.blend" % TAG))
sc = bpy.context.scene
plane = bpy.data.objects["PLANE"]
rig = bpy.data.objects["RIG"]
piv = bpy.data.objects["PROP_PIVOT"]

# neutral pose
for pb in rig.pose.bones: pb.rotation_euler = (0, 0, 0)
if rig.animation_data: rig.animation_data_clear()
if piv.animation_data: piv.animation_data_clear()
piv.rotation_euler = (0, 0, 0)
bpy.context.view_layer.update()

# ---- airframe root so plane + prop bob together
bob = bpy.data.objects.get("BOB")
if bob is None:
    bob = bpy.data.objects.new("BOB", None)
    sc.collection.objects.link(bob)
bob.location = (0, 0, 0); bob.rotation_euler = (0, 0, 0)
rig.parent = bob; rig.matrix_parent_inverse = Matrix.Identity(4)
piv.parent = bob; piv.matrix_parent_inverse = Matrix.Identity(4)
bpy.context.view_layer.update()

# ---- bounds of everything that renders
def all_bounds():
    mn = Vector((1e9, 1e9, 1e9)); mx = Vector((-1e9, -1e9, -1e9))
    for o in sc.objects:
        if o.type != 'MESH': continue
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            for i in range(3):
                mn[i] = min(mn[i], w[i]); mx[i] = max(mx[i], w[i])
    return mn, mx
mn, mx = all_bounds()
ctr = (mn + mx) / 2
spanx = mx.x - mn.x

# ---- camera: orthographic from +Y so the nose (+X) lands on the LEFT
AZ, EL = math.radians(8.0), math.radians(10.0)
tgt = bpy.data.objects.new("BakeTGT", None); sc.collection.objects.link(tgt); tgt.location = ctr
cam_d = bpy.data.cameras.new("BakeCam")
cam = bpy.data.objects.new("BakeCam", cam_d)
sc.collection.objects.link(cam); sc.camera = cam
cam_d.type = 'ORTHO'
cam_d.ortho_scale = spanx / FILL
d = Vector((math.sin(AZ) * math.cos(EL), math.cos(AZ) * math.cos(EL), math.sin(EL)))
cam.location = ctr + d * 40.0
con = cam.constraints.new('TRACK_TO'); con.target = tgt
con.track_axis = 'TRACK_NEGATIVE_Z'; con.up_axis = 'UP_Y'

# ---- light: bright, frontal-left key so the left-facing side reads
for nm in ("K", "F", "R"):
    o = bpy.data.objects.get(nm)
    if o: bpy.data.objects.remove(o, do_unlink=True)
w = bpy.data.worlds.get("W") or bpy.data.worlds.new("W")
sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.46, 0.52, 0.62, 1)
w.node_tree.nodes["Background"].inputs[1].default_value = 0.55
for nm, rot, en in (("K", (math.radians(52), 0, math.radians(140)), 3.2),
                    ("F", (math.radians(80), 0, math.radians(30)), 0.8),
                    ("R", (math.radians(112), 0, math.radians(250)), 1.5)):
    ld = bpy.data.lights.new(nm, 'SUN'); ld.energy = en; ld.angle = math.radians(20)
    lo = bpy.data.objects.new(nm, ld); sc.collection.objects.link(lo); lo.rotation_euler = rot

# ---- render settings
try: sc.render.engine = 'BLENDER_EEVEE_NEXT'
except Exception: sc.render.engine = 'BLENDER_EEVEE'
sc.render.resolution_x, sc.render.resolution_y = FW, FH
sc.render.resolution_percentage = 100
sc.render.film_transparent = True
sc.view_settings.view_transform = 'Standard'
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGBA'
sc.render.use_motion_blur = True
try: sc.render.motion_blur_shutter = 0.62
except Exception: pass
try: sc.eevee.taa_render_samples = 64
except Exception: pass
sc.render.use_freestyle = OUTLINE
if OUTLINE:
    vl = bpy.context.view_layer
    vl.use_freestyle = True
    fs = vl.freestyle_settings
    fs.as_render_pass = False
    if not fs.linesets: fs.linesets.new("main")
    ls = fs.linesets[0]
    ls.select_silhouette = True; ls.select_border = True
    ls.select_crease = True; ls.select_edge_mark = False
    ls.linestyle.color = (0.02, 0.02, 0.03)
    ls.linestyle.thickness = 2.6
    fs.crease_angle = math.radians(112)
    ex = bpy.data.collections.get("FS_EXCLUDE")
    if ex:
        ls.select_by_collection = True
        ls.collection = ex
        ls.collection_negation = 'EXCLUSIVE'

# ---- animation
# The sheet holds three blocks so the game can show the elevator actually
# working: level flight, then stick back and stick forward. This is a
# side-on dogfighter — the aeroplane turns by looping, never by banking — so
# the elevator is both the surface that does the work and the only one a
# side-on camera can read. Ailerons and rudder stay parked, as they would in a
# real loop.
#
# The throw is deliberately far past a real aeroplane's: seen from the side the
# tailplane is only a few pixels of chord, and an honest 15° does not survive
# the trip down to a 512px frame.
#
# Each block's propeller turn is a whole number of half-revolutions, so every
# block loops seamlessly on its own.
CONTROL_BLOCKS = True
ELEV_THROW = 34.0
LEVEL, BANK = (30, 10) if CONTROL_BLOCKS else (FRAMES, 0)
assert LEVEL + BANK * 2 == FRAMES
import importlib.util as _il
_sp = _il.spec_from_file_location("pp", os.path.join(TOOLS, "plane_pipeline.py"))
_pp = _il.module_from_spec(_sp); _sp.loader.exec_module(_pp)
SIGN = _pp.CONTROL_SIGN
AIL = ["ail_lo_L", "ail_lo_R", "ail_up_L", "ail_up_R"]
P = rig.pose.bones

def set_controls(f, roll, elev, rud):
    for b in AIL:
        P[b].rotation_euler = (0, math.radians(roll * SIGN[b]), 0)
        P[b].keyframe_insert("rotation_euler", index=1, frame=f)
    P["elevator"].rotation_euler = (0, math.radians(elev * SIGN["elevator"]), 0)
    P["elevator"].keyframe_insert("rotation_euler", index=1, frame=f)
    P["rudder"].rotation_euler = (0, math.radians(rud * SIGN["rudder"]), 0)
    P["rudder"].keyframe_insert("rotation_euler", index=1, frame=f)

sc.frame_start = 1; sc.frame_end = FRAMES
sc.render.fps = 24
# The airframe itself is baked dead level on purpose. A bob baked into the sheet
# is the same bob on every aeroplane on screen, locked to the propeller loop; the
# renderer does it instead (see wobble.ts), with its own phase per aircraft.
ang = 0.0
for f in range(1, FRAMES + 1):
    if f <= LEVEL:
        i, n, elev = f - 1, LEVEL, 0.0
        step = 7 * 180.0 / LEVEL          # whole half-turns across the block
    elif f <= LEVEL + BANK:
        i, n, elev = f - LEVEL - 1, BANK, ELEV_THROW        # stick back, nose up
        step = 2 * 180.0 / BANK
    else:
        i, n, elev = f - LEVEL - BANK - 1, BANK, -ELEV_THROW  # stick forward
        step = 2 * 180.0 / BANK
    ang = step * i
    piv.rotation_euler = (math.radians(ang), 0, 0)
    piv.keyframe_insert("rotation_euler", index=0, frame=f)
    bob.location = (0.0, 0.0, 0.0)
    bob.rotation_euler = (0.0, 0.0, 0.0)
    bob.keyframe_insert("location", index=2, frame=f)
    bob.keyframe_insert("rotation_euler", index=1, frame=f)
    set_controls(f, 0.0, elev, 0.0)
for fc in piv.animation_data.action.fcurves:
    for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
for fc in (rig.animation_data.action.fcurves if rig.animation_data else []):
    for kp in fc.keyframe_points: kp.interpolation = 'CONSTANT'

OUT = os.path.join(BASE, "bake_%s" % TAG)
os.makedirs(OUT, exist_ok=True)
for old in os.listdir(OUT):
    try: os.remove(os.path.join(OUT, old))
    except Exception: pass
sc.render.filepath = os.path.join(OUT, "f_")
bpy.ops.render.render(animation=True)

# ---- cockpit marker: project a probe point so the pilot bust can be placed
from bpy_extras.object_utils import world_to_camera_view
probe = bpy.data.objects.get("CK_PROBE")
if probe is None:
    probe = bpy.data.objects.new("CK_PROBE", None)
    sc.collection.objects.link(probe)
probe.parent = bob; probe.matrix_parent_inverse = Matrix.Identity(4)
CK = {"sov": (0.05, 0.0, 0.62), "jkl": (-0.10, 0.0, 0.72), "jkl2": (-0.10, 0.0, 0.72)}[TAG]
probe.location = CK
track = []
for f in range(1, FRAMES + 1):
    sc.frame_set(f)
    co = world_to_camera_view(sc, cam, probe.matrix_world.translation)
    track.append([round(co.x * FW, 2), round((1 - co.y) * FH, 2)])
print(json.dumps({"tag": TAG, "ortho": round(cam_d.ortho_scale, 3),
                  "bounds": [[round(c, 2) for c in mn], [round(c, 2) for c in mx]],
                  "probe_track_first3": track[:3], "out": OUT}))
with open(os.path.join(OUT, "track.json"), "w") as fh:
    json.dump({"track": track, "frames": FRAMES, "fw": FW, "fh": FH,
               # first frame index (0-based) and length of each block, so the
               # renderer can pick one by which way the stick is held
               "blocks": {"level": [0, LEVEL], "up": [LEVEL, BANK],
                          "down": [LEVEL + BANK, BANK]} if BANK else None}, fh)
