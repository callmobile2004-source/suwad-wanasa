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
assert.ok(sw.includes("suwad-wanasa-shell-v108"));
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
const mockRoot={
 hidden:true,dataset:{},innerHTML:"",attrs:{},handlers:{},
 addEventListener(type,fn){this.handlers[type]=fn},
 setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},
 contains(){return true}
};
const document={
 createElement(){return mockRoot},
 body:{appendChild(){},classList:{add(){},remove(){},toggle(){}}},
 addEventListener(){},querySelector(){return null},querySelectorAll(){return []},
 documentElement:{dataset:{}}
};
const localStorage={
 getItem(k){return memory.has(k)?memory.get(k):null},
 setItem(k,v){memory.set(k,String(v))},
 removeItem(k){memory.delete(k)}
};
const window={matchMedia(){return {matches:false}}};
class MockFormData{constructor(form){this.values=form.values||{}}get(key){return this.values[key]??null}}
vm.runInNewContext(source,{
 window,document,localStorage,console,Math,Date,URL,Blob,FormData:MockFormData,
 setInterval(){return 1},clearInterval(){},navigator:{},MediaRecorder:undefined
});
const api=window.SuwadWorldGames;
function click(action,data={}){
 const button={dataset:{wgAction:action,...data}};
 const event={target:{closest(selector){return selector==='[data-wg-action]'?button:null}}};
 assert.equal(typeof mockRoot.handlers.click,"function","World click handler was not attached");
 mockRoot.handlers.click(event);
}
function submit(formName,values){
 const form={dataset:{wgForm:formName},values};
 const event={target:{closest(selector){return selector==='[data-wg-form]'?form:null}},preventDefault(){}};
 assert.equal(typeof mockRoot.handlers.submit,"function","World submit handler was not attached");
 mockRoot.handlers.submit(event);
}
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
api.openModes("silent");
assert.ok(mockRoot.innerHTML.includes('data-mode="teams"'));
assert.ok(mockRoot.innerHTML.includes('data-mode="party"'));
assert.ok(!mockRoot.innerHTML.includes('data-mode="solo"'),"Silent must not show a solo mode");
click("hub");
api.openModes("ad");click("settings");
assert.ok(!mockRoot.innerHTML.includes('data-wg-setting="difficulty"'),"Ad must not show a non-functional difficulty control");
click("hub");
api.openModes("cipher");click("settings");
assert.ok(mockRoot.innerHTML.includes('data-wg-setting="difficulty"'),"Cipher must retain its real difficulty setting");
click("hub");

// Cipher: make a full four-slot attempt and verify the history is persisted.
api.start("cipher","solo");
for(const color of [0,1,2,3])click("cipher-color",{color:String(color)});
click("cipher-submit");
let cipherSave=JSON.parse(memory.get("sw_world_game_v1_cipher"));
assert.equal(cipherSave.guesses.length,1,"Cipher must accept and record a complete guess");

// Doodle: run through drawing, answer selection and result screen.
api.start("doodle","party");
assert.ok(mockRoot.innerHTML.includes("wg-secret-word"),"Doodle prompt should be hidden behind artist reveal");
assert.ok(!mockRoot.innerHTML.includes("تحدي الرسمة: <strong>"),"Doodle secret must not be displayed directly");
click("doodle-guess");
assert.ok(mockRoot.innerHTML.includes("wg-guess-choice"));
click("doodle-answer",{answer:"0"});
assert.ok(mockRoot.innerHTML.includes("أحسنتم!")||mockRoot.innerHTML.includes("مو هي!"),"Doodle must show a result after choosing an answer");

// Ad: validate empty text does not advance, then submit and rate an advert.
api.start("ad","party");
submit("ad",{pitch:"   "});
assert.ok(mockRoot.innerHTML.includes("سوّق هذا المنتج"),"Empty advert should not be accepted");
submit("ad",{pitch:"أحسن إعلان تجريبي يبيع الفكرة ويضحك اللمة."});
assert.ok(mockRoot.innerHTML.includes("إعلانك جاهز للعرض"),"Advert should move to review");
click("ad-rate",{rating:"4"});
assert.ok(mockRoot.innerHTML.includes("تقييم الجولة: 4/5"),"Advert rating must be saved and displayed");

// Dubbing: microphone absence must degrade safely rather than breaking the world.
api.start("dub","solo");
click("dub-record");
assert.ok(mockRoot.innerHTML.includes("أدِّ المشهد بطريقتك"),"Dubbing view must remain active when microphone is unavailable");

// Story: five contributions must complete the collaborative story.
api.start("story","party");
for(let i=1;i<=5;i++)submit("story",{line:"سطر الحكاية رقم "+i});
assert.ok(mockRoot.innerHTML.includes("اكتملت الحكاية"),"Story must finish after five contributions");
assert.equal(JSON.parse(memory.get("sw_world_game_v1_story")).lines.length,5);

// Invention: collect an idea, move to review, rate and display the result.
api.start("invention","party");
submit("invention",{idea:"اختراع يساعد اللمة على ترتيب الأشياء بسرعة."});
assert.ok(mockRoot.innerHTML.includes("عرض الاختراع"),"Invention must progress to review");
click("invent-rate",{rating:"5"});
assert.ok(mockRoot.innerHTML.includes("تقييم الاختراع: 5/5"),"Invention rating must appear");

// Charades: start timed play, score a correct guess and enforce 4–12 players.
api.start("silent","teams");
const silentSave=JSON.parse(memory.get("sw_world_game_v1_silent"));
assert.ok(silentSave.players.length>=4&&silentSave.players.length<=12,"Silent charades requires 4–12 players");
click("silent-start");
assert.ok(mockRoot.innerHTML.includes("خمنوها! + نقطة"),"Charades must enter timed-play state");
click("silent-correct");
assert.ok(mockRoot.innerHTML.includes("الفريق الأول")||mockRoot.innerHTML.includes("الفريق الثاني"));
assert.ok(JSON.parse(memory.get("sw_world_game_v1_silent")).scores.some(score=>score===1),"Correct charades answer must increment a team score");
api.close();
console.log("PASS: seven world game loops, real action and form dispatch, score/result transitions, settings/mode integrity, save/resume and player limits.");
