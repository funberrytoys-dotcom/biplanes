import os
import bpy, math, json
from mathutils import Vector, Matrix

TAG = "%TAG%"
OUTLINE = False   # the ink line was what made it read as a cartoon
BASE = os.environ.get("BIPLANES_3D_BASE", r"C:\Users\serge\Documents\Playground\Biplanes\.3dwork")
TOOLS = os.environ.get("BIPLANES_3D_TOOLS", r"C:\Users\serge\Documents\Playground\Biplanes\tools\3d")
# The sheet is a grid of POSES, not an animation. Nothing on the airframe moves
# by itself any more — the sway, the propeller and the pilot all come from the
# renderer — so every frame spent on a repeat was a frame wasted. Instead the
# grid crosses roll against elevator, and the renderer picks the cell.
#
# Roll: the game has no roll in its physics (it is a side-on looper), but a
# aeroplane that never dips a wing reads as a cardboard cut-out. These are
# cosmetic: a slow rock in cruise, a real lean into a manoeuvre. The steps
# bunch up near level, where the gentle rock lives, and spread out towards the
# ends, where the aeroplane is snapping about and stepping does not show.
ROLL_STEPS = [-22.0, -14.0, -9.0, -6.0, -3.6, -1.8, 0.0, 1.8, 3.6, 6.0, 9.0, 14.0, 22.0]
ELEV_STEPS = [34.0, 0.0, -34.0]     # stick back, centred, stick forward
FRAMES = len(ROLL_STEPS) * len(ELEV_STEPS)
COLS = 7
# The game draws the aeroplane 156px wide, so a 512px frame was three times more
# resolution than anything could show — and thirteen roll steps at that size ran
# the sheet into the 4096px limit that turns planes black on weak mobile chips.
# 384 still leaves headroom over a 2x phone. Taller in proportion than the old
# 310, because a banked aeroplane stands higher in its frame.
FW, FH = 384, 352
FILL = 0.905           # fraction of frame width the plane spans

# Camera. Strictly side-on, with only a breath of elevation. At the 8/10 this
# started out at, both upper wings read as slabs laid over the fuselage and the
# cockpit — with the pilot in it — disappeared underneath. The reference art is
# a flat side view, and the game only ever shows the aeroplane from the side.
AZ_DEG, EL_DEG = 0.0, 3.0

# The propeller is baked onto its own little sheet instead of into the airframe,
# so the renderer can spin it: slow enough to count the blades at idle, a
# smeared disc at full gas. The crisp steps cover a half turn, because a blade
# pair repeats every 180 degrees; then two blurred frames for the fast end.
# Seen from the side a propeller disc is edge-on, so it can never be a circle —
# the honest fast-spin read is a narrow translucent lens standing at the nose.
# The blades are smeared by Blender's own motion blur and a lens body is faded in
# behind them, wider and stronger the faster the propeller turns.
PROP_STEPS = 10
PROP_BLUR = [(90.0, 0.10), (200.0, 0.22), (330.0, 0.34)]  # degrees per frame, lens alpha
PROP_FRAMES = PROP_STEPS + len(PROP_BLUR)
PROP_COLS = 4
LENS_THICK = 0.085          # lens depth as a fraction of the propeller radius
SPIN_PARTS = ("PROP_BLADE_A", "PROP_BLADE_B")
DISC_PART = "PROP_DISC"

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

# ---- airframe root so plane + prop hang off one parent
bob = bpy.data.objects.get("BOB")
if bob is None:
    bob = bpy.data.objects.new("BOB", None)
    sc.collection.objects.link(bob)
bob.location = (0, 0, 0); bob.rotation_euler = (0, 0, 0)
rig.parent = bob; rig.matrix_parent_inverse = Matrix.Identity(4)
piv.parent = bob; piv.matrix_parent_inverse = Matrix.Identity(4)
bpy.context.view_layer.update()

# ---- bounds of everything that renders. Measured once with the propeller in
# place and never recomputed, so the airframe pass and the propeller pass share
# one camera and the two sheets line up pixel for pixel.
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
AZ, EL = math.radians(AZ_DEG), math.radians(EL_DEG)
tgt = bpy.data.objects.new("BakeTGT", None); sc.collection.objects.link(tgt); tgt.location = ctr
cam_d = bpy.data.cameras.new("BakeCam")
cam = bpy.data.objects.new("BakeCam", cam_d)
sc.collection.objects.link(cam); sc.camera = cam
cam_d.type = 'ORTHO'
# Wide enough for the aeroplane, and TALL enough for the steepest baked bank: a
# rolled aeroplane stands higher than a level one, and framing on length alone
# ran the С.О.В.'s wingtips off the top of the frame.
roll = math.radians(max(abs(r) for r in ROLL_STEPS))
need_v = ((mx.y - mn.y) * math.sin(roll) + (mx.z - mn.z) * math.cos(roll)) / 0.93
cam_d.ortho_scale = max(spanx / FILL, need_v * FW / FH)
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

# ---- the pose grid
# The elevator throw is deliberately far past what a real aeroplane has: seen
# from the side the tailplane is only a few pixels of chord, and an honest 15
# degrees does not survive the trip down to a 512px frame. The ailerons move
# with the roll, so a wing that dips has a reason to be dipping.
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

# Roll about the nose axis is put on the airframe root, so the whole aeroplane —
# wings, tail, wheels — banks together. Frame N of the sheet is pose N.
POSES = [(r, e) for r in ROLL_STEPS for e in ELEV_STEPS]
sc.frame_start = 1; sc.frame_end = FRAMES
sc.render.fps = 24
for f, (roll, elev) in enumerate(POSES, start=1):
    bob.location = (0.0, 0.0, 0.0)
    bob.rotation_euler = (math.radians(roll), 0.0, 0.0)
    bob.keyframe_insert("location", index=2, frame=f)
    bob.keyframe_insert("rotation_euler", index=0, frame=f)
    bob.keyframe_insert("rotation_euler", index=1, frame=f)
    # A dipping wing has its ailerons over: the down-going wing carries the
    # down-going aileron, which is what puts it there.
    set_controls(f, roll * 0.55, elev, 0.0)
for ob in (bob, rig):
    for fc in (ob.animation_data.action.fcurves if ob.animation_data else []):
        for kp in fc.keyframe_points: kp.interpolation = 'CONSTANT'


def hide_spin(hidden):
    """Show or hide the parts that spin — the blades and the sweep disc."""
    for nm in SPIN_PARTS + (DISC_PART,):
        o = bpy.data.objects.get(nm)
        if o: o.hide_render = hidden


def show_only(names):
    """Render just these objects; hide every other mesh."""
    for o in sc.objects:
        if o.type == 'MESH':
            o.hide_render = o.name not in names


def fresh_dir(name):
    p = os.path.join(BASE, name)
    os.makedirs(p, exist_ok=True)
    for old in os.listdir(p):
        try: os.remove(os.path.join(p, old))
        except Exception: pass
    return p

# ---- pass 1: the airframe, with the propeller blades left out
hide_spin(True)
sc.render.use_motion_blur = False
OUT = fresh_dir("bake_%s" % TAG)
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
# ---- pass 2: the propeller alone, on the very same camera
POUT = fresh_dir("bake_%s_prop" % TAG)
show_only(set(SPIN_PARTS))
# level the airframe root first: the pose grid leaves it banked, and a banked
# root drags the propeller off the shaft line
if bob.animation_data: bob.animation_data_clear()
bob.rotation_euler = (0.0, 0.0, 0.0)
bpy.context.view_layer.update()
disc = bpy.data.objects.get(DISC_PART)
if piv.animation_data: piv.animation_data_clear()
sc.render.use_motion_blur = False
for i in range(PROP_STEPS):
    piv.rotation_euler = (math.radians(i * 180.0 / PROP_STEPS), 0, 0)
    bpy.context.view_layer.update()
    sc.render.filepath = os.path.join(POUT, "p_%03d.png" % i)
    bpy.ops.render.render(write_still=True)

# The fast end. The flat sweep disc is useless here — edge-on it is a hairline —
# so build a lens: the swept volume of a twisted blade, squashed along the shaft.
R_tip = max(abs(v.co.z) for v in bpy.data.objects[SPIN_PARTS[0]].data.vertices)
before = {o.name for o in bpy.data.objects}
bpy.ops.mesh.primitive_uv_sphere_add(radius=R_tip, segments=48, ring_count=24,
                                     location=piv.location)
lens = next(o for o in bpy.data.objects if o.name not in before)
lens.name = "PROP_LENS"
lens.scale = (LENS_THICK, 1.0, 1.0)
for p in lens.data.polygons: p.use_smooth = True
lens_mat = bpy.data.materials.new("PropLens_" + TAG)
lens_mat.use_nodes = True
_b = lens_mat.node_tree.nodes["Principled BSDF"]
_b.inputs["Base Color"].default_value = (0.20, 0.10, 0.07, 1.0)
_b.inputs["Roughness"].default_value = 1.0
try: lens_mat.surface_render_method = 'BLENDED'
except Exception:
    try: lens_mat.blend_method = 'BLEND'
    except Exception: pass
lens_mat.use_backface_culling = False
lens.data.materials.append(lens_mat)
# Parent it the way the propeller's own parts are parented: identity inverse and
# a local origin, so it sits ON the shaft. Cancelling the parent transform
# instead put the lens at the world origin — a disc spinning over the cockpit.
lens.parent = piv
lens.matrix_parent_inverse = Matrix.Identity(4)
lens.location = (0, 0, 0)
if disc is not None: disc.hide_render = True

sc.render.use_motion_blur = True
for j, (sweep, lens_alpha) in enumerate(PROP_BLUR):
    lens.hide_render = False
    _b.inputs["Alpha"].default_value = lens_alpha
    if piv.animation_data: piv.animation_data_clear()
    for k, f in enumerate((1, 2, 3)):
        piv.rotation_euler = (math.radians(k * sweep), 0, 0)
        piv.keyframe_insert("rotation_euler", index=0, frame=f)
    for fc in piv.animation_data.action.fcurves:
        for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
    sc.frame_set(2)
    sc.render.filepath = os.path.join(POUT, "p_%03d.png" % (PROP_STEPS + j))
    bpy.ops.render.render(write_still=True)
lens.hide_render = True
sc.render.use_motion_blur = False

print(json.dumps({"tag": TAG, "ortho": round(cam_d.ortho_scale, 3), "camera": [AZ_DEG, EL_DEG],
                  "bounds": [[round(c, 2) for c in mn], [round(c, 2) for c in mx]],
                  "probe_track_first3": track[:3], "out": OUT, "prop_out": POUT}))
with open(os.path.join(OUT, "track.json"), "w") as fh:
    json.dump({"track": track, "frames": FRAMES, "fw": FW, "fh": FH,
               # the pose grid: frame index is rollIndex * len(elev) + elevIndex
               "columns": COLS,
               "poses": {"roll": ROLL_STEPS, "elev": ELEV_STEPS},
               "prop": {"frames": PROP_FRAMES, "steps": PROP_STEPS,
                        "blur": len(PROP_BLUR), "columns": PROP_COLS}}, fh)
