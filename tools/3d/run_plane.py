import bpy, math, json, os, sys, importlib.util
BASE = r"C:\Users\serge\AppData\Local\Temp\claude\C--Users-serge-Documents-Playground-Biplanes\882b20d1-942a-41ff-b96c-218c1c8afa45\scratchpad\3d"
def imp(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(BASE, name + ".py"))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
pp = imp("plane_pipeline"); lv = imp("lib_view")

CFG = {
    "sov": dict(src=r"C:\Users\serge\Downloads\vintage airplane 3d model (1).glb",
                wood=(141, 47, 14), gold=(186, 114, 16), brass=(186, 114, 16), wing=(11, 65, 150),
                rim=(176, 106, 14), tail=None, tail_mode="full", bolt=False, bolt_rgb=(255, 255, 255)),
    "jkl": dict(src=r"C:\Users\serge\Downloads\red biplane 3d model (3).glb",
                wood=(143, 33, 25), gold=(215, 140, 40), brass=(198, 132, 42), wing=(37, 37, 38),
                rim=(26, 26, 27), tail=(34, 34, 35), tail_mode="full", bolt=True, bolt_rgb=(246, 246, 244)),
    # Second Jackal squadron: same airframe, inverted scheme so the two read
    # apart in a dogfight — crimson wings and tail, black edging, black bolt.
    "jkl2": dict(src=r"C:\Users\serge\Downloads\red biplane 3d model (3).glb",
                 wood=(120, 28, 22), gold=(196, 122, 34), brass=(186, 122, 40), wing=(96, 30, 25),
                 # tail left on the Tripo texture: a painted one sat lighter than the
                 # fuselage and the seam showed
                 rim=(28, 28, 29), tail=(34, 34, 35), tail_mode="fin",
                 bolt=True, bolt_rgb=(246, 246, 244)),
}
TAG = "%TAG%"
c = CFG[TAG]

pp.wipe()
o = pp.load(c["src"], span=10.0)
m = pp.measure(o)
hole_r = pp.cut_prop(o, m)
m_dark = pp.mat("EngineDark_" + TAG, (0.014, 0.013, 0.013), 0.70, 0.35)
m_brass = pp.mat("PropBrass_" + TAG, pp.rgb(c["brass"]), 0.30, 0.85)
painted = pp.paint_cut(o, m, m_brass)
cleaned = pp.clean_engine_face(o, m, m_dark, m_brass, mode="%MODE%")
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
for b in ("ail_lo_L", "ail_lo_R", "ail_up_L", "ail_up_R"):
    P[b].rotation_euler = (0, math.radians(22), 0)
P["elevator"].rotation_euler = (0, math.radians(18), 0)
P["rudder"].rotation_euler = (0, math.radians(22), 0)
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
                  "painted_cut_faces": painted, "flat_wing_faces": flats, "gun_verts_moved": moved, "tail_faces": tailn, "bolt": bolt, "engine_core_removed": cleaned, "hole_r": round(hole_r, 3), "prop_R": round(R, 3),
                  "shots": [os.path.basename(p) for p in shots]}))
