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
g.lockMouse=()=>{};g.start();g.paused=true;step(30);
const A=W.ambient,by=id=>W.byId.get(id),kind=k=>W.entities.filter(e=>e.kind===k);
const gulls=kind('gull'),hatch=kind('silverfish'),disc=kind('discus');
assert('counts: 4 gulls, 12 silver hatchetfish, 6 discus',gulls.length===4&&hatch.length===12&&disc.length===6,[gulls.length,hatch.length,disc.length].join('/'));
assert('all three species use their GLB',[...gulls,...hatch,...disc].every(e=>e.visual?.userData.external),[...new Set([...gulls,...hatch,...disc].map(e=>String(e.visual.userData.variant).split('/').pop()))].join(','));
assert('every gull and fish is driven by an ambient route',[...gulls,...hatch,...disc].every(e=>A.has(e)));
const start=new Map([...gulls,...hatch,...disc].map(e=>[e,e.root.position.clone()]));
step(300);
const still=[...start].filter(([e,p])=>e.root.position.distanceTo(p)<1).map(([e])=>e.id);
assert('after 10 s every unplayed gull and fish has moved',still.length===0,still.join(','));
let fishOut=[],gullLow=[],gullHit=[],cohesion=0,minLift0=1e9,lowAt=null,flapSeen=false,glideSeen=false;
for(let k=0;k<60;k++){step(30);
  for(const f of [...hatch,...disc]){const p=f.root.position,w=W.water(p.x,p.z);if(!w||w.id!=='lake'||p.y<w.floor-.01||p.y+SPECIES[f.kind].height>w.surface+.01)fishOut.push(f.id+'@'+k);}
  const c=hatch.reduce((m,f)=>m.add(f.root.position),new hatch[0].root.position.constructor()).multiplyScalar(1/hatch.length);
  cohesion=Math.max(cohesion,...hatch.map(f=>f.root.position.distanceTo(c)));
  g.collision.refresh();
  for(const b of gulls){const p=b.root.position,lift=p.y-W.height(p.x,p.z);if(lift<1.5&&!(W.water(p.x,p.z)))gullLow.push(b.id+'@'+k);
    if(g.collision.collides(b,W.position(b)))gullHit.push(b.id+'@'+k);if(b.moving)flapSeen=true;else glideSeen=true;}
  const p0=by('gull-0').root.position,l0=p0.y-W.height(p0.x,p0.z);if(l0<minLift0){minLift0=l0;lowAt=W.time;}
}
assert('fish stay inside the lake water for 60 s (M-04)',fishOut.length===0,fishOut.slice(0,5).join(','));
assert('the 12 hatchetfish stay together as one school',cohesion<6,'max distance to centre '+cohesion.toFixed(2)+' m');
assert('gulls never sink below 1.5 m over land',gullLow.length===0,gullLow.slice(0,5).join(','));
assert('gulls do not overlap solid bodies (M-01)',gullHit.length===0,gullHit.slice(0,5).join(','));
assert('gulls both flap (climbing) and glide',flapSeen&&glideSeen);
assert('gull-0 dips low on its loop',minLift0<4,minLift0.toFixed(2)+' m');
// Wait for gull-0's low pass, then aim from the human start.
take('human-first');let found=false;
for(let k=0;k<120&&!found;k++){step(10);const p=by('gull-0').root.position;if(p.y-W.height(p.x,p.z)<4.5){A.paused=true;found=seek('gull-0');A.paused=false;}}
assert('during its low pass, the human at the start can select gull-0 (G-07)',found);
if(found){g.possess();step(100);}
assert('R: human -> moving gull-0',g.player.id==='gull-0',g.player.id);
const held=by('gull-0').root.position.clone();step(60);
assert('the gull the player is in is not moved by its route',by('gull-0').root.position.distanceTo(held)<.01);
take('human-first');const left=by('gull-0').root.position.clone();step(60);
const rest=by('gull-0').root.position.distanceTo(left);step(180);
assert('a released gull rests about 4 s, then rejoins its route',rest<.01&&by('gull-0').root.position.distanceTo(left)>2,'rest '+rest.toFixed(3)+' then '+by('gull-0').root.position.distanceTo(left).toFixed(1));
take('silverfish-5');const sp=by('silverfish-5').root.position.clone();step(60);
assert('a played hatchetfish leaves the school motion to the player',by('silverfish-5').root.position.distanceTo(sp)<.01);
""")
    # Screenshots: real renders through the game camera.
    c.evaluate("window.__world.paused=false;document.querySelectorAll('#pause,.pause,#menu').forEach(e=>e.hidden=true);true")
    poses = [
        ('01-gull-low-pass-from-start.jpg', "take('human-first');const t=W.byId.get('gull-0');let k=0;while(k++<200){step(5);const p=t.root.position;if(p.y-W.height(p.x,p.z)<4)break;}g.yaw=.39;g.pitch=.06;step(2);"),
        ('02-gull-flying-high.jpg', "take('gull-1');W.ambient.paused=true;const p=g.player.root.position;p.y=W.height(p.x,p.z)+28;g.pitch=.3;g.yaw=1.4;step(40);g.actions.add('move_forward');step(10);g.actions.delete('move_forward');W.ambient.paused=false;"),
        ('03-hatchetfish-school.jpg', "take('silverfish-0');g.pitch=.05;g.yaw=0;step(30);let best=0;for(let i=0;i<24;i++){g.yaw=i/24*6.283;step(2);}g.yaw=Math.atan2(-(W.byId.get('silverfish-6').root.position.x-g.player.root.position.x),-(W.byId.get('silverfish-6').root.position.z-g.player.root.position.z));step(8);"),
        ('05-gull-size-next-to-human.jpg', "take('human-first');W.ambient.paused=true;const h=g.player.root.position,t=W.byId.get('gull-0');t.root.position.set(h.x-3.5,h.y+1.6,h.z-7);t.heading=1.2;t.root.rotation.y=1.2;g.yaw=.35;g.pitch=.06;step(20);"),
        ('06-gull-third-person.jpg', "W.ambient.paused=false;take('gull-2');const p=g.player.root.position;p.y=W.height(p.x,p.z)+14;g.pitch=.12;g.yaw=2.0;step(40);"),
        ('04-discus.jpg', "take('discus-4');const o=W.byId.get('discus-1');g.pitch=.1;step(10);g.yaw=Math.atan2(-(o.root.position.x-g.player.root.position.x),-(o.root.position.z-g.player.root.position.z));step(10);"),
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
