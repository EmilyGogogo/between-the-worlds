import * as THREE from 'three';
import { AssetLibrary } from './assets.js';
import { World, terrainHeight, PLANET_RADIUS, loadTerrainField } from './world.js';
import { Atmosphere } from './sky.js';
import { SPECIES,SCALE_TIERS,TUNING,LAYOUT,CAMERA_MODES,loadRuntimeConfig,actionForCode,canEmbody,layerOf } from './species.js';
import { InteractionSystem } from './interactions.js';
import { WorldCollision } from './collision.js';
import { Ambience } from './audio.js';

const $=id=>document.getElementById(id);
// River-island save (D-027); saves from the sea archipelago or earlier prototypes are
// ignored, since their positions belong to another terrain (W-04).
const STORAGE='between-all-things.save.v5';
const SAVE_VERSION=5;
const SOUND='between-all-things.sound';
const UP=new THREE.Vector3(0,1,0);
const v1=new THREE.Vector3(),v2=new THREE.Vector3(),v3=new THREE.Vector3();
const smooth=t=>t*t*(3-2*t);
const lerp=THREE.MathUtils.lerp,clamp=THREE.MathUtils.clamp;
const tune=(key,fallback)=>TUNING[key]?.value??fallback;
// Pitch at which flying and swimming bodies hold their height (I-02).
const LEVEL_PITCH=.3;
let game;

function viewOf(kind,mode='third_person'){const s=SPECIES[kind],first=mode==='first_person';return {...(first?s.vision:CAMERA_MODES.third_person.vision),fov:first?s.fov:CAMERA_MODES.third_person.fovDeg,hearing:s.hearing,tintAmount:first&&s.vision.tint?1:0};}
function blendView(a,b,f){
  const out={hearing:{}};
  for(const key of ['grayscale','saturation','contrast','brightness','fogMultiplier','fov'])out[key]=lerp(a[key],b[key],f);
  for(const key of Object.keys(b.hearing))out.hearing[key]=typeof b.hearing[key]==='number'?lerp(a.hearing[key],b.hearing[key],f):(f<.5?a.hearing[key]:b.hearing[key]);
  out.tint=b.tint||a.tint;out.tintAmount=(a.tint?1-f:0)+(b.tint?f:0);
  return out;
}

class Game {
  constructor(renderer,assets){
    this.renderer=renderer;this.assets=assets;this.scene=new THREE.Scene();
    this.scene.fog=new THREE.FogExp2('#bac9b5',.004);
    this.camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.025,400000);
    this.camera.position.set(25,14,55);this.camera.lookAt(-5,6,-15);
    this.hemi=new THREE.HemisphereLight('#dfe8d9','#75804e',1.8);this.scene.add(this.hemi);
    this.sun=new THREE.DirectionalLight('#fff0d0',2.5);this.sun.position.set(-60,110,35);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-70,right:70,top:70,bottom:-70,near:.5,far:450});this.sun.shadow.normalBias=.08;this.sun.shadow.bias=-.0002;this.scene.add(this.sun,this.sun.target);
    // Day, night, seasons and rain (D-028) light the world and its water.
    this.atmosphere=new Atmosphere(this.scene,{sun:this.sun,hemi:this.hemi,renderer});
    this.world=new World(this.scene,assets,this.atmosphere);this.collision=new WorldCollision(this.world);this.world.prune(this.collision);this.world.collision=this.collision;this.world.moveBody=(entity,delta,dt,keepHeading=false)=>this.moveBody(entity,delta,dt,keepHeading);this.interactions=new InteractionSystem(this);
    this.player=this.world.byId.get(LAYOUT.initialInstance);this.target=null;this.candidate=null;this.candidateTime=0;this.targetInfo=null;
    this.actions=new Set();this.pressedCodes=new Set();this.yaw=.35;this.pitch=.27;this.zoom=1;
    this.started=false;this.paused=false;this.needsRender=true;this.transition=null;this.dragging=false;this.clock=new THREE.Clock();this.elapsed=0;this.saveElapsed=0;this.cameraMode=CAMERA_MODES.default;this.cameraBodyTurn=0;this.movementInput=null;
    this.hints={};this.pointerHintTime=0;this.lastResponse=-90;this.responseTimer=0;this.shown=new Set();this.pendingMoment=null;
    this.stuck={time:0,anchor:null};this.audio=new Ambience();this.filter='';
    this.hasSave=this.restore();this.view=viewOf(this.player.kind,this.cameraMode);
    this.focusGoal=new THREE.Vector3();this.introFocus=new THREE.Vector3(-5,6,-15);
    if(this.hasSave)this.updatePresence();
    this.bind();this.resize();this.loop();
  }
  bind(){
    window.addEventListener('resize',()=>this.resize());
    $('enter').addEventListener('click',()=>this.start());$('resume').addEventListener('click',()=>this.resume());
    $('pause-button').addEventListener('click',()=>{if(this.paused)this.resume();else this.pause();});
    // A fresh start must not be re-saved by the pagehide handler (W-04).
    $('new-journey').addEventListener('click',()=>{this.resetting=true;try{localStorage.removeItem(STORAGE);}catch{}location.reload();});
    for(const id of ['sound','pause-sound'])$(id).addEventListener('click',()=>this.setSound(!this.audio.enabled));
    // Keys come from data/input-map.json; Space, Ctrl and E are deliberately unbound (I-02, I-03).
    window.addEventListener('keydown',event=>{
      if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code))event.preventDefault();
      const action=actionForCode(event.code);
      if(action==='pause'){if(this.started&&!event.repeat){if(this.paused)this.resume(false);else this.pause();}return;}
      if(!this.started||this.paused||!action)return;
      // Ignore transition inputs completely: a held repeat must not move the new body.
      if(this.transition||event.repeat)return;
      if(action==='toggle_view'){this.toggleView();return;}
      this.pressedCodes.add(event.code);this.actions.add(action);
      if(action==='possess')this.possess();
    });
    window.addEventListener('keyup',event=>{const action=actionForCode(event.code);this.pressedCodes.delete(event.code);if(action&&![...this.pressedCodes].some(code=>actionForCode(code)===action)){this.actions.delete(action);if(action.startsWith('move_'))this.movementInput=null;}});
    window.addEventListener('blur',()=>{this.clearInput();if(this.started&&!this.paused)this.pause('离开画面，已为你暂停');});
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.started)this.pause('离开画面，已为你暂停');});
    const canvas=this.renderer.domElement;
    canvas.addEventListener('click',()=>{if(this.started&&!this.paused)this.lockMouse();});
    canvas.addEventListener('pointerdown',e=>{if(e.button===0&&this.started&&!this.paused&&!document.pointerLockElement){this.dragging=true;canvas.setPointerCapture?.(e.pointerId);}});
    canvas.addEventListener('pointerup',()=>{this.dragging=false;});
    for(const type of ['pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>{this.dragging=false;});
    document.addEventListener('pointerlockchange',()=>{
      const locked=document.pointerLockElement===canvas,lost=this.wasLocked&&!locked;this.wasLocked=locked;
      this.dragging=false;if(locked)this.pointerHintTime=tune('pointerHintSec',6);
      if(lost&&this.started&&!this.paused)this.pause();
      this.updateControlGuide();
    });
    document.addEventListener('pointerlockerror',()=>this.updateControlGuide());
    document.addEventListener('mousemove',e=>{
      if(!this.started||this.paused||(document.pointerLockElement!==canvas&&!this.dragging))return;
      const sensitivity=tune('mouseSensitivityRadPerPixel',.0025);
      const turn=-e.movementX*sensitivity;this.yaw+=turn;if(this.movementInput)this.movementInput.yaw+=turn;
      this.pitch=clamp(this.pitch+e.movementY*sensitivity*.8,this.pitchMin(),this.pitchMax());
    });
    canvas.addEventListener('wheel',e=>{if(!this.started||this.paused||this.cameraMode==='first_person')return;e.preventDefault();this.zoom=clamp(this.zoom+e.deltaY*.0006,.85,1.5);},{passive:false});
    window.addEventListener('pagehide',()=>this.save());
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.pause();$('loading-notice').hidden=false;$('loading-notice').textContent='画面暂时停留，正在等待恢复。';});
    canvas.addEventListener('webglcontextrestored',()=>location.reload());
  }
  // Sound starts with the first click into the world and can be toggled any time,
  // including from the pause menu while the pointer is released (A-02).
  soundPreference(){try{return localStorage.getItem(SOUND)!=='off';}catch{return true;}}
  async setSound(on){
    try{on=await this.audio.setEnabled(on);}catch(e){console.warn('Audio unavailable',e);on=false;}
    for(const id of ['sound','pause-sound']){$(id).setAttribute('aria-pressed',String(on));$(id).setAttribute('aria-label',on?'关闭环境声':'开启环境声');}
    $('pause-sound').textContent=on?'开':'关';
    try{localStorage.setItem(SOUND,on?'on':'off');}catch{}
  }
  lockMouse(){
    if(document.pointerLockElement||!this.renderer.domElement.requestPointerLock)return;
    try{const result=this.renderer.domElement.requestPointerLock();result?.catch?.(()=>this.updateControlGuide());}catch{this.updateControlGuide();}
  }
  start(){
    this.started=true;document.body.classList.add('playing');$('welcome').setAttribute('aria-hidden','true');$('enter').tabIndex=-1;$('presence').hidden=false;$('pause-button').hidden=false;this.updatePresence();
    this.transition={opening:true,from:this.player,to:this.player,start:this.camera.position.clone(),startFocus:this.introFocus.clone(),elapsed:0,duration:tune('possessionDurationSec',2.4)};
    this.focusGoal.copy(this.world.focus(this.player));this.setSound(this.soundPreference());this.renderer.domElement.focus();this.lockMouse();this.updateControlGuide();this.save();
  }
  clearInput(){this.actions.clear();this.pressedCodes.clear();this.dragging=false;this.movementInput=null;this.cameraBodyTurn=0;}
  pause(reason='停留片刻'){
    if(!this.started||this.paused)return;this.paused=true;this.needsRender=true;this.clearInput();this.save();$('pause-reason').textContent=reason;$('pause').hidden=false;document.body.classList.add('paused');this.updateControlGuide();document.exitPointerLock?.();$('resume').focus();
  }
  resume(lock=true){
    this.paused=false;this.clearInput();$('pause').hidden=true;document.body.classList.remove('paused');this.renderer.domElement.focus();if(lock)this.lockMouse();this.updateControlGuide();
  }
  resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);this.needsRender=true;}
  updateControlGuide(){
    const active=this.started&&!this.paused,locked=document.pointerLockElement===this.renderer.domElement;
    const target=active&&!this.transition?this.target:null;
    const state=[active,locked,this.transition?.opening?2:this.transition?1:0,this.pointerHintTime>0,this.player.kind,this.cameraMode,target?.id].join('|');
    // Keep stable hints out of the render loop's DOM/aria-live updates.
    if(state===this.controlGuideState)return;this.controlGuideState=state;
    $('control-guide').hidden=!active;
    $('look-guide').textContent=locked?'鼠标环视':'左键拖动环视';
    $('movement-label').textContent='移动'; $('pause-movement-label').textContent='前 / 后 / 左 / 右';
    $('view-label').textContent=this.cameraMode==='first_person'?'第一人称':'第三人称';
    $('move-guide').classList.toggle('unavailable',Boolean(this.transition));
    $('possess-guide').classList.toggle('unavailable',Boolean(this.transition));
    $('vertical-guide').hidden=SPECIES[this.player.kind].verticalControl!=='view_direction';
    const status=this.transition?(this.transition.opening?'镜头到位后即可移动':'正在成为另一种存在…'):locked&&this.pointerHintTime>0?'指针已隐藏 · Esc 显示鼠标':'';
    $('control-status').hidden=!status;$('control-status').textContent=status;
    const hint=$('first-hint');
    hint.classList.toggle('visible',Boolean(target));
    if(target&&hint.dataset.target!==target.id){
      const key=document.createElement('kbd');key.textContent='R';hint.replaceChildren(key,document.createTextNode(`成为${SPECIES[target.kind].name}`));hint.dataset.target=target.id;
    }else if(!target){hint.replaceChildren();delete hint.dataset.target;}
  }
  updatePresence(){const s=SPECIES[this.player.kind];$('body-name').textContent=s.name;$('body-place').textContent=s.place;}
  pitchMin(){return this.cameraMode==='first_person'?-1.35:SPECIES[this.player.kind].verticalControl==='view_direction'?-.45:.06;}
  pitchMax(){return this.cameraMode==='first_person'?1.35:1.16;}
  toggleView(){if(!this.started||this.paused||this.transition)return false;const first=this.cameraMode!=='first_person';this.cameraMode=first?'first_person':'third_person';this.pitch=clamp(first?(this.pitch-LEVEL_PITCH)*1.6:this.pitch/1.6+LEVEL_PITCH,this.pitchMin(),this.pitchMax());this.zoom=1;this.target=null;this.candidate=null;this.targetInfo=null;this.clearInput();this.snapCamera=true;this.updateControlGuide();this.save();return true;}
  // Looking up while moving forward rises, looking down dives (I-02).
  climb(){return -Math.sin(this.cameraMode==='first_person'?this.pitch:(this.pitch-LEVEL_PITCH)*1.6);}

  // --- Possession: re-validate on R, commit only when the camera arrives (P-06～P-08).
  possess(){
    if(this.transition||!this.target)return false;
    const target=this.target;this.collision.refresh();this.updateLift();
    if(!this.evaluate(target,this.camera.position,this.camera.getWorldDirection(v2))){this.target=null;this.candidate=null;return false;}
    const minPitch=layerOf(target.kind).possessMinPitch;if(minPitch!=null)this.pitch=Math.max(this.pitch,minPitch);
    this.transition={from:this.player,to:target,start:this.camera.position.clone(),startFocus:this.focusGoal.clone(),elapsed:0,duration:tune('possessionDurationSec',2.4)};
    this.player.moving=false;this.target=null;this.candidate=null;this.zoom=1;this.clearInput();
    document.body.classList.add('transitioning');this.updateControlGuide();this.audio.chime();return true;
  }
  finishTransition(){
    const tr=this.transition;this.transition=null;document.body.classList.remove('transitioning');this.clearInput();
    if(tr.opening)return;
    if(!this.world.byId.has(tr.to.id)){
      // The target vanished: glide back to the body we never left.
      this.transition={opening:true,from:tr.from,to:tr.from,start:this.camera.position.clone(),startFocus:this.focusGoal.clone(),elapsed:0,duration:tune('rollbackDurationSec',.8)};return;
    }
    this.player=tr.to;this.collision.refresh();this.collision.repair(this.player);
    this.pitch=clamp(this.pitch,this.pitchMin(),this.pitchMax());this.stuck={time:0,anchor:null};
    const moment=SPECIES[this.player.kind].moments?.first_possess,key=this.player.kind+':first_possess';
    this.pendingMoment=moment&&!this.shown.has(key)?{key,text:moment,kind:this.player.kind}:null;
    this.interactions.onPossess(this.player);this.updatePresence();this.save();
  }
  isCarrier(e){for(let parent=this.player.root.parent;parent;parent=parent.parent)if(parent===e.root)return true;return false;}
  // Recompute from the current view, including when R is pressed (D-017).
  islandPoint(eye,direction){
    const island=this.world.byId.get(LAYOUT.mainIsland);
    if(!canEmbody(this.player,island,this.liftRank())||!this.isCarrier(island))return null;
    const point=this.groundUnderView(eye,direction);
    if(!point||this.collision.obscures(eye,point,this.player,island,true))return null;
    return point;
  }
  // Land under the view ray of the main island, or null when looking at sky or sea.
  groundUnderView(eye,dir){
    const root=this.world.islandRoot,origin=root.worldToLocal(eye.clone()),d=dir.clone().applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()).invert());
    const sea=this.world.seaLevel;
    for(let t=.5;t<700;t+=Math.max(.5,t*.04)){
      const x=origin.x+d.x*t,y=origin.y+d.y*t,z=origin.z+d.z*t,h=this.world.height(x,z);
      if(y<h)return h>sea-.2?root.localToWorld(new THREE.Vector3(x,h,z)):null;
      if(y<sea)return null;
    }
    return null;
  }
  evaluate(e,eye,direction){
    const p=this.player;if(!canEmbody(p,e,this.liftRank()))return null;
    const s=SPECIES[p.kind],o=SPECIES[e.kind],carrier=this.isCarrier(e);
    if(carrier){
      // A carrying whole is chosen by where one looks on it, not by its centre.
      if(e.root===this.world.islandRoot){const point=this.islandPoint(eye,direction);return point?{entity:e,angle:0,distance:0,carrier,point}:null;}
      const hit=e.visual&&new THREE.Raycaster(eye,direction).intersectObject(e.visual,true)[0];
      if(!hit||this.collision.obscures(eye,hit.point,p,e,true))return null;
      return {entity:e,angle:0,distance:0,carrier,point:hit.point.clone()};
    }
    // Things one carries (the boulder on the island one is) count as recognisable parts.
    let own=false;for(let q=e.root.parent;q;q=q.parent)if(q===p.root){own=true;break;}
    const here=this.world.position(p,v1),distance=here.distanceTo(this.world.position(e,v3));
    const surface=Math.max(0,distance-o.radius*.8);
    if(surface>s.reach||(!own&&distance<s.radius*.14))return null;
    const point=this.world.focus(e,new THREE.Vector3());
    if(o.stage>s.stage&&o.mode==='ground'){
      // A blade of grass recognises the nearby trunk, not an unseen crown centre.
      const base=this.world.position(e,new THREE.Vector3()),along=Math.max(0,point.clone().sub(eye).dot(direction));
      point.y=clamp(eye.y+direction.y*along,base.y+Math.min(o.height*.12,.7),base.y+o.height*.9);
    }
    const to=point.clone().sub(eye),len=to.length();if(len<1e-6)return null;
    const angle=Math.acos(clamp(to.normalize().dot(direction),-1,1)),angular=Math.atan2(o.radius,len);
    if(angle>Math.min(.9,(o.stage<s.stage?.29:.16)+angular))return null;
    if(2*angular<tune('targetMinAngularSizeRad',.008))return null;   // too small to recognise
    if(this.world.occludes(eye,point,Math.max(o.radius,o.height*.35))||this.collision.obscures(eye,point,p,e))return null;
    return {entity:e,angle,distance:surface,carrier:false,own,point:null};
  }
  // Narrow, never add up (P-04): the angle group around the best aim, minus any carrying
  // whole that has a carried candidate in that group, then distance, scale, id.
  rankCandidates(list){
    if(!list.length)return list;
    const angleTol=THREE.MathUtils.degToRad(tune('angleTieToleranceDeg',1.5)),distanceTol=tune('distanceTieToleranceM',.15);
    // Carried bodies need a clearly closer aim than outside ones (P-04, P-13).
    const bias=tune('ownBodyAngleBiasRad',.15),aim=c=>c.angle+(c.own?bias:0),best=Math.min(...list.map(aim));
    let group=list.filter(c=>aim(c)<=best+angleTol);
    const carries=(whole,part)=>{for(let q=part.root.parent;q;q=q.parent)if(q===whole.root)return true;return false;};
    group=group.filter(c=>!c.carrier||!group.some(o=>o!==c&&carries(c.entity,o.entity)));
    const near=Math.min(...group.map(c=>c.distance));
    return group.filter(c=>c.distance<=near+distanceTol).sort((a,b)=>
      SPECIES[a.entity.kind].stage-SPECIES[b.entity.kind].stage||(a.entity.id<b.entity.id?-1:1));
  }
  // Height of the eye above the ground or water straight below (P-15).
  eyeHeight(e){
    const s=SPECIES[e.kind];if(e.root.parent!==this.world.islandRoot)return s.height;
    const p=e.root.position,w=this.world.water(p.x,p.z);
    return p.y+s.height-Math.max(this.world.height(p.x,p.z),w?w.surface:-Infinity);
  }
  // A high viewpoint lifts the reach to the tier whose eye height it attains; a lift
  // already held is kept down to threshold × (1 − hysteresis) so ripples do not flicker.
  updateLift(){
    const e=this.player,own=SPECIES[e.kind].tier,held=this.lift?.id===e.id?this.lift.rank:own;
    const eye=this.eyeHeight(e),keep=1-tune('viewLiftHysteresis',.1);let rank=own;
    for(const t of SCALE_TIERS)if(t.liftEyeHeightM!=null&&t.rank>rank&&eye>=t.liftEyeHeightM*(t.rank<=held?keep:1))rank=t.rank;
    this.lift={id:e.id,rank};return rank;
  }
  liftRank(){return this.lift?.id===this.player.id?this.lift.rank:SPECIES[this.player.kind].tier;}
  selectTarget(dt){
    const eye=this.camera.position,direction=this.camera.getWorldDirection(v2);this.updateLift();
    const list=[];for(const e of this.world.entities){const c=this.evaluate(e,eye,direction);if(c)list.push(c);}
    let best=this.rankCandidates(list)[0]||null;
    if(best&&this.candidate&&best.entity!==this.candidate){
      const previous=list.find(c=>c.entity===this.candidate);
      if(previous&&previous.carrier===best.carrier&&Boolean(previous.own)===Boolean(best.own)&&Math.abs(previous.angle-best.angle)<=THREE.MathUtils.degToRad(tune('angleTieToleranceDeg',1.5)))best=previous;
    }
    const next=best?.entity||null;
    if(next!==this.candidate){this.candidate=next;this.candidateTime=0;}else this.candidateTime+=dt;
    // Ripple after a short settle; an illegal target clears immediately (P-05, P-11).
    this.target=next&&(next===this.target||this.candidateTime>=tune('targetStableSec',.12))?next:null;
    this.targetInfo=this.target?best:null;
  }

  // --- Movement: activity areas first, then solid collision (M-01～M-08).
  groundHeight(e){
    const p=e.root.position,s=SPECIES[e.kind];
    if(e.root.parent===this.world.islandRoot){
      // A body placed at a fixed height (the sunken boulder) keeps its offset from the terrain.
      if(e.surfaceOffset==null)return e.groundOffset+terrainHeight(p.x,p.z);
      // Ground bodies that wade (plants, rocks, the dog) stand on the bed, never on the water.
      return this.world.height(p.x,p.z);
    }
    const carrier=this.world.carrierOf(e);
    return carrier?this.world.surfaceOf(carrier,p.x,p.z):e.baseY;
  }
  allowed(e,s,x,z){
    const p=e.root.position;
    if(e.root.parent!==this.world.islandRoot){
      const carrier=this.world.carrierOf(e),d=carrier&&!carrier.visual?.userData.external&&SPECIES[carrier.kind].surface;
      if(d?.type!=='dome')return true;
      const ratio=(a,b)=>(a/d.radii[0])**2+(b/d.radii[2])**2;return ratio(x,z)<=.8||ratio(x,z)<ratio(p.x,p.z);
    }
    if(s.mode==='swim'){
      const deep=w=>w&&w.surface-w.floor>s.height*1.2;
      return deep(this.world.water(x,z))||!deep(this.world.water(p.x,p.z));
    }
    if(s.mode==='fly'){const air=LAYOUT.regions[s.activityRegion],d=r=>Math.hypot(r[0]-air.center[0],r[1]-air.center[1]);return d([x,z])<=air.radius||d([x,z])<d([p.x,p.z]);}
    if(s.category==='human')return true;
    // wadeDepth is a water depth (M-04): ground bodies stay where the water is at most that deep.
    const limit=s.wadeDepth;
    return this.world.waterDepth(x,z)<=limit||this.world.waterDepth(p.x,p.z)>limit;
  }
  move(dt){
    const e=this.player,s=SPECIES[e.kind],a=this.actions;
    const x=Number(a.has('move_right'))-Number(a.has('move_left')),z=Number(a.has('move_back'))-Number(a.has('move_forward'));
    const first=this.cameraMode==='first_person';
    const parentQ=e.root.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    if(first||!(x||z))this.movementInput=null;
    else if(!this.movementInput||this.movementInput.x!==x||this.movementInput.z!==z){
      const view=this.camera.getWorldDirection(new THREE.Vector3()),screenYaw=Math.atan2(-view.x,-view.z);
      const screenDir=new THREE.Vector3(x,0,z).normalize().applyAxisAngle(UP,screenYaw).applyQuaternion(parentQ);
      const targetHeading=Math.atan2(-screenDir.x,-screenDir.z);
      // Project onto the carrier's surface before choosing the final camera yaw.
      const worldDir=new THREE.Vector3(0,0,-1).applyAxisAngle(UP,targetHeading).applyQuaternion(parentQ.clone().invert());
      const targetYaw=Math.atan2(-worldDir.x,-worldDir.z);
      const cameraTurn=Math.atan2(Math.sin(targetYaw-this.yaw),Math.cos(targetYaw-this.yaw));
      this.movementInput={x,z,yaw:this.yaw,cameraTurn,targetHeading};
    }
    const dir=first?new THREE.Vector3(x,0,z):new THREE.Vector3();
    if(first&&dir.lengthSq())dir.normalize().applyAxisAngle(UP,this.yaw);
    if(s.verticalControl==='view_direction'&&z)dir.y=-z*this.climb();
    if(dir.lengthSq()>1)dir.normalize();
    e.moving=first?dir.lengthSq()>0:Boolean(this.movementInput);e.boosting=e.moving&&a.has('boost');
    const speed=s.speed*(a.has('boost')?s.boost:1),before=e.root.position.clone();
    let local,alignment=1;
    if(first){
      local=dir.applyQuaternion(parentQ).multiplyScalar(speed*dt);
      const facing=new THREE.Vector3(0,0,-1).applyAxisAngle(UP,this.yaw).applyQuaternion(parentQ);
      this.faceDirection(e,facing,dt);
    }else if(this.movementInput){
      const delta=Math.atan2(Math.sin(this.movementInput.targetHeading-e.heading),Math.cos(this.movementInput.targetHeading-e.heading));
      const step=THREE.MathUtils.degToRad(s.turnSpeed)*dt;
      e.heading+=THREE.MathUtils.clamp(delta,-step,step);
      if(s.mode!=='island')e.root.rotation.y=e.heading;
      alignment=Math.abs(delta)<=step?1:0;
      local=new THREE.Vector3(0,0,-1).applyAxisAngle(UP,e.heading).multiplyScalar(speed*dt);
      if(s.verticalControl==='view_direction'&&z)local.y=-z*this.climb()*speed*dt;
      if(CAMERA_MODES.third_person.followBodyTurn){
        // Body alignment may start from an unrelated ambient-route heading.
        // Turn the camera only toward the requested direction, at the same speed limit.
        const desiredYaw=this.movementInput.yaw+this.movementInput.cameraTurn;
        const remaining=Math.atan2(Math.sin(desiredYaw-this.yaw),Math.cos(desiredYaw-this.yaw));
        const turn=THREE.MathUtils.clamp(remaining,-step,step);
        this.yaw+=turn;this.cameraBodyTurn+=turn;
        if(Math.abs(remaining)>step)alignment=0;
      }
      local.multiplyScalar(alignment);
    }else local=new THREE.Vector3();
    if(first||alignment!==0){
      this.moveBody(e,local,dt,true);
      if(s.mode!=='island')this.unstick(e,dt);
    }
    const distance=e.root.position.distanceTo(before);
    e.movementRatio=e.moving&&dt>0?Math.min(1,distance/(speed*dt)):0;
    e.animationMoving=e.movementRatio>.01;
  }
  faceDirection(e,facing,dt){const s=SPECIES[e.kind];const desired=Math.atan2(-facing.x,-facing.z);const delta=Math.atan2(Math.sin(desired-e.heading),Math.cos(desired-e.heading));e.heading+=THREE.MathUtils.clamp(delta,-THREE.MathUtils.degToRad(s.turnSpeed)*dt,THREE.MathUtils.degToRad(s.turnSpeed)*dt);if(s.mode!=='island')e.root.rotation.y=e.heading;}
  // Moves any body (the player's, or one answering an interaction) by a delta in its
  // carrier's frame: soft activity areas first, then solid collision (M-01～M-08).
  moveBody(e,local,dt,keepHeading=false){
    const s=SPECIES[e.kind];
    if((local.x||local.z)&&!keepHeading){const angle=Math.atan2(-local.x,-local.z);e.heading+=Math.atan2(Math.sin(angle-e.heading),Math.cos(angle-e.heading))*Math.min(1,dt*5);if(s.mode!=='island')e.root.rotation.y=e.heading;}
    if(s.mode==='island'){this.moveIsland(e,local);return;}
    if(s.mode==='ground')local.y=0;
    const p=e.root.position;
    if(local.x||local.z){
      // Soft boundaries slide along the edge instead of stopping dead (M-04).
      if(!this.allowed(e,s,p.x+local.x,p.z+local.z)){
        if(this.allowed(e,s,p.x+local.x,p.z))local.z=0;else if(this.allowed(e,s,p.x,p.z+local.z))local.x=0;else local.x=local.z=0;
      }
    }
    if(local.lengthSq()>0)this.collision.move(e,local.clone().applyQuaternion(e.root.parent.getWorldQuaternion(new THREE.Quaternion())));
    if(s.mode==='ground'){
      const water=s.category==='human'&&e.root.parent===this.world.islandRoot?this.world.water(p.x,p.z):null;
      e.swimming=Boolean(water&&water.surface>water.floor);
      p.y=e.swimming?Math.max(water.floor,water.surface-s.height*.7):this.groundHeight(e);
    }
    else this.clampVertical(e,s);
  }
  clampVertical(e,s){
    const p=e.root.position;
    if(e.root.parent!==this.world.islandRoot){p.y=Math.max(p.y,this.groundHeight(e)+.2);return;}
    if(s.mode==='swim'){const w=this.world.water(p.x,p.z);if(w)p.y=clamp(p.y,w.floor+s.height*.3,Math.max(w.floor+s.height*.3,w.surface-s.height*.7));}
    if(s.mode==='fly'){const air=LAYOUT.regions[s.activityRegion];p.y=clamp(p.y,this.world.height(p.x,p.z)+air.minClearanceM,Math.min(tune('flightCeilingM',air.maxY),this.world.height(p.x,p.z)+(s.flightHeight??Infinity)));}
  }
  // Islands drift along the river between its forested banks (M-04, D-027).
  moveIsland(e,local){
    const p=e.root.position;p.add(local);
    const corridor=this.world.river.corridor,s=SPECIES[e.kind],side=corridor.halfWidthM-s.surface?.radii?.[2]*1.15-corridor.bankClearanceM,end=corridor.lengthM/2-s.radius*1.2;
    p.x=clamp(p.x,-end,end);p.z=clamp(p.z,-side,side);
    p.y=Math.sqrt(Math.max(0,PLANET_RADIUS**2-p.x*p.x-p.z*p.z));
    e.root.quaternion.setFromUnitVectors(UP,p.clone().normalize());
    this.resolveLargeBodies(e);
  }
  // Same-scale large bodies never overlap (M-05).
  resolveLargeBodies(entity){
    const s=SPECIES[entity.kind];
    for(const other of this.world.entities){
      if(other===entity||SPECIES[other.kind].stage!==s.stage||other.root.parent!==entity.root.parent)continue;
      const delta=entity.root.position.clone().sub(other.root.position),length=delta.length(),minimum=(s.radius+SPECIES[other.kind].radius)*1.03;
      if(length>0&&length<minimum)entity.root.position.copy(other.root.position).addScaledVector(delta,minimum/length);
    }
  }
  // Recover only when moving, not progressing and actually overlapping (M-06).
  unstick(e,dt){
    const pos=this.world.position(e,new THREE.Vector3());
    if(!this.collision.collides(e,pos))e.lastSafe=pos.clone();
    if(!e.moving){this.stuck={time:Math.min(0,this.stuck.time),anchor:null};return;}
    if(!this.stuck.anchor||pos.distanceTo(this.stuck.anchor)>tune('stuckDisplacementM',.05)){this.stuck.anchor=pos;this.stuck.time=Math.min(0,this.stuck.time);return;}
    this.stuck.time+=dt;
    if(this.stuck.time>tune('stuckAttemptSec',2)&&this.collision.collides(e,pos)){this.collision.repair(e);this.stuck={time:-tune('safeRecoveryGraceSec',1),anchor:null};}
  }

  // --- Camera, scale and perception (C-01～C-06, B-04, P-14).
  updateCamera(dt){
    const tr=this.transition,subject=tr?tr.to:this.player,s=SPECIES[subject.kind],layer=layerOf(subject.kind),focus=this.world.focus(subject),first=this.cameraMode==='first_person';
    const bodyTurn=this.cameraBodyTurn;this.cameraBodyTurn=0;
    const dist=s.camera*this.zoom,orbit=new THREE.Vector3(Math.sin(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch),Math.cos(this.yaw)*Math.cos(this.pitch)).multiplyScalar(dist);
    const desired=focus.clone().add(orbit);
    // Look ahead of the body, keeping it in the lower third, so the view can find targets.
    const ahead=dist*layer.cameraLookAhead;
    const aim=focus.clone().add(new THREE.Vector3(-Math.sin(this.yaw)*ahead,0,-Math.cos(this.yaw)*ahead));
    aim.y+=dist*(.35-this.pitch)*.6;
    if(layer.cameraTerrainFloor&&subject.root.parent===this.world.islandRoot&&!first){
      const local=this.world.islandRoot.worldToLocal(desired.clone()),floor=this.world.height(local.x,local.z)+.25;
      if(local.y<floor){local.y=floor;desired.copy(this.world.islandRoot.localToWorld(local));}
    }
    if(layer.cameraCollision&&!first)desired.copy(this.collision.cameraPosition(focus,desired,subject,tune('cameraCollisionPaddingM',.1)));
    if(first){desired.copy(this.firstPersonEye(subject));const look=new THREE.Vector3(-Math.sin(this.yaw)*Math.cos(this.pitch),-Math.sin(this.pitch),-Math.cos(this.yaw)*Math.cos(this.pitch));aim.copy(desired).add(look);}
    const bound=Math.hypot(s.radius,s.height*.5);
    const viewDistance=desired.distanceTo(focus),maxAimAngle=Math.max(.025,THREE.MathUtils.degToRad(this.camera.fov)*.5-Math.asin(Math.min(.95,bound/viewDistance))-.035);
    const offset=aim.clone().sub(focus),angle=focus.clone().sub(desired).angleTo(aim.clone().sub(desired));
    if(!first&&angle>maxAimAngle)aim.copy(focus).addScaledVector(offset,maxAimAngle/angle*.94);
    let f=1;
    if(tr){
      tr.elapsed+=dt;const t=clamp(tr.elapsed/tr.duration,0,1);f=smooth(t);
      this.camera.position.lerpVectors(tr.start,desired,f);this.focusGoal.lerpVectors(tr.startFocus,aim,f);
    }else if(first||this.snapCamera){this.camera.position.copy(desired);this.focusGoal.copy(aim);this.snapCamera=false;}
    else{if(bodyTurn){this.camera.position.sub(focus).applyAxisAngle(UP,bodyTurn).add(focus);this.focusGoal.sub(focus).applyAxisAngle(UP,bodyTurn).add(focus);if(layer.cameraCollision)this.camera.position.copy(this.collision.cameraPosition(focus,this.camera.position,subject,tune('cameraCollisionPaddingM',.1)));}this.camera.position.lerp(desired,1-Math.exp(-dt*7));this.focusGoal.lerp(aim,1-Math.exp(-dt*9));}
    // Perception blends continuously during the hand-over, never at commit.
    this.view=tr?blendView(viewOf(tr.from.kind,this.cameraMode),viewOf(tr.to.kind,this.cameraMode),f):viewOf(this.player.kind,this.cameraMode);
    this.camera.fov=this.view.fov;
    this.camera.near=first ? .025 : Math.max(.025,this.camera.position.distanceTo(this.focusGoal)/6000);this.camera.updateProjectionMatrix();this.camera.lookAt(this.focusGoal);
    const localEye=this.world.islandRoot.worldToLocal(this.camera.position.clone());
    const pool=this.world.water(localEye.x,localEye.z);
    const underwater=(pool?.type==='enclosed'&&localEye.y<pool.surface)||this.world.planetRoot.worldToLocal(this.camera.position.clone()).length()<PLANET_RADIUS+this.world.seaLevel-.1;
    this.scene.userData.underwater=underwater;
    const shown=f>.5?layer:layerOf((tr?.from||subject).kind);
    const density=underwater ? .045 : shown.fogDensity*this.view.fogMultiplier*this.atmosphere.fogBoost;
    this.scene.fog.density=THREE.MathUtils.damp(this.scene.fog.density,density,1.5,dt);
    this.scene.fog.color.lerp(underwater?new THREE.Color('#3b4a2c'):this.atmosphere.fogColor,1-Math.exp(-dt*2));
    this.scene.userData.cameraPosition=this.camera.position;
    const center=this.world.position(subject);
    this.lightFollow(center,shown.localSun);
    this.applyPerception();
    this.world.firstPersonBodies=first?(tr?[tr.from,tr.to]:[this.player]):[];
    if(tr&&tr.elapsed>=tr.duration)this.finishTransition();
    return f;
  }
  firstPersonEye(subject){
    const s=SPECIES[subject.kind],offset=s.firstPerson?.eyeOffset||[0,s.height*.8,0];
    const eye=subject.root.localToWorld(new THREE.Vector3(...offset));
    if(subject.root.parent===this.world.islandRoot){const local=this.world.islandRoot.worldToLocal(eye.clone());local.y=Math.max(local.y,this.world.height(local.x,local.z)+tune('cameraCollisionPaddingM',.1));eye.copy(this.world.islandRoot.localToWorld(local));}
    return eye;
  }
  // The sun (or the moon at night) lights from the atmosphere's direction; near layers keep a
  // tight shadow box around the body, large layers light from far away without shadows.
  lightFollow(center,local){
    const dir=this.sun.userData.direction||UP;
    this.sun.position.copy(center).addScaledVector(dir,local?150:30000);this.sun.target.position.copy(center);
    this.sun.castShadow=local&&dir.y>.05;
  }
  applyPerception(){
    const v=this.view,filter=`grayscale(${v.grayscale.toFixed(3)}) saturate(${v.saturation.toFixed(3)}) contrast(${v.contrast.toFixed(3)}) brightness(${v.brightness.toFixed(3)})`;
    if(filter!==this.filter){this.renderer.domElement.style.filter=filter;this.filter=filter;}
    const tint=$('perception-tint');if(v.tint)tint.style.background=v.tint;tint.style.opacity=(v.tintAmount*.32).toFixed(3);
  }
  updateAudio(){
    const subject=this.transition?.to||this.player,h=this.view.hearing,p=this.world.position(subject,new THREE.Vector3());
    let groundFade=1;
    if(h.heightAttenuation&&subject.root.parent===this.world.islandRoot){
      const local=this.world.islandRoot.worldToLocal(p.clone()),start=tune('airGroundSoundFadeStartM',5),end=tune('airGroundSoundFadeEndM',60);
      groundFade=1-smooth(clamp((local.y-this.world.height(local.x,local.z)-start)/(end-start),0,1));
    }
    // The nearest thing that makes a sound (its category's soundCue) is the cue
    // whose direction good hearing can place.
    let cue=null,source=null;
    for(const e of this.world.entities){
      const name=SPECIES[e.kind].soundCue;if(e===subject||!name)continue;
      const distance=this.world.position(e,v1).distanceTo(p);
      if(!cue||distance<cue.distance){cue={name,distance};source=e;}
    }
    if(cue)cue.pan=this.panOf(source,p);
    this.audio.update(h,{underwater:this.scene.userData.underwater,groundFade,cue,crossfade:tune('audioCrossfadeSec',1.2),time:this.elapsed});
  }

  panOf(entity,from){
    const d=this.world.position(entity,v1).sub(from),right=v2.set(Math.cos(this.yaw),0,-Math.sin(this.yaw));
    return d.lengthSq()?d.normalize().dot(right):0;
  }
  // A sound made by something in the world, heard through the current body's ears.
  playCue(name,volume,entity){
    const h=this.view.hearing,p=this.world.position(this.transition?.to||this.player,new THREE.Vector3());
    const reach=1-this.world.position(entity,v1).distanceTo(p)/h.range;
    if(reach>0)this.audio.play(name,volume*h.distantCueGain*Math.sqrt(reach),this.panOf(entity,p));
  }

  // --- Compact controls, current possession target guidance, rare responses (D-024).
  showResponse(text,key){
    this.lastResponse=this.elapsed;this.shown.add(key);this.responseTimer=tune('dialogueDisplaySec',6);
    $('response').textContent=text;$('response').classList.add('visible');
  }
  updateHints(dt){
    if(!this.transition)this.pointerHintTime=Math.max(0,this.pointerHintTime-dt);
    this.updateControlGuide();
    if(this.responseTimer>0){this.responseTimer-=dt;if(this.responseTimer<=0)$('response').classList.remove('visible');}
    if(this.pendingMoment&&this.player.kind!==this.pendingMoment.kind)this.pendingMoment=null;
    if(this.transition||this.elapsed-this.lastResponse<90)return;
    if(this.pendingMoment){const m=this.pendingMoment;this.pendingMoment=null;this.showResponse(m.text,m.key);return;}
    if(this.elapsed>30&&this.target&&this.candidateTime>1.2){
      const key=this.target.kind+':focus',text=SPECIES[this.target.kind].response;
      if(text&&!this.shown.has(key))this.showResponse(text,key);
    }
  }
  save(){
    if(!this.started||this.resetting||(this.transition&&!this.transition.opening))return;
    try{localStorage.setItem(STORAGE,JSON.stringify({version:SAVE_VERSION,layoutId:LAYOUT.layoutId||'river_island_v1',player:this.player.id,entities:this.world.serialize(),layout:this.world.serializeLayout(),yaw:this.yaw,pitch:this.pitch,cameraMode:this.cameraMode,hints:this.hints,shown:[...this.shown],atmosphere:this.atmosphere.serialize()}));$('save-status').textContent='足迹已留在这台设备上';}
    catch{$('save-status').textContent='暂时无法保存足迹';}
  }
  restore(){
    try{const saved=JSON.parse(localStorage.getItem(STORAGE)||'null');if(!saved||saved.version!==SAVE_VERSION||saved.layoutId!==(LAYOUT.layoutId||'river_island_v1')||!Array.isArray(saved.entities)||!Array.isArray(saved.layout))return false;
      const id=this.world.byId.has(saved.player)?saved.player:LAYOUT.savePlayerAliases?.[saved.player];
      const player=this.world.byId.get(id)||this.world.byId.get(LAYOUT.initialInstance);if(!player)return false;
      this.world.restore(saved.entities,saved.layout);this.atmosphere.restore(saved.atmosphere);this.player=player;
      this.cameraMode=saved.cameraMode==='first_person'?'first_person':CAMERA_MODES.default;
      this.yaw=Number.isFinite(saved.yaw)?saved.yaw:.35;this.pitch=clamp(Number.isFinite(saved.pitch)?saved.pitch:.27,this.pitchMin(),this.pitchMax());
      this.hints={...this.hints,...saved.hints};this.shown=new Set(Array.isArray(saved.shown)?saved.shown:[]);$('enter-label').textContent='继续漫游';return true;
    }catch{return false;}
  }
  loop(){
    requestAnimationFrame(()=>this.loop());const dt=Math.min(this.clock.getDelta(),.05);
    if(!this.paused){
      let subject=this.player;
      this.atmosphere.update(dt,this.camera.position,{underwater:this.scene.userData.underwater,camera:this.camera});
      if(this.started){
        this.elapsed+=dt;this.collision.refresh();
        if(!this.transition){this.move(dt);this.collision.refresh();}
        const tr=this.transition,f=this.updateCamera(dt);
        if(tr&&f>.5)subject=tr.to;
        if(!this.transition)this.selectTarget(dt);else{this.target=null;this.candidate=null;}
        this.updateHints(dt);this.updateAudio();
        this.saveElapsed+=dt;if(this.saveElapsed>4){this.saveElapsed=0;this.save();}
      }else{
        const t=this.world.time;
        if(this.hasSave){const s=SPECIES[this.player.kind],focus=this.world.focus(this.player);this.introFocus.copy(focus);this.camera.position.copy(focus).add(new THREE.Vector3(Math.sin(this.yaw+.2)*s.camera*1.25,s.camera*.4,Math.cos(this.yaw+.2)*s.camera*1.25));}
        else{this.camera.position.set(25+Math.sin(t*.07)*2,14,55+Math.cos(t*.07)*2);this.introFocus.set(-5,6,-15);}
        this.camera.lookAt(this.introFocus);this.scene.userData.cameraPosition=this.camera.position;this.lightFollow(this.introFocus,true);this.applyPerception();
      }
      const info=this.targetInfo,size=info?.carrier?Math.max(1.5,this.camera.position.distanceTo(info.point)*.05):Math.max(SPECIES[this.target?.kind]?.radius||0,.5);
      this.world.ambientHold=this.transition?[this.transition.from,this.transition.to]:null;
      this.world.update(dt,subject,this.target,info?.point||null,size);
      if(this.started)this.interactions.update(dt);
    }
    if((!this.paused||this.needsRender)&&!NO_RENDER){this.renderer.render(this.scene,this.camera);this.needsRender=false;}
  }
}

// ?debug&render=0 runs the game without drawing it: automated checks on software rendering
// (CI) read state, never pixels, and a dense rainforest takes seconds per frame there.
const NO_RENDER=(()=>{const p=new URLSearchParams(location.search);return p.has('debug')&&p.get('render')==='0';})();
async function boot(){
  try{
    const renderer=new THREE.WebGLRenderer({canvas:$('world'),antialias:true,alpha:false,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    await loadRuntimeConfig();
    const assets=new AssetLibrary();await assets.prepare();
    // A missing or broken heightfield keeps the procedural island (L-03).
    try{await loadTerrainField(assets.manifest.environment);}catch(e){assets.errors.push('heightfield: '+e.message);console.warn('Heightfield unavailable; procedural terrain kept.',e);}
    game=new Game(renderer,assets);await game.world.ready;game.collision.refresh();
    // Compile every material while the loading screen shows, so entering does not stall.
    try{game.world.update(0,game.player,null,null,1);if(!NO_RENDER)await renderer.compileAsync(game.scene,game.camera);}catch(e){console.warn('Shader warm-up skipped',e);}
    if(!game.hasSave)$('enter-label').textContent='进入旷野';$('enter').disabled=false;
    // Debug access is available only with ?debug; the normal product UI stays quiet.
    if(new URLSearchParams(location.search).has('debug'))window.__world=game;
  }catch(error){console.error(error);$('fallback').hidden=false;$('fallback-detail').textContent='这片世界暂时无法展开。请刷新，或使用支持 WebGL 2 的电脑浏览器。';}
}
boot();
