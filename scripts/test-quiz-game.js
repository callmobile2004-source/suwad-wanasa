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
const quietConsole={warn(){},error(){}};
const document={readyState:"loading",addEventListener(){},querySelector(){return null}};
const crypto={getRandomValues(array){array[0]=Math.floor(Math.random()*0xffffffff);return array}};
const context={console:quietConsole,document,localStorage,Math,Date,Number,String,Array,Object,JSON,RegExp,Error,Set,Map,Uint32Array,crypto,setTimeout,clearTimeout,setInterval,clearInterval};
context.window=context;
context.window.crypto=crypto;
context.window.document=document;
context.window.localStorage=localStorage;
vm.createContext(context);

const read=file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");
for(const file of [
 "quiz-question-bank.js",
 "quiz-category-banks.js",
 "quiz-football-space-banks.js",
 "quiz-popculture-banks.js",
 "quiz-auto-brands-gaming-banks.js",
 "quiz-gaming-bank.js",
 "quiz-foundations-banks.js",
 "quiz-creatures-cinema-food-banks.js",
 "quiz-discovery-banks.js",
 "quiz-hub.js",
 "quiz-game.js"
])vm.runInContext(read(file),context,{filename:file});

const game=context.SuwadQuizGame;
const hub=context.SuwadQuizHub;
const bank=context.SuwadQuizQuestionBank;
assert.ok(game&&hub&&bank,"Standalone game, category hub and all question banks are loaded");

const specialist=[
 "wrestlers","football","space","anime","cars","brands","gaming","math","medicine",
 "geography","history","science","animals","cinema","food","technology","literature","nature"
];
assert.equal(hub.categories.length,19,"The hub includes general knowledge and 18 specialist categories");
assert.equal(hub.categories.filter(item=>item.ready).length,19,"Every listed category is backed by a ready bank");
for(const category of specialist){
 const meta=hub.getCategory(category);
 assert.equal(meta.ready,true,"The standalone game can use "+category);
 for(const level of ["easy","medium","hard","expert"]){
  assert.equal(bank.categories[category][level].length,25,category+"/"+level+" contains 25 questions");
 }
}

for(const category of ["general",...specialist]){
 const session=game.createSession({category,difficulty:"easy",count:10,duration:15,mode:"solo"});
 assert.equal(session.deck.length,10,"10-question session created for "+category);
 assert.equal(session.ready,true,"Solo game starts without a pass-device gate");
 assert.equal(new Set(session.deck.map(item=>item.id)).size,10,"No duplicate question in a session: "+category);
 for(const item of session.deck){
  assert.equal(item.options.length,4,"Four shuffled choices are present: "+item.id);
  assert.equal(new Set(item.options).size,4,"Choice labels remain unique: "+item.id);
  assert.ok(item.correctChoice>=0&&item.correctChoice<4,"Correct choice index is retained: "+item.id);
 }
}

{
 const session=game.createSession({category:"wrestlers",difficulty:"medium",count:10,duration:15,mode:"solo"});
 const first=session.deck[0],answer=first.correctChoice;
 assert.equal(game.answer(answer,1000,session),false,"Answer remains locked before the timer starts");
 assert.equal(game.startTimer(session,1000),true,"Manual timer starts on request");
 assert.equal(game.startTimer(session,1001),false,"Timer cannot be started twice for one question");
 const feedback=game.answer(answer,2000,session);
 assert.equal(feedback.isCorrect,true,"Correct answer is graded correctly");
 assert.equal(feedback.points,145,"Score includes the base, remaining-time bonus and streak points");
 assert.equal(session.players[0].correct,1,"Correct-answer count advances");
 assert.equal(game.nextQuestion(session),true,"Next question advances after feedback");
 assert.equal(session.index,1,"Question index advances");
 assert.equal(session.countdownStarted,false,"Next question requires a fresh manual timer");
 assert.equal(game.startTimer(session,3000),true,"New question timer starts independently");
 const wrong=(session.deck[1].correctChoice+1)%4;
 const wrongFeedback=game.answer(wrong,3500,session);
 assert.equal(wrongFeedback.isCorrect,false,"Wrong answer is marked incorrect");
 assert.equal(session.players[0].wrong,1,"Incorrect-answer count advances");
 const seen=JSON.parse(localStorage.getItem("sw_quiz_standalone_seen_v1"));
 assert.equal(seen.wrestlers.medium.length,2,"Answered questions are stored in the independent used-question history");
 assert.equal(seen.math,undefined,"Another category's history is not affected");
 const secondRun=game.createSession({category:"wrestlers",difficulty:"medium",count:10,duration:15,mode:"solo"});
 assert.ok(!secondRun.deck.some(item=>item.id===first.id),"A used question is not repeated in the next session");
 game.finish(session);
 assert.ok(Object.keys(game.showBest()).some(key=>key==="solo|wrestlers|medium"),"Best result is stored by mode, category and level");
 assert.equal(localStorage.getItem("sw_quiz_standalone_saved_v1"),null,"Completed game does not leave a stale resume save");
}

{
 const session=game.createSession({category:"math",difficulty:"easy",count:10,duration:10,mode:"solo"});
 game.startTimer(session,5000);
 const result=game.answer(null,15001,session);
 assert.equal(result.expired,true,"Timeout is recorded distinctly");
 assert.equal(result.isCorrect,false,"Timeout does not award a correct answer");
 assert.equal(session.players[0].score,0,"Timeout awards no points");
}

{
 const session=game.createSession({category:"mixed",difficulty:"hard",count:20,duration:20,mode:"solo"});
 assert.equal(session.deck.length,20,"Mixed round draws across all categories");
 assert.ok(new Set(session.deck.map(item=>item.categoryId)).size>1,"Mixed round contains questions from multiple categories");
}

{
 const session=game.createSession({category:"space",difficulty:"expert",count:10,duration:15,mode:"party",names:"سواد\nأحمد\nعلي"});
 assert.equal(session.players.length,3,"Pass-and-play supports the supplied group");
 assert.equal(session.ready,false,"The next player cannot see the question before confirming readiness");
 assert.equal(game.startTimer(session,1000),false,"Timer cannot start before the current player confirms readiness");
 assert.equal(game.readyPlayer(session),true,"Next player can reveal their own question");
 assert.equal(game.startTimer(session,1000),true,"Timer starts after the pass-device gate");
 const feedback=game.answer(session.deck[0].correctChoice,1500,session);
 assert.equal(feedback.isCorrect,true,"Pass-and-play answer is graded");
 game.nextQuestion(session);
 assert.equal(session.ready,false,"Question is hidden again before the next player gets the device");
 assert.equal(game.startTimer(session,2000),false,"Next player's timer remains locked until ready");
 game.readyPlayer(session);
 assert.equal(game.startTimer(session,2000),true,"Next player's timer begins after confirmation");
}

{
 const mixed=game.createSession({category:"mixed",difficulty:"easy",count:50,duration:15,mode:"solo"});
 assert.equal(mixed.deck.length,50,"Marathon count is supported in mixed mode");
 assert.equal(game.resetHistory("math","easy"),true,"Category and level history can be reset safely");
 const seen=JSON.parse(localStorage.getItem("sw_quiz_standalone_seen_v1"));
 assert.deepEqual(seen.math?.easy||[],[],"Reset affects only the chosen category and level");
}

const source=read("quiz-game.js");
assert.ok(source.includes("data-standalone-quiz"),"The game exposes its own homepage entry point");
assert.ok(source.includes("const questionCard=session.ready?"),"Pass-and-play hides the question until the next player is ready");
assert.ok(source.includes("sw_quiz_standalone_seen_v1"),"Standalone history uses an isolated storage key");
assert.ok(source.includes("QUIZ_DURATION_MS")===false,"The standalone timer uses the selected duration, not a fixed practice constant");
console.log("PASS: standalone quiz engine covers 19 categories, four levels, unique questions, score/bonus rules, timer/timeout, mixed rounds, pass-and-play privacy, isolated history and best results.");
