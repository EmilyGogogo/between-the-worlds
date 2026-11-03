#!/usr/bin/env python3
"""Add a species to an existing category by copying one that already works.

Example (a heron that behaves like a gull until it gets its own model):
    python3 project/new_species.py --from bird_gull_01 --id bird_heron_01 --name 苍鹭 --kind heron --count 3

What it writes, all in data/:
  entities.json   new species with an empty asset slot (placeholder until a GLB is set);
                  it keeps the source's scaleTier unless --tier is given, and its
                  possession relations follow from that tier (P-12, D-021)
  anchors.json    a scatter group placing --count individuals beside the source's first one
  asset-ledger.csv  placeholder and planned rows for the new slot
Afterwards: tune its numbers, optionally add a quote in dialogue.json, then run
project/sync_runtime.py and project/validate_docs.py. No game code changes.
A new category (e.g. house) is a scope change: see data/README.md.
"""
import argparse
import copy
import csv
import json
import math
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / 'data'


def read(name):
    return json.loads((DATA / name).read_text(encoding='utf-8'))


def write(name, value):
    (DATA / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--from', dest='source', required=True, help='existing species id to copy')
    parser.add_argument('--id', required=True, help='new species id, e.g. bird_heron_01')
    parser.add_argument('--name', required=True, help='display name, e.g. 苍鹭')
    parser.add_argument('--kind', required=True, help='short runtime kind, e.g. heron')
    parser.add_argument('--style', help='placeholder look; defaults to the source look')
    parser.add_argument('--tier', help='scale tier id, e.g. S1; defaults to the source tier')
    parser.add_argument('--count', type=int, default=3, help='individuals to place')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    entities, layout = read('entities.json'), read('anchors.json')
    by_id = {e['id']: e for e in entities['entities']}
    if args.source not in by_id:
        raise SystemExit(f'Unknown source species: {args.source}')
    if args.id in by_id or any(e['runtimeKind'] == args.kind for e in entities['entities']):
        raise SystemExit('id or kind already exists')
    source = by_id[args.source]

    new = copy.deepcopy(source)
    new.update(id=args.id, name=args.name, runtimeKind=args.kind, implementationStatus='scaffolded_placeholder')
    if args.tier:
        if args.tier not in {t['id'] for t in entities['scaleTiers']}:
            raise SystemExit(f'Unknown scale tier: {args.tier}')
        new['scaleTier'] = args.tier
        new.pop('scaleTierReason', None)
    asset = new['asset']
    asset.update(slotId=f'slot.{args.kind}', status='placeholder', url=None, variants=[], lod=[], animations={},
                 rigSource=None, collisionBoxes=None, lux3dUsed=False, placeholderStyle=args.style or asset.get('placeholderStyle'),
                 plannedModelPath=f'frontend/public/models/{args.kind}-v1.glb',
                 ledgerId=f'PLAN-{args.id}', fallbackLedgerId=f'PH-{args.id}')
    entities['entities'].append(new)

    first = next((i for i in layout['instances'] if i['type'] == args.source), None)
    if first is None:
        group = next((g for g in layout['scatter'] if g['type'] == args.source), None)
        if group is None:
            raise SystemExit('The source species has no placed individual to stand beside')
        point = group['points'][0] if group.get('points') else group['area']['center']
        first = {'carrier': group['carrier'], 'placement': group['placement'],
                 'position': point if len(point) == 3 else [point[0], 0, point[1]]}
    x, y, z = first['position']
    spacing = max(2.0, source['body']['collisionRadius'] * 4)
    points = [[round(x + math.cos(k * 2.4) * spacing * (1 + k * .3), 2), y,
               round(z + math.sin(k * 2.4) * spacing * (1 + k * .3), 2)] for k in range(args.count)]
    layout['scatter'].append({'id': args.kind, 'type': args.id, 'carrier': first['carrier'],
                              'placement': first['placement'], 'seed': len(layout['scatter']) + 2000, 'points': points})

    ledger_path = DATA / 'asset-ledger.csv'
    with ledger_path.open(encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        columns, rows = reader.fieldnames, list(reader)
    rows.append({'asset_id': f'PH-{args.id}', 'entity_id': args.id, 'scope': 'slot_placeholder', 'source': 'project_procedural',
                 'source_reference': f'frontend/src/assets.js#PLACEHOLDERS:{source["category"]}', 'lux3d_used': 'false',
                 'license_status': '项目原创；未单独声明发布许可', 'gameplay_use': f'{args.name}·{asset["slotId"]} 占位',
                 'runtime_path': 'frontend/src/assets.js', 'status': 'placeholder'})
    rows.append({'asset_id': f'PLAN-{args.id}', 'entity_id': args.id, 'scope': 'slot_planned', 'file_name': f'{args.kind}-v1.glb',
                 'source': 'planned_Lux3D', 'lux3d_used': 'false', 'license_status': '待取得实际生成产物及参考素材授权记录',
                 'gameplay_use': f'{args.name}·{new["uniqueAbility"]["id"]}', 'status': 'planned'})

    if args.dry_run:
        print(json.dumps(new, ensure_ascii=False, indent=2))
        print('points', points)
        return
    write('entities.json', entities)
    write('anchors.json', layout)
    with ledger_path.open('w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, columns)
        writer.writeheader()
        writer.writerows({c: r.get(c, '') for c in columns} for r in rows)
    print(f'Added {args.id} ({args.name}) with {args.count} individuals beside {args.source}.')
    print('Next: python3 project/sync_runtime.py && python3 project/validate_docs.py')


if __name__ == '__main__':
    main()
