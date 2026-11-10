#!/usr/bin/env python3
"""Build browser configuration from project data. Does not generate assets.

data/ is the single source: entities.json (categories, scale tiers, bodies, asset slots),
anchors.json (world layout), interactions.json, dialogue.json, input-map.json,
tuning.json. Edit those, then run this script. Never hand-edit the outputs.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNTIME_ASSET_FIELDS = ['url', 'idleUrl', 'runUrl', 'swimUrl', 'variants', 'lod', 'height', 'rotation', 'animations', 'colliderMode',
                        'collisionBoxes', 'slotId', 'status', 'placeholder', 'placeholderStyle', 'lux3dUsed', 'pivot', 'proceduralAnimation']
RUNTIME_DECOR_FIELDS = ['slotId', 'url', 'variants', 'height', 'scaleRange', 'wind', 'visibleUpToStage', 'placeholder', 'scatter', 'status']
RUNTIME_LAYER_FIELDS = ['cameraLookAhead', 'cameraTerrainFloor', 'cameraCollision', 'fogDensity', 'localSun', 'focusHeightRatio', 'possessMinPitch']


def scale_relations(entities):
    """Possession relations derived from scale tiers (P-12, D-021).

    Tiers without members are skipped, so a reserved or emptied tier never breaks
    the ladder. A body may enter its own tier and the populated tiers next to it;
    relationOverrides (each tied to a decision) add or remove single species.
    Returns ({tier id: rank}, {species id: [target species ids]}).
    """
    used = {e['scaleTier'] for e in entities['entities']}
    rank = {t['id']: n for n, t in enumerate(t for t in entities['scaleTiers'] if t['id'] in used)}
    targets = {}
    for e in entities['entities']:
        own, extra = rank[e['scaleTier']], e.get('relationOverrides', {})
        found = [o['id'] for o in entities['entities'] if abs(rank[o['scaleTier']] - own) <= 1]
        found += [t for t in extra.get('allow', []) if t not in found]
        targets[e['id']] = [t for t in found if t not in extra.get('deny', [])]
    return rank, targets


def generate():
    def read(name):
        return json.loads((ROOT / 'data' / name).read_text(encoding='utf-8'))
    entities, inputs, tuning, dialogue, layout, interactions = (read(n) for n in [
        'entities.json', 'input-map.json', 'tuning.json', 'dialogue.json', 'anchors.json', 'interactions.json'])
    kinds = {e['id']: e['runtimeKind'] for e in entities['entities']}
    responses = {d['entityType']: d['text'] for d in dialogue['entries'] if d['trigger'] == 'target_focus'}
    moments = {}
    for d in dialogue['entries']:
        if d['trigger'] != 'target_focus':
            moments.setdefault(d['entityType'], {})[d['trigger']] = d['text']
    rank, relations = scale_relations(entities)
    profiles, models = {}, {}
    for e in entities['entities']:
        kind = e['runtimeKind']
        assert all(target in kinds for target in relations[e['id']]), kind
        category = entities['categories'][e['category']]
        profiles[kind] = {
            'id': e['id'], 'name': e['name'], 'category': e['category'], 'isAnimal': category['isAnimal'],
            'soundCue': category.get('soundCue'),
            'stage': e['stage'], 'tier': rank[e['scaleTier']], 'scaleTier': e['scaleTier'], 'mode': e['locomotion'],
            'radius': e['body']['collisionRadius'], 'height': e['body']['height'],
            'wadeDepth': e['body']['wadeDepthM'], 'surface': e['body'].get('surface'),
            'limbSwingRate': e['body'].get('limbSwingRate', 0), 'activityRegion': e.get('activityRegion'),
            'speed': e['moveSpeed'], 'boost': e['boostMultiplier'], 'turnSpeed': e['turnSpeedDegPerSec'],
            'camera': e['camera']['distance'], 'fov': e['camera']['fovDeg'],
            'firstPerson': e['camera']['firstPerson'],
            'reach': e['possessionRange'], 'targets': [kinds[t] for t in relations[e['id']]],
            'deny': [kinds[t] for t in e.get('relationOverrides', {}).get('deny', [])],
            'place': e['place'], 'response': responses.get(e['id'], ''), 'moments': moments.get(e['id'], {}),
            'vision': e['perception']['vision'], 'hearing': e['perception']['hearing'],
            'collision': e['collision'], 'verticalControl': e['verticalControl'],
            'flightHeight': e.get('flightHeightM'),
        }
        models[kind] = {k: e['asset'][k] for k in RUNTIME_ASSET_FIELDS if k in e['asset']}
    world = next((s for s in entities['environmentSlots'] if s['slotId'] == 'env.world'), None)
    environment = {k: world[k] for k in ['url', 'scale', 'position', 'rotation', 'useAsTerrain']} if world and world['url'] else None
    decor = [{k: s.get(k) for k in RUNTIME_DECOR_FIELDS} for s in entities['environmentSlots'] if s.get('scatter')]
    to_kind = lambda item: {**{k: v for k, v in item.items() if k != 'type'}, 'kind': kinds[item['type']]}
    world_layout = {
        'mainIsland': layout['mainIsland'], 'initialInstance': layout['initialInstance'],
        'savePlayerAliases': layout.get('savePlayerAliases', {}),
        'regions': {r['id']: r for r in layout['regions']},
        'instances': [to_kind(i) for i in layout['instances']],
        'scatter': [to_kind(s) for s in layout['scatter']],
        'ambient': layout.get('ambient', []),
    }
    rules = [{k: v for k, v in x.items() if k not in ('description', 'rules', 'reviewState')} for x in interactions['interactions']]
    return {
        'frontend/public/config/game.json': {
            'version': entities['_meta']['specVersion'], 'categories': entities['categories'], 'cameraModes': entities['cameraModes'],
            'scaleLayers': {str(l['stage']): {k: l[k] for k in RUNTIME_LAYER_FIELDS} for l in entities['scaleLayers']},
            'scaleTiers': [{'id': t['id'], 'name': t['name'], 'rank': rank[t['id']], 'liftEyeHeightM': t['viewLiftEyeHeightM']}
                           for t in entities['scaleTiers'] if t['id'] in rank],
            'species': profiles,
            'layout': world_layout, 'interactions': rules, 'input': inputs, 'tuning': tuning['parameters']},
        'frontend/public/models/manifest.json': {
            'version': 4, 'generatedFrom': 'data/entities.json', 'environment': environment, 'decor': decor, 'species': models},
    }


if __name__ == '__main__':
    for name, value in generate().items():
        path = ROOT / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(name)
