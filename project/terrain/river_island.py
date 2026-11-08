"""Procedural Amazon river island (main island terrain, env.world).

Runs inside Blender, which bundles numpy:

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
        -P project/terrain/river_island.py -- --out frontend/public/terrain

With a live Blender (MCP for Blender), exec() this file to also get a preview mesh.
Outputs, all in island-local game coordinates (metres, +Y up, river level 0):

    island-height.bin  uint16 heights on a 1 m grid, row-major from (-HALF_X, -HALF_Z)
    island-ground.bin  uint8 RGBA ground layer weights on a 2 m grid: sand, wet mud, grass,
                       cracked mud; the remainder is forest leaf litter. Raw bytes rather than a
                       PNG, because browsers premultiply PNG alpha and lose the other weights
    island-terrain.json grid, size, height range and feature anchors, copied by hand
                       into data/entities.json (env.world.heightfield) and anchors.json

The island is a floodplain (várzea) island: a rounded upstream head on an older,
higher terrace, a cut bank on the north side, natural levees, an interior backswamp,
an oxbow lake with scroll-bar ridges inside its bend, creeks open to the river, and a
long downstream sand spit. Nothing is traced from an image.
"""
import json
import math
import sys
from pathlib import Path

import numpy as np

HALF_X, HALF_Z, CELL = 700, 450, 1.0          # heightfield extent and spacing
GROUND_CELL = 2.0                             # ground-weight map spacing
LENGTH, WIDTH = 1150.0, 665.0                 # island size at the waterline
HEAD_X, TAIL_X = -560.0, 590.0                # upstream head and spit tip
OXBOW = dict(center=(-142.0, 8.0), radius=104.0, half_width=27.0, start_deg=278.0, end_deg=84.0,
             floor=-2.8, surface=0.2)
SPAWN = (4.0, 14.0)                           # clearing next to the oxbow (human-first)
# Open ground for exploring (D-030): grass glades (x, z, radius x, radius z) and the backswamp
# ponds, wide enough to read as open water (x, z, radius x, radius z, floor).
GLADES = [(-420, -60, 70, 55), (-200, 205, 58, 44), (90, -90, 52, 38)]
PONDS = [(150, 48, 34, 20, -.7), (-330, 60, 55, 34, -1.8), (330, 10, 26, 14, -.45), (-10, -200, 58, 34, -2.2)]
SEED = 20261106

rng = np.random.default_rng(SEED)
xs = np.arange(-HALF_X, HALF_X + CELL / 2, CELL, dtype=np.float32)
zs = np.arange(-HALF_Z, HALF_Z + CELL / 2, CELL, dtype=np.float32)
X, Z = np.meshgrid(xs, zs)
NZ, NX = X.shape


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def value_noise(wavelength, x=X, z=Z, seed=0):
    """Smooth value noise in [-1, 1] at a given wavelength (metres)."""
    r = np.random.default_rng(SEED + seed)
    gx = int((2 * HALF_X + 4 * wavelength) / wavelength) + 3
    gz = int((2 * HALF_Z + 4 * wavelength) / wavelength) + 3
    grid = r.random((gz, gx), dtype=np.float32) * 2 - 1
    fx = (x + HALF_X + 2 * wavelength) / wavelength
    fz = (z + HALF_Z + 2 * wavelength) / wavelength
    i = np.clip(np.floor(fx).astype(np.int32), 0, gx - 2)
    j = np.clip(np.floor(fz).astype(np.int32), 0, gz - 2)
    u = smoothstep(0, 1, fx - i)
    v = smoothstep(0, 1, fz - j)
    a = grid[j, i] * (1 - u) + grid[j, i + 1] * u
    b = grid[j + 1, i] * (1 - u) + grid[j + 1, i + 1] * u
    return a * (1 - v) + b * v


def fbm(wavelength, octaves, x=X, z=Z, seed=0, gain=0.5):
    total, amp, norm = 0.0, 1.0, 0.0
    for o in range(octaves):
        total = total + amp * value_noise(wavelength / 2 ** o, x, z, seed + 17 * o)
        norm += amp
        amp *= gain
    return total / norm


def distance_field(mask, limit):
    """Approximate Euclidean distance (m) from each True cell to the nearest False cell, up to limit."""
    big = np.float32(limit)
    d = np.where(mask, big, 0).astype(np.float32)
    steps = [((0, 1), 1.0), ((1, 0), 1.0), ((1, 1), math.sqrt(2)), ((1, -1), math.sqrt(2))]
    for _ in range(int(limit / CELL) + 2):
        before = d
        for (dy, dx), cost in steps:
            for sy, sx in ((dy, dx), (-dy, -dx)):
                shifted = np.full_like(d, big)
                ys = slice(max(sy, 0), NZ + min(sy, 0)), slice(max(-sy, 0), NZ + min(-sy, 0))
                xs_ = slice(max(sx, 0), NX + min(sx, 0)), slice(max(-sx, 0), NX + min(-sx, 0))
                shifted[ys[0], xs_[0]] = d[ys[1], xs_[1]]
                d = np.minimum(d, shifted + cost * CELL)
        if np.array_equal(before, d):
            break
    return np.minimum(d, big)


def blur(a, radius):
    r = max(1, int(radius))
    for _ in range(3):
        k = 2 * r + 1
        c = np.cumsum(np.pad(a, ((r + 1, r), (0, 0)), mode='edge'), 0)
        a = (c[k:] - c[:-k]) / k
        c = np.cumsum(np.pad(a, ((0, 0), (r + 1, r)), mode='edge'), 1)
        a = (c[:, k:] - c[:, :-k]) / k
    return a.astype(np.float32)


# --- Outline: teardrop half-width along the flow axis, warped, with fractal shoreline.
warp_x = X + 40 * fbm(320, 3, seed=1)
warp_z = Z + 48 * fbm(280, 3, seed=2)
t_raw = (warp_x - HEAD_X) / (TAIL_X - HEAD_X)
t = np.clip(t_raw, 0, 1)
head = WIDTH / 2 * np.sqrt(np.clip(1 - ((t - .3) / .3) ** 2, 0, 1))
u = np.clip((t - .3) / .7, 0, 1)
tail = WIDTH / 2 * (1 - u ** 1.35) ** 1.75 * (1 + .25 * np.sin(u * math.pi))
half_width = np.where((t_raw < 0) | (t_raw > 1), -60.0, np.where(t < .3, head, tail))
center = 70 * smoothstep(.55, 1, t) ** 2 - 18 * (1 - smoothstep(0, .35, t))      # spit bends south
across = warp_z - center
signed = np.abs(across) - half_width                                               # >0 in the river
shore_warp_x = X + 18 * fbm(60, 2, seed=21)
shore_warp_z = Z + 18 * fbm(60, 2, seed=22)
signed = (signed + 30 * fbm(170, 2, seed=3) + 9 * fbm(48, 3, seed=4, x=shore_warp_x, z=shore_warp_z)
          + 2.6 * fbm(14, 3, seed=5, x=shore_warp_x, z=shore_warp_z) + .6 * fbm(4, 2, seed=23))
# Creek mouths notch the shore; a cove cuts the north bank where the old channel left.
def notch(px, pz, radius, depth):
    return depth * np.exp(-((X - px) ** 2 + (Z - pz) ** 2) / (2 * radius ** 2))
signed += notch(-300, -300, 26, 30) + notch(175, 205, 22, 26) + notch(330, -150, 18, 22)
land = (signed < 0) & (np.abs(X - (HEAD_X + TAIL_X) / 2) < LENGTH / 2 + 20)
inland = distance_field(land, 180)                                                 # metres from shore, on land
offshore = distance_field(~land, 260)                                              # metres from shore, in the river

# Cut bank on the outer (north) side of the head and body; deposition elsewhere.
north = smoothstep(20, 170, -across)
cutbank = np.clip(north * (1 - smoothstep(.45, .75, t)) * (0.75 + 0.35 * fbm(120, 2, seed=6)), 0, 1)
spit = smoothstep(.58, .82, t)
headness = 1 - smoothstep(.12, .45, t)

# --- Land elevation.
ramp = smoothstep(0, 4 + 46 * (1 - cutbank), inland) ** np.where(cutbank > .5, 1.0, 0.7)
levee_at = 6 + 22 * (1 - cutbank)
levee = (2.4 + 1.2 * cutbank) * np.exp(-((inland - levee_at) / (16 + 18 * (1 - cutbank))) ** 2)
interior = 1.25 + .5 * fbm(140, 3, seed=7) + 3.8 * headness * smoothstep(10, 90, inland)
h_land = (interior + levee) * ramp
# Sandy spit: low ridge-and-swale scroll bars parallel to its edges.
scroll = .32 * np.sin(inland / 13 * 2 * math.pi + 3 * fbm(80, 2, seed=8)) * smoothstep(4, 16, inland)
h_spit = (.35 + 1.15 * smoothstep(0, 38, inland) + scroll) * smoothstep(0, 3, inland)
h_land = h_land * (1 - spit) + h_spit * spit

# Oxbow lake: an abandoned meander bend, with scroll ridges on its inner point bar.
ox, oz = OXBOW['center']
r = np.hypot(X - ox, Z - oz)
ang = (np.degrees(np.arctan2(Z - oz, X - ox)) + 360) % 360
span = (OXBOW['end_deg'] - OXBOW['start_deg']) % 360
along = (ang - OXBOW['start_deg']) % 360
inside_arc = along <= span
edge = np.minimum(along, span - along)
width = OXBOW['half_width'] * (0.55 + 0.45 * smoothstep(0, 35, edge)) * (1 + .12 * fbm(40, 2, seed=9))
wobble = 4 * fbm(55, 2, seed=10)
lake_cross = np.abs(r + wobble - OXBOW['radius']) / np.maximum(width, 1)
lake = np.clip(1 - lake_cross ** 2, 0, 1) * inside_arc * smoothstep(0, 10, edge)
inner_bar = smoothstep(OXBOW['radius'] - OXBOW['half_width'] + 4, 18, r) * smoothstep(-5, 25, edge)
h_land = h_land + .3 * np.sin(r / 11 * 2 * math.pi) * inner_bar * (r < OXBOW['radius'] - OXBOW['half_width'])
h_land = h_land * (1 - lake ** .6) + (OXBOW['floor'] + .9 * lake_cross ** 2) * lake ** .6

# Creeks (igarapés): meandering channels from the backswamp to the shore, open to the river.
def creek(points, width_m, bed_in, bed_out, wander):
    out = np.zeros_like(X)
    bed = np.zeros_like(X)
    pts = np.array(points, np.float32)
    lengths = np.hypot(*(pts[1:] - pts[:-1]).T)
    total, acc = lengths.sum(), 0.0
    meander = wander * fbm(55, 3, seed=int(points[0][0]) & 255)
    for (x0, z0), (x1, z1), length in zip(pts[:-1], pts[1:], lengths):
        vx, vz = x1 - x0, z1 - z0
        s = np.clip(((X - x0) * vx + (Z - z0) * vz) / (length * length), 0, 1)
        nx_, nz_ = -vz / length, vx / length
        px = x0 + s * vx + nx_ * meander
        pz = z0 + s * vz + nz_ * meander
        dist = np.hypot(X - px, Z - pz)
        f = (acc + s * length) / total
        w = width_m * (0.6 + 0.4 * f)
        prof = np.clip(1 - (dist / w) ** 2, 0, 1)
        take = prof > out
        out = np.where(take, prof, out)
        bed = np.where(take, bed_in + (bed_out - bed_in) * f, bed)
        acc += length
    return out, bed

channels = [
    creek([(60, 70), (110, 110), (160, 160), (178, 222)], 7, -.25, -1.2, 16),         # backswamp -> south cove
    creek([(150, -40), (230, -80), (300, -120), (338, -160)], 6, -.2, -1.1, 14),      # -> north notch
    creek([(-250, -150), (-280, -230), (-300, -300)], 6, .1, -1.0, 12),               # head gully -> north cove
    creek([(240, 40), (330, 60), (420, 55), (470, 40)], 5, .05, -.8, 6),              # swale along the spit root
]
for prof, bed in channels:
    carve = prof ** .7 * smoothstep(0, 6, inland + 8)
    h_land = h_land * (1 - carve) + np.minimum(h_land, bed) * carve

# Backswamp ponds: shallow hollows below river level, so river water stands in them.
for px, pz, rx, rz, floor in PONDS:
    q = ((X - px) / rx) ** 2 + ((Z - pz) / rz) ** 2 + .25 * fbm(30, 2, seed=int(px) & 63)
    pond = smoothstep(1.25, .55, q) * smoothstep(8, 30, inland)
    h_land = h_land * (1 - pond) + floor * pond

# Spawn clearing stays dry, level and walkable.
sx, sz = SPAWN
clear = np.exp(-((X - sx) ** 2 + (Z - sz) ** 2) / (2 * 26 ** 2))
h_land = h_land * (1 - .7 * clear) + 1.7 * .7 * clear

# --- River bed: steep below a cut bank, a long shallow shelf off sand and the spit.
slope = blur(.035 + .45 * cutbank, 8)
# A blurred distance keeps the bed free of the creases a chamfer distance leaves.
h_water = -8.5 * (1 - np.exp(-blur(offshore, 6) * slope / 8.5)) - .15
height = np.where(land, h_land, h_water).astype(np.float32)
# Micro relief everywhere on land (rills, tussocks), stronger away from water.
micro = .18 * fbm(9, 3, seed=11) + .06 * fbm(2.5, 2, seed=12)
height += micro * smoothstep(.2, 2, height) * land

# --- Hydraulic erosion: droplets carve rills on slopes and drop silt in hollows.
def erode(h, drops=160000, steps=48, inertia=.08, capacity=5.0, erode_rate=.25, deposit_rate=.25, evaporate=.03, min_slope=.002):
    hf = h.copy()
    flat = hf.reshape(-1)
    r = np.random.default_rng(SEED + 99)
    landy = np.argwhere(hf > .6)
    pick = landy[r.integers(0, len(landy), drops)]
    py = pick[:, 0].astype(np.float32) + r.random(drops, dtype=np.float32)
    px = pick[:, 1].astype(np.float32) + r.random(drops, dtype=np.float32)
    dx = np.zeros(drops, np.float32); dz = np.zeros(drops, np.float32)
    speed = np.ones(drops, np.float32); water = np.ones(drops, np.float32); sed = np.zeros(drops, np.float32)
    alive = np.ones(drops, bool)
    for _ in range(steps):
        ix = np.clip(px.astype(np.int32), 0, NX - 2); iy = np.clip(py.astype(np.int32), 0, NZ - 2)
        fx = px - ix; fy = py - iy
        k = iy * NX + ix
        h00, h10, h01, h11 = flat[k], flat[k + 1], flat[k + NX], flat[k + NX + 1]
        gx = (h10 - h00) * (1 - fy) + (h11 - h01) * fy
        gy = (h01 - h00) * (1 - fx) + (h11 - h10) * fx
        here = h00 * (1 - fx) * (1 - fy) + h10 * fx * (1 - fy) + h01 * (1 - fx) * fy + h11 * fx * fy
        dx = dx * inertia - gx * (1 - inertia); dz = dz * inertia - gy * (1 - inertia)
        n = np.hypot(dx, dz) + 1e-6; dx /= n; dz /= n
        nxp = px + dx; nyp = py + dz
        out = (nxp < 1) | (nxp > NX - 2) | (nyp < 1) | (nyp > NZ - 2) | (here < .05)
        alive &= ~out
        jx = np.clip(nxp.astype(np.int32), 0, NX - 2); jy = np.clip(nyp.astype(np.int32), 0, NZ - 2)
        gfx = nxp - jx; gfy = nyp - jy; kk = jy * NX + jx
        new = (flat[kk] * (1 - gfx) * (1 - gfy) + flat[kk + 1] * gfx * (1 - gfy) + flat[kk + NX] * (1 - gfx) * gfy + flat[kk + NX + 1] * gfx * gfy)
        dh = new - here
        cap = np.maximum(-dh, min_slope) * speed * water * capacity
        depositing = (sed > cap) | (dh > 0)
        amount = np.where(depositing, np.where(dh > 0, np.minimum(dh, sed), (sed - cap) * deposit_rate),
                          -np.minimum((cap - sed) * erode_rate, -dh))
        amount = np.clip(np.where(alive, amount, 0), -.05, .05)  # >0 deposit, <0 erode
        sed -= amount
        w = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy]
        for offset, weight in zip((0, 1, NX, NX + 1), w):
            flat += np.bincount(k + offset, weights=amount * weight, minlength=flat.size).astype(np.float32)
        speed = np.sqrt(np.maximum(speed * speed - dh * 4, 0)); water *= 1 - evaporate
        px, py = nxp, nyp
    return hf

base = height
height = erode(height)
height = np.clip(height, base - 1.2, base + .6)        # rills and silt, never pits or mounds
# Erosion never lifts the oxbow floor or creek beds above water, nor the clearing into bumps.
height = height * (1 - lake ** .6) + np.minimum(height, OXBOW['floor'] + .9 * lake_cross ** 2 + .2) * lake ** .6
height = height * (1 - .5 * clear) + blur(height, 2) * .5 * clear

# --- Ground layer weights (sand, wet mud, grass, cracked mud; leaf litter is the rest).
gy, gx = np.gradient(height, CELL)
steep = np.hypot(gx, gy)
near_water = 1 - smoothstep(.15, 1.0, np.abs(height - .05))
lake_edge = (1 - smoothstep(.6, 1.6, lake_cross)) * inside_arc * smoothstep(0, 10, edge)
sand = np.clip(np.maximum(spit * smoothstep(-6, .2, height) * (1 - smoothstep(2.2, 3.0, height)),
                          (1 - cutbank) * smoothstep(-4, .1, height) * (1 - smoothstep(.9, 1.6, height)) * (1 - smoothstep(30, 55, inland))), 0, 1)
sand = sand * (.8 + .2 * fbm(25, 2, seed=13))
mud = np.clip(np.maximum.reduce([near_water * (1 - sand), smoothstep(.35, .9, steep) * cutbank,
                                 (height < -.2) * (1 - sand), *[p ** .5 for p, _ in channels]]), 0, 1)
meadow_patch = smoothstep(.15, .55, fbm(160, 3, seed=14)) * (1 - headness)
# Glades: grass all over, so the forest (which grows on leaf litter) leaves them open.
glade = np.zeros_like(X)
for k, (gx_, gz_, rx, rz) in enumerate(GLADES):
    q = ((X - gx_) / rx) ** 2 + ((Z - gz_) / rz) ** 2 + .3 * fbm(28, 2, seed=40 + k)
    glade = np.maximum(glade, smoothstep(1.2, .7, q))
grass = np.clip(np.maximum.reduce([np.exp(-((X - sx) ** 2 + (Z - sz) ** 2) / (2 * 55 ** 2)) * 1.3,
                                   smoothstep(OXBOW['radius'] - OXBOW['half_width'], 10, r) * smoothstep(0, 30, edge) * .9,
                                   meadow_patch * .8, glade * 1.3]) * smoothstep(.25, .8, height) * (1 - smoothstep(.45, .8, steep)), 0, 1)
cracked = np.clip(np.maximum(lake_edge * smoothstep(-.4, .3, height) * (1 - smoothstep(.9, 1.6, height)),
                             smoothstep(.2, .6, -fbm(110, 2, seed=15)) * near_water * (1 - spit) * .8), 0, 1)
weights = np.stack([sand, mud * (1 - sand), grass * (1 - mud) * (1 - sand), cracked * (1 - sand)], -1)
total = weights.sum(-1, keepdims=True)
weights = np.where(total > 1, weights / np.maximum(total, 1e-6), weights)
weights = np.stack([blur(weights[..., k], 1) for k in range(4)], -1)
step = int(GROUND_CELL / CELL)
ground = np.clip(weights[::step, ::step] * 255 + .5, 0, 255).astype(np.uint8)


def oxbow_points(count, depth_min=1.2):
    """Points in deep oxbow water for fish, sorted around the bend."""
    cells = np.argwhere((lake > .5) & (OXBOW['surface'] - height > depth_min))
    pick = cells[np.linspace(0, len(cells) - 1, count).astype(int)]
    return [[float(xs[i]), float(height[j, i]), float(zs[j])] for j, i in pick]


def export(out):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    lo, hi = float(np.floor(height.min())), float(np.ceil(height.max()))
    q = np.clip((height - lo) / (hi - lo) * 65535 + .5, 0, 65535).astype('<u2')
    (out / 'island-height.bin').write_bytes(q.tobytes())
    (out / 'island-ground.bin').write_bytes(ground.tobytes())
    def h_at(x, z):
        return float(height[int(round((z + HALF_Z) / CELL)), int(round((x + HALF_X) / CELL))])
    meta = {
        'generator': 'project/terrain/river_island.py', 'seed': SEED,
        'heightfield': {'grid': [NX, NZ], 'size': [2 * HALF_X, 2 * HALF_Z], 'heightRange': [lo, hi],
                        'groundGrid': [ground.shape[1], ground.shape[0]]},
        'island': {'lengthM': LENGTH, 'widthM': WIDTH, 'landAreaM2': int((height > 0).sum() * CELL * CELL),
                   'maxHeightM': round(float(height.max()), 2)},
        'oxbow': {**OXBOW, 'bounds': [float(X[lake > .05].min()), float(X[lake > .05].max()), float(Z[lake > .05].min()), float(Z[lake > .05].max())],
                  'fish': oxbow_points(8)},
        'spawn': {'position': list(SPAWN), 'height': h_at(*SPAWN)},
        'glades': [list(g) for g in GLADES], 'ponds': [list(p) for p in PONDS],
        'probe': {f'{x},{z}': round(h_at(x, z), 2) for x, z in [(-7, 9), (15, -3), (104, -142), (0, 22), (6, 11), (5, 19)]},
    }
    (out / 'island-terrain.json').write_text(json.dumps(meta, indent=2) + '\n')
    return meta


def preview_mesh(name='RiverIsland', step=2):
    """Build a Blender mesh (Blender Z up, Y = -game Z) coloured by ground layer, for review."""
    import bpy
    sub = height[::step, ::step]
    wx, wz = X[::step, ::step], Z[::step, ::step]
    ny, nx = sub.shape
    verts = np.stack([wx.ravel(), -wz.ravel(), sub.ravel()], 1).astype(np.float32)
    ii, jj = np.meshgrid(np.arange(nx - 1), np.arange(ny - 1))
    a = (jj * nx + ii).ravel()
    quads = np.stack([a, a + nx, a + nx + 1, a + 1], 1).astype(np.int32)
    me = bpy.data.meshes.get(name) or bpy.data.meshes.new(name)
    me.clear_geometry()
    me.vertices.add(len(verts)); me.vertices.foreach_set('co', verts.ravel())
    me.loops.add(quads.size); me.loops.foreach_set('vertex_index', quads.ravel())
    me.polygons.add(len(quads)); me.polygons.foreach_set('loop_start', np.arange(0, quads.size, 4, dtype=np.int32))
    me.update(); me.validate()
    me.polygons.foreach_set('use_smooth', np.ones(len(quads), bool))
    w = weights[::step, ::step].reshape(-1, 4)
    palette = np.array([[.72, .63, .46], [.22, .17, .12], [.33, .42, .17], [.6, .5, .38]], np.float32)
    litter = np.array([.36, .26, .16], np.float32)
    col = w @ palette + (1 - w.sum(1, keepdims=True)) * litter
    col = np.where(sub.reshape(-1, 1) < 0, col * .6, col)
    ca = me.color_attributes.get('ground') or me.color_attributes.new('ground', 'FLOAT_COLOR', 'POINT')
    ca.data.foreach_set('color', np.concatenate([col, np.ones((len(col), 1), np.float32)], 1).ravel())
    ob = bpy.data.objects.get(name) or bpy.data.objects.new(name, me)
    if ob.name not in bpy.context.scene.collection.objects:
        bpy.context.scene.collection.objects.link(ob)
    mat = bpy.data.materials.get('RiverIslandGround') or bpy.data.materials.new('RiverIslandGround')
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    attr = next((n for n in nt.nodes if n.type == 'ATTRIBUTE'), None) or nt.nodes.new('ShaderNodeAttribute')
    attr.attribute_name = 'ground'
    nt.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = .9
    ob.data.materials.clear(); ob.data.materials.append(mat)
    return ob


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    target = args[args.index('--out') + 1] if '--out' in args else 'frontend/public/terrain'
    print(json.dumps(export(target), indent=2))
