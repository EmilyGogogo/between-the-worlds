import * as THREE from 'three';

// Rainforest vegetation from Aholo Lux3D text-to-3D models, rebuilt for the game by
// project/vegetation/build_vegetation.py: each model has mesh levels lod0 (nearest), lod1, lod2…
// sharing one material, and trees a far impostor, a camera-facing card that shows the model from
// the nearest of 16 headings × 3 elevations, lit with the normals baked beside it.

const textures=new THREE.TextureLoader();
function texture(url,color){const t=textures.load(url);t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=4;return t;}

export function impostorMaterial(imp,base){
  const mat=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.85,metalness:0});
  const uniforms={impColor:{value:texture(base+imp.color,true)},impNormal:{value:texture(base+imp.normal,false)},
    impCenter:{value:new THREE.Vector3(...imp.center)},impHalf:{value:imp.half},impHeadings:{value:imp.headings},
    impElev:{value:imp.elevations.map(e=>e*Math.PI/180)}};
  mat.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=`uniform vec3 impCenter;uniform float impHalf;uniform float impHeadings;uniform float impElev[3];
varying vec2 vImpUv;varying vec3 vImpR;varying vec3 vImpU;varying vec3 vImpF;
`+shader.vertexShader.replace('#include <project_vertex>',`
mat3 inst=mat3(instanceMatrix);float sc=length(inst[0]),sy=length(inst[1]);
vec3 cW=(modelMatrix*instanceMatrix*vec4(impCenter,1.)).xyz;
vec3 X=normalize(mat3(modelMatrix)*inst[0]),Y=normalize(mat3(modelMatrix)*inst[1]),Z=normalize(mat3(modelMatrix)*inst[2]);
vec3 toEye=normalize(cameraPosition-cW),lv=vec3(dot(toEye,X),dot(toEye,Y),dot(toEye,Z));
// The baked view nearest to this one.
float hStep=6.2831853/impHeadings,col=mod(floor(atan(lv.x,lv.z)/hStep+.5)+impHeadings,impHeadings);
float el=asin(clamp(lv.y,-1.,1.)),row=el<(impElev[0]+impElev[1])*.5?0.:el<(impElev[1]+impElev[2])*.5?1.:2.;
float az=col*hStep,elq=impElev[int(row)];
vec3 fv=vec3(sin(az)*cos(elq),sin(elq),cos(az)*cos(elq)),fr=normalize(cross(-fv,vec3(0.,1.,0.))),fu=cross(fr,-fv);
vImpR=fr.x*X+fr.y*Y+fr.z*Z;vImpU=fu.x*X+fu.y*Y+fu.z*Z;vImpF=fv.x*X+fv.y*Y+fv.z*Z;
// The card faces the eye, upright along the tree's own axis.
vec3 right=normalize(cross(-toEye,Y)),up=cross(right,-toEye);
vec3 wp=cW+(right*position.x+up*position.y*(sy/sc))*impHalf*sc;
vImpUv=vec2((col+position.x*.5+.5)/impHeadings,(2.-row+position.y*.5+.5)/3.);
vec4 mvPosition=viewMatrix*vec4(wp,1.);gl_Position=projectionMatrix*mvPosition;`).replace('#include <worldpos_vertex>','vec4 worldPosition=vec4(wp,1.);');
    shader.fragmentShader=`uniform sampler2D impColor;uniform sampler2D impNormal;varying vec2 vImpUv;varying vec3 vImpR;varying vec3 vImpU;varying vec3 vImpF;
`+shader.fragmentShader.replace('#include <map_fragment>',`vec4 impC=texture2D(impColor,vImpUv);if(impC.a<.5)discard;diffuseColor.rgb*=impC.rgb;`)
      .replace('#include <normal_fragment_begin>',`vec3 impN=texture2D(impNormal,vImpUv).xyz*2.-1.;
// Leaf normals are noisy at this size; lean them toward the crown's overall shape.
vec3 nW=normalize(normalize(vImpR*impN.x+vImpU*impN.y+vImpF*impN.z)+vImpF*.35);
vec3 normal=normalize((viewMatrix*vec4(nW,0.)).xyz);vec3 nonPerturbedNormal=normal;`)
      .replace('#include <normal_fragment_maps>','')
      .replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
reflectedLight.indirectDiffuse+=diffuseColor.rgb*.22;`);
  };
  mat.customProgramCacheKey=()=>'impostor-v4';
  return mat;
}
const cardGeometry=new THREE.PlaneGeometry(2,2);

// Leaves are thin: both sides drawn, and lit through a little from the shaded side.
function foliage(material){
  material.side=THREE.DoubleSide;
  material.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
reflectedLight.indirectDiffuse+=diffuseColor.rgb*.18*(1.-max(dot(normal,vec3(0.,0.,1.)),0.));`);
  };
  material.customProgramCacheKey=()=>'aholo-foliage-v1';
  return material;
}

export async function loadVegetation(url,loader){
  const base=url.slice(0,url.lastIndexOf('/')+1),r=await fetch(url);if(!r.ok)throw Error(`${url} ${r.status}`);
  const meta=await r.json(),out={models:{}};
  await Promise.all(Object.entries(meta.models||{}).map(async([name,m])=>{
    const gltf=await loader.loadAsync(base+m.model),levels=[];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(o=>{const k=o.isMesh&&/^lod(\d+)$/.exec(o.name);if(k)levels[+k[1]]={geometry:o.geometry.clone().applyMatrix4(o.matrixWorld),material:foliage(o.material)};});
    out.models[name]={...m,name,levels:levels.filter(Boolean),impostor:m.impostor?{geometry:cardGeometry,material:impostorMaterial(m.impostor,base)}:null};
  }));
  return out;
}

// Scenery of one model drawn by distance from the eye: every individual is in exactly one level
// at a time — a mesh level while nearer than that level's range, the impostor beyond the last one
// (or nothing for models without one, up to `farM`) — so trees never vanish between levels.
// Each individual's ranges are stretched a little by its own jitter, so no ring of hand-overs
// shows. The instance buffers are refilled whenever the eye has moved a few metres.
export class LodField extends THREE.Group {
  constructor(model,items,{ranges,farM=Infinity,shadowLevels=2}){
    super();this.items=items;this.ranges=ranges;this.farM=farM;this.last=new THREE.Vector3(1e9,0,0);this.lastNear=null;
    // A level is one part ({geometry, material}) or several drawn together.
    const instanced=(level,shadow)=>[level].flat().map(part=>{const im=new THREE.InstancedMesh(part.geometry,part.material,Math.max(1,items.length));
      im.castShadow=shadow;im.receiveShadow=true;im.count=0;this.add(im);return im;});
    this.levels=model.levels.slice(0,ranges.length).map((level,i)=>instanced(level,i<shadowLevels));
    this.impostor=model.impostor?instanced(model.impostor,false):null;
    for(const im of this.impostor||[])im.frustumCulled=false;
    for(const it of items)it.jitter??=1+(Math.abs(Math.sin(it.x*12.9898+it.z*78.233)*43758.5453)%1-.5)*.16;
    // Until the eye is known each draw holds one individual, so loading compiles its shaders.
    if(items.length)for(const im of [...this.levels,this.impostor].flat().filter(Boolean)){im.setMatrixAt(0,items[0].matrix);im.setColorAt(0,items[0].tint);im.count=1;}
  }
  // eye: in the carrier's frame, or null to show only impostors (large scales).
  update(eye,force=false){
    const near=!!eye;
    if(!force&&near===this.lastNear&&(!near||eye.distanceToSquared(this.last)<9))return;
    if(near)this.last.copy(eye);this.lastNear=near;
    const counts=new Array(this.levels.length).fill(0);let far=0;const L=this.ranges.length;
    for(const it of this.items){
      let level=L;
      if(near){const d=Math.hypot(it.x-eye.x,it.z-eye.z,(it.y??eye.y)-eye.y)/it.jitter;while(level>0&&d<this.ranges[level-1])level--;if(level===L&&d>this.farM)continue;}
      const draws=level<L?this.levels[level]:this.impostor;if(!draws)continue;
      const n=level<L?counts[level]++:far++;for(const im of draws){im.setMatrixAt(n,it.matrix);im.setColorAt(n,it.tint);}
    }
    const commit=(im,n,bounds)=>{im.count=n;im.instanceMatrix.needsUpdate=true;if(im.instanceColor)im.instanceColor.needsUpdate=true;if(bounds)im.computeBoundingSphere();};
    this.levels.forEach((draws,i)=>{for(const im of draws)commit(im,counts[i],true);});
    for(const im of this.impostor||[])commit(im,far,false);
  }
}
