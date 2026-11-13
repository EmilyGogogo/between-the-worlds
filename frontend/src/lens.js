import * as THREE from 'three';

// First-person lens (B-04, camera.firstPerson.lens): the scene is drawn with a wider field of
// view into a target, then redrawn through a curved projection, the way a side-facing eye
// takes in more of the world than a human. Art direction, not optics.
// - fieldDeg: the angle across the lens edge (the screen width, or the circle when round).
// - curve: 0 ordinary perspective … 1 equidistant fisheye.
// - round: 0 fills the screen … 1 the world is a large circle (radius in screen half-heights;
//   2 leaves only the corners outside). Past the edge the picture melts into the colour of the
//   water the eye is in, along a slowly rippling boundary, never a black frame.
// - edgeBlur, vignette: softer and slightly darker towards the edge.
const vertexShader=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const fragmentShader=`varying vec2 vUv;uniform sampler2D scene;
uniform float curve;uniform float round;uniform float radius;uniform float fade;uniform float fadeMax;uniform float ripple;uniform float time;
uniform float aspect;uniform float wideHalf;uniform float targetHalf;uniform float blur;uniform float vignette;uniform vec2 texel;uniform vec3 rim;
void main(){
  vec2 p=(vUv-.5)*2.*vec2(aspect,1.);
  float edge=mix(length(vec2(aspect,1.)),radius,round),r=length(p)/edge;
  // Angle from the centre of view: perspective and fisheye mixed by curve, reaching wideHalf at the edge.
  float theta=mix(atan(r*tan(wideHalf)),r*wideHalf,curve);
  vec2 q=length(p)>0.?normalize(p)*tan(min(theta,1.5))/tan(targetHalf):vec2(0.);
  vec2 uv=q/vec2(aspect,1.)*.5+.5;
  vec3 c=texture2D(scene,clamp(uv,0.,1.)).rgb;
  float e=smoothstep(.45,1.,r)*blur;
  if(e>0.){vec2 d=texel*e*3.;c=(c*2.+texture2D(scene,uv+vec2(d.x,0.)).rgb+texture2D(scene,uv-vec2(d.x,0.)).rgb+texture2D(scene,uv+vec2(0.,d.y)).rgb+texture2D(scene,uv-vec2(0.,d.y)).rgb)/6.;}
  c*=1.-vignette*smoothstep(.55,1.,r);
  gl_FragColor=vec4(c,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  float a=atan(p.y,p.x),wave=ripple*(sin(a*7.+time*.9)*.6+sin(a*13.-time*1.3)*.4);
  float outside=smoothstep(1.-fade,1.+fade*.35,r+wave);
  gl_FragColor.rgb=mix(gl_FragColor.rgb,rim,round*outside*fadeMax);
}`;

const NUMBERS=['fieldDeg','curve','round','radius','fade','fadeMax','ripple','edgeBlur','vignette'];
// A lens that changes nothing for a camera of this field of view.
export function plainLens(fov){return {fieldDeg:fov,curve:0,round:0,radius:2,fade:.14,fadeMax:0,ripple:0,edgeBlur:0,vignette:0};}
// Blend two lenses (null = plain at that view's own field of view), for view and possession blends.
export function blendLens(a,afov,b,bfov,f){
  if(!a&&!b)return null;
  const A={...plainLens(afov),...(a||{})},B={...plainLens(bfov),...(b||{})},out={};
  if(!a){A.radius=B.radius;A.fade=B.fade;}if(!b){B.radius=A.radius;B.fade=A.fade;}
  for(const k of NUMBERS)out[k]=A[k]+(B[k]-A[k])*f;
  return out;
}
// The lens at a fraction of its strength (tuning.firstPersonLensScale), up to 1.5×.
export function scaleLens(lens,fov,scale){
  if(!lens||scale<=0)return null;
  const P=plainLens(fov),out={};
  for(const k of NUMBERS)out[k]=P[k]+((lens[k]??P[k])-P[k])*scale;
  out.curve=Math.min(1,out.curve);out.round=Math.min(1,out.round);out.fadeMax=Math.min(1,out.fadeMax);out.radius=lens.radius??P.radius;out.fade=lens.fade??P.fade;
  return out;
}
export function lensIsPlain(l,fov){return !l||(Math.abs(l.fieldDeg-fov)<.01&&l.curve<.001&&l.round<.001&&l.edgeBlur<.001&&l.vignette<.001);}

export class Lens {
  constructor(renderer){
    this.renderer=renderer;this.clock=new THREE.Clock();this.size=new THREE.Vector2();this.rim=new THREE.Color();
    this.target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,colorSpace:THREE.LinearSRGBColorSpace,samples:4});
    const uniforms={scene:{value:this.target.texture},curve:{value:0},round:{value:0},radius:{value:2},fade:{value:.14},fadeMax:{value:0},ripple:{value:0},time:{value:0},
      aspect:{value:1},wideHalf:{value:.5},targetHalf:{value:.5},blur:{value:0},vignette:{value:0},texel:{value:new THREE.Vector2()},rim:{value:new THREE.Color()}};
    this.material=new THREE.ShaderMaterial({uniforms,vertexShader,fragmentShader,depthTest:false,depthWrite:false});
    this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material);this.quad.frustumCulled=false;
    this.screen=new THREE.Scene();this.screen.add(this.quad);this.flat=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    this.last=null;
  }
  // Draws the frame through `lens` (already blended and scaled); returns false when there is
  // nothing to bend, so the caller renders normally. rim: the colour past a round lens's edge
  // (the water colour; linear, like scene.fog.color). renderScale: target size × the screen.
  render(scene,camera,lens,{rim=null,renderScale=1.5}={}){
    const r=this.renderer,fov=camera.fov;
    if(lensIsPlain(lens,fov)){this.last=null;return false;}
    r.getDrawingBufferSize(this.size);
    const k=Math.min(renderScale,Math.sqrt(4e6/Math.max(1,this.size.x*this.size.y))),w=Math.max(1,Math.round(this.size.x*k)),h=Math.max(1,Math.round(this.size.y*k));
    if(this.target.width!==w||this.target.height!==h)this.target.setSize(w,h);
    const D=THREE.MathUtils.degToRad;
    const wideHalf=Math.min(D(78),Math.max(D(fov/2),D(lens.fieldDeg/2)));
    const edge=THREE.MathUtils.lerp(Math.hypot(camera.aspect,1),lens.radius,lens.round);
    // The target must hold the farthest screen point (the corner) at the angle it maps to.
    const corner=Math.hypot(camera.aspect,1),rc=corner/edge,cornerTheta=THREE.MathUtils.lerp(Math.atan(rc*Math.tan(wideHalf)),rc*wideHalf,lens.curve);
    const reach=Math.min(D(84),Math.max(cornerTheta,wideHalf)),targetHalf=Math.atan(Math.tan(reach)/corner);
    camera.fov=THREE.MathUtils.radToDeg(targetHalf*2);camera.updateProjectionMatrix();
    r.setRenderTarget(this.target);r.render(scene,camera);r.setRenderTarget(null);
    camera.fov=fov;camera.updateProjectionMatrix();
    const u=this.material.uniforms;
    u.wideHalf.value=wideHalf;u.targetHalf.value=targetHalf;u.curve.value=lens.curve;u.round.value=lens.round;u.radius.value=lens.radius;
    u.fade.value=lens.fade;u.fadeMax.value=lens.fadeMax;u.ripple.value=lens.ripple;u.time.value=this.clock.getElapsedTime();u.aspect.value=camera.aspect;
    u.blur.value=lens.edgeBlur;u.vignette.value=lens.vignette;u.texel.value.set(1/w,1/h);
    // Tone mapping and sRGB output happen in this screen pass (three.js skips both into a target);
    // the rim is mixed after them, so it is given in display colour.
    u.rim.value.copy(rim||this.rim.set(0,0,0)).convertLinearToSRGB();
    r.render(this.screen,this.flat);
    this.last={...lens,targetFovDeg:camera.fov===fov?THREE.MathUtils.radToDeg(targetHalf*2):null,target:[w,h]};
    return true;
  }
}
