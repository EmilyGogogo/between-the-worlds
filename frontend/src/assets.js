import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SPECIES, TUNING, mulberry32 } from './species.js';
import { canopyMaterial } from './banks.js';
import { loadVegetation } from './vegetation.js';

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
  // Glossy, see-through dew without transmission: a transmissive material makes the renderer
  // draw the whole scene once more whenever a grass plant is on screen.
  const dew=new THREE.MeshPhysicalMaterial({color:'#e5f2d4',roughness:.05,clearcoat:1,transparent:true,opacity:.55});
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

// --- Rainforest trees (D-030): three layers. Emergent kapok above the canopy, canopy broadleaf,
// açaí palm clumps in the understory. Bark merges into one draw, leaves are one instanced draw.
function canvasTexture(w,h,draw,color=true){
  const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'));
  const t=new THREE.CanvasTexture(c);if(color)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
// A pinnate frond (palm or fern) drawn along the texture's height: rachis plus drooping leaflets.
function frondTexture(seed,{leaflets=34,width=.9,colors=['#3d5a24','#4e6b2b','#334f20']}={}){
  return canvasTexture(128,512,x=>{
    const r=mulberry32(seed);x.lineCap='round';
    for(let i=0;i<leaflets;i++){const y=20+i*(470/leaflets),len=(1-Math.abs(i/leaflets-.45)*1.2)*60*width+12;
      for(const side of [-1,1]){x.strokeStyle=colors[(i+side+3)%colors.length];x.lineWidth=3+r()*2;x.beginPath();x.moveTo(64,y);x.quadraticCurveTo(64+side*len*.6,y+6,64+side*len,y+16+r()*14);x.stroke();}}
    x.strokeStyle='#5d5a32';x.lineWidth=4;x.beginPath();x.moveTo(64,0);x.lineTo(64,512);x.stroke();
  });
}
const frondMats={palm:frondTexture(7),fern:frondTexture(13,{leaflets:26,width:.8,colors:['#4f7a2c','#5f8a34','#3f6526']})};
for(const k of Object.keys(frondMats))frondMats[k]=new THREE.MeshStandardMaterial({map:frondMats[k],alphaTest:.3,side:THREE.DoubleSide,roughness:.85,color:'#e4ead8'});
// An arching strip from the origin along +X; length L, width W, rise and droop shape the arc.
function frondGeometry(L,W,rise=.45,droop=.85,rows=12){
  const pos=[],uv=[],idx=[];
  for(let i=0;i<=rows;i++){const t=i/rows,x=L*t,y=L*(rise*t-droop*t*t),w=W*(.35+.65*Math.sin(Math.PI*Math.min(1,t*1.15)));
    pos.push(x,y-w*.12,-w/2,x,y-w*.12,w/2);uv.push(0,1-t,1,1-t);   // edges hang a little (V section)
    pos[pos.length-5]+=w*.12;
    if(i<rows){const n=i*2;idx.push(n,n+2,n+1,n+1,n+2,n+3);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
const greyBarkMat=standard('#c4c0b0',{map:barkTex,bumpMap:barkTex,bumpScale:.08});
const palmBarkMat=standard('#9c9a84',{map:barkTex,bumpMap:barkTex,bumpScale:.04});
const lianaMat=standard('#3f4a2a');
const tropicalLeafMat=new THREE.MeshStandardMaterial({map:foliageTexture(false),color:'#8fae6e',emissive:'#20360f',emissiveIntensity:.16,alphaTest:.15,alphaToCoverage:true,side:THREE.DoubleSide,roughness:.9});
function mergeBark(root,mat){
  root.updateMatrixWorld(true);const byMat=new Map();
  for(const child of [...root.children])if(child.isMesh&&!child.userData.keep){const g=child.geometry.clone().applyMatrix4(child.matrix);const m=child.material;if(!byMat.has(m))byMat.set(m,[]);byMat.get(m).push(g);root.remove(child);}
  for(const [m,list] of byMat){const merged=mergeGeometries(list.map(g=>g.index?g.toNonIndexed():g));mesh(merged,m,root);}
}
function leafCards(root,cards,material){
  const dummy=new THREE.Object3D(),leaves=new THREE.InstancedMesh(cardGeometry,material,cards.length),r=mulberry32(cards.length);
  cards.forEach((c,i)=>{dummy.position.set(c.x,c.y,c.z);dummy.rotation.set(c.rx,c.ry,c.rz);dummy.scale.setScalar(c.size);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);leaves.setColorAt(i,new THREE.Color().setScalar(.72+r()*.34));});
  leaves.castShadow=true;leaves.receiveShadow=true;root.add(leaves);
}
// Açaí: a clump of slender stems, each with a green crown shaft and arching pinnate fronds.
function palm(seed){
  const root=new THREE.Group(),r=mulberry32(seed),stems=3+Math.floor(r()*3),fronds=new THREE.Group();
  for(let k=0;k<stems;k++){
    const a=r()*6.28,off=k?.5+r()*.7:0,h=(k?6.5+r()*2.5:9.2),lean=k?.12+r()*.12:.03;
    const base=new THREE.Vector3(Math.cos(a)*off,0,Math.sin(a)*off),top=base.clone().add(new THREE.Vector3(Math.cos(a)*h*lean,h,Math.sin(a)*h*lean));
    const mid=base.clone().lerp(top,.5).add(new THREE.Vector3(Math.cos(a)*h*lean*.25,0,Math.sin(a)*h*lean*.25));
    branch(root,base,mid,.14,.12,palmBarkMat);branch(root,mid,top,.12,.1,palmBarkMat);
    branch(root,top,top.clone().add(new THREE.Vector3(0,1.1,0)),.13,.09,standard('#5e7a3a'));   // crown shaft
    const crown=top.clone().add(new THREE.Vector3(0,1.05,0)),n=9+Math.floor(r()*4);
    for(let i=0;i<n;i++){
      const f=new THREE.Mesh(frondGeometry(2.6+r()*.8,1.15,.55+r()*.2,.8+r()*.3),frondMats.palm);
      f.position.copy(crown);f.rotation.set((r()-.5)*.2,i/n*6.28+r()*.3,0);f.castShadow=true;fronds.add(f);
    }
    if(r()<.6){const fruit=new THREE.Mesh(new THREE.SphereGeometry(.22,8,6),standard('#2e1b2c'));fruit.position.copy(top).add(new THREE.Vector3(.18,.15,0));fruit.scale.set(1,1.6,1);root.add(fruit);}
  }
  mergeBark(root);
  fronds.updateMatrixWorld(true);const merged=mergeGeometries(fronds.children.map(m=>m.geometry.clone().applyMatrix4(m.matrixWorld)));
  mesh(merged,frondMats.palm,root);root.userData.sway=.012;return root;
}
// Kapok (Ceiba): plank buttresses, a straight pale trunk and a flat umbrella crown above the canopy.
function kapok(seed){
  const root=new THREE.Group(),r=mulberry32(seed),H=31,cards=[];
  for(let i=0;i<6;i++){
    const a=i/6*6.28+r()*.4,len=2.4+r()*1.6,hgt=2.4+r()*1.4,shape=new THREE.Shape();
    shape.moveTo(0,0);shape.lineTo(len,0);shape.quadraticCurveTo(len*.25,hgt*.15,0,hgt);shape.closePath();
    const g=new THREE.ExtrudeGeometry(shape,{depth:.22,bevelEnabled:false,curveSegments:6});g.translate(.6,0,-.11);
    const m=mesh(g,greyBarkMat,root);m.rotation.y=a;
  }
  branch(root,new THREE.Vector3(0,0,0),new THREE.Vector3(.3,H*.55,0),1.45,1.15,greyBarkMat);
  branch(root,new THREE.Vector3(.3,H*.55,0),new THREE.Vector3(0,H,.2),1.15,.85,greyBarkMat);
  const limbs=6+Math.floor(r()*2);
  for(let i=0;i<limbs;i++){
    const a=i/limbs*6.28+r()*.5,rad=9+r()*5,y0=H-2+r()*3,start=new THREE.Vector3(0,y0,0),end=new THREE.Vector3(Math.cos(a)*rad,y0+3.5+r()*3,Math.sin(a)*rad);
    const elbow=start.clone().lerp(end,.5).add(new THREE.Vector3(0,1.4,0));
    branch(root,start,elbow,.55,.36,greyBarkMat);branch(root,elbow,end,.36,.14,greyBarkMat);
    for(let k=0;k<3;k++){const tw=end.clone().add(new THREE.Vector3((r()-.5)*5,1+r()*1.5,(r()-.5)*5));branch(root,elbow.clone().lerp(end,.6),tw,.16,.05,greyBarkMat);
      for(let n=0;n<42;n++){const u=r()*6.28,d=Math.sqrt(r())*4.8;cards.push({x:tw.x+Math.cos(u)*d,y:tw.y+(r()-.3)*1.6,z:tw.z+Math.sin(u)*d,size:1.7+r()*1.4,rx:-1.3+r()*.6,ry:r()*6.28,rz:(r()-.5)*.6});}}
    if(r()<.7){const top=elbow.clone().lerp(end,.4+r()*.3);branch(root,top,top.clone().add(new THREE.Vector3((r()-.5)*1.5,-(12+r()*14),(r()-.5)*1.5)),.06,.05,lianaMat);}   // hanging lianas
    if(r()<.6){const e=mesh(new THREE.ConeGeometry(.6,.9,7),standard('#55702f'),root);e.position.copy(start.clone().lerp(elbow,.8)).y+=.6;e.rotation.x=Math.PI;e.userData.keep=true;}   // bromeliad
  }
  mergeBark(root);leafCards(root,cards,tropicalLeafMat);root.userData.sway=.002;return root;
}
// Canopy broadleaf: a tall bare trunk forking under a broad, flat-topped crown.
function canopyTree(seed){
  const root=new THREE.Group(),r=mulberry32(seed),H=11+r()*2.5,cards=[];
  branch(root,new THREE.Vector3(),new THREE.Vector3(.4,H,-.2),.85,.5);
  const forks=4+Math.floor(r()*2);
  for(let i=0;i<forks;i++){
    const a=i/forks*6.28+r()*.6,rad=3.5+r()*2.8,start=new THREE.Vector3(.4,H-1.2-r()*1.5,-.2),end=new THREE.Vector3(Math.cos(a)*rad,H+4+r()*3,Math.sin(a)*rad);
    branch(root,start,end,.42,.16);
    for(let k=0;k<2;k++){const tw=end.clone().add(new THREE.Vector3((r()-.5)*3.5,.8+r()*1.8,(r()-.5)*3.5));branch(root,end,tw,.15,.05);
      for(let n=0;n<60;n++){const u=r()*6.28,v=Math.acos(2*r()-1),d=Math.cbrt(r())*3.3;cards.push({x:tw.x+Math.sin(v)*Math.cos(u)*d,y:tw.y+.4+Math.cos(v)*d*.6,z:tw.z+Math.sin(v)*Math.sin(u)*d,size:1.5+r()*1.2,rx:r()*3,ry:r()*6.28,rz:r()*3});}}
    if(r()<.45){const top=start.clone().lerp(end,.7);branch(root,top,top.clone().add(new THREE.Vector3(0,-(6+r()*6),0)),.05,.04,lianaMat);}
  }
  mergeBark(root);leafCards(root,cards,tropicalLeafMat);root.userData.sway=.003;return root;
}
// Background forest (env.forest): each tree style flattened into one geometry per material, so a
// whole cell of trees is one instanced draw per part. `far` is a cheap crown-and-trunk stand-in.
// A lumpy crown: several overlapping lobes, so far trees read as foliage rather than domes.
const blobGeometry=(()=>{const r=mulberry32(77),lobes=[];
  for(let i=0;i<6;i++){const g=new THREE.IcosahedronGeometry(.52+r()*.18,0),a=i/6*6.28,d=i?.46:0;g.translate(Math.cos(a)*d,(r()-.3)*.35+(i?0:.2),Math.sin(a)*d);lobes.push(g);}
  return mergeGeometries(lobes);})(),stickGeometry=new THREE.CylinderGeometry(.5,.7,1,6);stickGeometry.translate(0,.5,0);
const blobCanopyMat=canopyMaterial(),stickMat=standard('#4f473a');
export function forestTemplates(){
  const flatten=root=>{
    root.updateMatrixWorld(true);const byMat=new Map(),m=new THREE.Matrix4();
    root.traverse(o=>{
      if(!o.isMesh)return;const list=byMat.get(o.material)||[];byMat.set(o.material,list);
      const base=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
      for(const key of Object.keys(base.attributes))if(!['position','normal','uv'].includes(key))base.deleteAttribute(key);
      if(o.isInstancedMesh)for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);list.push(base.clone().applyMatrix4(m.clone().premultiply(o.matrixWorld)));}
      else list.push(base.applyMatrix4(o.matrixWorld));
    });
    return [...byMat].map(([material,list])=>({geometry:mergeGeometries(list),material}));
  };
  const box=root=>new THREE.Box3().setFromObject(root);
  return {
    canopy:[11,23].map(seed=>{const t=canopyTree(seed),b=box(t);return {parts:flatten(t),height:b.max.y,crown:[(b.max.x-b.min.x)/2,(b.max.z-b.min.z)/2],crownBase:b.max.y*.42};}),
    palm:[5,17].map(seed=>{const t=palm(seed),b=box(t);return {parts:flatten(t),height:b.max.y,crown:[2.4,2.4],crownBase:b.max.y*.68};}),
    kapok:[3].map(seed=>{const t=kapok(seed),b=box(t);return {parts:flatten(t),height:b.max.y,crown:[(b.max.x-b.min.x)/2,(b.max.z-b.min.z)/2],crownBase:b.max.y*.66};}),
    far:{blob:{geometry:blobGeometry,material:blobCanopyMat},stick:{geometry:stickGeometry,material:stickMat}},
  };
}
// Forest floor (env.understory): a fern rosette and a leafy shrub, each one merged geometry.
export function understoryModels(){
  const fern=new THREE.Group(),r=mulberry32(5);
  for(let i=0;i<9;i++){const f=new THREE.Mesh(frondGeometry(.9+r()*.4,.42,.9,.95,8));f.rotation.set(0,i/9*6.28+r()*.3,0);f.position.y=.02;fern.add(f);}
  fern.updateMatrixWorld(true);
  const shrub=new THREE.Group(),cards=[];
  for(let n=0;n<26;n++){const u=r()*6.28,v=Math.acos(2*r()-1),d=Math.cbrt(r())*.7;const c=new THREE.Mesh(cardGeometry);c.position.set(Math.sin(v)*Math.cos(u)*d,.75+Math.cos(v)*d*.7,Math.sin(v)*Math.sin(u)*d);c.rotation.set(r()*3,r()*6.28,r()*3);c.scale.setScalar(.45+r()*.3);shrub.add(c);}
  shrub.updateMatrixWorld(true);
  const merge=g=>mergeGeometries(g.children.map(m=>m.geometry.clone().applyMatrix4(m.matrixWorld)));
  return [{geometry:merge(fern),material:frondMats.fern,weight:.6},{geometry:merge(shrub),material:tropicalLeafMat,weight:.4}];
}

// A low river island seen from the water: sandy margins, muddy banks and clumps of forest
// around its rim. The middle stays open, where the bodies it carries stand (W-05).
const riverIslandCanopy=canopyMaterial();
function riverIsland(s,seed){
  const [rx,h,rz]=s.surface?.radii||[s.radius,s.height,s.radius],r=mulberry32(seed),root=new THREE.Group();
  const rings=36,segments=120,pos=[],col=[],idx=[],sand=new THREE.Color('#b9a37c'),mud=new THREE.Color('#5d4a33'),grass=new THREE.Color('#5d6d33');
  const lobes=[...Array(5)].map(()=>[r()*6.28,.04+r()*.07,2+Math.floor(r()*4)]);
  const edge=a=>1+lobes.reduce((sum,[ph,amp,k])=>sum+Math.sin(a*k+ph)*amp,0);
  for(let i=0;i<=rings;i++)for(let j=0;j<segments;j++){
    const t=i/rings*1.12,a=j/segments*Math.PI*2,e=edge(a),x=Math.cos(a)*rx*t*e,z=Math.sin(a)*rz*t*e;
    const inside=Math.max(0,1-t*t),y=t<1?h*Math.sqrt(inside):-3*(t-1)/.12;
    pos.push(x,y,z);const c=t>.93?sand.clone().lerp(mud,THREE.MathUtils.clamp((t-.99)*30,0,1)):grass.clone().lerp(sand,THREE.MathUtils.clamp((t-.8)*6,0,1));col.push(c.r,c.g,c.b);
  }
  for(let i=0;i<rings;i++)for(let j=0;j<segments;j++){const a=i*segments+j,b=i*segments+(j+1)%segments,c=a+segments,d=b+segments;idx.push(a,c,b,b,c,d);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));geo.setIndex(idx);geo.computeVertexNormals();
  mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}),root);
  const crowns=[],crownGeo=new THREE.IcosahedronGeometry(1,1),m=new THREE.Matrix4(),q=new THREE.Quaternion(),v=new THREE.Vector3(),sc=new THREE.Vector3();
  for(let k=0;k<160;k++){
    const a=r()*Math.PI*2,t=.62+r()*.3,e=edge(a),x=Math.cos(a)*rx*t*e,z=Math.sin(a)*rz*t*e,ground=h*Math.sqrt(Math.max(0,1-t*t)),w=12+r()*14,top=ground+18+r()*22;
    // Each clump is a mass of forest from just above the ground to its crown line.
    crowns.push(m.compose(v.set(x,(ground+2+top)/2,z),q.identity(),sc.set(w,(top-ground-2)/2,w*(.8+r()*.4))).clone());
  }
  const canopy=new THREE.InstancedMesh(crownGeo,riverIslandCanopy,crowns.length);crowns.forEach((mat,i)=>canopy.setMatrixAt(i,mat));canopy.castShadow=true;canopy.receiveShadow=true;root.add(canopy);
  return root;
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
  tree:(style,seed)=>style==='palm'?palm(seed):style==='kapok'?kapok(seed):style==='canopy'?canopyTree(seed):tree(style,seed),
  rock:(style,seed)=>style==='hill'?hill(seed):makeRock(seed),
  island:(style,seed,s)=>style==='river'?riverIsland(s,seed):dome(s),
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
    // Aholo rainforest models for the scenery forest and floor (env.forest, env.understory).
    const vegetationUrl=(this.manifest.decor||[]).map(s=>s.scatter?.vegetation).find(Boolean);
    if(vegetationUrl)jobs.push(loadVegetation(vegetationUrl,this.loader).then(v=>{this.vegetation=v;}).catch(e=>{this.errors.push(`vegetation ${vegetationUrl}: ${e.message}`);console.warn('Vegetation models unavailable; procedural trees kept.',e);}));
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
        // LOD levels come from their own files, or name a node of the main file (`node`).
        const lod=await Promise.all((merged.lod||[]).map(async level=>({distance:level.distance,node:level.node,gltf:level.url?await this.load(level.url):null})));
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
    // Bodies stand on their base; islands keep the file's own sea-level origin (L-05); a file
    // whose origin already marks the base (a trunk that is not the middle of its crown) keeps it.
    model.scale.multiplyScalar(factor);
    if(entry.pivot==='file_origin')model.position.set(0,0,0);
    else{const baseY=entry.pivot==='sea_level_center'?0:bounds.min.y;model.position.set(-center.x*factor,-baseY*factor,-center.z*factor);}
  }
  make(kind,seed){
    const list=this.templates.get(kind);
    if(!list)return makeProcedural(kind,seed,this.manifest.species?.[kind]);
    const template=this.pick(list,mulberry32(seed)),entry=template.entry;
    const root=new THREE.Group(),model=clone(template.gltf.scene);
    this.fit(model,entry,SPECIES[kind].height);
    const inFile=template.lod.filter(level=>level.node);
    if(inFile.length){
      // Levels inside the file: `lod0` near, then the named nodes; all share the file's fit.
      const lod=new THREE.LOD(),near=model.getObjectByName('lod0');
      near.parent.add(lod);lod.addLevel(near,0);
      for(const level of inFile){const far=model.getObjectByName(level.node);if(far)lod.addLevel(far,level.distance);}
      root.add(model);
    }else if(template.lod.length){
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
