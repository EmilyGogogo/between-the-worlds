import * as THREE from 'three';
import { SPECIES, LAYOUT } from '../src/species.js';
import { AmbientMotion } from '../src/ambient.js';

// Exercise the real controller and camera for every body kind and nested carrier.
export function checkPossessionMovement(g,assert){
  const W=g.world,snapshot=W.serialize(),player=g.player,yaw=g.yaw,pitch=g.pitch,mode=g.cameraMode;
  const original={allowed:g.allowed,collisionMove:g.collision.move,unstick:g.unstick,moveBody:g.moveBody};
  const angle=a=>Math.atan2(Math.sin(a),Math.cos(a)),up=new THREE.Vector3(0,1,0);
  const flat=v=>{v.y=0;return v.normalize();};
  const view=()=>flat(g.camera.getWorldDirection(new THREE.Vector3()));
  const cases=Object.keys(SPECIES).map(kind=>W.entities.find(e=>e.kind===kind));
  const carriers=['grass-boulder-0','palm-boulder-0','rock-boulder-0','grass-island-1-0','palm-island-1-0','boulder-island-1','island-1'].map(id=>W.byId.get(id));
  g.cameraMode='third_person';g.allowed=()=>true;g.unstick=()=>{};
  // Stay away from the river banks while testing island steering, not boundary sliding.
  g.moveBody=(e,delta,dt,keepHeading)=>original.moveBody.call(g,e,SPECIES[e.kind].mode==='island'?delta.multiplyScalar(.02):delta,dt,keepHeading);
  // Remove obstacles only: keep real body movement, surface clamps, island drift and camera.
  g.collision.move=(e,delta)=>{e.root.position.add(delta.applyQuaternion(e.root.parent.getWorldQuaternion(new THREE.Quaternion()).invert()));return W.position(e);};
  try{
    for(const e of cases.concat(carriers))for(const offset of [0,Math.PI/2,-Math.PI/2,Math.PI])for(const [action,relative] of [
      ['move_forward',0],['move_left',Math.PI/2],['move_right',-Math.PI/2],['move_back',Math.PI],
    ]){
      W.restore(snapshot);g.clearInput();g.player=e;g.yaw=.7;g.pitch=.3;
      const s=SPECIES[e.kind],inverse=e.root.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
      const localForward=new THREE.Vector3(-Math.sin(g.yaw),0,-Math.cos(g.yaw)).applyQuaternion(inverse);
      e.heading=Math.atan2(-localForward.x,-localForward.z)+offset;
      if(s.mode!=='island')e.root.rotation.y=e.heading;
      g.collision.refresh();g.snapCamera=true;g.updateCamera(0);
      const expected=view().applyAxisAngle(up,relative).applyQuaternion(inverse);expected.y=0;expected.normalize();
      expected.applyQuaternion(inverse.clone().invert());flat(expected);
      const start=W.position(e).clone(),label=`${e.id} offset ${Math.round(offset*180/Math.PI)} ${action}`;
      g.actions.add(action);let bounded=true;
      for(let i=0;i<90;i++){
        const heading=e.heading,oldYaw=g.yaw;g.move(1/60);g.updateCamera(1/60);
        bounded&&=Math.abs(angle(e.heading-heading))<=s.turnSpeed*Math.PI/180/60+1e-7&&Math.abs(angle(g.yaw-oldYaw))<=s.turnSpeed*Math.PI/180/60+1e-7;
      }
      const delta=W.position(e).sub(start),distance=Math.hypot(delta.x,delta.z),direction=flat(delta);
      assert(`${label}: bounded turn, then requested travel`,bounded&&distance>.01&&direction.dot(expected)>.999,`${distance}, dot ${direction.dot(expected)}`);
      assert(`${label}: displayed camera follows travel`,view().dot(direction)>.995);
      const settled=g.yaw;for(let i=0;i<12;i++){g.move(1/60);g.updateCamera(1/60);}
      assert(`${label}: held key never adds another turn`,Math.abs(angle(g.yaw-settled))<1e-7);
      g.clearInput();const position=e.root.position.clone(),heading=e.heading;
      for(let i=0;i<12;i++){W.time+=1/60;W.ambient.update(1/60,e);g.move(1/60);g.updateCamera(1/60);}
      assert(`${label}: releasing input leaves the possessed body still`,e.root.position.equals(position)&&e.heading===heading);
    }
    // Repress W while a mouse orbit is still being smoothed: use what is displayed.
    for(const e of cases){
      W.restore(snapshot);g.clearInput();g.player=e;g.yaw=.7;g.snapCamera=true;g.updateCamera(0);
      g.yaw+=.9;g.updateCamera(1/60);const displayed=view();
      const inverse=e.root.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
      const expected=displayed.clone().applyQuaternion(inverse);expected.y=0;expected.normalize();
      expected.applyQuaternion(inverse.clone().invert());flat(expected);
      g.actions.add('move_forward');g.move(0);
      const actual=new THREE.Vector3(0,0,-1).applyAxisAngle(up,g.movementInput.targetHeading).applyQuaternion(inverse.clone().invert());
      assert(`${e.id}: fresh W uses the displayed view during mouse smoothing`,flat(actual).dot(expected)>.999999);
    }
    // Route ownership applies to every routed species and both hand-over endpoints.
    const A=new AmbientMotion(W,LAYOUT.ambient);
    for(const e of A.state.keys()){
      const start=e.root.position.clone(),heading=e.heading;
      for(let i=0;i<5;i++)A.update(1/30,e);
      assert(`${e.id}: possession suspends the old route`,e.root.position.equals(start)&&e.heading===heading);
      A.update(1/30,player,[player,e]);
      assert(`${e.id}: entering body stays off its old route`,e.root.position.equals(start)&&e.heading===heading);
    }
  }finally{
    W.restore(snapshot);g.player=player;g.yaw=yaw;g.pitch=pitch;g.cameraMode=mode;g.clearInput();
    g.allowed=original.allowed;g.collision.move=original.collisionMove;g.unstick=original.unstick;g.moveBody=original.moveBody;
    g.collision.refresh();g.snapCamera=true;g.updateCamera(0);
  }
}
