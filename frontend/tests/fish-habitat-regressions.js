import { SPECIES, LAYOUT } from '../src/species.js';

// D-037: the oxbow lake and both forest ponds hold silver hatchetfish schools and lone discus.
// Left alone, every fish keeps moving along its route, inside its own water, clear of other bodies.
export function checkFishHabitats(g,assert){
  const W=g.world,snapshot=W.serialize(),player=g.player;
  const routes=(LAYOUT.ambient||[]).filter(r=>r.vertical?.mode==='belowSurface');
  const fish=routes.flatMap(r=>r.members.map(id=>({e:W.byId.get(id),water:r.vertical.water,route:r.id})));
  assert('every swimming route member exists',fish.every(f=>f.e),fish.filter(f=>!f.e).map(f=>f.route).join());
  for(const water of ['lake','pond_west','pond_south']){
    const kinds=new Set(fish.filter(f=>f.water===water&&f.e).map(f=>f.e.kind));
    assert(`${water} holds silver hatchetfish and discus`,kinds.has('silverfish')&&kinds.has('discus'),[...kinds].join());
  }
  try{
    g.player=W.byId.get('human-first');g.collision.refresh();
    const start=new Map(fish.map(f=>[f.e,f.e.root.position.clone()])),far=new Map(),out=new Map();
    for(let i=0;i<450;i++){
      W.update(.1,g.player,null,null,1);
      for(const f of fish){
        const p=f.e.root.position,w=W.water(p.x,p.z),h=SPECIES[f.e.kind].height;
        far.set(f.e,Math.max(far.get(f.e)||0,p.distanceTo(start.get(f.e))));
        if(!(w?.id===f.water&&p.y>=w.floor-.01&&p.y+h<=w.surface+.01))out.set(f.e,`${f.e.id} at ${p.x.toFixed(1)},${p.y.toFixed(2)},${p.z.toFixed(1)} in ${w?.id??'no water'}`);
      }
    }
    const still=fish.filter(f=>!(far.get(f.e)>1));
    assert('every fish swims its route on its own (45 s)',still.length===0,still.map(f=>`${f.e.id} ${(far.get(f.e)||0).toFixed(2)} m`).join());
    assert('every fish stays inside its own water (M-04)',out.size===0,[...out.values()].slice(0,4).join('; '));
    g.collision.refresh();
    const stuck=fish.filter(f=>g.collision.collides(f.e,W.position(f.e)));
    assert('no fish ends up inside another body (M-01)',stuck.length===0,stuck.map(f=>f.e.id).join());
  }finally{
    W.restore(snapshot);g.player=player;g.collision.refresh();g.snapCamera=true;g.updateCamera(0);
  }
}
