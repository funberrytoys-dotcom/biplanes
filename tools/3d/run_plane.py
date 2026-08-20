import bpy, math, json, os, sys, importlib.util
BASE = os.environ.get("BIPLANES_3D_BASE", r"C:\Users\serge\Documents\Playground\Biplanes\.3dwork")
TOOLS = os.environ.get("BIPLANES_3D_TOOLS", r"C:\Users\serge\Documents\Playground\Biplanes\tools\3d")
def imp(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(TOOLS, name + ".py"))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
pp = imp("plane_pipeline"); lv = imp("lib_view")

CFG = {
    "sov": dict(src=r"C:\Users\serge\Downloads\vintage airplane 3d model (1).glb",
                wood=(141, 47, 14), gold=(186, 114, 16), brass=(186, 114, 16), wing=(11, 65, 150),
                rim=(176, 106, 14), metal=(214, 152, 56), tail=None, tail_mode="full", bolt=False, bolt_rgb=(255, 255, 255)),
    "jkl": dict(src=r"C:\Users\serge\Downloads\red biplane 3d model (3).glb",
                wood=(143, 33, 25), gold=(215, 140, 40), brass=(198, 132, 42), wing=(37, 37, 38),
                rim=(26, 26, 27), metal=(216, 150, 52), tail=(34, 34, 35), tail_mode="full", bolt=True, bolt_rgb=(246, 246, 244)),
    # Second Jackal squadron: same airframe, inverted scheme so the two read
    # apart in a dogfight — crimson wings and tail, black edging, black bolt.
    "jkl2": dict(src=r"C:\Users\serge\Downloads\red biplane 3d model (3).glb",
                 wood=(120, 28, 22), gold=(196, 122, 34), brass=(186, 122, 40), wing=(96, 30, 25),
                 # tail left on the Tripo texture: a painted one sat lighter than the
                 # fuselage and the seam showed
                 rim=(28, 28, 29), metal=(216, 150, 52), tail=(34, 34, 35), tail_mode="fin",
                 bolt=True, bolt_rgb=(246, 246, 244)),
}
TAG = "%TAG%"
c = CFG[TAG]

pp.wipe()
o = pp.load(c["src"], span=10.0)
m = pp.measure(o)
film = pp.strip_film_artifacts(o, upper_z=m["wing_up_z"])
hole_r = pp.cut_prop(o, m)
m_dark = pp.mat("EngineDark_" + TAG, (0.048, 0.045, 0.043), 0.52, 0.55)
m_brass = pp.mat("PropBrass_" + TAG, pp.rgb(c["brass"]), 0.50, 0.45)
painted = pp.paint_cut(o, m, m_brass)
# "lip" leaves the dark backing right behind the cowling lip. "full" pushes it
# deeper, which opens daylight between the cylinders — this is the shipped one.
cleaned = pp.clean_engine_face(o, m, m_dark, m_brass, mode="lip")
# The hand zone map. Everywhere else the strict hue test decides what is trim;
# inside these boxes Tripo's blue bleed has washed the gold out too far for that,
# so the face is judged by its average colour against looser limits.
zones = [
    # the cowling SIDES only: further forward and the cylinder heads, which have
    # to stay dark, get swept into the trim
    dict(x=(m["cut_x"] - 1.50, m["cut_x"] - 0.72), hue=(18, 62), sat=0.40, val=0.30),
]
if TAG == "sov":
    # The С.О.В. tail is the worst of the bleed: its gold edging comes off the
    # texture as muddy olive. Two tight boxes recover it — the fin box sits
    # ABOVE the fuselage and the tailplane box OUTBOARD of it, so the cream
    # flash along the rear flank is in neither and keeps its own colour.
    hs, az = m["halfspan"], m["ax_z"]
    fn_le = m["fin_chord"][1]; fz1 = m["fin_z"][1]
    ht_le = m["htail_chord"][1]; htz = m["htail_z"]; hts = m["htail_span"]
    mn_x = m["mn"][0]
    zones.append(dict(x=(mn_x - 0.20, fn_le + 0.10), absy=(0.0, 0.10 * hs),
                      z=(az + 0.50, fz1 + 0.30), hue=(12, 78), sat=0.20, val=0.18))
    zones.append(dict(x=(mn_x - 0.20, ht_le + 0.10), absy=(0.25 * hts, 1.25 * hts),
                      z=(htz - 0.35, htz + 0.35), hue=(10, 85), sat=0.16, val=0.16))
zonal = pp.metalize_trim(o, m, base=c["metal"], name="Duralumin_" + TAG, boost=zones)
flats = pp.repaint_flats(o, m, c["wing"], name="WingFlat_" + TAG, rim=c["rim"])
m_wood = pp.mat("PropWood_" + TAG, pp.rgb(c["wood"]), 0.44, 0.0)
m_gold = pp.mat("PropGold_" + TAG, pp.rgb(c["gold"]), 0.32, 0.8)

# wood grain
nt = m_wood.node_tree
for n in list(nt.nodes):
    if n.type not in ('BSDF_PRINCIPLED', 'OUTPUT_MATERIAL'): nt.nodes.remove(n)
bsdf = nt.nodes["Principled BSDF"]
tc = nt.nodes.new("ShaderNodeTexCoord")
mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (1.0, 1.0, 22.0)
nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 5.0
nz.inputs["Detail"].default_value = 6.0; nz.inputs["Roughness"].default_value = 0.55
rp = nt.nodes.new("ShaderNodeValToRGB")
base = pp.rgb(c["wood"])
rp.color_ramp.elements[0].position = 0.36
rp.color_ramp.elements[0].color = (base[0] * 0.62, base[1] * 0.62, base[2] * 0.62, 1)
rp.color_ramp.elements[1].position = 0.66
rp.color_ramp.elements[1].color = (min(1, base[0] * 1.18), min(1, base[1] * 1.18), min(1, base[2] * 1.18), 1)
nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
nt.links.new(mp.outputs["Vector"], nz.inputs["Vector"])
nt.links.new(nz.outputs["Fac"], rp.inputs["Fac"])
nt.links.new(rp.outputs["Color"], bsdf.inputs["Base Color"])

GUN = {"sov": dict(x0=2.70, x1=4.70, ylim=0.78, zmin=1.03, zmax=1.52, dz=0.14,
                   mount=(2.95, 3.85, 0.20, 0.86, 1.08)),
       "jkl": dict(x0=2.80, x1=4.70, ylim=0.78, zmin=1.10, zmax=1.55, dz=0.07,
                   mount=(3.05, 3.95, 0.20, 0.96, 1.16))}[TAG.rstrip("0123456789")]
moved, mount = pp.seat_guns(o, m, GUN["x0"], GUN["x1"], GUN["ylim"], GUN["zmin"],
                            GUN["zmax"], GUN["dz"], GUN["mount"], m_brass)
R = m["Rprop"] * 0.98
piv, parts = pp.assemble_prop(m, R, m_wood, m_gold, m_brass, tag="PROP")
tailn = pp.paint_tail(o, m, c["tail"], name="TailBlack_" + TAG, mode=c["tail_mode"]) if c["tail"] else 0
bolt = pp.add_fin_bolt(o, m, color=c["bolt_rgb"], name="FinBolt_" + TAG) if c["bolt"] else []
rig, stats, hinges = pp.build_rig(o, m)
piv.parent = None

# quick pose so the check renders show every surface actually moving
P = rig.pose.bones
# positive input = stick right / stick back / right pedal, so the check render
# shows a right bank with the rudder agreeing instead of fighting it
for b in ("ail_lo_L", "ail_lo_R", "ail_up_L", "ail_up_R"):
    P[b].rotation_euler = (0, math.radians(22 * pp.CONTROL_SIGN[b]), 0)
P["elevator"].rotation_euler = (0, math.radians(18 * pp.CONTROL_SIGN["elevator"]), 0)
P["rudder"].rotation_euler = (0, math.radians(22 * pp.CONTROL_SIGN["rudder"]), 0)
piv.rotation_euler = (math.radians(12), 0, 0)
bpy.context.view_layer.update()

lv.VIEWS["front2"] = (1, 0, 0)
lv.VIEWS["nq"] = (1.0, -0.62, 0.34)
lv.VIEWS["rq"] = (-0.9, -0.8, 0.45)
lv.setup_render("EEVEE")
sc = bpy.context.scene
# the demo-video pass leaves the scene on FFMPEG; still shots need PNG back
sc.render.image_settings.file_format = 'PNG'
sc.render.use_motion_blur = False
sc.render.resolution_x, sc.render.resolution_y = 1000, 750
shots = lv.shoot(TAG + "_chk", ["left", "front2", "q34", "top", "rq"], ortho=11.0, target=(0, 0, 0.2), dist=26)
shots += lv.shoot(TAG + "_chknose", ["front2"], ortho=5.4, target=(m["cut_x"] - 2.6, m["ax_y"], m["ax_z"]), dist=26)
shots += lv.shoot(TAG + "_chknose", ["nq"], ortho=4.6, target=(m["cut_x"] - 1.6, m["ax_y"], m["ax_z"]), dist=26)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE, "plane_%s.blend" % TAG))
print(json.dumps({"tag": TAG, "measure": m, "hinges": hinges, "weights": stats,
                  "painted_cut_faces": painted, "flat_wing_faces": flats, "zones": zonal, "gun_verts_moved": moved, "tail_faces": tailn, "bolt": bolt, "engine_core_removed": cleaned, "hole_r": round(hole_r, 3), "film": film, "prop_R": round(R, 3),
                  "shots": [os.path.basename(p) for p in shots]}))
