/* DOM/canvas adapter executes real game controllers. It is not visual browser QA. */
const fs=require('node:fs'),vm=require('node:vm'),E=require('./dist/engine'),C=require('./dist/content');
module.exports=function app(saved,failWrites=false,legacy=false,viewport={width:900,height:700}){
 let now=0,raf,storage=new Map(),registered=[],events={},windowEvents={},canvasCount=0;
 if(saved)storage.set(legacy?'sand-digger.save.v1':'sand-digger.save.v2',saved);
 const elems={};const finite=(...args)=>{for(const arg of args)if(typeof arg==='number'&&!Number.isFinite(arg))throw Error('Non-finite drawing coordinate');};
 const cx=new Proxy({createImageData:(w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}),getImageData:(x,y,w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4).fill(255)}),createLinearGradient:()=>({addColorStop(){}}),drawImage(image,...rest){if(!image)throw Error('Missing image');finite(...rest);}}, {get:(t,p)=>p in t?t[p]:finite,set:(t,p,v)=>(t[p]=v,true)});
 function el(id){return elems[id]??={id,style:{},dataset:{},value:id==='volume'?'30':id==='stageSelect'?'random':id.endsWith('Unit')?'1':'',checked:['sfx','music','motion'].includes(id),open:false,textContent:'',src:'',children:[],classList:{add(){},remove(){},toggle(){}},listeners:{},attributes:{},
  setAttribute(k,v){this.attributes[k]=v;},appendChild(v){this.children.push(v);},querySelector(){return el(id+'-img');},addEventListener(type,fn){this.listeners[type]=fn;},getBoundingClientRect:()=>({left:0,top:0,...viewport}),getContext:()=>cx,toDataURL:()=>('data:image/png;base64,adapter-'+id),setPointerCapture(){},showModal(){this.open=true;},close(){this.open=false;}};}
 const buttons=Object.keys(E.TOOLS).map(t=>{const b=el(t);b.dataset.tool=t;return b;});
 const doc={hidden:false,getElementById:el,createElement:type=>el(type+'-'+(++canvasCount)),querySelectorAll:()=>buttons,querySelector:()=>Object.values(elems).find(e=>e.open),addEventListener:(k,f)=>events[k]=f,modelContext:{registerTool:t=>registered.push(t)}};
 const box={SandEngine:E,SandContent:C,document:doc,performance:{now:()=>now},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>{if(failWrites)throw Error('Disk full');storage.set(k,v);}},console:{log(){},warn(){},error(){},debug(){}},window:{addEventListener:(k,f)=>windowEvents[k]=f},ResizeObserver:class{constructor(f){this.f=f;}observe(){this.f();}},devicePixelRatio:1,requestAnimationFrame:f=>raf=f,setTimeout:()=>{},AbortController,Math,Uint8Array,crypto:{randomUUID:()=>('variant-'+canvasCount+'-'+now)}};
 vm.createContext(box);for(const file of['world.js','audio.js','renderer.js','feedback.js','game.js'])vm.runInContext(fs.readFileSync(__dirname+'/dist/'+file,'utf8'),box);
 return{el,storage,registered,box,doc,buttons,events,windowEvents,
  read(){return registered.find(t=>t.name==='read_sand_match').execute();},
  choose(tool){return registered.find(t=>t.name==='select_sand_tool').execute({tool});},
  frame(ms=17){now+=ms;raf(now);},advance(ms,step=20){for(let i=0;i<ms;i+=step){now+=Math.min(step,ms-i);raf(now);}},
  pointer(type,x=450,y=350,extra={}){el('game').listeners[type]({clientX:x,clientY:y,pointerId:1,button:0,pointerType:'mouse',...extra});},
  get(){return E.decode(storage.get('sand-digger.save.v3')||storage.get('sand-digger.save.v2')||storage.get('sand-digger.save.v1'));},
  submit({duration='77',turn='13',stage='random',seed='test-setting',unit='1',turnUnit='1',pilePercent=100,sediment='sand',time='cycle',season='cycle',weather='auto',materialPhysics=true}={}){el('materialPhysics').checked=materialPhysics;el('duration').value=duration;el('durationUnit').value=unit;el('turnDuration').value=turn;el('turnUnit').value=turnUnit;el('stageSelect').value=stage;el('seedInput').value=seed;el('pilePercent').value=String(pilePercent);el('sedimentSelect').value=sediment;el('timeSelect').value=time;el('seasonSelect').value=season;el('weatherSelect').value=weather;el('setupForm').onsubmit({preventDefault(){}});}
 };
};
