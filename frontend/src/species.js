// Runtime configuration generated from data/ by project/sync_runtime.py.
// Nothing here names a particular species: bodies, categories, layout and
// interactions all come from data, so adding them never touches this module.
export const SPECIES = {};
export const CATEGORIES = {};
export const LAYOUT = {instances:[],scatter:[],regions:{}};
export const INTERACTIONS = [];
export const INPUT = {bindings:[]};
export const TUNING = {};
export async function loadRuntimeConfig(){
  const response=await fetch('./public/config/game.json');
  if(!response.ok)throw new Error(`Game configuration unavailable (${response.status})`);
  const data=await response.json();
  Object.assign(SPECIES,data.species);Object.assign(CATEGORIES,data.categories);Object.assign(LAYOUT,data.layout);
  INTERACTIONS.push(...(data.interactions||[]));Object.assign(INPUT,data.input);Object.assign(TUNING,data.tuning);
  if(!LAYOUT.instances.some(i=>i.id===LAYOUT.initialInstance))throw new Error(`Missing initial body: ${LAYOUT.initialInstance}`);
  for(const item of [...LAYOUT.instances,...LAYOUT.scatter])if(!SPECIES[item.kind])throw new Error(`Unknown body kind: ${item.kind}`);
  return data.version;
}
export function actionForCode(code){return INPUT.bindings.find(b=>b.codes.includes(code))?.action||null;}
export function canEmbody(from,to){return Boolean(from&&to&&from!==to&&SPECIES[from.kind]?.targets.includes(to.kind));}
export function inRegion(id,x,z){
  const r=LAYOUT.regions?.[id];if(!r||r.shape!=='ellipse')return false;
  return ((x-r.center[0])/r.radii[0])**2+((z-r.center[1])/r.radii[1])**2<1;
}
export function mulberry32(seed){return()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
