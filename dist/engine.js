/* Fixed-grid deterministic simulation. Mass is stored as integer tenths of a gram. */
(function(root){'use strict';
const N=25,H=17,SIZE=N*N*H,VERSION=1,PHYSICS='sand-voxel-1';
const index=(x,y,z)=>x+N*(z+N*y);
const inside=(x,y,z)=>x>=0&&x<N&&y>=0&&y<H&&z>=0&&z<N;
const get=(g,x,y,z)=>inside(x,y,z)?g[index(x,y,z)]:0;
function hash(s){let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function rng(seed){let s=hash(seed);return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
const TOOLS={brush:{radius:1.7,depth:.6,limit:36,label:'붓'},finger:{radius:1.15,depth:4.2,limit:70,label:'손가락'},hand:{radius:2.55,depth:1.5,limit:150,label:'손'}};
function create(seed='SAND-0909',duration=600,turnDuration=45){
 if(typeof seed!=='string'||!seed.length||seed.length>32||!Number.isFinite(duration)||duration<0||duration>86400||!Number.isFinite(turnDuration)||turnDuration<0||turnDuration>3600)throw Error('경기 설정이 올바르지 않습니다.');
 const random=rng(seed),g=new Uint8Array(SIZE),height=11+Math.floor(random()*2),embed=4+Math.floor(random()*2),length=10+random()*2;
 for(let z=0;z<N;z++)for(let x=0;x<N;x++){let r=Math.hypot(x-12,z-12),top=Math.max(0,Math.floor(height*Math.pow(Math.max(0,1-r/12),.8)));for(let y=0;y<top;y++)g[index(x,y,z)]=1;}
 const state={version:VERSION,physics:PHYSICS,seed,grid:g,scores:[0,0],turns:[0,0],player:0,turn:1,remaining:duration,turnRemaining:turnDuration,duration,turnDuration,flag:{root:height-embed,length,embed,angle:0,direction:random()*Math.PI*2},expired:false,result:null,history:[]};
 state.flag.initialSupport=support(state).count;return state;
}
function support(s){let count=0,sx=0,sz=0;for(let y=Math.max(0,s.flag.root-2);y<Math.min(H,s.flag.root+3);y++)for(let z=10;z<=14;z++)for(let x=10;x<=14;x++)if(get(s.grid,x,y,z)){count++;sx+=x-12;sz+=z-12;}
 return {count,ratio:Math.min(1,count/(s.flag.initialSupport||count||1)),sx,sz};}
function carve(s,point,dir,tool,remaining){if(!TOOLS[tool]||!Number.isFinite(remaining)||remaining<0||!point.every(Number.isFinite)||!dir.every(Number.isFinite))throw Error('잘못된 채굴 입력');
 const t=TOOLS[tool],hits=[];for(let y=Math.max(0,Math.floor(point[1]-t.radius-t.depth));y<Math.min(H,point[1]+t.radius+t.depth+1);y++)for(let z=Math.max(0,Math.floor(point[2]-t.radius-t.depth));z<Math.min(N,point[2]+t.radius+t.depth+1);z++)for(let x=Math.max(0,Math.floor(point[0]-t.radius-t.depth));x<Math.min(N,point[0]+t.radius+t.depth+1);x++){
 if(!get(s.grid,x,y,z))continue;let dx=x+.5-point[0],dy=y+.5-point[1],dz=z+.5-point[2],along=dx*dir[0]+dy*dir[1]+dz*dir[2];let radial=dx*dx+dy*dy+dz*dz-along*along;
 if(along>=-0.65&&along<=t.depth&&radial<t.radius*t.radius)hits.push({i:index(x,y,z),d:along+Math.sqrt(Math.max(0,radial))});}
 hits.sort((a,b)=>a.d-b.d||a.i-b.i);const taken=hits.slice(0,Math.floor(remaining));for(const v of taken)s.grid[v.i]=0;return taken.length;
}
// Each layer carries weight through a vertical support or a short, two-cell arch.
// Unsupported cells fall by one cell per solver step; lateral cavities can survive.
function settle(s){let moved=0,passes=0;const g=s.grid;for(let pass=0;pass<H;pass++){let changes=0;for(let y=1;y<H;y++){
 const dist=new Int8Array(N*N).fill(-1),queue=[];for(let z=0;z<N;z++)for(let x=0;x<N;x++)if(get(g,x,y,z)&&get(g,x,y-1,z)){dist[x+N*z]=0;queue.push([x,z]);}
 for(let q=0;q<queue.length;q++){const [x,z]=queue[q],d=dist[x+N*z];if(d>=2)continue;for(const [a,b]of[[x-1,z],[x+1,z],[x,z-1],[x,z+1]])if(a>=0&&a<N&&b>=0&&b<N&&dist[a+N*b]<0&&get(g,a,y,b)){dist[a+N*b]=d+1;queue.push([a,b]);}}
 for(let z=0;z<N;z++)for(let x=0;x<N;x++)if(get(g,x,y,z)&&dist[x+N*z]<0&&!get(g,x,y-1,z)){g[index(x,y,z)]=0;g[index(x,y-1,z)]=1;changes++;}
 }moved+=changes;passes++;if(!changes)break;}return {moved,passes};}
function flagPlan(s){const p=support(s);let rootContact=0;for(let y=s.flag.root;y<s.flag.root+s.flag.embed;y++)for(const [x,z]of[[11,12],[13,12],[12,11],[12,13],[12,12]])rootContact+=get(s.grid,x,y,z);
 const fall=p.ratio<.19||rootContact<3;const direction=Math.hypot(p.sx,p.sz)>0?Math.atan2(-p.sz,-p.sx):s.flag.direction;
 return {fall,direction,angle:fall?Math.PI/2:Math.max(0,(1-p.ratio)*.48),support:p.ratio,rootContact};}
function flagContact(s,angle,direction){if(s.flag.root-(s.flag.drop||0)<=.12)return true;if(angle<.6)return false;for(let t=2;t<=s.flag.length;t+=.2){let x=12.5+Math.cos(direction)*Math.sin(angle)*t,z=12.5+Math.sin(direction)*Math.sin(angle)*t,y=s.flag.root-(s.flag.drop||0)+Math.cos(angle)*t;if(y<=.12||get(s.grid,Math.floor(x),Math.floor(y),Math.floor(z)))return true;}return false;}
function endTurn(s,harvest,ko=false){if(s.result)return s.result;if(!Number.isInteger(harvest)||harvest<0||harvest>150)throw Error('수확량 오류');const actor=s.player;s.scores[actor]+=harvest*7;s.turns[actor]++;
 s.history.push({turn:s.turn,player:actor,grams:harvest*7,ko});s.history=s.history.slice(-30);
 if(ko)s.result={winner:1-actor,reason:'ko',actor};else if((s.expired||s.duration>0&&s.remaining<=0)&&s.turns[0]===s.turns[1])s.result={winner:s.scores[0]===s.scores[1]?null:s.scores[0]>s.scores[1]?0:1,reason:'weight'};
 else{s.player=1-actor;s.turn++;s.turnRemaining=s.turnDuration;}return s.result;
}
function encode(s){return JSON.stringify({...s,grid:Array.from(s.grid)});}
function decode(raw){if(typeof raw!=='string'||raw.length>180000)throw Error('저장 파일 크기가 올바르지 않습니다.');const s=JSON.parse(raw);
 const number=(x,a,b)=>typeof x==='number'&&Number.isFinite(x)&&x>=a&&x<=b;
 if(!s||s.version!==VERSION||s.physics!==PHYSICS)throw Error('지원하지 않는 저장 버전입니다.');
 if(!Array.isArray(s.grid)||s.grid.length!==SIZE||s.grid.some(v=>v!==0&&v!==1)||typeof s.seed!=='string'||!s.seed.length||s.seed.length>32||![0,1].includes(s.player)||!Number.isInteger(s.turn)||s.turn<1||!Array.isArray(s.scores)||s.scores.length!==2||s.scores.some(v=>!Number.isInteger(v)||v<0||v>SIZE*7)||!Array.isArray(s.turns)||s.turns.length!==2||s.turns.some(v=>!Number.isInteger(v)||v<0)||s.turns[0]<s.turns[1]||s.turns[0]>s.turns[1]+1||!number(s.duration,0,86400)||!number(s.remaining,0,s.duration)||!number(s.turnDuration,0,3600)||!number(s.turnRemaining,0,s.turnDuration)||typeof s.expired!=='boolean'||!s.flag||!number(s.flag.root,1,H-1)||!number(s.flag.embed,1,10)||!number(s.flag.length,1,20)||!number(s.flag.angle,0,Math.PI)||!number(s.flag.direction,-Math.PI*2,Math.PI*2)||!number(s.flag.initialSupport,1,200)||(s.flag.drop!==undefined&&!number(s.flag.drop,0,H))||!Array.isArray(s.history)||s.history.length>30)throw Error('저장된 경기 데이터가 손상되었습니다.');
 if(s.result!==null&&(!s.result||![0,1,null].includes(s.result.winner)||!['ko','weight'].includes(s.result.reason)))throw Error('저장된 결과가 올바르지 않습니다.');
 s.grid=Uint8Array.from(s.grid);return s;}
const api={N,H,SIZE,VERSION,PHYSICS,TOOLS,index,inside,get,hash,rng,create,support,carve,settle,flagPlan,flagContact,endTurn,encode,decode};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SandEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this);
