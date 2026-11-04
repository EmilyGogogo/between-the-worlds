#!/usr/bin/env python3
"""Bake a terrain GLB (for example a Lux3D island) into the env.world heightfield.

The game draws the main island as a grid and answers ground height from the same
grid, so a generated model never has to be ray-cast at runtime. This tool renders
the GLB straight down in an isolated headless Chrome (the same Three.js the game
ships), then writes:

  <name>-height.bin   uint16 little-endian heights, rows north (-z) to south, columns west (-x) to east
  <name>-color.jpg    top-down colour map covering the same rectangle
  <name>-bake.json    source hash, parameters and the slot fields to copy into data/entities.json

Example:
  python3 project/bake_terrain.py island.glb --name island-amazon --length 1100 --peak 7
"""
import argparse
import base64
from collections import deque
import hashlib
import json
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import math
import os
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import tempfile
import threading

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'frontend/tests'))
sys.path.insert(0, str(ROOT / 'project'))
from cdp import CDP  # noqa: E402
from check_all import find_chrome, free_port, wait_ready  # noqa: E402


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def render(glb, args):
    tmp = tempfile.mkdtemp(prefix='bake-terrain-')
    try:
        site = Path(tmp) / 'site'
        site.mkdir()
        shutil.copy(ROOT / 'project/bake_terrain.html', site / 'index.html')
        shutil.copytree(ROOT / 'frontend/vendor', site / 'vendor')
        shutil.copy(glb, site / 'source.glb')
        server = ThreadingHTTPServer(('127.0.0.1', free_port()), partial(QuietHandler, directory=str(site)))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        url = f'http://127.0.0.1:{server.server_address[1]}/index.html'
        debug_port = free_port()
        browser = subprocess.Popen([
            find_chrome(args.chrome), '--headless=new', '--no-first-run', '--no-default-browser-check',
            '--disable-background-networking', '--disable-extensions', '--no-proxy-server',
            '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
            '--remote-debugging-address=127.0.0.1', f'--remote-debugging-port={debug_port}',
            f'--user-data-dir={Path(tmp) / "profile"}', url,
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            wait_ready(f'http://127.0.0.1:{debug_port}/json/version', browser)
            client = CDP(debug_port)
            client.call('Runtime.enable')
            client.wait_for('window.ready===true', 60)
            params = {'url': './source.glb', 'up': args.up, 'length': args.length, 'yaw': args.yaw,
                      'cell': args.cell, 'margin': args.margin, 'colorSize': args.color_size}
            return client.evaluate(f'window.bake({json.dumps(params)})')
        finally:
            browser.terminate()
            browser.wait(timeout=15)
            server.shutdown()
    finally:
        # Chrome may still flush its profile while exiting; leftovers are only temp files.
        shutil.rmtree(tmp, ignore_errors=True)


def neighbours(i, j, nx, nz):
    for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        a, b = i + di, j + dj
        if 0 <= a < nx and 0 <= b < nz:
            yield a, b


def quantile(values, q):
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(q * (len(ordered) - 1)))]


def level(raw, nx, nz):
    """Remove the least-squares tilt of the surface; generated slabs are rarely level."""
    pts = [(i, j, raw[j * nx + i]) for j in range(nz) for i in range(nx) if not math.isnan(raw[j * nx + i])]
    n = len(pts)
    si = sum(p[0] for p in pts); sj = sum(p[1] for p in pts); sh = sum(p[2] for p in pts)
    sii = sum(p[0] * p[0] for p in pts); sjj = sum(p[1] * p[1] for p in pts); sij = sum(p[0] * p[1] for p in pts)
    sih = sum(p[0] * p[2] for p in pts); sjh = sum(p[1] * p[2] for p in pts)
    # Normal equations for h = a*i + b*j + c, solved by Cramer's rule.
    m = [[sii, sij, si], [sij, sjj, sj], [si, sj, n]]
    r = [sih, sjh, sh]

    def det(x):
        return (x[0][0] * (x[1][1] * x[2][2] - x[1][2] * x[2][1]) - x[0][1] * (x[1][0] * x[2][2] - x[1][2] * x[2][0])
                + x[0][2] * (x[1][0] * x[2][1] - x[1][1] * x[2][0]))
    d = det(m)
    a, b, c = (det([[r[k] if col == q else m[k][col] for col in range(3)] for k in range(3)]) / d for q in range(3))
    return [v - (a * (n_ % nx) + b * (n_ // nx)) if not math.isnan(v) else v for n_, v in enumerate(raw)], (a, b)


def shape(raw, nx, nz, args):
    covered = [not math.isnan(v) for v in raw]
    if args.level:
        raw, tilt = level(raw, nx, nz)
        print(f'removed tilt: {tilt[0] / args.cell:.5f} per metre east, {tilt[1] / args.cell:.5f} per metre south', file=sys.stderr)
    surface = [v for v in raw if not math.isnan(v)]
    # --sea-quantile of the model surface ends up under water; --top-quantile reaches --peak.
    base, top = quantile(surface, args.sea_quantile), quantile(surface, args.top_quantile)
    k = args.peak / max(top - base, 1e-6)
    h = [(v - base) * k if c else 0.0 for v, c in zip(raw, covered)]
    for _ in range(args.smooth):
        out = h[:]
        for j in range(nz):
            for i in range(nx):
                if not covered[j * nx + i]:
                    continue
                cells = [(i, j), *neighbours(i, j, nx, nz)]
                inside = [h[b * nx + a] for a, b in cells if covered[b * nx + a]]
                out[j * nx + i] = sum(inside) / len(inside)
        h = out
    rim = [h[j * nx + i] for j in range(nz) for i in range(nx)
           if covered[j * nx + i] and any(not covered[b * nx + a] for a, b in neighbours(i, j, nx, nz))]
    if not rim:
        raise SystemExit('The model fills the whole grid; raise --margin.')
    edge = min(quantile(rim, .5), args.edge)
    # Beyond the model the bed slopes down to the river floor instead of dropping off.
    distance = [0 if c else -1 for c in covered]
    queue = deque(divmod(n, nx)[::-1] for n, c in enumerate(covered) if c)
    while queue:
        i, j = queue.popleft()
        for a, b in neighbours(i, j, nx, nz):
            if distance[b * nx + a] < 0:
                distance[b * nx + a] = distance[j * nx + i] + 1
                queue.append((a, b))
    for n, c in enumerate(covered):
        if not c:
            h[n] = max(args.floor, edge - args.slope * distance[n] * args.cell)
    return h, sum(covered)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('glb', type=Path)
    parser.add_argument('--name', required=True, help='Output file prefix, e.g. island-amazon')
    parser.add_argument('--out', type=Path, default=ROOT / 'frontend/public/models')
    parser.add_argument('--length', type=float, default=1100, help='Long horizontal side of the island in metres')
    parser.add_argument('--yaw', type=float, default=0, help='Extra turn about the vertical axis, degrees')
    parser.add_argument('--up', default='auto', help='Axis the ground faces in the file: auto, x+, x-, y+, y-, z+, z-')
    parser.add_argument('--cell', type=float, default=2.5, help='Grid spacing in metres')
    parser.add_argument('--margin', type=float, default=140, help='River bed kept around the island, metres')
    parser.add_argument('--sea-quantile', type=float, default=.25, help='Share of the model surface placed under water')
    parser.add_argument('--peak', type=float, default=7, help='Height above sea of the high ground (see --top-quantile)')
    parser.add_argument('--edge', type=float, default=-.8, help='Highest the bed may start beyond the model outline')
    parser.add_argument('--top-quantile', type=float, default=.99)
    parser.add_argument('--slope', type=float, default=.12, help='River bed fall per metre beyond the outline')
    parser.add_argument('--floor', type=float, default=-14, help='Deepest river bed, metres')
    parser.add_argument('--no-level', dest='level', action='store_false', help='Keep the model tilt')
    parser.add_argument('--smooth', type=int, default=1, help='3x3 smoothing passes over the island')
    parser.add_argument('--color-size', type=int, default=2048)
    parser.add_argument('--record', type=Path, help='Where to write <name>-bake.json (default: --out)')
    parser.add_argument('--chrome')
    args = parser.parse_args()

    result = render(args.glb, args)
    nx, nz = result['nx'], result['nz']
    raw = list(struct.unpack(f'<{nx * nz}f', base64.b64decode(result['heights'])))
    heights, land = shape(raw, nx, nz, args)
    lo, hi = min(heights), max(heights)
    packed = struct.pack(f'<{nx * nz}H', *(round((v - lo) / (hi - lo) * 65535) for v in heights))
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / f'{args.name}-height.bin').write_bytes(packed)
    (args.out / f'{args.name}-color.jpg').write_bytes(base64.b64decode(result['color']))
    above = sum(1 for v in heights if v > 0)
    slot = {'url': f'./public/models/{args.name}-height.bin', 'colorMap': f'./public/models/{args.name}-color.jpg',
            'grid': [nx, nz], 'size': [round(v, 3) for v in result['size']], 'heightRange': [round(lo, 4), round(hi, 4)]}
    record = {
        'source': {'file': os.path.relpath(args.glb.resolve(), ROOT) if args.glb.resolve().is_relative_to(ROOT) else args.glb.name, 'sha256': hashlib.sha256(args.glb.read_bytes()).hexdigest()},
        'parameters': {k: v for k, v in vars(args).items() if k not in ('glb', 'out', 'record', 'chrome', 'name')},
        'orientedUp': result['orientedUp'], 'footprintM': [round(v, 1) for v in result['footprint']],
        'cellsCovered': land, 'cellsAboveSea': above, 'areaAboveSeaM2': round(above * args.cell ** 2),
        'colorMapPx': result['colorSize'], 'heightfield': slot,
    }
    record_dir = args.record or args.out
    record_dir.mkdir(parents=True, exist_ok=True)
    (record_dir / f'{args.name}-bake.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(record, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
