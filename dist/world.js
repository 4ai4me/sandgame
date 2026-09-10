/* Low-poly scene geometry and canvas sprites. All assets stay local/offline. */
(function(root){'use strict';
const C=root.SandContent;
const shade=(color,k)=>{const n=parseInt(color.slice(1),16);return 'rgb('+[n>>16,(n>>8)&255,n&255].map(v=>Math.round(v*k)).join(',')+')';};
function build(stage){
 const boxes=[];
 const box=(x,y,z,w,h,d,color)=>boxes.push({x:x+12.5,y,z:z+12.5,w,h,d,color});
 const tree=(x,z,palm=false)=>{
  box(x,0,z,1.2,8,1.2,'#846442');
  if(palm){box(x-5,7,z,11,.8,2,'#5d9865');box(x,7.7,z-5,2,.8,11,'#75ad71');box(x-2,8.1,z-2,5,1,5,'#75a568');}
  else{box(x-2.5,6,z-2.5,6,4,6,'#648363');box(x-1.5,9,z-1.5,4,2.5,4,'#769365');}
 };
 const bench=(x,z)=>{box(x,1,z,7,.7,2.5,'#a78057');for(const a of[.5,5.8])box(x+a,0,z+.5,.6,2,.6,'#6c6957');box(x,2.4,z+2,7,.7,.6,'#a78057');};
 const barrel=(x,z)=>{box(x,0,z,2.5,3,2.5,'#9c7450');box(x-.05,.5,z-.05,2.6,.25,2.6,'#5b635d');box(x-.05,2.3,z-.05,2.6,.25,2.6,'#5b635d');};
 const fence=(z,color)=>{for(let x=-27;x<29;x+=4)box(x,0,z,.6,3,.6,color);box(-27,1.1,z,56,.45,.45,color);box(-27,2.4,z,56,.45,.45,color);};
 const rock=(x,z,size=3)=>{box(x,0,z,size,size*.7,size,'#8d9590');box(x+.4,size*.65,z+.5,size*.65,size*.3,size*.7,'#a6ada3');};
 const colors=['#d77352','#e9c86b','#6f9b9e','#96ad74'];
 box(-45,-2.4,-45,90,1.3,90,stage.ground);
 switch(stage.id){
 case 'beach':
  box(-45,-1.3,-45,90,.2,25,stage.water);
  for(let i=0;i<5;i++)box(-40+i*17,-1.02,-23-i%2*2,10,.07,.45,'#d0e9df');
  tree(-23,-12,true);tree(24,-24,true);
  for(const [x,z,col]of[[-25,8,'#e4a75e'],[20,-8,'#609bb0']]){box(x,0,z,.45,5,.45,'#886b4c');box(x-3,5,z-3,6,.5,6,col);box(x-2.5,.05,z+2,5,.1,4,'#faf0d0');}
  break;
 case 'playground':
  fence(-25,'#c59f73');tree(26,-19);bench(-26,15);
  for(const x of[-24,-16])box(x,0,-15,.55,10,.55,'#be644a');box(-24,10,-15,9,.6,.6,'#eac469');
  for(const x of[-22,-19]){box(x,3,-15,.1,7,.1,'#646c69');box(x-.5,3,-15.5,2,.35,2,'#6c9dba');}
  box(18,0,-15,5,6,5,'#d5ae64');box(17.5,6,-15.5,6,.6,6,'#6b9caf');
  for(let i=0;i<7;i++)box(18,5.6-i*.75,-9+i*1.2,4,.5,1.5,'#dd795a');break;
 case 'ssireum':
  for(let row=0;row<3;row++){box(-29,row*1.8,-30+row*3,58,1.8,3,'#8f8271');for(let x=-26;x<29;x+=4){box(x,row*1.8+1.8,-29+row*3,1.2,1.5,1.1,colors[(x+row+28)%4]);box(x,row*1.8+3.3,-29+row*3,.9,.9,.9,'#d4b294');}}
  for(const x of[-25,25])box(x,0,-17,.6,13,.6,'#8a6350');box(-26,12.5,-19,53,.7,5,'#cf7553');
  for(let i=0;i<12;i++)box(-25+i*4.4,11.7,-16.5,2,.8,.15,colors[i%4]);break;
 case 'ocean-ship':case 'river-boat':
  box(-19,-1.6,-28,38,2.2,56,'#6b594b');
  for(let x=-18;x<19;x+=3)box(x,.65,-27,2.85,.2,54,'#ba9363');
  for(const x of[-18.5,18.5]){for(let z=-26;z<28;z+=5)box(x,.8,z,.4,2.8,.4,'#776249');box(x,3.2,-27,.4,.4,54,'#dbbc85');}
  fence(-26,'#9b7b56');box(-6,.8,-25,12,5,7,'#e6d6aa');box(-6.5,5.8,-25.5,13,.6,8,'#506f79');
  box(-3,2.8,-17.8,6,1.6,.2,'#799fa6');barrel(-16,20);barrel(14,-21);
  if(stage.id==='ocean-ship'){box(9,.8,-22,.7,17,.7,'#9a704b');box(9.7,10,-22,.12,7,7,'#f5ecd2');}
  else{box(-44,-1.3,-45,16,.3,90,'#89a478');box(31,-1.3,-45,16,.3,90,'#89a478');for(let z=-33;z<35;z+=17){tree(-34,z);tree(35,z+4);}}break;
 case 'desert':
  for(let i=0;i<7;i++)box(-30+i, i*1.8,-29+i,17-i*2,1.8,17-i*2,'#cfa571');
  for(const[x,z]of[[25,-19],[-25,16]]){box(x,0,z,2,9,2,'#77915b');box(x-3,4,z,4,1.5,1.5,'#77915b');box(x-3,4,z,1.5,3,1.5,'#89a466');}
  box(19,-1.2,16,14,.3,11,'#6da5a0');tree(27,16,true);break;
 case 'garden':
  for(const z of[-25,23])for(let x=-26;x<=24;x+=9){box(x,0,z,6,1.8,4,'#9b795b');box(x+.3,1.8,z+.3,5.4,.25,3.4,'#6a6247');for(let j=0;j<3;j++){box(x+1+j*1.5,2,z+1,1,1.5,1,'#6b9764');box(x+1+j*1.5,3.5,z+1,1,.8,1,colors[j]);}}
  for(const x of[-24,-16])box(x,0,-16,.4,11,.4,'#a2aaa0');box(-24,10.8,-17,9,.5,10,'#a6c6b4');box(-24,0,-16,9,.25,10,'#d2d7b9');tree(25,-14);break;
 case 'school':
  for(let i=0;i<3;i++){box(-33-i*2,-1.03,-30-i*2,66+i*4,.03,.25,'#efe4cf');box(-33-i*2,-1.03,30+i*2,66+i*4,.03,.25,'#efe4cf');}
  box(-24,0,-30,48,12,6,'#d9caa8');box(-24,12,-30,48,.7,6,'#9b7770');
  for(let x=-21;x<24;x+=5)for(const y of[2,7])box(x,y,-23.9,3,3,.1,'#91b9ba');
  for(const x of[-24,-17])box(x,0,0,.5,7,.5,'#66839a');box(-24,7,0,7.5,.5,.5,'#66839a');bench(19,12);break;
 case 'village':
  box(-26,0,-28,19,8,9,'#cbb292');for(let i=0;i<3;i++)box(-28+i,8+i,-30+i,23-i*2,1,13-i*2,'#657575');
  box(-20,0,-18.8,4,6,.15,'#785941');box(-25,3,-18.8,3,3,.15,'#e8d6b0');
  bench(17,-18);for(const [x,z]of[[24,12],[20,16],[24,18]]){box(x,0,z,3,3.8,3,'#816352');box(x-.2,3.8,z-.2,3.4,.4,3.4,'#544c41');}tree(-25,16);break;
 case 'quarry':
  for(let i=0;i<9;i++)rock(-30+i*7,-28+(i%3)*3,5+i%3);
  box(18,1,-16,10,3,5,'#dfb357');box(25,4,-16,3,3,5,'#e7c568');box(25.1,5,-16.1,2,1.4,.2,'#597987');
  for(const x of[20,26])for(const z of[-16.5,-11.5])box(x,.1,z,2,2,1,'#444c50');
  rock(-24,14,5);rock(22,19,4);break;
 case 'forest':
  for(const [x,z]of[[-26,-20],[-16,-29],[7,-30],[27,-21],[-28,10],[29,15]])tree(x,z);
  for(let i=0;i<5;i++)box(18+i*.65,i*.9,-8,9-i*1.3,.9,8,'#c58e58');
  for(const x of[-24,-18])box(x,.2,14,2,1.8,8,'#775940');rock(-18,18,2);break;
 case 'ruins':
  for(const[x,z]of[[-25,-21],[-15,-21],[17,-23],[27,-23]]){box(x-1,0,z-1,4,1,4,'#c3bba1');box(x,1,z,2,11,2,'#aaa891');box(x-1,12,z-1,4,1,4,'#d0c7aa');}
  box(-26,13,-22,14,1.5,4,'#b9b299');box(16,13,-24,14,1.5,4,'#b9b299');
  rock(-26,15,4);rock(21,17,4);box(-23,.3,21,9,1.5,3,'#c5bfa5');break;
 }
 return boxes;
}
function faces(boxes,project,view){
 const out=[],spec=[{n:[0,1,0],v:[[0,1,0],[0,1,1],[1,1,1],[1,1,0]],k:1.06},{n:[1,0,0],v:[[1,0,0],[1,1,0],[1,1,1],[1,0,1]],k:.84},{n:[-1,0,0],v:[[0,0,0],[0,0,1],[0,1,1],[0,1,0]],k:.73},{n:[0,0,1],v:[[0,0,1],[1,0,1],[1,1,1],[0,1,1]],k:.91},{n:[0,0,-1],v:[[0,0,0],[0,1,0],[1,1,0],[1,0,0]],k:.77}];
 spec.push({n:[0,-1,0],v:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]],k:.65});
 for(const b of boxes)for(const f of spec){if(f.n.reduce((a,v,i)=>a+v*view[i],0)<=0)continue;const poly=f.v.map(v=>project(b.x+v[0]*b.w,b.y+v[1]*b.h,b.z+v[2]*b.d));out.push({poly,d:project(b.x+b.w/2,b.y+b.h/2,b.z+b.d/2).d,color:shade(b.color,f.k)});}
 return out.sort((a,b)=>a.d-b.d);
}
function line(c,x,y,a,b,color,width=3){c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.beginPath();c.moveTo(x,y);c.lineTo(a,b);c.stroke();}
function circle(c,x,y,r,color){c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}
function skull(c,x,y,size=1){c.save();c.translate(x,y);c.scale(size,size);c.fillStyle='#f6edd7';c.beginPath();c.ellipse(0,-3,15,14,0,0,7);c.fill();c.fillRect(-10,7,20,12);circle(c,-6,-4,4.7,'#20212a');circle(c,6,-4,4.7,'#20212a');c.fillStyle='#20212a';c.fillRect(-2,3,4,4);for(const a of[-6,0,6])line(c,a,11,a,18,'#2d2b2c',1.5);c.restore();}
function bones(c){for(const side of[-1,1]){line(c,64-30,48-25*side,64+30,48+25*side,'#eee5d1',6);for(const p of[[34,48-25*side],[94,48+25*side]]){circle(c,p[0]-2,p[1],4,'#eee5d1');circle(c,p[0]+2,p[1],4,'#eee5d1');}}}
function flagTexture(id){
 const f=C.FLAGS.find(v=>v.id===id)||C.FLAGS[0],el=document.createElement('canvas');el.width=128;el.height=96;const c=el.getContext('2d');c.fillStyle=f.background;c.fillRect(0,0,128,96);
 if(id==='heart'){
  c.strokeStyle='#20212a';c.lineWidth=6;c.beginPath();c.arc(64,48,28,0,7);c.stroke();
  for(let i=0;i<8;i++){const a=i*Math.PI/4;line(c,64+Math.cos(a)*29,48+Math.sin(a)*29,64+Math.cos(a)*40,48+Math.sin(a)*40,'#20212a',6);}
  circle(c,54,39,4,'#20212a');circle(c,74,39,4,'#20212a');c.beginPath();c.arc(64,44,19,.1,Math.PI-.1);c.stroke();line(c,46,47,82,47,'#20212a',3);for(const x of[54,64,74])line(c,x,48,x,59,'#20212a',2);
 }else if(id==='sun'){
  c.strokeStyle=f.accent;c.lineWidth=9;c.beginPath();c.arc(64,48,20,0,7);c.stroke();
  for(let i=0;i<12;i++){const a=i*Math.PI/6;line(c,64+Math.cos(a)*29,48+Math.sin(a)*29,64+Math.cos(a+.14)*38,48+Math.sin(a+.14)*38,f.accent,5);}
 }else{
  bones(c);
  if(id==='blackbeard'){skull(c,42,51,.8);skull(c,86,51,.8);skull(c,64,35,.95);}else skull(c,64,46,1.25);
  if(id==='strawhat'){c.fillStyle='#e8bd57';c.beginPath();c.ellipse(64,26,22,14,0,Math.PI,Math.PI*2);c.fill();c.fillRect(42,22,44,7);c.fillStyle='#c34838';c.fillRect(42,26,44,5);c.fillStyle='#e8bd57';c.fillRect(30,31,68,5);}
  if(id==='redhair'){for(const x of[68,75,82])line(c,x,26,x-9,58,'#c74748',4);}
  if(id==='whitebeard'){c.strokeStyle='#f5ecd5';c.lineWidth=8;c.beginPath();c.moveTo(27,46);c.bezierCurveTo(37,76,91,76,101,46);c.stroke();}
  if(id==='roger'){c.fillStyle='#a74440';c.beginPath();c.moveTo(35,27);c.lineTo(43,13);c.lineTo(85,13);c.lineTo(95,27);c.closePath();c.fill();line(c,33,28,96,28,'#e4bd66',4);skull(c,64,18,.3);c.strokeStyle='#413125';c.lineWidth=5;c.beginPath();c.moveTo(35,54);c.bezierCurveTo(49,62,55,47,64,55);c.bezierCurveTo(73,47,80,62,93,54);c.stroke();}
  if(id==='buggy'){circle(c,34,36,9,'#5492c7');circle(c,94,36,9,'#5492c7');circle(c,64,49,7,'#db4940');c.fillStyle='#d54e45';c.fillRect(40,19,48,7);for(let x=42;x<89;x+=10)c.fillRect(x,9,5,10);}
 }
 return el;
}
function toolSprite(id){
 const el=document.createElement('canvas');el.width=64;el.height=64;const c=el.getContext('2d');
 const palm=(x,flip=false)=>{c.save();c.translate(x,8);if(flip){c.translate(25,0);c.scale(-1,1);}c.fillStyle='#eac097';c.strokeStyle='#8a674b';c.lineWidth=1.4;c.beginPath();c.roundRect(5,22,22,28,8);c.fill();c.stroke();for(let i=0;i<4;i++){c.beginPath();c.roundRect(5+i*5.5,4+Math.abs(i-1)*3,5,31,3);c.fill();c.stroke();}c.beginPath();c.roundRect(-1,26,9,18,4);c.fill();c.stroke();c.restore();};
 if(id==='broom'){line(c,14,14,48,52,'#73543a',6);c.fillStyle='#deb974';c.strokeStyle='#997641';c.beginPath();c.moveTo(8,5);c.lineTo(27,6);c.lineTo(19,26);c.lineTo(2,20);c.closePath();c.fill();c.stroke();for(let i=0;i<4;i++)line(c,6+i*4,9,4+i*4,20,'#b28a4c',1);line(c,9,22,23,15,'#bb654a',4);}
 else if(id==='needle'){line(c,8,8,47,50,'#435865',4);line(c,8,8,47,50,'#dce8ed',2);c.strokeStyle='#566b74';c.lineWidth=2;c.beginPath();c.ellipse(48,51,2.4,5.3,-.73,0,7);c.stroke();}
 else if(id==='toothpick'){c.fillStyle='#edca89';c.strokeStyle='#96734d';c.beginPath();c.moveTo(8,8);c.lineTo(49,47);c.lineTo(52,53);c.lineTo(44,49);c.closePath();c.fill();c.stroke();}
 else if(id==='finger'){c.save();c.translate(3,1);c.rotate(-.4);c.fillStyle='#e8bc92';c.strokeStyle='#8c6649';c.lineWidth=1.3;c.beginPath();c.roundRect(5,9,12,41,6);c.fill();c.stroke();c.beginPath();c.roundRect(6,32,32,25,8);c.fill();c.stroke();c.fillStyle='#f5d9be';c.fillRect(9,12,5,8);c.restore();}
 else if(id==='bothhands'){c.save();c.scale(.72,.9);palm(1);palm(49,true);c.restore();}else palm(15);
 // Shared hotspot marker makes the contact point unambiguous for all tools.
 circle(c,8,8,3,'#fff9df');circle(c,8,8,1.5,'#345445');return el;
}
root.SandWorld={build,faces,flagTexture,toolSprite};
})(globalThis);
