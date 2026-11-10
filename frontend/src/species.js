// Runtime configuration generated from data/ by project/sync_runtime.py.
// Nothing here names a particular species: bodies, categories, layout and
// interactions all come from data, so adding them never touches this module.
export const SPECIES = {};
export const CATEGORIES = {};
export const SCALE_TIERS = [];
export const SCALE_LAYERS = {};
export const LAYOUT = {instances:[],scatter:[],regions:{}};
// Regions with a `water` block in anchors.json: enclosed bodies (flat surface inside the
// region's shape, optional terrain basin) and the one sea that follows the planet.
export const WATERS = [];
export const INTERACTIONS = [];
export const INPUT = {bindings:[]};
export const TUNING = {};
export const CAMERA_MODES = {};
export async function loadRuntimeConfig(){
  const response=await fetch('./public/config/game.json');
  if(!response.ok)throw new Error(`Game configuration unavailable (${response.status})`);
  const data=await response.json();
  Object.assign(SPECIES,data.species);Object.assign(CATEGORIES,data.categories);Object.assign(LAYOUT,data.layout);SCALE_TIERS.push(...(data.scaleTiers||[]));Object.assign(SCALE_LAYERS,data.scaleLayers);Object.assign(CAMERA_MODES,data.cameraModes);WATERS.push(...Object.values(LAYOUT.regions).filter(r=>r.water));
  INTERACTIONS.push(...(data.interactions||[]));Object.assign(INPUT,data.input);Object.assign(TUNING,data.tuning);
  if(!LAYOUT.instances.some(i=>i.id===LAYOUT.initialInstance))throw new Error(`Missing initial body: ${LAYOUT.initialInstance}`);
  for(const item of [...LAYOUT.instances,...LAYOUT.scatter])if(!SPECIES[item.kind])throw new Error(`Unknown body kind: ${item.kind}`);
  return data.version;
}
// Camera, fog and light settings of a body's render layer (`stage`), from data.
export function layerOf(kind){return SCALE_LAYERS[SPECIES[kind].stage];}
export function actionForCode(code){return INPUT.bindings.find(b=>b.codes.includes(code))?.action||null;}
// Relations come from scale tiers (P-12, D-021). `lift` is the tier rank the current
// viewpoint reaches (P-15); it only widens the reach upwards, never downwards.
export function canEmbody(from,to,lift=-1){
  const a=SPECIES[from?.kind],b=SPECIES[to?.kind];if(!a||!b||from===to)return false;
  if(a.targets.includes(to.kind))return true;
  return b.tier>a.tier+1&&b.tier<=lift+1&&!a.deny.includes(to.kind);
}
export function inRegion(id,x,z){
  const r=LAYOUT.regions?.[id];if(!r||r.shape!=='ellipse')return false;
  return ((x-r.center[0])/r.radii[0])**2+((z-r.center[1])/r.radii[1])**2<1;
}
export function mulberry32(seed){return()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
