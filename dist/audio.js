/* Twelve original looping arrangements; no downloaded recordings. */
(function(root){'use strict';
const C=typeof module!=='undefined'&&module.exports?require('./content.js'):root.SandContent;
const DIG_PROFILES={
 sand:{filter:'highpass',frequency:1500,length:.10,gain:.12,pitch:43,type:'triangle',taps:1},
 'fine-sand':{filter:'highpass',frequency:3200,length:.14,gain:.09,pitch:57,type:'sine',taps:1},
 'wet-sand':{filter:'lowpass',frequency:700,length:.16,gain:.18,pitch:32,type:'triangle',taps:1},
 gravel:{filter:'bandpass',frequency:2200,length:.06,gain:.21,pitch:66,type:'square',taps:3},
 silt:{filter:'bandpass',frequency:1900,length:.12,gain:.10,pitch:49,type:'triangle',taps:2},
 loam:{filter:'lowpass',frequency:1100,length:.13,gain:.16,pitch:38,type:'triangle',taps:2},
 clay:{filter:'lowpass',frequency:450,length:.20,gain:.19,pitch:28,type:'sine',taps:1},
 'wet-clay':{filter:'lowpass',frequency:300,length:.24,gain:.22,pitch:24,type:'sine',taps:2}
};
class SandAudio {
 constructor(){this.context=null;this.master=null;this.musicGain=null;this.fxGain=null;this.enabled=true;this.fx=true;this.volume=.3;this.track=null;this.step=0;this.next=0;this.nodes=new Set();}
 unlock(){
  if(!this.context){const Audio=root.AudioContext||root.webkitAudioContext;if(!Audio)return false;
   try{this.context=new Audio();this.master=this.context.createGain();this.master.gain.value=this.volume;this.master.connect(this.context.destination);this.musicGain=this.context.createGain();this.musicGain.connect(this.master);this.fxGain=this.context.createGain();this.fxGain.connect(this.master);}catch(e){console.warn('Audio initialization failed',e);return false;}}
  if(this.context.state==='suspended')this.context.resume().catch(e=>console.warn('Audio resume failed',e));return true;
 }
 setTrack(id){if(this.track?.id===id)return;this.stop();this.track=C.TRACKS.find(t=>t.id===id)||C.TRACKS[0];this.step=0;this.next=0;}
 setMusic(enabled){this.enabled=enabled;if(this.musicGain)this.musicGain.gain.value=enabled?1:0;}
 setVolume(value){if(!Number.isFinite(value)||value<0||value>1)return;this.volume=value;if(this.master)this.master.gain.value=value;}
 stop(){for(const o of this.nodes){try{o.stop();}catch(e){console.debug('Audio voice already stopped',e.message);}}this.nodes.clear();}
 note(midi,time,length,gain,type='sine',fx=false){
  const a=this.context;if(!a||a.state!=='running'||this.nodes.size>80)return;
  const o=a.createOscillator(),v=a.createGain();o.type=type;o.frequency.value=440*2**((midi-69)/12);
  v.gain.setValueAtTime(.0001,time);v.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),time+.008);v.gain.exponentialRampToValueAtTime(.0001,time+length);
  o.connect(v);v.connect(fx?this.fxGain:this.musicGain);o.start(time);o.stop(time+length+.02);this.nodes.add(o);o.onended=()=>{this.nodes.delete(o);o.disconnect();v.disconnect();};
 }
 tick(active){
  const a=this.context;
  if(!a||a.state!=='running')return;
  if(this.musicGain)this.musicGain.gain.value=this.enabled&&active?1:0;
  if(!this.enabled||!active||!this.track){this.next=0;return;}
  const t=this.track,stepTime=60/t.bpm/2;
  if(!this.next||this.next<a.currentTime-.2)this.next=a.currentTime+.02;
  while(this.next<a.currentTime+.12){
   const i=this.step%t.notes.length,n=t.notes[i],bass=t.bass[Math.floor(this.step/8)%t.bass.length];
   if(n!==null)this.note(t.root+n,this.next,stepTime*.88,t.voice==='square'?.07:.17,t.voice);
   if(this.step%4===0){this.note(t.root-24+bass,this.next,stepTime*3,.17,'triangle');this.note(t.root-12+bass+7,this.next,stepTime*2,.045,'sine');}
   if(this.step%4===0)this.note(28,this.next,.12,.24*(t.drum||1),'sine');
   if(this.step%4===2)this.note(43,this.next,.055,.07*(t.drum||1),'triangle');
   this.step++;this.next+=stepTime;
  }
 }
 noise(profile,time,gain){
  const a=this.context;if(!a?.createBuffer||!a.createBufferSource||!a.createBiquadFilter||this.nodes.size>=80)return;
  const length=Math.ceil(a.sampleRate*profile.length),buffer=a.createBuffer(1,length,a.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*(1-i/length);
  const source=a.createBufferSource(),filter=a.createBiquadFilter(),volume=a.createGain();source.buffer=buffer;filter.type=profile.filter;filter.frequency.value=profile.frequency;filter.Q.value=.65;
  volume.gain.setValueAtTime(.0001,time);volume.gain.exponentialRampToValueAtTime(gain,time+.008);volume.gain.exponentialRampToValueAtTime(.0001,time+profile.length);
  source.connect(filter);filter.connect(volume);volume.connect(this.fxGain);this.nodes.add(source);source.onended=()=>{this.nodes.delete(source);source.disconnect();filter.disconnect();volume.disconnect();};source.start(time);source.stop(time+profile.length+.01);
 }
 effect(kind,material='sand',tool='finger'){if(!this.fx||!this.context)return;const now=this.context.currentTime;
  if(kind==='dig'){const p=DIG_PROFILES[material]||DIG_PROFILES.sand,scale=tool==='needle'?.3:tool==='toothpick'?.45:tool==='bothhands'?1.15:1;
   for(let i=0;i<p.taps;i++)this.noise(p,now+i*.025,p.gain*scale/p.taps);
   this.note(p.pitch,now,p.length,p.gain*.32*scale,p.type,true);
  }
  else if(kind==='fall'){this.note(29,now,.65,.45,'triangle',true);this.note(34,now,.8,.2,'sine',true);}
  else{this.note(72,now,.22,.18,'sine',true);this.note(76,now+.12,.3,.15,'sine',true);}
 }
}
SandAudio.DIG_PROFILES=DIG_PROFILES;
if(typeof module!=='undefined'&&module.exports)module.exports=SandAudio;else root.SandAudio=SandAudio;
})(globalThis);
