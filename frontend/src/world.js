import * as THREE from 'three';
import { SPECIES, TUNING, LAYOUT, WATERS, inRegion, mulberry32, layerOf } from './species.js';
import { makeRock } from './assets.js';
import { AmbientMotion } from './ambient.js';

export const PLANET_RADIUS=7500;
const UP=new THREE.Vector3(0,1,0);
const smooth=(a,b,x)=>{const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
function hash(x,z){return (Math.sin(x*127.1+z*311.7)*43758.5453123)%1;}
function noise(x,z){const a=Math.floor(x),b=Math.floor(z),u=smooth(0,1,x-a),v=smooth(0,1,z-b);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(a,b),hash(a+1,b),u),THREE.MathUtils.lerp(hash(a,b+1),hash(a+1,b+1),u),v);}
export function terrainHeight(x,z){
  const radius=Math.hypot(x/430,z/350);
  let h=8+Math.sin(x*.024)*2.5+Math.cos(z*.031)*2+noise(x*.025,z*.025)*3;
  // The large rocky hill is its own movable body, not a baked terrain duplicate.
  h+=37*Math.exp(-((x+180)**2/12000+(z+185)**2/7000));
  // Placeholder terrain carves each enclosed water body's basin; a GLB terrain brings its own.
  for(const r of WATERS){const b=r.water.basin;if(b)h-=b.depthM*Math.exp(-((x-r.center[0])**2/(2*b.falloffM[0]**2)+(z-r.center[1])**2/(2*b.falloffM[1]**2)));}
  h=THREE.MathUtils.lerp(h,-12,smooth(.73,1.03,radius));
  return h-(x*x+z*z)/(2*PLANET_RADIUS);
}

function createTerrain(){
  const geo=new THREE.PlaneGeometry(960,820,190,164);geo.rotateX(-Math.PI/2);
  const p=geo.attributes.position,colors=[];
  const green=new THREE.Color('#83916d'),sand=new THREE.Color('#c1ba9b'),rock=new THREE.Color('#899184'),dark=new THREE.Color('#74845e');
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i),y=terrainHeight(x,z);p.setY(i,y);
    const c=green.clone().lerp(dark,.2+.2*Math.sin(x*.07+z*.03));
    c.lerp(sand,1-smooth(-2,6,y));
    c.lerp(rock,smooth(34,65,y)*.65);
    const path=Math.abs(x-14-Math.sin(z*.017)*23);
    c.lerp(sand,(1-smooth(1,5,path))*.33);
    c.multiplyScalar(.94+.07*noise(x*.11,z*.11));colors.push(c.r,c.g,c.b);
  }
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
  const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');const img=ctx.createImageData(256,256),r=mulberry32(273);
  for(let i=0;i<img.data.length;i+=4){const n=170+r()*55;img.data[i]=n;img.data[i+1]=n+5;img.data[i+2]=n-8;img.data[i+3]=255;}ctx.putImageData(img,0,0);
  const tex=new THREE.CanvasTexture(c);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(100,85);tex.colorSpace=THREE.SRGBColorSpace;
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,map:tex,bumpMap:tex,bumpScale:.075,roughness:1});
  const mesh=new THREE.Mesh(geo,mat);mesh.receiveShadow=true;return mesh;
}

const waterVertex=`varying vec3 vWorld;varying vec3 vNormal;uniform float time;void main(){vec3 p=position;p.y+=sin(p.x*.23+time*.7)*.045+sin(p.z*.31-time*.5)*.035;vec4 w=modelMatrix*vec4(p,1.);vWorld=w.xyz;vNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*w;}`;
const waterFragment=`varying vec3 vWorld;varying vec3 vNormal;uniform float time;uniform vec3 deep;uniform vec3 sky;uniform float alpha;void main(){vec3 view=normalize(cameraPosition-vWorld);float fres=pow(1.-max(dot(view,vNormal),0.),3.);float w=sin(vWorld.x*.48+vWorld.z*.25+time*.8)*sin(vWorld.z*.55-time*.5);float fine=pow(max(0.,w),18.);vec3 c=mix(deep,sky,.18+fres*.72);c+=vec3(.32,.29,.19)*fine*.2;gl_FragColor=vec4(c,alpha);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
function waterMaterial(alpha=1){return new THREE.ShaderMaterial({uniforms:{time:{value:0},deep:{value:new THREE.Color('#377b76')},sky:{value:new THREE.Color('#c6d6c0')},alpha:{value:alpha}},vertexShader:waterVertex,fragmentShader:waterFragment,transparent:alpha<1,side:THREE.DoubleSide,depthWrite:alpha===1});}

// Seeds come from ids, so each individual keeps its model variant when others are added or removed.
function seedOf(id){let seed=2166136261;for(const c of id)seed=Math.imul(seed^c.charCodeAt(0),16777619);return seed>>>0;}
// Whether a scatter group may place something at a point (surface band and regions).
function scatterAllows(group,x,y,z){
  return (group.surfaceMin==null||y>=group.surfaceMin)&&(group.surfaceMax==null||y<=group.surfaceMax)
    &&!(group.avoidRegions||[]).some(id=>inRegion(id,x,z))&&(!group.insideRegion||inRegion(group.insideRegion,x,z));
}
// Placeholder for the env.meadow slot: one wind-bent blade per scattered point.
function createMeadow(scatter){
  const r=mulberry32(scatter.seed??7),positions=[],colors=[],indices=[],a=new THREE.Color();
  for(const area of scatter.areas)for(let i=0;i<area.count;i++){
    const x=area.center[0]+(r()-.5)*area.size[0],z=area.center[1]+(r()-.5)*area.size[1],y=terrainHeight(x,z);
    if(!scatterAllows(scatter,x,y,z))continue;
    const h=.15+r()*.38,w=.014+r()*.028,angle=r()*6.28,dx=Math.cos(angle)*w,dz=Math.sin(angle)*w,bend=.08+r()*.17;
    const n=positions.length/3;
    positions.push(x-dx,y,z-dz,x+dx,y,z+dz,x+dx*.5+bend,y+h*.6,z+dz*.5,x-dx*.5+bend,y+h*.6,z-dz*.5,x+bend*1.8,y+h,z);
    a.setHSL(.20+r()*.055,.22+r()*.14,.22+r()*.15);
    for(let j=0;j<5;j++){const light=.72+j*.08;colors.push(a.r*light,a.g*light,a.b*light);}
    indices.push(n,n+1,n+2,n,n+2,n+3,n+3,n+2,n+4);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.9});
  const wind={value:0};mat.onBeforeCompile=shader=>{shader.uniforms.windTime=wind;shader.vertexShader='uniform float windTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
float breeze=sin(position.x*.15+position.z*.21+windTime*.85)*.11;transformed.x+=breeze*pow(mod(float(gl_VertexID),5.)/4.,2.);`);};
  const mesh=new THREE.Mesh(geo,mat);mesh.receiveShadow=true;mesh.userData.wind=wind;return mesh;
}

export class World {
  constructor(scene,assets){
    this.scene=scene;this.assets=assets;this.entities=[];this.byId=new Map();this.byRoot=new Map();this.decor=[];this.time=0;this.externalTerrain=null;this.surfaceRay=new THREE.Raycaster();
    this.planetRoot=new THREE.Group();this.planetRoot.position.y=-PLANET_RADIUS;scene.add(this.planetRoot);
    // The ocean coordinate frame is inert; no playable planets in this version.
    this.islandRoot=new THREE.Group();this.islandRoot.position.y=PLANET_RADIUS;this.planetRoot.add(this.islandRoot);
    const mainKind=LAYOUT.instances.find(i=>i.placement==='main')?.kind;
    this.terrain=mainKind&&assets.hasModel(mainKind)?assets.make(mainKind,1):createTerrain();this.islandRoot.add(this.terrain);
    if(mainKind&&assets.hasModel(mainKind))this.externalTerrain=this.terrain;
    this.islandRoot.updateWorldMatrix(true,true);
    this.waterMat=waterMaterial();
    const waterGeo=new THREE.PlaneGeometry(12000,12000,150,150);waterGeo.rotateX(-Math.PI/2);
    const sea=WATERS.find(r=>r.water.type==='sea');this.seaLevel=sea.water.levelM;
    const p=waterGeo.attributes.position;for(let i=0;i<p.count;i++){const r2=p.getX(i)**2+p.getZ(i)**2;p.setY(i,Math.sqrt(Math.max(0,PLANET_RADIUS**2-r2))-PLANET_RADIUS+this.seaLevel);}waterGeo.computeVertexNormals();
    this.sea=new THREE.Mesh(waterGeo,this.waterMat);this.sea.position.y=PLANET_RADIUS;this.planetRoot.add(this.sea);
    this.waterBodies=WATERS.filter(r=>r.water.type==='enclosed').map(r=>{
      const mesh=new THREE.Mesh(new THREE.CircleGeometry(1,80),waterMaterial(r.water.opacity??1));mesh.rotation.x=-Math.PI/2;
      mesh.scale.set(r.radii[0],r.radii[1],1);mesh.position.set(r.center[0],r.water.surfaceY,r.center[1]);this.islandRoot.add(mesh);return mesh;
    });
    this.populate();this.createDecor();this.createSky();this.createRipples();
    this.ready=this.loadEnvironment();scene.updateMatrixWorld(true);
  }
  addBody(id,kind,root,visual){
    if(this.byId.has(id))throw new Error(`Duplicate body id: ${id}`);
    const entity={id,kind,root,visual,heading:0,moving:false,baseY:root.position.y,groundOffset:root.position.y-terrainHeight(root.position.x,root.position.z),seed:this.entities.length,home:root.position.clone(),homeRotation:[root.rotation.x,root.rotation.y,root.rotation.z],homeBaseY:root.position.y};
    this.entities.push(entity);this.byId.set(id,entity);this.byRoot.set(root,entity);return entity;
  }
  spawn(kind,x,y,z,id,parent,random=false){
    const root=new THREE.Group();root.position.set(x,y,z);parent.add(root);
    const visual=this.assets.make(kind,seedOf(id));root.add(visual);
    const entity=this.addBody(id,kind,root,visual);entity.random=random;return entity;
  }
  // World layout comes from data/anchors.json: named instances, then scatter groups (W-08).
  populate(){
    for(const item of LAYOUT.instances)this.place(item,item.id,item.position);
    for(const group of LAYOUT.scatter)this.scatter(group);
  }
  place(item,id,position,random=false){
    if(item.placement==='main')return this.addBody(id,item.kind,this.islandRoot,this.terrain);
    const [x,dy,z]=position;
    if(item.carrier==='ocean'){
      const root=new THREE.Group(),y=Math.sqrt(Math.max(0,PLANET_RADIUS**2-x*x-z*z));
      root.position.set(x,y,z);root.quaternion.setFromUnitVectors(UP,root.position.clone().normalize());this.planetRoot.add(root);
      const visual=this.assets.make(item.kind,seedOf(id));root.add(visual);
      const e=this.addBody(id,item.kind,root,visual);e.random=random;return e;
    }
    const carrier=this.byId.get(item.carrier);if(!carrier)throw new Error(`Unknown carrier ${item.carrier} for ${id}`);
    const surface=item.placement==='surface';
    const e=this.spawn(item.kind,x,surface?this.surfaceOf(carrier,x,z)+dy:dy,z,id,carrier.root,random);
    if(surface)e.surfaceOffset=dy;return e;
  }
  scatter(group){
    const r=mulberry32(group.seed??1),carrier=this.byId.get(group.carrier);let n=0;
    const points=group.points||[];
    if(group.area)for(let tries=0;n+points.length<group.count&&tries<group.count*8;tries++){
      const x=group.area.center[0]+(r()-.5)*group.area.size[0],z=group.area.center[1]+(r()-.5)*group.area.size[1];
      if(!scatterAllows(group,x,this.surfaceOf(carrier,x,z),z))continue;
      this.place(group,`${group.id}-${n++}`,[x,0,z],true);
    }
    // Points are [x,z] on the surface, or [x,y,z] with y as the height offset or fixed height.
    for(const pt of points)this.place(group,`${group.id}-${n++}`,pt.length===3?pt:[pt[0],0,pt[1]],true);
  }
  // Height of a carrier's surface at a point in its own frame.
  surfaceOf(carrier,x,z){
    if(!carrier||carrier.root===this.islandRoot)return this.height(x,z);
    if(carrier.visual?.userData.external){
      carrier.root.updateMatrixWorld(true);
      this.surfaceRay.set(carrier.root.localToWorld(new THREE.Vector3(x,5000,z)),new THREE.Vector3(0,-1,0).transformDirection(carrier.root.matrixWorld));
      const hit=this.surfaceRay.intersectObject(carrier.visual,true)[0];
      return hit?carrier.root.worldToLocal(hit.point.clone()).y:0;
    }
    const d=SPECIES[carrier.kind].surface;
    if(d?.type==='dome'){const [rx,h,rz]=d.radii;return h*Math.sqrt(Math.max(0,1-(x/rx)**2-(z/rz)**2));}
    return 0;
  }
  // Decoration slots (env.meadow, env.pebbles…): GLB instances when a model is set, otherwise placeholders.
  createDecor(){
    for(const slot of this.assets.manifest.decor||[]){
      const carrier=this.byId.get(slot.scatter.carrier);if(!carrier)continue;
      let object=null,procedural=false;
      if(this.assets.hasDecor(slot.slotId)){
        const r=mulberry32(slot.scatter.seed??1),placements=[],[lo,hi]=slot.scaleRange||[1,1];
        for(const area of slot.scatter.areas)for(let i=0;i<area.count;i++){
          const x=area.center[0]+(r()-.5)*area.size[0],z=area.center[1]+(r()-.5)*area.size[1],y=this.surfaceOf(carrier,x,z);
          if(scatterAllows(slot.scatter,x,y,z))placements.push({position:[x,y,z],rotationY:r()*Math.PI*2,scale:lo+(hi-lo)*r()});
        }
        object=this.assets.makeDecor(slot,placements);
      }else if(slot.placeholder==='procedural:meadow'){object=createMeadow(slot.scatter);procedural=true;}
      else if(slot.placeholder==='procedural:pebble'){
        object=new THREE.Group();procedural=true;const r=mulberry32(slot.scatter.seed??500);
        for(const area of slot.scatter.areas)for(let i=0;i<area.count;i++){
          const x=area.center[0]+(r()-.5)*area.size[0],z=area.center[1]+(r()-.5)*area.size[1];
          const rock=makeRock(i+500,.15+r()*.45);rock.position.set(x,this.height(x,z),z);object.add(rock);
        }
      }
      if(object){carrier.root.add(object);this.decor.push({slot,object,procedural});}
    }
  }
  // Random scenery must not start inside another solid body (M-01); named bodies stay.
  prune(collision){
    for(let pass=0;pass<4;pass++){
      collision.refresh();
      const e=this.entities.find(e=>e.random&&SPECIES[e.kind].collision.solid&&collision.collides(e,this.position(e)));
      if(!e)return;
      e.root.removeFromParent();this.entities.splice(this.entities.indexOf(e),1);this.byId.delete(e.id);this.byRoot.delete(e.root);pass=-1;
    }
  }
  carrierOf(entity){return this.byRoot.get(entity.root.parent)||null;}
  // Water body under a point of the main island, in island-local metres: an enclosed body
  // whose shape contains the point, else the sea where it is deep enough.
  water(x,z){
    const floor=this.height(x,z);let sea=null;
    for(const r of WATERS){
      if(r.water.type==='sea')sea=r;
      else if(inRegion(r.id,x,z))return {id:r.id,type:r.water.type,surface:r.water.surfaceY,floor};
    }
    if(!sea)return null;
    const surface=-(x*x+z*z)/(2*PLANET_RADIUS)+sea.water.levelM;
    return floor<surface-sea.water.minDepthM?{id:sea.id,type:'sea',surface,floor}:null;
  }
  height(x,z){
    let result=terrainHeight(x,z);
    if(this.externalTerrain){
      this.surfaceRay.set(new THREE.Vector3(x,3000,z),new THREE.Vector3(0,-1,0));
      this.surfaceRay.ray.origin.applyMatrix4(this.islandRoot.matrixWorld);
      const hit=this.surfaceRay.intersectObject(this.externalTerrain,true)[0];
      if(hit)result=this.islandRoot.worldToLocal(hit.point.clone()).y;
    }
    return result;
  }
  occludes(eye,point,clearance){
    const length=eye.distanceTo(point),limit=Math.max(0,(length-clearance)/length);
    if(this.externalTerrain){
      this.surfaceRay.set(eye,point.clone().sub(eye).normalize());
      const hit=this.surfaceRay.intersectObject(this.externalTerrain,true)[0];
      return Boolean(hit&&hit.distance<length-clearance);
    }
    // Analytic heightfield queries avoid raycasting tens of thousands of
    // triangles for every candidate on every frame.
    const a=this.islandRoot.worldToLocal(eye.clone()),b=this.islandRoot.worldToLocal(point.clone());
    for(let i=1;i<=12;i++){
      const t=limit*i/12,x=THREE.MathUtils.lerp(a.x,b.x,t),z=THREE.MathUtils.lerp(a.z,b.z,t),y=THREE.MathUtils.lerp(a.y,b.y,t);
      if(y<this.height(x,z)-.2)return true;
    }
    return false;
  }

  createSky(){
    this.skyUniforms={underwater:{value:0},sun:{value:new THREE.Vector3(-.6,.5,-.7).normalize()}};
    const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:this.skyUniforms,vertexShader:`varying vec3 dir;void main(){dir=position;gl_Position=projectionMatrix*viewMatrix*vec4(position+cameraPosition,1.);}`,fragmentShader:`varying vec3 dir;uniform float underwater;uniform vec3 sun;void main(){vec3 d=normalize(dir);float h=pow(max(d.y,0.),.45);vec3 sky=mix(vec3(.77,.8,.68),vec3(.51,.63,.66),h);float glow=pow(max(dot(d,sun),0.),18.);sky+=vec3(.18,.13,.055)*glow;sky=mix(sky,vec3(.12,.30,.27),underwater);gl_FragColor=vec4(sky,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
    this.sky=new THREE.Mesh(new THREE.SphereGeometry(180000,32,20),skyMat);this.sky.renderOrder=-100;this.scene.add(this.sky);

  }
  createRipples(){
    this.ripple=new THREE.Group();this.scene.add(this.ripple);
    this.rings=[];
    for(let i=0;i<3;i++){
      const mat=new THREE.MeshBasicMaterial({color:'#e6e9bd',transparent:true,opacity:.6,side:THREE.DoubleSide,depthWrite:false});
      const ring=new THREE.Mesh(new THREE.RingGeometry(.94,1,80),mat);ring.rotation.x=-Math.PI/2;this.ripple.add(ring);this.rings.push(ring);
    }
    this.ripple.visible=false;
  }
  async loadEnvironment(){
    const entry=this.assets.manifest.environment;if(!entry?.url)return;
    try{
      const gltf=await this.assets.loader.loadAsync(entry.url),root=gltf.scene;
      if(entry.position)root.position.fromArray(entry.position);
      if(entry.rotation)root.rotation.fromArray(entry.rotation);
      root.scale.setScalar(entry.scale||1);this.islandRoot.add(root);this.islandRoot.updateMatrixWorld(true);
      root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
      if(entry.useAsTerrain){
        // The main body's visual and collision bounds must follow the replacement too.
        root.userData.external=true;
        root.userData.localBounds=new THREE.Box3().setFromObject(root).applyMatrix4(this.islandRoot.matrixWorld.clone().invert());
        this.terrain.removeFromParent();this.terrain=this.externalTerrain=root;
        this.byId.get(LAYOUT.mainIsland).visual=root;
        for(const e of this.entities)if(e.root.parent===this.islandRoot&&e.surfaceOffset!=null){e.root.position.y=this.height(e.root.position.x,e.root.position.z)+e.surfaceOffset;e.baseY=e.root.position.y;}
      }
    }catch(e){this.assets.errors.push('environment: '+e.message);console.warn('Prototype environment retained.',e);}
  }
  // Random scenery must not start inside another solid body (M-01); named bodies stay.
  position(entity,target=new THREE.Vector3()){return entity.root.getWorldPosition(target);}
  focus(entity,target=new THREE.Vector3()){
    this.position(entity,target);const s=SPECIES[entity.kind];
    target.y+=s.height*layerOf(entity.kind).focusHeightRatio;
    return target;
  }
  update(dt,player,target,targetPoint=null,targetSize=1){
    this.time+=dt;const t=this.time,stage=SPECIES[player.kind].stage;
    // Unplayed birds and fish keep to their routes (D-027); built after spawning and pruning.
    if(!this.ambient)this.ambient=new AmbientMotion(this,LAYOUT.ambient||[]);
    this.ambient.update(dt,player,this.ambientHold);
    this.waterMat.uniforms.time.value=t;for(const w of this.waterBodies)w.material.uniforms.time.value=t;
    for(const d of this.decor){
      d.object.visible=stage<=(d.slot.visibleUpToStage??1)&&!(d.procedural&&this.externalTerrain);
      if(d.object.userData.wind)d.object.userData.wind.value=t;
    }
    this.sea.visible=!this.scene.userData.underwater;
    for(const w of this.waterBodies)w.visible=!this.scene.userData.underwater;
    this.skyUniforms.underwater.value=THREE.MathUtils.damp(this.skyUniforms.underwater.value,this.scene.userData.underwater?1:0,2,dt);
    // Small bodies are not drawn at large scales; their state is kept (W-06).
    const hideBelow=stage-(TUNING.scaleHideBelowStageOffset?.value??1);
    for(const e of this.entities){
      const s=SPECIES[e.kind];
      if(e.visual)e.visual.visible=e===player||s.stage>=hideBelow;
      if(!e.visual||!e.visual.visible)continue;
      const v=e.visual;
      if(v.userData.sway)v.rotation.z=Math.sin(t*.9+e.seed)*v.userData.sway;
      if(v.userData.bird){const a=Math.sin(t*(e.moving?7:3.4)+e.seed)*.38;v.userData.leftWing.rotation.z=a;v.userData.rightWing.rotation.z=-a;v.position.y=Math.sin(t*2+e.seed)*.08;}
      if(v.userData.limbs)for(let i=0;i<v.userData.limbs.length;i++)v.userData.limbs[i].rotation.x=e.moving?Math.sin(t*s.limbSwingRate+i*Math.PI)*.38:0;
      if(v.userData.dogTail)v.userData.dogTail.rotation.z=Math.sin(t*4)*.2;
      if(v.userData.fish)v.userData.tail.rotation.y=Math.sin(t*(e.moving?10:4)+e.seed)*.35;
      v.userData.moving=e===player?(e.animationMoving??e.moving):e.moving;
      v.userData.boosting=e.moving&&e.boosting;
      v.userData.movementRatio=e===player?e.movementRatio:1;
      v.userData.swimming=e.swimming;
    }
    this.assets.update(dt);
    for(const first of this.firstPersonBodies||[])if(first.visual&&SPECIES[first.kind].firstPerson.hideBody)first.visual.visible=false;
    if(target){
      this.ripple.visible=true;const s=SPECIES[target.kind];
      if(targetPoint)this.ripple.position.copy(targetPoint).y+=.06;
      else{const p=this.position(target);this.ripple.position.copy(p);this.ripple.position.y+=Math.min(s.height*.035,8)+.04;}
      for(let i=0;i<3;i++){const f=(t*.3+i/3)%1;this.rings[i].scale.setScalar(targetSize*(1.05+f*.55));this.rings[i].material.opacity=(1-f)*.42;}
    }else this.ripple.visible=false;
  }
  serialize(){return this.entities.map(e=>({id:e.id,kind:e.kind,position:e.root.position.toArray(),rotation:[e.root.rotation.x,e.root.rotation.y,e.root.rotation.z],baseY:e.baseY,heading:e.heading}));}
  serializeLayout(){return this.entities.map(e=>({id:e.id,position:e.home.toArray(),rotation:e.homeRotation,baseY:e.homeBaseY}));}
  restore(records,layout=[]){
    const oldLayout=new Map((Array.isArray(layout)?layout:[]).filter(r=>r&&typeof r.id==='string').map(r=>[r.id,r]));
    for(const record of records||[]){
      const e=this.byId.get(record.id);if(!e||!Array.isArray(record.position)||record.position.length!==3||!record.position.every(Number.isFinite))continue;
      const previous=oldLayout.get(record.id),oldPosition=previous?.position;
      const position=Array.isArray(oldPosition)&&oldPosition.length===3&&oldPosition.every(Number.isFinite)
        ?e.home.clone().add(new THREE.Vector3(...record.position).sub(new THREE.Vector3(...oldPosition))).toArray()
        :record.position;
      e.root.position.fromArray(position);e.heading=Number.isFinite(record.heading)?record.heading:0;
      if(Array.isArray(record.rotation)&&record.rotation.length===3&&record.rotation.every(Number.isFinite)){
        const oldRotation=previous?.rotation;
        if(Array.isArray(oldRotation)&&oldRotation.length===3&&oldRotation.every(Number.isFinite))
          e.root.rotation.set(...record.rotation.map((value,index)=>e.homeRotation[index]+value-oldRotation[index]));
        else e.root.rotation.set(...record.rotation);
      }
      else if(SPECIES[e.kind].mode!=='island')e.root.rotation.y=e.heading;
      const oldBaseY=previous?.baseY;
      e.baseY=Number.isFinite(record.baseY)&&Number.isFinite(oldBaseY)?e.homeBaseY+record.baseY-oldBaseY:Number.isFinite(record.baseY)?record.baseY:e.root.position.y;
    }
    this.scene.updateMatrixWorld(true);
  }
}
