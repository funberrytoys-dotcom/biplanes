import bpy, os, math, json
from mathutils import Vector

OUT = os.path.join(os.environ.get("BIPLANES_3D_BASE", r"C:\Users\serge\Documents\Playground\Biplanes\.3dwork"), "shots")
os.makedirs(OUT, exist_ok=True)

def wipe():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for blk in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras,
                bpy.data.armatures, bpy.data.images, bpy.data.actions, bpy.data.node_groups):
        for b in list(blk):
            if getattr(b, "users", 0) == 0:
                try: blk.remove(b)
                except Exception: pass

def load(src):
    ext = os.path.splitext(src)[1].lower()
    if ext in (".glb", ".gltf"): bpy.ops.import_scene.gltf(filepath=src)
    elif ext == ".fbx":          bpy.ops.import_scene.fbx(filepath=src)
    elif ext == ".obj":          bpy.ops.wm.obj_import(filepath=src)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    for o in bpy.context.scene.objects: o.select_set(False)
    for o in meshes: o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1: bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.rotation_mode = 'XYZ'
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return obj

def bounds(obj):
    bb = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    mn = Vector((min(p.x for p in bb), min(p.y for p in bb), min(p.z for p in bb)))
    mx = Vector((max(p.x for p in bb), max(p.y for p in bb), max(p.z for p in bb)))
    return mn, mx, (mx - mn), (mx + mn) / 2

def normalize(obj, target=4.0):
    mn, mx, dim, ctr = bounds(obj)
    obj.location -= ctr
    bpy.context.view_layer.update()
    bpy.ops.object.transform_apply(location=True)
    s = target / max(dim)
    obj.scale = (s, s, s)
    bpy.ops.object.transform_apply(scale=True)
    return bounds(obj)

def setup_render(engine="WORK", res=(1000, 750)):
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'Standard'
    if engine == "WORK":
        sc.render.engine = 'BLENDER_WORKBENCH'
        sh = sc.display.shading
        sh.light = 'STUDIO'; sh.studio_light = 'Default'
        sh.color_type = 'SINGLE'; sh.single_color = (0.62, 0.63, 0.66)
        sh.show_cavity = True; sh.cavity_type = 'BOTH'
        sh.curvature_ridge_factor = 1.6; sh.curvature_valley_factor = 1.6
        sh.cavity_ridge_factor = 1.4; sh.cavity_valley_factor = 1.4
        sh.show_object_outline = True; sh.object_outline_color = (0.05, 0.05, 0.07)
        sh.show_specular_highlight = True
        sc.display.render_aa = '16'
        w = bpy.data.worlds.get("W") or bpy.data.worlds.new("W")
        sc.world = w; w.use_nodes = True
        w.node_tree.nodes["Background"].inputs[0].default_value = (0.11, 0.13, 0.17, 1)
    else:
        try: sc.render.engine = 'BLENDER_EEVEE_NEXT'
        except Exception: sc.render.engine = 'BLENDER_EEVEE'
        w = bpy.data.worlds.get("W") or bpy.data.worlds.new("W")
        sc.world = w; w.use_nodes = True
        w.node_tree.nodes["Background"].inputs[0].default_value = (0.35, 0.40, 0.48, 1)
        w.node_tree.nodes["Background"].inputs[1].default_value = 0.55
        for nm, rot, en in [("K", (math.radians(55), 0, math.radians(35)), 3.0),
                            ("F", (math.radians(70), 0, math.radians(-140)), 1.0)]:
            if nm in bpy.data.objects: continue
            ld = bpy.data.lights.new(nm, 'SUN'); ld.energy = en; ld.angle = math.radians(12)
            lo = bpy.data.objects.new(nm, ld); bpy.context.scene.collection.objects.link(lo)
            lo.rotation_euler = rot
        try: sc.eevee.taa_render_samples = 48
        except Exception: pass

def make_cam(target=(0, 0, 0)):
    sc = bpy.context.scene
    tgt = bpy.data.objects.get("TGT")
    if tgt is None:
        tgt = bpy.data.objects.new("TGT", None); sc.collection.objects.link(tgt)
    tgt.location = target
    cam = bpy.data.objects.get("Cam")
    if cam is None:
        cd = bpy.data.cameras.new("Cam"); cam = bpy.data.objects.new("Cam", cd)
        sc.collection.objects.link(cam)
        c = cam.constraints.new('TRACK_TO'); c.target = tgt
        c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
    sc.camera = cam
    return cam, tgt

VIEWS = {
    "nose":  (-1, 0, 0), "tail": (1, 0, 0),
    "left":  (0, -1, 0), "right": (0, 1, 0),
    "top":   (0, 0, 1),  "bottom": (0, 0, -1),
    "q34":   (-0.9, -1, 0.5), "q34r": (0.9, -1, 0.5), "qlow": (-0.7, -1, -0.35),
}

def shoot(tag, views=None, ortho=None, target=(0, 0, 0), dist=12.0, persp=False):
    sc = bpy.context.scene
    cam, tgt = make_cam(target)
    cam.data.type = 'PERSP' if persp else 'ORTHO'
    if persp: cam.data.lens = 60
    else: cam.data.ortho_scale = ortho or 4.6
    out = []
    for nm in (views or VIEWS.keys()):
        d = Vector(VIEWS[nm]).normalized()
        cam.location = Vector(target) + d * dist
        p = os.path.join(OUT, f"{tag}_{nm}.png")
        sc.render.filepath = p
        bpy.ops.render.render(write_still=True)
        out.append(p)
    return out
