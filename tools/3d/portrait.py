import bpy, math, json, os, importlib.util
from mathutils import Vector
BASE = os.environ.get("BIPLANES_3D_BASE", r"C:\Users\serge\Documents\Playground\Biplanes\.3dwork")
TOOLS = os.environ.get("BIPLANES_3D_TOOLS", r"C:\Users\serge\Documents\Playground\Biplanes\tools\3d")
def imp(n):
    s=importlib.util.spec_from_file_location(n, os.path.join(TOOLS,n+".py")); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); return m
lv=imp("lib_view")
TAG="%TAG%"
bpy.ops.wm.open_mainfile(filepath=os.path.join(BASE,"plane_%s.blend"%TAG))
sc=bpy.context.scene
rig=bpy.data.objects["RIG"]
for pb in rig.pose.bones: pb.rotation_euler=(0,0,0)
if rig.animation_data: rig.animation_data_clear()
piv=bpy.data.objects["PROP_PIVOT"]
if piv.animation_data: piv.animation_data_clear()
piv.rotation_euler=(math.radians(16),0,0)
bpy.context.view_layer.update()

# same lighting as the sprite bake, so the portraits show what the game gets
for nm in ("K","F","R"):
    o=bpy.data.objects.get(nm)
    if o: bpy.data.objects.remove(o, do_unlink=True)
w=bpy.data.worlds.get("W") or bpy.data.worlds.new("W")
sc.world=w; w.use_nodes=True
w.node_tree.nodes["Background"].inputs[0].default_value=(0.46,0.52,0.62,1)
w.node_tree.nodes["Background"].inputs[1].default_value=0.55
for nm,rot,en in (("K",(math.radians(52),0,math.radians(140)),3.2),
                  ("F",(math.radians(80),0,math.radians(30)),0.8),
                  ("R",(math.radians(112),0,math.radians(250)),1.5)):
    ld=bpy.data.lights.new(nm,'SUN'); ld.energy=en; ld.angle=math.radians(20)
    lo=bpy.data.objects.new(nm,ld); sc.collection.objects.link(lo); lo.rotation_euler=rot

try: sc.render.engine='BLENDER_EEVEE_NEXT'
except Exception: sc.render.engine='BLENDER_EEVEE'
sc.render.image_settings.file_format='PNG'
sc.render.use_motion_blur=False
sc.view_settings.view_transform='Standard'
sc.render.film_transparent=False
try: sc.eevee.taa_render_samples=64
except Exception: pass
sc.render.resolution_x, sc.render.resolution_y = 1100, 750

lv.VIEWS["side"]=(0.10,-1.0,0.12)
lv.VIEWS["fq"]=(0.95,-0.85,0.32)
lv.VIEWS["hq"]=(-0.55,-0.95,0.55)
s=lv.shoot("p_"+TAG,["side","fq","hq"],ortho=11.2,target=(0,0,0.15),dist=30)
print(json.dumps([os.path.basename(p) for p in s]))
