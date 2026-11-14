import * as THREE from 'three';
import { SPECIES, TUNING } from '../src/species.js';

// First-person senses of the gull and the two fish (2026-11-14): own colours and water, lens,
// body motion read from the animation, the silver hatchetfish's raised gaze, turn speeds,
// hearing from the body, the underwater sound bed and the body's own beats.
export function checkFirstPersonSenses(g,assert){
  const W=g.world,snapshot=W.serialize();
  const saved={player:g.player,mode:g.cameraMode,yaw:g.yaw,pitch:g.pitch,motion:TUNING.firstPersonMotionScale.value,lens:TUNING.firstPersonLensScale.value};
  const step=(n,dt=1/30)=>{for(let i=0;i<n;i++){g.elapsed+=dt;g.collision.refresh();if(!g.transition){g.move(dt);g.collision.refresh();}g.updateCamera(dt);W.update(dt,g.player,null,null,1);}};
  const take=(e,mode='third_person')=>{W.restore(snapshot);g.clearInput();g.player=e;g.transition=null;g.cameraMode=mode;g.yaw=0;g.pitch=mode==='first_person'?0:.3;g.collision.refresh();g.snapCamera=true;step(3);};
  const toggle=()=>{g.paused=false;const changed=g.toggleView();g.paused=true;return changed;};
  const swimmer=kind=>W.entities.find(e=>e.kind===kind&&W.water(e.root.position.x,e.root.position.z));
  // The lake school and the river discus have open water ahead of them (other fish may start near a shore).
  const gull=W.entities.find(e=>e.kind==='gull'),silver=W.byId.get('silverfish-0')||swimmer('silverfish'),discus=W.byId.get('discus-0')||swimmer('discus'),human=W.entities.find(e=>SPECIES[e.kind].category==='human');
  const near=(c,t,tol=.03)=>Math.hypot(c.r-t.r,c.g-t.g,c.b-t.b)<tol;
  // Eye offsets from the resting eye in the body's own frame, the beats felt, and the beats heard.
  const record=(e,frames,action=null)=>{
    const eye=new THREE.Vector3(...SPECIES[e.kind].firstPerson.eyeOffset),list=[],beats=[],sounds=[];
    g.clearInput();if(action)g.actions.add(action);
    for(let i=0;i<frames;i++){
      step(1);list.push(e.root.worldToLocal(g.camera.position.clone()).sub(eye));if(g.motion.beat)beats.push(g.motion.beat);
      g.updateAudio();if(g.audio.levels.stroke||g.audio.levels.wing)sounds.push(g.audio.levels.stroke?'stroke':'wing');
    }
    g.clearInput();
    const range=k=>Math.max(...list.map(o=>o[k]))-Math.min(...list.map(o=>o[k]));
    return {list,beats,sounds,range,min:k=>Math.min(...list.map(o=>o[k]))};
  };
  try{
    assert('fixtures: a gull, both fish in water and the human',Boolean(gull&&silver&&discus&&human));
    // Turning (item 21) and hearing (item 19) from data.
    assert('silver hatchetfish turns faster than the discus (260 / 130 deg/s)',SPECIES.silverfish.turnSpeed===260&&SPECIES.discus.turnSpeed===130);
    const hs=SPECIES.silverfish.hearing,hd=SPECIES.discus.hearing;
    assert('silver hatchetfish hears farther and clearer than the discus',hs.range>hd.range&&hs.underwaterLowpassHz>hd.underwaterLowpassHz&&hs.distantCueGain>hd.distantCueGain);
    // Colours and water (items 1-4).
    for(const e of [gull,silver,discus]){
      take(e,'first_person');step(60);
      const v=SPECIES[e.kind].vision,opacity=Number(document.getElementById('perception-tint').style.opacity);
      assert(`${e.kind}: first-person tint strength follows data`,Math.abs(opacity-(v.tint?(v.tintOpacity??.32):0))<.002,opacity);
      if(!v.underwaterFog)continue;
      const own=new THREE.Color(v.underwaterFog.color);
      assert(`${e.kind}: first person sees its own water colour and density`,g.scene.userData.underwater&&near(g.scene.fog.color,own)&&Math.abs(g.scene.fog.density-v.underwaterFog.density)<.003,
        `${g.scene.fog.color.getHexString()} ${g.scene.fog.density.toFixed(4)}`);
      assert(`${e.kind}: the underside of the water mirrors its own water colour`,near(W.waterMat.uniforms.uwColor.value,own)&&W.waterBodies.every(m=>near(m.material.uniforms.uwColor.value,own)));
      toggle();step(3);
      assert(`${e.kind}: third person keeps the shared water`,g.view.water.every(([w])=>w===null));
    }
    // A fish at the very top of its water still sees from inside it.
    for(const e of [silver,discus]){
      take(e,'first_person');const w=W.water(e.root.position.x,e.root.position.z);e.root.position.y=w.surface-SPECIES[e.kind].height*.7;g.snapCamera=true;step(3);
      assert(`${e.kind}: at the top of the water its first-person eye stays under the surface`,g.scene.userData.underwater===true,`eye ${W.islandRoot.worldToLocal(g.camera.position.clone()).y.toFixed(3)} surface ${w.surface.toFixed(3)}`);
    }
    // Lens (items 5-7).
    take(gull,'first_person');let L=g.currentLens();
    assert('gull first person: a wide flat lens of about 110 deg',Boolean(L)&&Math.abs(L.fieldDeg-110)<.5&&L.round===0&&L.curve>0,JSON.stringify(L));
    take(silver,'first_person');L=g.currentLens();
    assert('silver hatchetfish first person: a round fisheye fading into the water',Boolean(L)&&L.round===1&&L.curve===1&&L.fieldDeg>140&&L.fadeMax>0,JSON.stringify(L));
    toggle();step(2);assert('no lens in third person',!g.currentLens());
    take(human,'first_person');assert('no lens for the human in first person',!g.currentLens());
    take(discus,'first_person');TUNING.firstPersonLensScale.value=0;assert('lens scale 0 turns the lens off',!g.currentLens());TUNING.firstPersonLensScale.value=saved.lens;
    // Body motion (items 13-15), read from the animation.
    take(gull,'first_person');
    const glide=record(gull,90),flap=record(gull,90,'move_forward'),m=SPECIES.gull.firstPerson.motion;
    assert('gull: flapping lifts the eye in time with the wings, gliding only floats',flap.range('y')>.004&&glide.range('y')<=m.glideBobM*1.05+1e-4&&flap.beats.includes('wing')&&!glide.beats.length,
      `flap ${flap.range('y').toFixed(4)} glide ${glide.range('y').toFixed(4)} beats ${flap.beats.length}`);
    assert('gull: the eye is never lowered below its rest position',Math.min(flap.min('y'),glide.min('y'))>-1e-4);
    assert('gull: each downstroke has a soft wing sound, gliding none',flap.sounds.includes('wing')&&!glide.sounds.length,`${flap.sounds.length} / ${glide.sounds.length}`);
    TUNING.firstPersonMotionScale.value=0;const still=record(gull,30,'move_forward');TUNING.firstPersonMotionScale.value=saved.motion;
    assert('motion scale 0 keeps the first-person eye still',still.list.every(o=>o.length()<1e-5));
    take(gull);const third=record(gull,60,'move_forward');
    assert('gull: wing beats still sound in third person, which never sways',third.sounds.includes('wing')&&g.motion.offset.length()===0);
    const sway={};
    for(const e of [silver,discus]){
      // Mid-depth, so keeping the eye below the surface plays no part.
      take(e,'first_person');const mid=W.water(e.root.position.x,e.root.position.z);e.root.position.y=(mid.surface+mid.floor)/2;g.snapCamera=true;step(2);
      const start=e.root.position.clone(),swim=record(e,90,'move_forward');sway[e.kind]=swim.range('x');
      const moved=e.root.position.clone().sub(start);moved.y=0;
      assert(`${e.kind}: the eye sways sideways with its swim, never up or down`,swim.range('x')>1e-4&&swim.range('y')<1e-5,`x ${swim.range('x').toFixed(5)} y ${swim.range('y').toFixed(6)}`);
      assert(`${e.kind}: swaying does not turn the view or the way it swims`,g.yaw===0&&moved.normalize().dot(new THREE.Vector3(0,0,-1).applyQuaternion(e.root.parent.getWorldQuaternion(new THREE.Quaternion()).invert()).setY(0).normalize())>.99);
      assert(`${e.kind}: a push of water sounds with the tail beats`,swim.beats.includes('stroke')&&swim.sounds.includes('stroke'));
    }
    assert('the discus sways more than the silver hatchetfish',sway.discus>sway.silverfish,JSON.stringify(sway));
    // The silver hatchetfish's raised gaze (item 22).
    take(discus);toggle();const dp=g.pitch;take(silver);toggle();const sp=g.pitch;
    assert('silver hatchetfish looks 12 deg higher on entering first person',Math.abs(dp-sp-12*Math.PI/180)<1e-6,`${dp} ${sp}`);
    toggle();assert('leaving first person restores the third-person pitch',Math.abs(g.pitch-.3)<1e-6,g.pitch);
    take(discus,'first_person');g.pitch=0;
    g.transition={from:discus,to:silver,start:g.camera.position.clone(),startFocus:g.focusGoal.clone(),elapsed:0,duration:1};g.finishTransition();
    assert('possessing the silver hatchetfish in first person raises the gaze 12 deg',g.player===silver&&Math.abs(g.pitch+12*Math.PI/180)<1e-6,g.pitch);
    // Hearing from the body and the underwater bed (items 16, 18, 20).
    take(silver);const w=W.water(silver.root.position.x,silver.root.position.z);
    silver.root.position.y=w.surface-SPECIES.silverfish.height*.7;g.pitch=.6;g.snapCamera=true;step(5);g.updateAudio();
    const Ls=g.audio.levels;
    assert('a fish hears from its own body in the water, even with the camera above it',g.listenerState.underwater&&Ls.underwater&&Ls.water===1,`camera under water: ${g.scene.userData.underwater}`);
    assert('under water the wind and leaves give way to the water bed',Ls.wind<=hs.windGain*TUNING.underwaterAirGain.value*1.2&&Ls.drone>0);
    assert('just below the surface the lapping is heard',g.listenerState.surface>.5&&Ls.lap>0,g.listenerState.surface);
    assert('under water calls are filtered like the bed',Ls.cueCutoff===Ls.cutoff&&Ls.cutoff===hs.underwaterLowpassHz);
    // Only sounds crossing the surface are faint: a fish hears another fish at full level, a gull faintly.
    const otherFish=W.entities.find(b=>b!==silver&&SPECIES[b.kind].mode==='swim'&&g.sourceInWater(b));
    assert('under water a fish hears another fish at full level, a bird above faintly',Boolean(otherFish)&&g.cueCarry(g.sourceInWater(otherFish))===1&&g.cueCarry(g.sourceInWater(gull))===TUNING.underwaterAirCueGain.value);
    take(human);g.updateAudio();const La=g.audio.levels;
    assert('on land calls pass the body hearing at a wider cutoff',!g.listenerState.underwater&&La.water===0&&Math.abs(La.cueCutoff-SPECIES.human.hearing.airLowpassHz*TUNING.cueAirLowpassFactor.value)<1e-6);
    assert('on land a sound from under the water arrives faint',g.cueCarry(true)===TUNING.underwaterAirCueGain.value&&g.cueCarry(false)===1);
  }finally{
    TUNING.firstPersonMotionScale.value=saved.motion;TUNING.firstPersonLensScale.value=saved.lens;
    W.restore(snapshot);g.clearInput();g.transition=null;g.player=saved.player;g.cameraMode=saved.mode;g.yaw=saved.yaw;g.pitch=saved.pitch;
    g.collision.refresh();g.snapCamera=true;g.updateCamera(0);
  }
}
