import * as THREE from 'three';
import { SPECIES } from './species.js';

// Birds and fish that nobody is playing keep moving along routes from data/anchors.json
// "ambient" (D-027). A route is a function of world time, so it repeats the same way every
// session (W-03); each body steers toward its route point at a capped speed, so after a flee
// or after the player leaves it, it eases back instead of jumping.
const TAU=Math.PI*2,v=new THREE.Vector3(),scratch=new THREE.Vector3();

export class AmbientMotion{
  constructor(world,groups=[]){
    this.world=world;this.paused=false;this.state=new Map();this.groups=[];
    for(const g of groups){
      const members=g.members.map(id=>world.byId.get(id)).filter(Boolean);if(!members.length)continue;
      const group={...g,members};this.groups.push(group);
      members.forEach((e,index)=>this.state.set(e,{group,index,resumeAt:0,held:false}));
    }
  }
  has(e){return this.state.has(e);}
  // Route point at time t in the carrier's frame. Around lowAtDeg the route slows (lowSlowdown)
  // so a ground body, which cannot look up, has time to aim at a low-flying bird.
  route(g,t,out={}){
    const u=((t/g.periodSec+(g.phaseDeg||0)/360)%1+1)%1,vert=g.vertical||{};
    const low=THREE.MathUtils.degToRad(vert.lowAtDeg||0),theta=TAU*u-(vert.lowSlowdown||0)*Math.sin(TAU*u-low);
    const [a,b]=g.radii;let x,z;
    if(g.shape==='figure8'){x=a*Math.sin(theta);z=b*Math.sin(2*theta)/2;}else{x=a*Math.cos(theta);z=b*Math.sin(theta);}
    const r=THREE.MathUtils.degToRad(g.rotationDeg||0),c=Math.cos(r),s=Math.sin(r);
    out.x=g.center[0]+x*c-z*s;out.z=g.center[1]+x*s+z*c;
    out.lift=vert.mode==='aboveGround'?vert.lowM+(vert.highM-vert.lowM)*(1-Math.cos(theta-low))/2:0;
    return out;
  }
  // Where one member should be: the route point, its place in the formation, a little drift.
  goal(g,index,t,e){
    const p=this.route(g,t),q=this.route(g,t+.25),fx=q.x-p.x,fz=q.z-p.z,len=Math.hypot(fx,fz)||1,ux=fx/len,uz=fz/len;
    let x=p.x,z=p.z,y,dy=0;
    const f=g.formation;
    if(f&&g.members.length>1){
      const cols=f.columns||4,row=Math.floor(index/cols),col=index%cols,phase=index*2.399;
      const side=(col-(cols-1)/2)*f.spacingM+(row%2?f.spacingM/2:0)+(f.wobbleM||0)*Math.sin(t*.9+phase);
      const back=row*f.spacingM+(f.wobbleM||0)*Math.cos(t*.7+phase);
      x+=-uz*side-ux*back;z+=ux*side-uz*back;dy=(f.wobbleM||0)*.5*Math.sin(t*1.1+phase);
    }
    const s=SPECIES[e.kind],vert=g.vertical||{};
    if(vert.mode==='belowSurface'){
      const water=this.world.water(x,z);
      if(!water||(vert.water&&water.id!==vert.water))return null;     // never leave the water body (M-04)
      y=THREE.MathUtils.clamp(water.surface-vert.depthM-s.height+dy,water.floor+.3,water.surface-s.height-.15);
    }else{
      const water=this.world.water(x,z);
      y=Math.max(this.world.height(x,z),water?water.surface:-Infinity)+p.lift+dy;
      y=this.clear(e,x,y,z);
    }
    return {x,y,z,ux,uz};
  }
  // Lift a flying goal over solid bodies in the same carrier frame (trees, rocks, the knoll).
  clear(e,x,y,z){
    const records=this.world.collision?.records;if(!records)return y;
    // Footprint from the real model (a gull's wings span metres), safe for any heading.
    const bounds=e.visual?.userData.localBounds,size=bounds?bounds.getSize(scratch):null;
    const r=size?Math.hypot(size.x,size.z)/2:SPECIES[e.kind].radius,h=size?size.y:SPECIES[e.kind].height,parent=e.root.parent;
    for(let pass=0;pass<2;pass++)for(const rec of records){
      if(rec.parent!==parent||rec.entity===e||this.state.has(rec.entity))continue;
      const b=rec.frameBox;
      if(x+r<b.min.x||x-r>b.max.x||z+r<b.min.z||z-r>b.max.z)continue;
      if(y<b.max.y+.3&&y+h>b.min.y)y=b.max.y+.3;
    }
    return y;
  }
  update(dt,player,hold=null){
    if(this.paused||!(dt>0))return;
    const t=this.world.time;
    for(const [e,st] of this.state){
      // The body the player is in (or entering) is not ours; once released it rests, then rejoins.
      if(e===player||e===hold){st.held=true;continue;}
      const g=st.group;
      if(st.held){st.held=false;st.resumeAt=t+(g.resumeAfterSec??4);e.moving=false;}
      if(e.flee||t<st.resumeAt)continue;
      const goal=this.goal(g,st.index,t,e);if(!goal){e.moving=false;continue;}
      const p=e.root.position;v.set(goal.x-p.x,goal.y-p.y,goal.z-p.z);
      const max=(g.maxSpeedMS??10)*dt,dist=v.length();if(dist>max)v.multiplyScalar(max/dist);
      p.add(v);
      // The body itself, not only its goal, must stay clear while it catches up (M-01).
      if(g.vertical?.mode==='aboveGround')p.y=this.clear(e,p.x,p.y,p.z);
      const hx=Math.abs(v.x)+Math.abs(v.z)>1e-4?v.x:goal.ux,hz=Math.abs(v.x)+Math.abs(v.z)>1e-4?v.z:goal.uz;
      const yaw=Math.atan2(-hx,-hz),h=e.heading||0;
      e.heading=h+Math.atan2(Math.sin(yaw-h),Math.cos(yaw-h))*Math.min(1,dt*3);e.root.rotation.y=e.heading;
      // Birds flap while climbing and glide otherwise; fish use the role the route names.
      e.moving=g.animation==='climb'?v.y/dt>.4:g.animation==='move';
    }
  }
}
