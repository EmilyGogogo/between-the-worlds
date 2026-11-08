import * as THREE from 'three';
import { TUNING } from './species.js';

// Rainforest atmosphere: a day that runs into night, and a year of a rainy and a dry
// season. Showers fall in the rainy season. Everything is driven by two phases
// (time of day, season) so a save can restore them, and debug URLs can pin them.
const tune=(key,fallback)=>TUNING[key]?.value??fallback;
const smooth=(a,b,x)=>{const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const c=hex=>new THREE.Color(hex);
const SKY={
  // A moonlit night: blue and readable, never pitch black.
  night:{zenith:c('#16243f'),horizon:c('#3b5070'),sun:c('#a9c1ea'),hemiSky:c('#6f86ad'),hemiGround:c('#2b2a24'),fog:c('#34465f')},
  dusk:{zenith:c('#2b3a5c'),horizon:c('#e39a6c'),sun:c('#ffb27a'),hemiSky:c('#c9a68a'),hemiGround:c('#4a3a26'),fog:c('#b98f73')},
  day:{zenith:c('#5f93c7'),horizon:c('#c8d6d2'),sun:c('#fff1d8'),hemiSky:c('#dfe9e2'),hemiGround:c('#6f6a45'),fog:c('#b9c7bd')},
  storm:{zenith:c('#5d686e'),horizon:c('#8e9997'),sun:c('#d5dbe0'),hemiSky:c('#a9b3b3'),hemiGround:c('#4d4a3a'),fog:c('#8c9693')},
};

const skyVertex=`varying vec3 dir;void main(){dir=position;gl_Position=projectionMatrix*viewMatrix*vec4(position+cameraPosition,1.);gl_Position.z=gl_Position.w;}`;
const skyFragment=`varying vec3 dir;
uniform vec3 sunDir;uniform vec3 moonDir;uniform vec3 skyZenith;uniform vec3 skyHorizon;uniform vec3 sunColor;
uniform float night;uniform float rain;uniform float time;uniform float underwater;uniform float cloud;
float sHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float sHash2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float sNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(sHash2(i),sHash2(i+vec2(1,0)),f.x),mix(sHash2(i+vec2(0,1)),sHash2(i+vec2(1,1)),f.x),f.y);}
float sFbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*sNoise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}
void main(){
  vec3 d=normalize(dir);float h=max(d.y,0.);
  vec3 sky=mix(skyHorizon,skyZenith,pow(h,.55));
  float sunUp=smoothstep(-.12,.05,sunDir.y);
  sky+=sunColor*pow(max(dot(d,sunDir),0.),12.)*.28*sunUp*(1.-rain*.6);
  sky+=sunColor*smoothstep(.9994,.9998,dot(d,sunDir))*6.*sunUp*(1.-rain);
  // Stars and the moon when the sun is down.
  vec3 sd=floor(d*260.);float star=step(.9975,sHash(sd))*smoothstep(.0,.25,d.y)*(.6+.4*sin(time*2.+sHash(sd+3.)*40.));
  sky+=vec3(.85,.9,1.)*star*night*(1.-cloud*.8)*(1.-rain);
  float moon=smoothstep(.9990,.9993,dot(d,moonDir));sky+=vec3(.85,.88,.95)*moon*night*2.2*(1.-rain*.8);
  sky+=vec3(.3,.36,.48)*pow(max(dot(d,moonDir),0.),24.)*night*.6;
  // Drifting cumulus over the forest; thicker and darker in rain.
  vec2 cp=d.xz/(d.y+.12)*1.4+vec2(time*.004,time*.0015);
  float cl=smoothstep(.52-cloud*.25,.85,sFbm(cp))*smoothstep(.0,.18,d.y);
  vec3 cloudCol=mix(mix(vec3(1.,.97,.93),sunColor,.25),skyHorizon*.8,rain*.7)*(1.-night*.6);
  sky=mix(sky,cloudCol,cl*.85);
  sky=mix(sky,vec3(.06,.18,.16),underwater);
  gl_FragColor=vec4(sky,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Atmosphere {
  constructor(scene,{sun,hemi,renderer}){
    this.scene=scene;this.sun=sun;this.hemi=hemi;this.renderer=renderer;
    const params=new URLSearchParams(location.search),debug=params.has('debug'),num=k=>debug&&params.has(k)?Number(params.get(k)):null;
    // Phases in [0,1): time of day (0 midnight, .25 sunrise, .5 noon, .75 sunset); season (0 rainy peak, .5 dry peak).
    // The clock runs on `cycle`; the night between sunset and sunrise passes in nightShare of it.
    this.timeOfDay=num('time')??tune('startTimeOfDay',.3);this.cycle=Atmosphere.cycleOf(this.timeOfDay);this.season=num('season')??tune('startSeason',.62);
    this.pinned={time:num('time')!=null,season:num('season')!=null,rain:num('rain')};
    this.rain=this.pinned.rain??0;this.showerSeed=Math.random()*100;this.elapsed=0;
    this.shared={sunDir:{value:new THREE.Vector3(0,1,0)},sunColor:{value:new THREE.Color()},skyZenith:{value:new THREE.Color()},skyHorizon:{value:new THREE.Color()},
      night:{value:0},rain:{value:0},time:{value:0},dryness:{value:.5},wetness:{value:0},waterLevel:{value:0},toIsland:{value:new THREE.Matrix4()}};
    this.skyUniforms={...this.shared,moonDir:{value:new THREE.Vector3()},underwater:{value:0},cloud:{value:.3}};
    const sky=new THREE.Mesh(new THREE.SphereGeometry(1000,32,20),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:this.skyUniforms,vertexShader:skyVertex,fragmentShader:skyFragment}));
    sky.renderOrder=-100;sky.frustumCulled=false;scene.add(sky);this.sky=sky;
    this.rainMesh=this.createRain();scene.add(this.rainMesh);
    this.fogColor=new THREE.Color();this.update(0,new THREE.Vector3());
  }
  // Sun time .2→.8 (dawn twilight to dusk twilight) spans 1 − nightShare of the cycle.
  static cycleOf(time){const n=tune('nightShare',.2),t=((time-.2)%1+1)%1;return t<.6?t/.6*(1-n):1-n+(t-.6)/.4*n;}
  static timeOf(cycle){const n=tune('nightShare',.2),c=((cycle%1)+1)%1;return (c<1-n?.2+c/(1-n)*.6:.8+(c-(1-n))/n*.4)%1;}
  get dryness(){return .5-.5*Math.cos(this.season*Math.PI*2);}
  // Showers come and go in the rainy season, never in the dry one.
  rainTarget(){
    if(this.pinned.rain!=null)return this.pinned.rain;
    const wet=1-smooth(.25,.6,this.dryness),t=this.elapsed/tune('showerPeriodSec',150)+this.showerSeed;
    const shower=Math.sin(t*6.283)*.6+Math.sin(t*2.7+1.3)*.4;
    return wet*smooth(.05,.45,shower);
  }
  createRain(){
    const n=3200,pos=new Float32Array(n*6),seed=new Float32Array(n*2);
    for(let i=0;i<n;i++){const x=(Math.random()-.5)*60,y=Math.random()*30,z=(Math.random()-.5)*60;pos.set([x,y,z,x,y-.55,z],i*6);seed[i*2]=seed[i*2+1]=Math.random();}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('seed',new THREE.BufferAttribute(seed,1));
    const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time:this.shared.time,rain:this.shared.rain,night:this.shared.night,center:{value:new THREE.Vector3()}},
      vertexShader:`attribute float seed;uniform float time;uniform vec3 center;varying float vSeed;
void main(){vec3 p=position;p.y=mod(p.y-time*(18.+seed*6.),30.);p.x+=p.y*.08;p+=center-vec3(0.,8.,0.);vSeed=seed;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
      fragmentShader:`uniform float rain;uniform float night;varying float vSeed;void main(){if(vSeed>rain)discard;gl_FragColor=vec4(vec3(.78,.82,.85)*(1.-night*.35),.32);}`});
    const lines=new THREE.LineSegments(geo,mat);lines.frustumCulled=false;lines.renderOrder=5;return lines;
  }
  serialize(){return {timeOfDay:this.timeOfDay,season:this.season};}
  restore(s){if(Number.isFinite(s?.timeOfDay)&&!this.pinned.time){this.timeOfDay=s.timeOfDay;this.cycle=Atmosphere.cycleOf(s.timeOfDay);}if(Number.isFinite(s?.season)&&!this.pinned.season)this.season=s.season;}
  // focus: world position the lighting follows; fogBase: the current layer's fog density.
  update(dt,focus,{underwater=false,camera=null}={}){
    this.elapsed+=dt;
    if(!this.pinned.time){this.cycle=(this.cycle+dt/tune('dayLengthSec',1200))%1;this.timeOfDay=Atmosphere.timeOf(this.cycle);}
    if(!this.pinned.season)this.season=(this.season+dt/tune('seasonLengthSec',4800))%1;
    this.rain=THREE.MathUtils.damp(this.rain,this.rainTarget(),.25,dt);
    const angle=(this.timeOfDay-.25)*Math.PI*2,sunDir=this.shared.sunDir.value.set(Math.cos(angle)*.82,Math.sin(angle),Math.cos(angle)*-.2+.32).normalize();
    const moonDir=this.skyUniforms.moonDir.value.copy(sunDir).multiplyScalar(-1);moonDir.y=Math.abs(moonDir.y)*.8+.15;moonDir.normalize();
    const e=sunDir.y,day=smooth(-.05,.35,e),dusk=smooth(-.22,.02,e)*(1-smooth(.05,.35,e)),night=1-smooth(-.22,-.02,e),rain=this.rain;
    const mix=key=>{const out=SKY.night[key].clone();out.lerp(SKY.dusk[key],Math.min(1,dusk+day));out.lerp(SKY.day[key],day);out.lerp(SKY.storm[key].clone().multiplyScalar(.25+.75*(1-night)),rain*.85);return out;};
    this.shared.skyZenith.value.copy(mix('zenith'));this.shared.skyHorizon.value.copy(mix('horizon'));this.shared.sunColor.value.copy(mix('sun'));
    this.shared.night.value=night;this.shared.rain.value=rain;this.shared.time.value=this.elapsed;
    this.shared.dryness.value=this.dryness;this.shared.wetness.value=Math.max(rain,THREE.MathUtils.damp(this.shared.wetness.value,rain,.08,dt));
    this.skyUniforms.underwater.value=THREE.MathUtils.damp(this.skyUniforms.underwater.value,underwater?1:0,2,dt);
    this.skyUniforms.cloud.value=.25+.5*(1-this.dryness)+rain*.4;
    // Lights: the sun by day, a dim blue moon by night; rain flattens both.
    const sunUp=e>-.04,light=sunUp?sunDir:moonDir;
    this.sun.color.copy(sunUp?mix('sun'):SKY.night.sun);
    this.sun.intensity=sunUp?(.4+2.4*day+.8*dusk)*(1-rain*.6):.95*(1-rain*.4);
    this.sun.userData.direction=light;
    this.hemi.color.copy(mix('hemiSky'));this.hemi.groundColor.copy(mix('hemiGround'));
    this.hemi.intensity=.95+.75*day+.3*dusk+rain*.2;
    this.fogColor.copy(mix('fog'));// Morning mist rises off the river after dawn and burns off by mid-morning.
    this.fogBoost=1+rain*1.6+.9*smooth(.2,.26,this.timeOfDay)*(1-smooth(.29,.36,this.timeOfDay));
    if(this.renderer)this.renderer.toneMappingExposure=1+night*.15;
    if(camera){this.rainMesh.material.uniforms.center.value.copy(camera.position);this.rainMesh.visible=rain>.02&&!underwater;}
    this.focus=focus;
  }
  // A short label for tests and debugging.
  get phase(){const e=this.shared.sunDir.value.y;return e>.25?'day':e>-.1?'twilight':'night';}
}

// Fireflies over the meadow and the oxbow banks: they show at night, fewer in heavy rain.
export function fireflies(shared,points){
  const n=points.length,pos=new Float32Array(n*3),seed=new Float32Array(n);
  points.forEach((p,i)=>{pos.set(p,i*3);seed[i]=Math.random();});
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('seed',new THREE.BufferAttribute(seed,1));
  const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{time:shared.time,night:shared.night,rain:shared.rain},
    vertexShader:`attribute float seed;uniform float time;varying float vGlow;
void main(){vec3 p=position+vec3(sin(time*.3+seed*20.)*1.6,sin(time*.5+seed*13.)*.6,cos(time*.27+seed*31.)*1.6);
vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;vGlow=pow(max(0.,sin(time*(1.1+seed)+seed*50.)),3.);gl_PointSize=clamp(90./-mv.z,1.5,9.);}`,
    fragmentShader:`uniform float night;uniform float rain;varying float vGlow;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.0,d)*vGlow*night*(1.-rain*.8);if(a<.01)discard;gl_FragColor=vec4(vec3(1.,.93,.45)*a*1.6,a);}`});
  const cloud=new THREE.Points(geo,mat);cloud.frustumCulled=false;return cloud;
}
