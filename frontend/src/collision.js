import * as THREE from 'three';
import { SPECIES, TUNING } from './species.js';

export class WorldCollision {
  constructor(world){this.world=world;this.records=[];this.ray=new THREE.Ray();this.externalRay=new THREE.Raycaster();}
  localBoxes(entity){
    if(entity.visual?.userData.external){
      const custom=entity.visual.userData.collisionBoxes;
      if(custom?.length)return custom.map(b=>new THREE.Box3(new THREE.Vector3(...b.slice(0,3)),new THREE.Vector3(...b.slice(3,6))));
      return [entity.visual.userData.localBounds.clone()];
    }
    return SPECIES[entity.kind].collision.boxes.map(b=>new THREE.Box3(new THREE.Vector3(...b.slice(0,3)),new THREE.Vector3(...b.slice(3,6))));
  }
  related(a,b){
    for(let p=a.root;p;p=p.parent)if(p===b.root)return true;
    for(let p=b.root;p;p=p.parent)if(p===a.root)return true;
    return false;
  }
  refresh(){
    this.world.scene.updateMatrixWorld(true);this.records=[];
    for(const entity of this.world.entities){
      if(!SPECIES[entity.kind].collision.solid)continue;
      // Bodies sharing a carrier also keep a box in that carrier's frame, so a tilted island
      // on the curved sea does not inflate them into false overlaps.
      for(const local of this.localBoxes(entity))this.records.push({entity,parent:entity.root.parent,box:local.clone().applyMatrix4(entity.root.matrixWorld),frameBox:local.applyMatrix4(entity.root.matrix)});
    }
  }
  actorBox(entity,position){
    const box=this.localBoxes(entity).reduce((all,b)=>all.union(b),new THREE.Box3()).applyMatrix4(entity.root.matrixWorld);
    return box.translate(position.clone().sub(this.world.position(entity))).expandByScalar(-TUNING.collisionSkinM.value);
  }
  frameBox(entity,position){
    const local=entity.root.parent.worldToLocal(position.clone()).sub(entity.root.position);
    return this.localBoxes(entity).reduce((all,b)=>all.union(b),new THREE.Box3()).applyMatrix4(entity.root.matrix).translate(local).expandByScalar(-TUNING.collisionSkinM.value);
  }
  blockers(entity){return this.records.filter(r=>!this.related(entity,r.entity));}
  collides(entity,position,records=this.blockers(entity)){
    const box=this.actorBox(entity,position),frame=this.frameBox(entity,position);
    return records.some(r=>r.parent===entity.root.parent?frame.intersectsBox(r.frameBox):box.intersectsBox(r.box))||this.hitsScenery(entity,frame);
  }
  // Scenery trunks (env.forest) on the main island block small bodies (a person, a dog), so
  // nothing walks through a trunk; bodies taller than `blocksBodiesUpToM` (the trees one can
  // become) pass through the scenery forest and keep their room to move (D-029).
  hitsScenery(entity,frame){
    const list=this.world.obstacles,s=SPECIES[entity.kind];
    if(!list?.length||entity.root.parent!==this.world.islandRoot||s.stage>1||s.height>this.world.obstacleBodyHeight)return false;
    if(!this.grid||this.gridSize!==list.length){this.grid=new Map();this.gridSize=list.length;for(const o of list){const k=`${Math.floor(o.x/16)},${Math.floor(o.z/16)}`;if(!this.grid.has(k))this.grid.set(k,[]);this.grid.get(k).push(o);}}
    const x0=Math.floor((frame.min.x-4)/16),x1=Math.floor((frame.max.x+4)/16),z0=Math.floor((frame.min.z-4)/16),z1=Math.floor((frame.max.z+4)/16);
    for(let i=x0;i<=x1;i++)for(let j=z0;j<=z1;j++)for(const o of this.grid.get(`${i},${j}`)||[]){
      if(frame.min.y>o.top)continue;
      const dx=Math.max(frame.min.x-o.x,0,o.x-frame.max.x),dz=Math.max(frame.min.z-o.z,0,o.z-frame.max.z);
      if(dx*dx+dz*dz<o.r*o.r)return true;
    }
    return false;
  }
  setWorldPosition(entity,point){entity.root.position.copy(entity.root.parent.worldToLocal(point.clone()));entity.root.updateWorldMatrix(true,true);}
  move(entity,delta){
    const s=SPECIES[entity.kind],start=this.world.position(entity),length=delta.length();if(length<1e-9)return start;
    const records=this.blockers(entity),count=Math.max(1,Math.ceil(length/Math.max(.035,Math.min(s.radius*.35,3))));
    const step=delta.clone().divideScalar(count);let p=start.clone();
    for(let i=0;i<count;i++){
      let next=p.clone().add(step);
      if(this.world.externalTerrain&&this.meshBlocks(entity,p,step))next.copy(p);
      if(this.collides(entity,next,records)){
        next.copy(p);
        for(const axis of (s.mode==='fly'||s.mode==='swim'?['x','z','y']:['x','z'])){
          const candidate=next.clone();candidate[axis]+=step[axis];if(!this.collides(entity,candidate,records))next.copy(candidate);
        }
      }
      p.copy(next);
    }
    this.setWorldPosition(entity,p);return p;
  }
  meshBlocks(entity,position,step){
    const s=SPECIES[entity.kind],direction=step.clone().normalize(),distance=step.length()+Math.min(s.radius,2);
    for(const fraction of [.15,.5,.9]){
      const origin=position.clone();origin.y+=s.height*fraction;this.externalRay.set(origin,direction);this.externalRay.far=distance;
      for(const hit of this.externalRay.intersectObject(this.world.externalTerrain,true)){
        const normal=hit.face?.normal.clone().transformDirection(hit.object.matrixWorld);
        if(!normal||Math.abs(normal.y)<.65)return true;
      }
    }
    return false;
  }
  // Push out along the carrier's horizontal axes, then fall back to the last safe spot.
  repair(entity){
    const records=this.blockers(entity),parent=entity.root.parent,toWorld=l=>parent.localToWorld(l.clone());
    const local=entity.root.position.clone();
    for(let pass=0;pass<12;pass++){
      const world=toWorld(local),frame=this.frameBox(entity,world),box=this.actorBox(entity,world);
      const hit=records.find(r=>r.parent===parent?frame.intersectsBox(r.frameBox):box.intersectsBox(r.box));
      if(!hit){this.setWorldPosition(entity,world);entity.lastSafe=world;return true;}
      const a=frame,b=hit.parent===parent?hit.frameBox:hit.box.clone().applyMatrix4(parent.matrixWorld.clone().invert());
      const offsets=[new THREE.Vector3(b.min.x-a.max.x-.06,0,0),new THREE.Vector3(b.max.x-a.min.x+.06,0,0),new THREE.Vector3(0,0,b.min.z-a.max.z-.06),new THREE.Vector3(0,0,b.max.z-a.min.z+.06)];
      offsets.sort((u,v)=>u.lengthSq()-v.lengthSq());local.add(offsets[0]);
    }
    if(entity.lastSafe)this.setWorldPosition(entity,entity.lastSafe);return false;
  }
  obscures(eye,point,source,target,includeTargetContents=false){
    const distance=eye.distanceTo(point),hit=new THREE.Vector3();this.ray.set(eye,point.clone().sub(eye).normalize());
    for(const r of this.records){
      if(r.entity===source||r.entity===target||this.related(source,r.entity)||(!includeTargetContents&&this.related(target,r.entity)))continue;
      if(this.ray.intersectBox(r.box,hit)&&hit.distanceTo(eye)<distance-.08)return true;
    }
    return false;
  }
  cameraPosition(focus,desired,player,padding=.2){
    const distance=focus.distanceTo(desired),direction=desired.clone().sub(focus).normalize();let allowed=distance;const hit=new THREE.Vector3();this.ray.set(focus,direction);
    for(const r of this.records){
      if(this.related(player,r.entity))continue;const box=r.box.clone().expandByScalar(padding);
      if(box.containsPoint(focus))continue;
      if(this.ray.intersectBox(box,hit))allowed=Math.min(allowed,Math.max(.2,hit.distanceTo(focus)-padding));
    }
    return focus.clone().addScaledVector(direction,allowed);
  }
}
