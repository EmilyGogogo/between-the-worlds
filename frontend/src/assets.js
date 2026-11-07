import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SPECIES, TUNING, mulberry32 } from './species.js';

const standard = (color, extra={}) => new THREE.MeshStandardMaterial({color,roughness:.9,...extra});
const yellowMat = standard('#bca15d');
const barkCanvas = document.createElement('canvas');
barkCanvas.width=128;barkCanvas.height=256;
const ctx=barkCanvas.getContext('2d');
ctx.fillStyle='#655f48';ctx.fillRect(0,0,128,256);
const barkRandom=mulberry32(40);
for(let i=0;i<450;i++){ctx.strokeStyle=`rgba(${barkRandom()>.5?'33,38,26':'164,156,117'},${.1+barkRandom()*.3})`;ctx.lineWidth=.4+barkRandom()*2;const x=barkRandom()*128,y=barkRandom()*256;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(barkRandom()-.5)*5,y+10+barkRandom()*55);ctx.stroke();}
const barkTex=new THREE.CanvasTexture(barkCanvas);barkTex.colorSpace=THREE.SRGBColorSpace;barkTex.wrapS=barkTex.wrapT=THREE.RepeatWrapping;
const barkMat=standard('#aaa38c',{map:barkTex,bumpMap:barkTex,bumpScale:.06});
const rockMat=standard('#7b7f70');
const sphereGeo=new THREE.SphereGeometry(1,16,12);
const rockGeo=new THREE.IcosahedronGeometry(1,2);

function foliageTexture(pine=false){
  const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d'),r=mulberry32(pine?129:82);
  x.lineCap='round';x.strokeStyle='#555941';x.lineWidth=3;x.beginPath();x.moveTo(128,250);x.quadraticCurveTo(122,120,132,12);x.stroke();
  if(pine){
    for(let i=0;i<90;i++){const y=20+r()*220,side=i%2?1:-1;x.strokeStyle=['#60704f','#7a865c','#485e45'][i%3];x.lineWidth=1.7;x.beginPath();x.moveTo(128,y);x.lineTo(128+side*(25+r()*65),y-20-r()*45);x.stroke();}
  }else{
    for(let i=0;i<15;i++){const y=20+i*14,side=i%2?1:-1,cx=128+side*(22+r()*30);x.save();x.translate(cx,y);x.rotate(side*.65);x.fillStyle=['#697c54','#879165','#576e49','#76865b'][i%4];x.beginPath();x.ellipse(0,0,12+r()*8,23+r()*10,0,0,Math.PI*2);x.fill();x.strokeStyle='#a4aa7c';x.lineWidth=.6;x.beginPath();x.moveTo(0,24);x.lineTo(0,-24);x.stroke();x.restore();}
  }
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
const foliageMats=[false,true].map(pine=>new THREE.MeshStandardMaterial({map:foliageTexture(pine),color:'#d9decf',emissive:'#65744c',emissiveIntensity:.24,alphaTest:.15,alphaToCoverage:true,side:THREE.DoubleSide,roughness:.95}));
const cardGeometry=new THREE.PlaneGeometry(1,1);
const plantMergedMat=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.8});

function mergePlant(root){
  root.updateMatrixWorld(true);const geometries=[];
  for(const m of [...root.children]){
    m.traverse(child=>{
      if(!child.isMesh||child.material.isMeshPhysicalMaterial)return;
      const g=child.geometry.clone();g.applyMatrix4(child.matrixWorld);const c=child.material.color,colors=[];
      for(let i=0;i<g.attributes.position.count;i++)colors.push(c.r,c.g,c.b);
      g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometries.push(g);
    });
  }
  for(const m of [...root.children])if(!m.material?.isMeshPhysicalMaterial)root.remove(m);
  if(geometries.length){const merged=mergeGeometries(geometries);mesh(merged,plantMergedMat,root);for(const g of geometries)g.dispose();}
}

function mesh(geometry,material,parent,x=0,y=0,z=0,sx=1,sy=sx,sz=sx){
  const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function branch(parent, a,b,r1,r2,mat=barkMat){
  const d=new THREE.Vector3().subVectors(b,a);
  const m=mesh(new THREE.CylinderGeometry(r2,r1,d.length(),9),mat,parent);
  m.position.copy(a).addScaledVector(d,.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m;
}
function blade(height,width,bend){
  const pos=[],uv=[],indices=[];
  for(let i=0;i<=7;i++){const t=i/7,w=width*Math.pow(1-t,.7);pos.push(bend*t*t-w,height*t,0,bend*t*t+w,height*t,0);uv.push(0,t,1,t);if(i<7){let n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
function plant(seed){
  const root=new THREE.Group(),r=mulberry32(seed);
  const mats=['#4a6c2e','#6f883f','#8b9c4c','#426332'].map(c=>standard(c,{side:THREE.DoubleSide}));
  for(let i=0;i<13;i++){
    const m=mesh(blade(.3+r()*.4,.018+r()*.027,(r()-.5)*.6),mats[i%4],root,(r()-.5)*.22,0,(r()-.5)*.22);
    m.rotation.y=r()*Math.PI*2;m.rotation.z=(r()-.5)*.32;
  }
  const dew=new THREE.MeshPhysicalMaterial({color:'#e5f2d4',transmission:.75,roughness:.05,ior:1.33,thickness:.04,transparent:true,opacity:.8});
  mesh(sphereGeo,dew,root,.09,.47,.04,.026,.034,.026);
  mesh(sphereGeo,dew,root,-.06,.3,-.08,.014);
  mergePlant(root);root.userData.sway=.09;return root;
}
function tree(style,seed){
  const root=new THREE.Group(),r=mulberry32(seed);
  const pine=style==='pine';
  branch(root,new THREE.Vector3(),new THREE.Vector3(.35,pine?13:7.7,-.1),pine?.43:.52,.1);
  const cards=[],dummy=new THREE.Object3D();
  if(pine){
    for(let tier=0;tier<10;tier++)for(let b=0;b<7;b++){
      const angle=b/7*6.28+tier*.77,rad=(3.2-tier*.26)*(1+r()*.15),y=2+tier*1.15;
      const end=new THREE.Vector3(Math.sin(angle)*rad,y-.35,Math.cos(angle)*rad);
      branch(root,new THREE.Vector3(.15,y+.3,0),end,.045,.009);
      for(let n=0;n<16;n++){
        const f=.2+r()*.8;cards.push({x:end.x*f+(r()-.5)*.7,y:y+(r()-.5)*.9,z:end.z*f+(r()-.5)*.7,size:.7+r()*.7,rx:1+r(),ry:angle+r()*.8,rz:r()});
      }
    }
  }else{
    for(let i=0;i<10;i++){
      const a=i*2.4,rad=1.3+r()*1.7,y=5+r()*3.5;
      const end=new THREE.Vector3(Math.sin(a)*rad,y,Math.cos(a)*rad);
      branch(root,new THREE.Vector3(.2,y*.63,0),end,.15,.035);
      for(let n=0;n<48;n++){
        const u=r()*6.28,v=Math.acos(2*r()-1),rad2=Math.cbrt(r())*2.2;
        cards.push({x:end.x+Math.sin(v)*Math.cos(u)*rad2,y:end.y+.6+Math.cos(v)*rad2*.7,z:end.z+Math.sin(v)*Math.sin(u)*rad2,size:.6+r()*.65,rx:r()*3,ry:r()*6.28,rz:r()*3});
      }
    }
  }
  // Merge bark into one draw and instance detailed leaf sprays in one draw.
  root.updateMatrixWorld(true);const barkGeometries=[];
  for(const child of [...root.children])if(child.isMesh){const g=child.geometry.clone();g.applyMatrix4(child.matrix);barkGeometries.push(g);root.remove(child);child.geometry.dispose();}
  if(barkGeometries.length){const merged=mergeGeometries(barkGeometries);mesh(merged,barkMat,root);for(const g of barkGeometries)g.dispose();}
  const leaves=new THREE.InstancedMesh(cardGeometry,foliageMats[pine?1:0],cards.length);
  for(let i=0;i<cards.length;i++){const c=cards[i];dummy.position.set(c.x,c.y,c.z);dummy.rotation.set(c.rx,c.ry,c.rz);dummy.scale.setScalar(c.size);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);leaves.setColorAt(i,new THREE.Color().setScalar(.76+r()*.3));}
  leaves.castShadow=true;leaves.receiveShadow=true;root.add(leaves);
  root.userData.sway=.004;return root;
}
function bird(style){
  const root=new THREE.Group(),tern=style==='tern';
  const white=standard(tern?'#deded4':'#e9e7dc'),grey=standard('#858e87'),dark=standard('#353d39');
  mesh(sphereGeo,white,root,0,.15,0,.2,.23,.51);
  mesh(sphereGeo,white,root,0,.35,-.35,.17,.18,.18);
  mesh(new THREE.ConeGeometry(.045,.22,8),yellowMat,root,0,.32,-.57).rotation.x=-Math.PI/2;
  for(let side of [-1,1]){
    mesh(sphereGeo,dark,root,side*.143,.38,-.42,.025);
    const pivot=new THREE.Group();pivot.position.set(side*.12,.25,0);root.add(pivot);
    const shape=new THREE.Shape();shape.moveTo(0,-.25);shape.bezierCurveTo(.25,-.3,.8,-.05,1.18,.25);shape.bezierCurveTo(.8,.2,.45,.55,0,.2);shape.closePath();
    const wing=mesh(new THREE.ShapeGeometry(shape,12),grey,pivot);wing.rotation.x=-Math.PI/2;wing.scale.x=side;
    for(let i=0;i<5;i++){const f=mesh(sphereGeo,i>2?dark:grey,pivot,side*(.5+i*.12),-.01,.12+i*.055,.07,.018,.23);f.rotation.y=-side*.3;}
    root.userData[side===1?'rightWing':'leftWing']=pivot;
  }
  for(let side of [-1,1])mesh(sphereGeo,white,root,side*.09,.13,.51,.07,.025,tern?.35:.22).rotation.y=side*.15;
  root.userData.bird=true;return root;
}
function fish(style){
  const root=new THREE.Group(),butterfly=style==='butterfly';
  let color=butterfly?'#d9b844':style==='perch'?'#819178':'#bac9ba';
  const bodyMat=standard(color,{metalness:.22,roughness:.36});
  if(butterfly){
    const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.fillStyle='#ddc05a';x.fillRect(0,0,128,128);x.fillStyle='#343c39';x.fillRect(27,0,12,128);x.fillRect(79,0,8,128);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;bodyMat.map=t;
  }
  mesh(sphereGeo,bodyMat,root,0,.22,0,.11,butterfly?.23:.14,butterfly?.3:.43);
  const tail=new THREE.Group();tail.position.set(0,.22,.35);root.add(tail);
  const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(.17,.26);shape.lineTo(-.17,.26);shape.closePath();
  const finMat=standard(color,{side:THREE.DoubleSide,transparent:true,opacity:.83});
  const tailMesh=mesh(new THREE.ShapeGeometry(shape),finMat,tail);tailMesh.rotation.set(0,Math.PI/2,Math.PI/2);
  for(let side of [-1,1]){
    mesh(sphereGeo,standard('#d2bc6e'),root,side*.082,.27,-.25,.036);
    mesh(sphereGeo,standard('#192f2d'),root,side*.106,.27,-.265,.02);
    mesh(sphereGeo,finMat,root,side*.13,.17,-.05,.12,.02,.13).rotation.z=side*.3;
  }
  root.userData.tail=tail;root.userData.fish=true;return root;
}
function human(){
  const root=new THREE.Group(),cloth=standard('#a4afa0'),trousers=standard('#566a63'),skin=standard('#c9ad90');
  mesh(sphereGeo,cloth,root,0,1.12,0,.25,.36,.16);
  mesh(sphereGeo,skin,root,0,1.58,-.015,.15,.19,.145);
  const limbs=[];
  for(const side of [-1,1]){
    const leg=new THREE.Group();leg.position.set(side*.12,.82,0);root.add(leg);mesh(new THREE.CylinderGeometry(.065,.075,.7,8),trousers,leg,0,-.34,0);mesh(sphereGeo,trousers,leg,0,-.72,-.07,.085,.055,.14);limbs.push(leg);
    const arm=new THREE.Group();arm.position.set(side*.27,1.32,0);root.add(arm);mesh(new THREE.CylinderGeometry(.055,.05,.59,8),cloth,arm,side*.04,-.28,0);mesh(sphereGeo,skin,arm,side*.04,-.59,0,.055,.07,.055);limbs.push(arm);
  }
  root.userData.limbs=limbs;return root;
}
function dog(){
  const root=new THREE.Group(),fur=standard('#a68a66'),dark=standard('#353e35');
  mesh(sphereGeo,fur,root,0,.48,0,.25,.25,.43);
  mesh(sphereGeo,fur,root,0,.71,-.42,.19,.21,.22);
  mesh(sphereGeo,fur,root,0,.62,-.61,.12,.09,.19);mesh(sphereGeo,dark,root,0,.64,-.77,.06,.04,.035);
  const legs=[];
  for(const x of [-.16,.16])for(const z of [-.28,.27]){
    const leg=new THREE.Group();leg.position.set(x,.42,z);root.add(leg);mesh(new THREE.CylinderGeometry(.055,.04,.39,7),fur,leg,0,-.18,0);mesh(sphereGeo,fur,leg,0,-.36,-.035,.07,.045,.1);legs.push(leg);
  }
  for(const x of [-.13,.13]){mesh(new THREE.ConeGeometry(.09,.23,5),fur,root,x,.91,-.4);mesh(sphereGeo,dark,root,x,.74,-.57,.024);}
  const tail=mesh(new THREE.CylinderGeometry(.035,.06,.4,8),fur,root,0,.66,.5);tail.rotation.x=-.7;
  root.userData.limbs=legs;root.userData.dogTail=tail;return root;
}
export function makeRock(seed=1,scale=1){
  const r=mulberry32(seed),geo=rockGeo.clone(),p=geo.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);const n=1+.13*Math.sin(x*8+z*5)+.1*Math.cos(y*7+x*4);p.setXYZ(i,x*n,y*n,z*n);}geo.computeVertexNormals();
  const root=new THREE.Group();const m=mesh(geo,rockMat,root,0,.7*scale,0,1.45*scale,1*scale,1.1*scale);m.rotation.y=r()*6.28;return root;
}
function hill(seed){
  const root=new THREE.Group(),r=mulberry32(seed),geo=new THREE.SphereGeometry(1,42,28),p=geo.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);const n=1+.09*Math.sin(x*13+z*5)*Math.cos(y*7);p.setXYZ(i,x*n,y*n,z*n);}geo.computeVertexNormals();
  const colors=[];for(let i=0;i<p.count;i++){const c=new THREE.Color(p.getY(i)>.55?'#95978a':'#7e8c65');c.multiplyScalar(.96+.06*Math.sin(p.getX(i)*40));colors.push(c.r,c.g,c.b);}geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}),root,0,0,0,67,72,58);
  for(let i=0;i<9;i++){const rock=makeRock(19+i+seed%7,3+r()*5);rock.position.set((r()-.5)*100,4,(r()-.5)*95);root.add(rock);}
  return root;
}
function dome(s){
  const [rx,h,rz]=s.surface?.radii||[s.radius,s.height,s.radius];
  const root=new THREE.Group();mesh(new THREE.SphereGeometry(1,32,20),standard('#819364',{roughness:1}),root,0,0,0,rx,h,rz);return root;
}
// Any body without a generator still gets a visible, correctly sized stand-in.
function generic(s){
  const root=new THREE.Group(),r=Math.max(.05,s.radius*.7),h=Math.max(s.height-2*r,0);
  mesh(new THREE.CapsuleGeometry(r,h,4,10),standard('#a9ae98'),root,0,s.height/2,0);return root;
}
// Placeholder generators, keyed by the name in an asset slot's "placeholder"
// field ("procedural:<name>"). A new species reuses its category's generator
// and picks a look with "placeholderStyle"; a new category can add one here.
const PLACEHOLDERS={
  grass:(style,seed)=>plant(seed),
  tree:(style,seed)=>tree(style,seed),
  rock:(style,seed)=>style==='hill'?hill(seed):makeRock(seed),
  island:(style,seed,s)=>dome(s),
  human:()=>human(),
  dog:()=>dog(),
  bird:style=>bird(style),
  fish:style=>fish(style),
};
export function registerPlaceholder(name,make){PLACEHOLDERS[name]=make;}
export function makeProcedural(kind,seed=1,entry={}){
  const s=SPECIES[kind],name=(entry?.placeholder||`procedural:${s.category}`).replace('procedural:','');
  const make=PLACEHOLDERS[name];
  return make?make(entry?.placeholderStyle,seed,s):generic(s);
}

const UP=new THREE.Vector3(0,1,0);
const timeout=()=>new Promise((_,reject)=>setTimeout(()=>reject(new Error('Model load timeout')),(TUNING.loadTimeoutSec?.value??10)*1000));

// Loads every asset slot: a main url plus variants, each optionally with LOD
// levels. Any slot that fails falls back to its placeholder (L-03).
export class AssetLibrary {
  constructor(){this.loader=new GLTFLoader();this.manifest={species:{},decor:[]};this.templates=new Map();this.decorTemplates=new Map();this.mixers=[];this.errors=[];}
  async prepare(manifest=null){
    if(manifest)this.manifest=manifest;
    else try{const r=await fetch('./public/models/manifest.json');if(!r.ok)throw Error(`Manifest ${r.status}`);this.manifest=await r.json();}
    catch(e){this.errors.push(String(e));console.warn('Asset manifest unavailable; using prototype models.',e);}
    const jobs=[];
    for(const [kind,entry] of Object.entries(this.manifest.species||{}))jobs.push(this.loadSlot(kind,entry).then(list=>{if(list.length)this.templates.set(kind,list);}));
    for(const slot of this.manifest.decor||[])jobs.push(this.loadSlot(slot.slotId,slot).then(list=>{if(list.length)this.decorTemplates.set(slot.slotId,list);}));
    await Promise.all(jobs);
  }
  load(url){return Promise.race([this.loader.loadAsync(url),timeout()]);}
  // Variants are strings or objects that override height, rotation, animations, lod or weight.
  async loadSlot(name,entry){
    const sources=[...(entry.url?[{url:entry.url}]:[]),...(entry.variants||[]).map(v=>typeof v==='string'?{url:v}:v)];
    const loaded=await Promise.all(sources.map(async source=>{
      const merged={...entry,...source};
      try{
        const gltf=await this.load(merged.url);
        const [idle,run,swim]=await Promise.all([merged.idleUrl?this.load(merged.idleUrl):null,merged.runUrl?this.load(merged.runUrl):null,merged.swimUrl?this.load(merged.swimUrl):null]);
        const lod=await Promise.all((merged.lod||[]).map(async level=>({distance:level.distance,gltf:await this.load(level.url)})));
        return {gltf,idle,run,swim,entry:merged,lod,weight:merged.weight??1};
      }catch(e){this.errors.push(`${name} ${merged.url}: ${e.message}`);console.warn(`Asset ${name} kept its placeholder:`,e);return null;}
    }));
    return loaded.filter(Boolean);
  }
  hasModel(kind){return this.templates.has(kind);}
  // Deterministic weighted choice, so each individual keeps its look across reloads.
  pick(list,random){
    let roll=random()*list.reduce((sum,t)=>sum+t.weight,0);
    for(const t of list){roll-=t.weight;if(roll<=0)return t;}
    return list[list.length-1];
  }
  fit(model,entry,height){
    if(entry.rotation)model.rotation.fromArray(entry.rotation);
    model.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
    const factor=(entry.height||height)/Math.max(size.y,.0001);
    // Bodies stand on their base; islands keep the file's own sea-level origin (L-05).
    const baseY=entry.pivot==='sea_level_center'?0:bounds.min.y;
    model.scale.multiplyScalar(factor);model.position.set(-center.x*factor,-baseY*factor,-center.z*factor);
  }
  make(kind,seed){
    const list=this.templates.get(kind);
    if(!list)return makeProcedural(kind,seed,this.manifest.species?.[kind]);
    const template=this.pick(list,mulberry32(seed)),entry=template.entry;
    const root=new THREE.Group(),model=clone(template.gltf.scene);
    this.fit(model,entry,SPECIES[kind].height);
    if(template.lod.length){
      // Far away, a simpler model stands in (LOD); the full model keeps the animation.
      const lod=new THREE.LOD();lod.addLevel(model,0);
      for(const level of template.lod){const far=level.gltf.scene.clone();this.fit(far,entry,SPECIES[kind].height);lod.addLevel(far,level.distance);}
      root.add(lod);
    }else root.add(model);
    let idleModel=null;
    if(template.idle){idleModel=clone(template.idle.scene);this.fit(idleModel,entry,SPECIES[kind].height);root.add(idleModel);model.visible=false;}
    root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    if(template.gltf.animations.length){
      const mixer=new THREE.AnimationMixer(model),actions={};
      for(const [role,name] of Object.entries(entry.animations||{})){const clips=role==='run'&&template.run?template.run.animations:role==='swim'&&template.swim?template.swim.animations:template.gltf.animations;let clip=THREE.AnimationClip.findByName(clips,name);
        if(clip&&template.idle&&(role==='move'||role==='run'||role==='swim')){clip=clip.clone();for(const track of clip.tracks){if(!/Hips\.position$/i.test(track.name))continue;for(let i=3;i<track.values.length;i+=3){track.values[i]=track.values[0];track.values[i+2]=track.values[2];}}}
        if(clip)actions[role]=mixer.clipAction(clip);}
      if(!actions.idle)actions.idle=mixer.clipAction(template.gltf.animations[0]);
      actions.idle.play();
      if(actions.idle===actions.move)actions.idle.paused=true;
      root.userData.animation={mixer,actions,current:'idle',model,idleModel};this.mixers.push(root);
    }
    root.updateMatrixWorld(true);root.userData.localBounds=new THREE.Box3().setFromObject(model);
    root.userData.collisionBoxes=entry.collisionBoxes;root.userData.external=true;root.userData.variant=entry.url;return root;
  }
  hasDecor(slotId){return this.decorTemplates.has(slotId);}
  // Scattered decoration from GLB: one instanced draw per mesh per variant.
  // placements: [{position:[x,y,z], rotationY, scale}] in the carrier's frame.
  makeDecor(slot,placements){
    const list=this.decorTemplates.get(slot.slotId),group=new THREE.Group(),random=mulberry32(slot.scatter?.seed??1);
    const buckets=list.map(()=>[]);for(const p of placements)buckets[list.indexOf(this.pick(list,random))].push(p);
    const m=new THREE.Matrix4(),q=new THREE.Quaternion(),v=new THREE.Vector3(),scale=new THREE.Vector3();
    list.forEach((template,index)=>{
      const mine=buckets[index];if(!mine.length)return;
      const model=template.gltf.scene.clone();this.fit(model,template.entry,slot.height);model.updateMatrixWorld(true);
      model.traverse(o=>{
        if(!o.isMesh)return;const instanced=new THREE.InstancedMesh(o.geometry,o.material,mine.length);
        mine.forEach((p,i)=>{m.compose(v.fromArray(p.position),q.setFromAxisAngle(UP,p.rotationY),scale.setScalar(p.scale));m.multiply(o.matrixWorld);instanced.setMatrixAt(i,m);});
        instanced.computeBoundingSphere();instanced.castShadow=true;instanced.receiveShadow=true;group.add(instanced);
      });
    });
    return group;
  }
  update(dt){
    for(const root of this.mixers){const a=root.userData.animation,desired=root.userData.swimming&&a.actions.swim?'swim':root.userData.moving&&a.actions.move?(root.userData.boosting&&a.actions.run?'run':'move'):'idle';
      if(a.idleModel){a.idleModel.visible=desired==='idle';a.model.visible=desired!=='idle';}
      if(a.current!==desired){
        const previous=a.actions[a.current],next=a.actions[desired];
        if(previous!==next){previous?.fadeOut(.3);next.reset().fadeIn(.3).play();}
        if(next===a.actions.move&&next===a.actions.idle){next.paused=desired==='idle';if(next.paused)next.time=0;}
        next.setEffectiveTimeScale(desired==='run'&&next===a.actions.move?1.5:1);a.current=desired;
      }
      if(a.idleModel&&desired!=='idle')a.actions[desired].setEffectiveTimeScale(desired==='swim'&&!root.userData.moving?1:Math.max(.05,Math.min(1,root.userData.movementRatio??1)));
      a.mixer.update(dt);
    }
  }
}
