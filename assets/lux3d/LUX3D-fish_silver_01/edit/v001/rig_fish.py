"""Clean up, rig and animate a Lux3D fish.

blender -b -P rig_fish.py -- raw.glb out_dir NAME TARGET_TRIS TARGET_HEIGHT
Writes out_dir/NAME.glb, NAME.blend and report.json.
Blender space is Z-up; glTF export converts to +Y up. Fish forward = Blender +Y = glTF -Z.
"""
import bpy, sys, os, json, math
import numpy as np
from mathutils import Vector, Matrix, Quaternion

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT, NAME = argv[0], argv[1], argv[2]
TARGET_TRIS, TARGET_HEIGHT = int(argv[3]), float(argv[4])
FPS = 24
os.makedirs(OUT, exist_ok=True)
report = {'source': os.path.basename(SRC), 'name': NAME}

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps = FPS
bpy.ops.import_scene.gltf(filepath=SRC)
mesh_obj = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
mesh_obj.name = 'fish'
for o in list(bpy.context.scene.objects):
    if o is not mesh_obj and o.type == 'EMPTY' and not o.children:
        bpy.data.objects.remove(o)
mesh_obj.parent = None
bpy.context.view_layer.objects.active = mesh_obj; mesh_obj.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

def verts(obj):
    co = np.empty(len(obj.data.vertices) * 3); obj.data.vertices.foreach_get('co', co); return co.reshape(-1, 3)
def tri_count(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)

report['raw_tris'] = tri_count(mesh_obj)
v = verts(mesh_obj); report['raw_bounds'] = [v.min(0).round(4).tolist(), v.max(0).round(4).tolist()]

# 1. Length axis = widest horizontal spread; turn it onto Y.
xy = v[:, :2] - v[:, :2].mean(0)
_, _, vt = np.linalg.svd(xy, full_matrices=False)
ang = math.atan2(vt[0][1], vt[0][0])
mesh_obj.data.transform(Matrix.Rotation(math.pi / 2 - ang, 4, 'Z')); mesh_obj.data.update()
# 2. Head forward: the tail end is laterally thinner (a fin) than the head end.
v = verts(mesh_obj); y0, y1 = v[:, 1].min(), v[:, 1].max(); L = y1 - y0
def thickness(lo, hi):
    sel = v[(v[:, 1] >= lo) & (v[:, 1] <= hi)]
    return float(np.percentile(sel[:, 0], 95) - np.percentile(sel[:, 0], 5)) if len(sel) > 10 else 0.0
t_pos, t_neg = thickness(y1 - 0.15 * L, y1 - 0.03 * L), thickness(y0 + 0.03 * L, y0 + 0.15 * L)
flip = t_pos < t_neg
if flip:
    mesh_obj.data.transform(Matrix.Rotation(math.pi, 4, 'Z')); mesh_obj.data.update()
report['yaw_corrected_deg'] = round(math.degrees(math.pi / 2 - ang) + (180 if flip else 0), 2)
report['end_thickness'] = {'plusY': round(t_pos, 4), 'minusY': round(t_neg, 4)}

# 3. Decimate to budget.
mod = mesh_obj.modifiers.new('decimate', 'DECIMATE'); mod.ratio = min(1.0, TARGET_TRIS / report['raw_tris']); mod.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier=mod.name)
report['tris'] = tri_count(mesh_obj)

# 4. Scale to body height, origin at bottom centre.
v = verts(mesh_obj); lo, hi = v.min(0), v.max(0)
mesh_obj.data.transform(Matrix.Scale(TARGET_HEIGHT / (hi[2] - lo[2]), 4))
v = verts(mesh_obj); lo, hi = v.min(0), v.max(0)
mesh_obj.data.transform(Matrix.Translation(Vector((-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2])))); mesh_obj.data.update()
v = verts(mesh_obj); lo, hi = v.min(0), v.max(0)
report['size_m'] = {'width_x': round(hi[0] - lo[0], 3), 'length_y': round(hi[1] - lo[1], 3), 'height_z': round(hi[2] - lo[2], 3)}

# 5. Spine chain head -> tail along the body's mid-height line.
y0, y1 = float(lo[1]), float(hi[1]); L = y1 - y0
def mid_z(y):
    sel = v[np.abs(v[:, 1] - y) < 0.04 * L]
    return float((np.percentile(sel[:, 2], 10) + np.percentile(sel[:, 2], 90)) / 2) if len(sel) > 5 else float((lo[2] + hi[2]) / 2)
cuts = [y1 - 0.02 * L, y1 - 0.38 * L, y1 - 0.58 * L, y1 - 0.76 * L, y0 + 0.01 * L]
names = ['head', 'spine1', 'spine2', 'tail']
arm_data = bpy.data.armatures.new('fish_rig'); arm = bpy.data.objects.new('fish_rig', arm_data)
bpy.context.scene.collection.objects.link(arm); bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
prev = None
for i, n in enumerate(names):
    b = arm_data.edit_bones.new(n)
    b.head = Vector((0, cuts[i], mid_z(cuts[i]))); b.tail = Vector((0, cuts[i + 1], mid_z(cuts[i + 1])))
    b.align_roll(Vector((0, 0, 1)))
    if prev: b.parent = prev; b.use_connect = True
    prev = b
bpy.ops.object.mode_set(mode='OBJECT')
report['bones'] = {b.name: [[round(c, 3) for c in b.head_local], [round(c, 3) for c in b.tail_local]] for b in arm_data.bones}

# 6. Weights blend smoothly across each joint along the body.
def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)
y = v[:, 1]; bl = 0.06 * L
# membership: head = in front of cut1, spine1 = between cut1 and cut2, ...
s1, s2, s3 = (smooth(cuts[k] - bl, cuts[k] + bl, y) for k in (1, 2, 3))      # 1 = in front of cut k
weights = {'head': s1, 'spine1': s2 * (1 - s1), 'spine2': s3 * (1 - s2), 'tail': 1 - s3}
total = sum(weights.values()); total[total == 0] = 1
for n, wt in weights.items():
    g = mesh_obj.vertex_groups.new(name=n); wt = wt / total
    for i in np.nonzero(wt > 0.002)[0]:
        g.add([int(i)], float(wt[i]), 'REPLACE')
mesh_obj.parent = arm
am = mesh_obj.modifiers.new('armature', 'ARMATURE'); am.object = arm

# 7. Swimming: a travelling side-to-side wave, small at the head, largest at the tail.
UP = Vector((0, 0, 1))
def wave(action_name, frames, amp_scale):
    act = bpy.data.actions.new(action_name); act.use_fake_user = True
    arm.animation_data_create(); arm.animation_data.action = act
    amps = {'head': 3, 'spine1': 5, 'spine2': 9, 'tail': 16}
    for pb in arm.pose.bones: pb.rotation_mode = 'QUATERNION'
    for f in range(0, frames + 1, 2):
        phase = 2 * math.pi * f / frames
        for k, pb in enumerate(arm.pose.bones):
            a = (pb.bone.matrix_local.to_3x3().inverted() @ UP).normalized()
            deg = amps[pb.name] * amp_scale * math.sin(phase - k * 1.0)
            pb.rotation_quaternion = Quaternion(a, math.radians(deg))
            pb.keyframe_insert('rotation_quaternion', frame=f + 1)
    for fc in act.fcurves: fc.modifiers.new('CYCLES')
    track = arm.animation_data.nla_tracks.new(); track.name = action_name
    track.strips.new(action_name, 1, act); arm.animation_data.action = None
    return act
wave('Swim', 40, 0.55)       # idle: 1.67 s, gentle
wave('SwimFast', 16, 1.0)    # move: 0.67 s, full sweep
report['animations'] = {'Swim': {'frames': 40, 'seconds': round(40 / FPS, 3)}, 'SwimFast': {'frames': 16, 'seconds': round(16 / FPS, 3)}}

bpy.context.scene.frame_start, bpy.context.scene.frame_end = 1, 41
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, NAME + '.blend'), compress=True)
bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True); mesh_obj.select_set(True)
glb = os.path.join(OUT, NAME + '.glb')
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_yup=True, export_apply=False,
                          export_skins=True, export_animations=True, export_animation_mode='NLA_TRACKS',
                          export_image_format='JPEG', export_jpeg_quality=88, export_draco_mesh_compression_enable=False)
report['glb_bytes'] = os.path.getsize(glb)
json.dump(report, open(os.path.join(OUT, 'report.json'), 'w'), indent=1)
print('REPORT', json.dumps(report))
