import * as THREE from 'three';
import { AssetLibrary } from './assets.js';
import { World, terrainHeight, PLANET_RADIUS } from './world.js';
import { SPECIES,TUNING,LAYOUT,loadRuntimeConfig,actionForCode,canEmbody,inRegion } from './species.js';
import { InteractionSystem } from './interactions.js';
import { WorldCollision } from './collision.js';
import { Ambience } from './audio.js';

const $=id=>document.getElementById(id);
// 0.3 baseline save; earlier prototype saves (planets, companions) are ignored (W-04).
const STORAGE='between-all-things.save.v4';
const SOUND='between-all-things.sound';
const UP=new THREE.Vector3(0,1,0);
const v1=new THREE.Vector3(),v2=new THREE.Vector3(),v3=new THREE.Vector3();
const smooth=t=>t*t*(3-2*t);
const lerp=THREE.MathUtils.lerp,clamp=THREE.MathUtils.clamp;
const tune=(key,fallback)=>TUNING[key]?.value??fallback;
// Pitch at which flying and swimming bodies hold their height (I-02).
const LEVEL_PITCH=.3;
let game;

function viewOf(kind){const s=SPECIES[kind];return {...s.vision,fov:s.fov,hearing:s.hearing};}
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
    this.scene.add(new THREE.HemisphereLight('#dfe8d9','#75804e',1.8));
    this.sun=new THREE.DirectionalLight('#fff0d0',2.5);this.sun.position.set(-60,110,35);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-70,right:70,top:70,bottom:-70,near:.5,far:450});this.sun.shadow.normalBias=.08;this.sun.shadow.bias=-.0002;this.scene.add(this.sun,this.sun.target);
    this.world=new World(this.scene,assets);this.collision=new WorldCollision(this.world);this.world.prune(this.collision);this.interactions=new InteractionSystem(this);
    this.player=this.world.byId.get(LAYOUT.initialInstance);this.target=null;this.candidate=null;this.candidateTime=0;this.targetInfo=null;this.lookPoint=null;
    this.actions=new Set();this.yaw=.35;this.pitch=.27;this.zoom=1;
    this.started=false;this.paused=false;this.needsRender=true;this.transition=null;this.dragging=false;this.clock=new THREE.Clock();this.elapsed=0;this.saveElapsed=0;
    this.hints={r:false};this.hintTimer=0;this.lastResponse=-90;this.responseTimer=0;this.shown=new Set();this.pendingMoment=null;
    this.stuck={time:0,anchor:null};this.audio=new Ambience();this.filter='';
    this.hasSave=this.restore();this.view=viewOf(this.player.kind);
    this.cameraGoal=this.camera.position.clone();this.focusGoal=new THREE.Vector3();this.introFocus=new THREE.Vector3(-5,6,-15);
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
      if(action==='pause'){if(this.started){if(this.paused)this.resume(false);else this.pause();}return;}
      if(!this.started||this.paused||!action)return;
      this.actions.add(action);if(event.repeat||this.transition)return;
      if(action==='possess')this.possess();
    });
    window.addEventListener('keyup',event=>{const action=actionForCode(event.code);if(action)this.actions.delete(action);});
    window.addEventListener('blur',()=>{this.actions.clear();if(this.started&&!this.paused)this.pause();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.started)this.pause();});
    const canvas=this.renderer.domElement;
    canvas.addEventListener('click',()=>{if(this.started&&!this.paused)this.lockMouse();});
    canvas.addEventListener('pointerdown',e=>{if(e.button===0&&this.started&&!this.paused){this.dragging=true;canvas.setPointerCapture?.(e.pointerId);}});
    canvas.addEventListener('pointerup',()=>{this.dragging=false;});
    document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&this.started&&!this.paused&&this.wasLocked)this.pause();this.wasLocked=Boolean(document.pointerLockElement);});
    document.addEventListener('mousemove',e=>{
      if(!this.started||this.paused||(!document.pointerLockElement&&!this.dragging))return;
      const sensitivity=tune('mouseSensitivityRadPerPixel',.0025);
      this.yaw-=e.movementX*sensitivity;this.pitch=clamp(this.pitch+e.movementY*sensitivity*.8,this.pitchMin(),1.16);
    });
    canvas.addEventListener('wheel',e=>{if(!this.started||this.paused)return;e.preventDefault();this.zoom=clamp(this.zoom+e.deltaY*.0006,.85,1.5);},{passive:false});
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
    try{const result=this.renderer.domElement.requestPointerLock();result?.catch?.(()=>{});}catch{}
  }
  start(){
    this.started=true;document.body.classList.add('playing');$('welcome').setAttribute('aria-hidden','true');$('enter').tabIndex=-1;$('presence').hidden=false;$('pause-button').hidden=false;this.updatePresence();
    this.transition={opening:true,from:this.player,to:this.player,start:this.camera.position.clone(),startFocus:this.introFocus.clone(),elapsed:0,duration:tune('possessionDurationSec',2.4)};
    this.focusGoal.copy(this.world.focus(this.player));this.setSound(this.soundPreference());this.lockMouse();this.renderer.domElement.focus();this.save();
  }
  pause(){
    if(!this.started||this.paused)return;this.paused=true;this.needsRender=true;this.actions.clear();this.dragging=false;this.save();$('pause').hidden=false;document.exitPointerLock?.();$('resume').focus();
  }
  resume(lock=true){
    this.paused=false;this.actions.clear();$('pause').hidden=true;this.renderer.domElement.focus();if(lock)this.lockMouse();
  }
  resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);this.needsRender=true;}
  hint(key,text,seconds){
    $('first-hint').replaceChildren();const k=document.createElement('kbd');k.textContent=key;$('first-hint').append(k,document.createTextNode(text));$('first-hint').classList.add('visible');this.hintTimer=seconds;
  }
  updatePresence(){const s=SPECIES[this.player.kind];$('body-name').textContent=s.name;$('body-place').textContent=s.place;}
  pitchMin(){return SPECIES[this.player.kind].verticalControl==='view_direction'?-.45:.06;}
  // Looking up while moving forward rises, looking down dives (I-02).
  climb(){return -Math.sin((this.pitch-LEVEL_PITCH)*1.6);}

  // --- Possession: re-validate on R, commit only when the camera arrives (P-06～P-08).
  possess(){
    if(this.transition||!this.target)return false;
    const target=this.target;this.collision.refresh();
    if(!this.evaluate(target,this.camera.position,this.camera.getWorldDirection(v2))){this.target=null;this.candidate=null;return false;}
    if(SPECIES[target.kind].stage>=3)this.pitch=Math.max(this.pitch,.52);
    this.transition={from:this.player,to:target,start:this.camera.position.clone(),startFocus:this.focusGoal.clone(),elapsed:0,duration:tune('possessionDurationSec',2.4)};
    this.player.moving=false;this.target=null;this.candidate=null;this.zoom=1;this.actions.clear();
    document.body.classList.add('transitioning');this.audio.chime();return true;
  }
  finishTransition(){
    const tr=this.transition;this.transition=null;document.body.classList.remove('transitioning');this.actions.clear();
    if(tr.opening)return;
    if(!this.world.byId.has(tr.to.id)){
      // The target vanished: glide back to the body we never left.
      this.transition={opening:true,from:tr.from,to:tr.from,start:this.camera.position.clone(),startFocus:this.focusGoal.clone(),elapsed:0,duration:tune('rollbackDurationSec',.8)};return;
    }
    const fromStage=SPECIES[tr.from.kind].stage;
    this.player=tr.to;this.collision.refresh();this.collision.repair(this.player);
    this.pitch=clamp(this.pitch,this.pitchMin(),1.16);this.stuck={time:0,anchor:null};
    const moment=SPECIES[this.player.kind].moments?.first_possess_from_stage_1,key=this.player.kind+':first_possess';
    this.pendingMoment=moment&&fromStage===1&&!this.shown.has(key)?{key,text:moment,kind:this.player.kind}:null;
    this.interactions.onPossess(this.player);this.updatePresence();this.save();
  }
  isCarrier(e){const parent=this.player.root.parent;return e.root===parent||parent?.parent===e.root;}
  // The main island is recognised as an island only near its edge or from above (G-07, P-13).
  islandVisible(){
    const root=this.world.islandRoot,p=root.worldToLocal(this.world.position(this.player,v3));
    if(p.y-this.world.height(p.x,p.z)>tune('carrierAltitudeM',35))return true;
    const r=tune('carrierEdgeSightM',90);
    for(let i=0;i<16;i++){const a=i/16*Math.PI*2;if(this.world.height(p.x+Math.cos(a)*r,p.z+Math.sin(a)*r)<0)return true;}
    return false;
  }
  // Land under the view ray of the main island, or null when looking at sky or sea.
  groundUnderView(eye,dir){
    const root=this.world.islandRoot,origin=root.worldToLocal(eye.clone()),d=dir.clone().applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()).invert());
    for(let t=.5;t<700;t+=Math.max(.5,t*.04)){
      const x=origin.x+d.x*t,y=origin.y+d.y*t,z=origin.z+d.z*t,h=this.world.height(x,z);
      if(y<h)return h>-.3?root.localToWorld(new THREE.Vector3(x,h,z)):null;
      if(y<-.1)return null;
    }
    return null;
  }
  evaluate(e,eye,direction){
    const p=this.player;if(!canEmbody(p,e))return null;
    const s=SPECIES[p.kind],o=SPECIES[e.kind],carrier=this.isCarrier(e);
    if(carrier){
      // A carrying whole is chosen by where one looks on it, not by its centre.
      if(e.root===this.world.islandRoot){if(!this.islandFrame||!this.lookPoint)return null;return {entity:e,angle:0,distance:0,carrier,point:this.lookPoint.clone()};}
      return {entity:e,angle:0,distance:0,carrier,point:this.focusGoal.clone()};
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
    if(s.stage<3&&(this.world.occludes(eye,point,Math.max(o.radius,o.height*.35))||this.collision.obscures(eye,point,p,e)))return null;
    return {entity:e,angle,distance:surface,carrier:false,own,point:null};
  }
  // Lexicographic: smaller targets before a carrying whole, then aim, distance, scale, id (P-04).
  compare(a,b){
    if(a.carrier!==b.carrier)return a.carrier?1:-1;
    const angleTol=THREE.MathUtils.degToRad(tune('angleTieToleranceDeg',1.5)),distanceTol=tune('distanceTieToleranceM',.15);
    // Carried bodies need a clearly closer aim than outside ones (P-04, P-13).
    const bias=tune('ownBodyAngleBiasRad',.15),aa=a.angle+(a.own?bias:0),ba=b.angle+(b.own?bias:0);
    if(Math.abs(aa-ba)>angleTol)return aa-ba;
    if(Math.abs(a.distance-b.distance)>distanceTol)return a.distance-b.distance;
    const stage=SPECIES[a.entity.kind].stage-SPECIES[b.entity.kind].stage;if(stage)return stage;
    return a.entity.id<b.entity.id?-1:1;
  }
  selectTarget(dt){
    const eye=this.camera.position,direction=this.camera.getWorldDirection(v2);
    this.islandFrame=this.player.root.parent===this.world.islandRoot&&canEmbody(this.player,this.world.byId.get(LAYOUT.mainIsland))&&this.islandVisible();
    this.lookPoint=this.islandFrame?this.groundUnderView(eye,direction):null;
    const list=[];for(const e of this.world.entities){const c=this.evaluate(e,eye,direction);if(c)list.push(c);}
    list.sort((a,b)=>this.compare(a,b));
    let best=list[0]||null;
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
      if(s.stage===2)return e.groundOffset+terrainHeight(p.x,p.z);
      // Deep waders (rocks) settle on the bed; others keep to the top of shallow edges.
      const h=this.world.height(p.x,p.z);return s.wadeDepth>1?h:Math.max(-.02,h);
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
    if(s.mode==='fly'){const limit=760;return Math.hypot(x,z)<=limit||Math.hypot(x,z)<Math.hypot(p.x,p.z);}
    const limit=-s.wadeDepth;
    return this.world.height(x,z)>=limit||this.world.height(p.x,p.z)<limit;
  }
  move(dt){
    const e=this.player,s=SPECIES[e.kind],a=this.actions;
    const x=Number(a.has('move_right'))-Number(a.has('move_left')),z=Number(a.has('move_back'))-Number(a.has('move_forward'));
    const dir=new THREE.Vector3(x,0,z);if(dir.lengthSq())dir.normalize();dir.applyAxisAngle(UP,this.yaw);
    if(s.verticalControl==='view_direction'&&z)dir.y=-z*this.climb();
    if(dir.lengthSq()>1)dir.normalize();
    e.moving=dir.lengthSq()>0;
    const speed=s.speed*(a.has('boost')?s.boost:1),parentQ=e.root.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    this.moveBody(e,dir.applyQuaternion(parentQ).multiplyScalar(speed*dt),dt);
    if(s.mode!=='island')this.unstick(e,dt);
  }
  // Moves any body (the player's, or one answering an interaction) by a delta in its
  // carrier's frame: soft activity areas first, then solid collision (M-01～M-08).
  moveBody(e,local,dt){
    const s=SPECIES[e.kind];
    if(local.x||local.z){const angle=Math.atan2(-local.x,-local.z);e.heading+=Math.atan2(Math.sin(angle-e.heading),Math.cos(angle-e.heading))*Math.min(1,dt*5);if(s.mode!=='island')e.root.rotation.y=e.heading;}
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
    if(s.mode==='ground')p.y=this.groundHeight(e);
    else this.clampVertical(e,s);
  }
  clampVertical(e,s){
    const p=e.root.position;
    if(e.root.parent!==this.world.islandRoot){p.y=Math.max(p.y,this.groundHeight(e)+.2);return;}
    if(s.mode==='swim'){const w=this.world.water(p.x,p.z);if(w)p.y=clamp(p.y,w.floor+s.height*.3,Math.max(w.floor+s.height*.3,w.surface-s.height*.7));}
    if(s.mode==='fly')p.y=clamp(p.y,this.world.height(p.x,p.z)+.3,tune('birdMaxHeightM',180));
  }
  moveIsland(e,local){
    const p=e.root.position;p.add(local);
    const limit=PLANET_RADIUS*.76,rad=Math.hypot(p.x,p.z);if(rad>limit){p.x*=limit/rad;p.z*=limit/rad;}
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
    const tr=this.transition,subject=tr?tr.to:this.player,s=SPECIES[subject.kind],focus=this.world.focus(subject);
    const dist=s.camera*this.zoom,orbit=new THREE.Vector3(Math.sin(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch),Math.cos(this.yaw)*Math.cos(this.pitch)).multiplyScalar(dist);
    const desired=focus.clone().add(orbit);
    // Look ahead of the body, keeping it in the lower third, so the view can find targets.
    const ahead=dist*(s.stage===0?.65:s.stage===1?.45:.22);
    const aim=focus.clone().add(new THREE.Vector3(-Math.sin(this.yaw)*ahead,0,-Math.cos(this.yaw)*ahead));
    aim.y+=dist*(.35-this.pitch)*.6;
    if(s.stage<2&&subject.root.parent===this.world.islandRoot){
      const local=this.world.islandRoot.worldToLocal(desired.clone()),floor=this.world.height(local.x,local.z)+.25;
      if(local.y<floor){local.y=floor;desired.copy(this.world.islandRoot.localToWorld(local));}
    }
    if(s.stage<=2)desired.copy(this.collision.cameraPosition(focus,desired,subject,tune('cameraCollisionPaddingM',.1)));
    const bound=Math.hypot(s.radius,s.height*.5);
    const viewDistance=desired.distanceTo(focus),maxAimAngle=Math.max(.025,THREE.MathUtils.degToRad(this.camera.fov)*.5-Math.asin(Math.min(.95,bound/viewDistance))-.035);
    const offset=aim.clone().sub(focus),angle=focus.clone().sub(desired).angleTo(aim.clone().sub(desired));
    if(angle>maxAimAngle)aim.copy(focus).addScaledVector(offset,maxAimAngle/angle*.94);
    let f=1;
    if(tr){
      tr.elapsed+=dt;const t=clamp(tr.elapsed/tr.duration,0,1);f=smooth(t);
      this.camera.position.lerpVectors(tr.start,desired,f);this.focusGoal.lerpVectors(tr.startFocus,aim,f);
    }else{this.camera.position.lerp(desired,1-Math.exp(-dt*7));this.focusGoal.lerp(aim,1-Math.exp(-dt*9));}
    // Perception blends continuously during the hand-over, never at commit.
    this.view=tr?blendView(viewOf(tr.from.kind),viewOf(tr.to.kind),f):viewOf(this.player.kind);
    this.camera.fov=this.view.fov;
    this.camera.near=Math.max(.025,this.camera.position.distanceTo(this.focusGoal)/6000);this.camera.updateProjectionMatrix();this.camera.lookAt(this.focusGoal);
    const localEye=this.world.islandRoot.worldToLocal(this.camera.position.clone());
    const lake=LAYOUT.regions.lake,inLake=Boolean(lake)&&inRegion('lake',localEye.x,localEye.z);
    const underwater=(inLake&&localEye.y<lake.surfaceY)||this.world.planetRoot.worldToLocal(this.camera.position.clone()).length()<PLANET_RADIUS-.2;
    this.scene.userData.underwater=underwater;
    const stage=f>.5?s.stage:SPECIES[(tr?.from||subject).kind].stage;
    const density=underwater?.045:(stage===3?.00015:stage===2?.00085:.004)*this.view.fogMultiplier;
    this.scene.fog.density=THREE.MathUtils.damp(this.scene.fog.density,density,1.5,dt);
    this.scene.fog.color.lerp(new THREE.Color(underwater?'#3e7c73':'#b5c4aa'),1-Math.exp(-dt*2));
    this.scene.userData.cameraPosition=this.camera.position;
    const center=this.world.position(subject);
    if(stage<=2){this.sun.position.copy(center).add(new THREE.Vector3(-60,110,35));this.sun.target.position.copy(center);this.sun.castShadow=true;}
    else{this.sun.castShadow=false;this.sun.position.copy(center).add(new THREE.Vector3(-15000,25000,8000));this.sun.target.position.copy(center);}
    this.applyPerception();
    if(tr&&tr.elapsed>=tr.duration)this.finishTransition();
    return f;
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

  // --- Minimal UI: one R hint, rare world responses (U-01～U-05).
  showResponse(text,key){
    this.lastResponse=this.elapsed;this.shown.add(key);this.responseTimer=tune('dialogueDisplaySec',6);
    $('response').textContent=text;$('response').classList.add('visible');
  }
  updateHints(dt){
    if(this.hintTimer>0){this.hintTimer-=dt;if(this.hintTimer<=0)$('first-hint').classList.remove('visible');}
    if(this.responseTimer>0){this.responseTimer-=dt;if(this.responseTimer<=0)$('response').classList.remove('visible');}
    if(this.target&&!this.hints.r&&this.hintTimer<=0&&!this.transition){this.hints.r=true;this.hint('R','成为另一种存在',tune('firstPossessionHintSec',4));}
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
    try{localStorage.setItem(STORAGE,JSON.stringify({version:4,player:this.player.id,entities:this.world.serialize(),yaw:this.yaw,pitch:this.pitch,hints:this.hints,shown:[...this.shown]}));$('save-status').textContent='足迹已留在这台设备上';}
    catch{$('save-status').textContent='暂时无法保存足迹';}
  }
  restore(){
    try{const saved=JSON.parse(localStorage.getItem(STORAGE)||'null');if(!saved||saved.version!==4||!this.world.byId.has(saved.player))return false;
      this.world.restore(saved.entities);this.player=this.world.byId.get(saved.player);
      this.yaw=Number.isFinite(saved.yaw)?saved.yaw:.35;this.pitch=clamp(Number.isFinite(saved.pitch)?saved.pitch:.27,this.pitchMin(),1.16);
      this.hints={...this.hints,...saved.hints};this.shown=new Set(Array.isArray(saved.shown)?saved.shown:[]);$('enter-label').textContent='继续漫游';return true;
    }catch{return false;}
  }
  loop(){
    requestAnimationFrame(()=>this.loop());const dt=Math.min(this.clock.getDelta(),.05);
    if(!this.paused){
      let subject=this.player;
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
        this.camera.lookAt(this.introFocus);this.scene.userData.cameraPosition=this.camera.position;this.applyPerception();
      }
      const info=this.targetInfo,size=info?.carrier?Math.max(1.5,this.camera.position.distanceTo(info.point)*.05):Math.max(SPECIES[this.target?.kind]?.radius||0,.5);
      this.world.update(dt,subject,this.target,info?.point||null,size);
      if(this.started)this.interactions.update(dt);
    }
    if(!this.paused||this.needsRender){this.renderer.render(this.scene,this.camera);this.needsRender=false;}
  }
}

async function boot(){
  try{
    const renderer=new THREE.WebGLRenderer({canvas:$('world'),antialias:true,alpha:false,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    await loadRuntimeConfig();
    const assets=new AssetLibrary();await assets.prepare();game=new Game(renderer,assets);await game.world.ready;game.collision.refresh();
    if(!game.hasSave)$('enter-label').textContent='进入旷野';$('enter').disabled=false;
    // Debug access is available only with ?debug; the normal product UI stays quiet.
    if(new URLSearchParams(location.search).has('debug'))window.__world=game;
  }catch(error){console.error(error);$('fallback').hidden=false;$('fallback-detail').textContent='这片世界暂时无法展开。请刷新，或使用支持 WebGL 2 的电脑浏览器。';}
}
boot();
