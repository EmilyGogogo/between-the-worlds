"""Rainforest vegetation from Aholo Lux3D text-to-3D models: game meshes and far-view impostors.

Runs inside Blender, which bundles numpy:

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
        -P project/vegetation/build_vegetation.py -- \
        --src assets/lux3d/LUX3D-vegetation-rainforest/raw/v001 \
        --out frontend/public/models/vegetation [--only kapok]

`--src` holds the raw Lux3D GLBs named in MODELS (G1, photorealistic, about 30–45 k triangles
and one 2048 px colour texture each). Each becomes:

    <name>.glb             meshes sharing one material, `lod0` (nearest), `lod1`, `lod2`…
                           decimated from the raw model; the colour
                           texture is reduced to 1024 px, metal/roughness dropped
    <name>-impostor.webp   (trees) the raw model seen from 16 headings × 3 elevations
    <name>-impostor-n.webp the same views as normals in each view's camera space
    vegetation.json        sizes, crown shape, impostor layout and triangle counts

Coordinates in vegetation.json are the game's: metres of the raw model, +Y up, the base of the
trunk (or clump) at the origin. The game scales each model to the height it needs.
"""
import json
import math
import sys
import tempfile
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Vector

MODELS = {
    # name: raw file, triangle budget of each level (None keeps the raw mesh), impostor or not.
    # Budgets follow the draw ranges in env.forest lodRangesM: lod0 within ~12 m, lod2 to ~75 m.
    'kapok': dict(src='1-kapok.glb', lods=(26000, 10000, 2500), impostor=True,
                  prompt='一棵巨大的亚马逊吉贝木棉，灰白色笔直高大的树干，根部有明显的板状支撑根，顶部是宽阔扁平的伞状树冠，枝上挂着藤蔓和附生植物，单棵树，无地面'),
    'canopy': dict(src='2-canopy.glb', lods=(24000, 9000, 1800), impostor=True,
                   prompt='一棵热带雨林阔叶乔木，修长的深色树干，上部分叉，树冠层层叠叠、浓密，叶片清晰，单棵树，无地面'),
    # The same broadleaf with its bare trunk stretched below the crown: a rainforest canopy tree.
    'canopy_tall': dict(src='2-canopy.glb', stretch=2.6, lods=(24000, 9000, 1800), impostor=True,
                        prompt='（同 canopy，树冠以下的树干在 Blender 中拉长 2.6 倍）'),
    'acai': dict(src='3-acai.glb', lods=(26000, 8000, 1500), impostor=True,
                 prompt='一丛4株阿萨伊棕榈，细长弯曲的树干，顶部是下垂的羽状叶，单丛，无地面'),
    'understory': dict(src='4-understory.glb', lods=(6000, 2000), impostor=False,
                       prompt='一丛热带蕨类和大叶芋混生的灌丛，低矮茂密，无地面'),
}
HEADINGS, ELEVATIONS, FRAME = 16, (4.0, 32.0, 62.0), 256      # impostor views
TEXTURE = 1024

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
opt = {argv[i][2:]: argv[i + 1] for i in range(0, len(argv) - 1, 2)}
SRC, OUT = Path(opt['src']), Path(opt.get('out', 'frontend/public/models/vegetation'))
ONLY = set(opt['only'].split(',')) if 'only' in opt else None
OUT.mkdir(parents=True, exist_ok=True)
TMP = Path(tempfile.mkdtemp())


def to_game(v):
    """Blender (Z up) to game (Y up) coordinates."""
    return [round(float(v[0]), 4), round(float(v[2]), 4), round(float(-v[1]), 4)]


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.engine = 'BLENDER_EEVEE'
    s.render.film_transparent = True
    s.render.image_settings.file_format = 'OPEN_EXR'
    s.render.image_settings.color_depth = '32'
    s.render.filter_size = 1.2
    try:
        s.eevee.taa_render_samples = 16
    except AttributeError:
        pass
    return s


def vertices(obj):
    co = np.empty(len(obj.data.vertices) * 3, np.float32)
    obj.data.vertices.foreach_get('co', co)
    return co.reshape(-1, 3)


def import_model(path):
    bpy.ops.import_scene.gltf(filepath=str(path))
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # Base of the trunk (the middle of the lowest few centimetres) at the origin.
    co = vertices(obj)
    low = co[co[:, 2] < co[:, 2].min() + (np.ptp(co[:, 2]) * .02)]
    obj.data.transform(Matrix.Translation((-float(np.median(low[:, 0])), -float(np.median(low[:, 1])), -float(co[:, 2].min()))))
    obj.data.update()
    return obj


def crown_shape(co):
    """Height, crown radius and the height where the crown starts: above the narrowest part of
    the trunk (buttress roots are wide too), where the outline widens."""
    z, h = co[:, 2], float(co[:, 2].max())
    radius = float(np.percentile(np.hypot(co[:, 0], co[:, 1]), 99))
    bands = np.linspace(.02, .9, 45)
    width = [np.percentile(np.hypot(b[:, 0], b[:, 1]), 95) if len(b) else 0.0
             for b in (co[(z > h * q) & (z < h * (q + .03))] for q in bands)]
    neck = int(np.argmin([w if w > 0 else np.inf for w in width[:len(bands) * 2 // 3]]))
    base = next((h * q for q, w in zip(bands[neck:], width[neck:]) if w > radius * .45), 0.0)
    return h, radius, base


# --- Render passes: the material shows either its albedo or its camera-space normal as emission.
def prepare_passes(objs):
    switches = []
    for mat in {s.material for o in objs for s in o.material_slots if s.material}:
        nt = mat.node_tree
        out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
        bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        base = bsdf.inputs['Base Color'] if bsdf else None
        albedo = nt.nodes.new('ShaderNodeEmission')
        if base and base.links:
            nt.links.new(base.links[0].from_socket, albedo.inputs['Color'])
        elif base:
            albedo.inputs['Color'].default_value = base.default_value
        geo = nt.nodes.new('ShaderNodeNewGeometry')
        flip = nt.nodes.new('ShaderNodeVectorMath'); flip.operation = 'SCALE'
        sign = nt.nodes.new('ShaderNodeMath'); sign.operation = 'MULTIPLY_ADD'
        sign.inputs[1].default_value, sign.inputs[2].default_value = -2.0, 1.0   # backfacing → −1
        nt.links.new(geo.outputs['Backfacing'], sign.inputs[0])
        nt.links.new(geo.outputs['Normal'], flip.inputs[0])
        nt.links.new(sign.outputs[0], flip.inputs['Scale'])
        cam = nt.nodes.new('ShaderNodeVectorTransform')
        cam.vector_type, cam.convert_from, cam.convert_to = 'NORMAL', 'WORLD', 'CAMERA'
        nt.links.new(flip.outputs[0], cam.inputs[0])
        normal = nt.nodes.new('ShaderNodeEmission')
        nt.links.new(cam.outputs[0], normal.inputs['Color'])
        surface = out.inputs['Surface']
        original = surface.links[0].from_socket if surface.links else None
        switches.append((nt, surface, albedo, normal, original))

    def use(kind):
        for nt, surface, albedo, normal, original in switches:
            src = {'albedo': albedo.outputs[0], 'normal': normal.outputs[0], 'shaded': original}[kind]
            if src is not None:
                nt.links.new(src, surface)
    return use


def camera():
    s = bpy.context.scene
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    s.collection.objects.link(cam)
    cam.data.type = 'ORTHO'
    s.camera = cam
    return cam


def aim(cam, target, direction, half, depth):
    """Orthographic view of a cube of half-size `half` around target, seen from `direction`."""
    d = Vector(direction).normalized()
    dist = depth + 2
    cam.location = Vector(target) + d * dist
    forward = -d
    right = forward.cross(Vector((0, 0, 1))).normalized()
    true_up = right.cross(forward)
    cam.matrix_world = Matrix((
        (right.x, true_up.x, d.x, cam.location.x),
        (right.y, true_up.y, d.y, cam.location.y),
        (right.z, true_up.z, d.z, cam.location.z),
        (0, 0, 0, 1)))
    cam.data.ortho_scale = half * 2
    cam.data.clip_start, cam.data.clip_end = dist - depth, dist + depth


def render(res):
    s = bpy.context.scene
    s.render.resolution_x = s.render.resolution_y = res
    s.render.filepath = str(TMP / 'frame.exr')
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(str(TMP / 'frame.exr'), check_existing=False)
    px = np.array(img.pixels[:], np.float32).reshape(res, res, 4)
    bpy.data.images.remove(img)
    return px   # rows bottom-up, linear


def srgb(x):
    x = np.clip(x, 0, 1)
    return np.where(x <= .0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - .055)


def dilate(rgba, steps=12):
    """Spread colour into transparent pixels so mipmaps do not darken the edges."""
    rgb, a = rgba[..., :3].copy(), rgba[..., 3] > .02
    filled = a.copy()
    for _ in range(steps):
        acc = np.zeros_like(rgb); cnt = np.zeros(a.shape, np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            m = np.roll(filled, (dy, dx), (0, 1))
            acc += np.roll(rgb, (dy, dx), (0, 1)) * m[..., None]; cnt += m
        grow = ~filled & (cnt > 0)
        rgb[grow] = acc[grow] / cnt[grow][:, None]
        filled |= grow
    out = rgba.copy(); out[..., :3] = rgb
    return out


def save_webp(px, path, quality=88):
    """px: rows top-down, 0..1 display values."""
    h, w = px.shape[:2]
    img = bpy.data.images.new(path.stem, w, h, alpha=True)
    img.pixels.foreach_set(np.ascontiguousarray(px[::-1]).astype(np.float32).ravel())
    img.filepath_raw = str(path)
    img.file_format = 'WEBP'
    img.save(filepath=str(path), quality=quality)
    bpy.data.images.remove(img)


def pass_pair(use, res):
    use('albedo'); a = render(res)
    use('normal'); n = render(res)
    color = np.dstack([srgb(a[..., :3]), a[..., 3]])
    normal = np.dstack([np.clip(n[..., :3] * .5 + .5, 0, 1), a[..., 3]])
    return dilate(color)[::-1], dilate(normal)[::-1]   # top-down


def impostor(name, use, cam, co):
    """HEADINGS × ELEVATIONS views of the whole model into two atlases."""
    lo, hi = co.min(0), co.max(0)
    center = (lo + hi) / 2
    half = float(np.linalg.norm(co - center, axis=1).max()) * 1.02
    W, H = HEADINGS * FRAME, len(ELEVATIONS) * FRAME
    color, normal = np.zeros((H, W, 4), np.float32), np.zeros((H, W, 4), np.float32)
    for row, el in enumerate(ELEVATIONS):
        for col in range(HEADINGS):
            az = col / HEADINGS * 2 * math.pi
            e = math.radians(el)
            # Game direction toward the eye: (sin az cos el, sin el, cos az cos el) → Blender (x, −z, y).
            direction = (math.sin(az) * math.cos(e), -math.cos(az) * math.cos(e), math.sin(e))
            aim(cam, center, direction, half, half * 1.05)
            c, n = pass_pair(use, FRAME)
            color[row * FRAME:(row + 1) * FRAME, col * FRAME:(col + 1) * FRAME] = c
            normal[row * FRAME:(row + 1) * FRAME, col * FRAME:(col + 1) * FRAME] = n
    save_webp(color, OUT / f'{name}-impostor.webp')
    save_webp(normal, OUT / f'{name}-impostor-n.webp', 70)
    return {'center': to_game(center), 'half': round(half, 4), 'headings': HEADINGS,
            'elevations': list(ELEVATIONS), 'frame': FRAME,
            'color': f'{name}-impostor.webp', 'normal': f'{name}-impostor-n.webp'}


def decimate(obj, tris):
    have = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    if have > tris:
        m = obj.modifiers.new('dec', 'DECIMATE')
        m.ratio = tris / have
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier='dec')
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def game_material(obj):
    """Colour texture only (reduced), no metal: the raw metal map is empty and roughness reads
    as wet plastic under the game's sun. Both sides drawn, as thin leaves need."""
    mat = obj.active_material
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    for key in ('Metallic', 'Roughness'):
        for link in list(bsdf.inputs[key].links):
            nt.links.remove(link)
    bsdf.inputs['Metallic'].default_value = 0.0
    bsdf.inputs['Roughness'].default_value = .8
    for n in [n for n in nt.nodes if n.type == 'TEX_IMAGE' and not n.outputs['Color'].links]:
        nt.nodes.remove(n)
    for img in {n.image for n in nt.nodes if n.type == 'TEX_IMAGE' and n.image}:
        if img.size[0] > TEXTURE:
            img.scale(TEXTURE, TEXTURE)
    mat.use_backface_culling = False
    mat.name = 'aholo'


def export(objs, path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                              export_image_format='JPEG', export_image_quality=88,
                              export_apply=True, export_yup=True, export_materials='EXPORT',
                              export_normals=True, export_tangents=False, export_attributes=False)


def build(name, spec, meta):
    reset()
    obj = import_model(SRC / spec['src'])
    co = vertices(obj)
    h, radius, base = crown_shape(co)
    if spec.get('stretch'):
        # Below the crown everything is stretched upward; the crown keeps its shape.
        f = spec['stretch']
        co[:, 2] = np.where(co[:, 2] < base, co[:, 2] * f, co[:, 2] + base * (f - 1))
        obj.data.vertices.foreach_set('co', co.ravel()); obj.data.update()
        h, radius, base = crown_shape(co)
    info = {'source': f'Aholo Lux3D G1 text-to-3D ({spec["src"]})', 'prompt': spec['prompt'],
            'height': round(h, 3), 'crownRadius': round(radius, 3), 'crownBase': round(base, 3),
            'rawTriangles': sum(len(p.vertices) - 2 for p in obj.data.polygons)}
    if spec['impostor']:
        use = prepare_passes([obj])
        info['impostor'] = impostor(name, use, camera(), co)
        use('shaded')
    game_material(obj)
    levels = [obj]
    for _ in spec['lods'][1:]:
        far = obj.copy(); far.data = obj.data.copy(); bpy.context.scene.collection.objects.link(far)
        levels.append(far)
    info['triangles'] = []
    for i, (o, budget) in enumerate(zip(levels, spec['lods'])):
        o.name = o.data.name = f'lod{i}'
        if not budget:
            info['triangles'].append(sum(len(p.vertices) - 2 for p in o.data.polygons))
            continue
        info['triangles'].append(decimate(o, budget))
        # Decimated levels: smooth leaves, creased trunk edges.
        bpy.ops.object.select_all(action='DESELECT')
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        try:
            bpy.ops.object.shade_smooth_by_angle(angle=math.radians(50))
        except (AttributeError, RuntimeError):
            bpy.ops.object.shade_smooth()
    export(levels, OUT / f'{name}.glb')
    info['model'] = f'{name}.glb'
    meta['models'][name] = info
    print(f'[veg] {name}: {info["triangles"]} tris, h {info["height"]} m, crown r {info["crownRadius"]} from {info["crownBase"]}')


meta_path = OUT / 'vegetation.json'
meta = json.loads(meta_path.read_text()) if meta_path.exists() and ONLY else {}
meta.setdefault('models', {})
meta['generator'] = 'project/vegetation/build_vegetation.py'
for name, spec in MODELS.items():
    if (ONLY is None or name in ONLY) and (SRC / spec['src']).exists():
        build(name, spec, meta)
meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n')
