/* v3 uses integer tenths of a grain and integer micrograms. Legacy games retain v1/v2 rules. */
(function(root){'use strict';
const node=typeof module!=='undefined'&&module.exports,L=node?require('./engine-v2'):root.SandLegacy,M=node?require('./materials'):root.SandSediments;
const {N,H,SIZE,index,get,inside}=L,VERSION=3,PHYSICS='sand-voxel-3';
const TOOLS={...L.TOOLS,needle:{...L.TOOLS.needle,batch:.1,hint:'클릭 한 번에 한 알갱이의 1/10. 누르면 같은 간격으로 계속 깎습니다.'},toothpick:{...L.TOOLS.toothpick,batch:.2,hint:'클릭 한 번에 한 알갱이의 1/5. 남은 조각도 정확히 수확합니다.'}};
const is3=s=>s.physics===PHYSICS,valid=(x,a,b)=>typeof x==='number'&&Number.isFinite(x)&&x>=a&&x<=b;
const material=s=>M.find(m=>m.id===s.sediment)||M[0],factor=s=>Math.cbrt((s.pilePercent||100)/100);
const amount=(s,i)=>s.grid[i]?(is3(s)?s.fill[i]:10):0;
const mass=s=>s.grid.reduce((a,v,i)=>a+(v?amount(s,i):0),0)/10;
const unitMass=s=>Math.round(70000*(s.pilePercent/100)*(s.materialPhysics===false?1:material(s).density));
const grams=(s,score)=>score/(is3(s)?1e6:10);
const harvestGrams=(s,n)=>is3(s)?Math.round(n*10)*unitMass(s)/1e6:n*.7;
function environment(s){
 const e=s.environment||{elapsed:0,time:'day',season:'summer',weather:'clear'},t=e.elapsed;
 const season=e.season==='cycle'?['spring','summer','autumn','winter'][Math.floor(t/180)%4]:e.season;
 const weather=e.weather==='auto'?((Math.floor(t/60)%3)===1?(season==='winter'?'snow':'rain'):(Math.floor(t/60)%3)===2?'wind':'clear'):e.weather;
 const daylight=e.time==='cycle'?.5+.5*Math.cos(t*Math.PI/60):e.time==='night'?0:1;
 const wetness=weather==='rain'?Math.min(1,((e.weather==='auto'?t%60:t)+15)/60):material(s).id.startsWith('wet')?.6:0;
 const wind=weather==='wind'?1:weather==='rain'?.48:weather==='snow'?.25:.12;
 const windDirection=(L.hash(s.seed+'|wind')/4294967296)*Math.PI*2+Math.sin(t/37)*.65,windStrength=wind*(.82+.18*Math.sin(t*1.3));
 return {season,weather,daylight,wetness,wind,windDirection,windStrength};
}
function properties(s){
 if(s.materialPhysics===false)return {...M[0],bridge:2,repose:2,stress:0,shake:0};
 const m=material(s),e=environment(s),saturated=e.wetness>.8&&['silt','clay','wet-clay','loam'].includes(m.id);
 const shake=(s.stage==='ocean-ship'?.65:s.stage==='river-boat'?.3:0);
 return {...m,bridge:Math.max(0,Math.min(5,Math.floor(m.cohesion+m.wetGain*e.wetness-(saturated?2:0)+(e.weather==='snow'?.6:0)))),repose:Math.max(1,m.friction-(saturated?1:0)),stress:e.wind*m.erosion+shake/(m.friction+1),shake};
}
function create(seed='SAND-0909',duration=600,turnDuration=45,options={}){
 const percent=options.pilePercent??100,sediment=options.sediment??'sand';
 if(options.materialPhysics!==undefined&&typeof options.materialPhysics!=='boolean')throw Error('재질 물리 설정이 올바르지 않습니다.');
 if(!Number.isInteger(percent)||!valid(percent,50,1700)||!M.some(m=>m.id===sediment))throw Error('더미 규모는 50~1700의 정수, 재질은 목록에서 선택하세요.');
 const env={elapsed:0,time:options.time??'cycle',season:options.season??'cycle',weather:options.weather??'auto'};
 checkEnvironment(env);
 const s=L.create(seed,duration,turnDuration,options);Object.assign(s,{version:VERSION,physics:PHYSICS,pilePercent:percent,sediment,materialPhysics:options.materialPhysics??true,turnStarted:false,environment:env,fill:Uint8Array.from(s.grid,v=>v*10)});
 // Settle the selected material before embedding a flag, so generation never starts in a collapse.
 settle(s,{initial:true});
 let height=0,peakX=12,peakZ=12;
 for(let y=0;y<H;y++)for(let z=0;z<N;z++)for(let x=0;x<N;x++)if(get(s.grid,x,y,z)&&(y+1>height||y+1===height&&Math.hypot(x-12,z-12)<Math.hypot(peakX-12,peakZ-12))){height=y+1;peakX=x;peakZ=z;}
 const roll=L.rng(seed+'|'+s.variant+'|burial'),embed=height*(roll()<.18?1:1/7+6/7*roll()*roll());
 const f=s.flag,angle=roll()*.18,direction=roll()*Math.PI*2;
 Object.assign(f,{root:Math.max(0,height-embed*Math.cos(angle)),x:peakX+.5-Math.cos(direction)*Math.sin(angle)*embed,z:peakZ+.5-Math.sin(direction)*Math.sin(angle)*embed,embed,length:embed+4+roll()*5,angle,initialAngle:angle,initialDirection:direction,direction,drop:0});
 if(embed===height){f.root=0;f.initialAngle=f.angle=0;f.x=peakX+.5;f.z=peakZ+.5;}
 f.initialSupport=support(s).count;s.pileHeight=height;
 if(!f.initialSupport||flagPlan(s).fall)throw Error('안정적인 매립 위치를 만들지 못했습니다.');
 return s;
}
function support(s){
 if(!is3(s))return L.support(s);
 const f=s.flag;let count=0,sx=0,sz=0,contacts=0;const direction=f.initialDirection;
 // Every section of the original buried shaft contributes, including upper clamps over a cavity.
 for(let t=.1;t<f.embed;t+=.4){
  const cx=f.x+Math.cos(direction)*Math.sin(f.initialAngle)*t,cz=f.z+Math.sin(direction)*Math.sin(f.initialAngle)*t,cy=f.root+Math.cos(f.initialAngle)*t;
  let section=0;
  for(let z=Math.floor(cz)-1;z<=Math.floor(cz)+1;z++)for(let x=Math.floor(cx)-1;x<=Math.floor(cx)+1;x++){
   const y=Math.floor(cy);if(!inside(x,y,z))continue;const weight=amount(s,index(x,y,z))/10;section+=weight;sx+=(x+.5-cx)*weight;sz+=(z+.5-cz)*weight;
  }
  count+=section;if(section>1)contacts++;
 }
 return {count,ratio:Math.min(1,count/(f.initialSupport||count||1)),sx,sz,contacts};
}
function carve(s,point,dir,tool,remaining){
 if(!is3(s))return L.carve(s,point,dir,tool,tool==='needle'||tool==='toothpick'?L.TOOLS[tool].batch:remaining);
 if(!TOOLS[tool]||!Array.isArray(point)||!Array.isArray(dir)||point.length!==3||dir.length!==3||![...point,...dir].every(Number.isFinite)||Math.hypot(...dir)<.001||!valid(remaining,0,SIZE))throw Error('잘못된 채굴 입력입니다.');
 const length=Math.hypot(...dir);dir=dir.map(v=>v/length);const t=TOOLS[tool],hits=[],bound=t.radius+t.depth;
 for(let y=Math.max(0,Math.floor(point[1]-bound));y<Math.min(H,point[1]+bound+1);y++)for(let z=Math.max(0,Math.floor(point[2]-bound));z<Math.min(N,point[2]+bound+1);z++)for(let x=Math.max(0,Math.floor(point[0]-bound));x<Math.min(N,point[0]+bound+1);x++){
  if(!get(s.grid,x,y,z))continue;const dx=x+.5-point[0],dy=y+.5-point[1],dz=z+.5-point[2],along=dx*dir[0]+dy*dir[1]+dz*dir[2],radial=dx*dx+dy*dy+dz*dz-along*along;
  if(along>=-.8&&along<=t.depth&&radial<(t.radius+.25)**2)hits.push({i:index(x,y,z),d:along+Math.sqrt(Math.max(0,radial))});
 }
 if(!hits.length){const [x,y,z]=point.map(Math.floor);if(get(s.grid,x,y,z))hits.push({i:index(x,y,z),d:0});}
 hits.sort((a,b)=>a.d-b.d||a.i-b.i);
 let budget=Math.round(Math.min(remaining,tool==='needle'?.1:tool==='toothpick'?.2:remaining)*10),taken=0;
 for(const hit of hits){if(!budget)break;const n=Math.min(amount(s,hit.i),budget);s.fill[hit.i]-=n;if(!s.fill[hit.i])s.grid[hit.i]=0;taken+=n;budget-=n;}
 return taken/10;
}
function settle(s,{initial=false,disturbance=false}={}){
 if(!is3(s))return L.settle(s);
 const p=properties(s),g=s.grid;let moved=0,passes=0;
 const move=(a,b)=>{g[b]=1;s.fill[b]=s.fill[a];g[a]=0;s.fill[a]=0;moved++;};
 for(let pass=0;pass<H;pass++){
  let changed=0;
  for(let y=1;y<H;y++){
   const dist=new Int8Array(N*N).fill(-1),queue=[];
   for(let z=0;z<N;z++)for(let x=0;x<N;x++)if(get(g,x,y,z)&&get(g,x,y-1,z)){dist[x+N*z]=0;queue.push([x,z]);}
   for(let q=0;q<queue.length;q++){const[x,z]=queue[q],d=dist[x+N*z];if(d>=p.bridge)continue;for(const[a,b]of[[x-1,z],[x+1,z],[x,z-1],[x,z+1]])if(a>=0&&a<N&&b>=0&&b<N&&dist[a+N*b]<0&&get(g,a,y,b)){dist[a+N*b]=d+1;queue.push([a,b]);}}
   for(let z=0;z<N;z++)for(let x=0;x<N;x++)if(get(g,x,y,z)&&dist[x+N*z]<0&&!get(g,x,y-1,z)){move(index(x,y,z),index(x,y-1,z));changed++;}
  }
  passes++;if(!changed)break;
 }
 // Friction limits surface avalanches; cohesion protects intact arches. A grain only moves downhill.
 const tops=new Int8Array(N*N);for(let z=0;z<N;z++)for(let x=0;x<N;x++){let y=H-1;while(y>=0&&!get(g,x,y,z))y--;tops[x+N*z]=y;}
 for(let sweep=0;sweep<(initial?H:2);sweep++){let changes=0;
  for(let z=0;z<N;z++)for(let x=0;x<N;x++){
   const y=tops[x+N*z];if(y<1)continue;
   const exposed=!get(g,x-1,y,z)||!get(g,x+1,y,z)||!get(g,x,y,z-1)||!get(g,x,y,z+1);
   const kick=disturbance&&exposed&&((L.hash(s.seed+'|'+Math.floor(s.environment.elapsed/2)+'|'+x+','+z)%1000)/1000<p.stress*.13);
   const limit=p.repose+Math.floor(p.bridge/2)-(kick?1:0);
   let dest=null;
   for(const[a,b]of[[x-1,z],[x+1,z],[x,z-1],[x,z+1]])if(a>=0&&a<N&&b>=0&&b<N){const ty=tops[a+N*b];if(y-ty>Math.max(1,limit)&&(!dest||ty<dest[2]))dest=[a,b,ty];}
   if(dest){const[a,b,ty]=dest;move(index(x,y,z),index(a,ty+1,b));tops[a+N*b]=ty+1;let ny=y-1;while(ny>=0&&!get(g,x,ny,z))ny--;tops[x+N*z]=ny;changes++;}
  }if(!changes)break;
 }
 return {moved,passes};
}
function flagPlan(s){
 if(!is3(s))return L.flagPlan(s);
 const p=support(s),f=s.flag,m=properties(s),leverage=(f.length-f.embed)/Math.max(1,f.embed);
 const threshold=Math.min(.4,.1+f.density*.025+leverage*.015+m.stress*.04-m.bridge*.012);
 const fall=p.ratio<threshold||p.contacts<1;
 return {fall,direction:fall&&Math.hypot(p.sx,p.sz)>.01?Math.atan2(-p.sz,-p.sx):f.initialDirection,angle:fall?Math.PI/2:f.initialAngle+Math.max(0,(1-p.ratio)*.12),support:p.ratio,rootContact:p.contacts};
}
function flagContact(s,angle,direction){
 if(!is3(s))return L.flagContact(s,angle,direction);
 const f=s.flag;if(angle<f.initialAngle+.2)return false;
 for(let t=f.embed+.1;t<=f.length;t+=.12){const x=f.x+Math.cos(direction)*Math.sin(angle)*t,z=f.z+Math.sin(direction)*Math.sin(angle)*t,y=f.root-(f.drop||0)+Math.cos(angle)*t;
  if(y<=.1||get(s.grid,Math.floor(x),Math.floor(y),Math.floor(z)))return true;
 }return false;
}
function endTurn(s,harvest,ko=false){
 if(!is3(s))return L.endTurn(s,harvest,ko);if(s.result)return s.result;
 const units=Math.round(harvest*10);if(!valid(harvest,0,SIZE)||Math.abs(harvest*10-units)>1e-6)throw Error('수확량이 올바르지 않습니다.');
 const score=units*unitMass(s),actor=s.player;if(!Number.isSafeInteger(score)||s.scores[0]+s.scores[1]+score>SIZE*10*unitMass(s))throw Error('수확 질량을 초과했습니다.');
 s.scores[actor]+=score;s.turns[actor]++;s.history.push({turn:s.turn,player:actor,grams:score,ko});s.history=s.history.slice(-30);
 if(ko)s.result={winner:1-actor,reason:'ko',actor};else if((s.expired||s.duration>0&&s.remaining<=0)&&s.turns[0]===s.turns[1])s.result=L.weightResult(s);
 else{s.player=1-actor;s.turn++;s.turnRemaining=s.turnDuration;s.turnStarted=false;}return s.result;
}
function checkEnvironment(e){
 if(!e||!valid(e.elapsed,0,1e9)||!['cycle','day','night'].includes(e.time)||!['cycle','spring','summer','autumn','winter'].includes(e.season)||!['auto','clear','rain','snow','wind'].includes(e.weather))throw Error('시간·계절·날씨 설정이 올바르지 않습니다.');
}
const encode=s=>JSON.stringify({...s,grid:Array.from(s.grid),...(is3(s)?{fill:Array.from(s.fill)}:{})});
function decode(raw){
 if(typeof raw!=='string'||raw.length>250000)throw Error('저장 크기가 올바르지 않습니다.');
 const s=JSON.parse(raw);if(s?.version!==VERSION)return L.decode(raw);
 for(const key of ['materialPhysics','turnStarted'])if(s[key]!==undefined&&typeof s[key]!=='boolean')throw Error('저장된 경기 옵션이 올바르지 않습니다.');
 if(s.physics!==PHYSICS||!Array.isArray(s.fill)||s.fill.length!==SIZE||s.fill.some((v,i)=>!Number.isInteger(v)||v<0||v>10||!!v!==!!s.grid?.[i])||!Number.isInteger(s.pilePercent)||!valid(s.pilePercent,50,1700)||!M.some(m=>m.id===s.sediment)||!valid(s.pileHeight,1,H))throw Error('재질 또는 부분 질량 저장이 손상되었습니다.');
 checkEnvironment(s.environment);
 if(!Array.isArray(s.scores)||s.scores.length!==2||s.scores.some(v=>!Number.isSafeInteger(v)||!valid(v,0,SIZE*10*unitMass(s)))||!valid(s.flag?.initialSupport,.01,2000)||!valid(s.flag?.root,0,H-1)||!Array.isArray(s.history)||s.history.some(h=>!h||!Number.isSafeInteger(h.grams)||h.grams<0))throw Error('저장된 점수 또는 지지 상태가 손상되었습니다.');
 // Delegate shared shape checks without reinterpreting legacy score units or shaft support.
 const proxy={...s,version:2,physics:'sand-voxel-2',scores:[0,0],flag:{...s.flag,root:Math.max(.1,s.flag.root),initialSupport:Math.min(200,s.flag.initialSupport)},result:s.result?.reason==='environment'?null:s.result};
 L.decode(JSON.stringify(proxy));
 if(s.result?.reason==='environment'&&s.result.winner!==null)throw Error('환경 종료 결과가 올바르지 않습니다.');
 s.grid=Uint8Array.from(s.grid);s.fill=Uint8Array.from(s.fill);return s;
}
const api={...L,VERSION,PHYSICS,TOOLS,toolConfig:(s,id)=>(is3(s)?TOOLS:L.TOOLS)[id],MATERIALS:M,is3,material,factor,amount,mass,grams,harvestGrams,environment,properties,create,support,carve,settle,flagPlan,flagContact,endTurn,encode,decode};
if(node)module.exports=api;else root.SandEngine=api;
})(globalThis);
