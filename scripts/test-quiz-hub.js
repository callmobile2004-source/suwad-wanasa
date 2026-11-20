const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const memory=new Map();
const localStorage={
 getItem(key){return memory.has(key)?memory.get(key):null},
 setItem(key,value){memory.set(key,String(value))},
 removeItem(key){memory.delete(key)}
};
const window={};
const document={readyState:"loading",addEventListener(){}};
const quietConsole={warn(){},error(){}};
const context={window,document,localStorage,console:quietConsole,Math,Date,Number,String,Array,Object,JSON,RegExp,Error,Set,Map,Uint32Array,crypto:{getRandomValues(array){array[0]=0x12345678;return array}},setTimeout,clearTimeout};

function read(relative){return fs.readFileSync(path.join(__dirname,"..",relative),"utf8")}
function run(relative){vm.runInNewContext(read(relative),context,{filename:relative})}

require("../who-ai-engine.js");
window.SuwadWhoAI=globalThis.SuwadWhoAI;
window.SuwadTavlaRules=require("../tavla-rules.js");

run("quiz-question-bank.js");
for(const file of [
 "quiz-category-banks.js",
 "quiz-football-space-banks.js",
 "quiz-popculture-banks.js",
 "quiz-auto-brands-gaming-banks.js",
 "quiz-gaming-bank.js"
])run(file);
run("quiz-hub.js");
run("game-ai-practice.js");

const bank=window.SuwadQuizQuestionBank;
const hub=window.SuwadQuizHub;
const ai=window.SuwadGameAIPractice;
assert.ok(bank&&hub&&ai,"Quiz banks, hub and practice engine are exposed");

const required=[
 "wrestlers","football","space","anime","cars",
 "brands","gaming","math","medicine"
];
const levels=["easy","medium","hard","expert"];
assert.equal(hub.categories.length,19,"The hub contains 19 sections after replacing the two retired categories");
assert.equal(new Set(hub.categories.map(item=>item.id)).size,hub.categories.length,"Category IDs are unique");

for(const id of required){
 const meta=hub.getCategory(id);
 assert.equal(meta.id,id,"Required category exists: "+id);
 assert.equal(meta.ready,true,"Required category is marked ready only after bank completion: "+id);
 assert.match(hub.render(id),/بنك القسم موثّق وجاهز/,"Ready category gets the correct status: "+id);
 const categoryBank=bank.categories[id];
 assert.ok(categoryBank,"Question bank exists: "+id);
 for(const level of levels){
  const questions=categoryBank[level];
  assert.ok(Array.isArray(questions),"Level bank exists: "+id+"/"+level);
  assert.equal(questions.length,25,"Each category has 25 questions per difficulty: "+id+"/"+level);
 }
}

const allQuestionIds=new Set();
const allPrompts=new Set();
let specialistQuestionCount=0;
for(const id of required){
 for(const level of levels){
  for(const item of bank.categories[id][level]){
   specialistQuestionCount++;
   assert.ok(item.id&&item.q,"Question ID and prompt exist: "+id+"/"+level);
   assert.ok(!allQuestionIds.has(item.id),"Question IDs are globally unique: "+item.id);
   allQuestionIds.add(item.id);
   const normalized=String(item.q).normalize("NFKD").replace(/[\u064B-\u065F\u0670\u0640\s\p{P}\p{S}]/gu,"").toLowerCase();
   assert.ok(!allPrompts.has(normalized),"Question prompts do not repeat across the specialist banks: "+item.id);
   allPrompts.add(normalized);
   assert.ok(item.source&&item.source.label,"Every specialist question identifies its source: "+item.id);
   assert.match(item.source.url,/^https:\/\//,"Every question source uses HTTPS: "+item.id);
   assert.ok(item.explanation&&item.explanation.trim(),"Every question includes an explanation: "+item.id);
   assert.ok(Array.isArray(item.a)&&item.a.length===4,"Every question has four options: "+item.id);
   assert.equal(new Set(item.a.map(answer=>String(answer).trim().toLowerCase())).size,4,"Question options are distinct: "+item.id);
   assert.ok(Number.isInteger(item.c)&&item.c>=0&&item.c<4,"Correct answer index is valid: "+item.id);
  }
 }
}
assert.equal(specialistQuestionCount,900,"Nine complete specialist banks contain 900 questions");

for(const id of required){
 for(const level of levels){
  const session=ai.create("quiz",level,id);
  assert.equal(session.game,"quiz");
  assert.equal(session.quizCategory,id,"Session uses its selected category");
  assert.equal(session.difficulty,level,"Session uses its selected difficulty");
  assert.equal(session.quizUnavailable,false,"Complete bank is not blocked");
  assert.ok(session.question&&session.question.source,"The first question and its source load");
  assert.equal(session.quizTotal,25);
 }
}

{
 ai.resetQuizLevel("wrestlers","easy");
 ai.resetQuizLevel("anime","easy");
 const first=ai.create("quiz","easy","wrestlers");
 const firstId=first.quizQuestionId;
 const reopened=ai.create("quiz","easy","wrestlers");
 assert.notEqual(reopened.quizQuestionId,firstId,"Reopening a category does not repeat its previous question");
 assert.equal(reopened.deck.length,23,"The already-used questions are excluded from the next deck");

 const other=ai.create("quiz","easy","anime");
 assert.ok(other.question,"Another category maintains its own bank");
 assert.equal(other.deck.length,24,"Using a wrestler question does not consume an anime question");

 const seen=JSON.parse(localStorage.getItem("sw_quiz_seen_by_category_level_v2"));
 assert.equal(seen.wrestlers.easy.length,2,"Wrestlers' used-question history is persisted");
 assert.equal(seen.anime.easy.length,1,"Anime history is stored independently");
 ai.resetQuizLevel("wrestlers","easy");
 const reset=ai.create("quiz","easy","wrestlers");
 assert.equal(reset.deck.length,24,"Resetting a category affects only its selected level");
 const seenAfter=JSON.parse(localStorage.getItem("sw_quiz_seen_by_category_level_v2"));
 assert.equal(seenAfter.anime.easy.length,1,"Resetting one section does not erase another section");
}

{
 const session=ai.create("quiz","medium","math");
 const original=session.quizQuestionId;
 const wrong=(session.question.c+1)%4;
 assert.equal(session.quizCountdownStarted,false,"Offline question waits for the manual countdown button");
 ai.apply(session,{type:"answer",value:wrong});
 assert.equal(session.quizAnswered,false,"Offline answers stay locked before the timer starts");
 assert.match(session.last,/بدء العد/,"The player is told to start the countdown first");
 session.quizCountdownStarted=true;
 session.quizStartedAt=Date.now();
 session.quizDeadlineAt=Date.now()+15000;
 ai.apply(session,{type:"answer",value:wrong});
 assert.equal(session.quizAnswered,true,"A valid answer is accepted after the manual timer starts");
 assert.equal(session.quizFeedback.isCorrect,false,"Wrong answers are graded as incorrect");
 assert.equal(session.quizFeedback.correctChoice,session.question.c,"Correct answer is retained for feedback");
 ai.apply(session,{type:"nextQuestion"});
 assert.notEqual(session.quizQuestionId,original,"Next question advances the deck");
 assert.equal(session.quizCountdownStarted,false,"Next offline question requires its own start press");

 const timeout=ai.create("quiz","easy","math");
 timeout.quizCountdownStarted=true;
 timeout.quizStartedAt=Date.now()-16000;
 timeout.quizDeadlineAt=Date.now()-1;
 const scoreBefore=timeout.scores[0];
 ai.apply(timeout,{type:"answer",value:timeout.question.c});
 assert.equal(timeout.quizAnswered,true,"A late answer triggers timeout feedback");
 assert.equal(timeout.quizFeedback.timedOut,true,"Timeout is recorded distinctly from a wrong answer");
 assert.equal(timeout.scores[0],scoreBefore,"A timed-out question awards no correct-answer point");
}

{
 memory.set("sw_quiz_wheels_v1",JSON.stringify({
  wrestlers:{names:["جون سينا","أندرتيكر"],removed:["باتيستا"],history:[]},
  anime:{names:["ناروتو"],removed:[],history:[]}
 }));
 assert.deepEqual(Array.from(hub.wheelState("wrestlers").names),["جون سينا","أندرتيكر"]);
 assert.deepEqual(Array.from(hub.wheelState("wrestlers").removed),["باتيستا"]);
 assert.deepEqual(Array.from(hub.wheelState("anime").names),["ناروتو"]);
 assert.deepEqual(Array.from(hub.wheelState("cars").names),[],"An untouched wheel stays empty and independent");
}

const hubSource=read("quiz-hub.js");
assert.ok(!hubSource.includes("aqeeda-imami")&&!hubSource.includes("aqeeda-sunni"),"Removed creed sections are absent");
assert.equal((hubSource.match(/\{id:"[a-z-]+",name:/g)||[]).length,19,"Hub contains 19 unique sections after replacement");
assert.ok(hubSource.includes('id:"football"')&&hubSource.includes('id:"space"'),"Football and space replace both removed sections");
const hubCss=read("quiz-hub.css");
assert.ok(hubSource.includes("requestAnimationFrame"),"Wheel animation uses frame-based motion");
assert.ok(hubSource.includes("accelerationShare"),"Wheel uses a smooth acceleration and deceleration curve");
assert.ok(hubSource.includes("AudioContext")&&hubSource.includes("unlockAudio"),"Wheel audio is unlocked from the user gesture");
assert.ok(hubSource.includes("suwad:category-picked"),"The category wheel returns its selected category");
assert.ok(hubSource.includes("sw_quiz_wheels_v1"),"Wheel settings are persisted locally");
assert.ok(hubCss.includes(".suwad-wheel-result.is-winner"),"Winner result has a dedicated effect");
assert.ok(hubCss.includes("prefers-reduced-motion"),"Reduced-motion preferences are respected");


const onlineGamesSource=read("online-games.js");
assert.ok(hubSource.includes("[data-quiz-category-wheel]"),"The category wheel can be mounted in the online quiz setup");
assert.ok(hubSource.includes("[data-quiz-names-wheel]"),"The per-category names wheel can be mounted in both modes");
assert.ok(onlineGamesSource.includes("data-quiz-category-wheel")&&onlineGamesSource.includes("data-quiz-names-wheel"),"Online quiz surfaces expose both wheel controls");
assert.ok(onlineGamesSource.includes("SuwadQuizHub?.mount(document"),"Online quiz binds the shared wheel module");

console.log("PASS: 19-category hub, 900 sourced specialist questions, four difficulty banks, no-repeat history, answer feedback, isolated wheels and cinematic wheel safeguards.");
