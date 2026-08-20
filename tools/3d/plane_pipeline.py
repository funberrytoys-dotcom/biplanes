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
    # A triangle fan across the remaining bore comes out as a zigzag star with
    # scrambled UVs, so leave that hole open and measure it: a brass cap covers it.
    # Only the rim right at the cut plane counts: the cowling's own front lip is
    # an open edge in the Tripo mesh too, and it must not widen the cap.
    still = [e for e in bm.edges if len(e.link_faces) == 1 and e.verts[0].co.x > m["cut_x"] - 0.09]
    hole_r = 0.0
    for e in still:
        for v in e.verts:
            hole_r = max(hole_r, math.hypot(v.co.y - m["ax_y"], v.co.z - m["ax_z"]))
    bmesh.ops.recalc_face_normals(bm, faces=[f for f in bm.faces if f.calc_center_median().x > m["cut_x"] - 0.35])
    bm.to_mesh(me); bm.free(); me.update()
    m["hole_r"] = round(hole_r, 3)
    return hole_r

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

    # The 2D canon has a flat riveted brass boss, not a spinner cone - keep it low.
    parts.append(prim("primitive_cylinder_add", tag + "_HUB", (0.0, 0, 0), vertices=56,
                      radius=hub_r, depth=0.075 * R))
    parts.append(prim("primitive_cone_add", tag + "_BOSS", (0.055 * R, 0, 0), vertices=48,
                      radius1=0.115 * R, radius2=0.075 * R, depth=0.038 * R))
    before = {o.name for o in bpy.data.objects}
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.075 * R, location=(0.074 * R, 0, 0),
                                         segments=36, ring_count=18)
    dome = next(o for o in bpy.data.objects if o.name not in before)
    dome.name = tag + "_DOME"; dome.scale = (0.75, 1, 1)
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
    HARD = True   # rigid panels: cut the seams, weight 0/1, nothing bends
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

    # Cut the mesh along every hinge seam first, so a strictly 0/1 weight makes the
    # panel swing as one rigid piece instead of bending the wing skin.
    BOX = {
        "ail_lo_L": (lo_te - 0.35, lo_h, 0.50 * hs, 1.03 * hs, loz - 0.45, loz + 0.45),
        "ail_lo_R": (lo_te - 0.35, lo_h, 0.50 * hs, 1.03 * hs, loz - 0.45, loz + 0.45),
        "ail_up_L": (up_te - 0.35, up_h, 0.50 * hs, 1.03 * hs, upz - 0.45, upz + 0.45),
        "ail_up_R": (up_te - 0.35, up_h, 0.50 * hs, 1.03 * hs, upz - 0.45, upz + 0.45),
        "elevator": (ht_te - 0.35, ht_h, 0.20 * hts, 1.10 * hts, htz - 0.42, htz + 0.42),
        "rudder":   (fn_te - 0.35, fn_h, 0.0, 0.30 * hs, fz0 + 0.02, fz1 + 0.30),
    }
    if HARD:
        done = set()
        for nm, b in BOX.items():
            key = (round(b[1], 3), round(b[4], 3))
            if key in done: continue
            done.add(key)
            _bisect(o, Vector((b[1], 0, 0)), Vector((1, 0, 0)), b)
            for ye in (b[2], b[3]):
                if ye <= 0.001: continue
                for sgn in (-1, 1):
                    _bisect(o, Vector((0, sgn * ye, 0)), Vector((0, 1, 0)), b)

    def hard_w(nm, c):
        b = BOX[nm]
        if not (b[0] <= c.x <= b[1] + 1e-4): return 0.0
        if not (b[4] - 1e-4 <= c.z <= b[5] + 1e-4): return 0.0
        if nm.endswith("_L") and c.y > 0: return 0.0
        if nm.endswith("_R") and c.y < 0: return 0.0
        ay = abs(c.y)
        if not (b[2] - 1e-4 <= ay <= b[3] + 1e-4): return 0.0
        return 1.0

    stats = {}
    for nm, d in SURF.items():
        vg = o.vertex_groups.new(name=nm)
        f = (lambda c, _n=nm: hard_w(_n, c)) if HARD else d["w"]
        k = 0
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
def repaint_flats(o, m, body, name="WingFlat", nz=0.40, rim=None):
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
    idx_rim = idx
    if rim is not None:
        mr = mat(name + "Rim", rgb(rim), 0.44, 0.25)
        if mr.name not in [x.name for x in me.materials if x]:
            me.materials.append(mr)
        idx_rim = [i for i, x in enumerate(me.materials) if x and x.name == mr.name][0]
    n = 0
    for p in me.polygons:
        c = p.center
        flat = abs(p.normal.z) >= nz
        # the rim band is only the wing edge: well outboard of the fuselage, and
        # never on the tail, or it swallows the cowling and the cockpit sides
        rim_ok = (rim is not None and not flat and abs(c.y) > 0.30 * hs)
        if not flat and not rim_ok: continue
        for wz, half, ymin in slabs[:2] if rim_ok else slabs:
            if abs(c.z - wz) < half and abs(c.y) >= ymin * hs:
                p.material_index = idx if flat else idx_rim
                n += 1
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
def clean_engine_face(o, m, m_dark, m_brass=None, mode="full"):
    """Tripo leaves shredded geometry inside the cowling. Remove the inner core
    (the cylinders sit further out and stay) and back it with a dark disc."""
    me = o.data
    ay, az = m["ax_y"], m["ax_z"]
    rin = (0.60 if mode == "full" else 0.30) * m["lip_r"]
    xin = m["cut_x"] - (0.62 if mode == "full" else 0.24)
    bm = bmesh.new(); bm.from_mesh(me)
    kill = [v for v in bm.verts
            if v.co.x > xin and math.hypot(v.co.y - ay, v.co.z - az) < rin]
    bmesh.ops.delete(bm, geom=kill, context='VERTS')
    bm.to_mesh(me); bm.free(); me.update()
    # A small plug left daylight between the cylinders. Close the whole bore with
    # one wall sitting just behind the cylinder ring instead.
    # Two pieces, sized off the cylinder ring so the cylinders stay visible:
    #  - a back wall deep in the cowling, so gaps between cylinders look at metal
    #  - a narrow crankcase cap filling the bore in the middle
    def disc(name, radius, depth, x, smooth):
        before = {o.name for o in bpy.data.objects}
        bpy.ops.mesh.primitive_cylinder_add(vertices=56, radius=radius, depth=depth,
                                            location=(x, ay, az))
        ob = next(o for o in bpy.data.objects if o.name not in before)
        ob.name = name
        ob.rotation_euler = (0, math.radians(90), 0)
        ob.data.materials.append(m_dark)
        for pf in ob.data.polygons: pf.use_smooth = smooth
        return ob

    # The cowling narrows towards the firewall, so size the back wall off the
    # actual radius where it sits instead of guessing from the lip.
    V = [v.co for v in me.vertices]
    xw = m["cut_x"] - 0.72
    here = [c for c in V if xw - 0.07 <= c.x <= xw + 0.07]
    r_here = max((math.hypot(c.y - ay, c.z - az) for c in here), default=1.2 * m["lip_r"])
    if mode == "full":
        disc("ENGINE_BACKWALL", 0.92 * r_here, 0.08, xw, False)
        disc("ENGINE_HUBCAP", 0.80 * m["lip_r"], 0.34, m["cut_x"] - 0.45, True)
    else:
        cap_r = max(0.35 * m["lip_r"], 1.02 * m.get("hole_r", 0.0))
        cap = disc("ENGINE_HUBCAP", cap_r, 0.16, m["cut_x"] - 0.05, True)
        if m_brass:
            cap.data.materials.clear(); cap.data.materials.append(m_brass)
    return len(kill)


# ---------------------------------------------------------------- rigid control surfaces
def _in_box(c, b):
    return (b[0] <= c.x <= b[1] and b[2] <= abs(c.y) <= b[3] and b[4] <= c.z <= b[5])

def _bisect(o, co, no, box, pad=0.12):
    """Cut the mesh along one plane, but only inside the surface's box."""
    me = o.data
    bm = bmesh.new(); bm.from_mesh(me)
    big = (box[0] - pad, box[1] + pad, max(0.0, box[2] - pad), box[3] + pad,
           box[4] - pad, box[5] + pad)
    faces = [f for f in bm.faces if _in_box(f.calc_center_median(), big)]
    if faces:
        verts = set(); edges = set()
        for f in faces:
            verts.update(f.verts); edges.update(f.edges)
        bmesh.ops.bisect_plane(bm, geom=list(verts) + list(edges) + faces, dist=1e-5,
                               plane_co=co, plane_no=no,
                               clear_inner=False, clear_outer=False)
    bm.to_mesh(me); bm.free(); me.update()

def _split_off(o, box, name):
    """Move the faces inside `box` into their own object, keeping UVs and materials."""
    me = o.data
    bm = bmesh.new(); bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    sel = [f for f in bm.faces if _in_box(f.calc_center_median(), box)]
    if not sel:
        bm.free(); return None
    uv_src = bm.loops.layers.uv.active
    nb = bmesh.new()
    uv_dst = nb.loops.layers.uv.new(uv_src.name) if uv_src else None
    vmap = {}
    for f in sel:
        nvs = []
        for v in f.verts:
            if v not in vmap: vmap[v] = nb.verts.new(v.co)
            nvs.append(vmap[v])
        try: nf = nb.faces.new(nvs)
        except Exception: continue
        nf.material_index = f.material_index
        nf.smooth = f.smooth
        if uv_dst:
            for ls, ld in zip(f.loops, nf.loops):
                ld[uv_dst].uv = ls[uv_src].uv
    # close the freshly opened rim on the panel
    bmesh.ops.holes_fill(nb, edges=[e for e in nb.edges if len(e.link_faces) == 1], sides=0)
    nm = bpy.data.meshes.new(name)
    nb.to_mesh(nm); nb.free()
    for mt in me.materials: nm.materials.append(mt)
    nob = bpy.data.objects.new(name, nm)
    bpy.context.scene.collection.objects.link(nob)

    bmesh.ops.delete(bm, geom=sel, context='FACES')
    bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if len(e.link_faces) == 1
                                    and _in_box(e.verts[0].co, box) or False], sides=0)
    bm.to_mesh(me); bm.free(); me.update()
    return nob

def build_control_surfaces(o, m, hinge_frac=0.28):
    """Cut the ailerons, elevator and rudder out as separate rigid panels, each
    parented to an empty sitting on its hinge line. No skinning, so nothing bends."""
    hs = m["halfspan"]
    lo_te, lo_le = m["wing_lo_chord"]; up_te, up_le = m["wing_up_chord"]
    lo_h = lo_te + hinge_frac * (lo_le - lo_te)
    up_h = up_te + hinge_frac * (up_le - up_te)
    ht_te, ht_le = m["htail_chord"]; ht_h = ht_te + 0.46 * (ht_le - ht_te)
    fn_te, fn_le = m["fin_chord"];   fn_h = fn_te + 0.46 * (fn_le - fn_te)
    loz, upz = m["wing_lo_z"], m["wing_up_z"]
    htz = m["htail_z"]; hts = m["htail_span"]
    fz0, fz1 = m["fin_z"]
    yi, yo = 0.52 * hs, 1.02 * hs

    SPEC = {
        "ail_lo_L": dict(box=(lo_te - 0.30, lo_h, yi, yo, loz - 0.45, loz + 0.45),
                         side=-1, hinge=(lo_h, 0, loz), axis=1, sign=+1),
        "ail_lo_R": dict(box=(lo_te - 0.30, lo_h, yi, yo, loz - 0.45, loz + 0.45),
                         side=+1, hinge=(lo_h, 0, loz), axis=1, sign=-1),
        "ail_up_L": dict(box=(up_te - 0.30, up_h, yi, yo, upz - 0.45, upz + 0.45),
                         side=-1, hinge=(up_h, 0, upz), axis=1, sign=+1),
        "ail_up_R": dict(box=(up_te - 0.30, up_h, yi, yo, upz - 0.45, upz + 0.45),
                         side=+1, hinge=(up_h, 0, upz), axis=1, sign=-1),
        "elevator": dict(box=(ht_te - 0.30, ht_h, 0.22 * hts, 1.10 * hts, htz - 0.42, htz + 0.42),
                         side=0, hinge=(ht_h, 0, htz), axis=1, sign=+1),
        "rudder":   dict(box=(fn_te - 0.30, fn_h, 0.0, 0.30 * hs, fz0 + 0.02, fz1 + 0.30),
                         side=0, hinge=(fn_h, 0, 0.5 * (fz0 + fz1)), axis=2, sign=+1),
    }

    panels = {}
    for name, sp in SPEC.items():
        b = sp["box"]
        # three cuts: the hinge line plus both span ends, so the panel comes away clean
        _bisect(o, Vector((b[1], 0, 0)), Vector((1, 0, 0)), b)
        for ye in (b[2], b[3]):
            for s in ((-1, 1) if sp["side"] == 0 else (sp["side"],)):
                _bisect(o, Vector((0, s * ye, 0)), Vector((0, 1, 0)), b)
        box = (b[0], b[1], b[2], b[3], b[4], b[5])
        if sp["side"] != 0:
            box_signed = box
        else:
            box_signed = box
        panel = _split_off_side(o, box, sp["side"], name.upper())
        if panel is None: continue
        piv = bpy.data.objects.new(name, None)
        bpy.context.scene.collection.objects.link(piv)
        piv.empty_display_type = 'PLAIN_AXES'; piv.empty_display_size = 0.45
        piv.location = Vector(sp["hinge"])
        piv.rotation_mode = 'XYZ'
        bpy.context.view_layer.update()
        panel.parent = piv
        panel.matrix_parent_inverse = piv.matrix_world.inverted()
        panels[name] = dict(empty=piv, obj=panel, axis=sp["axis"], sign=sp["sign"],
                            faces=len(panel.data.polygons))
    return panels

def _split_off_side(o, box, side, name):
    """Same as _split_off but honours which wing half the panel belongs to."""
    lo, hi = box[2], box[3]
    class _B:
        pass
    def inside(c):
        if not (box[0] <= c.x <= box[1] and box[4] <= c.z <= box[5]): return False
        if side < 0 and c.y > 0: return False
        if side > 0 and c.y < 0: return False
        return lo <= abs(c.y) <= hi
    me = o.data
    bm = bmesh.new(); bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    sel = [f for f in bm.faces if inside(f.calc_center_median())]
    if not sel:
        bm.free(); return None
    uv_src = bm.loops.layers.uv.active
    nb = bmesh.new()
    uv_dst = nb.loops.layers.uv.new(uv_src.name) if uv_src else None
    vmap = {}
    for f in sel:
        nvs = []
        for v in f.verts:
            if v not in vmap: vmap[v] = nb.verts.new(v.co)
            nvs.append(vmap[v])
        try: nf = nb.faces.new(nvs)
        except Exception: continue
        nf.material_index = f.material_index
        nf.smooth = f.smooth
        if uv_dst:
            for ls, ld in zip(f.loops, nf.loops):
                ld[uv_dst].uv = ls[uv_src].uv
    try: bmesh.ops.holes_fill(nb, edges=[e for e in nb.edges if len(e.link_faces) == 1], sides=0)
    except Exception: pass
    nm = bpy.data.meshes.new(name)
    nb.to_mesh(nm); nb.free()
    for mt in me.materials: nm.materials.append(mt)
    nob = bpy.data.objects.new(name, nm)
    bpy.context.scene.collection.objects.link(nob)
    bmesh.ops.delete(bm, geom=sel, context='FACES')
    open_e = [e for e in bm.edges if len(e.link_faces) == 1 and inside(e.verts[0].co)]
    if open_e:
        try: bmesh.ops.holes_fill(bm, edges=open_e, sides=0)
        except Exception: pass
    bm.to_mesh(me); bm.free(); me.update()
    return nob


# ---------------------------------------------------------------- faction tail
def paint_tail(o, m, color, name="TailBlack", aft_frac=0.72, mode="full"):
    """Jackal reference: fin, tailplane and the aft fuselage are black."""
    me = o.data
    mt = mat(name, rgb(color), 0.50, 0.0)
    if mt.name not in [x.name for x in me.materials if x]:
        me.materials.append(mt)
    idx = [i for i, x in enumerate(me.materials) if x and x.name == mt.name][0]
    mn_x, mx_x = m["mn"][0], m["mx"][0]
    aft = mn_x + (1.0 - aft_frac) * (mx_x - mn_x)
    hs = m["halfspan"]; htz = m["htail_z"]; hts = m["htail_span"]
    az = m["ax_z"]
    n = 0
    for p in me.polygons:
        c = p.center
        tail = False
        if mode == "full":
            # z guard: the tail wheel and its leg hang below the fuselage and
            # stay their own colour, as in the reference art
            if c.x < aft and abs(c.y) < 0.22 * hs and c.z > htz - 0.55:
                tail = True                                # aft fuselage
            if c.x < aft + 0.6 and abs(c.z - htz) < 0.36 and 0.08 * hts < abs(c.y) <= 1.15 * hts:
                tail = True                                # tailplane
        if c.x < aft + 0.6 and abs(c.y) < 0.10 * hs and c.z > az + 0.45:
            tail = True                                    # fin
        if tail:
            p.material_index = idx; n += 1
    me.update()
    return n

def add_fin_bolt(o, m, color=(246, 246, 244), name="FinBolt"):
    """White lightning decal on the fin, one flat plate on each side."""
    V = [v.co for v in o.data.vertices]
    fn_te, fn_le = m["fin_chord"]; fz0, fz1 = m["fin_z"]
    hinge = fn_te + 0.46 * (fn_le - fn_te)
    fin = [c for c in V if fn_te - 0.05 <= c.x <= fn_le + 0.05
           and fz0 - 0.05 <= c.z <= fz1 + 0.20 and abs(c.y) < 0.14 * m["halfspan"]]
    half_y = max((abs(c.y) for c in fin), default=0.06)

    # Keep the decal strictly inside the fin outline - it used to overshoot the
    # top of the fin and float above the tail.
    # fill the fin: fz0 is clipped by the measuring filter, so reach below it,
    # and stay ahead of the hinge so the rudder does not swing out from under it
    x0, x1 = hinge + 0.01, fn_le - 0.02
    z0, z1 = fz0 - 0.15, fz1 - 0.01
    w, h = (x1 - x0), (z1 - z0)
    # unit lightning bolt, nose of the plane is +X so the bolt leans forward
    UV = [(0.60, 1.00), (0.16, 0.46), (0.46, 0.46), (0.26, 0.00),
          (0.86, 0.58), (0.54, 0.58)]
    mt = mat(name + "_mat", rgb(color), 0.55, 0.0)
    made = []
    for sgn in (-1, 1):
        bm = bmesh.new()
        vs = [bm.verts.new((x0 + u * w, sgn * (half_y + 0.012), z0 + v * h)) for u, v in UV]
        try: bm.faces.new(vs if sgn > 0 else list(reversed(vs)))
        except Exception: pass
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        md = bpy.data.meshes.new("%s_%d" % (name, sgn))
        bm.to_mesh(md); bm.free()
        md.materials.append(mt)
        ob = bpy.data.objects.new(md.name, md)
        bpy.context.scene.collection.objects.link(ob)
        made.append(ob.name)
    return made
