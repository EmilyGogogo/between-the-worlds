// Synthesized wind, near-ground texture and short cues; no downloaded audio.
// The current body's hearing profile (B-04) shapes filtering, range and direction.

// Short sounds that things in the world make, by name. A category names its cue
// in data ("soundCue"); a new sound only needs an entry here.
const CUES={
  chirp(c,out,volume){
    const o=c.createOscillator(),g=c.createGain();
    o.type='sine';o.frequency.setValueAtTime(1700,c.currentTime);o.frequency.exponentialRampToValueAtTime(2600,c.currentTime+.09);o.frequency.exponentialRampToValueAtTime(1500,c.currentTime+.22);
    g.gain.setValueAtTime(0,c.currentTime);g.gain.linearRampToValueAtTime(volume,c.currentTime+.04);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.28);
    o.connect(g).connect(out);o.start();o.stop(c.currentTime+.3);
  },
};
export function registerCue(name,play){CUES[name]=play;}

export class Ambience {
  // tune(key,fallback): reads levels from tuning.json (underwater*, wingbeatGain, cueAirLowpassFactor).
  constructor(tune=(key,fallback)=>fallback){this.context=null;this.enabled=false;this.lastCue=0;this.tune=tune;this.levels=null;this.lastBeat=null;this.nextBubble=0;}
  build(){
    const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return false;
    const c=this.context=new Audio(),buffer=c.createBuffer(1,c.sampleRate*4,c.sampleRate),data=buffer.getChannelData(0);let brown=0;
    for(let i=0;i<data.length;i++){brown=(brown+(Math.random()*2-1)*.025)/1.025;data[i]=brown*3.5;}
    const white=c.createBuffer(1,c.sampleRate*3,c.sampleRate),w=white.getChannelData(0);for(let i=0;i<w.length;i++)w[i]=Math.random()*2-1;
    this.master=c.createGain();this.master.gain.value=0;this.master.connect(c.destination);
    // Wind: low, broad and slow.
    this.wind=c.createBufferSource();this.wind.buffer=buffer;this.wind.loop=true;
    this.filter=c.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=900;
    this.windGain=c.createGain();this.windGain.gain.value=.12;this.wind.connect(this.filter).connect(this.windGain).connect(this.master);this.wind.start();
    // Near ground: leaves and water close to the body; fades for a bird high above.
    this.near=c.createBufferSource();this.near.buffer=white;this.near.loop=true;
    this.band=c.createBiquadFilter();this.band.type='bandpass';this.band.frequency.value=2200;this.band.Q.value=.7;
    this.nearGain=c.createGain();this.nearGain.gain.value=.02;this.near.connect(this.band).connect(this.nearGain).connect(this.filter);this.near.start();
    this.brown=buffer;this.white=white;
    // Under water: the water's own bed instead of muffled wind and leaves (A-01, 2026-11-14):
    // a steady low drone and the surface lapping overhead, louder near the top.
    this.water=c.createGain();this.water.gain.value=0;this.water.connect(this.master);
    this.drone=c.createBufferSource();this.drone.buffer=buffer;this.drone.loop=true;this.drone.playbackRate.value=.45;
    const droneFilter=c.createBiquadFilter();droneFilter.type='lowpass';droneFilter.frequency.value=160;
    this.droneGain=c.createGain();this.droneGain.gain.value=0;this.drone.connect(droneFilter).connect(this.droneGain).connect(this.water);this.drone.start();
    this.lap=c.createBufferSource();this.lap.buffer=white;this.lap.loop=true;
    const lapFilter=c.createBiquadFilter();lapFilter.type='bandpass';lapFilter.frequency.value=420;lapFilter.Q.value=1.4;
    this.lapGain=c.createGain();this.lapGain.gain.value=0;this.lap.connect(lapFilter).connect(this.lapGain).connect(this.water);this.lap.start();
    // Calls from things in the world pass through the body's hearing too, at their own volume.
    this.cueFilter=c.createBiquadFilter();this.cueFilter.type='lowpass';this.cueFilter.frequency.value=4800;this.cueFilter.connect(this.master);
    return true;
  }
  // Must first be called from a click or key press: browsers only start audio after a gesture.
  async setEnabled(on){
    if(!this.context&&!this.build())return false;
    await this.context.resume();this.enabled=on;
    this.master.gain.setTargetAtTime(on?1:0,this.context.currentTime,.7);return on;
  }
  toggle(){return this.setEnabled(!this.enabled);}
  // Target levels for a hearing profile and listener state; kept on `levels` for checks.
  // state: {underwater, surface (0 deep … 1 just under), beat ('wing'|'stroke'|null), groundFade, time}
  mix(hearing,state){
    const t=this.tune,u=!!state.underwater,cutoff=u?hearing.underwaterLowpassHz:hearing.airLowpassHz,air=u?t('underwaterAirGain',.08):1;
    return {underwater:u,cutoff,cueCutoff:u?cutoff:cutoff*t('cueAirLowpassFactor',4),
      wind:hearing.windGain*air*(1+Math.sin(state.time*.15)*.18),near:.022*hearing.waterCueGain*state.groundFade*air,
      water:u?1:0,drone:t('underwaterDroneGain',.05)*(1+Math.sin(state.time*.09)*.15),
      lap:u?t('underwaterSurfaceLapGain',.03)*(state.surface??0)*(.75+Math.sin(state.time*.7)*.25):0,
      stroke:u&&state.beat==='stroke'?t('underwaterStrokeGain',.025):0,wing:!u&&state.beat==='wing'?t('wingbeatGain',.008):0};
  }
  // hearing: blended profile; state: {underwater, surface, beat, groundFade, cue:{name,distance,pan}|null, crossfade, time}
  update(hearing,state){
    const L=this.levels=this.mix(hearing,state);
    if(L.stroke||L.wing)this.lastBeat={kind:L.stroke?'stroke':'wing',volume:L.stroke||L.wing,time:state.time};
    if(!this.enabled||!this.context)return;
    const c=this.context,now=c.currentTime,k=Math.max(.05,state.crossfade/3);
    this.filter.frequency.setTargetAtTime(L.cutoff,now,k);
    // Short calls stay recognisable in air and turn to a thud under water.
    this.cueFilter.frequency.setTargetAtTime(L.cueCutoff,now,k);
    this.windGain.gain.setTargetAtTime(L.wind,now,k);
    this.nearGain.gain.setTargetAtTime(L.near,now,k);
    this.water.gain.setTargetAtTime(L.water,now,k);
    this.droneGain.gain.setTargetAtTime(L.drone,now,k);
    this.lapGain.gain.setTargetAtTime(L.lap,now,k);
    // The body's own beats: a push of water per tail sweep, a soft feathered whoosh per downstroke.
    // Around 450 Hz: low enough to read as water, high enough for laptop speakers to play.
    if(L.stroke)this.burst(this.brown,{type:'bandpass',freq:450,q:.7,volume:L.stroke,attack:.05,decay:.34,out:this.water});
    // Around 1100 Hz, above the low wind, so the wingbeat is not covered by it.
    if(L.wing)this.burst(this.white,{type:'bandpass',freq:1100,q:.6,volume:L.wing,attack:.03,decay:.18,out:this.master});
    // Bubbles at irregular intervals around the listener.
    if(!L.underwater)this.nextBubble=state.time+this.tune('underwaterBubbleEverySec',2.5)*Math.random();
    else if(state.time>this.nextBubble){
      this.nextBubble=state.time+this.tune('underwaterBubbleEverySec',2.5)*(.5+Math.random());
      this.bubble(this.tune('underwaterBubbleGain',.012)*hearing.waterCueGain,Math.random()*1.2-.6);
    }
    if(state.time-this.lastCue>16&&state.cue){
      this.lastCue=state.time;
      const reach=1-state.cue.distance/hearing.range;
      // Only a sound crossing the surface is faint; one from the listener's own side keeps its level.
      const carry=(state.cue.fromWater??false)!==L.underwater?this.tune('underwaterAirCueGain',.15):1;
      if(reach>0)this.play(state.cue.name,.022*hearing.distantCueGain*Math.sqrt(reach)*state.groundFade*carry,state.cue.pan);
    }
  }
  // A short swell of filtered noise.
  burst(buffer,{type,freq,q,volume,attack,decay,out}){
    const c=this.context,src=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain(),t=c.currentTime;
    src.buffer=buffer;f.type=type;f.frequency.value=freq;f.Q.value=q;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+attack);g.gain.exponentialRampToValueAtTime(.0001,t+attack+decay);
    src.connect(f).connect(g).connect(out);src.start(t,Math.random()*2);src.stop(t+attack+decay+.05);
  }
  // A small rising bubble: a sine that sweeps up quickly and fades.
  bubble(volume,pan){
    const c=this.context;let out=this.water;
    if(c.createStereoPanner){out=c.createStereoPanner();out.pan.value=pan;out.connect(this.water);}
    const o=c.createOscillator(),g=c.createGain(),t=c.currentTime,f=380+Math.random()*420;
    o.type='sine';o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f*2.4,t+.07);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+.12);
    o.connect(g).connect(out);o.start(t);o.stop(t+.14);
  }
  play(name,volume=.018,pan=0){
    const c=this.context,cue=CUES[name];if(!this.enabled||!c||!cue||volume<=0)return;
    // Through the body's hearing, so a call heard by a fish arrives muffled.
    let out=this.cueFilter;
    if(c.createStereoPanner){out=c.createStereoPanner();out.pan.value=Math.max(-1,Math.min(1,pan));out.connect(this.cueFilter);}
    cue(c,out,volume);
  }
  chime(){
    if(!this.enabled||!this.context)return;const c=this.context;
    for(let i=0;i<2;i++){const o=c.createOscillator(),g=c.createGain();o.frequency.value=i?528:352;g.gain.setValueAtTime(0,c.currentTime);g.gain.linearRampToValueAtTime(.025,c.currentTime+.08);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+2);o.connect(g).connect(this.master);o.start();o.stop(c.currentTime+2);}
  }
}
