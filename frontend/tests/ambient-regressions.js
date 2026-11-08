import { LAYOUT, SPECIES } from '../src/species.js';
import { AmbientMotion } from '../src/ambient.js';
import { InteractionSystem } from '../src/interactions.js';

// Exercise the real game's save reader and movement, with its loaded GLBs and colliders.
export function checkSaveMigration(g,assert){
  const W=g.world,original=W.serialize(),storage='between-all-things.save.v4';
  const marker=original.find(e=>e.id==='grass-start'),x=marker.position[0]+20;
  const fixtures=new Map([...Object.entries(LAYOUT.savePlayerAliases||{}),['butterflyfish-0','discus-0'],['gull-4','gull-0'],['retired-unmapped-body',LAYOUT.initialInstance],['human-first','human-first']]);
  for(const [oldId,newId] of fixtures){
    W.restore(original);g.player=W.byId.get(LAYOUT.initialInstance);g.transition=null;
    const records=JSON.parse(JSON.stringify(original));records.find(e=>e.id===marker.id).position[0]=x;
    if(!records.some(e=>e.id===oldId))records.push({id:oldId,kind:'retired',position:[210,-4,220]});
    localStorage.setItem(storage,JSON.stringify({version:4,player:oldId,entities:records,yaw:.35,pitch:.27,hints:{},shown:['island:first_possess']}));
    assert(`restore retains world progress when ${oldId} becomes ${newId} (W-04)`,g.restore()&&g.player.id===newId&&W.byId.get(marker.id).root.position.x===x&&g.shown.has('island:first_possess'));
    if(SPECIES[g.player.kind].mode==='swim'){
      const p=g.player.root.position,w=W.water(p.x,p.z);
      assert('a migrated sea fish uses the replacement lake body, not obsolete sea coordinates',w?.id==='lake'&&p.y>=w.floor&&p.y+SPECIES[g.player.kind].height<=w.surface);
    }
    g.save();const saved=JSON.parse(localStorage.getItem(storage));
    assert(`resaving ${oldId} keeps the migrated player and world`,saved.player===newId&&saved.entities.find(e=>e.id===marker.id).position[0]===x);
  }
  W.restore(original);g.player=W.byId.get(LAYOUT.initialInstance);
}

export function checkAmbientCollision(g,assert){
  const W=g.world,original=W.serialize();
  const reset=()=>{
    W.restore(original);W.time=0;g.player=W.byId.get(LAYOUT.initialInstance);g.transition=null;g.clearInput();
    for(const e of W.entities){e.flee=null;e.moving=false;}
    g.interactions=new InteractionSystem(g);W.ambient=new AmbientMotion(W,LAYOUT.ambient);g.collision.refresh();return W.ambient;
  };
  const tick=(A,dt=1/30,interactions=false)=>{
    W.time+=dt;g.collision.refresh();
    if(interactions){g.move(dt);g.collision.refresh();}
    A.update(dt,g.player);
    if(interactions)g.interactions.update(dt);
    g.collision.refresh();
  };
  // A second, played bird hovers on a route. Other route members must still see its collider.
  {
    const A=reset(),bird=W.byId.get('gull-0'),held=W.byId.get('gull-1');
    for(let k=0;k<120;k++)tick(A);
    const goal=A.goal(A.state.get(bird).group,0,W.time+1,bird);
    g.player=held;held.root.position.set(goal.x,goal.y,goal.z);g.collision.refresh();
    const position=held.root.position.clone(),blockers=()=>g.collision.records.filter(r=>r.entity===held);
    assert('route collision fixture starts with separate birds',!g.collision.collides(bird,W.position(bird),blockers()));
    let hit=false;
    for(let k=0;k<120;k++){tick(A);hit ||= g.collision.collides(bird,W.position(bird),blockers());}
    assert('autonomous gulls do not pass through a played gull (M-01)',!hit&&held.root.position.equals(position));
  }
  // This legal low-flight position cuts through a rising slope on the old straight return.
  {
    const A=reset(),bird=W.byId.get('gull-0');
    bird.root.position.set(-220,W.height(-220,-225)+.3,-225);g.player=bird;tick(A);
    const start=bird.root.position.clone();g.player=W.byId.get(LAYOUT.initialInstance);tick(A);
    for(let k=0;k<60;k++)tick(A);
    assert('a released low-flying gull still rests before returning',bird.root.position.equals(start));
    W.time=A.state.get(bird).resumeAt;
    let clear=true;
    for(let k=0;k<40;k++){
      tick(A,1/20);const p=bird.root.position;
      clear &&= p.y>=W.height(p.x,p.z)+.29&&!g.collision.collides(bird,W.position(bird));
    }
    assert('a released gull returns over terrain at 20 FPS (M-01, M-04)',clear&&bird.root.position.distanceTo(start)>2);
  }
  // Keep scatter/return interactions enabled: they must not mask collisions on rejoining.
  {
    const A=reset(),fish=W.byId.get('silverfish-0'),human=g.player;
    for(let k=0;k<120;k++)tick(A);
    const goal=A.goal(A.state.get(fish).group,0,W.time+1,fish),water=W.water(goal.x,goal.z);
    human.root.position.set(goal.x,water.surface-SPECIES[human.kind].height*.7,goal.z);g.collision.refresh();
    const blockers=()=>g.collision.records.filter(r=>r.entity===human);
    assert('fish collision fixture starts outside the swimming human',!g.collision.collides(fish,W.position(fish),blockers()));
    let hit=false,inWater=true;
    for(let k=0;k<900;k++){
      tick(A,1/30,true);hit ||= g.collision.collides(fish,W.position(fish),blockers());
      const p=fish.root.position,w=W.water(p.x,p.z);inWater &&= w?.id==='lake'&&p.y>=w.floor&&p.y+SPECIES[fish.kind].height<=w.surface;
    }
    assert('fish returning from scatter cannot swim through the player (M-01, X-02)',!hit&&inWater);
  }
  reset();
}
