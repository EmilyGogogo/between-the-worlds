#!/usr/bin/env python3
"""Validate the review baseline and design data; does not run gameplay tests."""
import csv
import json
import math
import re
import sys
from pathlib import Path
from urllib.parse import unquote
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'project'))
errors = []
checks = 0

SLOT_STATES = ['placeholder', 'generated', 'edited', 'integrated', 'accepted']


def check(condition, message):
    global checks
    checks += 1
    if not condition:
        errors.append(message)


def read_json(name):
    return json.loads((ROOT / 'data' / name).read_text(encoding='utf-8'))


def unique(items, field, label):
    values = [item[field] for item in items]
    check(len(values) == len(set(values)), f'Duplicate {label}')
    return set(values)


def main():
    required = [
        'README.md', 'CONTRIBUTING.md', 'data/README.md',
        'docs/README.md', 'docs/01-global-rules.md',
        'docs/02-controls-and-camera.md', 'docs/03-possession-spec.md',
        'docs/04-entity-catalog.md', 'docs/05-world-layout.md',
        'docs/06-lux3d-asset-pipeline.md', 'docs/07-content-and-audio.md',
        'docs/08-qa-acceptance.md', 'docs/09-decisions.md',
        'docs/10-submission-checklist.md', 'docs/11-prototype-audit.md',
        'data/entities.json', 'data/input-map.json', 'data/anchors.json',
        'data/dialogue.json', 'data/tuning.json', 'data/interactions.json', 'data/asset-ledger.csv',
        'docs/diagrams/world-archipelago.svg', 'project/new_species.py',
        'project/CHANGELOG.md', 'project/LICENSES.md',
        'DEFERRED.md', 'AGENTS.md', 'GLOSSARY.md',
    ]
    for path in required:
        check((ROOT / path).is_file(), f'Missing file: {path}')

    documents = list((ROOT / 'docs').rglob('*.md')) + list((ROOT / 'project').glob('*.md'))
    documents += [ROOT / 'data/README.md', ROOT / 'frontend/README.md',
                  ROOT / 'DEFERRED.md', ROOT / 'README.md', ROOT / 'CONTRIBUTING.md', ROOT / 'AGENTS.md']
    for doc in documents:
        text = doc.read_text(encoding='utf-8')
        for target in re.findall(r'\]\(([^)]+)\)', text):
            target = target.strip().strip('<>')
            if re.match(r'^[a-zA-Z][\w+.-]*:', target) or target.startswith('#'):
                continue
            target = unquote(target.split('#', 1)[0])
            check((doc.parent / target).exists(), f'Broken link: {doc.relative_to(ROOT)} -> {target}')

    # Rules: every row must be classified; referenced IDs must exist.
    rules_text = (ROOT / 'docs/01-global-rules.md').read_text(encoding='utf-8')
    rule_rows = re.findall(r'^\| ([A-Z]+-\d+) \|.*\|$', rules_text, re.M)
    rules = re.findall(r'^\| ([A-Z]+-\d+) \|.*\| (MUST|TUNABLE|DEFERRED) \|$', rules_text, re.M)
    rule_ids = {rule for rule, _ in rules}
    check(len(rule_rows) == len(rules), 'Rule row without MUST/TUNABLE/DEFERRED')
    check(len(rules) == len(rule_ids), 'Duplicate rule ID')
    for required_rule in ['G-07', 'G-08', 'I-02', 'B-04', 'P-12', 'P-13', 'P-14', 'P-15', 'P-16', 'M-01', 'M-02', 'M-03', 'M-05', 'W-05', 'W-06', 'L-04', 'L-05']:
        check(required_rule in rule_ids, f'Missing rule {required_rule}')
    qa_text = (ROOT / 'docs/08-qa-acceptance.md').read_text(encoding='utf-8')
    qa_ids = re.findall(r'\*\*(QA-\d+)', qa_text)
    QA_COUNT = len(qa_ids)
    check(qa_ids == [f'QA-{i:02}' for i in range(1, QA_COUNT + 1)], 'QA IDs must run from QA-01 in order without gaps')
    for qa_rule_group in re.findall(r'\*\*QA-\d+ / ([^*]+)\*\*', qa_text):
        for rid in re.findall(r'[A-Z]-\d+', qa_rule_group):
            check(rid in rule_ids, f'QA references unknown rule {rid}')
    qa_ids = set(qa_ids)
    for doc in documents:
        for ref in set(re.findall(r'\bQA-(\d+)', doc.read_text(encoding='utf-8'))):
            check(int(ref) <= QA_COUNT, f'{doc.relative_to(ROOT)} references QA-{ref}, beyond QA-{QA_COUNT}')

    # Entities
    entity_doc = read_json('entities.json')
    entity_list = entity_doc['entities']
    entities = {e['id']: e for e in entity_list}
    entity_ids = unique(entity_list, 'id', 'entity ID')
    unique(entity_list, 'runtimeKind', 'runtime kind')
    categories = entity_doc['categories']
    CATEGORIES = set(categories)
    check({e['category'] for e in entity_list} == CATEGORIES, 'Every category needs a species and every species a declared category')
    decisions = (ROOT / 'docs/09-decisions.md').read_text(encoding='utf-8')
    for cid, category in categories.items():
        check(isinstance(category['isAnimal'], bool) and bool(category['name']) and bool(category['placeholder']), f'Category {cid}: name, isAnimal, placeholder')
        # A category beyond the creator's first five classes is a scope change (G-04, G-08).
        if category['release'] != '0.3':
            check(bool(category.get('decision')) and f"### {category['decision']}" in decisions, f'Category {cid} needs a recorded decision')
    # Scale tiers (P-12, P-15, D-021): relations are derived, never hand-listed.
    import sync_runtime
    tiers = {t['id']: t for t in entity_doc['scaleTiers']}
    unique(entity_doc['scaleTiers'], 'id', 'scale tier')
    lifts = [t['viewLiftEyeHeightM'] for t in entity_doc['scaleTiers'] if t['viewLiftEyeHeightM'] is not None]
    check(lifts == sorted(lifts) and all(h > 0 for h in lifts), 'View lift heights must rise with the tiers (P-16)')
    for e in entity_list:
        check(e.get('scaleTier') in tiers, f'{e["id"]}: unknown scaleTier')
    tier_rank, relations = sync_runtime.scale_relations(entity_doc)
    # Render layers (C-06): every setting the runtime reads comes from data, none from stage numbers.
    layers = {l['stage']: l for l in entity_doc['scaleLayers']}
    unique(entity_doc['scaleLayers'], 'stage', 'render layer')
    for stage, layer in layers.items():
        check('targetOcclusion' not in layer, f'Render layer {stage}: occlusion is mandatory at every scale (P-02), not a render switch')
        for field in sync_runtime.RUNTIME_LAYER_FIELDS:
            check(field in layer and field in entity_doc['scaleLayerFields'], f'Render layer {stage}: missing or undocumented {field}')
        check(all(isinstance(layer.get(k), (int, float)) and layer[k] > 0 for k in ['cameraLookAhead', 'fogDensity', 'focusHeightRatio']), f'Render layer {stage}: invalid numbers')
        check(layer.get('possessMinPitch') is None or isinstance(layer['possessMinPitch'], (int, float)), f'Render layer {stage}: possessMinPitch')
    region_doc = {r['id']: r for r in read_json('anchors.json')['regions']}
    rank = {eid: tier_rank[e['scaleTier']] for eid, e in entities.items()}
    abilities = {}
    for e in entity_list:
        eid = e['id']
        check(e['stage'] in layers, f'{eid}: stage must name a render layer in scaleLayers')
        check(e['body'].get('limbSwingRate', 1) > 0, f'{eid}: limbSwingRate must be positive')
        if e['locomotion'] == 'fly':  # M-04: every flyer names its airspace
            air = region_doc.get(e.get('activityRegion'), {})
            check(all(k in air for k in ['center', 'radius', 'maxY', 'minClearanceM']), f'{eid}: activityRegion must be an airspace with center, radius, maxY, minClearanceM')
        check('isAnimal' not in e, f'{eid}: isAnimal belongs to the category')
        check('allowedTargets' not in e, f'{eid}: relations come from scaleTier, not allowedTargets (D-021)')
        low, high = tiers[e['scaleTier']]['referenceSizeM']
        size = max(e['body']['height'], 2 * e['body']['collisionRadius'])
        check(low <= size and (high is None or size <= high) or bool(e.get('scaleTierReason')),
              f'{eid}: size {size} m outside {e["scaleTier"]}; fix the tier or record scaleTierReason')
        overrides = e.get('relationOverrides')
        if overrides:
            check(set(overrides.get('allow', [])) | set(overrides.get('deny', [])) <= entity_ids, f'{eid}: unknown override target')
            check(f"### {overrides.get('decision')}" in decisions, f'{eid}: relationOverrides needs a recorded decision')
        check(set(e['acceptanceIds']) <= qa_ids, f'{eid}: unknown QA reference')
        for name in ['moveSpeed', 'acceleration', 'turnSpeedDegPerSec', 'possessionRange', 'observationRange', 'boostMultiplier']:
            check(isinstance(e[name], (int, float)) and e[name] > 0, f'Invalid {eid}.{name}')
        for removed in ['canJump', 'canAscend', 'canDescend']:
            check(removed not in e, f'{eid}.{removed} belongs to the removed jump/ascend keys (D-007)')
        check(e['verticalControl'] == ('view_direction' if e['locomotion'] in {'fly', 'swim'} else 'none'), f'{eid}: verticalControl must follow locomotion')
        abilities.setdefault(e['category'], set()).add(e['uniqueAbility']['id'])
        # P-12: only the own and adjacent populated tiers, unless a decision says otherwise
        if not overrides:
            check(all(abs(rank[t] - rank[eid]) <= 1 for t in relations[eid]), f'{eid}: relation skips a tier (P-12)')
        # Perception
        perception = e['perception']
        for key in ['grayscale', 'saturation', 'contrast', 'brightness', 'fogMultiplier']:
            check(isinstance(perception['vision'][key], (int, float)), f'{eid}: vision.{key}')
        for key in ['airLowpassHz', 'underwaterLowpassHz', 'range', 'waterCueGain', 'windGain', 'distantCueGain']:
            check(isinstance(perception['hearing'][key], (int, float)) and perception['hearing'][key] >= 0, f'{eid}: hearing.{key}')
        check(perception['basis'] in {'reference', 'art_direction', 'scale_soundscape'}, f'{eid}: perception basis')
        if e['category'] == 'dog':
            check(perception['vision']['grayscale'] == 1, 'Dog must see a monochrome world (B-04, creator directed)')
        # Collision (D-008)
        collision = e['collision']
        check(collision['passPolicy'] == ('go_around' if collision['solid'] else 'yield_with_bend'), f'{eid}: passPolicy disagrees with solid')
        check(collision['solid'] or e['stage'] == 0, f'{eid}: only near-ground bodies may be passable (M-02/M-03)')
        # Asset slot (L-04, L-05)
        a = e['asset']
        check(a['slotId'] == 'slot.' + e['runtimeKind'], f'{eid}: slotId must be slot.<runtimeKind>')
        check(a['status'] in SLOT_STATES, f'{eid}: asset status')
        check(a['upAxis'] == '+Y' and a['forwardAxis'] == '-Z', f'{eid}: asset axes')
        check(isinstance(a['height'], (int, float)) and a['height'] > 0, f'{eid}: asset height')
        check(isinstance(a['variants'], list), f'{eid}: variants must be a list')
        check(a['placeholder'].startswith('procedural:'), f'{eid}: placeholder must name a generator')
        sources = [a['url']] if a['url'] else []
        for variant in a['variants']:
            check(isinstance(variant, str) or bool(variant.get('url')), f'{eid}: each variant needs a url')
            sources.append(variant if isinstance(variant, str) else variant.get('url'))
        check(isinstance(a['lod'], list) and all(isinstance(l.get('distance'), (int, float)) and l.get('url') for l in a['lod']), f'{eid}: lod levels need url and distance')
        if categories[e['category']]['isAnimal']:
            check({'idle', 'move'} <= set(a['requiredAnimationRoles']), f'{eid}: animals need idle and move (L-05)')
        if sources:
            check(a['status'] in SLOT_STATES[3:], f'{eid}: model set but slot not integrated')
            check(set(a['requiredAnimationRoles']) <= set(a['animations']), f'{eid}: missing animation mapping')
            for url in sources + [l['url'] for l in a['lod']] + [a[key] for key in ('idleUrl', 'runUrl', 'swimUrl') if a.get(key)]:
                if url and not url.startswith('http'):
                    check((ROOT / 'frontend' / url.removeprefix('./')).exists(), f'{eid}: asset file missing: {url}')
        else:
            check(a['status'] in SLOT_STATES[:3], f'{eid}: integrated slot needs a url')
    owners = {}
    for category, ids in abilities.items():
        for ability in ids:
            owners.setdefault(ability, set()).add(category)
    check(all(len(c) == 1 for c in owners.values()), 'A unique ability is shared across categories (G-01)')
    top = max(rank.values())
    for e in entity_list:  # every type can return to the smallest tier and reach the largest
        reached, stack = {e['id']}, [e['id']]
        while stack:
            for target in relations[stack.pop()]:
                if target not in reached:
                    reached.add(target)
                    stack.append(target)
        for goal in [0, top]:
            check(any(rank[r] == goal for r in reached), f'{e["id"]}: cannot reach tier rank {goal} (W-05)')
    env_slots = unique(entity_doc['environmentSlots'], 'slotId', 'environment slot')
    check('env.world' in env_slots, 'Missing env.world slot')
    decor_slots = [slot for slot in entity_doc['environmentSlots'] if slot.get('scatter')]

    # D-029: both camera modes are configured for every body; islands retain terrain.
    modes = entity_doc['cameraModes']
    check(modes['default'] == 'third_person' and modes['decision'] == 'D-029', 'Camera defaults must follow D-029')
    check(modes['third_person']['vision'] == {'grayscale': 0, 'saturation': 1, 'contrast': 1, 'brightness': 1, 'fogMultiplier': 1, 'tint': None}, 'Third-person vision must be full colour (D-029)')
    check(modes['third_person']['followBodyTurn'] is True, 'Third-person camera must follow body turns (D-029)')
    for e in entity_list:
        first = e['camera']['firstPerson']
        offset = first['eyeOffset']
        check(len(offset) == 3 and all(isinstance(v, (int, float)) and math.isfinite(v) for v in offset), f'{e["id"]}: invalid first-person eye')
        check(0 < offset[1] <= e['body']['height'], f'{e["id"]}: eye must lie within body height')
        check(first['hideBody'] == (e['category'] != 'island'), f'{e["id"]}: first-person visibility must preserve island terrain')

    # Input (D-007, D-029)
    inputs = read_json('input-map.json')
    codes = [code for b in inputs['bindings'] for code in b['codes']]
    check(len(codes) == len(set(codes)), 'Duplicate active key binding')
    for code in ['KeyE', 'Space', 'ControlLeft', 'ControlRight']:
        check(code not in codes, f'{code} must stay unbound (I-02/I-03)')
    check(next(b for b in inputs['bindings'] if b['action'] == 'possess')['codes'] == ['KeyR'], 'R must be exclusive')
    check(next(b for b in inputs['bindings'] if b['action'] == 'toggle_view')['codes'] == ['KeyV'], 'V toggles camera mode (D-029)')

    # Layout (W-08): named instances and scatter groups, read at runtime.
    layout = read_json('anchors.json')
    anchor_ids = unique(layout['anchors'], 'id', 'anchor ID')
    anchors = {a['id']: a for a in layout['anchors']}
    instances = {i['id']: i for i in layout['instances']}
    unique(layout['instances'], 'id', 'instance ID')
    unique(layout['scatter'], 'id', 'scatter group ID')
    regions = {r['id'] for r in layout['regions']}
    # Water bodies (M-04): data-driven; exactly one sea, enclosed bodies need a shape and surface.
    num = lambda v: isinstance(v, (int, float)) and not isinstance(v, bool)
    waters = [r for r in layout['regions'] if r.get('water')]
    seas = [r for r in waters if r['water'].get('type') == 'sea']
    check(len(seas) == 1 and all(num(seas[0]['water'].get(k)) for k in ['levelM', 'minDepthM']), 'Need exactly one sea region with levelM and minDepthM')
    for r in waters:
        w = r['water']
        check(w.get('type') in {'sea', 'enclosed'}, f'{r["id"]}: water.type must be sea or enclosed')
        if w.get('type') == 'enclosed':
            check(r.get('shape') == 'ellipse' and len(r.get('center', [])) == 2 and len(r.get('radii', [])) == 2 and all(num(v) and v > 0 for v in r.get('radii', [])),
                  f'{r["id"]}: enclosed water needs an ellipse with center and positive radii')
            check(num(w.get('surfaceY')), f'{r["id"]}: enclosed water needs surfaceY')
            check(w.get('opacity') is None or (num(w['opacity']) and 0 < w['opacity'] <= 1), f'{r["id"]}: opacity must be in (0, 1]')
            basin = w.get('basin')
            check(basin is None or (num(basin.get('depthM')) and basin['depthM'] > 0 and len(basin.get('falloffM', [])) == 2 and all(num(v) and v > 0 for v in basin['falloffM'])),
                  f'{r["id"]}: basin needs depthM and two positive falloffM')
    for a in anchors.values():
        check(set(a['safeFor']) <= entity_ids, f'Unknown safe type at {a["id"]}')
        check(len(a['position']) == 3 and all(isinstance(v, (int, float)) and math.isfinite(v) for v in a['position']), f'Invalid position at {a["id"]}')
    known = {'ocean'}
    for i in layout['instances']:  # carriers must come first
        check(i['type'] in entities, f'Broken instance type: {i["id"]}')
        check(i['carrier'] in known, f'{i["id"]}: carrier {i["carrier"]} must be listed before it')
        check(i['placement'] in layout['placementModes'], f'{i["id"]}: unknown placement')
        check(len(i['position']) == 3, f'{i["id"]}: position needs x,y,z')
        check(i.get('anchorId') is None or i['anchorId'] in anchors, f'{i["id"]}: unknown anchor')
        known.add(i['id'])
    check(sum(i['placement'] == 'main' for i in layout['instances']) == 1 and instances.get(layout['mainIsland'], {}).get('placement') == 'main', 'Exactly one main island')
    check(layout['initialInstance'] in instances, 'Unknown initial body')
    for old_id, new_id in layout.get('savePlayerAliases', {}).items():
        check(isinstance(old_id, str) and old_id not in instances, f'{old_id}: save alias must name a retired body')
        check(isinstance(new_id, str) and new_id in instances, f'{old_id}: save alias target {new_id} does not exist')
    check(instances.get(layout['initialInstance'], {}).get('type') == 'human_01', 'A new journey must start as a human (D-017)')
    for g in layout['scatter']:
        check(g['type'] in entities and g['carrier'] in instances, f'Broken scatter group: {g["id"]}')
        check(bool(g.get('points')) or (bool(g.get('area')) and g.get('count', 0) > 0), f'{g["id"]}: needs points or area+count')
        check(set(g.get('avoidRegions', [])) | ({g['insideRegion']} if g.get('insideRegion') else set()) <= regions, f'{g["id"]}: unknown region')
        check(not (set(instances) & {f'{g["id"]}-{n}' for n in range(len(g.get('points', [])) + g.get('count', 0))}), f'{g["id"]}: generated ids collide with an instance')
    for slot in decor_slots:
        check(slot['scatter']['carrier'] in instances, f'{slot["slotId"]}: unknown carrier')
        check(set(slot['scatter'].get('avoidRegions', [])) | ({slot['scatter']['insideRegion']} if slot['scatter'].get('insideRegion') else set()) <= regions, f'{slot["slotId"]}: unknown region')
    placed = {i['type'] for i in layout['instances']} | {g['type'] for g in layout['scatter']}
    check(placed == entity_ids, f'Every body type needs individuals in the world: missing {sorted(entity_ids - placed)}')
    for e in entity_list:
        check(set(e['safeAnchors']) <= anchor_ids, f'Missing safe anchor: {e["id"]}')
    for route in layout['routes']:
        check(set(route['anchorIds']) <= anchor_ids, f'Broken route: {route["id"]}')
    start = instances[layout['initialInstance']]
    reach = entities[start['type']]['possessionRange']
    check(any(i['carrier'] == start['carrier'] and i['type'] in relations[start['type']] and i is not start and
              math.dist(start['position'][::2], i['position'][::2]) <= reach for i in layout['instances']),
          'No legal first target within the start body reach (G-06)')
    def carried(root):
        out, frontier = [], {root}
        while frontier:
            found = [i for i in layout['instances'] if i['carrier'] in frontier] + [g for g in layout['scatter'] if g['carrier'] in frontier]
            out += found
            frontier = {i['id'] for i in found if 'placement' in i and i['id'] in instances}
        return out
    islands = [i for i in layout['instances'] if entities[i['type']]['category'] == 'island']
    check(len(islands) >= 4, 'Need the main island plus at least three neighbours (W-01)')
    # Ladder (W-05, D-021): every island carries each tier below it down to the smallest;
    # every other carrier carries each tier between its smallest passenger and itself.
    for carrier in layout['instances']:
        ranks = {rank[i['type']] for i in carried(carrier['id'])}
        if not ranks and carrier not in islands:
            continue
        bottom = 0 if carrier in islands else min(ranks)
        missing = set(range(bottom, rank[carrier['type']])) - ranks
        check(not missing, f'{carrier["id"]}: ladder broken, no carried body in tier rank {sorted(missing)} (W-05)')

    # Interactions (X-01..X-04)
    interactions = read_json('interactions.json')
    unique(interactions['interactions'], 'id', 'interaction ID')
    for x in interactions['interactions']:
        check(x['trigger']['type'] in interactions['triggers'], f'{x["id"]}: unknown trigger')
        check(x['effect']['type'] in interactions['effects'], f'{x["id"]}: unknown effect')
        check(set(x['rules']) <= rule_ids, f'{x["id"]}: unknown rule')
        for side in ['subject', 'target']:
            check(set(x[side].get('categories', [])) <= CATEGORIES and set(x[side].get('types', [])) <= entity_ids, f'{x["id"]}: unknown {side} filter')
    effect_code = (ROOT / 'frontend/src/interactions.js').read_text(encoding='utf-8')
    for name in interactions['effects']:
        check(re.search(rf'^  {name}:\{{', effect_code, re.M) is not None, f'Effect {name} is documented but not implemented')

    # Dialogue
    dialogue = read_json('dialogue.json')
    unique(dialogue['entries'], 'id', 'dialogue ID')
    for line in dialogue['entries']:
        count = len(re.findall(r'[㐀-鿿]', line['text']))
        limit = dialogue['policy']['quotedMaxHanCharacters'] if line['sourceType'] == 'quoted' else dialogue['policy']['maxHanCharacters']
        check(8 <= count <= limit, f'Chinese length out of range: {line["id"]} ({count})')
        if line['sourceType'] == 'quoted':
            check(bool(line.get('author')) and bool(line.get('work')), f'Quote needs author and work: {line["id"]}')
            check(line.get('textStatus') in {'classical', 'translation_to_verify', 'verified'}, f'Quote needs textStatus: {line["id"]}')
        check(line['entityType'] in entities, f'Broken dialogue entity: {line["id"]}')
        check(line['trigger'] in dialogue['triggers'], f'Unknown trigger: {line["id"]}')
        check(line['triggerAnchor'] is None or line['triggerAnchor'] in anchors, f'Broken dialogue anchor: {line["id"]}')
        check(line['sourceType'] in {'original', 'adapted', 'inspired', 'quoted'}, f'Missing text provenance: {line["id"]}')
        if line['sourceType'] != 'original':
            check(bool(line['sourceReference']), f'Missing text source: {line["id"]}')
    check(dialogue['policy']['globalCooldownSec'] >= 90, 'Global cooldown below 90 (U-04)')
    check(dialogue['policy']['maxHanCharacters'] == 16 and dialogue['policy']['quotedMaxHanCharacters'] <= 18, 'Text budget exceeds U-03')

    # Tuning
    tuning = read_json('tuning.json')
    for key, parameter in tuning['parameters'].items():
        check(parameter['min'] <= parameter['value'] <= parameter['max'], f'Tuning outside range: {key}')
        check(parameter['rule'] in rule_ids, f'Unknown rule for parameter: {key}')
    check(tuning['hardConstraints']['minimumAcceptableFps'] == 30, 'Unexpected FPS floor')
    for e in entity_list:
        if e.get('activityRegion'):
            air = next(r for r in layout['regions'] if r['id'] == e['activityRegion'])
            check(air['maxY'] == tuning['parameters']['flightCeilingM']['value'], f'{e["id"]}: airspace maxY and flightCeilingM disagree')
    version = entity_doc['_meta']['specVersion']
    for name in ['entities.json', 'input-map.json', 'anchors.json', 'dialogue.json', 'tuning.json', 'interactions.json']:
        meta = read_json(name)['_meta']
        check(meta['specVersion'] == version, f'Data versions disagree: {name}')
        check(meta['runtimeBinding'] in {'not_integrated', 'partial', 'integrated'}, f'Missing integration state: {name}')
        if meta['runtimeBinding'] != 'not_integrated':
            check(bool(meta.get('integrationEvidence')), f'Integration claim needs evidence: {name}')
    check(f'版本：{version}' in (ROOT / 'docs/01-global-rules.md').read_text(encoding='utf-8'), 'Rules document version disagrees with data')

    # Generated runtime files must match data (do not hand-edit them).
    for path, value in sync_runtime.generate().items():
        current = json.loads((ROOT / path).read_text(encoding='utf-8')) if (ROOT / path).exists() else None
        check(current == value, f'{path} is stale or hand-edited; run project/sync_runtime.py')

    # Asset ledger
    with (ROOT / 'data/asset-ledger.csv').open(encoding='utf-8-sig', newline='') as f:
        ledger = list(csv.DictReader(f))
    unique(ledger, 'asset_id', 'asset ledger ID')
    assets = {a['asset_id']: a for a in ledger}
    for e in entity_list:
        a = e['asset']
        check(a['ledgerId'] in assets and a['fallbackLedgerId'] in assets, f'Missing asset entries: {e["id"]}')
        if a['lux3dUsed']:
            check(a['ledgerId'] in assets and assets[a['ledgerId']]['lux3d_used'] == 'true', f'Unsupported Lux3D claim: {e["id"]}')
    for slot in entity_doc['environmentSlots']:
        check('PH-' + slot['slotId'] in assets, f'Missing ledger entry for {slot["slotId"]}')
    for asset in ledger:
        check(asset['lux3d_used'] in {'true', 'false'}, f'Invalid Lux3D flag: {asset["asset_id"]}')
        if asset['lux3d_used'] == 'true':
            for field in ['generation_date', 'raw_file', 'evidence_path', 'license_status']:
                check(bool(asset[field]), f'Missing real asset evidence: {asset["asset_id"]}.{field}')
            for field in ['raw_file', 'evidence_path']:
                path = asset[field]
                if path and not path.startswith(('https://', 'http://')):
                    check((ROOT / path).exists(), f'Asset evidence file missing: {path}')
        if asset['status'] in {'planned', 'placeholder'}:
            check(asset['lux3d_used'] == 'false', f'Planned or placeholder asset marked generated: {asset["asset_id"]}')

    for path in (ROOT / 'docs/diagrams').rglob('*.svg'):
        ElementTree.parse(path)
        check(True, f'SVG syntax: {path.name}')

    if errors:
        print('\n'.join('FAIL: ' + e for e in errors))
        print(f'{len(errors)} errors / {checks} checks')
        return 1
    print(f'PASS: {checks} documentation/data checks; {len(rules)} classified rules; '
          f'{len(entities)} body types in {len(CATEGORIES)} categories; '
          f'{len(instances)} instances, {len(layout["scatter"])} scatter groups; '
          f'{len(interactions["interactions"])} interactions; {len(ledger)} asset records.')
    print('Gameplay acceptance and real asset/performance verification were NOT run.')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (KeyError, ValueError, OSError, StopIteration) as error:
        print(f'FAIL: invalid or missing design data: {error!r}')
        sys.exit(1)
