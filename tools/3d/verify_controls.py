"""Check every control surface swings the way it would on a real aeroplane.

One positive input means stick right / stick back / right pedal. Run after any
change to the rig; it prints ALL PASS or names the surface that went wrong.
"""
import bpy, math, json, os, importlib.util
BASE = r"C:\Users\serge\AppData\Local\Temp\claude\C--Users-serge-Documents-Playground-Biplanes\882b20d1-942a-41ff-b96c-218c1c8afa45\scratchpad\3d"
def imp(n):
    s=importlib.util.spec_from_file_location(n, os.path.join(BASE,n+".py")); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); return m
pp=imp("plane_pipeline"); S=pp.CONTROL_SIGN
report={}
for tag in ("sov","jkl","jkl2"):
    bpy.ops.wm.open_mainfile(filepath=os.path.join(BASE,"plane_%s.blend"%tag))
    o=bpy.data.objects["PLANE"]; rig=bpy.data.objects["RIG"]; P=rig.pose.bones
    AIL=["ail_lo_L","ail_lo_R","ail_up_L","ail_up_R"]
    def trailing(group):
        vg=o.vertex_groups[group]
        idxs=[v.index for v in o.data.vertices
              if any(g.group==vg.index and g.weight>0.9 for g in v.groups)]
        dg=bpy.context.evaluated_depsgraph_get()
        ev=o.evaluated_get(dg); me=ev.to_mesh()
        pts=[me.vertices[i].co.copy() for i in idxs if i < len(me.vertices)]
        ev.to_mesh_clear()
        if not pts: return None
        pts.sort(key=lambda c: c.x)
        k=pts[:max(3,len(pts)//6)]
        return (sum(c.y for c in k)/len(k), sum(c.z for c in k)/len(k))
    def pose(rollv=0,elevv=0,rudv=0):
        for pb in P: pb.rotation_euler=(0,0,0)
        for b in AIL: P[b].rotation_euler=(0, math.radians(rollv*S[b]),0)
        P["elevator"].rotation_euler=(0, math.radians(elevv*S["elevator"]),0)
        P["rudder"].rotation_euler=(0, math.radians(rudv*S["rudder"]),0)
        bpy.context.view_layer.update()
    pose(); base={n:trailing(n) for n in AIL+["elevator","rudder"]}
    checks={}
    pose(rollv=25)
    p=trailing("ail_lo_L"); checks["stick right: LEFT aileron goes down"]  = round(p[1]-base["ail_lo_L"][1],3) < -0.05
    p=trailing("ail_lo_R"); checks["stick right: RIGHT aileron goes up"]   = round(p[1]-base["ail_lo_R"][1],3) >  0.05
    p=trailing("ail_up_L"); checks["stick right: upper LEFT matches lower"]= round(p[1]-base["ail_up_L"][1],3) < -0.05
    p=trailing("ail_up_R"); checks["stick right: upper RIGHT matches lower"]=round(p[1]-base["ail_up_R"][1],3) >  0.05
    pose(elevv=25)
    p=trailing("elevator"); checks["stick back: elevator goes up"]         = round(p[1]-base["elevator"][1],3) >  0.05
    pose(elevv=-25)
    p=trailing("elevator"); checks["stick forward: elevator goes down"]    = round(p[1]-base["elevator"][1],3) < -0.05
    pose(rudv=25)
    p=trailing("rudder");   checks["right pedal: rudder swings right"]     = round(p[0]-base["rudder"][0],3) < -0.05
    pose(rudv=-25)
    p=trailing("rudder");   checks["left pedal: rudder swings left"]       = round(p[0]-base["rudder"][0],3) >  0.05
    pose()
    report[tag]=checks
ok=all(all(v.values()) for v in report.values())
print(json.dumps({"all_pass": ok, "report": report}))
