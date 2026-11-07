#!/usr/bin/env python3
"""0.3/0.4 baseline integration checks against a local Chrome started with --remote-debugging-port.

Serve frontend/, start an isolated headless Chrome, then:
python3 frontend/tests/check_browser.py --port 9223 --url http://127.0.0.1:4173/
The test clears this site's save in the connected browser; use a throwaway profile.
"""
import argparse
import json
from pathlib import Path
import sys
from cdp import CDP

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'project'))
from sync_runtime import scale_relations

entity_source = json.loads((ROOT / 'data/entities.json').read_text(encoding='utf-8'))
override_source = json.loads(json.dumps(entity_source))
override_bird = next(s for s in override_source['entities'] if s['runtimeKind'] == 'gull')
override_bird['relationOverrides'] = {'allow': ['island_01'], 'deny': ['plant_grass_01'], 'decision': 'D-021'}
_, override_relations = scale_relations(override_source)
override_targets = [s['runtimeKind'] for s in override_source['entities'] if s['id'] in override_relations[override_bird['id']]]

parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=9223)
parser.add_argument('--url', default='http://127.0.0.1:4173/')
args = parser.parse_args()
c = CDP(args.port)
for method in ['Runtime.enable', 'Page.enable', 'Network.enable']:
    c.call(method)
c.call('Network.setCacheDisabled', {'cacheDisabled': True})
c.call('Emulation.setDeviceMetricsOverride', {'width': 1280, 'height': 800, 'deviceScaleFactor': 1, 'mobile': False})


def load():
    c.evaluate("window.__world&&(window.__world.resetting=true);localStorage.clear();true")
    previous = c.evaluate('performance.timeOrigin')
    c.call('Page.navigate', {'url': args.url + '?debug'})
    c.wait_for(f'performance.timeOrigin!=={previous}&&!!window.__world&&!document.getElementById("enter").disabled', 90)


PRELUDE = r"""
const g=window.__world,W=g.world,{SPECIES,CATEGORIES,TUNING,LAYOUT,WATERS,canEmbody}=await import('./src/species.js'),results=[];
const assert=(name,ok,detail='')=>{if(!ok)throw Error(name+' '+detail);results.push(name);};
// Freeze requestAnimationFrame between steps, but update exploration UI as unpaused.
const step=(n,dt=1/30)=>{for(let i=0;i<n;i++){g.elapsed+=dt;g.collision.refresh();if(!g.transition){g.move(dt);g.collision.refresh();}g.updateCamera(dt);if(!g.transition)g.selectTarget(dt);const paused=g.paused;g.paused=false;g.updateHints(dt);g.paused=paused;W.update(dt,g.player,g.target,g.targetInfo?.point,1);g.interactions.update(dt);}};
const seek=id=>{for(const pitch of [.06,.16,.27,.4,.52,.8,1.1]){g.pitch=pitch;for(let i=0;i<48;i++){g.yaw=i/48*6.283;step(5);if(g.target?.id===id)return true;}}return false;};
const go=id=>{if(!seek(id))return false;g.possess();step(100);return g.player.id===id;};
const take=id=>{g.player=W.byId.get(id);g.transition=null;g.collision.refresh();step(5);};
const key=(code,type='keydown')=>{g.paused=false;window.dispatchEvent(new KeyboardEvent(type,{code,bubbles:true}));g.paused=true;};
g.lockMouse=()=>{};g.start();g.paused=true;step(90);
"""
PRELUDE += '\nconst ENTITY_SOURCE=' + json.dumps(entity_source, ensure_ascii=True) + ';\n'
PRELUDE += 'const OVERRIDE_TARGETS=' + json.dumps(override_targets) + ';\n'


def run(body):
    return json.loads(c.evaluate('(async()=>{' + PRELUDE + body + '\nreturn JSON.stringify(results);})()'))


passed = []
load()
passed += run(r"""
// Counts come from data/entities.json, never from this test, so adding species or categories needs no edit here.
const kinds=Object.keys(SPECIES),used=new Set(Object.values(SPECIES).map(s=>s.category));
assert('every configured category has a species and every species a configured category',kinds.length>0&&used.size===Object.keys(CATEGORIES).length&&[...used].every(c=>c in CATEGORIES),`${kinds.length} species, ${used.size}/${Object.keys(CATEGORIES).length} categories`);
assert('every type has a physical instance',Object.keys(SPECIES).every(k=>W.entities.some(e=>e.kind===k)));
assert('no flower or planet bodies',!W.entities.some(e=>['flower','planet','rockPlanet'].includes(e.kind)));
const ids=W.entities.map(e=>e.id);assert('instance ids unique',new Set(ids).size===ids.length);
assert('a new journey starts as human-first (D-017)',g.player.id==='human-first'&&g.player.kind==='human');
W.restore(W.serialize());g.collision.refresh();
const bad=W.entities.filter(e=>SPECIES[e.kind].collision.solid&&SPECIES[e.kind].stage<3&&g.collision.collides(e,W.position(e)));
assert('no solid bodies overlap at spawn (M-01)',bad.length===0,bad.map(e=>e.id).join());
assert('first R hint appears with a target (U-01)',!!g.target&&document.getElementById('first-hint').textContent.startsWith('R'));
const p0=W.position(g.player).clone();g.yaw=.35;g.pitch=.27;key('KeyW');step(30);key('KeyW','keyup');
assert('WASD moves the current body',W.position(g.player).distanceTo(p0)>1);
key('Space');key('KeyE');key('ControlLeft');assert('Space, Ctrl and E are unbound (I-02, I-03)',g.actions.size===0);
assert('pause menu has no Space/Ctrl/E rows',![...document.querySelectorAll('.controls kbd')].some(k=>/空格|Ctrl|^E$/.test(k.textContent)));
const by=id=>W.byId.get(id),isl0=by('island-main'),gull=by('gull-0');
const source=ENTITY_SOURCE;
const sourceByKind=Object.fromEntries(source.entities.map(s=>[s.runtimeKind,s]));
const occupied=source.scaleTiers.filter(t=>source.entities.some(s=>s.scaleTier===t.id)).map(t=>t.id);
const expected=(a,b)=>{const from=sourceByKind[a.kind],to=sourceByKind[b.kind],o=from.relationOverrides||{};
  return !(o.deny||[]).includes(to.id)&&((o.allow||[]).includes(to.id)||Math.abs(occupied.indexOf(from.scaleTier)-occupied.indexOf(to.scaleTier))<=1);};
assert('relations follow occupied tiers and decision-backed overrides (P-12)',W.entities.every(a=>W.entities.every(b=>a===b||canEmbody(a,b)===expected(a,b))));
assert('grass and human cannot enter the island directly (D-021)',!canEmbody(by('grass-start'),isl0)&&!canEmbody(by('human-first'),isl0));
assert('grass cannot enter a tree two tiers up (D-021)',!canEmbody(by('grass-start'),by('tree-first')));
assert('boulder can enter the island; island cannot become grass (P-12)',canEmbody(by('boulder-main'),isl0)&&!canEmbody(isl0,by('grass-start')));
assert('view lift widens a gull upwards only (P-15)',!canEmbody(gull,isl0)&&canEmbody(gull,isl0,3)&&!canEmbody(isl0,gull,4));
const saved=SPECIES.gull;
try{
  SPECIES.gull={...saved,targets:OVERRIDE_TARGETS,deny:['grass']};
  assert('generated allow override permits a non-adjacent island (P-12)',canEmbody(gull,isl0));
  assert('generated deny override blocks a same-tier target even with lift (P-12)',!canEmbody(gull,by('grass-start'),4));
}finally{SPECIES.gull=saved;}
""")
load()
passed += run(r"""
take('island-main');
assert('island can select an unobscured boulder (P-02)',seek('boulder-main'));
const target=g.target,eye=g.camera.position.clone(),direction=g.camera.getWorldDirection(eye.clone()),point=W.focus(target),mid=eye.clone().lerp(point,.5);
const box=g.collision.records[0].box.clone().setFromCenterAndSize(mid,new eye.constructor(100,100,100));
g.collision.records.push({entity:W.byId.get('island-0'),box});
assert('island rejects a boulder hidden by another solid body (P-02)',!g.evaluate(target,eye,direction));
g.selectTarget(1/30);
assert('island cancels a fully obscured cached target (P-05)',g.target!==target);
g.collision.refresh();
const h=W.byId.get('human-first'),skin=TUNING.collisionSkinM.value,p=W.position(h);
const before=g.collision.actorBox(h,p).getSize(p.clone()),frameBefore=g.collision.frameBox(h,p).getSize(p.clone());
try{
  TUNING.collisionSkinM.value=skin+.01;
  const after=g.collision.actorBox(h,p).getSize(p.clone()),frameAfter=g.collision.frameBox(h,p).getSize(p.clone());
  assert('collision skin tuning changes world and carrier-frame boxes (M-07)',Math.abs(before.x-after.x-.02)<1e-7&&Math.abs(frameBefore.x-frameAfter.x-.02)<1e-7);
}finally{TUNING.collisionSkinM.value=skin;}
""")
load()
passed += run(r"""
assert('human -> dog',go('dog-first'));
assert('dog sees in monochrome (B-04)',g.renderer.domElement.style.filter.startsWith('grayscale(1)'));
assert('dog -> human',go('human-first'));
assert('perception returns to colour',g.renderer.domElement.style.filter.startsWith('grayscale(0)'));
assert('human -> tree, one tier up (G-07)',go('tree-first'));
take('human-first');const h=g.player;h.root.position.set(285,0,112);h.root.position.y=g.groundHeight(h);step(20);
assert('human on the shore cannot select the island (D-021)',!seek('island-main'));
take('boulder-main');
assert('boulder -> main island (G-07)',go('island-main'));
assert('Foucault line queued for the first island moment',g.shown.has('island:first_possess'));
assert('island -> neighbour island',go('island-0'));
assert('island -> boulder',go('boulder-island-0'));
assert('boulder -> pine',go('pine-island-0-1'));
assert('pine -> rock, one tier down (W-05, D-021)',go('rocks-island-0-1'));
assert('rock -> grass, back to the smallest scale (W-05)',go('grass-island-0-1'));
""")
load()
passed += run(r"""
take('grass-start');
assert('grass cannot select the island from inland (D-021)',!seek('island-main'));
take('gull-0');const bird=g.player,bp=bird.root.position,lift=y=>{bp.y=W.height(bp.x,bp.z)+y;step(3);return g.liftRank();};
assert('a low gull has no view lift (P-15)',lift(1)===SPECIES.gull.tier&&!seek('island-main'));
assert('a gull 70 m up reaches the landform tier (P-15)',lift(70)===SPECIES.boulder.tier);
assert('lift is kept just under the threshold (P-16)',lift(57)===SPECIES.boulder.tier&&lift(50)<SPECIES.boulder.tier);
lift(90);
assert('a high gull can select the island below (P-15)',seek('island-main'));
const island=W.byId.get('island-main'),eye=g.camera.position.clone(),dir=g.camera.getWorldDirection(eye.clone());
const point=g.evaluate(island,eye,dir)?.point;
assert('island ripple follows the terrain under the gull view',!!point&&point.distanceTo(W.position(island))>1);
const blocker=W.byId.get('tree-first'),box=g.collision.records[0].box.clone(),mid=eye.clone().lerp(point,.5);
box.setFromCenterAndSize(mid,new eye.constructor(.4,.4,.4));
g.collision.records.push({entity:blocker,box});
assert('a solid blocker hides the viewed island surface (P-02)',!g.evaluate(island,eye,dir));
g.collision.refresh();
g.camera.lookAt(g.camera.position.clone().add(new eye.constructor(0,100,0)));
assert('R rejects a cached island target after looking at the sky (P-06)',!g.possess()&&g.player.kind==='gull'&&!g.target);
assert('high gull -> island',go('island-main'));
assert('first island response also triggers from a gull',g.shown.has('island:first_possess'));
""")
load()
passed += run(r"""
take('grass-boulder-0');
assert('grass on a boulder recognises the island as its carrying whole',g.isCarrier(W.byId.get('island-main')));
assert('grass on a boulder still cannot select the island (D-021)',!seek('island-main'));
take('grove-pine-0');
assert('tree -> boulder, one tier up (G-07)',go('boulder-main'));
take('pine-boulder-1');
assert('pine on the boulder -> rock on the boulder (W-05)',go('rock-boulder-0'));
assert('rock on the boulder -> grass on the boulder (W-05)',go('grass-boulder-1'));
""")
load()
passed += run(r"""
take('human-first');const tree=W.byId.get('tree-first'),h=g.player,tp=tree.root.position;
h.root.position.set(tp.x+6,0,tp.z);h.root.position.y=g.groundHeight(h);g.yaw=Math.PI/2;g.pitch=.27;
g.actions.add('move_forward');step(120);g.actions.add('boost');step(40,1/20);g.actions.clear();g.collision.refresh();
assert('human goes around a tree trunk, even boosted at 20 FPS (M-02)',!g.collision.collides(h,W.position(h))&&Math.hypot(h.root.position.x-tp.x,h.root.position.z-tp.z)>.8);
const gr=W.byId.get('grass-friend-0');h.root.position.copy(gr.root.position).x+=.3;h.root.position.y=g.groundHeight(h);step(20);
assert('grass bends when a solid body passes (M-03)',(gr.bend||0)>.2);
take('gull-0');const b=g.player,y0=b.root.position.y;g.pitch=-.4;g.actions.add('move_forward');step(60);
assert('gull climbs when looking up (I-02)',b.root.position.y-y0>5);
g.pitch=-.45;g.actions.add('boost');step(900);g.actions.clear();
const ceiling=TUNING.flightCeilingM.value;
assert('gull stays under the flight ceiling (M-04)',b.root.position.y<=ceiling+.01&&b.root.position.y>ceiling-10,b.root.position.y);
take('silverfish-0');const f=g.player;g.pitch=-.45;g.actions.add('move_forward');g.actions.add('boost');let above=-1e9;
for(let k=0;k<40;k++){g.yaw=k*.6;step(15);const p=f.root.position,w=W.water(p.x,p.z);above=Math.max(above,w?p.y-w.surface:99);}g.actions.clear();
assert('silverfish never leaves the lake (M-04)',above<0,above);
take('dog-first');const hu=W.byId.get('human-first');g.target=hu;g.evaluate=()=>({entity:hu});g.possess();step(36);
assert('perception blends mid-transition (P-14)',g.renderer.domElement.style.filter.startsWith('grayscale(0.5'));
step(60);
const isl=W.byId.get('island-main'),grass=W.byId.get('grass-start'),before=W.position(grass).clone(),local=grass.root.position.clone();
g.player=isl;g.transition=null;g.pitch=.6;g.yaw=0;g.updateCamera(1);g.actions.add('move_forward');for(let i=0;i<120;i++)g.move(1/30);g.actions.clear();
assert('a drifting island carries its grass (W-06)',W.position(grass).distanceTo(before)>100&&grass.root.position.equals(local));
""")
load()
passed += run(r"""
// Interactions come from data/interactions.json (X-01..X-04).
take('human-first');const h=g.player,gull=W.byId.get('gull-0');
gull.root.position.set(h.root.position.x+2,h.root.position.y+1,h.root.position.z);const home=gull.root.position.clone();
step(30);assert('a gull flees when a human comes near (IX-BIRDS-RISE)',gull.root.position.distanceTo(home)>3);
step(420);assert('the gull returns home afterwards (X-02)',gull.root.position.distanceTo(home)<.2&&!gull.flee);
// Asset slots: variants, LOD and decoration instancing, with a test fixture (L-04, L-07).
const {AssetLibrary,makeProcedural}=await import('./src/assets.js'),fixture='./tests/animated-triangle.gltf';
const lib=new AssetLibrary();
await lib.prepare({species:{gull:{url:fixture,height:.65,animations:{idle:'Glide'},variants:[{url:fixture,height:1.3}],lod:[{url:fixture,distance:50}]}},
  decor:[{slotId:'env.test',url:fixture,height:.5,variants:[fixture],scatter:{seed:3}}]});
const heights=new Set();let lods=0;
for(let seed=1;seed<40;seed++){const m=lib.make('gull',seed);heights.add(+m.userData.localBounds.getSize(new m.position.constructor()).y.toFixed(2));m.traverse(o=>{if(o.isLOD)lods++;});}
assert('one species can carry several models (variants)',heights.has(.65)&&heights.has(1.3),[...heights]);
assert('a far model (LOD) is attached to each individual',lods===39);
assert('variants keep their animation',lib.mixers.length>0);
const decor=lib.makeDecor({slotId:'env.test',scatter:{seed:3}},Array.from({length:10},(_,i)=>({position:[i,0,0],rotationY:0,scale:1})));
let placed=0;decor.traverse(o=>{if(o.isInstancedMesh)placed+=o.count;});
assert('decoration slots render GLB instances',placed===10);
assert('meadow and pebbles come from decoration slots',W.decor.length===2&&W.decor.every(d=>d.object.parent));
// Water bodies come from regions with a `water` block, not from code (M-04).
assert('the lake and the sea are both data regions',W.water(-83,-65)?.id==='lake'&&WATERS.some(r=>r.water.type==='sea'));
const enclosed=WATERS.filter(r=>r.water.type==='enclosed');
assert('each enclosed water body gets a surface mesh at its level',W.waterBodies.length===enclosed.length&&enclosed.every((r,i)=>W.waterBodies[i].position.y===r.water.surfaceY&&W.waterBodies[i].parent===W.islandRoot));
const pond={id:'test-pond',shape:'ellipse',center:[300,-300],radii:[10,10],water:{type:'enclosed',surfaceY:50}};
LAYOUT.regions[pond.id]=pond;WATERS.push(pond);const found=W.water(300,-300);WATERS.pop();delete LAYOUT.regions[pond.id];
assert('a water body added in data is recognised without code changes',found?.id==='test-pond'&&found.surface===50&&!W.water(300,-300)?.id?.startsWith('test'));
// A new species of an existing category needs no code: it borrows the category placeholder (G-08).
SPECIES.testheron={...SPECIES.gull,name:'测试'};
assert('a new bird species gets a bird placeholder',makeProcedural('testheron',1,{placeholder:'procedural:bird',placeholderStyle:'heron'}).userData.bird===true);
SPECIES.testhouse={...SPECIES.rock,category:'house'};
let meshes=0;makeProcedural('testhouse',1,{placeholder:'procedural:house'}).traverse(o=>{if(o.isMesh)meshes++;});
assert('an unknown category still gets a visible stand-in',meshes>0);
delete SPECIES.testheron;delete SPECIES.testhouse;
assert('world layout comes from data/anchors.json (W-08)',W.byId.has('forest-pine-0')&&W.byId.has('pine-island-2-3'));
// A fixture exercises replacement wiring, not real terrain or Lux3D acceptance.
const oldTerrain=W.terrain,main=W.byId.get(LAYOUT.mainIsland);
W.assets.manifest.environment={url:fixture,useAsTerrain:true,scale:20};
await W.loadEnvironment();step(3);
assert('environment replacement remains the only main-island terrain after updates (L-04)',!oldTerrain.parent&&main.visual===W.terrain&&W.externalTerrain===W.terrain&&W.terrain.visible&&W.terrain.parent===W.islandRoot);
assert('environment replacement supplies main-body collision bounds',main.visual.userData.external&&!g.collision.localBoxes(main)[0].isEmpty());
""")

# Sound: starts with the first click and stays reachable while paused (A-02).
load()
def click_at(x, y):
    for kind in ['mousePressed', 'mouseReleased']:
        c.call('Input.dispatchMouseEvent', {'type': kind, 'x': x, 'y': y, 'button': 'left', 'clickCount': 1})
def center(element_id):
    r = json.loads(c.evaluate(f"JSON.stringify(document.getElementById('{element_id}').getBoundingClientRect())"))
    return r['x'] + r['width'] / 2, r['y'] + r['height'] / 2
c.evaluate("window.__world.lockMouse=()=>{};true")
click_at(*center('enter'))
c.wait_for("document.getElementById('sound').getAttribute('aria-pressed')==='true'", 10)
passed.append('sound turns on with the first click into the world')
c.evaluate("window.__world.pause();true")
x, y = center('sound')
assert c.evaluate(f"document.elementFromPoint({x},{y}).closest('#sound')!==null"), 'sound button is covered by the pause layer'
click_at(x, y)
c.wait_for("document.getElementById('sound').getAttribute('aria-pressed')==='false'&&document.getElementById('pause-sound').textContent==='关'", 10)
passed.append('sound button stays clickable while paused')
click_at(*center('pause-sound'))
c.wait_for("document.getElementById('sound').getAttribute('aria-pressed')==='true'", 10)
passed.append('pause menu has its own sound toggle')

# D-024: real click/keyboard/pointer entry path, without replacing Game.lockMouse.
load()
def key_event(code, kind='keyDown', repeat=False):
    names = {'Escape': ('Escape', 27), 'KeyW': ('w', 87), 'KeyS': ('s', 83),
             'KeyA': ('a', 65), 'KeyD': ('d', 68), 'ArrowUp': ('ArrowUp', 38),
             'ArrowDown': ('ArrowDown', 40), 'ArrowLeft': ('ArrowLeft', 37),
             'ArrowRight': ('ArrowRight', 39)}
    key_name, virtual = names[code]
    c.call('Input.dispatchKeyEvent', {'type': kind, 'code': code, 'key': key_name,
                                     'windowsVirtualKeyCode': virtual, 'autoRepeat': repeat})

def browser_assert(name, expression):
    assert c.evaluate(expression), name
    passed.append(name)

browser_assert('entry explains hidden pointer and Escape before playing',
               "document.querySelector('.welcome-controls').textContent.includes('指针会隐藏')")
# Hold the opening transition long enough to inspect and test its input boundary.
c.evaluate("window.__world.startOriginal=window.__world.start;window.__world.start=function(){this.startOriginal();this.transition.duration=20;};true")
click_at(*center('enter'))
c.wait_for("document.pointerLockElement===document.getElementById('world')", 10)
browser_assert('real entry click locks the pointer and explains the opening transition',
               "!document.getElementById('control-guide').hidden&&document.getElementById('control-status').textContent.includes('镜头到位')")
key_event('KeyW')
browser_assert('opening transition ignores movement input', 'window.__world.actions.size===0')
c.evaluate('window.__world.finishTransition();window.__world.pointerHintTime=60;window.__world.updateControlGuide();true')
key_event('KeyW', repeat=True)
browser_assert('held repeat cannot move after transition until a fresh press', 'window.__world.actions.size===0')
key_event('KeyW', 'keyUp')
browser_assert('locked controls explain mouse look and Escape release',
               "document.getElementById('look-guide').textContent==='鼠标环视'&&document.getElementById('control-status').textContent.includes('Esc')")
yaw_before = c.evaluate('window.__world.yaw')
c.call('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': 640, 'y': 400})
c.call('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': 680, 'y': 400})
browser_assert('real locked pointer movement changes the camera', f'window.__world.yaw!=={yaw_before}')
# Each direction is exercised from the same clear spawn, checking actual displacement.
origin = c.evaluate('window.__world.player.root.position.toArray()')
for code in ('KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'):
    c.evaluate(f'window.__world.player.root.position.fromArray({json.dumps(origin)});window.__world.inputOrigin=window.__world.world.position(window.__world.player).clone();true')
    key_event(code)
    c.wait_for('window.__world.world.position(window.__world.player).distanceTo(window.__world.inputOrigin)>.2', 5)
    key_event(code, 'keyUp')
    passed.append(f'{code} moves during actual exploration')
key_event('KeyW')
key_event('ArrowUp')
key_event('KeyW', 'keyUp')
browser_assert('releasing W preserves held ArrowUp', "window.__world.actions.has('move_forward')")
key_event('ArrowUp', 'keyUp')
browser_assert('releasing both aliases stops movement', 'window.__world.actions.size===0')
key_event('Escape')
key_event('Escape', 'keyUp')
c.wait_for('window.__world.paused&&!document.pointerLockElement', 10)
browser_assert('Escape pauses, releases pointer, and replaces compact guide with full menu',
               "!document.getElementById('pause').hidden&&document.getElementById('control-guide').hidden")
key_event('Escape', repeat=True)
browser_assert('holding Escape does not toggle pause repeatedly', 'window.__world.paused')
click_at(*center('resume'))
c.wait_for('!window.__world.paused&&!!document.pointerLockElement', 10)
passed.append('real resume click restores exploration and pointer lock')
c.evaluate("window.dispatchEvent(new Event('blur'));true")
c.wait_for('window.__world.paused&&!document.pointerLockElement', 10)
browser_assert('focus loss pauses with an explanation and clears all input',
               "document.getElementById('pause-reason').textContent.includes('离开画面')&&window.__world.actions.size===0&&window.__world.pressedCodes.size===0")
c.evaluate("window.dispatchEvent(new Event('focus'));true")
browser_assert('returning focus does not automatically resume', 'window.__world.paused&&!document.pointerLockElement')
# Deliberate browser rejection exercises the real request/catch path, not a no-op lockMouse.
c.evaluate("document.getElementById('world').requestPointerLock=()=>Promise.reject(new DOMException('Test denial','NotAllowedError'));true")
click_at(*center('resume'))
c.wait_for("!window.__world.paused&&document.getElementById('look-guide').textContent==='左键拖动环视'", 10)
browser_assert('rejected pointer lock gives usable drag instructions', '!document.pointerLockElement')
for event in ({'type': 'mouseMoved', 'x': 550, 'y': 300},
              {'type': 'mousePressed', 'x': 550, 'y': 300, 'button': 'left', 'clickCount': 1},
              {'type': 'mouseMoved', 'x': 600, 'y': 320, 'button': 'left', 'buttons': 1}):
    c.call('Input.dispatchMouseEvent', event)
drag_yaw = c.evaluate('window.__world.yaw')
c.call('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': 640, 'y': 320, 'button': 'left', 'buttons': 1})
browser_assert('unlocked left drag changes the camera', f'window.__world.dragging&&window.__world.yaw!=={drag_yaw}')
c.evaluate("document.getElementById('world').dispatchEvent(new PointerEvent('pointercancel'));true")
browser_assert('cancelled pointer stops drag look', '!window.__world.dragging')
c.call('Input.dispatchMouseEvent', {'type': 'mouseReleased', 'x': 640, 'y': 320, 'button': 'left', 'clickCount': 1})
c.evaluate('window.__world.inputOrigin=window.__world.world.position(window.__world.player).clone();true')
key_event('ArrowUp')
c.wait_for('window.__world.world.position(window.__world.player).distanceTo(window.__world.inputOrigin)>.2', 5)
key_event('ArrowUp', 'keyUp')
passed.append('movement remains usable after pointer lock rejection')
# Deterministic target lifetime; this does not replace the real input checks above.
passed += json.loads(c.evaluate(r"""(()=>{
const g=window.__world,results=[],hint=document.getElementById('first-hint');
const check=(name,ok)=>{if(!ok)throw Error(name);results.push(name);};
g.pause();g.hints={possessed:false};g.target=g.world.byId.get('tree-first');g.paused=false;g.updateHints(0);
check('legal target explains R with its name',hint.classList.contains('visible')&&hint.textContent.includes('阔叶树'));
g.updateHints(10);check('first target instruction survives the old four-second timeout',hint.classList.contains('visible'));
g.target=null;g.updateHints(0);check('invalid target immediately clears first R instruction',!hint.classList.contains('visible')&&!hint.textContent);
g.target=g.world.byId.get('tree-first');g.updateHints(0);check('first instruction returns with a legal target',hint.classList.contains('visible'));
g.transition={from:g.player,to:{id:'missing-onboarding-target'}};g.finishTransition();
g.updateControlGuide();check('rollback transition hides target instruction',!hint.classList.contains('visible'));
g.finishTransition();
const from=g.player,to=g.target;g.transition={from,to};g.target=null;g.finishTransition();g.updateHints(0);
check('completed possession hides instruction until a new target is selected',!hint.classList.contains('visible'));
g.target=from;g.updateHints(0);check('next legal target shows instruction after successful possession',hint.classList.contains('visible')&&hint.textContent.includes('人'));
g.target=to;g.updateHints(0);check('switching target updates the instruction name',hint.textContent.includes('阔叶树'));
g.pause();check('pause hides target instruction',!hint.classList.contains('visible'));
g.resume(false);check('resume restores current target instruction',hint.classList.contains('visible'));
g.player=g.world.byId.get('gull-0');g.updateControlGuide();check('flying body shows concise vertical control',!document.getElementById('vertical-guide').hidden);
g.player=from;g.updateControlGuide();check('ground body hides vertical control',document.getElementById('vertical-guide').hidden);
g.pointerHintTime=0;g.updateControlGuide();check('compact guide stays visible without timed status',!document.getElementById('control-guide').hidden&&document.getElementById('control-status').hidden);
g.hints={r:true,possessed:true};g.save();g.hints={};g.restore();g.updateControlGuide();check('legacy completion flags do not suppress target instruction after restore',g.hints.possessed&&hint.classList.contains('visible'));
const human=g.world.byId.get('human-first'),home=human.home.clone(),homeRotation=[...human.homeRotation],homeBaseY=human.homeBaseY,save=JSON.parse(localStorage.getItem('between-all-things.save.v4'));
human.root.position.copy(home).add(home.clone().set(5,0,-3));human.root.rotation.y=homeRotation[1]+.3;human.baseY=homeBaseY+2;g.save();const moved=human.root.position.clone();
const patchedHome=home.clone().add(home.clone().set(10,0,0));human.home.copy(patchedHome);human.homeRotation[1]+=.5;human.homeBaseY+=4;
g.world.restore(JSON.parse(localStorage.getItem('between-all-things.save.v4')).entities,save.layout);
check('patch layout changes apply while preserving the player movement offset',human.root.position.distanceTo(moved.clone().add(home.clone().set(10,0,0)))<1e-6);
check('patch layout changes apply while preserving the player rotation offset',Math.abs(human.root.rotation.y-(homeRotation[1]+.8))<1e-6);
check('patch layout changes apply while preserving the player height offset',Math.abs(human.baseY-(homeBaseY+6))<1e-6);
check('save includes a baseline for later patch migrations',Array.isArray(save.layout)&&save.layout.some(record=>record.id==='human-first'));
human.home.copy(home);human.homeRotation=homeRotation;human.homeBaseY=homeBaseY;human.root.position.copy(moved);human.root.rotation.y=homeRotation[1]+.3;human.baseY=homeBaseY+2;
g.save();g.pause();return JSON.stringify(results);
})()"""))
# Continue a save with both old hint flags; do not clear this profile.
previous = c.evaluate('performance.timeOrigin')
c.call('Page.navigate', {'url': args.url + '?debug'})
c.wait_for(f'performance.timeOrigin!=={previous}&&!!window.__world&&!document.getElementById("enter").disabled', 90)
browser_assert('save with legacy hint flags still offers continue',
               "window.__world.hasSave&&window.__world.hints.possessed&&document.getElementById('enter-label').textContent==='继续漫游'")
click_at(*center('enter'))
# Software rendering can run far below real time after the asset scenes. Advance
# the normal camera transition deterministically; this is not a timing/FPS test.
c.evaluate('for(let i=0;i<60&&window.__world.transition;i++)window.__world.updateCamera(.05);window.__world.updateControlGuide();true')
browser_assert('continued save completes the normal opening camera transition', '!window.__world.transition')
browser_assert('continued save retains compact controls', "!document.getElementById('control-guide').hidden")
# Check geometry without screenshot exports, including the compactness requested by the creator.
for width, height in ((1280, 720), (1366, 768), (1920, 1080), (800, 600), (640, 600)):
    c.call('Emulation.setDeviceMetricsOverride', {'width': width, 'height': height, 'deviceScaleFactor': 1, 'mobile': False})
    browser_assert(f'compact HUD fits and avoids presence, R hint and response at {width}x{height}', r"""(()=>{
const g=document.getElementById('control-guide').getBoundingClientRect(),p=document.getElementById('presence').getBoundingClientRect(),h=document.getElementById('first-hint').getBoundingClientRect(),r=document.getElementById('response');
const old=r.textContent;r.textContent='世界仍在这里';const q=r.getBoundingClientRect();r.textContent=old;
const apart=(a,b)=>a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top;
return g.width<=300&&g.height<=130&&g.right<=innerWidth&&g.bottom<=innerHeight&&g.left>=0&&apart(g,p)&&apart(g,h)&&apart(g,q);
})()""")
    c.evaluate('window.__world.pause();true')
    browser_assert(f'pause menu remains within viewport at {width}x{height}', r"""(()=>{
const r=document.querySelector('.pause-card').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;
})()""")
    c.evaluate('window.__world.resume(false);true')
print('\n'.join('PASS ' + name for name in passed))
print(f'{len(passed)} browser checks passed (0.4 baseline). Not a substitute for QA-01..QA-47 playtests.')
