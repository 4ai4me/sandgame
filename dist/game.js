/* Browser controller. Rendering never mutates the physical grid. */
(()=>{'use strict';
const E=SandEngine,C=SandContent,W=SandWorld,$=id=>document.getElementById(id);
const canvas=$('game'),ctx=canvas.getContext('2d',{alpha:false}),audio=new SandAudio();
const KEY='sand-digger.save.v3',BACKUP=KEY+'.backup',LEGACY='sand-digger.save.v1';
const raster=new SandRaster();let flagTextureData=null,environmentTick=0;
const nonce=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
let state=E.create('SAND-0909',600,45,{variant:nonce()}),tool='finger',phase='observe';
let cut=false,yaw=-.72,pitch=.57,zoom=1,w=900,h=700,dpr=1,faces=[],sceneFaces=[],sceneBoxes=[],dirty=true;
let hover=null,drag=null,pointers=new Map(),harvest=0,checkpoint='',anim=null,particles=[],last=performance.now();
let timeSave=0,toastUntil=0,paused=document.hidden,storageBlocked=false,nextDig=0,roll=0,bob=0,sceneTime=0;
let currentStage=null,flagImage=null,flagDesign=null,cursors={},lastUI=0;
const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches||false;
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');toastUntil=performance.now()+4000;}
function save(){
 if(storageBlocked)return false;
 try{
  const raw=E.encode(state);E.decode(raw);const previous=localStorage.getItem(KEY);
  if(previous){let valid=false;try{E.decode(previous);valid=true;}catch(e){console.warn('Invalid previous save preserved',e.message);}
   localStorage.setItem(valid?BACKUP:KEY+'.unreadable',previous);
  }
  localStorage.setItem(KEY,raw);$('saveStatus').textContent='✓ 이 브라우저에 저장됨';return true;
 }catch(e){console.error('Save failed',e);$('saveStatus').textContent='저장 실패 · 저장 공간과 권한을 확인하세요';return false;}
}
function load(){
 let found=false;
 for(const key of[KEY,BACKUP,'sand-digger.save.v2','sand-digger.save.v2.backup',LEGACY,LEGACY+'.backup']){
  try{const raw=localStorage.getItem(key);if(!raw)continue;found=true;const next=E.decode(raw);state=next;
   toast(key===KEY?'저장한 경기에서 이어갑니다.':key.startsWith(LEGACY)?'이전 버전의 경기를 이어갑니다.':'이전 정상 저장으로 복구했습니다.');return;
  }catch(e){found=true;console.error('Save read failed: '+key,e);}
 }
 if(found){storageBlocked=true;$('saveStatus').textContent='저장 읽기 실패 · 기존 데이터는 보존됩니다';toast('저장 데이터를 읽지 못했습니다. 새 경기에서 시작해 주세요.');}
}
function scale(){return Math.min(w/37,h/32)*zoom/Math.max(1,E.factor(state)*.8);}
function worldProject(x,y,z){x-=12.5;z-=12.5;const c=Math.cos(yaw),s=Math.sin(yaw),a=c*x-s*z,b=s*x+c*z,k=scale();return{x:w*.5+a*k,y:h*.67+(b*Math.sin(pitch)-(y-1)*Math.cos(pitch))*k,d:b*Math.cos(pitch)+y*Math.sin(pitch)};}
function project(x,y,z){const f=E.factor(state);return worldProject(12.5+(x-12.5)*f,y*f,12.5+(z-12.5)*f);}
function unrock(px,py){const x=px-w*.5,y=py-h*.6-bob,c=Math.cos(roll),s=Math.sin(roll);return[x*c+y*s+w*.5,-x*s+y*c+h*.6];}
function ray(px,py){const [rx,ry]=unrock(px,py),k=scale(),a=(rx-w*.5)/k,v=(ry-h*.67)/k,c=Math.cos(yaw),s=Math.sin(yaw),sp=Math.sin(pitch),cp=Math.cos(pitch),f=E.factor(state);return{origin:[12.5+(c*a+s*(v*sp+45*cp))/f,(1-v*cp+45*sp)/f,12.5+(-s*a+c*(v*sp+45*cp))/f],dir:[-s*cp,-sp,-c*cp]};}
function hit(px,py){const r=ray(px,py);for(let t=0;t<95;t+=.06){const p=r.origin.map((v,i)=>v+r.dir[i]*t),[x,y,z]=p.map(Math.floor);if(cut&&x>=13)continue;if(E.get(state.grid,x,y,z)&&p[1]-y<=E.amount(state,E.index(x,y,z))/10)return{p,dir:r.dir};}return null;}
const faceSpec=[{n:[0,1,0],v:[[0,1,0],[0,1,1],[1,1,1],[1,1,0]],shade:1},{n:[0,-1,0],v:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]],shade:.65},{n:[1,0,0],v:[[1,0,0],[1,1,0],[1,1,1],[1,0,1]],shade:.83},{n:[-1,0,0],v:[[0,0,0],[0,0,1],[0,1,1],[0,1,0]],shade:.73},{n:[0,0,1],v:[[0,0,1],[1,0,1],[1,1,1],[0,1,1]],shade:.9},{n:[0,0,-1],v:[[0,0,0],[0,1,0],[1,1,0],[1,0,0]],shade:.76}];
function rebuild(){
 faces=[];const view=[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)];
 sceneFaces=W.faces(sceneBoxes,worldProject,view);
 const bins=[];for(const [x,col]of [[1,'#5e7b66'],[24,'#ac765b']]){bins.push({x:x-1.7,y:0,z:24,w:3.4,h:.2,d:2.5,color:col});for(const [bx,bz,bw,bd]of [[x-1.7,24,.2,2.5],[x+1.5,24,.2,2.5],[x-1.7,24,3.4,.2],[x-1.7,26.3,3.4,.2]])bins.push({x:bx,y:.2,z:bz,w:bw,h:1,d:bd,color:col});}sceneFaces.push(...W.faces(bins,project,view));
 for(let y=0;y<E.H;y++)for(let z=0;z<E.N;z++)for(let x=0;x<E.N;x++){
  if(!E.get(state.grid,x,y,z)||cut&&x>=13)continue;
  for(const f of faceSpec){if(f.n.reduce((a,v,i)=>a+v*view[i],0)<=0)continue;
   const[a,b,c]=f.n,level=E.amount(state,E.index(x,y,z))/10,neighbor=E.inside(x+a,y+b,z+c)?E.amount(state,E.index(x+a,y+b,z+c))/10:0;
   if(neighbor>=level&&!(cut&&x+a>=13)&&!(b===1&&level<1))continue;
   const grain=((x*37+y*19+z*53)%17)-8;
   faces.push({poly:f.v.map(v=>project(x+v[0],y+v[1]*level,z+v[2])),d:project(x+.5,y+.5,z+.5).d,color:'rgb('+(E.is3(state)?E.material(state).color:currentStage.sand).map(v=>Math.round((v+grain)*f.shade)).join(',')+')',grain});
  }
 }
 raster.clear();for(const f of [...sceneFaces,...faces])raster.polygon(f.poly,f.color);raster.cache();dirty=false;
}
function drawFlag(now){
 const f=state.flag,a=f.angle,dir=f.direction,base=[f.x,f.root-(f.drop||0),f.z],axis=[Math.cos(dir)*Math.sin(a),Math.cos(a),Math.sin(dir)*Math.sin(a)],side=[-Math.sin(dir),0,Math.cos(dir)],other=[axis[1]*side[2],axis[2]*side[0]-axis[0]*side[2],-axis[1]*side[0]];
 const at=(t,u=0,v=0)=>base.map((x,i)=>x+axis[i]*t+side[i]*u+other[i]*v),radius=f.diameter/2;
 for(let i=0;i<10;i++){const a=i*Math.PI/5,b=(i+1)*Math.PI/5,poly=[at(0,Math.cos(a)*radius,Math.sin(a)*radius),at(f.length,Math.cos(a)*radius,Math.sin(a)*radius),at(f.length,Math.cos(b)*radius,Math.sin(b)*radius),at(0,Math.cos(b)*radius,Math.sin(b)*radius)];raster.polygon(poly.map(v=>project(...v)),i<5?f.color:'#6f6554');}
 for(let i=0;i<12;i++){
  const verts=[[i/12,0],[(i+1)/12,0],[(i+1)/12,1],[i/12,1]].map(([u,v])=>{const wave=reduced?0:Math.sin(now/270-u*6)*u*.18,pt=at(f.length-v*2.5,u*3.35,wave);return{...project(...pt),u,v};});
  raster.polygon(verts,'#eee5ce',flagTextureData);
 }
}
function draw(now){
 const env=E.environment(state),sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,currentStage.sky);sky.addColorStop(1,currentStage.haze);ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
 const motion=$('motion').checked&&!reduced?(currentStage.motion||0):0;roll=Math.sin(sceneTime*.62)*.026*motion;bob=Math.sin(sceneTime*.9)*4*motion;
 if(dirty)rebuild();raster.restore();drawFlag(now);
 for(let i=particles.length-1;i>=0;i--){const particle=particles[i],t=(now-particle.start)/700;if(t>1){particles.splice(i,1);continue;}const end=[particle.player?24:1,1,25],pt=particle.from.map((v,j)=>v+(end[j]-v)*t+(j===1?Math.sin(t*Math.PI)*5:0)),poly=[[-.1,0,0],[.1,0,0],[.1,.2,0],[-.1,.2,0]].map(v=>project(...pt.map((x,j)=>x+v[j])));raster.polygon(poly,'#edcf94');}ctx.save();ctx.translate(w*.5,h*.6+bob);ctx.rotate(roll);ctx.translate(-w*.5,-h*.6);raster.present(ctx,w,h);
 if(hover&&(phase==='observe'||phase==='dig')&&!drag?.rotating){const p=project(...hover.p),r=Math.max(5,E.TOOLS[tool].radius*scale()*E.factor(state));ctx.strokeStyle='#fff8db';ctx.lineWidth=1.6;ctx.setLineDash([4,4]);ctx.beginPath();ctx.ellipse(p.x,p.y,r,r*.65,0,0,7);ctx.stroke();ctx.setLineDash([]);}
 ctx.restore();
 // Lighting and weather cover both the world and pile, while controls stay legible.
 ctx.fillStyle='rgba(9,19,48,'+((1-env.daylight)*.62)+')';ctx.fillRect(0,0,w,h);
 if(env.season==='autumn'){ctx.fillStyle='#ca782417';ctx.fillRect(0,0,w,h);}if(env.season==='winter'){ctx.fillStyle='#b9d9f01c';ctx.fillRect(0,0,w,h);}
 ctx.fillStyle=env.daylight>.4?'#fff3ae':'#e1eafb';ctx.beginPath();ctx.arc(w*.83,h*.16,env.daylight>.4?15:11,0,Math.PI*2);ctx.fill();
 if(env.weather==='rain'||env.weather==='snow'){ctx.strokeStyle=env.weather==='rain'?'#c0d9edaa':'#ffffffdf';ctx.lineWidth=env.weather==='snow'?3:1;ctx.beginPath();for(let i=0;i<70;i++){const x=(i*137+sceneTime*env.wind*32)%w,y=(i*79+sceneTime*(env.weather==='snow'?18:200))%h;ctx.moveTo(x,y);ctx.lineTo(x+(env.weather==='snow'?1:4),y+(env.weather==='snow'?2:12));}ctx.stroke();}
 if(env.weather==='wind'){ctx.strokeStyle='#ffffff70';ctx.lineWidth=1;ctx.beginPath();for(let i=0;i<10;i++){const x=(i*139+sceneTime*100)%w,y=(i*67+80)%h;ctx.moveTo(x,y);ctx.lineTo(x+30,y-5);}ctx.stroke();}
 const seasons={spring:'봄',summer:'여름',autumn:'가을',winter:'겨울'},weather={clear:'맑음',rain:'비',snow:'눈',wind:'강풍'};$('environmentLabel').textContent=seasons[env.season]+' · '+(env.daylight>.4?'낮':'밤')+' · '+weather[env.weather];
}
function setScene(){
 currentStage=C.STAGES.find(s=>s.id===state.stage);sceneBoxes=W.build(currentStage);const f=E.factor(state);for(const b of sceneBoxes){b.x=12.5+(b.x-12.5)*f;b.z=12.5+(b.z-12.5)*f;if(b.w>20)b.w*=f;if(b.d>20)b.d*=f;}sceneBoxes.push({x:12.5-14*f,y:-.3,z:12.5-14*f,w:28*f,h:.3,d:28*f,color:'#d5c397'});audio.setTrack(currentStage.track);dirty=true;
 if(flagDesign!==state.flag.design){flagDesign=state.flag.design;flagImage=W.flagTexture(flagDesign);const thumb=$('flagPreview');thumb.width=128;thumb.height=96;thumb.getContext('2d').drawImage(flagImage,0,0);flagTextureData=flagImage.getContext('2d').getImageData(0,0,128,96);}
 $('stageName').textContent=currentStage.name;$('stageTag').textContent=currentStage.tag+' · LOCAL 2P';$('trackName').textContent=C.TRACKS.find(t=>t.id===currentStage.track).name;
 $('flagName').textContent=C.FLAGS.find(f=>f.id===state.flag.design).name;
}
function updateCursor(){canvas.style.cursor=drag?.mode==='rotate'||drag?.rotating?'grabbing':phase==='settle'?'wait':state.result?'default':cursors[tool];}
function updateClock(){
 const t=Math.ceil(state.remaining),hours=Math.floor(t/3600);$('clock').textContent=state.duration===0?'∞':hours?hours+':'+String(Math.floor(t%3600/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0'):Math.floor(t/60)+':'+String(t%60).padStart(2,'0');
 $('turnClock').textContent=state.turnDuration?Math.ceil(state.turnRemaining)+'초':'무제한';
}
function updateUI(){
 $('materialLabel').textContent=(E.is3(state)?E.material(state).name+' · 규모 '+state.pilePercent:'구버전 경기 · 새 경기에서 확장 적용');const r=E.support(state).ratio;for(let i=0;i<2;i++){$('score'+i).textContent=E.grams(state,state.scores[i]).toFixed(6).replace(/0+$/,'').replace(/\.$/,'');$('p'+i).classList.toggle('active',!state.result&&state.player===i);}
 $('round').textContent='ROUND '+String(Math.floor((state.turn-1)/2)+1).padStart(2,'0');$('seedLabel').textContent='SEED / '+state.seed;$('toolHint').textContent=E.toolConfig(state,tool).hint;
 const f=state.flag,m=C.MATERIALS.find(v=>v.id===f.material);$('flagSpec').textContent=m.name+' · '+(f.length*E.factor(state)).toFixed(1)+' cm · 굵기 '+(f.diameter*10*E.factor(state)).toFixed(1)+' mm';
 $('flagDetail').textContent='매립 '+(f.embed*E.factor(state)).toFixed(1)+' cm · 초기 각도 '+(f.initialAngle*180/Math.PI).toFixed(1)+'°';
 $('riskLabel').textContent=r>.7?'안정적':r>.4?'흔들림 주의':'붕괴 위험';$('riskBar').style.width=r*100+'%';$('riskBar').style.background=r>.4?'#82a16f':'#d78157';
 $('turnLabel').textContent=state.result?'경기가 끝났어요':phase==='settle'?'모래가 가라앉는 중…':phase==='dig'?'플레이어 '+(state.player+1)+' · 채굴 중':'플레이어 '+(state.player+1)+'의 차례';
 $('instruction').textContent=state.expired?'시간 종료 · 마지막 라운드를 마무리합니다.':phase==='dig'?'좌클릭 / 한 손가락을 놓으면 수 종료 · 우클릭을 함께 누르면 회전':phase==='settle'?'깃발이 멈출 때까지 기다려 주세요.':'좌클릭 / 한 손가락: 채굴 · 우클릭 / 두 손가락: 회전';
 $('harvest').textContent=E.harvestGrams(state,harvest).toFixed(6).replace(/0+$/,'').replace(/\.$/,'')+' g';$('pass').disabled=phase!=='observe'||!!state.result||!!drag;
 document.querySelectorAll('[data-tool]').forEach(b=>{b.disabled=phase!=='observe'||!!state.result||!!drag;b.classList.toggle('selected',b.dataset.tool===tool);b.setAttribute('aria-pressed',b.dataset.tool===tool?'true':'false');});
 $('settings').disabled=phase!=='observe'||!!drag;$('help').disabled=phase!=='observe'||!!drag;updateClock();updateCursor();
}
function take(px,py){
 const point=hit(px,py);hover=point;if(!point)return false;
 const n=E.carve(state,point.p,point.dir,tool,E.TOOLS[tool].batch);
 if(n){harvest=Math.round((harvest+n)*10)/10;dirty=true;for(let i=0;i<Math.min(n,6);i++)particles.push({from:point.p,player:state.player,start:performance.now()-i*10});if(particles.length>100)particles=particles.slice(-100);audio.effect('dig');updateUI();}return n>0;
}
function finish(){
 if(phase!=='dig')return;drag=null;pointers.clear();
 if(!harvest){phase='observe';checkpoint='';updateUI();if(state.turnDuration&&state.turnRemaining<=0)pass();else if(state.expired&&state.turns[0]===state.turns[1])finishWeight();return;}
 phase='settle';E.settle(state);const plan=E.flagPlan(state);dirty=true;
 anim={start:performance.now(),elapsed:0,from:state.flag.angle,to:plan.angle,fall:plan.fall,dir:plan.direction};state.flag.direction=plan.direction;updateUI();
}
function complete(ko){
 const actor=state.player,taken=harvest,environmentFall=anim?.environment;if(environmentFall){state.result={winner:null,reason:'environment'};}else E.endTurn(state,taken,ko);
 if(!save()){if(checkpoint){state=E.decode(checkpoint);dirty=true;setScene();toast('저장 실패로 행동 전 상태를 복구했습니다.');}else toast('저장하지 못했습니다. 저장 공간을 확인해 주세요.');}
 else{toast(ko?'플레이어 '+(actor+1)+'이 깃발을 쓰러뜨렸습니다.':E.harvestGrams(state,taken).toFixed(6).replace(/0+$/,'').replace(/\.$/,'')+' g 수확 완료');audio.effect(ko?'fall':'turn');}
 harvest=0;checkpoint='';anim=null;phase='observe';updateUI();if(state.result)showResult();
}
function finishWeight(){const before=E.encode(state);state.result=E.weightResult(state);if(save()){updateUI();showResult();}else{state=E.decode(before);toast('결과를 저장하지 못했습니다. 저장 공간을 확인해 주세요.');}}
function pass(){if(phase!=='observe'||state.result||storageBlocked)return;checkpoint=E.encode(state);harvest=0;complete(false);}
function showResult(){
 $('resultTitle').textContent=state.result.winner===null?'사이좋은 무승부':'플레이어 '+(state.result.winner+1)+' 승리!';
 $('resultReason').textContent=state.result.reason==='environment'?'환경 변화로 깃발이 쓰러져 무승부입니다.':state.result.reason==='ko'?'깃발이 모래 또는 바닥에 닿아 쓰러졌습니다. 마지막 행동자가 패배합니다.':'마지막 라운드를 마쳤습니다. 수확 무게가 같으면 무승부입니다.';
 $('resultScores').textContent='플레이어 1  '+E.grams(state,state.scores[0]).toFixed(6).replace(/0+$/,'').replace(/\.$/,'')+' g  /  플레이어 2  '+E.grams(state,state.scores[1]).toFixed(6).replace(/0+$/,'').replace(/\.$/,'')+' g';
 if(!$('result').open)$('result').showModal();
}
function newGame(seed,duration,turnDuration,stage='random',options={}){
 const next=E.create(seed,duration,turnDuration,{...options,variant:nonce(),stage,previousDesign:state.flag.design}),old=state,wasBlocked=storageBlocked;
 state=next;storageBlocked=false;if(!save()){state=old;storageBlocked=wasBlocked;throw Error('새 경기를 저장하지 못해 기존 경기를 유지했습니다.');}
 phase='observe';harvest=0;anim=null;particles=[];hover=null;drag=null;environmentTick=0;pointers.clear();resetView();setScene();updateUI();toast(currentStage.name+' · 새 깃발로 시작합니다.');
}
function resetView(){yaw=-.72;pitch=.57;zoom=1;dirty=true;}
function cancelGesture(message){if(phase==='dig'&&checkpoint){state=E.decode(checkpoint);checkpoint='';harvest=0;particles=[];phase='observe';dirty=true;if(message)toast(message);}drag=null;pointers.clear();updateUI();}
function coords(e){const r=canvas.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top];}
canvas.addEventListener('contextmenu',e=>e.preventDefault());
// Mouse chord changes do not always dispatch another pointerdown/pointerup.
canvas.addEventListener('mousedown',e=>{if(e.button===2&&phase==='dig'&&drag?.mode==='dig'){drag.rotating=true;updateCursor();}});
canvas.addEventListener('mouseup',e=>{if(phase!=='dig'||drag?.mode!=='dig')return;if(e.button===0)finish();else if(e.button===2){drag.rotating=false;nextDig=performance.now()+E.TOOLS[tool].interval;updateCursor();}});
canvas.addEventListener('pointerdown',e=>{
 if(e.pointerType!=='touch'&&e.button!==0&&e.button!==2)return;
 if(document.querySelector('dialog[open]')||phase==='settle'||state.result)return;
 audio.unlock();const[x,y]=coords(e);
 if(e.pointerType==='touch'&&pointers.size===1){const old=[...pointers.entries()][0];cancelGesture('두 손가락으로 시점을 조작합니다.');pointers.set(old[0],old[1]);pointers.set(e.pointerId,{x,y});canvas.setPointerCapture(e.pointerId);drag={mode:'pinch'};updateUI();return;}
 if(pointers.size||drag)return;
 pointers.set(e.pointerId,{x,y});canvas.setPointerCapture(e.pointerId);
 if(e.button===2){drag={mode:'rotate',x,y,id:e.pointerId};updateUI();return;}
 if(storageBlocked){pointers.clear();toast('저장을 복구할 수 없습니다. 새 경기에서 시작하세요.');return;}
 // Left button has one meaning even over empty space: keep the tool armed until release.
 checkpoint=E.encode(state);phase='dig';harvest=0;drag={mode:'dig',x,y,id:e.pointerId};nextDig=performance.now()+E.TOOLS[tool].interval;take(x,y);updateUI();
});
canvas.addEventListener('pointermove',e=>{
 const[x,y]=coords(e),old=pointers.get(e.pointerId);
 if(e.pointerType==='mouse'&&e.buttons!==undefined){
  if(drag?.mode==='dig'&&!(e.buttons&1)){finish();return;}
  if(drag?.mode==='rotate'&&!(e.buttons&2)){drag=null;pointers.clear();updateUI();return;}
  if(drag?.mode==='dig'){
   if(e.buttons&2){yaw+=(x-drag.x)*.007;pitch=Math.max(.25,Math.min(1.12,pitch+(y-drag.y)*.004));dirty=true;drag.rotating=true;}
   else if(drag.rotating){drag.rotating=false;nextDig=performance.now()+E.TOOLS[tool].interval;}
   updateCursor();
  }
 }
 if(old&&drag?.mode==='pinch'&&pointers.size===2){
  const other=[...pointers.entries()].find(([id])=>id!==e.pointerId)[1],a=Math.hypot(old.x-other.x,old.y-other.y),b=Math.hypot(x-other.x,y-other.y);
  if(a>5)zoom=Math.max(.6,Math.min(3.5,zoom*b/a));yaw+=(x-old.x)*.005;pitch=Math.max(.25,Math.min(1.12,pitch+(y-old.y)*.003));pointers.set(e.pointerId,{x,y});dirty=true;return;
 }
 if(old)pointers.set(e.pointerId,{x,y});
 if(drag?.mode==='rotate'&&drag.id===e.pointerId){yaw+=(x-drag.x)*.007;pitch=Math.max(.25,Math.min(1.12,pitch+(y-drag.y)*.004));drag.x=x;drag.y=y;dirty=true;}
 else if(drag?.mode==='dig'&&drag.id===e.pointerId){drag.x=x;drag.y=y;hover=hit(x,y);}
 else if(!drag&&phase==='observe')hover=hit(x,y);
});
function release(e){
 if(!pointers.has(e.pointerId))return;
 // Chorded mouse buttons share a pointer ID; releasing right must not end a left dig.
 if(e.pointerType!=='touch'&&drag?.mode==='dig'&&e.button!==0){drag.rotating=false;nextDig=performance.now()+E.TOOLS[tool].interval;return;}
 if(e.pointerType!=='touch'&&drag?.mode==='rotate'&&e.button!==2)return;
 pointers.delete(e.pointerId);
 if(drag?.mode==='dig')finish();else if(drag?.mode==='pinch'){drag={mode:'pinch-wait'};if(!pointers.size)drag=null;}else drag=null;
 updateUI();
}
canvas.addEventListener('pointerup',release);
canvas.addEventListener('pointercancel',()=>cancelGesture('중단된 조작은 수확에 반영하지 않았습니다.'));
canvas.addEventListener('lostpointercapture',e=>{if(pointers.has(e.pointerId))cancelGesture('조작이 중단되어 행동 전으로 돌아왔습니다.');});
canvas.addEventListener('pointerleave',()=>{if(!drag)hover=null;});
canvas.addEventListener('wheel',e=>{e.preventDefault();if(phase==='dig')return;zoom=Math.max(.6,Math.min(3.5,zoom*Math.exp(-e.deltaY*.001)));dirty=true;},{passive:false});
canvas.addEventListener('keydown',e=>{
 if(phase==='dig'||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(e.key))return;e.preventDefault();
 if(e.key==='ArrowLeft')yaw-=.15;if(e.key==='ArrowRight')yaw+=.15;if(e.key==='ArrowUp')pitch=Math.min(1.12,pitch+.1);if(e.key==='ArrowDown')pitch=Math.max(.25,pitch-.1);if(e.key==='+')zoom=Math.min(3.5,zoom*1.1);if(e.key==='-')zoom=Math.max(.6,zoom/1.1);dirty=true;
});
for(const b of document.querySelectorAll('[data-tool]')){
 const id=b.dataset.tool,sprite=W.toolSprite(id),img=b.querySelector('img');img.src=sprite.toDataURL();cursors[id]='url("'+sprite.toDataURL()+'") 8 8, crosshair';
 b.onclick=()=>{if(phase!=='observe'||drag||state.result)return;tool=id;updateUI();};
}
for(const mat of E.MATERIALS){const option=document.createElement('option');option.value=mat.id;option.textContent=mat.name;$('sedimentSelect').appendChild(option);}
for(const stage of C.STAGES){const option=document.createElement('option');option.value=stage.id;option.textContent=stage.name;$('stageSelect').appendChild(option);}
$('pass').onclick=pass;$('cut').onclick=()=>{if(phase!=='observe'||drag)return;cut=!cut;$('cut').setAttribute('aria-pressed',cut);dirty=true;};
$('zoomIn').onclick=()=>{if(phase==='dig')return;zoom=Math.min(3.5,zoom*1.2);dirty=true;};$('zoomOut').onclick=()=>{if(phase==='dig')return;zoom=Math.max(.6,zoom/1.2);dirty=true;};$('resetView').onclick=()=>{if(phase!=='dig')resetView();};
function openSetup(){if(phase!=='observe'||drag)return;$('seedInput').value=state.seed;$('duration').value=state.duration;$('durationUnit').value='1';$('turnDuration').value=state.turnDuration;$('turnUnit').value='1';$('pilePercent').value=state.pilePercent||100;$('sedimentSelect').value=state.sediment||'sand';for(const key of ['time','season','weather'])$(key+'Select').value=state.environment?.[key]||({time:'cycle',season:'cycle',weather:'auto'})[key];$('setupError').textContent='';$('setup').showModal();}
$('settings').onclick=openSetup;$('resume').onclick=()=>$('setup').close();$('help').onclick=()=>{if(phase==='observe')$('helpDialog').showModal();};$('closeHelp').onclick=()=>$('helpDialog').close();
$('setupForm').onsubmit=e=>{e.preventDefault();try{newGame($('seedInput').value.trim(),E.seconds($('duration').value,$('durationUnit').value),E.seconds($('turnDuration').value,$('turnUnit').value),$('stageSelect').value,{pilePercent:Number($('pilePercent').value),sediment:$('sedimentSelect').value,time:$('timeSelect').value,season:$('seasonSelect').value,weather:$('weatherSelect').value});$('setup').close();}catch(err){console.error('Invalid new game',err);$('setupError').textContent=err.message;}};
$('randomSeed').onclick=()=>{$('seedInput').value='SAND-'+nonce().slice(0,8);};
$('replay').onclick=()=>{try{newGame(state.seed,state.duration,state.turnDuration,$('stageSelect').value||'random',{pilePercent:state.pilePercent||100,sediment:state.sediment||'sand',time:state.environment?.time||'cycle',season:state.environment?.season||'cycle',weather:state.environment?.weather||'auto'});$('result').close();}catch(e){toast(e.message);}};
$('newMatch').onclick=()=>{$('result').close();openSetup();};
$('music').onchange=()=>{audio.unlock();audio.setMusic($('music').checked);};$('sfx').onchange=()=>{audio.unlock();audio.fx=$('sfx').checked;};$('volume').oninput=()=>audio.setVolume(Number($('volume').value)/100);
document.addEventListener('pointerdown',()=>audio.unlock(),{once:true});
document.addEventListener('visibilitychange',()=>{paused=document.hidden;last=performance.now();if(paused){if(phase==='dig')cancelGesture('화면을 벗어나 미확정 채굴을 취소했습니다.');if(phase==='observe')save();audio.tick(false);}});
window.addEventListener('blur',()=>{if(phase==='dig')cancelGesture('조작이 중단되어 행동 전으로 돌아왔습니다.');});
window.addEventListener('pagehide',()=>{if(phase==='observe')save();audio.stop();});
function resize(){const r=canvas.getBoundingClientRect();w=r.width;h=r.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);raster.resize(w,h);ctx.setTransform(dpr,0,0,dpr,0,0);dirty=true;}
new ResizeObserver(resize).observe(canvas);
function frame(now){
 const dt=Math.min((now-last)/1000,.5);last=now;const modal=!!document.querySelector('dialog[open]'),active=!paused&&!modal&&!state.result;
 if(active){
  sceneTime+=dt;if(E.is3(state))state.environment.elapsed+=dt;
  if(state.duration&&!state.expired){state.remaining=Math.max(0,state.remaining-dt);if(state.remaining===0){state.expired=true;toast('경기 시간 종료 · 마지막 라운드를 마칩니다.');if(phase==='observe'&&state.turns[0]===state.turns[1])finishWeight();updateUI();}}
  if((phase==='observe'||phase==='dig')&&state.turnDuration&&!state.result){state.turnRemaining=Math.max(0,state.turnRemaining-dt);if(state.turnRemaining<=0){if(phase==='dig')finish();else{drag=null;pointers.clear();pass();}}}
  if(phase==='dig'&&drag?.mode==='dig'&&!drag.rotating){let pulses=0;while(now>=nextDig&&pulses<8){take(drag.x,drag.y);nextDig+=E.TOOLS[tool].interval;pulses++;}if(pulses===8&&now>=nextDig)nextDig=now+E.TOOLS[tool].interval;}
  if(E.is3(state)&&phase==='observe'&&!drag&&!state.result&&state.environment.elapsed-environmentTick>=2){environmentTick=state.environment.elapsed;const before=E.encode(state),m=E.settle(state,{disturbance:true});if(m.moved){dirty=true;const plan=E.flagPlan(state);if(plan.fall){checkpoint=before;phase='settle';anim={start:now,elapsed:0,from:state.flag.angle,to:plan.angle,fall:true,dir:plan.direction,environment:true};state.flag.direction=plan.direction;}else if(!save()){state=E.decode(before);toast('환경 변화를 저장하지 못해 이전 상태를 유지했습니다.');}updateUI();}}
  if(phase==='observe'&&!state.result&&now-timeSave>15000){save();timeSave=now;}
 }
 if(anim&&phase==='settle'&&!paused&&!modal){
  anim.elapsed+=dt;const t=Math.min(1,anim.elapsed/(anim.fall?1.7:.85));state.flag.angle=anim.from+(anim.to-anim.from)*(t*t*(3-2*t));
  if(anim.fall){state.flag.drop=Math.max(0,(t-.4)/.6)**2*(state.flag.root+.1);if(E.flagContact(state,state.flag.angle,anim.dir))complete(true);}else if(t===1)complete(false);
 }
 audio.tick(!paused&&!modal&&!state.result);if(now-lastUI>100){updateClock();lastUI=now;}
 if(now>toastUntil)$('toast').classList.remove('show');draw(now);requestAnimationFrame(frame);
}
const mc=document.modelContext,lifecycle=new AbortController();
if(mc?.registerTool){
 const registrations=[{name:'read_sand_match',description:'Read the current local match, selected tool and flag specifications.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>({player:state.player+1,scores:state.scores.map(v=>E.grams(state,v)),phase,tool,harvest:E.harvestGrams(state,harvest),stage:state.stage,flag:{...state.flag},camera:{yaw,pitch,zoom},support:E.support(state).ratio,result:state.result})},
 {name:'select_sand_tool',description:'Choose the next tool through the same action as the game controls.',inputSchema:{type:'object',properties:{tool:{type:'string',enum:Object.keys(E.TOOLS)}},required:['tool'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:input=>{if(!input||!Object.hasOwn(E.TOOLS,input.tool)||Object.keys(input).some(k=>k!=='tool'))throw Error('Invalid tool');if(phase!=='observe'||drag||state.result)throw Error('Tool is locked during an action');tool=input.tool;updateUI();return{tool};}}];
 for(const t of registrations)try{Promise.resolve(mc.registerTool(t,{signal:lifecycle.signal})).catch(e=>console.warn('WebMCP registration failed',e));}catch(e){console.warn('WebMCP unavailable',e);}
 window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
load();setScene();audio.setMusic($('music').checked);audio.fx=$('sfx').checked;audio.setVolume(Number($('volume').value)/100);updateUI();resize();requestAnimationFrame(frame);if(state.result)showResult();
})();
