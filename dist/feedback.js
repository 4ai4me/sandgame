/* Render-only surface detail and animation: these functions never modify a match. */
(function(root){'use strict';
function surface(material){
 const size=48,data=new Uint8ClampedArray(size*size*4),seed=[...material.id].reduce((a,c)=>a+c.charCodeAt(0),0);
 const noise=(x,y)=>{let n=Math.imul(x+seed,374761393)^Math.imul(y+17,668265263);n=Math.imul(n^(n>>>13),1274126177);return(n>>>0)/4294967296;};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  let detail=(noise(x,y)-.5)*(material.id.includes('fine')?22:34);
  if(material.id==='gravel'){const cx=x%12-6,cy=y%12-6,r=Math.hypot(cx,cy);detail=r>5?-45:16-r*4+(cx-cy)*2;}
  if(material.id.includes('clay'))detail=Math.sin(x*.12+Math.sin(y*.18))*8+(noise(x,y)-.5)*9+(material.id.startsWith('wet')?Math.max(0,Math.sin((x+y)*.1))**12*28:0);
  if(material.id==='loam')detail+=(noise(Math.floor(x/5),Math.floor(y/5))-.5)*24;
  for(let c=0;c<3;c++)data[(x+y*size)*4+c]=Math.max(0,Math.min(255,material.color[c]+detail));data[(x+y*size)*4+3]=255;
 }
 return{width:size,height:size,data};
}
function flagPoint(flag,env,seconds,u,v,reduced=false){
 const a=flag.angle,d=flag.direction,axis=[Math.cos(d)*Math.sin(a),Math.cos(a),Math.sin(d)*Math.sin(a)],wind=[Math.cos(env.windDirection),0,Math.sin(env.windDirection)];
 const dot=wind.reduce((n,x,i)=>n+x*axis[i],0);let side=wind.map((x,i)=>x-dot*axis[i]),length=Math.hypot(...side);
 if(length<.05){side=[-Math.sin(d),0,Math.cos(d)];length=1;}side=side.map(x=>x/length);
 const normal=[axis[1]*side[2]-axis[2]*side[1],axis[2]*side[0]-axis[0]*side[2],axis[0]*side[1]-axis[1]*side[0]],strength=env.windStrength;
 const wave=reduced?0:u*(.025+strength*.48)*Math.sin(seconds*(2+strength*7)-u*7+v*2+flag.angle*2),spread=3.35*u*(.45+.55*strength),sag=u*u*(.7*(1-strength)+Math.sin(a)*.2);
 return[flag.x,flag.root-(flag.drop||0),flag.z].map((x,i)=>x+axis[i]*(flag.length-v*2.5)+side[i]*spread+normal[i]*wave-(i===1?sag:0));
}
function pose(tool,t){
 const p=Math.sin(Math.min(1,Math.max(0,t))*Math.PI*2),dig=Math.sin(Math.min(1,Math.max(0,t))*Math.PI);
 switch(tool){
 case'broom':return{x:p*22,y:dig*4,rotation:p*.4,scale:1};
 case'finger':return{x:0,y:dig*8,rotation:-dig*.6,scale:1};
 case'hand':return{x:dig*-13,y:dig*15,rotation:dig*.55,scale:1};
 case'bothhands':return{x:0,y:dig*16,rotation:0,scale:1-dig*.12};
 case'needle':return{x:dig*-4,y:dig*10,rotation:-.2,scale:1};
 default:return{x:dig*-7,y:dig*12,rotation:dig*.2,scale:1};
 }
}
function drawTool(ctx,sprite,tool,x,y,t,reduced=false){
 const p=reduced?{x:0,y:0,rotation:0,scale:1}:pose(tool,t);ctx.save();ctx.translate(x+p.x,y+p.y);ctx.rotate(p.rotation);ctx.scale(p.scale,p.scale);
 if(tool==='finger'){
  const bend=reduced?0:Math.sin(t*Math.PI)*17;ctx.strokeStyle='#654c39';ctx.lineWidth=17;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(23,29);ctx.lineTo(13,8);ctx.lineTo(-3+bend,-12);ctx.stroke();ctx.strokeStyle='#e4b58e';ctx.lineWidth=13;ctx.stroke();ctx.fillStyle='#f2d2b0';ctx.beginPath();ctx.ellipse(-3+bend,-12,5,3,.4,0,Math.PI*2);ctx.fill();
 }else ctx.drawImage(sprite,-8,-8,64,64);
 ctx.restore();
}
const api={surface,flagPoint,pose,drawTool};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SandFeedback=api;
})(globalThis);
