import bpy, math, json, os, importlib.util
from mathutils import Matrix
BASE = r"C:\Users\serge\AppData\Local\Temp\claude\C--Users-serge-Documents-Playground-Biplanes\882b20d1-942a-41ff-b96c-218c1c8afa45\scratchpad\3d"
def imp(n):
    s=importlib.util.spec_from_file_location(n, os.path.join(BASE,n+".py")); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); return m
pp=imp("plane_pipeline"); lv=imp("lib_view")
S=pp.CONTROL_SIGN
bpy.ops.wm.open_mainfile(filepath=os.path.join(BASE,"plane_sov.blend"))
sc=bpy.context.scene
rig=bpy.data.objects["RIG"]; piv=bpy.data.objects["PROP_PIVOT"]
if rig.animation_data: rig.animation_data_clear()
if piv.animation_data: piv.animation_data_clear()
piv.rotation_euler=(math.radians(14),0,0)
P=rig.pose.bones
AIL=["ail_lo_L","ail_lo_R","ail_up_L","ail_up_R"]
def setpose(rollv=0.0, elevv=0.0, rudv=0.0):
    for pb in P: pb.rotation_euler=(0,0,0)
    for b in AIL: P[b].rotation_euler=(0, math.radians(rollv*S[b]), 0)
    P["elevator"].rotation_euler=(0, math.radians(elevv*S["elevator"]), 0)
    P["rudder"].rotation_euler=(0, math.radians(rudv*S["rudder"]), 0)
    bpy.context.view_layer.update()

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
sc.render.image_settings.file_format='PNG'; sc.render.use_motion_blur=False
sc.view_settings.view_transform='Standard'; sc.render.film_transparent=False
sc.render.resolution_x, sc.render.resolution_y = 1000, 720
try: sc.eevee.taa_render_samples=48
except Exception: pass

lv.VIEWS["rear"]=(-1.0,-0.28,0.42)
lv.VIEWS["above"]=(-0.35,-0.30,1.0)
cases=[("neutral",0,0,0,("rear",)),("rollR",26,0,0,("rear",)),("rollL",-26,0,0,("rear",)),
       ("pitchUp",0,24,0,("rear",)),("pitchDn",0,-20,0,("rear",)),
       ("yawR",0,0,26,("above",)),("yawL",0,0,-26,("above",))]
out=[]
for nm,r,e,y,views in cases:
    setpose(r,e,y)
    out+= [os.path.basename(p) for p in lv.shoot("rc_"+nm, list(views), ortho=11.0, target=(0,0,0.2), dist=30)]
print(json.dumps(out))
