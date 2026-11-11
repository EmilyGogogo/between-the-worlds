"""Render rest pose and animation frames from a rigged .blend. blender -b file.blend -P render_anim.py -- outdir"""
import bpy, sys, os, math
from mathutils import Vector

out = sys.argv[sys.argv.index('--') + 1]
os.makedirs(out, exist_ok=True)
scene = bpy.context.scene
arm = bpy.data.objects['gull_rig']; mesh = bpy.data.objects['gull']
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x, scene.render.resolution_y = 480, 360
scene.world = bpy.data.worlds.new('w'); scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (0.82, 0.86, 0.9, 1)
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); scene.collection.objects.link(sun)
sun.rotation_euler = (math.radians(35), math.radians(15), math.radians(40)); sun.data.energy = 3.5
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scene.collection.objects.link(cam); scene.camera = cam
center = Vector((0, 0, 0.3))
views = {'side': Vector((1, 0, 0.05)), 'front': Vector((0, 1, 0.12)), 'threeq': Vector((1.0, 0.9, 0.7))}

def shoot(tag):
    for name, d in views.items():
        cam.location = center + d.normalized() * 5.2
        cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = os.path.join(out, f'{tag}_{name}.png')
        bpy.ops.render.render(write_still=True)

for t in arm.animation_data.nla_tracks: t.mute = True
arm.animation_data.action = None
for pb in arm.pose.bones: pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
scene.frame_set(1); shoot('rest')
for act_name, frames in (('Flap', (1, 5, 9, 13)), ('Glide', (1, 25))):
    arm.animation_data.action = bpy.data.actions[act_name]
    for f in frames:
        scene.frame_set(f); shoot(f'{act_name}{f:02d}')
