import * as THREE from 'three';
import { mulberry32 } from './species.js';

// The rainforest along both banks of the river: scenery, not bodies. A canopy surface is
// shaded as packed tree crowns (cellular noise), its river face as a wall of trunks and
// lianas, and emergent trees break the skyline. Built on the standard material so the sun,
// the moon and the fog light it like everything else.

export function canopyMaterial(extra={}){
  const mat=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.92,metalness:0,...extra});
  mat.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vCanopy;varying vec3 vCanopyN;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
vCanopy=(modelMatrix*vec4(position,1.)).xyz;vCanopyN=normalize(mat3(modelMatrix)*normal);`);
    shader.fragmentShader=`varying vec3 vCanopy;varying vec3 vCanopyN;
float cHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
// Distance to the nearest crown centre (cellular noise) and that crown's id.
vec3 crowns(vec2 p){vec2 i=floor(p),f=fract(p);float best=8.;vec2 id=vec2(0.);
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(x,y),o=vec2(cHash(i+g),cHash(i+g+19.7));float d=length(g+o-f);if(d<best){best=d;id=i+g;}}
  return vec3(best,id);}
`+shader.fragmentShader.replace('#include <map_fragment>',`
vec3 cr=crowns(vCanopy.xz/13.);vec3 cr2=crowns(vCanopy.xz/4.3+7.);
float hue=cHash(cr.yz);
vec3 green=mix(vec3(.13,.24,.08),vec3(.27,.38,.12),cHash(cr.yz+3.1));
green=mix(green,vec3(.42,.43,.16),step(.93,hue)*.8);          // yellowing crowns
green=mix(green,vec3(.58,.36,.52),step(.985,hue));            // a flowering tree
green=mix(green,vec3(.66,.58,.2),step(.975,hue)*(1.-step(.985,hue)));
float dome=1.-cr.x*cr.x;float leaf=.75+.25*(1.-cr2.x);
float face=1.-smoothstep(.35,.75,vCanopyN.y);                  // steep river face: trunks, lianas
float trunks=smoothstep(.7,.95,cHash(vec2(floor(vCanopy.x*.9+vCanopy.z*.9),3.)));
vec3 wall=mix(vec3(.09,.13,.06),vec3(.25,.22,.17),trunks*.7);
vec3 col=mix(green*(.45+.65*dome)*leaf,wall,face);
#ifdef USE_INSTANCING_COLOR
col=mix(col,col*vColor.rgb*2.2,.6);
#endif
diffuseColor.rgb*=col;`).replace('#include <normal_fragment_maps>',`
vec2 cg=vec2(dFdx(cr.x),dFdy(cr.x));
normal=normalize(normal+vec3(cg.x,0.,cg.y)*-14.*(1.-face));`);
  };
  mat.customProgramCacheKey=()=>'canopy-v1';
  return mat;
}

// Banks run along the river on both sides. `place(x,z,h)` maps flat river coordinates and a
// height to the curved frame the river surface lives in. Without vegetation models the canopy
// surface reaches down to the water as one wall; with them (veg) a muddy bank and forest floor
// lead to a tree line of impostors, denser at the river face, with the canopy surface set back
// as the mass of forest behind. Trees come in segments along the river, culled by distance.
export function createBanks({halfWidth,length,depth=420,step=18,seed=31},place,veg=null){
  const group=new THREE.Group(),r=mulberry32(seed),mat=canopyMaterial();
  const noise=(x,z)=>Math.sin(x*.011+z*.007)*.5+Math.sin(x*.023-z*.019+1.3)*.3+Math.sin(x*.061+z*.05)*.2;
  const shoreOf=(x,side)=>halfWidth+45*noise(x*.6,side*90)+18*noise(x*2.1,side*40);
  // Bank trees: the Aholo canopy trees (long trunks) and kapok giants, as impostors.
  const all=veg?Object.values(veg.models).filter(t=>t.impostor):[],tall=all.filter(t=>['canopy_tall','kapok'].includes(t.name)),trees=tall.length?tall:all,setBack=trees.length?70:0;
  group.userData.segments=[];
  for(const side of [-1,1]){
    // Rows grow wider inland; with tree models the forest reaches the horizon.
    const rows=[];for(let d=0;d<=(trees.length?2600:depth);d+=step*(1+Math.max(0,d-300)/250))rows.push(d);
    const nx=Math.round(length/step)+1,nz=rows.length,pos=new Float32Array(nx*nz*3),col=new Float32Array(nx*nz*3);
    for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
      const x=-length/2+i*step,inward=rows[j];
      // The shore line itself wanders; a muddy bank rises, then the forest wall.
      const z=side*(shoreOf(x,side)+inward);
      const bank=-3+7*Math.min(1,inward/18);
      const canopy=26+9*noise(x,z)+6*noise(x*3.3,z*2.7)-(trees.length?6:0);
      const h=inward<14+setBack?bank:THREE.MathUtils.lerp(bank,canopy,Math.min(1,(inward-14-setBack)/16));
      const p=place(x,z,h);pos.set([p.x,p.y,p.z],(j*nx+i)*3);
      // Forest floor under the trees: wet mud at the water, leaf litter inland.
      const floor=inward<14+setBack;col.set(floor?(inward<12?[.32,.27,.2]:[.2,.19,.13]):[1,1,1],(j*nx+i)*3);
    }
    const idx=[];for(let j=0;j<nz-1;j++)for(let i=0;i<nx-1;i++){const a=j*nx+i,b=a+1,c=a+nx,d=c+1;if(side>0)idx.push(a,c,b,b,c,d);else idx.push(a,b,c,b,d,c);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();
    let surfaceMat=mat;
    if(trees.length){geo.setAttribute('color',new THREE.BufferAttribute(col,3));surfaceMat=canopyMaterial({vertexColors:true});}
    const mesh=new THREE.Mesh(geo,surfaceMat);mesh.receiveShadow=false;group.add(mesh);
    if(trees.length){addTreeLine(group,side,{length,shoreOf,place,trees,r});continue;}
    // Emergent giants above the canopy, mostly near the river face where they are seen.
    const count=Math.round(length/38),crown=new THREE.IcosahedronGeometry(1,2),m=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3();
    const giants=new THREE.InstancedMesh(crown,mat,count),trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.5,.8,1,7),new THREE.MeshStandardMaterial({color:'#5a5144',roughness:1}),count);
    for(let k=0;k<count;k++){
      const x=-length/2+r()*length,inward=30+r()**2*depth*.7,z=side*(shoreOf(x,side)+inward);
      const top=40+r()*18,w=9+r()*9,p=place(x,z,top);
      giants.setMatrixAt(k,m.compose(p,q.identity(),s.set(w,w*.42,w*(.8+r()*.4))));
      const base=place(x,z,(top-w*.3)/2);trunks.setMatrixAt(k,m.compose(base,q.identity(),s.set(1.4,top-w*.3,1.4)));
    }
    group.add(giants,trunks);
  }
  return group;
}
// Tree impostors along one bank: a dense line at the river face, thinning inland where the
// canopy surface takes over; heights from young trees to emergents.
function addTreeLine(group,side,{length,shoreOf,place,trees,r},segment=300){
  const m=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3(),UP=new THREE.Vector3(0,1,0),tint=new THREE.Color();
  for(let x0=-length/2;x0<length/2;x0+=segment){
    const lists=trees.map(()=>[]);
    // [from, to, trees per 100 m of river, height range]: the river face, the forest behind it
    // (its crowns above the canopy surface), and scattered emergents far inland.
    const bands=[[14,60,90,[10,34]],[60,160,140,[22,40]],[160,700,90,[30,44]],[30,1600,7,[44,58]]];
    for(const [a,b,per,[h0,h1]] of bands)for(let k=0;k<per*segment/100;k++){
      const x=x0+r()*segment,inward=a+(b-a)*r()**1.3,z=side*(shoreOf(x,side)+inward);
      // Stands and gaps along the bank.
      if(Math.sin(x*.013+side)*.5+Math.sin(x*.041+inward*.03)*.5<-.55)continue;
      const tall=inward<20?r()*.7:r(),height=h0+(h1-h0)*tall**1.4,t=Math.floor(r()*trees.length),tree=trees[t];
      const sy=height/tree.height,sxz=sy*(.6+r()*.25);
      const p=place(x,z,-3.3+7*Math.min(1,inward/18));
      lists[t].push({matrix:m.compose(p,q.setFromAxisAngle(UP,r()*6.28),s.set(sxz,sy,sxz)).clone(),tint:tint.setRGB(.86+.1*r(),1,.82+.1*r()).multiplyScalar(.74+.3*r()).clone()});
    }
    const holder=new THREE.Group();
    lists.forEach((list,t)=>{if(!list.length)return;const part=trees[t].impostor,im=new THREE.InstancedMesh(part.geometry,part.material,list.length);
      list.forEach((it,i)=>{im.setMatrixAt(i,it.matrix);im.setColorAt(i,it.tint);});im.frustumCulled=false;holder.add(im);});
    holder.userData.center=place(x0+segment/2,side*shoreOf(x0+segment/2,side),0);
    group.add(holder);group.userData.segments.push(holder);
  }
}
