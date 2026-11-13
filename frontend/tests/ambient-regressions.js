import { LAYOUT, SPECIES } from '../src/species.js';
import { AmbientMotion } from '../src/ambient.js';
import { InteractionSystem, EFFECTS } from '../src/interactions.js';

export function measureAmbientTravel(members,step,frames=300){
  const tracks=members.map(entity=>({entity,previous:entity.root.position.clone(),distance:0}));
  for(let frame=0;frame<frames;frame++){
    step(1);
    for(const track of tracks){
      const position=track.entity.root.position;
      track.distance+=position.distanceTo(track.previous);track.previous.copy(position);
    }
  }
  return tracks.map(({entity,distance})=>({id:entity.id,distance}));
}

// Longest time each body stands still on its route while `step` advances the game. Run over
// the longest route period, every route position is visited whatever the start time. Time
// under an interaction (a flee waits in place before returning, per data/interactions.json)
// belongs to that interaction, not to the route, and is not counted.
export function longestStops(members,step,frames,dt=1/30){
  const tracks=members.map(entity=>({entity,previous:entity.root.position.clone(),still:0,longest:0}));
  for(let frame=0;frame<frames;frame++){
    step(1);
    for(const track of tracks){
      const position=track.entity.root.position;
      track.still=!track.entity.flee&&position.distanceTo(track.previous)<1e-3?track.still+dt:0;track.longest=Math.max(track.longest,track.still);
      track.previous.copy(position);
    }
  }
  return tracks.map(({entity,longest})=>({id:entity.id,longest}));
}

// Save rules after the river-island replacement (D-035): the old sea archipelago's v4
// saves are not migrated; v5 saves continue only on the same layout ID. Inside that
// layout, retired bodies map through anchors.json savePlayerAliases. Exercises the real
// game's save reader and world restore, with its loaded GLBs and colliders.
export const SAVE_KEY='between-all-things.save.v5',OLD_SEA_SAVE_KEY='between-all-things.save.v4';
export function checkSaveMigration(g,assert){
  const W=g.world,original=W.serialize(),baseline=W.serializeLayout(),layoutId=LAYOUT.layoutId,start=LAYOUT.initialInstance;
  const aliases=Object.entries(LAYOUT.savePlayerAliases||{});
  const marker=original.find(e=>e.id==='grass-start'),x=marker.position[0]+20;
  const copy=value=>JSON.parse(JSON.stringify(value));
  const fresh=()=>{
    W.restore(original);g.player=W.byId.get(start);g.transition=null;g.shown=new Set();g.cameraMode='third_person';
    localStorage.removeItem(SAVE_KEY);localStorage.removeItem(OLD_SEA_SAVE_KEY);
  };
  // World progress that a correct restore must carry: the grass marker moved 20 m.
  const progress=()=>{const records=copy(original);records.find(e=>e.id===marker.id).position[0]=x;return records;};
  const current=(extra={})=>({version:5,layoutId,player:start,entities:progress(),layout:copy(baseline),yaw:.35,pitch:.27,hints:{},shown:['island:first_possess'],...extra});
  const untouched=()=>W.byId.get(marker.id).root.position.x===marker.position[0]&&g.player.id===start&&!g.shown.has('island:first_possess');
  const rejects=(name,store,payload)=>{
    fresh();localStorage.setItem(store,typeof payload==='string'?payload:JSON.stringify(payload));
    let ok=false;try{ok=g.restore()===false&&untouched();}catch{}
    assert(name,ok);
  };
  assert('the river-island layout has an ID for saves (D-035)',typeof layoutId==='string'&&layoutId.length>0);

  // 1. Old v4 sea-archipelago saves: not read, no old coordinates, a new journey still starts.
  const sea={version:4,player:'butterflyfish-0',entities:[...progress(),{id:'butterflyfish-0',kind:'butterflyfish',position:[210,-4,220]}],layout:copy(baseline),shown:['island:first_possess']};
  rejects('an old v4 sea-archipelago save is not read (D-035)',OLD_SEA_SAVE_KEY,sea);
  assert('ignoring the old save leaves no old coordinates on the starting body',g.player.root.position.toArray().every((v,i)=>v===original.find(e=>e.id===start).position[i]));
  rejects('a version 4 record under the current key is rejected (D-035)',SAVE_KEY,{...sea,layoutId});

  // 2. Missing data or a different layout: rejected safely, the river island stays clean.
  rejects('a save from another layout ID is rejected (D-035)',SAVE_KEY,current({layoutId:'sea_archipelago'}));
  rejects('a save without a layout ID is rejected (D-035)',SAVE_KEY,current({layoutId:undefined}));
  rejects('a save without its layout baseline is rejected (D-035)',SAVE_KEY,current({layout:undefined}));
  rejects('a save without entity records is rejected (D-035)',SAVE_KEY,current({entities:undefined}));
  rejects('an unreadable save is rejected without an exception',SAVE_KEY,'{"version":5,');

  // 3. A current v5 save continues with body, positions, view and world progress.
  fresh();
  const body=W.byId.get('dog-first'),moved=body.root.position.clone().add(body.root.position.clone().set(1.5,0,-2));
  body.root.position.copy(moved);W.byId.get(marker.id).root.position.x=x;g.player=body;g.yaw=1.1;g.pitch=.2;g.cameraMode='first_person';g.shown.add('island:first_possess');g.save();
  const written=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');
  assert('a save is written as version 5 with the river-island layout ID and baseline (D-035)',written?.version===5&&written.layoutId===layoutId&&Array.isArray(written.layout)&&written.layout.length===W.entities.length);
  W.restore(original);g.player=W.byId.get(start);g.cameraMode='third_person';g.yaw=0;g.shown=new Set();
  assert('a v5 river-island save continues with its body, positions, view and progress (W-04)',
    g.restore()&&g.player===body&&body.root.position.distanceTo(moved)<1e-6&&W.byId.get(marker.id).root.position.x===x&&g.cameraMode==='first_person'&&g.yaw===1.1&&g.shown.has('island:first_possess'));

  // 4. Replacement inside the same river-island layout, by the current alias rule.
  assert('save aliases map retired body IDs to bodies of this layout (D-035)',aliases.every(([oldId,newId])=>!W.byId.has(oldId)&&W.byId.has(newId)));
  const fixtures=[...aliases,['retired-unmapped-body',start],[start,start]];
  for(const [oldId,newId] of fixtures){
    fresh();
    const records=progress();if(!W.byId.has(oldId))records.push({id:oldId,kind:'retired',position:[210,-4,220]});
    localStorage.setItem(SAVE_KEY,JSON.stringify(current({player:oldId,entities:records})));
    assert(`within ${layoutId}, a save played as ${oldId} continues as ${newId} with world progress`,g.restore()&&g.player.id===newId&&W.byId.get(marker.id).root.position.x===x&&g.shown.has('island:first_possess'));
    if(oldId!==newId){
      const home=original.find(e=>e.id===newId).position,p=g.player.root.position;
      assert(`${newId} keeps its own river-island position, not retired coordinates`,p.toArray().every((v,i)=>Math.abs(v-home[i])<1e-6));
      const route=(LAYOUT.ambient||[]).find(gr=>gr.members.includes(newId));
      if(route?.vertical?.mode==='belowSurface'){
        const w=W.water(p.x,p.z);
        assert(`${newId} swims in its route's ${route.vertical.water} water, not old sea coordinates`,w?.id===route.vertical.water&&p.y>=w.floor-.01&&p.y<w.surface);
      }
    }
    g.save();const saved=JSON.parse(localStorage.getItem(SAVE_KEY));
    assert(`resaving ${oldId} keeps the replacement body and world progress`,saved.player===newId&&saved.entities.find(e=>e.id===marker.id).position[0]===x&&(W.byId.has(oldId)||!saved.entities.some(e=>e.id===oldId)));
  }
  // A patch in the same layout can move the surviving layout while retiring the played body.
  const [aliasOld,aliasNew]=aliases[0]||[];
  if(aliasOld){
    fresh();
    const records=progress(),layout=copy(baseline);layout.find(e=>e.id===marker.id).position[0]-=7;
    records.push({id:aliasOld,kind:'retired',position:[210,-4,220]});
    localStorage.setItem(SAVE_KEY,JSON.stringify(current({player:aliasOld,entities:records,layout})));
    assert('an alias in the same layout also applies patched layout offsets (W-04)',g.restore()&&g.player.id===aliasNew&&Math.abs(W.byId.get(marker.id).root.position.x-(x+7))<1e-6);
    g.save();W.restore(original);
    assert('resaving an alias with a layout patch does not apply the offset twice',g.restore()&&g.player.id===aliasNew&&Math.abs(W.byId.get(marker.id).root.position.x-(x+7))<1e-6);
  }
  fresh();
}

export function checkAmbientCollision(g,assert){
  const W=g.world,original=W.serialize();
  const reset=()=>{
    W.restore(original);W.time=0;g.player=W.byId.get(LAYOUT.initialInstance);g.transition=null;g.clearInput();
    for(const e of W.entities){e.flee=null;e.moving=false;}
    g.interactions=new InteractionSystem(g);W.ambient=new AmbientMotion(W,LAYOUT.ambient);g.collision.refresh();return W.ambient;
  };
  const tick=(A,dt=1/30,interactions=false)=>{
    W.time+=dt;g.collision.refresh();
    if(interactions){g.move(dt);g.collision.refresh();}
    A.update(dt,g.player);
    if(interactions)g.interactions.update(dt);
    g.collision.refresh();
  };
  // A second, played bird hovers on a route. Other route members must still see its collider.
  {
    const A=reset(),bird=W.byId.get('gull-0'),held=W.byId.get('gull-1');
    for(let k=0;k<120;k++)tick(A);
    const goal=A.goal(A.state.get(bird).group,0,W.time+1,bird);
    g.player=held;held.root.position.set(goal.x,goal.y,goal.z);g.collision.refresh();
    const position=held.root.position.clone(),blockers=()=>g.collision.records.filter(r=>r.entity===held);
    assert('route collision fixture starts with separate birds',!g.collision.collides(bird,W.position(bird),blockers()));
    let hit=false;
    for(let k=0;k<120;k++){tick(A);hit ||= g.collision.collides(bird,W.position(bird),blockers());}
    assert('autonomous gulls do not pass through a played gull (M-01)',!hit&&held.root.position.equals(position));
  }
  // A legal low-flight position whose straight return would cut through a rising slope.
  // Found on the current map (D-035 replaced the sea coordinates used before): dry ground,
  // and no env.forest trunk near the return, which this check is not about.
  {
    const A=reset(),bird=W.byId.get('gull-0'),group=A.state.get(bird).group;
    const T=2/30+(group.resumeAfterSec??4),ends=[A.goal(group,0,T+1/20,bird),A.goal(group,0,T+2,bird)];
    const clearOfTrunks=(x,z)=>!W.obstacles.some(o=>Math.hypot(o.x-x,o.z-z)<o.r+3);
    const along=(x,z,goal,f)=>[x+(goal.x-x)*f,z+(goal.z-z)*f];
    let fixture=null;
    for(let r=12;r<=120&&!fixture;r+=6)for(let k=0;k<32&&!fixture;k++){
      const x=ends[0].x+r*Math.cos(k/32*Math.PI*2),z=ends[0].z+r*Math.sin(k/32*Math.PI*2),y=W.height(x,z)+.3;
      if(W.water(x,z)||!ends.every(goal=>[0,.2,.4,.6,.8,1].every(f=>clearOfTrunks(...along(x,z,goal,f)))))continue;
      const cuts=[.1,.2,.3,.4,.5,.6].some(f=>{const [px,pz]=along(x,z,ends[0],f);return W.height(px,pz)>y+(ends[0].y-y)*f;});
      if(!cuts)continue;
      bird.root.position.set(x,y,z);g.collision.refreshEntity(bird);
      if(!g.collision.collides(bird,W.position(bird)))fixture=[x,y,z];
    }
    assert('the current map has a low-flight slope fixture clear of forest trunks',!!fixture);
    bird.root.position.set(...fixture);g.player=bird;tick(A);
    const start=bird.root.position.clone();g.player=W.byId.get(LAYOUT.initialInstance);tick(A);
    for(let k=0;k<60;k++)tick(A);
    assert('a released low-flying gull still rests before returning',bird.root.position.equals(start));
    W.time=A.state.get(bird).resumeAt;
    let clear=true;
    for(let k=0;k<40;k++){
      tick(A,1/20);const p=bird.root.position;
      clear &&= p.y>=W.height(p.x,p.z)+.29&&!g.collision.collides(bird,W.position(bird));
    }
    assert('a released gull returns over terrain at 20 FPS (M-01, M-04)',clear&&bird.root.position.distanceTo(start)>2);
  }
  // A gull flying under the canopy edge of tree-first wedged itself in on a flee turn, then
  // stayed there: every route step from an overlap was reverted (main CI, gull-1 overlaps).
  {
    const A=reset(),bird=W.byId.get('gull-1'),tree=W.byId.get('tree-first'),parent=bird.root.parent;
    const canopy=g.collision.records.filter(r=>r.entity===tree&&r.parent===parent).map(r=>r.frameBox).sort((a,b)=>b.max.y-a.max.y)[0];
    const hits=()=>{g.collision.refreshEntity(bird);return g.collision.collides(bird,W.position(bird));};
    const besideCanopy=heading=>{
      bird.heading=heading;bird.root.rotation.y=heading;bird.flee=null;
      bird.root.position.set(canopy.max.x,(canopy.min.y+canopy.max.y)/2,(canopy.min.z+canopy.max.z)/2);
      while(hits())bird.root.position.x+=.01;
    };
    let wedged=[];
    for(let k=0;k<8;k++){
      const heading=k*Math.PI/8;besideCanopy(heading);
      const home=bird.root.position.clone();
      bird.flee={dir:home.clone().set(-1,0,.15).normalize(),speed:6,until:Infinity,returnAt:Infinity,home};
      for(let i=0;i<20;i++){g.interactions.time+=1/30;EFFECTS.flee.update(g.interactions.context(1/30),bird);if(hits()){wedged.push(heading.toFixed(2));break;}}
    }
    bird.flee=null;
    assert('a bird fleeing against a canopy is never turned into it (M-01, X-02)',wedged.length===0,wedged.join());
    // Wedge it into the canopy face toward its route.
    bird.heading=0;bird.root.rotation.y=0;
    const centre=canopy.getCenter(bird.root.position.clone()),goal=A.goal(A.state.get(bird).group,0,W.time,bird);
    const axis=Math.abs(goal.x-centre.x)>Math.abs(goal.z-centre.z)?'x':'z',sign=Math.sign(goal[axis]-centre[axis])||1;
    bird.root.position.copy(centre);bird.root.position[axis]=sign>0?canopy.max[axis]:canopy.min[axis];
    while(hits())bird.root.position[axis]+=sign*.01;
    bird.root.position[axis]-=sign*.1;
    assert('overlap fixture starts inside the canopy edge',hits());
    tick(A);
    assert('an unplayed bird left in an overlap is moved clear (M-06)',!hits());
    let again=false;for(let k=0;k<60;k++){tick(A);again ||= hits();}
    assert('the recovered bird does not fall back into the overlap',!again);
  }
  // Keep scatter/return interactions enabled: they must not mask collisions on rejoining.
  {
    const A=reset(),fish=W.byId.get('silverfish-0'),human=g.player;
    for(let k=0;k<120;k++)tick(A);
    const goal=A.goal(A.state.get(fish).group,0,W.time+1,fish),water=W.water(goal.x,goal.z);
    human.root.position.set(goal.x,water.surface-SPECIES[human.kind].height*.7,goal.z);g.collision.refresh();
    const blockers=()=>g.collision.records.filter(r=>r.entity===human);
    assert('fish collision fixture starts outside the swimming human',!g.collision.collides(fish,W.position(fish),blockers()));
    let hit=false,inWater=true;
    for(let k=0;k<900;k++){
      tick(A,1/30,true);hit ||= g.collision.collides(fish,W.position(fish),blockers());
      const p=fish.root.position,w=W.water(p.x,p.z);inWater &&= w?.id==='lake'&&p.y>=w.floor&&p.y+SPECIES[fish.kind].height<=w.surface;
    }
    assert('fish returning from scatter cannot swim through the player (M-01, X-02)',!hit&&inWater);
  }
  reset();
}
