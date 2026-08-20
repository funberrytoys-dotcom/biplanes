"""Reusable pipeline: Tripo biplane -> canonical 2-blade prop + closed engine face + control-surface rig."""
import bpy, bmesh, math, json, os
from mathutils import Vector, Matrix

# ---------------------------------------------------------------- helpers
def s2l(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def rgb(t):
    return tuple(s2l(v) for v in t)

def ramp(v, a, b):
    if a == b: return 1.0 if v >= b else 0.0
    t = max(0.0, min(1.0, (v - a) / (b - a)))
    return t * t * (3 - 2 * t)

def band(v, lo_out, lo_in, hi_in, hi_out):
    return min(ramp(v, lo_out, lo_in), 1.0 - ramp(v, hi_in, hi_out))

def wipe():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for blk in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras,
                bpy.data.armatures, bpy.data.images, bpy.data.actions, bpy.data.node_groups):
        for b in list(blk):
            if getattr(b, "users", 0) == 0:
                try: blk.remove(b)
                except Exception: pass

def bounds(o):
    bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
    mn = Vector((min(p.x for p in bb), min(p.y for p in bb), min(p.z for p in bb)))
    mx = Vector((max(p.x for p in bb), max(p.y for p in bb), max(p.z for p in bb)))
    return mn, mx, (mx - mn), (mx + mn) / 2

def load(src, span=10.0):
    bpy.ops.import_scene.gltf(filepath=src)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    for o in bpy.context.scene.objects: o.select_set(False)
    for o in meshes: o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1: bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    mn, mx, dim, ctr = bounds(o)
    o.location -= ctr
    bpy.context.view_layer.update(); bpy.ops.object.transform_apply(location=True)
    mn, mx, dim, ctr = bounds(o)
    s = span / max(dim.x, dim.y)
    o.scale = (s, s, s); bpy.ops.object.transform_apply(scale=True)
    o.name = "PLANE"
    return o

# ---------------------------------------------------------------- measurement
def measure(o):
    V = [v.co for v in o.data.vertices]
    mn, mx, dim, ctr = bounds(o)
    m = {"dim": [round(c, 3) for c in dim], "mn": [round(c, 3) for c in mn], "mx": [round(c, 3) for c in mx]}
    L = dim.x; halfspan = dim.y / 2

    # --- propeller disc: walk BACK from the nose. The disc is the first radius
    #     bulge; behind it the radius collapses to the cowling.
    step = 0.05
    nsl = int(0.28 * L / step)
    sl = []
    for i in range(nsl):
        a = mx.x - (i + 1) * step; b = a + step
        pts = [c for c in V if a <= c.x < b]
        sl.append((a, max((math.hypot(c.y, c.z) for c in pts), default=0.0), len(pts)))
    win = int(0.50 * nsl)
    Rprop = max((r for _, r, _ in sl[:win]), default=1.0)
    peak_i = max(range(win), key=lambda i: sl[i][1])
    # cut just behind the disc: first slice whose radius collapses to the cowling
    cut_x = sl[peak_i][0]
    for i in range(peak_i, len(sl)):
        if sl[i][1] < 0.55 * Rprop:
            cut_x = sl[i][0] + step
            break
    m["Rprop"] = round(Rprop, 3); m["cut_x"] = round(cut_x, 3)

    # cowl opening radius right behind the cut
    lip = [c for c in V if cut_x - 0.22 < c.x <= cut_x]
    m["lip_r"] = round(max((math.hypot(c.y, c.z) for c in lip), default=0.6), 3)
    cowl = [c for c in V if cut_x - 0.9 < c.x <= cut_x - 0.25]
    m["cowl_r"] = round(max((math.hypot(c.y, c.z) for c in cowl), default=1.2), 3)
    # engine axis
    ax = [c for c in V if cut_x - 0.5 < c.x <= cut_x]
    m["ax_y"] = round((min(c.y for c in ax) + max(c.y for c in ax)) / 2, 3)
    m["ax_z"] = round((min(c.z for c in ax) + max(c.z for c in ax)) / 2, 3)

    # --- wing planes
    outb = [c for c in V if abs(c.y) > 0.44 * dim.y]
    zs = sorted(c.z for c in outb)
    lo = [z for z in zs if z < 0.4 * (mx.z + mn.z) / 1.0 or z < 0.5]
    lowz = [z for z in zs if z < (mn.z + mx.z) / 2]
    upz = [z for z in zs if z >= (mn.z + mx.z) / 2]
    m["wing_lo_z"] = round(sum(lowz) / len(lowz), 3)
    m["wing_up_z"] = round(sum(upz) / len(upz), 3)

    def wing_chord(wz, halfz=0.42):
        pts = [c for c in V if abs(c.z - wz) < halfz and 0.50 * halfspan < abs(c.y) < 0.95 * halfspan]
        if not pts: return None
        return [round(min(p.x for p in pts), 3), round(max(p.x for p in pts), 3)]
    m["wing_lo_chord"] = wing_chord(m["wing_lo_z"])
    m["wing_up_chord"] = wing_chord(m["wing_up_z"])
    m["halfspan"] = round(halfspan, 3)

    # --- tail
    tx = mn.x + 0.26 * L
    ht = [c for c in V if c.x < tx and 0.10 * halfspan < abs(c.y) and abs(c.z - m["ax_z"]) < 0.55]
    if ht:
        m["htail_chord"] = [round(min(c.x for c in ht), 3), round(max(c.x for c in ht), 3)]
        m["htail_span"] = round(max(abs(c.y) for c in ht), 3)
        m["htail_z"] = round((min(c.z for c in ht) + max(c.z for c in ht)) / 2, 3)
    fin = [c for c in V if c.x < tx and abs(c.y) < 0.10 * halfspan and c.z > m["ax_z"] + 0.55]
    if fin:
        m["fin_chord"] = [round(min(c.x for c in fin), 3), round(max(c.x for c in fin), 3)]
        m["fin_z"] = [round(min(c.z for c in fin), 3), round(max(c.z for c in fin), 3)]
    return m

# ---------------------------------------------------------------- nose surgery
def cut_prop(o, m):
    me = o.data
    bm = bmesh.new(); bm.from_mesh(me)
    kill = [v for v in bm.verts if v.co.x > m["cut_x"]]
    bmesh.ops.delete(bm, geom=kill, context='VERTS')
    bm.edges.ensure_lookup_table()
    bd = [e for e in bm.edges if len(e.link_faces) == 1 and
          e.verts[0].co.x > m["cut_x"] - 0.30 and e.verts[1].co.x > m["cut_x"] - 0.30]
    try: bmesh.ops.holes_fill(bm, edges=bd, sides=0)
    except Exception: pass
    still = [e for e in bm.edges if len(e.link_faces) == 1 and e.verts[0].co.x > m["cut_x"] - 0.30]
    if still:
        try: bmesh.ops.triangle_fill(bm, edges=still, use_beauty=True)
        except Exception: pass
    bmesh.ops.recalc_face_normals(bm, faces=[f for f in bm.faces if f.calc_center_median().x > m["cut_x"] - 0.35])
    bm.to_mesh(me); bm.free(); me.update()

def mat(name, base, rough=0.45, metal=0.0):
    mt = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mt.use_nodes = True
    b = mt.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (base[0], base[1], base[2], 1.0)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    return mt

def paint_cut(o, m, dark):
    me = o.data
    if dark.name not in [x.name for x in me.materials if x]:
        me.materials.append(dark)
    idx = [i for i, x in enumerate(me.materials) if x and x.name == dark.name][0]
    n = 0
    for p in me.polygons:
        if p.center.x > m["cut_x"] - 0.08 and abs(p.normal.x) > 0.45:
            p.material_index = idx; n += 1
    me.update()
    return n

# ---------------------------------------------------------------- propeller
def naca(s, th, cam=0.030, p=0.42):
    yt = 5 * th * (0.2969 * math.sqrt(max(s, 0)) - 0.1260 * s - 0.3516 * s * s + 0.2843 * s ** 3 - 0.1036 * s ** 4)
    if s < p: yc = cam / (p * p) * (2 * p * s - s * s)
    else:     yc = cam / ((1 - p) ** 2) * ((1 - 2 * p) + 2 * p * s - s * s)
    return yc + yt, yc - yt

def build_prop(name, R, m_wood, m_gold, cmax_ratio=0.185, root=0.10,
               twist_root=28.0, twist_tip=7.0, NS=30, NP=22, gold_from=0.865):
    CMAX = cmax_ratio * R

    def chord(t):
        base = CMAX * (0.58 + 0.50 * math.sin(math.pi * min(t, 1.0) ** 0.70))
        return base * (1.0 - 0.62 * max(0.0, (t - 0.82) / 0.18) ** 1.5)

    def thick(t): return 0.145 - 0.085 * t
    def twist(t): return math.radians(twist_root - (twist_root - twist_tip) * t ** 0.85)

    bmv = bmesh.new(); rings = []
    for i in range(NS + 1):
        t = i / NS
        r = root + (R - root) * t
        c = chord(t); th = thick(t); a = twist(t)
        pts = []
        for j in range(NP + 1):
            s = 0.5 * (1 - math.cos(math.pi * j / NP))
            up, lo = naca(s, th); pts.append((s, up, lo))
        seq = [(s, up) for s, up, lo in pts] + [(s, lo) for s, up, lo in reversed(pts[1:-1])]
        ring = []
        for (s, yv) in seq:
            cu = (s - 0.38) * c; cv = yv * c
            ring.append(bmv.verts.new((cu * math.sin(a) + cv * math.cos(a),
                                       cu * math.cos(a) - cv * math.sin(a), r)))
        rings.append(ring)
    bmv.verts.ensure_lookup_table()
    n = len(rings[0])
    for i in range(NS):
        for j in range(n):
            try: bmv.faces.new((rings[i][j], rings[i][(j + 1) % n], rings[i + 1][(j + 1) % n], rings[i + 1][j]))
            except Exception: pass
    for r_, rev in ((rings[0], True), (rings[-1], False)):
        try: bmv.faces.new(tuple(reversed(r_)) if rev else tuple(r_))
        except Exception: pass
    bmesh.ops.recalc_face_normals(bmv, faces=bmv.faces[:])
    md = bpy.data.meshes.new(name); bmv.to_mesh(md); bmv.free()
    ob = bpy.data.objects.new(name, md); bpy.context.scene.collection.objects.link(ob)
    md.materials.append(m_wood); md.materials.append(m_gold)
    for p in md.polygons:
        tt = (p.center.z - root) / (R - root)
        p.material_index = 1 if tt > gold_from else 0
        p.use_smooth = True
    return ob

def assemble_prop(m, R, m_wood, m_gold, m_brass, tag="PROP"):
    a = build_prop(tag + "_BLADE_A", R, m_wood, m_gold)
    b = a.copy(); b.data = a.data.copy(); b.name = tag + "_BLADE_B"
    bpy.context.scene.collection.objects.link(b)
    b.rotation_euler = (math.radians(180), 0, 0)

    parts = [a, b]
    hub_r = 0.165 * R

    def prim(kind, nm, loc, **kw):
        getattr(bpy.ops.mesh, kind)(location=loc, **kw)
        ob = bpy.context.active_object; ob.name = nm
        ob.rotation_euler = (0, math.radians(90), 0)
        ob.data.materials.append(m_brass)
        for p in ob.data.polygons: p.use_smooth = True
        return ob

    parts.append(prim("primitive_cylinder_add", tag + "_HUB", (0.0, 0, 0), vertices=56,
                      radius=hub_r, depth=0.075 * R))
    parts.append(prim("primitive_cone_add", tag + "_BOSS", (0.072 * R, 0, 0), vertices=48,
                      radius1=0.140 * R, radius2=0.100 * R, depth=0.09 * R))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.100 * R, location=(0.113 * R, 0, 0), segments=40, ring_count=20)
    dome = bpy.context.active_object; dome.name = tag + "_DOME"; dome.scale = (1.25, 1, 1)
    dome.data.materials.append(m_brass)
    for p in dome.data.polygons: p.use_smooth = True
    parts.append(dome)

    # crankcase disc that closes the engine opening
    bpy.ops.mesh.primitive_cone_add(vertices=52, radius1=0.50 * m["lip_r"], radius2=0.34 * m["lip_r"],
                                    depth=0.17, location=(-0.10, 0, 0))
    ck = bpy.context.active_object; ck.name = tag + "_CRANKCASE"
    ck.rotation_euler = (0, math.radians(90), 0)
    ck.data.materials.append(m_brass)
    for p in ck.data.polygons: p.use_smooth = True

    piv = bpy.data.objects.new(tag + "_PIVOT", None)
    bpy.context.scene.collection.objects.link(piv)
    piv.empty_display_type = 'PLAIN_AXES'; piv.empty_display_size = 0.7
    piv.location = (m["cut_x"] + 0.16, m["ax_y"], m["ax_z"])
    piv.rotation_mode = 'XYZ'
    for ob in parts:
        ob.parent = piv; ob.matrix_parent_inverse = Matrix.Identity(4)
    ck.parent = piv; ck.matrix_parent_inverse = Matrix.Identity(4)
    bpy.context.view_layer.update()
    return piv, parts + [ck]

# ---------------------------------------------------------------- rig
def build_rig(o, m, hinge_frac=0.28, blend=0.10):
    hs = m["halfspan"]
    lo_te, lo_le = m["wing_lo_chord"]; up_te, up_le = m["wing_up_chord"]
    lo_h = lo_te + hinge_frac * (lo_le - lo_te)
    up_h = up_te + hinge_frac * (up_le - up_te)
    ht_te, ht_le = m["htail_chord"]
    ht_h = ht_te + 0.46 * (ht_le - ht_te)
    fn_te, fn_le = m["fin_chord"]
    fn_h = fn_te + 0.46 * (fn_le - fn_te)
    loz, upz = m["wing_lo_z"], m["wing_up_z"]
    htz = m["htail_z"]; hts = m["htail_span"]
    fz0, fz1 = m["fin_z"]

    SURF = {
        "ail_lo_L": dict(head=(lo_h, -0.48 * hs, loz), tail=(lo_h, -1.02 * hs, loz),
                         w=lambda c: (1 - ramp(c.x, lo_h - blend / 2, lo_h + blend / 2)) *
                                     band(-c.y, 0.46 * hs, 0.55 * hs, 0.94 * hs, 1.00 * hs) *
                                     band(c.z, loz - 0.55, loz - 0.42, loz + 0.42, loz + 0.55)),
        "ail_lo_R": dict(head=(lo_h, 0.48 * hs, loz), tail=(lo_h, 1.02 * hs, loz),
                         w=lambda c: (1 - ramp(c.x, lo_h - blend / 2, lo_h + blend / 2)) *
                                     band(c.y, 0.46 * hs, 0.55 * hs, 0.94 * hs, 1.00 * hs) *
                                     band(c.z, loz - 0.55, loz - 0.42, loz + 0.42, loz + 0.55)),
        "ail_up_L": dict(head=(up_h, -0.48 * hs, upz), tail=(up_h, -1.02 * hs, upz),
                         w=lambda c: (1 - ramp(c.x, up_h - blend / 2, up_h + blend / 2)) *
                                     band(-c.y, 0.46 * hs, 0.55 * hs, 0.94 * hs, 1.00 * hs) *
                                     band(c.z, upz - 0.55, upz - 0.42, upz + 0.42, upz + 0.55)),
        "ail_up_R": dict(head=(up_h, 0.48 * hs, upz), tail=(up_h, 1.02 * hs, upz),
                         w=lambda c: (1 - ramp(c.x, up_h - blend / 2, up_h + blend / 2)) *
                                     band(c.y, 0.46 * hs, 0.55 * hs, 0.94 * hs, 1.00 * hs) *
                                     band(c.z, upz - 0.55, upz - 0.42, upz + 0.42, upz + 0.55)),
        "elevator": dict(head=(ht_h, -1.06 * hts, htz), tail=(ht_h, 1.06 * hts, htz),
                         w=lambda c: ramp(-c.x, -ht_h - blend / 2, -ht_h + blend / 2) *
                                     band(abs(c.y), 0.10 * hts, 0.26 * hts, 0.94 * hts, 1.04 * hts) *
                                     band(c.z, htz - 0.60, htz - 0.46, htz + 0.46, htz + 0.60)),
        "rudder": dict(head=(fn_h, 0.0, fz0 - 0.06), tail=(fn_h, 0.0, fz1 + 0.10),
                       w=lambda c: ramp(-c.x, -fn_h - blend / 2, -fn_h + blend / 2) *
                                   band(c.z, fz0 - 0.20, fz0 - 0.02, fz1 - 0.06, fz1 + 0.05) *
                                   band(abs(c.y), -1.0, 0.0, 0.20 * hs * 0.5, 0.34 * hs * 0.5)),
    }

    for nm in ("RIG",):
        old = bpy.data.objects.get(nm)
        if old: bpy.data.objects.remove(old, do_unlink=True)
    for md in list(o.modifiers): o.modifiers.remove(md)
    for g in list(o.vertex_groups): o.vertex_groups.remove(g)

    ad = bpy.data.armatures.new("RIG")
    rig = bpy.data.objects.new("RIG", ad)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    eb = ad.edit_bones
    root = eb.new("root"); root.head = (0, 0, 0); root.tail = (1.0, 0, 0)
    for nm, d in SURF.items():
        b = eb.new(nm); b.head = Vector(d["head"]); b.tail = Vector(d["tail"])
        b.parent = root; b.use_deform = True
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in rig.pose.bones: pb.rotation_mode = 'XYZ'

    stats = {}
    for nm, d in SURF.items():
        vg = o.vertex_groups.new(name=nm)
        f = d["w"]; k = 0
        for v in o.data.vertices:
            w = f(v.co)
            if w > 0.002:
                vg.add([v.index], w, 'REPLACE'); k += 1
        stats[nm] = k
    md = o.modifiers.new("Armature", 'ARMATURE'); md.object = rig
    o.parent = rig; o.matrix_parent_inverse = Matrix.Identity(4)
    bpy.context.view_layer.update()
    return rig, stats, {"lo_h": round(lo_h, 3), "up_h": round(up_h, 3),
                        "ht_h": round(ht_h, 3), "fn_h": round(fn_h, 3)}


# ---------------------------------------------------------------- flat repaint
def repaint_flats(o, m, body, name="WingFlat", nz=0.40):
    """Tripo bakes garbage onto the wing tops. Replace the flat upper/lower wing
    and tailplane surfaces with the canonical flat colour; leave rims, struts and
    the fuselage on the original texture."""
    me = o.data
    mt = mat(name, rgb(body), 0.52, 0.0)
    if mt.name not in [x.name for x in me.materials if x]:
        me.materials.append(mt)
    idx = [i for i, x in enumerate(me.materials) if x and x.name == mt.name][0]
    hs = m["halfspan"]
    # (centre z, half thickness, minimum |y| as a fraction of half-span).
    # The upper wing clears the fuselage, so it repaints all the way across;
    # the lower wing and tailplane must leave the fuselage alone.
    slabs = [(m["wing_lo_z"], 0.42, 0.14), (m["wing_up_z"], 0.46, 0.0)]
    if "htail_z" in m: slabs.append((m["htail_z"], 0.30, 0.05))
    n = 0
    for p in me.polygons:
        c = p.center
        if abs(p.normal.z) < nz: continue
        for wz, half, ymin in slabs:
            if abs(c.z - wz) < half and abs(c.y) >= ymin * hs:
                p.material_index = idx; n += 1
                break
    me.update()
    return n


# ---------------------------------------------------------------- gun seating
def seat_guns(o, m, x0, x1, ylim, zmin, zmax, dz, mount=None, m_brass=None):
    """Tripo floats the cowl guns above the deck. Drop the gun cluster onto the
    fuselage and, optionally, add a small mount fairing under it."""
    me = o.data
    n = 0
    for v in me.vertices:
        c = v.co
        if x0 < c.x < x1 and abs(c.y) < ylim and zmin < c.z < zmax:
            v.co.z -= dz; n += 1
    me.update()
    made = None
    if mount and m_brass:
        mx0, mx1, my, mz0, mz1 = mount
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=((mx0 + mx1) / 2, 0.0, (mz0 + mz1) / 2))
        b = bpy.context.active_object
        b.name = "GUN_MOUNT"
        b.scale = ((mx1 - mx0) / 2, my, (mz1 - mz0) / 2)
        bpy.ops.object.transform_apply(scale=True)
        bev = b.modifiers.new("Bevel", 'BEVEL')
        bev.width = 0.035; bev.segments = 2
        b.data.materials.append(m_brass)
        for p in b.data.polygons: p.use_smooth = False
        made = b.name
    return n, made


# ---------------------------------------------------------------- engine face
def clean_engine_face(o, m, m_dark):
    """Tripo leaves shredded geometry inside the cowling. Remove the inner core
    (the cylinders sit further out and stay) and back it with a dark disc."""
    me = o.data
    ay, az = m["ax_y"], m["ax_z"]
    rin = 0.60 * m["lip_r"]
    xin = m["cut_x"] - 0.62
    bm = bmesh.new(); bm.from_mesh(me)
    kill = [v for v in bm.verts
            if v.co.x > xin and math.hypot(v.co.y - ay, v.co.z - az) < rin]
    bmesh.ops.delete(bm, geom=kill, context='VERTS')
    bm.to_mesh(me); bm.free(); me.update()
    bpy.ops.mesh.primitive_cylinder_add(vertices=44, radius=0.70 * m["lip_r"], depth=0.06,
                                        location=(m["cut_x"] - 0.58, ay, az))
    d = bpy.context.active_object; d.name = "ENGINE_BACK"
    d.rotation_euler = (0, math.radians(90), 0)
    d.data.materials.append(m_dark)
    return len(kill)
