import bpy, math, json, os, time
from mathutils import Vector, Matrix

TAG = "%TAG%"
BASE = r"C:\Users\serge\AppData\Local\Temp\claude\C--Users-serge-Documents-Playground-Biplanes\882b20d1-942a-41ff-b96c-218c1c8afa45\scratchpad\3d"
OUTDIR = r"C:\Users\serge\Downloads\vintage biplane 3d model\_ИСПРАВЛЕНО"
FPS, DUR = 30, 9.0
NF = int(FPS * DUR)

bpy.ops.wm.open_mainfile(filepath=os.path.join(BASE, "plane_%s.blend" % TAG))
sc = bpy.context.scene
rig = bpy.data.objects["RIG"]
piv = bpy.data.objects["PROP_PIVOT"]
disc = bpy.data.objects.get("PROP_DISC")
if disc: disc.hide_render = True          # the sweep disc is a sprite trick, not for the demo

for pb in rig.pose.bones: pb.rotation_euler = (0, 0, 0)
if rig.animation_data: rig.animation_data_clear()
if piv.animation_data: piv.animation_data_clear()
piv.rotation_euler = (0, 0, 0)
bpy.context.view_layer.update()

sc.render.fps = FPS; sc.frame_start = 1; sc.frame_end = NF
P = rig.pose.bones
AIL = ["ail_lo_L", "ail_lo_R", "ail_up_L", "ail_up_R"]

def key(bone, t, val):
    f = max(1, int(round(t * FPS)))
    P[bone].rotation_euler = (0, math.radians(val), 0)
    P[bone].keyframe_insert("rotation_euler", index=1, frame=f)

def roll(t, v):
    for b in AIL: key(b, t, v)

roll(0.0, 0); key("elevator", 0.0, 0); key("rudder", 0.0, 0)
roll(0.7, 0); roll(1.3, 24); roll(1.9, 0); roll(2.5, -24); roll(3.1, 0)
key("elevator", 3.1, 0); key("elevator", 3.7, 20); key("elevator", 4.3, -15); key("elevator", 4.9, 0)
key("rudder", 4.9, 0); key("rudder", 5.5, 25); key("rudder", 6.1, -25); key("rudder", 6.7, 0)
roll(6.7, 0); roll(7.6, 18); roll(9.0, 14)
key("rudder", 6.7, 0); key("rudder", 7.6, 11); key("rudder", 9.0, 9)
key("elevator", 6.7, 0); key("elevator", 7.8, 7); key("elevator", 9.0, 6)

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

tgt = bpy.data.objects.new("DTGT", None); sc.collection.objects.link(tgt); tgt.location = ctr
cd = bpy.data.cameras.new("DCAM"); cam = bpy.data.objects.new("DCAM", cd)
sc.collection.objects.link(cam); sc.camera = cam
cd.type = 'PERSP'; cd.lens = 46
c = cam.constraints.new('TRACK_TO'); c.target = tgt
c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
R = 19.0
for f in range(1, NF + 1):
    t = (f - 1) / (NF - 1)
    az = math.radians(-118 + 86 * t)
    h = ctr.z + 1.8 + 2.6 * math.sin(math.pi * t) ** 1.3
    cam.location = (R * math.cos(az), R * math.sin(az), h)
    cam.keyframe_insert("location", frame=f)
for fc in cam.animation_data.action.fcurves:
    for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'

w = bpy.data.worlds.get("W") or bpy.data.worlds.new("W")
sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.40, 0.45, 0.54, 1)
w.node_tree.nodes["Background"].inputs[1].default_value = 0.75
for nm, rot, en in (("K", (math.radians(58), 0, math.radians(150)), 2.6),
                    ("F", (math.radians(74), 0, math.radians(20)), 1.1),
                    ("R", (math.radians(118), 0, math.radians(255)), 0.8)):
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
name = {"sov": "СОВ_модель_демо.mp4", "jkl": "ШАКАЛ_модель_демо.mp4"}[TAG]
sc.render.filepath = os.path.join(OUTDIR, name)
t0 = time.time()
bpy.ops.render.render(animation=True)
print(json.dumps({"tag": TAG, "file": name, "seconds": round(time.time() - t0, 1),
                  "size": os.path.getsize(sc.render.filepath) if os.path.exists(sc.render.filepath) else 0}))
