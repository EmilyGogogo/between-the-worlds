import * as THREE from 'three';
import { WATERS, mulberry32 } from './species.js';
import { makeRock } from './assets.js';

// The world below the water line: how the water looks from inside (fog, sky, caustics, light
// shafts and drifting motes, from `water.underwater` in anchors.json), and the riverbed dressing
// (env.pebbles, env.waterweeds). Enclosed waters fall back to the river's values.

const DEFAULTS={fog:'#2f7f8f',fogDensity:.04,sky:'#5fb3c4',caustics:.9,causticScaleM:1.8,bedTint:'#cbb98e',bedSand:.65,shafts:.3,motes:.45};
const LOOKS=new Map();
export function underwaterLook(id=null){
  if(LOOKS.has(id))return LOOKS.get(id);
  const river=WATERS.find(r=>r.water.type==='river'),own=id?WATERS.find(r=>r.id===id):null;
  const u={...DEFAULTS,...(river?.water.underwater||{}),...(own?.water.underwater||{})};
  const look={...u,fogColor:new THREE.Color(u.fog),skyColor:new THREE.Color(u.sky),bedColor:new THREE.Color(u.bedTint)};
  LOOKS.set(id,look);return look;
}

// What the ground shader needs to know where water stands: the river level (on the curved
// river frame) and each enclosed body's ellipse and flat surface.
export function waterShading(planetRadius){
  const river=WATERS.find(r=>r.water.type==='river'),pools=WATERS.filter(r=>r.water.type==='enclosed').slice(0,4);
  return {riverLevel:river?.water.levelM??-1e4,planetRadius,pools:pools.map(r=>[...r.center,...r.radii,r.water.surfaceY]),look:underwaterLook(river?.id)};
}

// Slow value noise in −1…1 for patches of weed and gravel.
function patchNoise(x,z,scale,seed){
  const u=x/scale,v=z/scale;
  return Math.sin(u*1.7+Math.sin(v*.9+seed))*.5+Math.sin(v*1.3-u*.6+2+seed*.7)*.35+Math.sin((u+v)*3.1+seed*1.9)*.15;
}
function eachPoint(scatter,r,visit){
  for(const area of scatter.areas)for(let i=0;i<area.count;i++)visit(area.center[0]+(r()-.5)*area.size[0],area.center[1]+(r()-.5)*area.size[1],area);
}

// env.waterweeds: clumps of ribbon weed (eelgrass-like) on the bed where the water is deep
// enough to hide them and shallow enough for light. Blades stay below the surface and sway
// with the current. Split into cells that the world culls by distance, like the meadow.
export function createWaterweeds(slot,world){
  const sc=slot.scatter,r=mulberry32(sc.seed??808),[d0,d1]=sc.waterDepthM||[.3,2.6],patch=sc.patchM??14,cell=sc.cellM??40,segments=5;
  const cells=new Map(),base=new THREE.Color(),tip=new THREE.Color();let tallest=-Infinity,clumps=0;
  eachPoint(sc,r,(x,z)=>{
    const depth=world.waterDepth(x,z),keep=r();
    if(depth<d0||depth>d1)return;
    if(patchNoise(x,z,patch,sc.seed??808)<-.1+keep*.5)return;
    const y=world.height(x,z),key=`${Math.floor(x/cell)},${Math.floor(z/cell)}`;
    if(!cells.has(key))cells.set(key,{pos:[],col:[],sway:[],idx:[],center:new THREE.Vector3(Math.floor(x/cell)*cell+cell/2,y,Math.floor(z/cell)*cell+cell/2)});
    const c=cells.get(key),blades=4+Math.floor(r()*6),reddish=r()<.12;
    // Mostly green-olive; a few clumps of the reddish leaves common in clear Amazon streams.
    base.setHSL(reddish?.03:.2+r()*.06,.45,.1+r()*.05);tip.setHSL(reddish?.02+r()*.03:.22+r()*.07,reddish?.55:.5,reddish?.3:.26+r()*.1);
    clumps++;
    for(let b=0;b<blades;b++){
      const a=r()*6.283,off=r()*.12,bx=x+Math.cos(a)*off,bz=z+Math.sin(a)*off,face=r()*6.283;
      const h=Math.min(.35+r()*1.3,depth*.85),w=.025+r()*.03,lean=(r()-.5)*.25,phase=r()*6.283;
      const dx=Math.cos(face)*w,dz=Math.sin(face)*w,n=c.pos.length/3;
      for(let s=0;s<=segments;s++){
        const t=s/segments,taper=1-t*.75,yy=y-.02+h*t,lx=bx+Math.cos(a)*lean*t*t*h,lz=bz+Math.sin(a)*lean*t*t*h;
        c.pos.push(lx-dx*taper,yy,lz-dz*taper,lx+dx*taper,yy,lz+dz*taper);
        const k=.55+.45*t;for(let j=0;j<2;j++){c.col.push(THREE.MathUtils.lerp(base.r,tip.r,k),THREE.MathUtils.lerp(base.g,tip.g,k),THREE.MathUtils.lerp(base.b,tip.b,k));c.sway.push(t*h,phase);}
        if(s<segments){const v=n+s*2;c.idx.push(v,v+1,v+2,v+1,v+3,v+2);}
      }
      tallest=Math.max(tallest,y-.02+h-(y+depth));
    }
  });
  const flow=WATERS.find(w=>w.water.type==='river')?.water.look?.flow||[1,0],time={value:0};
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.7,metalness:0});
  mat.onBeforeCompile=shader=>{
    shader.uniforms.weedTime=time;shader.uniforms.weedFlow={value:new THREE.Vector2(...flow).normalize()};
    shader.vertexShader='uniform float weedTime;uniform vec2 weedFlow;attribute vec2 sway;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
// Leaned downstream and waving: more toward the tip (sway.x is height above the bed).
float wt=sway.x*sway.x,wp=sway.y+position.x*.13+position.z*.17;
vec2 side=vec2(-weedFlow.y,weedFlow.x);
transformed.xz+=weedFlow*(.18+.12*sin(weedTime*1.1+wp))*wt+side*sin(weedTime*1.7+wp*1.3)*.07*wt;
transformed.y-=.06*wt*(.6+.4*sin(weedTime*1.1+wp));`);
  };
  mat.customProgramCacheKey=()=>'waterweed-v1';
  const group=new THREE.Group();group.userData.wind=time;group.userData.cells=[];
  for(const c of cells.values()){
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(c.pos,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(c.col,3));
    geo.setAttribute('sway',new THREE.Float32BufferAttribute(c.sway,2));geo.setIndex(c.idx);geo.computeVertexNormals();
    const mesh=new THREE.Mesh(geo,mat);mesh.receiveShadow=true;mesh.userData.center=c.center;group.add(mesh);group.userData.cells.push(mesh);
  }
  group.userData.drawDistance=sc.drawDistanceM??70;
  // For checks: clumps placed and the highest blade tip relative to the water surface (< 0).
  group.userData.count=clumps;group.userData.highestTipBelowSurface=tallest;
  return group;
}

// env.pebbles: gravel and stones on the bed of every water body, in patches, drawn instanced.
// Each area names the water type it belongs to (river margin or an enclosed body).
export function createPebbles(slot,world){
  const sc=slot.scatter,r=mulberry32(sc.seed??500),variants=[];
  for(let v=0;v<6;v++){
    const rock=makeRock(500+v*17,1),m=rock.children[0];m.updateMatrix();
    variants.push({geometry:m.geometry.clone().applyMatrix4(m.matrix),material:m.material,items:[]});
  }
  const mat=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3(),p=new THREE.Vector3(),UP=new THREE.Vector3(0,1,0),[d0,d1]=sc.waterDepthM||[.15,4];
  const positions=[];
  eachPoint(sc,r,(x,z,area)=>{
    const roll=r(),size=r(),turn=r(),pick=r(),squash=r();
    // Shallow creeks and river margins (drawn water, below the river's minDepthM) count as river.
    const type=area.waterType||sc.waterType,depth=world.waterDepth(x,z),here=world.water(x,z)?.type??(depth>0?'river':null);
    if(depth<d0||depth>d1||(type&&here!==type))return;
    if(patchNoise(x,z,sc.patchM??9,sc.seed??500)<-.35+roll*.7)return;
    const k=.12+.5*size**2.2,y=world.height(x,z)-.08*k;
    variants[Math.floor(pick*variants.length)].items.push(mat.compose(p.set(x,y,z),q.setFromAxisAngle(UP,turn*6.283),s.set(k,k*(.45+.4*squash),k)).clone());
    positions.push([x,y,z]);
  });
  const group=new THREE.Group();
  for(const v of variants){
    if(!v.items.length)continue;
    const im=new THREE.InstancedMesh(v.geometry,v.material,v.items.length);v.items.forEach((m,i)=>im.setMatrixAt(i,m));
    im.receiveShadow=true;im.castShadow=false;im.computeBoundingSphere();group.add(im);
  }
  group.userData.count=positions.length;group.userData.positions=positions;
  return group;
}

// Light shafts slanting down from the surface and slow motes around the eye, drawn only while
// the camera is under water. Both wrap around the eye, so they cost the same anywhere.
export class UnderwaterFx extends THREE.Group {
  constructor(shared,look){
    super();this.renderOrder=6;
    const common={time:shared.time,sunDir:shared.sunDir,sunColor:shared.sunColor,night:shared.night,rain:shared.rain,center:{value:new THREE.Vector3()}};
    this.uniforms={...common,surface:{value:0},shafts:{value:look.shafts},motes:{value:look.motes},tint:{value:look.skyColor.clone()}};
    // Motes: points in a 24 m box that drift and wrap around the eye.
    const n=1400,pos=new Float32Array(n*3),seed=new Float32Array(n);
    for(let i=0;i<n;i++){pos.set([(Math.random()-.5)*24,(Math.random()-.5)*24,(Math.random()-.5)*24],i*3);seed[i]=Math.random();}
    const mg=new THREE.BufferGeometry();mg.setAttribute('position',new THREE.BufferAttribute(pos,3));mg.setAttribute('seed',new THREE.BufferAttribute(seed,1));
    this.motes=new THREE.Points(mg,new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:this.uniforms,
      vertexShader:`attribute float seed;uniform float time;uniform vec3 center;uniform float surface;varying float vFade;varying float vSeed;
void main(){
  vec3 p=position+vec3(sin(time*.21+seed*40.),sin(time*.17+seed*23.)*.6,cos(time*.19+seed*31.))*.4+vec3(time*.12,0.,time*.03);
  p=mod(p-center+12.,24.)-12.+center;
  vec4 mv=viewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
  vFade=(1.-smoothstep(5.,12.,-mv.z))*step(p.y,surface);vSeed=seed;
  gl_PointSize=clamp((.012+.03*seed)*820./max(-mv.z,.1),1.,9.);
}`,
      fragmentShader:`uniform float motes;uniform float night;uniform vec3 tint;varying float vFade;varying float vSeed;
void main(){float a=smoothstep(.5,.1,length(gl_PointCoord-.5))*vFade*motes*(.4+.6*vSeed);if(a<.01)discard;
  gl_FragColor=vec4(mix(vec3(.92,.95,.86),tint,.35)*(1.-night*.7),a);}`}));
    this.motes.frustumCulled=false;this.add(this.motes);
    // Shafts: camera-facing strips hanging from the surface along the refracted sun.
    const count=22,corners=[[-1,0],[1,0],[1,1],[-1,1]],cp=new Float32Array(count*4*3),off=new Float32Array(count*4*3),sd=new Float32Array(count*4),idx=[];
    for(let i=0;i<count;i++){
      const x=(Math.random()-.5)*36,z=(Math.random()-.5)*36,s=Math.random();
      corners.forEach(([u,v],k)=>{cp.set([u,v,0],(i*4+k)*3);off.set([x,0,z],(i*4+k)*3);sd[i*4+k]=s;});
      idx.push(i*4,i*4+1,i*4+2,i*4,i*4+2,i*4+3);
    }
    const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(cp,3));sg.setAttribute('offset',new THREE.BufferAttribute(off,3));sg.setAttribute('seed',new THREE.BufferAttribute(sd,1));sg.setIndex(idx);
    this.shaftMesh=new THREE.Mesh(sg,new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,uniforms:this.uniforms,
      vertexShader:`attribute vec3 offset;attribute float seed;uniform vec3 center;uniform float surface;uniform vec3 sunDir;uniform float time;
varying vec2 vUv;varying float vSeed;varying float vDist;
void main(){
  vec3 b=offset;b.xz=mod(b.xz-center.xz+18.,36.)-18.+center.xz;b.y=surface;
  vec3 axis=normalize(vec3(-sunDir.x*.3,-1.,-sunDir.z*.3));
  vec3 right=normalize(cross(axis,normalize(cameraPosition-b)));
  float w=.35+seed*1.1,len=5.+seed*9.;
  vec3 p=b+axis*position.y*len+right*position.x*w*(1.+position.y*.7)+vec3(sin(time*.3+seed*20.),0.,cos(time*.25+seed*13.))*.3*position.y;
  vUv=position.xy;vSeed=seed;vDist=length(cameraPosition-p);
  gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
}`,
      fragmentShader:`uniform float time;uniform float shafts;uniform vec3 sunDir;uniform vec3 sunColor;uniform float rain;uniform float night;uniform vec3 tint;
varying vec2 vUv;varying float vSeed;varying float vDist;
void main(){
  float day=smoothstep(.02,.35,sunDir.y)*(1.-rain*.75)*(1.-night);
  float a=pow(1.-abs(vUv.x),2.)*pow(1.-vUv.y,1.5)*smoothstep(0.,.06,vUv.y)*(.55+.45*sin(time*.7+vSeed*30.))*smoothstep(28.,6.,vDist)*smoothstep(.3,1.5,vDist);
  gl_FragColor=vec4(mix(sunColor,tint,.45)*a*shafts*day*.35,1.);
}`}));
    this.shaftMesh.frustumCulled=false;this.add(this.shaftMesh);
    this.visible=false;
  }
  // eye: world position; surfaceY: world height of the water surface above the eye.
  update(eye,underwater,surfaceY,look){
    this.visible=underwater;if(!underwater)return;
    this.uniforms.center.value.copy(eye);this.uniforms.surface.value=surfaceY;
    this.uniforms.shafts.value=look.shafts;this.uniforms.motes.value=look.motes;this.uniforms.tint.value.copy(look.skyColor);
  }
}
