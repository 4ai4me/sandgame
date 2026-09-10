/* Deterministic voxel rules; score unit = 0.1g. */
(function(root){'use strict';
const C=typeof module!=='undefined'&&module.exports?require('./content.js'):root.SandContent;
const N=25,H=17,SIZE=N*N*H,VERSION=2,PHYSICS='sand-voxel-2';
const index=(x,y,z)=>x+N*(z+N*y);
const inside=(x,y,z)=>Number.isInteger(x)&&Number.isInteger(y)&&Number.isInteger(z)&&x>=0&&x<N&&y>=0&&y<H&&z>=0&&z<N;
const get=(g,x,y,z)=>inside(x,y,z)?g[index(x,y,z)]:0;
const TOOLS={
 broom:{radius:2.5,depth:.55,batch:18,interval:130,label:'빗자루',hint:'넓은 표면을 계속 쓸어냅니다. 오래 누르면 아래층도 깎입니다.'},
 finger:{radius:1.05,depth:3.4,batch:12,interval:140,label:'손가락',hint:'좁고 깊은 굴을 팝니다. 깃발 아래 지지대를 주의하세요.'},
 needle:{radius:.48,depth:1.5,batch:1,interval:180,label:'바늘',hint:'한 번에 한 복셀씩 정밀하게 제거합니다. 누르면 계속 파고듭니다.'},
 toothpick:{radius:.7,depth:4.4,batch:3,interval:150,label:'이쑤시개',hint:'작은 구멍을 깊게 뚫습니다. 좁은 터널을 만들 때 유리합니다.'},
 hand:{radius:2.2,depth:1.7,batch:27,interval:180,label:'한손',hint:'한 손으로 모래를 움켜쥡니다. 누른 채 움직여 연속 수확하세요.'},
 bothhands:{radius:3.5,depth:2.2,batch:48,interval:200,label:'양손',hint:'두 손으로 넓게 퍼냅니다. 많은 양을 빠르게 가져가니 붕괴에 주의하세요.'}
};
function hash(s){let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function rng(seed){let s=hash(seed);return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
const number=(x,min,max)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max;
function seconds(value,unit=1){
 if((typeof value!=='string'&&typeof value!=='number')||String(value).trim()===''||![1,60,3600].includes(Number(unit)))throw Error('시간과 단위를 확인하세요.');
 const result=Number(value)*Number(unit);
 if(!number(result,0,86400)||Math.abs(result-Math.round(result))>1e-7)throw Error('시간은 0~24시간 범위에서 초 단위로 입력하세요. 0은 무제한입니다.');
 return Math.round(result);
}
function create(seed='SAND-0909',duration=600,turnDuration=45,options={}){
 if(typeof seed!=='string'||!seed.trim()||seed.length>32||!Number.isInteger(duration)||!number(duration,0,86400)||!Number.isInteger(turnDuration)||!number(turnDuration,0,86400))throw Error('경기 설정이 올바르지 않습니다.');
 const variant=options.variant??seed;
 if(typeof variant!=='string'||!variant.length||variant.length>80)throw Error('새 경기 번호가 올바르지 않습니다.');
 if(options.stage&&options.stage!=='random'&&!C.STAGES.some(s=>s.id===options.stage))throw Error('알 수 없는 장소입니다.');
 const random=rng(seed),g=new Uint8Array(SIZE),height=11+Math.floor(random()*2);
 for(let z=0;z<N;z++)for(let x=0;x<N;x++){
  const r=Math.hypot(x-12,z-12),top=Math.max(0,Math.floor(height*Math.pow(Math.max(0,1-r/12),.8)));
  for(let y=0;y<top;y++)g[index(x,y,z)]=1;
 }
 const roll=rng(seed+'|'+variant),pick=a=>a[Math.floor(roll()*a.length)];
 const material=pick(C.MATERIALS),kind=roll(),embed=kind<.25?.55+roll()*.75:kind>.75?height-.35-roll()*.8:2+roll()*(height-3);
 const angle=roll()*(embed<2?.11:.31),direction=roll()*Math.PI*2;
 const stage=options.stage&&options.stage!=='random'?options.stage:pick(C.STAGES).id;
 let design=pick(C.FLAGS).id;
 if(design===options.previousDesign)design=C.FLAGS[(C.FLAGS.findIndex(f=>f.id===design)+1)%C.FLAGS.length].id;
 const diameter=(material.id==='steel'||material.id==='chopstick'?.08:.14)+roll()*(material.id==='cue'?.55:.3);
 const colors=[material.color,material.color,'#d3654c','#476d82','#4d7954','#e5cc8e'];
 const flag={root:height-embed*Math.cos(angle),x:12.5-Math.cos(direction)*Math.sin(angle)*embed,z:12.5-Math.sin(direction)*Math.sin(angle)*embed,length:embed+4.2+roll()*5.1,embed,angle,initialAngle:angle,initialDirection:direction,direction,diameter,material:material.id,color:pick(colors),density:material.density,grip:material.grip,design,drop:0};
 const s={version:VERSION,physics:PHYSICS,seed,variant,stage,grid:g,scores:[0,0],turns:[0,0],player:0,turn:1,remaining:duration,turnRemaining:turnDuration,duration,turnDuration,flag,expired:false,result:null,history:[]};
 flag.initialSupport=support(s).count;
 if(!flag.initialSupport||flagPlan(s).fall||flagContact(s,flag.angle,flag.direction))throw Error('안정적인 깃발을 생성하지 못했습니다. 다른 시드로 시도하세요.');
 return s;
}
function support(s){
 const f=s.flag,cx=Math.floor(f.x??12.5),cz=Math.floor(f.z??12.5);let count=0,sx=0,sz=0;
 for(let y=Math.max(0,Math.floor(f.root)-2);y<Math.min(H,Math.floor(f.root)+3);y++)for(let z=cz-2;z<=cz+2;z++)for(let x=cx-2;x<=cx+2;x++)if(get(s.grid,x,y,z)){count++;sx+=x-cx;sz+=z-cz;}
 return {count,ratio:Math.min(1,count/(f.initialSupport||count||1)),sx,sz};
}
function carve(s,point,dir,tool,remaining){
 const vec=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
 if(!Object.hasOwn(TOOLS,tool)||!vec(point)||!vec(dir)||!number(remaining,0,SIZE))throw Error('잘못된 채굴 입력입니다.');
 const length=Math.hypot(...dir);if(length<.001)throw Error('채굴 방향이 올바르지 않습니다.');dir=dir.map(v=>v/length);
 const t=TOOLS[tool],hits=[],bound=t.radius+t.depth;
 for(let y=Math.max(0,Math.floor(point[1]-bound));y<Math.min(H,point[1]+bound+1);y++)for(let z=Math.max(0,Math.floor(point[2]-bound));z<Math.min(N,point[2]+bound+1);z++)for(let x=Math.max(0,Math.floor(point[0]-bound));x<Math.min(N,point[0]+bound+1);x++){
  if(!get(s.grid,x,y,z))continue;
  const dx=x+.5-point[0],dy=y+.5-point[1],dz=z+.5-point[2],along=dx*dir[0]+dy*dir[1]+dz*dir[2],radial=dx*dx+dy*dy+dz*dz-along*along;
  if(along>=-.8&&along<=t.depth&&radial<(t.radius+.25)**2)hits.push({i:index(x,y,z),d:along+Math.sqrt(Math.max(0,radial))});
 }
 if(!hits.length&&remaining>0){const [x,y,z]=point.map(Math.floor);if(get(s.grid,x,y,z))hits.push({i:index(x,y,z),d:0});}
 hits.sort((a,b)=>a.d-b.d||a.i-b.i);const taken=hits.slice(0,Math.floor(remaining));for(const v of taken)s.grid[v.i]=0;
 return taken.length;
}
function settle(s){
 let moved=0,passes=0;const g=s.grid;
 for(let pass=0;pass<H;pass++){let changes=0;for(let y=1;y<H;y++){
  const dist=new Int8Array(N*N).fill(-1),queue=[];
  for(let z=0;z<N;z++)for(let x=0;x<N;x++)if(get(g,x,y,z)&&get(g,x,y-1,z)){dist[x+N*z]=0;queue.push([x,z]);}
  for(let q=0;q<queue.length;q++){const [x,z]=queue[q],d=dist[x+N*z];if(d>=2)continue;
   for(const [a,b]of[[x-1,z],[x+1,z],[x,z-1],[x,z+1]])if(a>=0&&a<N&&b>=0&&b<N&&dist[a+N*b]<0&&get(g,a,y,b)){dist[a+N*b]=d+1;queue.push([a,b]);}
  }
  for(let z=0;z<N;z++)for(let x=0;x<N;x++)if(get(g,x,y,z)&&dist[x+N*z]<0&&!get(g,x,y-1,z)){g[index(x,y,z)]=0;g[index(x,y-1,z)]=1;changes++;}
 }moved+=changes;passes++;if(!changes)break;}
 return {moved,passes};
}
function flagPlan(s){
 const p=support(s),f=s.flag;let rootContact=0;
 if(s.physics==='sand-voxel-1'){for(let y=f.root;y<f.root+f.embed;y++)for(const [x,z]of[[11,12],[13,12],[12,11],[12,13],[12,12]])rootContact+=get(s.grid,x,y,z);}
 else for(let t=0;t<f.embed;t+=.35){
  const direction=f.initialDirection??f.direction;
  const x=f.x+Math.cos(direction)*Math.sin(f.initialAngle)*t,z=f.z+Math.sin(direction)*Math.sin(f.initialAngle)*t,y=f.root+Math.cos(f.initialAngle)*t;
  rootContact+=get(s.grid,Math.floor(x),Math.floor(y),Math.floor(z));
 }
 const leverage=(f.length-f.embed)/Math.max(1,f.embed);
 const threshold=s.physics==='sand-voxel-1'?.19:Math.min(.55,.14+f.density*.045+leverage*.022+f.initialAngle*.18-f.diameter*.07-f.grip*.035);
 const fall=p.ratio<threshold||rootContact<(s.physics==='sand-voxel-1'?3:1);
 const direction=Math.hypot(p.sx,p.sz)>0?Math.atan2(-p.sz,-p.sx):f.direction;
 return {fall,direction,angle:fall?Math.PI/2:(f.initialAngle||0)+Math.max(0,(1-p.ratio)*.48),support:p.ratio,rootContact};
}
function flagContact(s,angle,direction){
 const f=s.flag,baseY=f.root-(f.drop||0);if(baseY<=.12)return true;
 if(angle<(s.physics==='sand-voxel-1'?.6:(f.initialAngle||0)+.2))return false;
 for(let t=s.physics==='sand-voxel-1'?2:f.embed+.25;t<=f.length;t+=.15){
  const x=(f.x??12.5)+Math.cos(direction)*Math.sin(angle)*t,z=(f.z??12.5)+Math.sin(direction)*Math.sin(angle)*t,y=baseY+Math.cos(angle)*t;
  if(y<=.12||get(s.grid,Math.floor(x),Math.floor(y),Math.floor(z)))return true;
 }return false;
}
const weightResult=s=>({winner:s.scores[0]===s.scores[1]?null:s.scores[0]>s.scores[1]?0:1,reason:'weight'});
function endTurn(s,harvest,ko=false){
 if(s.result)return s.result;
 if(!Number.isInteger(harvest)||!number(harvest,0,SIZE)||s.scores.reduce((a,b)=>a+b,0)+harvest*7>SIZE*7)throw Error('수확량이 올바르지 않습니다.');
 const actor=s.player;s.scores[actor]+=harvest*7;s.turns[actor]++;
 s.history.push({turn:s.turn,player:actor,grams:harvest*7,ko});s.history=s.history.slice(-30);
 if(ko)s.result={winner:1-actor,reason:'ko',actor};
 else if((s.expired||s.duration>0&&s.remaining<=0)&&s.turns[0]===s.turns[1])s.result=weightResult(s);
 else{s.player=1-actor;s.turn++;s.turnRemaining=s.turnDuration;}return s.result;
}
const encode=s=>JSON.stringify({...s,grid:Array.from(s.grid)});
function decode(raw){
 if(typeof raw!=='string'||raw.length>200000)throw Error('저장 파일 크기가 올바르지 않습니다.');
 const s=JSON.parse(raw);
 if(!s||![1,VERSION].includes(s.version)||!['sand-voxel-1',PHYSICS].includes(s.physics))throw Error('지원하지 않는 저장 버전입니다.');
 if(!Array.isArray(s.grid)||s.grid.length!==SIZE||s.grid.some(v=>v!==0&&v!==1)||typeof s.seed!=='string'||!s.seed.trim()||s.seed.length>32||![0,1].includes(s.player)||!Number.isSafeInteger(s.turn)||s.turn<1||!Array.isArray(s.scores)||s.scores.length!==2||s.scores.some(v=>!Number.isInteger(v)||!number(v,0,SIZE*7))||!Array.isArray(s.turns)||s.turns.length!==2||s.turns.some(v=>!Number.isSafeInteger(v)||v<0)||s.turns[0]<s.turns[1]||s.turns[0]>s.turns[1]+1||!number(s.duration,0,86400)||!number(s.remaining,0,s.duration)||!number(s.turnDuration,0,86400)||!number(s.turnRemaining,0,s.turnDuration)||typeof s.expired!=='boolean'||!s.flag||!number(s.flag.root,.1,H-1)||!number(s.flag.embed,.2,H)||!number(s.flag.length,1,32)||!number(s.flag.angle,0,Math.PI)||!number(s.flag.direction,-Math.PI*2,Math.PI*2)||!number(s.flag.initialSupport,1,200)||(s.flag.drop!==undefined&&!number(s.flag.drop,0,H))||!Array.isArray(s.history)||s.history.length>30)throw Error('저장된 경기 데이터가 손상되었습니다.');
 if(s.result!==null&&(!s.result||![0,1,null].includes(s.result.winner)||!['ko','weight'].includes(s.result.reason)))throw Error('저장된 결과가 올바르지 않습니다.');
 if(s.version===1){
  if(s.physics!=='sand-voxel-1')throw Error('저장 버전과 물리 규칙이 일치하지 않습니다.');
  s.version=VERSION;s.variant=s.seed;s.stage='beach';
  Object.assign(s.flag,{x:12.5,z:12.5,initialAngle:0,diameter:.14,material:'twig',color:'#795239',density:.55,grip:1.2,design:'strawhat'});
 }
 const f=s.flag;
 if(typeof s.variant!=='string'||s.variant.length>80||!C.STAGES.some(v=>v.id===s.stage)||!C.FLAGS.some(v=>v.id===f.design)||!C.MATERIALS.some(v=>v.id===f.material)||!number(f.x,0,N)||!number(f.z,0,N)||!number(f.diameter,.01,2)||!number(f.initialAngle,0,.6)||!number(f.density,.1,5)||!number(f.grip,.1,3)||typeof f.color!=='string'||!/^#[0-9a-f]{6}$/i.test(f.color))throw Error('저장된 장소 또는 깃발 사양이 올바르지 않습니다.');
 if(f.initialDirection!==undefined&&!number(f.initialDirection,-Math.PI*2,Math.PI*2))throw Error('저장된 깃발 방향이 올바르지 않습니다.');
 s.grid=Uint8Array.from(s.grid);return s;
}
const api={N,H,SIZE,VERSION,PHYSICS,TOOLS,index,inside,get,hash,rng,seconds,create,support,carve,settle,flagPlan,flagContact,endTurn,weightResult,encode,decode};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SandEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this);
