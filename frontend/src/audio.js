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
  constructor(){this.context=null;this.enabled=false;this.lastCue=0;}
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
    return true;
  }
  // Must first be called from a click or key press: browsers only start audio after a gesture.
  async setEnabled(on){
    if(!this.context&&!this.build())return false;
    await this.context.resume();this.enabled=on;
    this.master.gain.setTargetAtTime(on?1:0,this.context.currentTime,.7);return on;
  }
  toggle(){return this.setEnabled(!this.enabled);}
  // hearing: blended profile; state: {underwater, groundFade, cue:{name,distance,pan}|null, crossfade, time}
  update(hearing,state){
    if(!this.enabled||!this.context)return;
    const c=this.context,now=c.currentTime,k=Math.max(.05,state.crossfade/3);
    this.filter.frequency.setTargetAtTime(state.underwater?hearing.underwaterLowpassHz:hearing.airLowpassHz,now,k);
    this.windGain.gain.setTargetAtTime(hearing.windGain*(state.underwater?.35:1)*(1+Math.sin(state.time*.15)*.18),now,k);
    this.nearGain.gain.setTargetAtTime(.022*hearing.waterCueGain*state.groundFade,now,k);
    if(state.time-this.lastCue>16&&state.cue){
      this.lastCue=state.time;
      const reach=1-state.cue.distance/hearing.range;
      if(reach>0)this.play(state.cue.name,.022*hearing.distantCueGain*Math.sqrt(reach)*state.groundFade,state.cue.pan);
    }
  }
  play(name,volume=.018,pan=0){
    const c=this.context,cue=CUES[name];if(!this.enabled||!c||!cue||volume<=0)return;
    let out=this.master;
    if(c.createStereoPanner){out=c.createStereoPanner();out.pan.value=Math.max(-1,Math.min(1,pan));out.connect(this.master);}
    cue(c,out,volume);
  }
  chime(){
    if(!this.enabled||!this.context)return;const c=this.context;
    for(let i=0;i<2;i++){const o=c.createOscillator(),g=c.createGain();o.frequency.value=i?528:352;g.gain.setValueAtTime(0,c.currentTime);g.gain.linearRampToValueAtTime(.025,c.currentTime+.08);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+2);o.connect(g).connect(this.master);o.start();o.stop(c.currentTime+2);}
  }
}
