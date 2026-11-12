import * as THREE from 'three';
import { SPECIES, INTERACTIONS } from './species.js';

// How the world answers a body (X-01～X-04). Rules live in data/interactions.json:
// a trigger, who acts (subject = the player's body), who answers (target), and an
// effect. Only effects are code; a new kind of answer is one entry in EFFECTS.
const v1=new THREE.Vector3(),v2=new THREE.Vector3(),q=new THREE.Quaternion();

export function matches(filter={},entity){
  const s=SPECIES[entity.kind];if(!s)return false;
  if(filter.categories&&!filter.categories.includes(s.category))return false;
  if(filter.types&&!filter.types.includes(s.id))return false;
  if(filter.modes&&!filter.modes.includes(s.mode))return false;
  if(filter.solid!=null&&Boolean(s.collision.solid)!==filter.solid)return false;
  return true;
}

// Each effect may define: continuous apply(ctx,rule,target,strength,subject) for
// proximity rules evaluated every frame; start(ctx,rule,target,subject) for
// one-shot triggers; update(ctx,target) returning false once it has finished.
export const EFFECTS={
  bend:{
    continuous:true,
    apply(ctx,rule,target,strength,subject){
      const e=target,v=e.visual;if(!v)return;
      e.bend=THREE.MathUtils.damp(e.bend||0,strength*rule.effect.maxAngle,8,ctx.dt);
      if(e.bend<.001){if(v.rotation.x)v.rotation.x=0;return;}
      const d=ctx.world.position(e,v1).sub(ctx.world.position(subject,v2));d.y=0;if(d.lengthSq()<1e-8)return;
      d.normalize().applyQuaternion(e.root.getWorldQuaternion(q).invert());
      v.rotation.x=d.z*e.bend;v.rotation.z+=-d.x*e.bend;
    },
  },
  // Moves away for a while, then back home; obeys collision and activity areas (X-02).
  flee:{
    start(ctx,rule,target,subject){
      const away=ctx.world.position(target,v1).sub(ctx.world.position(subject,v2));away.y=0;
      if(away.lengthSq()<1e-6)away.set(1,0,0);away.normalize();away.y=rule.effect.rise||0;away.normalize();
      const p=rule.effect;
      target.flee={dir:away.clone(),speed:p.speed,until:ctx.time+p.duration,returnAt:ctx.time+p.returnAfter,home:target.flee?.home||target.root.position.clone()};
    },
    update(ctx,target){
      const f=target.flee;if(!f)return false;
      if(target===ctx.game.player){target.flee=null;return false;}
      const parentQ=target.root.parent.getWorldQuaternion(q).invert();
      let local=null;
      if(ctx.time<f.until)local=f.dir.clone().applyQuaternion(parentQ).multiplyScalar(f.speed*ctx.dt);
      else if(ctx.time>=f.returnAt){
        const back=f.home.clone().sub(target.root.position),length=back.length();
        if(length<.05){target.root.position.copy(f.home);target.flee=null;target.moving=false;return false;}
        local=back.multiplyScalar(Math.min(1,f.speed*.5*ctx.dt/length));
      }
      target.moving=Boolean(local);
      if(local){
        // Turning changes a long body's box: a blocked flee turn must not wedge it into a solid (M-01).
        const collision=ctx.game.collision,p=target.root.position,before=p.clone(),heading=target.heading,rotation=target.root.rotation.y;
        const clear=!collision.collides(target,ctx.world.position(target));
        ctx.game.moveBody(target,local,ctx.dt);
        if(clear&&collision.collides(target,ctx.world.position(target))){p.copy(before);target.heading=heading;target.root.rotation.y=rotation;}
        collision.refreshEntity(target);
      }
      return true;
    },
  },
  // The target makes its sound, heard from where it is through the current body's ears.
  call:{
    start(ctx,rule,target){ctx.game.playCue(SPECIES[target.kind].soundCue||rule.effect.cue,rule.effect.volume,target);},
  },
};
export function registerEffect(name,effect){EFFECTS[name]=effect;}

export class InteractionSystem {
  constructor(game){
    this.game=game;this.time=0;this.state=new Map();this.focusKey=new Map();this.active=new Set();this.targets=new Map();
    this.rules=INTERACTIONS.filter(rule=>{
      if(EFFECTS[rule.effect.type])return true;
      console.warn(`Interaction ${rule.id}: unknown effect ${rule.effect.type}`);return false;
    });
  }
  candidates(rule){
    if(!this.targets.has(rule.id))this.targets.set(rule.id,this.game.world.entities.filter(e=>matches(rule.target,e)));
    return this.targets.get(rule.id);
  }
  ready(key,rule){const last=this.state.get(key)?.fired;return last==null||this.time-last>=(rule.cooldownSec||0);}
  fire(rule,target,subject,key){
    const effect=EFFECTS[rule.effect.type],ctx=this.context(0);
    this.state.set(key,{...this.state.get(key),fired:this.time});
    effect.start?.(ctx,rule,target,subject);
    if(effect.update)this.active.add({effect,target});
  }
  context(dt){return {game:this.game,world:this.game.world,dt,time:this.time};}
  update(dt){
    this.time+=dt;const g=this.game,subject=g.player,ctx=this.context(dt),here=g.world.position(subject,new THREE.Vector3());
    for(const rule of this.rules){
      const effect=EFFECTS[rule.effect.type],trigger=rule.trigger,acting=!g.transition&&matches(rule.subject,subject);
      if(trigger.type==='proximity'){
        for(const e of this.candidates(rule)){
          if(e===subject)continue;
          const d=acting?g.world.position(e,v1).distanceTo(here):Infinity,inside=d<trigger.radius;
          if(effect.continuous){effect.apply(ctx,rule,e,inside?1-d/trigger.radius:0,subject);continue;}
          const key=`${rule.id}|${e.id}`,was=this.state.get(key);
          if(inside&&!was?.inside&&this.ready(key,rule))this.fire(rule,e,subject,key);
          this.state.set(key,{...this.state.get(key),inside});
        }
      }
      if(trigger.type==='focus'){
        const t=g.target,focused=acting&&t&&g.candidateTime>=(trigger.minFocusSec||0)&&matches(rule.target,t);
        const key=focused?`${rule.id}|${t.id}`:null;
        if(key&&key!==this.focusKey.get(rule.id)&&this.ready(key,rule))this.fire(rule,t,subject,key);
        this.focusKey.set(rule.id,key);
      }
    }
    for(const item of this.active)if(item.effect.update(ctx,item.target)===false)this.active.delete(item);
  }
  // Called once a possession has committed: the new body answers its own arrival.
  onPossess(entity){
    entity.flee=null;
    for(const rule of this.rules)if(rule.trigger.type==='possess'&&matches(rule.target,entity)&&matches(rule.subject,entity)){
      const key=`${rule.id}|${entity.id}`;if(this.ready(key,rule))this.fire(rule,entity,entity,key);
    }
  }
}
