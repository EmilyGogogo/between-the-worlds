import * as THREE from 'three';
import { SPECIES } from './species.js';

const MODEL_URL='./public/models/blue-morpho-flight-v002.glb';
const WING_SHADER=`
uniform float flapAngle;
varying float vWingUnderside;
// The source model lies in XY, with the body along Y and each wing extending along X.
float wingAngle(vec3 p){
  return -sign(p.x)*smoothstep(0.06,0.21,abs(p.x))*flapAngle;
}
vec3 turnWing(vec3 p,float a){
  float c=cos(a),s=sin(a);
  return vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);
}
`;

export async function preparePlayableButterfly(assets){
  const {scene}=await assets.load(MODEL_URL);
  const gull=SPECIES.gull;
  SPECIES.blueMorpho={
    ...gull,id:'preview_blue_morpho',name:'蓝闪蝶',place:'草叶之间',response:'',soundCue:null,
    radius:.19,height:.14,speed:2.7,boost:1.65,camera:.48,backCameraHeight:.16,fov:64,reach:18,flightHeight:8,
    collision:{...gull.collision,solid:false,boxes:[[-.18,-.06,-.11,.18,.09,.11]]},
  };
  for(const species of Object.values(SPECIES)){
    if(species.targets.includes('gull'))species.targets.push('blueMorpho');
  }
  return scene;
}

export function createButterflies(world,model,playable=false){
  const flock=new THREE.Group();
  flock.name='blue-morpho-flock';
  const routes=[
    [-1.5,-4.3,.65,.55,1.4,0], [0.8,-5.0,1.6,1.4,1.55,1.4],
    [-2.7,-6.1,1.1,1.7,1.1,3.0], [-3.8,-3.4,1.3,1.2,1.7,4.4],
    [-12,-15,2.5,2,1.25,2.2], [-9,-17,1.9,2.6,1.6,5.2],
  ];
  const butterflies=routes.map((route,index)=>{
    const flight=new THREE.Group();
    flight.name='blue-morpho-preview-'+index;
    const visual=model.clone();
    const flap={value:0};
    visual.traverse(object=>{
      if(!object.isMesh)return;
      object.frustumCulled=false;
      object.material=object.material.clone();
      object.material.onBeforeCompile=shader=>{
        shader.uniforms.flapAngle=flap;
        shader.vertexShader=WING_SHADER+shader.vertexShader
          .replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
            objectNormal=turnWing(objectNormal,wingAngle(position));`)
          .replace('#include <begin_vertex>',`#include <begin_vertex>
            vWingUnderside=smoothstep(0.08,0.22,abs(position.x))*smoothstep(0.15,0.75,-normal.z);
            float hinge=sign(position.x)*0.06;
            vec3 pivot=vec3(hinge,0.,0.);
            transformed=pivot+turnWing(position-pivot,wingAngle(position));`);
        // Reuse the underside's existing detail while restoring its brown coloration.
        shader.fragmentShader='varying float vWingUnderside;\n'+shader.fragmentShader
          .replace('#include <map_fragment>',`#include <map_fragment>
            float wingTone=dot(diffuseColor.rgb,vec3(0.2126,0.7152,0.0722));
            vec3 brownWing=vec3(0.23,0.103,0.038)*(0.43+2.3*wingTone);
            diffuseColor.rgb=mix(diffuseColor.rgb,brownWing,vWingUnderside);`);
      };
    });
    visual.rotation.x=-Math.PI/2;
    visual.scale.setScalar(0.17+index%3*0.025);
    flight.add(visual);
    if(playable)world.islandRoot.add(flight);
    else flock.add(flight);
    return {flight,visual,flap,route};
  });
  const start=world.byId.get('human-first').home;
  const update=(time,visible,player,transition)=>{
    flock.visible=visible;
    if(!visible)return;
    for(const {flight,flap,route} of butterflies){
      const [dx,dz,rx,rz,height,offset]=route;
      flap.value=0.3+0.7*Math.sin(time*2*Math.PI*(6+offset*.28)+offset);
      if(playable&&(flight===player?.root||flight===transition?.to.root))flight.userData.piloted=true;
      if(flight.userData.piloted)continue;
      const phase=time*(0.72+offset*.035)+offset;
      const x=start.x+dx+rx*Math.cos(phase);
      const z=start.z+dz+rz*Math.sin(phase);
      flight.position.set(x,world.height(x,z)+height+0.2*Math.sin(2*phase),z);
      flight.rotation.y=Math.atan2(rx*Math.sin(phase),-rz*Math.cos(phase));
    }
  };
  update(0,true);
  if(playable){
    for(const [index,{flight,visual}] of butterflies.entries()){
      const id=index===0?'blue-morpho-playable':`blue-morpho-playable-${index}`;
      world.addBody(id,'blueMorpho',flight,visual);
    }
  }else world.islandRoot.add(flock);
  return update;
}
