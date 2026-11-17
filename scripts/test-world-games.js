const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const index=read("index.html"),sw=read("sw.js"),menu=read("game-menu.js"),source=read("world-games.js"),css=read("world-games.css");
const expected=["cipher","doodle","ad","dub","story","invention","silent"];
const expectedModes={cipher:["solo","party"],doodle:["solo","party"],ad:["solo","party"],dub:["solo","party"],story:["solo","party"],invention:["solo","party"],silent:["party","teams"]};
for(const key of expected){
 assert.ok(source.includes(key+":{name:"),"Missing world definition: "+key);
 assert.ok(menu.includes(key+":{name:"),"Legacy launcher missing "+key);
 assert.ok(fs.existsSync(path.join(root,"assets/world-games",key+".svg")),"Missing world artwork: "+key);
 assert.match(read("assets/world-games/"+key+".svg"),/<svg[^>]+viewBox=/,"World art must be local SVG: "+key);
}
assert.ok(index.includes("world-games.css?v=20261117-02"));
assert.ok(index.includes("world-games.js?v=20261117-02"));
assert.ok(sw.includes('"./world-games.css"')&&sw.includes('"./world-games.js"'));
for(const key of expected)assert.ok(sw.includes('"./assets/world-games/'+key+'.svg"'),"Offline cache misses "+key);
for(const token of ["data-wg-theme","prefers-reduced-motion","@keyframes wg-float","touch-action:none","focus-visible","wg-secret-word"])assert.ok(css.includes(token),"Missing mobile or accessibility rule "+token);
assert.ok(source.includes("sw_wanasa_theme_v1"));
assert.ok(menu.includes("SuwadWorldGames?.isGame(game)")&&menu.includes('kind==="world"'));
assert.ok(source.includes("navigator.mediaDevices?.getUserMedia")&&source.includes("URL.createObjectURL"));
assert.ok(source.includes("function cipherCheck")&&source.includes("function drawSavedStrokes"));
assert.ok(source.includes("deadlineAt=Date.now()+45000")&&source.includes("localStorage.setItem(PREFIX+state.game"));
assert.ok(source.includes("const modeButtons=d.modes.map"),"Hub must render only registered modes");
assert.ok(source.includes('game==="cipher"'),"Difficulty must only appear where implemented");
assert.ok(source.includes("slice(0,12)")&&source.includes("while(arr.length<4)"),"Player limits for charades are incomplete");
for(const key of ["ad","story","invention"]){const definition=source.split("\n").find(line=>line.trim().startsWith(key+":{"));assert.ok(definition&&!definition.includes('modes:["solo","party","teams"]'),"Fake team mode remains in "+key);}
const memory=new Map();
const mockRoot={hidden:true,dataset:{},innerHTML:"",attrs:{},addEventListener(){},setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]}};
const document={createElement(){return mockRoot},body:{appendChild(){},classList:{add(){},remove(){},toggle(){}}},addEventListener(){},querySelector(){return null},querySelectorAll(){return []},documentElement:{dataset:{}}};
const localStorage={getItem(k){return memory.has(k)?memory.get(k):null},setItem(k,v){memory.set(k,String(v))},removeItem(k){memory.delete(k)}};
const window={matchMedia(){return {matches:false}}};
vm.runInNewContext(source,{window,document,localStorage,console,Math,Date,URL,Blob,FormData:function(){},setInterval,clearInterval,navigator:{},MediaRecorder:undefined});
const api=window.SuwadWorldGames;
assert.deepEqual(Array.from(api.games),expected);
for(const key of expected){
 assert.equal(api.isGame(key),true);
 assert.deepEqual(Array.from(api.getModes(key)),expectedModes[key],"Mode registry mismatch: "+key);
 for(const mode of expectedModes[key]){
  assert.equal(api.start(key,mode),true,"Could not start "+key+" "+mode);
  assert.equal(api.hasSaved(key),true,"Missing save "+key);
  const saved=JSON.parse(memory.get("sw_world_game_v1_"+key));
  assert.equal(saved.game,key);assert.equal(saved.mode,mode);
  assert.equal(api.resume(key),true,"Could not resume "+key);
  assert.equal(api.clearSaved(key),true);assert.equal(api.hasSaved(key),false);
 }
}
assert.equal(api.isGame("unsupported"),false);
assert.equal(api.start("silent","solo"),false,"Silent must reject unsupported solo mode");
assert.equal(api.start("ad","teams"),false,"Ad must reject unsupported teams mode");
assert.equal(api.start("cipher","training"),true,"Training must remain available");
assert.ok(mockRoot.innerHTML.includes("اكسر الرمز المخفي"));
api.clearSaved("cipher");
assert.equal(api.start("doodle","party"),true);
assert.ok(mockRoot.innerHTML.includes("wg-secret-word"),"Doodle prompt should be hidden behind artist reveal");
assert.ok(!mockRoot.innerHTML.includes("تحدي الرسمة: <strong>"),"Doodle secret must not be displayed directly");
assert.equal(api.start("silent","teams"),true);
const silentSave=JSON.parse(memory.get("sw_world_game_v1_silent"));
assert.ok(silentSave.players.length>=4&&silentSave.players.length<=12,"Silent charades requires 4–12 players");
console.log("PASS: all seven worlds, registered modes, player limits, start/save/resume, training, hidden drawing prompt and offline art.");
