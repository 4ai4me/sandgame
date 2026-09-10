const assert=require('node:assert/strict'),fs=require('node:fs'),zlib=require('node:zlib');
const E=require('./dist/engine'),C=require('./dist/content'),app=require('./test-ui.cjs');
let passed=0;function test(name,fn){fn();passed++;console.log('PASS',name);}
test('Custom time accepts seconds, fractional minutes, hours and unlimited',()=>{
 assert.equal(E.seconds('77',1),77);assert.equal(E.seconds('1.25',60),75);assert.equal(E.seconds('2.5',3600),9000);assert.equal(E.seconds('0',60),0);assert.equal(E.create('custom',12345,4567).turnDuration,4567);
 for(const v of['',-1,'NaN','1e99','12text',86401,.001])assert.throws(()=>E.seconds(v,1));
});
test('Six tools remove different volumes and depths',()=>{
 assert.equal(Object.keys(E.TOOLS).length,6);assert(!E.TOOLS.brush);const results={};
 for(const tool of Object.keys(E.TOOLS)){const s=E.create();s.grid.fill(1);results[tool]=E.carve(s,[12.5,12.5,12.5],[0,-1,0],tool,E.TOOLS[tool].batch);}
 assert.equal(results.needle,1);assert(results.bothhands>results.hand);assert(results.hand>results.toothpick);assert(results.broom>results.needle);
});
test('Thousands of new flags begin supported and include shallow/deep burial',()=>{
 const materials=new Set(),designs=new Set(),colors=new Set();let shallow=false,deep=false,minWidth=9,maxWidth=0;
 for(let i=0;i<1500;i++){const s=E.create('flag-'+i),f=s.flag;materials.add(f.material);designs.add(f.design);colors.add(f.color);shallow||=f.embed<1;deep||=f.root<1;minWidth=Math.min(minWidth,f.diameter);maxWidth=Math.max(maxWidth,f.diameter);assert(!E.flagPlan(s).fall);assert(!E.flagContact(s,f.angle,f.direction));assert.equal(E.encode(E.decode(E.encode(s))),E.encode(s));}
 assert.equal(materials.size,6);assert.equal(designs.size,8);assert(colors.size>6);assert(shallow&&deep);assert(maxWidth-minWidth>.4);
});
test('Same terrain seed with new variant changes pole but not terrain',()=>{
 const a=E.create('same',600,45,{variant:'a'}),b=E.create('same',600,45,{variant:'b',previousDesign:a.flag.design});assert.deepEqual(a.grid,b.grid);assert.notDeepEqual(a.flag,b.flag);assert.notEqual(a.flag.design,b.flag.design);
});
test('A stable shaft continues to contact its original burial axis',()=>{const s=E.create('axis');const a=E.flagPlan(s).rootContact;s.flag.direction+=.4;assert.equal(E.flagPlan(s).rootContact,a);});
test('Twelve locations have unique music arrangements and valid IDs',()=>{
 assert.equal(C.STAGES.length,12);assert.equal(C.TRACKS.length,12);assert.equal(new Set(C.TRACKS.map(t=>JSON.stringify(t.notes))).size,12);
 for(const stage of C.STAGES){assert(C.TRACKS.some(t=>t.id===stage.track));const s=E.create('stage',400,25,{stage:stage.id});assert.equal(s.stage,stage.id);assert.deepEqual(s.grid,E.create('stage').grid);}
 assert.throws(()=>E.create('s',600,45,{stage:'unknown'}));
});
const legacyRaw=zlib.gunzipSync(Buffer.from(fs.readFileSync(__dirname+'/fixtures/v1-save.base64','utf8').trim(),'base64')).toString('utf8');
test('Actual v1 snapshot migrates without changing terrain, scores or physical rules',()=>{
 const old=JSON.parse(legacyRaw),s=E.decode(legacyRaw);assert.equal(s.version,2);assert.equal(s.physics,'sand-voxel-1');assert.deepEqual(Array.from(s.grid),old.grid);assert.deepEqual(s.scores,old.scores);assert.deepEqual(s.turns,old.turns);assert.equal(s.player,old.player);assert.equal(s.flag.angle,old.flag.angle);assert.equal(s.flag.root,old.flag.root);assert.equal(s.stage,'beach');
});
test('Migration leaves original v1 bytes intact and writes only v2 save',()=>{const a=app(legacyRaw,false,true);a.frame(16000);assert.equal(a.storage.get('sand-digger.save.v1'),legacyRaw);assert(a.storage.has('sand-digger.save.v2'));assert.equal(a.get().version,2);});
test('Malformed v2 stage, dimensions and future schema fail before application',()=>{
 const raw=JSON.parse(E.encode(E.create()));for(const bad of[{...raw,version:99},{...raw,stage:'broken'},{...raw,flag:{...raw.flag,diameter:-2}},{...raw,flag:{...raw.flag,color:'url(javascript:bad)'}}])assert.throws(()=>E.decode(JSON.stringify(bad)));
});
test('Holding still repeatedly digs without releasing',()=>{
 const a=app();a.frame();a.pointer('pointerdown');const n=a.read().harvest;a.advance(1400);assert.equal(a.read().phase,'dig');assert(a.read().harvest>n);a.pointer('pointerup');a.advance(2500);assert.equal(a.read().phase,'observe');assert(a.get().scores[0]>0);
});
test('No previous 150-voxel cap ends a long held action',()=>{
 const a=app();a.choose('bothhands');a.pointer('pointerdown');for(const [x,y]of[[450,350],[400,400],[500,400],[450,440],[360,440],[540,440]]){a.pointer('pointermove',x,y);a.advance(800);}
 assert.equal(a.read().phase,'dig');assert(a.read().harvest>105);assert.equal(a.read().player,1);a.pointer('pointerup');a.advance(2500);assert.equal(a.read().phase,'observe');
});
test('Left drag over empty background never rotates the camera',()=>{const a=app(),before=a.read().camera;a.pointer('pointerdown',10,10);a.pointer('pointermove',100,80);a.advance(500);assert.deepEqual(a.read().camera,before);a.pointer('pointerup',100,80);assert.equal(a.read().player,1);assert.equal(a.read().harvest,0);});
test('Right drag rotates 3D and never harvests',()=>{const a=app(),before=a.read().camera;a.pointer('pointerdown',450,350,{button:2});a.pointer('pointermove',510,390,{button:2,buttons:2});a.advance(500);assert.notEqual(a.read().camera.yaw,before.yaw);assert.notEqual(a.read().camera.pitch,before.pitch);assert.equal(a.read().harvest,0);a.pointer('pointerup',510,390,{button:2});assert.equal(a.read().player,1);});
test('Middle mouse is ignored and tool selection changes the custom cursor',()=>{const a=app(),seen=new Set();a.pointer('pointerdown',450,350,{button:1});assert.equal(a.read().phase,'observe');for(const key of Object.keys(E.TOOLS)){a.choose(key);seen.add(a.el('game').style.cursor);assert(a.el('game').style.cursor.includes('data:image/png'));}assert.equal(seen.size,6);});
test('Releasing left during a mouse-button chord ends the dig',()=>{const a=app();a.pointer('pointerdown');a.pointer('pointermove',450,350,{buttons:3});a.advance(300);a.pointer('pointermove',450,350,{button:0,buttons:2});assert.equal(a.read().phase,'settle');a.advance(2500);assert.equal(a.read().phase,'observe');});
test('The configured turn deadline ends a held action',()=>{const a=app(E.encode(E.create('short',100,1)));a.pointer('pointerdown');a.advance(1100);assert.notEqual(a.read().phase,'dig');a.advance(2000);assert(a.get().turns[0]>=1);});
test('A settings submission preserves exact custom durations',()=>{const a=app();a.submit({duration:'1.25',unit:'60',turn:'17',stage:'ocean-ship'});assert.equal(a.get().duration,75);assert.equal(a.get().turnDuration,17);assert.equal(a.get().stage,'ocean-ship');});
test('Invalid settings show an error and do not replace a match',()=>{const a=app(E.encode(E.create())),before=a.get();a.submit({duration:'-3'});assert(a.el('setupError').textContent);assert.deepEqual(a.get(),before);});
test('Starting a new match changes the flag even with the same terrain seed',()=>{const a=app();a.submit({seed:'same'});const first=a.get();a.submit({seed:'same'});const second=a.get();assert.notEqual(first.flag.design,second.flag.design);assert.deepEqual(first.grid,second.grid);});
test('All 12 backgrounds and all flag textures render with finite coordinates',()=>{
 const a=app(),fingerprints=new Set();for(const stage of C.STAGES){a.submit({stage:stage.id});a.advance(100);assert.equal(a.el('stageName').textContent,stage.name);const boxes=a.box.SandWorld.build(stage);assert(boxes.length>5);fingerprints.add(JSON.stringify(boxes));}
 assert.equal(fingerprints.size,12);for(const f of C.FLAGS)assert(a.box.SandWorld.flagTexture(f.id));
});
test('Visual ship rocking does not change game physics or scores',()=>{
 const s=E.create('boat',600,45,{stage:'ocean-ship'}),a=app(E.encode(s));a.advance(2000);assert.deepEqual(a.get().grid,s.grid);assert.deepEqual(a.read().scores,[0,0]);a.el('motion').checked=false;a.frame();assert.deepEqual(a.get().grid,s.grid);
});
test('Two-finger transition cancels unconfirmed harvest, then rotates',()=>{
 const a=app();a.pointer('pointerdown',450,350,{pointerType:'touch'});a.advance(200);a.pointer('pointerdown',520,350,{pointerType:'touch',pointerId:2});assert.equal(a.read().phase,'observe');assert.equal(a.read().harvest,0);const y=a.read().camera.yaw;a.pointer('pointermove',540,390,{pointerType:'touch',pointerId:2});assert.notEqual(a.read().camera.yaw,y);a.pointer('pointerup',540,390,{pointerType:'touch',pointerId:2});a.pointer('pointerup',450,350,{pointerType:'touch'});assert.equal(a.read().player,1);
});
test('Visibility loss rolls back held input rather than committing partial work',()=>{const a=app(E.encode(E.create()));a.pointer('pointerdown');a.advance(300);a.doc.hidden=true;a.events.visibilitychange();assert.equal(a.read().phase,'observe');assert.equal(a.read().harvest,0);assert.deepEqual(a.get().scores,[0,0]);});
test('Stationary input has the same harvest at 20fps and 100fps',()=>{const s=E.encode(E.create()),a=app(s),b=app(s);for(const game of[a,b])game.pointer('pointerdown');a.advance(1000,50);b.advance(1000,10);assert.equal(a.read().harvest,b.read().harvest);});
test('Actual audio scheduler produces notes for every original arrangement',()=>{
 const Audio=require('./dist/audio');let notes=[];
 class MockContext{constructor(){this.state='running';this.currentTime=0;this.destination={};}createGain(){return{gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}createOscillator(){const o={frequency:{value:0},connect(){},disconnect(){},start(){notes.push(this.frequency.value);},stop(){},type:'sine'};return o;}}
 global.AudioContext=MockContext;
 try{const a=new Audio();assert(a.unlock());const patterns=new Set();for(const track of C.TRACKS){notes=[];a.setTrack(track.id);for(let i=0;i<20;i++){a.context.currentTime=i*.1;a.tick(true);}assert(notes.length>5);patterns.add(JSON.stringify(notes));}assert.equal(patterns.size,12);a.setMusic(false);const n=notes.length;a.context.currentTime+=1;a.tick(true);assert.equal(notes.length,n);a.stop();assert.equal(a.nodes.size,0);}finally{delete global.AudioContext;}
});
console.log('\n'+passed+' expansion tests passed. Browser visuals and audio listening are not covered by this adapter.');
