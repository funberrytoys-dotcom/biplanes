import bpy, math, json, os, time, importlib.util
from mathutils import Vector, Matrix

TAG = "%TAG%"
BASE = os.environ.get("BIPLANES_3D_BASE", r"C:\Users\serge\Documents\Playground\Biplanes\.3dwork")
TOOLS = os.environ.get("BIPLANES_3D_TOOLS", r"C:\Users\serge\Documents\Playground\Biplanes\tools\3d")
OUTDIR = r"C:\Users\serge\Downloads\vintage biplane 3d model\_ИСПРАВЛЕНО"
FPS, DUR = 30, 14.0
NF = int(FPS * DUR)

def imp(n):
    s = importlib.util.spec_from_file_location(n, os.path.join(TOOLS, n + ".py"))
    m = importlib.util.module_from_spec(s); s.loader.exec_module(m); return m
pp = imp("plane_pipeline")
SIGN = pp.CONTROL_SIGN

bpy.ops.wm.open_mainfile(filepath=os.path.join(BASE, "plane_%s.blend" % TAG))
sc = bpy.context.scene
rig = bpy.data.objects["RIG"]
piv = bpy.data.objects["PROP_PIVOT"]
for pb in rig.pose.bones: pb.rotation_euler = (0, 0, 0)
if rig.animation_data: rig.animation_data_clear()
if piv.animation_data: piv.animation_data_clear()
piv.rotation_euler = (0, 0, 0)

# one root so the airframe banks and pitches with its own controls
root = bpy.data.objects.get("ROOT")
if root is None:
    root = bpy.data.objects.new("ROOT", None); sc.collection.objects.link(root)
root.location = (0, 0, 0); root.rotation_mode = 'XYZ'; root.rotation_euler = (0, 0, 0)
rig.parent = root; rig.matrix_parent_inverse = Matrix.Identity(4)
piv.parent = root; piv.matrix_parent_inverse = Matrix.Identity(4)
if root.animation_data: root.animation_data_clear()
bpy.context.view_layer.update()

sc.render.fps = FPS; sc.frame_start = 1; sc.frame_end = NF
P = rig.pose.bones
AIL = ["ail_lo_L", "ail_lo_R", "ail_up_L", "ail_up_R"]

def key_bone(bone, t, val):
    f = max(1, int(round(t * FPS)))
    P[bone].rotation_euler = (0, math.radians(val * SIGN[bone]), 0)
    P[bone].keyframe_insert("rotation_euler", index=1, frame=f)

def key_root(t, roll=None, pitch=None, yaw=None):
    f = max(1, int(round(t * FPS)))
    e = list(root.rotation_euler)
    if roll is not None: e[0] = math.radians(roll)
    if pitch is not None: e[1] = math.radians(pitch)
    if yaw is not None: e[2] = math.radians(yaw)
    root.rotation_euler = e
    root.keyframe_insert("rotation_euler", frame=f)

# positive = stick right / stick back / right pedal
def roll(t, v):
    for b in AIL: key_bone(b, t, v)

def elev(t, v): key_bone("elevator", t, v)
def rud(t, v):  key_bone("rudder", t, v)

# --- neutral, engine spinning up
roll(0.0, 0); elev(0.0, 0); rud(0.0, 0); key_root(0.0, 0, 0, 0)
roll(1.2, 0); elev(1.2, 0); rud(1.2, 0); key_root(1.2, 0, 0, 0)

# --- stick RIGHT: right aileron up, left down, aircraft banks right
roll(2.4, 26); key_root(2.4, -32, 0, 0)
roll(3.2, 26); key_root(3.2, -32, 0, 0)
roll(4.0, 0);  key_root(4.0, 0, 0, 0)

# --- stick LEFT: mirrored, banks left
roll(5.2, -26); key_root(5.2, 32, 0, 0)
roll(6.0, -26); key_root(6.0, 32, 0, 0)
roll(6.8, 0);   key_root(6.8, 0, 0, 0)

# --- stick BACK then FORWARD: elevator up, nose up; elevator down, nose down
elev(6.8, 0); key_root(6.8, 0, 0, 0)
elev(7.8, 22); key_root(7.8, 0, 24, 0)
elev(8.6, 22); key_root(8.6, 0, 24, 0)
elev(9.6, -18); key_root(9.6, 0, -18, 0)
elev(10.3, 0);  key_root(10.3, 0, 0, 0)

# --- right pedal: rudder right, nose yaws right
rud(10.3, 0); key_root(10.3, 0, 0, 0)
rud(11.1, 26); key_root(11.1, 0, 0, -20)
rud(11.8, -26); key_root(11.8, 0, 0, 20)
rud(12.4, 0);  key_root(12.4, 0, 0, 0)

# --- coordinated turn to the right: bank + rudder + a little back pressure
roll(12.4, 0); elev(12.4, 0); rud(12.4, 0)
roll(13.3, 22); rud(13.3, 12); elev(13.3, 9); key_root(13.3, -28, 6, -8)
roll(14.0, 22); rud(14.0, 12); elev(14.0, 9); key_root(14.0, -28, 6, -8)

ang, prev = 0.0, 0.0
for f in range(1, NF + 1):
    t = (f - 1) / FPS
    dt = t - prev; prev = t
    rps = 5.5 * min(1.0, (t / 1.7) ** 1.5)
    ang += rps * 360.0 * dt
    piv.rotation_euler = (math.radians(ang), 0, 0)
    piv.keyframe_insert("rotation_euler", index=0, frame=f)
for fc in piv.animation_data.action.fcurves:
    for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'

def all_bounds():
    mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
    for o in sc.objects:
        if o.type != 'MESH' or o.hide_render: continue
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            for i in range(3):
                mn[i] = min(mn[i], w[i]); mx[i] = max(mx[i], w[i])
    return mn, mx
mn, mx = all_bounds(); ctr = (mn + mx) / 2

tgt = bpy.data.objects.new("DTGT", None); sc.collection.objects.link(tgt); tgt.location = (0, 0, ctr.z)
cd = bpy.data.cameras.new("DCAM"); cam = bpy.data.objects.new("DCAM", cd)
sc.collection.objects.link(cam); sc.camera = cam
cd.type = 'PERSP'; cd.lens = 44
c = cam.constraints.new('TRACK_TO'); c.target = tgt
c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
R = 21.0
for f in range(1, NF + 1):
    t = (f - 1) / (NF - 1)
    az = math.radians(-124 + 74 * t)
    h = ctr.z + 2.0 + 2.2 * math.sin(math.pi * t) ** 1.3
    cam.location = (R * math.cos(az), R * math.sin(az), h)
    cam.keyframe_insert("location", frame=f)
for fc in cam.animation_data.action.fcurves:
    for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'

w = bpy.data.worlds.get("W") or bpy.data.worlds.new("W")
sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.42, 0.47, 0.56, 1)
w.node_tree.nodes["Background"].inputs[1].default_value = 0.6
for nm, rot, en in (("K", (math.radians(52), 0, math.radians(140)), 3.0),
                    ("F", (math.radians(80), 0, math.radians(30)), 0.9),
                    ("R", (math.radians(112), 0, math.radians(250)), 1.3)):
    if nm in bpy.data.objects: continue
    ld = bpy.data.lights.new(nm, 'SUN'); ld.energy = en; ld.angle = math.radians(18)
    lo = bpy.data.objects.new(nm, ld); sc.collection.objects.link(lo); lo.rotation_euler = rot

try: sc.render.engine = 'BLENDER_EEVEE_NEXT'
except Exception: sc.render.engine = 'BLENDER_EEVEE'
sc.render.resolution_x, sc.render.resolution_y = 1280, 720
sc.render.film_transparent = False
sc.view_settings.view_transform = 'Standard'
sc.render.use_freestyle = False
sc.render.use_motion_blur = True
try: sc.render.motion_blur_shutter = 0.55
except Exception: pass
try: sc.eevee.taa_render_samples = 24
except Exception: pass
sc.render.image_settings.file_format = 'FFMPEG'
sc.render.ffmpeg.format = 'MPEG4'
sc.render.ffmpeg.codec = 'H264'
sc.render.ffmpeg.constant_rate_factor = 'HIGH'
sc.render.ffmpeg.audio_codec = 'NONE'
os.makedirs(OUTDIR, exist_ok=True)
name = {"sov": "СОВ_проверка_рулей.mp4", "jkl": "ШАКАЛ_проверка_рулей.mp4",
        "jkl2": "ШАКАЛ2_проверка_рулей.mp4"}[TAG]
sc.render.filepath = os.path.join(OUTDIR, name)
t0 = time.time()
bpy.ops.render.render(animation=True)
print(json.dumps({"tag": TAG, "file": name, "seconds": round(time.time() - t0, 1),
                  "size": os.path.getsize(sc.render.filepath) if os.path.exists(sc.render.filepath) else 0}))
