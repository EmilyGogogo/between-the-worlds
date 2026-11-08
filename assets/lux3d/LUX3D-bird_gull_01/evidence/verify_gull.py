"""Focused in-game verification of the gull GLB slot, with screenshots.

python3 verify_gull.py <repo_root> <evidence_dir>
Loads the game once (slow polling works around the local Chrome 156 stall), drives it through ?debug.
"""
import json, socket, subprocess, sys, tempfile, time, base64
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(sys.argv[1]).resolve(); OUT = Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(ROOT / 'frontend/tests'))
from cdp import CDP

def fp():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0)); return s.getsockname()[1]
http, dbg = fp(), fp(); url = f'http://127.0.0.1:{http}/'
srv = subprocess.Popen([sys.executable, str(ROOT / 'frontend/serve.py'), '--port', str(http)], cwd=ROOT,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
ch = subprocess.Popen(['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '--headless=new', '--no-first-run',
                       '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1600,900',
                       '--remote-debugging-address=127.0.0.1', f'--remote-debugging-port={dbg}',
                       f'--user-data-dir={tempfile.mkdtemp()}', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

PRELUDE = r"""
const g=window.__world,W=g.world,{SPECIES,TUNING}=await import('./src/species.js'),results=[];
const assert=(name,ok,detail='')=>{results.push({name,ok:!!ok,detail:String(detail)});};
const step=(n,dt=1/30)=>{for(let i=0;i<n;i++){g.elapsed+=dt;g.collision.refresh();if(!g.transition){g.move(dt);g.collision.refresh();}g.updateCamera(dt);if(!g.transition)g.selectTarget(dt);const paused=g.paused;g.paused=false;g.updateHints(dt);g.paused=paused;W.update(dt,g.player,g.target,g.targetInfo?.point,1);g.interactions.update(dt);}};
const seek=id=>{for(const pitch of [.06,.16,.27,.4,.52,.8,1.1,-.2,-.4]){g.pitch=pitch;for(let i=0;i<48;i++){g.yaw=i/48*6.283;step(5);if(g.target?.id===id)return true;}}return false;};
const take=id=>{g.player=W.byId.get(id);g.transition=null;g.collision.refresh();step(5);};
const render=()=>{g.renderer.render(g.scene,g.camera);};
"""

def run(c, body):
    return json.loads(c.evaluate('(async()=>{' + PRELUDE + body + '\nreturn JSON.stringify(results);})()'))

def shot(c, name):
    data = c.call('Page.captureScreenshot', {'format': 'jpeg', 'quality': 88})['data']
    (OUT / name).write_bytes(base64.b64decode(data))

try:
    for _ in range(150):
        try:
            urlopen(f'http://127.0.0.1:{dbg}/json/version', timeout=1); urlopen(url, timeout=1); break
        except OSError:
            time.sleep(.2)
    c = CDP(dbg)
    for m in ['Runtime.enable', 'Page.enable']:
        c.call(m)
    c.call('Emulation.setDeviceMetricsOverride', {'width': 1600, 'height': 900, 'deviceScaleFactor': 1, 'mobile': False})
    t0 = time.monotonic()
    c.call('Page.navigate', {'url': url + '?debug'})
    ready = False
    while time.monotonic() - t0 < 180 and not ready:
        time.sleep(8)
        try:
            ready = c.evaluate('!!window.__world&&!document.getElementById("enter").disabled')
        except Exception:
            ready = False
    load_s = round(time.monotonic() - t0, 1)
    if not ready:
        raise SystemExit(f'game not ready after {load_s}s')
    results = run(c, r"""
g.lockMouse=()=>{};g.start();g.paused=true;step(90);
const gulls=W.entities.filter(e=>e.kind==='gull');
assert('gull GLB template loaded (L-04)',W.assets.hasModel('gull'));
assert('every gull individual uses the GLB, none the placeholder',gulls.length>0&&gulls.every(e=>e.visual?.userData.external&&String(e.visual.userData.variant).endsWith('bird_gull_01-v001.glb')),gulls.length+' gulls');
const size=gulls[0].visual.userData.localBounds.getSize(new gulls[0].root.position.constructor());
assert('model scaled to body height 0.65 m (C-03)',Math.abs(size.y-.65)<.02,'size '+[size.x,size.y,size.z].map(v=>v.toFixed(3)).join(' x '));
const anim=gulls[0].visual.userData.animation;
assert('idle and move roles map to Glide and Flap clips',anim&&anim.actions.idle?.getClip().name==='Glide'&&anim.actions.move?.getClip().name==='Flap',anim&&Object.entries(anim.actions).map(([k,a])=>k+'='+a.getClip().name).join(','));
const boxes=g.collision.localBoxes(gulls[0]);
assert('collision box follows the model bounds (auto_bounds)',boxes.length===1&&Math.abs(boxes[0].getSize(size.clone()).x-size.x)<.01,'box '+boxes.map(b=>{const s=b.getSize(size.clone());return [s.x,s.y,s.z].map(v=>v.toFixed(2)).join('x');}).join(';'));
take('gull-0');const bird=g.player;g.pitch=0;g.yaw=0;step(40);
assert('a still gull plays the idle role',bird.visual.userData.animation.current==='idle',bird.visual.userData.animation.current);
g.actions.add('move_forward');step(20);
assert('a moving gull switches to the move role',bird.visual.userData.animation.current==='move',bird.visual.userData.animation.current);
const y0=bird.root.position.y;g.pitch=-.4;step(60);
assert('gull climbs when looking up (I-02)',bird.root.position.y-y0>5,(bird.root.position.y-y0).toFixed(1));
g.pitch=-1.2;step(900);const ceiling=TUNING.flightCeilingM?.value??180;
assert('gull stays under the flight ceiling (M-04)',bird.root.position.y<=ceiling+.01,bird.root.position.y.toFixed(1));
g.actions.delete('move_forward');step(40);
assert('stopping returns the gull to idle',bird.visual.userData.animation.current==='idle',bird.visual.userData.animation.current);
const bp=bird.root.position;bp.y=W.height(bp.x,bp.z)+90;step(5);
assert('a high gull with the new model can still select the island below (P-15)',seek('island-main'));
g.possess();step(100);
assert('high gull -> island possession works',g.player.id==='island-main',g.player.id);
take('human-first');const h=g.player,target=W.byId.get('gull-1')||gulls[1];
target.root.position.set(h.root.position.x+5,h.root.position.y+2.2,h.root.position.z);step(2);
const found=seek(target.id);
assert('a human can target a gull with the new model (P-01)',found,target.id);
if(found){g.possess();step(100);}
assert('human -> gull possession works',g.player.id===target.id,g.player.id);
""")
    # Screenshots: real renders through the game camera.
    c.evaluate("window.__world.paused=false;document.querySelectorAll('#pause,.pause,#menu').forEach(e=>e.hidden=true);true")
    poses = [
        ('01-gull-glide-idle.jpg', "take('gull-2');const p=g.player.root.position;p.y=W.height(p.x,p.z)+12;g.pitch=.12;g.yaw=2.3;step(60);"),
        ('02-gull-flap-move.jpg', "take('gull-2');g.actions.add('move_forward');g.pitch=.05;g.yaw=1.2;step(45);g.actions.delete('move_forward');"),
        ('03-human-targets-gull.jpg', "take('human-first');const h=g.player,t=W.byId.get('gull-3');t.root.position.set(h.root.position.x+4,h.root.position.y+2.4,h.root.position.z+1);step(2);seek('gull-3');step(10);"),
        ('04-gull-high-over-island.jpg', "take('gull-4');const p=g.player.root.position;p.y=W.height(p.x,p.z)+110;g.pitch=.55;g.yaw=.6;step(60);"),
    ]
    for name, body in poses:
        run(c, "g.lockMouse=()=>{};g.paused=true;" + body + "render();")
        time.sleep(1.5)
        shot(c, name)
    report = {'load_seconds': load_s, 'checks': results, 'screenshots': [p[0] for p in poses]}
    (OUT / 'verify-result.json').write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding='utf-8')
    for r in results:
        print('PASS' if r['ok'] else 'FAIL', r['name'], '|', r['detail'])
finally:
    ch.terminate(); srv.terminate()
