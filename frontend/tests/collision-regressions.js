import * as THREE from 'three';
import { SPECIES } from '../src/species.js';

// A rock stopped against a scenery trunk turns sideways: re-fitting its axis-aligned box
// grows the box into the trunk. It must still be able to leave, without sinking deeper
// or passing through the trunk (M-02, M-06).
export function checkTrunkTurnEscape(g,assert){
  const W=g.world,C=g.collision,snapshot=W.serialize(),player=g.player,mode=g.cameraMode,yaw=g.yaw,pitch=g.pitch;
  const rock=W.entities.find(e=>e.kind==='rock'&&e.root.parent===W.islandRoot&&SPECIES[e.kind].height<=W.obstacleBodyHeight);
  const point=o=>new THREE.Vector3(o.x,W.height(o.x,o.z),o.z);
  // An isolated trunk on dry land, away from other trunks and solid bodies.
  C.refresh();
  const trunk=W.obstacles.filter(o=>o.r>.2&&o.r<.6).sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z)).find(o=>
    W.height(o.x,o.z+6)>.5&&W.obstacles.every(p=>p===o||Math.hypot(p.x-o.x,p.z-o.z)>9)&&
    C.blockers(rock).every(r=>r.box.distanceToPoint(W.islandRoot.localToWorld(point(o)))>9));
  assert('trunk escape fixture finds an isolated scenery trunk',Boolean(rock&&trunk));
  const distance=()=>Math.hypot(rock.root.position.x-trunk.x,rock.root.position.z-trunk.z);
  const depth=()=>C.penetration(rock,W.position(rock,new THREE.Vector3()));
  const drive=(action,frames,each=()=>{})=>{g.clearInput();g.actions.add(action);const start=W.position(rock).clone();
    for(let i=0;i<frames;i++){g.move(1/60);C.refresh();g.updateCamera(1/60);each();}
    g.clearInput();return W.position(rock).distanceTo(start);};
  try{
    g.player=rock;g.cameraMode='third_person';g.pitch=.3;
    rock.root.position.copy(point({x:trunk.x,z:trunk.z+6}));rock.heading=0;rock.root.rotation.y=0;g.yaw=0;
    C.refresh();g.snapCamera=true;g.updateCamera(0);
    drive('move_forward',240);
    const stop=distance();
    assert('rock driven into a trunk stops against it without overlapping',stop>trunk.r&&stop<4&&!C.collides(rock,W.position(rock)),`distance ${stop.toFixed(2)}`);
    // Turning to go around grows the re-fitted box into the trunk.
    // Turning alone may deepen the overlap; each movement step must not.
    let deeper=0,closest=Infinity;const move=C.move;
    C.move=(e,delta)=>{const before=e===rock?depth():0,result=move.call(C,e,delta);if(e===rock&&before>0)deeper=Math.max(deeper,depth()-before);return result;};
    let moved;try{moved=drive('move_left',240,()=>{closest=Math.min(closest,distance());});}finally{C.move=move;}
    assert('rock turned sideways at a trunk can still leave',moved>1&&!C.collides(rock,W.position(rock)),`moved ${moved.toFixed(2)}`);
    assert('leaving a trunk never sinks the rock deeper or closer',deeper<=1e-6&&closest>=stop-.05,`deeper ${deeper.toFixed(4)}, closest ${closest.toFixed(2)} of ${stop.toFixed(2)}`);
    // Overlapping already, pushing toward the trunk does not pass through it.
    rock.root.position.copy(point({x:trunk.x,z:trunk.z+stop}));rock.heading=Math.PI/4;rock.root.rotation.y=rock.heading;C.refresh();
    const before=depth(),startDistance=distance();
    assert('trunk escape fixture starts overlapping after a turn',before>0,before.toFixed(3));
    C.move(rock,new THREE.Vector3(0,0,-1).applyQuaternion(rock.root.parent.getWorldQuaternion(new THREE.Quaternion())));
    assert('an overlapping rock cannot push further into the trunk',depth()<=before+1e-6&&distance()>=startDistance-.05,`${before.toFixed(3)} -> ${depth().toFixed(3)}`);
    // Recovery pushes the body out of a scenery trunk, not only out of other bodies (M-06).
    rock.root.position.copy(point({x:trunk.x,z:trunk.z+stop}));rock.heading=Math.PI/4;rock.root.rotation.y=rock.heading;C.refresh();
    C.repair(rock);
    assert('stuck recovery pushes a rock out of a scenery trunk',!C.collides(rock,W.position(rock)));
  }finally{
    W.restore(snapshot);g.clearInput();g.player=player;g.cameraMode=mode;g.yaw=yaw;g.pitch=pitch;
    C.refresh();g.snapCamera=true;g.updateCamera(0);
  }
}

// Every body kind (islands drift instead) stopped against a scenery trunk or a solid box,
// then turned by the third-person keys or the first-person view, can move away at once:
// no step sinks deeper and no stuck recovery is needed (M-02, M-06).
export function checkTurnEscapeAllKinds(g,assert){
  const W=g.world,C=g.collision,snapshot=W.serialize(),player=g.player,mode=g.cameraMode,yaw=g.yaw,pitch=g.pitch,obstacles=W.obstacles,move=C.move,repair=C.repair;
  const depth=e=>C.penetration(e,W.position(e,new THREE.Vector3()));
  let repairs=0,deeper=0,subject=null;
  C.repair=function(e){repairs++;return repair.call(C,e);};
  C.move=(e,delta)=>{const before=e===subject?depth(e):0,result=move.call(C,e,delta);if(e===subject&&before>0)deeper=Math.max(deeper,depth(e)-before);return result;};
  const tick=frames=>{for(let i=0;i<frames;i++){g.move(1/60);g.updateCamera(1/60);}};
  try{
    for(const kind of Object.keys(SPECIES).filter(k=>SPECIES[k].mode!=='island')){
      const s=SPECIES[kind],e=W.entities.find(x=>x.kind===kind&&x.root.parent===W.islandRoot)||W.entities.find(x=>x.kind===kind),parent=e.root.parent;
      const trunks=parent===W.islandRoot&&s.stage<=1&&s.height<=W.obstacleBodyHeight;
      for(const obstacle of trunks?['trunk','box']:['box']){
        W.restore(snapshot);C.refresh();W.obstacles=[];C.grid=null;subject=e;
        const local=C.localBoxes(e).reduce((all,b)=>all.union(b),new THREE.Box3()),half=Math.max(local.max.x,-local.min.x,local.max.z,-local.min.z);
        const p=e.root.position,size=obstacle==='trunk'?.4:Math.max(.6,half*.5),reach=half+size+3,front=new THREE.Vector3(p.x,p.y,p.z-reach);
        // Only the test obstacle blocks, straight ahead along the carrier's -z.
        C.records=C.records.filter(r=>C.related(e,r.entity));
        if(obstacle==='trunk')W.obstacles=[{x:front.x,z:front.z,r:size,top:p.y+1000}];
        else{const box=new THREE.Box3(new THREE.Vector3(front.x-size,p.y-50,front.z-size),new THREE.Vector3(front.x+size,p.y+s.height+50,front.z+size));
          C.records.push({entity:W.entities.find(x=>x!==e&&!C.related(e,x)),parent,frameBox:box,box:box.clone().applyMatrix4(parent.matrixWorld)});}
        const forward=new THREE.Vector3(0,0,-1).applyQuaternion(parent.getWorldQuaternion(new THREE.Quaternion()));
        const reset=state=>{if(state){p.copy(state.p);e.heading=state.heading;}else e.heading=0;e.root.rotation.y=e.heading;e.root.updateWorldMatrix(true,true);
          g.player=e;g.transition=null;g.cameraMode='third_person';g.clearInput();g.yaw=Math.atan2(-forward.x,-forward.z);g.pitch=0;g.snapCamera=true;g.updateCamera(0);g.stuck={time:0,anchor:null};repairs=0;deeper=0;};
        reset();g.actions.add('move_forward');tick(Math.ceil(3/s.speed*90)+60);
        const state={p:p.clone(),heading:e.heading},gap=Math.hypot(p.x-front.x,p.z-front.z);
        assert(`${kind} stops against a ${obstacle}`,gap>size&&gap<reach-.05,gap.toFixed(2));
        for(const [view,action,turn] of [['third_person','move_left',0],['first_person','move_back',Math.PI/4]]){
          reset(state);g.cameraMode=view;if(turn){g.yaw+=turn;tick(60);}
          const start=p.clone();g.actions.add(action);tick(90);const moved=Math.hypot(p.x-start.x,p.z-start.z);
          assert(`${kind} turned at a ${obstacle} (${view} ${action}) leaves without recovery`,moved>Math.min(1,s.speed*.5)&&!repairs&&deeper<=1e-6,`moved ${moved.toFixed(2)}, repairs ${repairs}, deeper ${deeper.toFixed(4)}`);
        }
      }
    }
  }finally{
    C.move=move;C.repair=repair;W.obstacles=obstacles;C.grid=null;subject=null;
    W.restore(snapshot);g.clearInput();g.player=player;g.cameraMode=mode;g.yaw=yaw;g.pitch=pitch;
    C.refresh();g.snapCamera=true;g.updateCamera(0);
  }
}

// D-036: plants and animals that cannot swim stay out of the water; rocks wade up to their
// wadeDepth and stand on the bed there, never hovering at the water level (M-04).
export function checkWading(g,assert){
  const W=g.world,C=g.collision,snapshot=W.serialize(),player=g.player,mode=g.cameraMode,yaw=g.yaw,pitch=g.pitch;
  const walkers=Object.keys(SPECIES).filter(k=>SPECIES[k].mode==='ground'&&SPECIES[k].category!=='human');
  assert('D-036: plants and non-swimming animals may not enter water',walkers.filter(k=>!['rock'].includes(SPECIES[k].category)).every(k=>SPECIES[k].wadeDepth===0),
    walkers.map(k=>k+' '+SPECIES[k].wadeDepth).join(', '));
  const startWet=W.entities.filter(e=>walkers.includes(e.kind)&&e.root.parent===W.islandRoot&&e.surfaceOffset!=null&&W.waterDepth(e.root.position.x,e.root.position.z)>SPECIES[e.kind].wadeDepth);
  assert('no ground body starts in water deeper than it may wade',startWet.length===0,startWet.map(e=>e.id).join(', '));
  // Fixtures: shallow water with dry ground 3 m away, and water deeper than 0.6 m whose bed is above -0.6 m.
  let shallow=null,dry=null,deep=null;
  for(let x=-560;x<=590&&!(shallow&&deep);x+=2)for(let z=-330;z<=330&&!(shallow&&deep);z+=2){
    const d=W.waterDepth(x,z);
    if(!shallow&&d>.25&&d<.45&&W.height(x,z)<-.15){
      for(let a=0;a<16&&!dry;a++){const q={x:x+Math.cos(a*.3927)*3,z:z+Math.sin(a*.3927)*3};if(W.waterDepth(q.x,q.z)===0)dry=q;}
      if(dry)shallow={x,z};
    }
    if(!deep&&d>.7&&d<1.2&&W.height(x,z)>=-.6)deep={x,z};
  }
  assert('wading fixture finds shallow water beside dry ground, and deeper water',Boolean(shallow&&dry&&deep),JSON.stringify({shallow,dry,deep}));
  if(!shallow||!dry||!deep)return;
  const body=kind=>W.entities.find(b=>b.kind===kind&&b.root.parent===W.islandRoot&&b.surfaceOffset!=null);
  const drive=(e,from,to,frames)=>{
    W.restore(snapshot);g.clearInput();g.player=e;g.cameraMode='third_person';
    e.root.position.set(from.x,W.height(from.x,from.z),from.z);
    g.yaw=Math.atan2(-(to.x-from.x),-(to.z-from.z));g.pitch=.3;e.heading=g.yaw;e.root.rotation.y=g.yaw;
    C.refresh();g.snapCamera=true;g.updateCamera(0);g.actions.add('move_forward');
    for(let i=0;i<frames;i++){g.move(1/60);C.refresh();g.updateCamera(1/60);}
    g.clearInput();return e.root.position;
  };
  try{
    for(const kind of walkers){
      const e=body(kind),s=SPECIES[kind];
      if(!e)continue;   // no free-standing body of this kind on the island (the boulder is a carrier)
      const shallowDepth=W.waterDepth(shallow.x,shallow.z),deepDepth=W.waterDepth(deep.x,deep.z);
      W.restore(snapshot);e.root.position.set(dry.x,W.height(dry.x,dry.z),dry.z);
      assert(`${kind} ${shallowDepth<=s.wadeDepth?'may':'may not'} step from the bank into ${shallowDepth.toFixed(2)} m of water (wade ${s.wadeDepth} m)`,g.allowed(e,s,shallow.x,shallow.z)===(shallowDepth<=s.wadeDepth));
      e.root.position.set(shallow.x,W.height(shallow.x,shallow.z),shallow.z);
      if(s.wadeDepth>=shallowDepth)assert(`${kind} ${deepDepth<=s.wadeDepth?'may':'may not'} go on into ${deepDepth.toFixed(2)} m of water (wade ${s.wadeDepth} m)`,g.allowed(e,s,deep.x,deep.z)===(deepDepth<=s.wadeDepth));
      // Already deeper than allowed (an old save, a spawn point): it may wade back, never further in.
      if(deepDepth>s.wadeDepth){
        W.restore(snapshot);e.root.position.set(deep.x,W.height(deep.x,deep.z),deep.z);
        let deeper=null,shallower=null;
        for(let a=0;a<32;a++)for(const r of [1,2,3]){const x=deep.x+Math.cos(a*.19635)*r,z=deep.z+Math.sin(a*.19635)*r,d=W.waterDepth(x,z);
          if(!deeper&&d>deepDepth+.05)deeper={x,z};if(!shallower&&d<deepDepth-.05)shallower={x,z};}
        if(deeper)assert(`${kind} standing in ${deepDepth.toFixed(2)} m of water may not go deeper`,!g.allowed(e,s,deeper.x,deeper.z));
        if(shallower)assert(`${kind} standing in ${deepDepth.toFixed(2)} m of water may wade back toward the bank`,g.allowed(e,s,shallower.x,shallower.z));
        assert(`${kind} deep-water fixture finds deeper and shallower neighbours`,Boolean(deeper&&shallower));
      }
      // Walking from the bank toward the water: it stops at the shore, or wades on the bed.
      const far={x:dry.x+(shallow.x-dry.x)*4,z:dry.z+(shallow.z-dry.z)*4},p=drive(e,dry,far,150);
      const depth=W.waterDepth(p.x,p.z),bed=W.height(p.x,p.z);
      assert(`${kind} walked toward the water stays within ${s.wadeDepth} m and stands on the ground`,depth<=s.wadeDepth+1e-6&&Math.abs(p.y-bed)<.02,
        `depth ${depth.toFixed(2)} y ${p.y.toFixed(3)} bed ${bed.toFixed(3)} moved ${Math.hypot(p.x-dry.x,p.z-dry.z).toFixed(2)} m`);
    }
  }finally{
    W.restore(snapshot);g.clearInput();g.player=player;g.cameraMode=mode;g.yaw=yaw;g.pitch=pitch;
    C.refresh();g.snapCamera=true;g.updateCamera(0);
  }
}

// Shore reefs use hand-fitted boxes: their union must match the fitted model (no invisible wall
// above a 0.95 m reef), and the stacked boxes leave the low side of the reef open above it.
export function checkReefCollisionFitsModel(g,assert){
  const reefs=g.world.entities.filter(e=>e.kind==='rock'&&e.visual?.userData.external&&e.visual.userData.collisionBoxes?.length);
  assert('reef collision fixture finds externally modelled reefs',reefs.length>0,reefs.length);
  const misfit=[];
  for(const reef of reefs){
    const model=reef.visual.userData.localBounds,boxes=g.collision.localBoxes(reef);
    const all=boxes.reduce((u,b)=>u.union(b),new THREE.Box3());
    const off=Math.max(Math.abs(all.max.y-model.max.y),Math.abs(all.min.x-model.min.x),Math.abs(all.max.x-model.max.x),Math.abs(all.min.z-model.min.z),Math.abs(all.max.z-model.max.z));
    if(off>.03||boxes.some(b=>b.max.y>model.max.y+.03))misfit.push(`${reef.id} off ${off.toFixed(2)} m, top ${all.max.y.toFixed(2)} vs model ${model.max.y.toFixed(2)}`);
    // tidal-reef v001 only rises above 0.6 m on its +X/-Z side; the opposite corner stays open.
    if(/tidal-reef-v001/.test(reef.visual.userData.variant)){
      const open=new THREE.Vector3(model.min.x+.3,model.max.y*.8,model.max.z-.3);
      if(boxes.some(b=>b.containsPoint(open)))misfit.push(`${reef.id} blocks the open low corner`);
    }
  }
  assert('reef collision boxes fit the visible reef model (M-01)',misfit.length===0,misfit.slice(0,3).join('; '));
}
