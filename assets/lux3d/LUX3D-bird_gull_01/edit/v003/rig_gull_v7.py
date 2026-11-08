"""Clean up, rig and animate the Lux3D gull.

blender -b -P rig_gull.py -- raw.glb out_dir
Writes out_dir/bird_gull_01-v001.glb, out_dir/bird_gull_01-v001.blend and out_dir/report.json.
Blender space is Z-up; glTF export converts to +Y up. Bird forward = Blender +Y = glTF -Z.
"""
import bpy, bmesh, sys, os, json, math
import numpy as np
from mathutils import Vector, Matrix, Quaternion

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = argv[0], argv[1]
NAME = argv[2] if len(argv) > 2 else 'bird_gull_01-v001'
os.makedirs(OUT, exist_ok=True)
TARGET_TRIS = int(argv[3]) if len(argv) > 3 else 24000
TARGET_HEIGHT = 0.65          # entities.json body.height / asset.height for bird_gull_01
FPS = 24
report = {'source': os.path.basename(SRC)}

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps = FPS
bpy.ops.import_scene.gltf(filepath=SRC)
mesh_obj = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
mesh_obj.name = 'gull'
for o in list(bpy.context.scene.objects):
    if o is not mesh_obj and o.type == 'EMPTY' and not o.children:
        bpy.data.objects.remove(o)
mesh_obj.parent = None
bpy.context.view_layer.objects.active = mesh_obj
mesh_obj.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

def verts(obj):
    n = len(obj.data.vertices)
    co = np.empty(n * 3); obj.data.vertices.foreach_get('co', co)
    return co.reshape(-1, 3)

def tri_count(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)

report['raw_tris'] = tri_count(mesh_obj)
report['raw_bounds'] = [verts(mesh_obj).min(0).round(4).tolist(), verts(mesh_obj).max(0).round(4).tolist()]

# 1. Face forward. The wingspan is the widest horizontal spread: turn it onto X, then put the
#    narrow head end (not the wide tail fan) at +Y, which the glTF exporter writes as -Z.
v = verts(mesh_obj)
xy = v[:, :2] - v[:, :2].mean(0)
_, _, vt = np.linalg.svd(xy, full_matrices=False)
span_angle = math.atan2(vt[0][1], vt[0][0])
mesh_obj.data.transform(Matrix.Rotation(-span_angle, 4, 'Z'))
mesh_obj.data.update()
v = verts(mesh_obj)
y0, y1 = v[:, 1].min(), v[:, 1].max(); L = y1 - y0
def width_at(lo, hi):
    sel = v[(v[:, 1] >= lo) & (v[:, 1] <= hi)]
    return sel[:, 0].max() - sel[:, 0].min() if len(sel) > 10 else 0
w_pos, w_neg = width_at(y1 - 0.12 * L, y1), width_at(y0, y0 + 0.12 * L)
flip = w_pos > w_neg                    # the wide end is the tail: it must end up at -Y
if flip:
    mesh_obj.data.transform(Matrix.Rotation(math.pi, 4, 'Z'))
    mesh_obj.data.update()
report['yaw_corrected_deg'] = round(math.degrees(-span_angle) + (180 if flip else 0), 2)
report['end_widths'] = {'plusY': round(float(w_pos), 4), 'minusY': round(float(w_neg), 4)}

# 2. Level the body: principal axis of the central strip (wings and dangling legs excluded).
v = verts(mesh_obj)
strip = v[np.abs(v[:, 0]) < 0.05 * (v[:, 0].max() - v[:, 0].min())]
strip = strip[strip[:, 2] > np.percentile(strip[:, 2], 15)]
yz = strip[:, 1:] - strip[:, 1:].mean(0)
_, _, vt = np.linalg.svd(yz, full_matrices=False)
axis = vt[0] if vt[0][0] > 0 else -vt[0]
pitch = math.atan2(axis[1], axis[0])           # nose-down is negative
mesh_obj.data.transform(Matrix.Rotation(-pitch, 4, 'X'))
mesh_obj.data.update()
report['pitch_corrected_deg'] = round(math.degrees(-pitch), 2)

# 3. Decimate to the L1 animal budget.
ratio = TARGET_TRIS / report['raw_tris']
mod = mesh_obj.modifiers.new('decimate', 'DECIMATE'); mod.ratio = ratio; mod.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier=mod.name)
report['tris'] = tri_count(mesh_obj)

# 4. Scale to body height and put the origin at the bottom centre.
v = verts(mesh_obj); lo, hi = v.min(0), v.max(0)
s = TARGET_HEIGHT / (hi[2] - lo[2])
mesh_obj.data.transform(Matrix.Scale(s, 4))
v = verts(mesh_obj); lo, hi = v.min(0), v.max(0)
mesh_obj.data.transform(Matrix.Translation(Vector((-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]))))
mesh_obj.data.update()
v = verts(mesh_obj); lo, hi = v.min(0), v.max(0)
report['size_m'] = {'span_x': round(hi[0] - lo[0], 3), 'length_y': round(hi[1] - lo[1], 3), 'height_z': round(hi[2] - lo[2], 3)}

# 5. Landmarks measured from the mesh.
half = hi[0]
bins = np.linspace(0, half, 41)
ext = []
for a, b in zip(bins[:-1], bins[1:]):
    sel = v[(np.abs(v[:, 0]) >= a) & (np.abs(v[:, 0]) < b)]
    ext.append(sel[:, 2].max() - sel[:, 2].min() if len(sel) > 20 else 0)
ext = np.array(ext)
body_ext = ext[:3].mean()
sh_idx = next((i for i in range(3, len(ext)) if ext[i] < 0.55 * body_ext), 6)
shoulder_x = float(bins[sh_idx])
report['shoulder_x'] = round(shoulder_x, 3)

core = v[np.abs(v[:, 0]) < shoulder_x * 0.6]
core_hi = core[core[:, 2] > np.percentile(core[:, 2], 20)]
y_tail, y_beak = float(core[:, 1].min()), float(core[:, 1].max())
L = y_beak - y_tail
def z_at(y, pts=core_hi, w=0.04):
    sel = pts[np.abs(pts[:, 1] - y) < w * L]
    return float(np.median(sel[:, 2])) if len(sel) else float(np.median(pts[:, 2]))
y_tailbase, y_chest, y_neck = y_tail + 0.30 * L, y_tail + 0.62 * L, y_tail + 0.74 * L
P = {
    'tail_tip': Vector((0, y_tail, z_at(y_tail + 0.03 * L))),
    'tail_base': Vector((0, y_tailbase, z_at(y_tailbase))),
    'chest': Vector((0, y_chest, z_at(y_chest))),
    'neck': Vector((0, y_neck, z_at(y_neck))),
    'beak': Vector((0, y_beak, z_at(y_beak - 0.02 * L))),
}

def wing_point(xa, side):
    sel = v[(np.abs(v[:, 0] - side * xa) < 0.03 * half)]
    if len(sel) < 5:
        sel = v[np.abs(np.abs(v[:, 0]) - xa) < 0.06 * half]
    return Vector((side * xa, float(np.percentile(sel[:, 1], 70)), float(np.median(sel[:, 2]))))

wing_len = half - shoulder_x
joints_x = [shoulder_x, shoulder_x + 0.36 * wing_len, shoulder_x + 0.64 * wing_len, half * 0.985]

# 6. Armature.
arm_data = bpy.data.armatures.new('gull_rig')
arm = bpy.data.objects.new('gull_rig', arm_data)
bpy.context.scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
eb = arm_data.edit_bones
def bone(name, head, tail, parent=None, roll_up=Vector((0, 0, 1))):
    b = eb.new(name); b.head, b.tail = head, tail
    b.align_roll(roll_up)
    if parent: b.parent = eb[parent]; b.use_connect = (parent and (eb[parent].tail - head).length < 1e-4)
    return b
bone('body', P['tail_base'], P['chest'])
bone('neck', P['chest'], P['neck'], 'body')
bone('head', P['neck'], P['beak'], 'neck')
bone('tail', P['tail_base'], P['tail_tip'], 'body')
for side, suf in ((1, 'R'), (-1, 'L')):
    pts = [wing_point(x, side) for x in joints_x]
    pts[0] = Vector((side * shoulder_x * 0.6, pts[0].y, pts[0].z))
    bone(f'wing1.{suf}', pts[0], pts[1], 'body')
    bone(f'wing2.{suf}', pts[1], pts[2], f'wing1.{suf}')
    bone(f'wing3.{suf}', pts[2], pts[3], f'wing2.{suf}')
bpy.ops.object.mode_set(mode='OBJECT')
report['bones'] = {b.name: [list(map(lambda c: round(c, 3), b.head_local)), list(map(lambda c: round(c, 3), b.tail_local))] for b in arm_data.bones}

# 7. Skin weights computed from position (robust on generated meshes where bone heat often fails).
def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)
ax, y = np.abs(v[:, 0]), v[:, 1]
wing_t = smooth(shoulder_x * 0.55, shoulder_x * 1.05, ax)            # 0 body .. 1 wing; turns from the body edge
blend = 0.16 * wing_len                                              # wide joints: bends spread into a curve
j1, j2 = joints_x[1], joints_x[2]
w_seg1 = 1 - smooth(j1 - blend, j1 + blend, ax)
w_seg3 = smooth(j2 - blend, j2 + blend, ax)
w_seg2 = 1 - w_seg1 - w_seg3
bl = 0.05 * L
w_tail = 1 - smooth(y_tailbase - bl, y_tailbase + bl, y)
w_head = smooth(y_neck - bl, y_neck + bl, y)
w_neck = smooth(y_chest - bl, y_chest + bl, y) * (1 - w_head)
w_body = np.clip(1 - w_tail - w_head - w_neck, 0, 1)
weights = {
    'body': (1 - wing_t) * w_body, 'tail': (1 - wing_t) * w_tail, 'neck': (1 - wing_t) * w_neck, 'head': (1 - wing_t) * w_head,
}
right = v[:, 0] > 0
for suf, mask in (('R', right), ('L', ~right)):
    m = mask.astype(float)
    weights[f'wing1.{suf}'] = wing_t * w_seg1 * m
    weights[f'wing2.{suf}'] = wing_t * w_seg2 * m
    weights[f'wing3.{suf}'] = wing_t * w_seg3 * m
total = sum(weights.values()); total[total == 0] = 1
for name, w in weights.items():
    g = mesh_obj.vertex_groups.new(name=name)
    w = w / total
    for i in np.nonzero(w > 0.002)[0]:
        g.add([int(i)], float(w[i]), 'REPLACE')
mesh_obj.parent = arm
am = mesh_obj.modifiers.new('armature', 'ARMATURE'); am.object = arm

# 7b. Re-pose: some generations hold the wings high (mid-flap). Lower each wing at the shoulder
#     to a gentle dihedral and make that the rest pose, so the glide is level and the runtime
#     height fit measures the bird, not its raised wings.
TARGET_DIHEDRAL = float(argv[4]) if len(argv) > 4 else None
if TARGET_DIHEDRAL is not None:
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='POSE')
    lowered = {}
    for suf, sgn in (('R', -1), ('L', 1)):
        b1, b3 = arm.data.bones[f'wing1.{suf}'], arm.data.bones[f'wing3.{suf}']
        root, tip = b1.head_local, b3.tail_local
        elev = math.degrees(math.atan2(tip.z - root.z, abs(tip.x - root.x)))
        down = elev - TARGET_DIHEDRAL
        pb = arm.pose.bones[f'wing1.{suf}']; pb.rotation_mode = 'QUATERNION'
        axis = (pb.bone.matrix_local.to_3x3().inverted() @ Vector((0, 1, 0))).normalized()
        pb.rotation_quaternion = Quaternion(axis, math.radians(-sgn * down))
        lowered[suf] = {'wing_elevation_deg': round(elev, 2), 'lowered_deg': round(down, 2)}
    bpy.context.view_layer.update()
    # Bake the posed mesh, then make the current pose the new rest pose.
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.context.view_layer.objects.active = mesh_obj
    bpy.ops.object.modifier_apply(modifier=am.name)
    bpy.ops.object.shade_smooth()   # normals only: vertices stay put, so layered feathers never cross
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='POSE'); bpy.ops.pose.select_all(action='SELECT'); bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    am = mesh_obj.modifiers.new('armature', 'ARMATURE'); am.object = arm
    report['repose'] = lowered
    v = verts(mesh_obj); lo, hi = v.min(0), v.max(0)
    report['size_after_repose_m'] = {'span_x': round(hi[0] - lo[0], 3), 'length_y': round(hi[1] - lo[1], 3), 'height_z': round(hi[2] - lo[2], 3)}

# 8. Animations. Rotations are given about armature-space axes, converted into each bone's rest frame.
FWD, UP = Vector((0, 1, 0)), Vector((0, 0, 1))
def rot(pb, axis, deg):
    a = (pb.bone.matrix_local.to_3x3().inverted() @ axis).normalized()
    return Quaternion(a, math.radians(deg))
def key(action_name, frames, length):
    act = bpy.data.actions.new(action_name); act.use_fake_user = True
    arm.animation_data_create(); arm.animation_data.action = act
    for pb in arm.pose.bones: pb.rotation_mode = 'QUATERNION'
    for f, pose in frames:
        for pb in arm.pose.bones:
            pb.rotation_quaternion = Quaternion(); pb.location = Vector()
        for name, q in pose.items():
            if name == 'body_loc': arm.pose.bones['body'].location = q; continue
            arm.pose.bones[name].rotation_quaternion = q
        for pb in arm.pose.bones:
            pb.keyframe_insert('rotation_quaternion', frame=f)
            pb.keyframe_insert('location', frame=f)
    track = arm.animation_data.nla_tracks.new(); track.name = action_name
    track.strips.new(action_name, 1, act)
    arm.animation_data.action = None
    return act

def wings(up1, up2, up3, sweep=0.0):
    pose = {}
    for suf, sgn in (('R', -1), ('L', 1)):        # positive "up" lifts the wing on both sides
        pb = lambda n: arm.pose.bones[f'{n}.{suf}']
        q1 = rot(pb('wing1'), FWD, sgn * up1)
        if sweep: q1 = rot(pb('wing1'), UP, -sgn * sweep) @ q1
        pose[f'wing1.{suf}'] = q1
        pose[f'wing2.{suf}'] = rot(pb('wing2'), FWD, sgn * up2)
        pose[f'wing3.{suf}'] = rot(pb('wing3'), FWD, sgn * up3)
    return pose

def with_extra(pose, **extra):
    pose = dict(pose); pose.update(extra); return pose

B = arm.pose.bones
def lift(dz):
    """Pose-space location that moves the body bone dz metres straight up."""
    return B['body'].bone.matrix_local.to_3x3().inverted() @ Vector((0, 0, dz))
flap_len = 16
flap = []
for f in range(0, flap_len + 1, 2):
    ph = 2 * math.pi * f / flap_len
    # Shoulder leads; the forearm and hand follow a little later and only a little more,
    # so the wing makes one soft wave instead of folding at a joint.
    flap.append((f + 1, with_extra(wings(8 + 30 * math.cos(ph), 9 * math.cos(ph - 0.9), 12 * math.cos(ph - 1.7), sweep=-3 * math.cos(ph)),
                                   tail=rot(B['tail'], Vector((1, 0, 0)), 4 * math.cos(ph)), body_loc=lift(-0.012 * math.cos(ph)))))
glide = []
for f in range(0, 49, 4):
    ph = 2 * math.pi * f / 48
    glide.append((f + 1, with_extra(wings(2 + 2.5 * math.cos(ph), 1.5 * math.cos(ph - 0.8), 2 * math.cos(ph - 1.5)),
                                    tail=rot(B['tail'], UP, 3 * math.sin(ph)), head=rot(B['head'], UP, -2 * math.sin(ph)))))
act_flap = key('Flap', flap, flap_len)
act_glide = key('Glide', glide, 48)
for act in (act_flap, act_glide):
    for fc in act.fcurves:
        fc.modifiers.new('CYCLES')
report['animations'] = {'Flap': {'frames': flap_len, 'seconds': round(flap_len / FPS, 3)}, 'Glide': {'frames': 48, 'seconds': 2.0}}

bpy.context.scene.frame_start, bpy.context.scene.frame_end = 1, 49
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, NAME + '.blend'))

# 9. Export GLB (no Draco/Meshopt/KTX2, textures embedded as JPEG).
bpy.ops.object.select_all(action='DESELECT')
arm.select_set(True); mesh_obj.select_set(True)
glb = os.path.join(OUT, NAME + '.glb')
bpy.ops.export_scene.gltf(
    filepath=glb, export_format='GLB', use_selection=True, export_yup=True, export_apply=False,
    export_skins=True, export_animations=True, export_animation_mode='NLA_TRACKS',
    export_image_format='JPEG', export_jpeg_quality=88, export_draco_mesh_compression_enable=False,
)
report['glb_bytes'] = os.path.getsize(glb)
json.dump(report, open(os.path.join(OUT, 'report.json'), 'w'), indent=1)
print('REPORT', json.dumps(report))
