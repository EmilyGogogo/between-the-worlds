import { SPECIES } from '../src/species.js';

// Under water (2026-11-13): the riverbed dressing stays in the water, and with the eye below
// the surface the water is still drawn from below, the fog takes the water's colour from data,
// and the shafts and motes show; back on land they go away.
export function checkUnderwater(g,assert){
  const W=g.world,player=g.player,mode=g.cameraMode,yaw=g.yaw,pitch=g.pitch,snapshot=W.serialize();
  const decor=id=>W.decor.find(d=>d.slot.slotId===id)?.object;
  const weeds=decor('env.waterweeds'),pebbles=decor('env.pebbles');
  assert('waterweeds are placed on the beds',weeds?.userData.count>100,weeds?.userData.count);
  assert('every waterweed tip stays below the water surface',weeds&&weeds.userData.highestTipBelowSurface<0,weeds?.userData.highestTipBelowSurface);
  const pos=pebbles?.userData.positions||[],dry=pos.filter(([x,,z])=>W.waterDepth(x,z)<=0);
  assert('pebbles lie on the bed of every kind of water, none on dry ground',pos.length>100&&dry.length===0&&pos.some(([x,,z])=>W.water(x,z)?.type==='enclosed')&&pos.some(([x,,z])=>W.water(x,z)?.type!=='enclosed'),`${pos.length} placed, ${dry.length} dry`);
  const frames=(n,dt=.1)=>{for(let i=0;i<n;i++){g.updateCamera(dt);W.update(dt,g.player,null,null,1);}};
  try{
    const fish=W.entities.find(e=>SPECIES[e.kind].mode==='swim'&&W.water(e.root.position.x,e.root.position.z)?.type==='enclosed');
    g.player=fish;g.cameraMode='first_person';g.yaw=0;g.pitch=0;g.snapCamera=true;frames(60);
    const look=W.underwaterLook(W.water(fish.root.position.x,fish.root.position.z).id);
    assert('a fish eye in the lake is under water',g.scene.userData.underwater===true);
    assert('water surfaces stay drawn from below',W.sea.visible&&W.waterBodies.every(m=>m.visible));
    const lakeId=W.water(fish.root.position.x,fish.root.position.z).id;
    assert('only the lake the eye is in is drawn from below',W.waterMat.uniforms.below.value===0&&W.waterBodies.every((m,i)=>m.material.uniforms.below.value===(W.waterBodyIds[i]===lakeId?1:0)));
    const fog=g.scene.fog.color;
    assert('underwater fog takes the water colour from data',Math.hypot(fog.r-look.fogColor.r,fog.g-look.fogColor.g,fog.b-look.fogColor.b)<.03,
      `${g.scene.fog.color.getHexString()} vs ${look.fogColor.getHexString()}, density ${g.scene.fog.density.toFixed(4)}`);
    assert('underwater density follows data',Math.abs(g.scene.fog.density-look.fogDensity)<.002,g.scene.fog.density);
    assert('light shafts and motes show under water, below the surface',W.underwaterFx.visible&&W.underwaterFx.uniforms.surface.value>g.camera.position.y,
      `surface ${W.underwaterFx.uniforms.surface.value.toFixed(2)} eye ${g.camera.position.y.toFixed(2)}`);
    const human=W.entities.find(e=>SPECIES[e.kind].category==='human');
    g.player=human;g.cameraMode='third_person';g.snapCamera=true;frames(10);
    assert('back on land the underwater effects are gone',g.scene.userData.underwater===false&&!W.underwaterFx.visible);
    // Standing above the water at the far end of the island, where the river surface near the
    // centre is higher in island coordinates, every surface is still seen from above.
    const spit=W.entities.find(e=>SPECIES[e.kind].category==='human');
    let far=null;for(let x=560;x>300&&!far;x-=4)for(let z=-60;z<=60&&!far;z+=4)if(W.waterDepth(x,z)===0&&W.height(x,z)>-1.2)far={x,z};
    if(far){spit.root.position.set(far.x,W.height(far.x,far.z),far.z);g.snapCamera=true;frames(10);}
    assert('above water at the far end, no surface is drawn from below',Boolean(far)&&g.scene.userData.underwater===false&&W.waterMat.uniforms.below.value===0&&W.waterBodies.every(m=>m.material.uniforms.below.value===0),JSON.stringify(far));
  }finally{
    W.restore(snapshot);g.clearInput();g.player=player;g.cameraMode=mode;g.yaw=yaw;g.pitch=pitch;
    g.collision.refresh();g.snapCamera=true;g.updateCamera(0);
  }
}
