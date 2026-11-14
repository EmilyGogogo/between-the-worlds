import * as THREE from 'three';

// Main-island heightfield (env.world.heightfield): a 1 m grid generated in Blender by
// project/terrain/river_island.py, plus a ground-layer weight map. Height queries read the
// grid, so the rendered mesh is never ray-cast; the mesh is split into chunks whose detail
// falls with camera distance, and skirts hide the seams between detail levels.

export class Heightfield {
  constructor(desc,heights,ground){
    this.desc=desc;[this.nx,this.nz]=desc.grid;[this.width,this.depth]=desc.size;
    this.cell=this.width/(this.nx-1);this.heights=heights;this.floor=desc.heightRange[0];
    this.ground=ground;
  }
  // Island-local metres; outside the grid the river bed continues at its deepest.
  height(x,z){
    const fx=(x+this.width/2)/this.cell,fz=(z+this.depth/2)/this.cell;
    if(!(fx>=0&&fz>=0&&fx<=this.nx-1&&fz<=this.nz-1))return this.floor;
    const i=Math.min(Math.floor(fx),this.nx-2),j=Math.min(Math.floor(fz),this.nz-2),u=fx-i,v=fz-j,k=j*this.nx+i,h=this.heights;
    return (h[k]*(1-u)+h[k+1]*u)*(1-v)+(h[k+this.nx]*(1-u)+h[k+this.nx+1]*u)*v;
  }
  // Ground layer weights at a point: [sand, wet mud, grass, cracked mud]; the rest is leaf litter.
  weights(x,z,out=[0,0,0,0]){
    const g=this.ground;if(!g){out.fill(0);return out;}
    const i=Math.round((x+this.width/2)/this.width*(g.width-1)),j=Math.round((z+this.depth/2)/this.depth*(g.height-1));
    if(i<0||j<0||i>=g.width||j>=g.height){out.fill(0);return out;}
    const k=(j*g.width+i)*4;for(let c=0;c<4;c++)out[c]=g.data[k+c]/255;return out;
  }
}

export async function loadHeightfield(desc){
  const [buffer,ground]=await Promise.all([
    fetch(desc.url).then(r=>{if(!r.ok)throw Error(`${desc.url} ${r.status}`);return r.arrayBuffer();}),
    desc.groundMap?loadGround(desc):null]);
  const raw=new Uint16Array(buffer),[nx,nz]=desc.grid,[lo,hi]=desc.heightRange;
  if(raw.length!==nx*nz)throw Error(`${desc.url}: ${raw.length} samples, expected ${nx}×${nz}`);
  const heights=new Float32Array(raw.length);for(let i=0;i<raw.length;i++)heights[i]=lo+raw[i]/65535*(hi-lo);
  const field=new Heightfield(desc,heights,ground);
  applyRockAprons(field,desc.rockAprons||[]);
  return field;
}
// Ground weights are raw RGBA bytes (no PNG premultiplication), row 0 at -Z.
async function loadGround(desc){
  const [width,height]=desc.groundGrid,r=await fetch(desc.groundMap);if(!r.ok)throw Error(`${desc.groundMap} ${r.status}`);
  const data=new Uint8Array(await r.arrayBuffer());if(data.length!==width*height*4)throw Error(`${desc.groundMap}: ${data.length} bytes, expected ${width}×${height}×4`);
  const texture=new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.UnsignedByteType);
  texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;
  return {width,height,data,texture};
}

// Blend soil into the existing heightfield before the water, mesh and vegetation sample it.
function applyRockAprons(field,aprons){
  for(const {center:[cx,cz],radii:[rx,rz],rise,soil,blend} of aprons){
    const mask=(x,z)=>{
      const u=(x-cx)/rx,v=(z-cz)/rz;
      const d=Math.hypot(u,v)*(1+.13*Math.sin(4*u+6*v)+.08*Math.cos(8*u-3*v));
      const t=THREE.MathUtils.clamp(1-d,0,1);
      return t*t*(3-2*t);
    };
    const editGrid=(width,depth,edit)=>{
      const dx=field.width/(width-1),dz=field.depth/(depth-1);
      const x0=Math.max(0,Math.floor((cx-1.27*rx+field.width/2)/dx));
      const x1=Math.min(width-1,Math.ceil((cx+1.27*rx+field.width/2)/dx));
      const z0=Math.max(0,Math.floor((cz-1.27*rz+field.depth/2)/dz));
      const z1=Math.min(depth-1,Math.ceil((cz+1.27*rz+field.depth/2)/dz));
      for(let j=z0;j<=z1;j++)for(let i=x0;i<=x1;i++){
        edit(j*width+i,mask(i*dx-field.width/2,j*dz-field.depth/2));
      }
    };
    editGrid(field.nx,field.nz,(index,weight)=>{field.heights[index]+=rise*weight;});
    const ground=field.ground;
    if(!ground)continue;
    editGrid(ground.width,ground.height,(index,weight)=>{
      const mix=weight*blend;
      for(let channel=0;channel<4;channel++){
        const i=index*4+channel;
        const target=channel===1&&soil==='mud'?255:0;
        ground.data[i]=Math.round(THREE.MathUtils.lerp(ground.data[i],target,mix));
      }
    });
  }
}

// --- Chunked terrain with distance-based detail.
const LEVELS=[{step:1,distance:90},{step:2,distance:240},{step:4,distance:600},{step:8,distance:Infinity}];
export class TerrainChunks extends THREE.Group {
  // height(x,z) is the full terrain height (heightfield + curvature); bounds limit the chunks built.
  constructor(field,height,material,{chunk=128}={}){
    super();this.field=field;this.heightAt=height;this.material=material;this.chunk=chunk;this.indexCache=new Map();
    this.chunks=[];const w=field.width,d=field.depth;
    for(let x0=-w/2;x0<w/2-1;x0+=chunk)for(let z0=-d/2;z0<d/2-1;z0+=chunk){
      const x1=Math.min(x0+chunk,w/2),z1=Math.min(z0+chunk,d/2);
      // Deep river bed far from any shore is never visible under the water; skip it.
      let hi=-Infinity;for(let x=x0;x<=x1;x+=8)for(let z=z0;z<=z1;z+=8)hi=Math.max(hi,field.height(x,z));
      if(hi<field.floor+1.5)continue;
      const mesh=new THREE.Mesh(new THREE.BufferGeometry(),material);mesh.receiveShadow=true;mesh.frustumCulled=true;
      const c={x0,z0,x1,z1,hi,mesh,level:-1,geometries:[]};
      mesh.userData.chunk=c;this.chunks.push(c);this.add(mesh);
    }
    this.focus=new THREE.Vector3(1e9,0,1e9);this.update(new THREE.Vector3(0,10,0),true);
  }
  // Rebuild levels when the camera moved enough; geometries are cached per level.
  update(localEye,force=false){
    if(!force&&localEye.distanceToSquared(this.focus)<16)return;this.focus.copy(localEye);
    for(const c of this.chunks){
      const dx=Math.max(c.x0-localEye.x,0,localEye.x-c.x1),dz=Math.max(c.z0-localEye.z,0,localEye.z-c.z1);
      const dist=Math.hypot(dx,dz,Math.max(0,localEye.y-c.hi));
      let level=LEVELS.findIndex(l=>dist<l.distance);if(level<0)level=LEVELS.length-1;
      if(level===c.level)continue;
      c.level=level;c.mesh.geometry=c.geometries[level]||(c.geometries[level]=this.build(c,LEVELS[level].step));
      c.mesh.castShadow=level<=1;
    }
  }
  build(c,step){
    const nx=Math.round((c.x1-c.x0)/step),nz=Math.round((c.z1-c.z0)/step),f=this.field,h=this.heightAt;
    const ring=2*(nx+nz),count=(nx+1)*(nz+1)+ring+4;
    const pos=new Float32Array(count*3),nor=new Float32Array(count*3);let v=0;
    const put=(x,y,z,n)=>{pos[v*3]=x;pos[v*3+1]=y;pos[v*3+2]=z;nor.set(n,v*3);v++;};
    const normalAt=(x,z)=>{const e=Math.max(1,step*.5),dx=h(x+e,z)-h(x-e,z),dz=h(x,z+e)-h(x,z-e),n=new THREE.Vector3(-dx,2*e,-dz).normalize();return [n.x,n.y,n.z];};
    for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){const x=c.x0+i*step,z=c.z0+j*step;put(x,h(x,z),z,normalAt(x,z));}
    // Skirt: the border loop again, dropped below the surface, so coarser neighbours leave no cracks.
    const border=[];for(let i=0;i<=nx;i++)border.push([i,0]);for(let j=1;j<=nz;j++)border.push([nx,j]);
    for(let i=nx-1;i>=0;i--)border.push([i,nz]);for(let j=nz-1;j>=1;j--)border.push([0,j]);
    const drop=.4+step*.35,skirtStart=v;
    for(const [i,j] of border){const k=j*(nx+1)+i;put(pos[k*3],pos[k*3+1]-drop,pos[k*3+2],[nor[k*3],nor[k*3+1],nor[k*3+2]]);}
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(pos.subarray(0,v*3),3));
    geo.setAttribute('normal',new THREE.BufferAttribute(nor.subarray(0,v*3),3));
    geo.setIndex(this.indices(nx,nz,border,skirtStart));geo.computeBoundingBox();geo.computeBoundingSphere();
    return geo;
  }
  indices(nx,nz,border,skirtStart){
    const key=`${nx}x${nz}`;if(this.indexCache.has(key))return this.indexCache.get(key);
    const idx=[];
    for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;idx.push(a,c,b,b,c,d);}
    for(let s=0;s<border.length;s++){
      const [i0,j0]=border[s],[i1,j1]=border[(s+1)%border.length],a=j0*(nx+1)+i0,b=j1*(nx+1)+i1,a2=skirtStart+s,b2=skirtStart+(s+1)%border.length;
      idx.push(a,a2,b,b,a2,b2,a,b,a2,b,b2,a2);   // both windings: the skirt faces out on every side
    }
    const attr=new THREE.BufferAttribute(new Uint32Array(idx),1);this.indexCache.set(key,attr);return attr;
  }
}

// --- Ground material: five tiling layers blended by the weight map and by each layer's own
// height (from its colour), with seasonal dryness and rain wetness. Built on the standard
// material, so lights, shadows and fog behave as everywhere else. Below the water line
// (`water`, see underwater.js) the ground becomes a matte bed of sand and silt under moving
// caustics, instead of glossy wet mud that catches the sun.
const LAYER_NAMES=['sand','mud','grass','cracked','litter'];
export function groundMaterial(field,layers,uniforms,water=null){
  const loader=new THREE.TextureLoader();
  const load=(url,color)=>{const t=loader.load(url);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;return t;};
  const byName=Object.fromEntries(layers.map(l=>[l.name,l]));
  const maps=LAYER_NAMES.map(n=>{const l=byName[n];if(!l)throw Error(`Ground layer ${n} missing`);return {diff:load(l.diffuse,true),nor:load(l.normal,false),tile:l.tileM,rough:l.roughness??.9};});
  const mat=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:1,metalness:0});
  const u={
    groundMap:{value:field.ground.texture},fieldSize:{value:new THREE.Vector2(field.width,field.depth)},
    tiles:{value:maps.map(m=>m.tile)},roughs:{value:maps.map(m=>m.rough)},
    ...Object.fromEntries(maps.flatMap((m,i)=>[[`diff${i}`,{value:m.diff}],[`nor${i}`,{value:m.nor}]])),
    dryness:uniforms.dryness,wetness:uniforms.wetness,waterLevel:uniforms.waterLevel,
    uwTime:uniforms.time,uwSun:uniforms.sunDir,uwRain:uniforms.rain,
    uwRiver:{value:water?.riverLevel??-1e4},uwPlanet:{value:water?.planetRadius??1e5},
    uwPools:{value:[0,1,2,3].map(i=>new THREE.Vector4(...(water?.pools[i]||[0,0,1,1]).slice(0,4)))},
    uwPoolY:{value:[0,1,2,3].map(i=>water?.pools[i]?.[4]??-1e4)},uwPoolCount:{value:water?.pools.length??0},
    uwBed:{value:water?.look.bedColor.clone()??new THREE.Color(1,1,1)},uwSand:{value:water?.look.bedSand??0},
    uwCaustics:{value:water?.look.caustics??0},uwCausticScale:{value:water?.look.causticScaleM??1.8},
  };
  mat.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,u);
    shader.vertexShader='varying vec3 vLocal;varying vec3 vWorldN;varying vec3 vWorldT;varying vec3 vWorldB;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
vLocal=position;vWorldN=normalize(mat3(modelMatrix)*normal);vWorldT=normalize(mat3(modelMatrix)*vec3(1.,0.,0.));vWorldB=normalize(mat3(modelMatrix)*vec3(0.,0.,-1.));`);
    shader.fragmentShader=`varying vec3 vLocal;varying vec3 vWorldN;varying vec3 vWorldT;varying vec3 vWorldB;
uniform sampler2D groundMap;uniform vec2 fieldSize;uniform float tiles[5];uniform float roughs[5];uniform float dryness;uniform float wetness;uniform float waterLevel;
uniform sampler2D diff0;uniform sampler2D diff1;uniform sampler2D diff2;uniform sampler2D diff3;uniform sampler2D diff4;
uniform sampler2D nor0;uniform sampler2D nor1;uniform sampler2D nor2;uniform sampler2D nor3;uniform sampler2D nor4;
uniform float uwTime;uniform vec3 uwSun;uniform float uwRain;uniform float uwRiver;uniform float uwPlanet;
uniform vec4 uwPools[4];uniform float uwPoolY[4];uniform int uwPoolCount;uniform vec3 uwBed;uniform float uwSand;uniform float uwCaustics;uniform float uwCausticScale;
float gHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float gNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(gHash(i),gHash(i+vec2(1,0)),f.x),mix(gHash(i+vec2(0,1)),gHash(i+vec2(1,1)),f.x),f.y);}
vec2 gRot(vec2 p){return mat2(.8,-.6,.6,.8)*p*.43+vec2(.37,.71);}
// Two differently rotated and scaled lookups, mixed by slow noise, hide the tile grid.
vec3 gSample(sampler2D t,vec2 uv,float mixer){return mix(texture2D(t,uv).rgb,texture2D(t,gRot(uv)).rgb,mixer);}
// Water standing over a point: the river (its surface follows the curved river frame) or an
// enclosed body whose ellipse contains it.
float uwDepth(vec3 p){
  float d=uwRiver-dot(p.xz,p.xz)/(2.*uwPlanet)-p.y;
  for(int i=0;i<4;i++){if(i>=uwPoolCount)break;vec2 q=(p.xz-uwPools[i].xy)/uwPools[i].zw;if(dot(q,q)<1.)d=max(d,uwPoolY[i]-p.y);}
  return d;
}
// Caustics: the bright net that a rippled surface focuses on the bed (two drifting cell layers).
float uwCells(vec2 p,float t){
  vec2 i=floor(p),f=fract(p);float d1=8.,d2=8.;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(x,y),h=vec2(gHash(i+g),gHash(i+g+5.3));float d=length(g+.5+.42*sin(t+6.283*h)-f);if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d;}
  return d2-d1;
}
float uwCaustic(vec2 p,float t){
  float a=uwCells(p,t),b=uwCells(p*1.37+vec2(4.1,2.3),t*1.21);
  return pow(1.-smoothstep(0.,.2,a),2.)*.6+pow(1.-smoothstep(0.,.2,b),2.)*.4;
}
`+shader.fragmentShader
      .replace('#include <map_fragment>',`
vec2 gp=vec2(vLocal.x,-vLocal.z);
vec4 gw=texture2D(groundMap,(vLocal.xz+fieldSize*.5)/fieldSize);
float gMix=smoothstep(.25,.75,gNoise(gp*.045));
float gMacro=gNoise(gp*.012)*.6+gNoise(gp*.05)*.4;
// Dry season: the margins of still water crack; rain keeps them as wet mud.
float crack=gw.a*mix(.2,1.,dryness);
float ww[5];ww[0]=gw.r;ww[1]=gw.g+gw.a-crack;ww[2]=gw.b;ww[3]=crack;ww[4]=max(0.,1.-gw.r-gw.g-gw.b-gw.a);
vec3 cc[5];
cc[0]=gSample(diff0,gp/tiles[0],gMix);cc[1]=gSample(diff1,gp/tiles[1],gMix);cc[2]=gSample(diff2,gp/tiles[2],gMix);
cc[3]=gSample(diff3,gp/tiles[3],gMix);cc[4]=gSample(diff4,gp/tiles[4],gMix);cc[4]=mix(vec3(dot(cc[4],vec3(.3,.59,.11))),cc[4],.55)*vec3(.5,.47,.38);   // shaded, damp forest floor
// Height blend: each layer's brightness acts as its height, giving crisp, natural borders.
float best=0.,wsum=0.;
for(int i=0;i<5;i++){ww[i]=ww[i]*(.35+dot(cc[i],vec3(.6)))+1e-4;best=max(best,ww[i]);}
for(int i=0;i<5;i++){ww[i]=max(ww[i]-best*.55,0.);wsum+=ww[i];}
vec3 gCol=vec3(0.);float gRough=0.;
for(int i=0;i<5;i++){ww[i]/=wsum;gCol+=cc[i]*ww[i];gRough+=roughs[i]*ww[i];}
// Grass yellows a little in the dry season.
gCol=mix(gCol,gCol*vec3(1.12,1.,.72),ww[2]*dryness*.55);
gCol*=.86+.28*gMacro;
// Wet ground near water and in rain: darker and glossier.
float shoreWet=1.-smoothstep(.05,.9,vLocal.y-waterLevel);
float wet=clamp(max(shoreWet,wetness*(.55+.45*gNoise(gp*.08))),0.,1.);
gCol*=mix(1.,.62,wet);gRough=mix(gRough,.32,wet*(1.-ww[0]*.5));
// Under water: sand and silt in soft ripples, matte, lit by caustics where the sun reaches.
float uwD=uwDepth(vLocal),uwSub=smoothstep(0.,.3,uwD),uwCau=0.;
if(uwD>0.){
  float rip=.9+.1*sin(dot(gp,vec2(.83,.55))*4.+gNoise(gp*.35)*5.);
  vec3 bedCol=mix(cc[0],cc[1],.35+.3*gNoise(gp*.07))*uwBed*rip;
  gCol=mix(gCol,bedCol,uwSub*uwSand);gRough=mix(gRough,.92,uwSub);
  float sunUp=smoothstep(-.02,.25,uwSun.y)*(1.-uwRain*.6);
  uwCau=uwSub*uwCaustics*sunUp*exp(-uwD*.25)*smoothstep(90.,25.,length(vViewPosition))*uwCaustic(gp/uwCausticScale,uwTime*.8);
}
diffuseColor.rgb*=gCol;`)
      .replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
reflectedLight.directDiffuse*=1.+uwCau*1.6;`)
      .replace('#include <roughnessmap_fragment>','float roughnessFactor=gRough;')
      .replace('#include <normal_fragment_maps>',`
vec3 nn=vec3(0.);
nn+=(texture2D(nor0,gp/tiles[0]).xyz*2.-1.)*ww[0];nn+=(texture2D(nor1,gp/tiles[1]).xyz*2.-1.)*ww[1];
nn+=(texture2D(nor2,gp/tiles[2]).xyz*2.-1.)*ww[2];nn+=(texture2D(nor3,gp/tiles[3]).xyz*2.-1.)*ww[3];
nn+=(texture2D(nor4,gp/tiles[4]).xyz*2.-1.)*ww[4];
// Fade detail normals with distance, where they would only shimmer.
float gFar=smoothstep(60.,260.,length(vViewPosition));
nn.xy*=mix(1.15,.25,gFar)*mix(1.,.5,wet);
vec3 nW=normalize(vWorldT*nn.x+vWorldB*nn.y+normalize(vWorldN)*max(nn.z,.2));
normal=normalize((viewMatrix*vec4(nW,0.)).xyz);`);
  };
  mat.customProgramCacheKey=()=>'ground-v2';
  return mat;
}
