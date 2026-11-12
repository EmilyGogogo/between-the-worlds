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
