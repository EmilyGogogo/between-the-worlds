import * as THREE from 'three';

// Body motion felt through the eye (camera.firstPerson.motion), read from the body's own
// animation every frame, so it always keeps time with what the model is doing:
// - wingbeat (gull): how high the wing tip is above the body bone. The eye rises as the wings
//   beat down and is highest when they are lowest, with a slight nod; gliding only floats.
//   The eye is only ever lifted, never lowered (it must not dip into the ground).
// - tailbeat (fish): which way the head is swung from the spine. The eye shifts sideways and
//   turns a little with it, never up or down.
// Each call also reports a beat — a wing downstroke or a tail sweep — for the body's own sounds.

const STATE=new WeakMap(),a=new THREE.Vector3(),b=new THREE.Vector3();
export const NO_MOTION=Object.freeze({offset:new THREE.Vector3(),yaw:0,pitch:0,beat:null});

function bone(visual,name){
  const cache=visual.userData.motionBones||(visual.userData.motionBones={});
  if(!(name in cache)){let found=null;visual.traverse(o=>{if(!found&&o.isBone&&o.name===name)found=o;});cache[name]=found;}
  return cache[name];
}
function phaseOf(anim){
  const action=anim?.actions[anim.current],clip=action?.getClip();
  return clip&&clip.duration>0?(action.time%clip.duration)/clip.duration:0;
}

// e: the body; spec: SPECIES entry; state: {moving, boosting, climb (0…1 rising), dt, scale}.
export function bodyMotion(e,spec,{moving=false,boosting=false,climb=0,dt=0,scale=1}={}){
  const m=spec.firstPerson?.motion,visual=e.visual,anim=visual?.userData.animation;
  if(!m||!visual)return NO_MOTION;
  const st=STATE.get(e)||{lo:null,hi:null,prev:null,amp:1e-3,glide:0};STATE.set(e,st);
  const out={offset:new THREE.Vector3(),yaw:0,pitch:0,beat:null};
  e.root.updateMatrixWorld(true);
  if(m.source==='wingbeat'){
    const wing=bone(visual,m.wingBone),body=bone(visual,m.bodyBone);if(!wing||!body)return NO_MOTION;
    const y=e.root.worldToLocal(wing.getWorldPosition(a)).y-e.root.worldToLocal(body.getWorldPosition(b)).y;
    // The wing's range, learned from the clip as it plays and slowly forgotten.
    st.lo=st.lo==null?y:Math.min(y,st.lo+(y-st.lo)*Math.min(1,dt*.05));st.hi=st.hi==null?y:Math.max(y,st.hi+(y-st.hi)*Math.min(1,dt*.05));
    const up=st.hi-st.lo>.01?(y-st.lo)/(st.hi-st.lo):.5,flapping=anim?.current==='move',gain=1+m.climbGain*Math.max(0,climb)+(boosting?m.boostGain:0);
    if(flapping){out.offset.y=m.flapBobM*gain*(1-up);out.pitch=THREE.MathUtils.degToRad(m.flapPitchDeg)*gain*(up-.5)*2;}
    else{st.glide+=dt;out.offset.y=m.glideBobM*(.5+.5*Math.sin(st.glide*2*Math.PI/2));}
    // A downstroke ends when the wing passes into its lowest quarter.
    if(flapping&&st.prev!=null&&st.prev>=.25&&up<.25)out.beat='wing';
    st.prev=flapping?up:null;
  }else if(m.source==='tailbeat'){
    const head=bone(visual,m.headBone),spine=bone(visual,m.spineBone);if(!head||!spine)return NO_MOTION;
    const h=e.root.worldToLocal(head.getWorldPosition(a)),s=e.root.worldToLocal(spine.getWorldPosition(b));
    // Head yaw relative to the body's forward (−Z); its amplitude is learned as it swims.
    const angle=Math.atan2(h.x-s.x,-(h.z-s.z));st.amp=Math.max(Math.abs(angle),st.amp*(1-Math.min(1,dt*.3)),1e-3);
    const n=THREE.MathUtils.clamp(angle/st.amp,-1,1),gain=moving?(boosting?1+m.boostGain:1):m.idleGain;
    out.offset.x=m.swayM*gain*n;out.yaw=-THREE.MathUtils.degToRad(m.swayYawDeg)*gain*n;
    // One push of water per tail sweep, while swimming.
    if(moving&&st.prev!=null&&st.prev<0&&n>=0)out.beat='stroke';
    st.prev=n;
  }else return NO_MOTION;
  if(scale!==1){out.offset.multiplyScalar(scale);out.yaw*=scale;out.pitch*=scale;}
  if(scale<=0)out.offset.set(0,0,0);
  return out;
}
// For checks: the learned ranges of a body.
export function motionState(e){return STATE.get(e)||null;}
