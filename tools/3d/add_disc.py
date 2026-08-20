import bpy, math, json, os
BASE = r"C:\Users\serge\AppData\Local\Temp\claude\C--Users-serge-Documents-Playground-Biplanes\882b20d1-942a-41ff-b96c-218c1c8afa45\scratchpad\3d"
made = {}
for tag, tint in (("sov", (0.09, 0.04, 0.02)), ("jkl", (0.08, 0.02, 0.02))):
    bpy.ops.wm.open_mainfile(filepath=os.path.join(BASE, "plane_%s.blend" % tag))
    piv = bpy.data.objects["PROP_PIVOT"]
    old = bpy.data.objects.get("PROP_DISC")
    if old: bpy.data.objects.remove(old, do_unlink=True)
    R = max(abs(v.co.z) for v in bpy.data.objects["PROP_BLADE_A"].data.vertices)
    before = {o.name for o in bpy.data.objects}
    bpy.ops.mesh.primitive_circle_add(vertices=64, radius=R * 0.99, fill_type='NGON',
                                      location=piv.location)
    d = next(o for o in bpy.data.objects if o.name not in before)
    d.name = "PROP_DISC"
    d.rotation_euler = (0, math.radians(90), 0)
    m = bpy.data.materials.get("PropDisc_" + tag) or bpy.data.materials.new("PropDisc_" + tag)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (tint[0], tint[1], tint[2], 1.0)
    b.inputs["Roughness"].default_value = 1.0
    b.inputs["Alpha"].default_value = 0.09
    try: m.surface_render_method = 'BLENDED'
    except Exception:
        try: m.blend_method = 'BLEND'
        except Exception: pass
    m.use_backface_culling = False
    d.data.materials.append(m)
    d.parent = piv
    from mathutils import Matrix
    d.matrix_parent_inverse = piv.matrix_world.inverted()
    d.location = (0, 0, 0)
    # keep the sweep disc out of the ink pass or Freestyle rings it with a hard oval
    coll = bpy.data.collections.get("FS_EXCLUDE") or bpy.data.collections.new("FS_EXCLUDE")
    if coll.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(coll)
    for c in list(d.users_collection):
        if c is not coll: c.objects.unlink(d)
    if d.name not in coll.objects: coll.objects.link(d)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE, "plane_%s.blend" % tag))
    made[tag] = round(R, 3)
print(json.dumps(made))
