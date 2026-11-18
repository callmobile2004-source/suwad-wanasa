const fs=require("node:fs");
const vm=require("node:vm");
const assert=require("node:assert/strict");
 require("../who-ai-engine.js");
const path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"..","game-ai-practice.js"),"utf8");
const bankSource=fs.readFileSync(path.join(__dirname,"..","quiz-question-bank.js"),"utf8");
const bankWindow={};
vm.runInNewContext(bankSource,{window:bankWindow});
const quizBank=bankWindow.SuwadQuizQuestionBank;
const stored=new Map();
const localStorage={
 getItem(key){return stored.has(key)?stored.get(key):null},
 setItem(key,value){stored.set(key,String(value))},
 removeItem(key){stored.delete(key)}
};
const window={SuwadWhoAI:globalThis.SuwadWhoAI,SuwadTavlaRules:require("../tavla-rules.js"),SuwadQuizQuestionBank:quizBank};
const document={readyState:"loading",addEventListener(){}};
vm.runInNewContext(source,{window,document,localStorage,Math,Date,Number,String,Array,Object,Error,RegExp,JSON});
const ai=window.SuwadGameAIPractice;
assert.ok(ai,"AI practice API is exposed");
for(const game of ["who","number","liar","most","yesno","snakes","tavla","colors","quiz","wheel"]) {
  const s=ai.create(game,"expert");
  assert.equal(s.game,game,"game factory: "+game);
  assert.equal(s.difficulty,"expert","difficulty: "+game);
  assert.equal(s.status,"playing","initial status: "+game);
}
{
 const s=ai.create("who","hard");
 ai.apply(s,{type:"ask",value:"هل تعيش بالبحر؟"});
 assert.equal(s.log.length,1);
 ai.apply(s,{type:"guess",value:"تخمين غير صحيح"});
 assert.equal(s.status,"finished");
}
{
 const s=ai.create("who","expert");s.category="الحيوانات";s.secret="فيل";
 const small=ai.answerWhoQuestion(s,"هل الحيوان صغير الحجم؟");
 const large=ai.answerWhoQuestion(s,"هل الحيوان كبير الحجم؟");
 assert.equal(small.answer,"لا، الحجم كبير.","elephant must reveal its actual size when asked if small");
 assert.equal(large.answer,"نعم، الحجم كبير.","elephant is large");
 assert.equal(s.log.length,2,"assistant and in-game history share one question log");
 const negativeBird=ai.create("who","hard");negativeBird.category="الحيوانات";negativeBird.secret="بطريق";
 const negativeAnswer=ai.answerWhoQuestion(negativeBird,"هل الحيوان لا يطير؟");
 assert.equal(negativeAnswer.answer,"نعم","The live practice adapter must preserve negative-question polarity");
 assert.equal(negativeBird.log.length,1,"The negative question is recorded once in the live practice session");
 const cat=ai.create("who","expert");cat.category="الحيوانات";cat.secret="قطة";
 assert.equal(ai.answerWhoQuestion(cat,"هل الحيوان صغير الحجم؟").answer,"نعم، الحجم صغير.");
 assert.equal(ai.answerWhoQuestion(cat,"هل الحيوان كبير الحجم؟").answer,"لا، الحجم صغير.");
 const medium=ai.create("who","expert");medium.category="الحيوانات";medium.secret="ذئب رمادي";
 assert.equal(ai.answerWhoQuestion(medium,"هل الحيوان صغير الحجم؟").answer,"لا، الحجم متوسط.");
 assert.equal(ai.answerWhoQuestion(medium,"هل الحيوان كبير الحجم؟").answer,"لا، الحجم متوسط.");
 assert.equal(ai.answerWhoQuestion(medium,"هل الحيوان متوسط الحجم؟").answer,"نعم، الحجم متوسط.");
 assert.equal(ai.answerWhoQuestion(medium,"شنو حجم الحيوان؟").answer,"الحجم متوسط.");
 const hyena=ai.create("who","expert");hyena.category="الحيوانات";hyena.secret="ضبع مرقط";
 assert.equal(ai.answerWhoQuestion(hyena,"هل الحيوان كبير؟").answer,"لا، الحجم متوسط.");
 const variableNames=["كلب","ثعلب","دلفين","بطريق","كنغر","تمساح","باندا","غوريلا","سلحفاة","قرد","حمار","نمر"];
 for(const name of variableNames){const u=ai.create("who","expert");u.category="الحيوانات";u.secret=name;
   const result=ai.answerWhoQuestion(u,"هل الحيوان صغير الحجم؟");
   assert.equal(result.known,true,name+" must receive a useful size-variation explanation");
   assert.match(result.answer,/يختلف|يعتمد|تختلف|يُستعمل/,name+" must explain the size or common-name ambiguity");
 }
 const bat=ai.create("who","expert");bat.category="الحيوانات";bat.secret="خفاش";
 assert.equal(ai.answerWhoQuestion(bat,"هل الحيوان صغير الحجم؟").answer,"نعم، الحجم صغير.");
 const wolf=ai.create("who","expert");wolf.category="الحيوانات";wolf.secret="ذئب";
 assert.equal(ai.answerWhoQuestion(wolf,"هل الحيوان متوسط الحجم؟").answer,"نعم، الحجم متوسط.");
 const hyenaGeneric=ai.create("who","expert");hyenaGeneric.category="الحيوانات";hyenaGeneric.secret="ضبع";
 assert.equal(ai.answerWhoQuestion(hyenaGeneric,"هل الحيوان متوسط الحجم؟").answer,"نعم، الحجم متوسط.");
 const saltwater=ai.create("who","expert");saltwater.category="الحيوانات";saltwater.secret="تمساح المياه المالحة";
 assert.equal(ai.answerWhoQuestion(saltwater,"هل الحيوان كبير؟").answer,"نعم، الحجم كبير.");
 const rabbit=ai.create("who","expert");rabbit.category="الحيوانات";rabbit.secret="أرنب أوروبي";
 assert.equal(ai.answerWhoQuestion(rabbit,"هل الحيوان صغير؟").answer,"نعم، الحجم صغير.");
 const tiger=ai.create("who","expert");tiger.category="الحيوانات";tiger.secret="ببر بنغالي";
 assert.equal(ai.answerWhoQuestion(tiger,"هل الحيوان كبير؟").answer,"نعم، الحجم كبير.");
 const commonTiger=ai.create("who","expert");commonTiger.category="الحيوانات";commonTiger.secret="نمر";
 assert.match(ai.answerWhoQuestion(commonTiger,"هل الحيوان كبير؟").answer,/حدّد النوع/,
   "Ambiguous common animal names receive a clarification instead of an unsupported size guess.");
}
{
 const s=ai.create("number","expert"),n=Math.floor((s.range[0]+s.range[1])/2);
 ai.apply(s,{type:"guess",value:n});
 assert.equal(s.tries[0],1);
 if(s.status==="playing"&&s.turn===1)ai.botTurn(s);
 assert.ok(s.status==="playing"||s.status==="finished");
}
{
 const s=ai.create("liar","hard");
 ai.apply(s,{type:"hint",value:"تلميح تجريبي"});
 assert.equal(s.stage,"vote");
 assert.equal(s.hints.length,4);
 ai.apply(s,{type:"vote",value:1});
 assert.equal(s.status,"finished");
}
{
 const s=ai.create("most","medium");
 ai.apply(s,{type:"vote",value:2});
 assert.equal(s.status,"finished");
 assert.equal(s.votes.length,4);
}
{
 const s=ai.create("yesno","easy");
 ai.apply(s,{type:"answer",value:"أحب الشاي وأفضله بالصباح"});
 assert.equal(s.questionIndex,1);
 assert.equal(s.scores[0],1);
 ai.apply(s,{type:"answer",value:"لا أريد ذلك"});
 assert.equal(s.scores[1],1,"exact forbidden word should be caught");
}
{
 const s=ai.create("snakes","expert");
 ai.apply(s,{type:"roll"});
 assert.ok(s.positions[0]>=0&&s.positions[0]<=100);
 if(s.status==="playing"&&s.turn===1)ai.botTurn(s);
 assert.equal(s.turn,0);
}
{
 const s=ai.create("tavla","hard");
 assert.equal(s.tavla.points.length,24);
 assert.equal(s.tavla.points.reduce((n,p)=>n+(p.owner===0?p.count:0),0),15);
 assert.equal(s.tavla.points.reduce((n,p)=>n+(p.owner===1?p.count:0),0),15);
 assert.equal(s.turn,s.tavla.turn);
 if(s.turn===1){ai.botTurn(s);assert.equal(s.turn,0)}
 else {
  const moves=window.SuwadTavlaRules.getLegalMoves(s.tavla,0);
  assert.ok(moves.length>0,"opening roll has at least one legal move");
  const result=window.SuwadTavlaRules.applyMove(s.tavla,0,moves[0]);
  assert.equal(result.error,null);
  s.tavla=result.state;s.turn=s.tavla.turn;
 }
}
{
 const s=ai.create("colors","expert"),top=s.discard[s.discard.length-1];
 const index=s.hands[0].findIndex(c=>c.c===top.c||c.v===top.v);
 if(index>=0)ai.apply(s,{type:"play",index});
 else {ai.apply(s,{type:"draw"});if(s.drawn[0])ai.apply(s,{type:"pass"})}
 assert.ok(s.hands[0].length>=0);
 let botTurns=0;while(s.status==="playing"&&s.turn===1&&botTurns++<20)ai.botTurn(s);
 assert.ok(s.status==="finished"||s.turn===0,"Oras must finish consecutive Skip/Reverse/Draw turns before returning play");
}
{
 const levels=["easy","medium","hard","expert"];
 const allIds=new Set(),allQuestions=new Set();
 const normalize=value=>String(value||"").normalize("NFKD").replace(/\s+/g,"").replace(/[.,;:!?،؛؟]/g,"").toLowerCase();
 for(const level of levels){
  assert.ok(Array.isArray(quizBank[level]),"Question bank exists for "+level);
  assert.ok(quizBank[level].length>=25,level+" has a substantial question pool");
  const levelIds=new Set(),levelQuestions=new Set();
  for(const item of quizBank[level]){
   assert.ok(item.id&&item.q&&item.explanation,"Every question has an ID, prompt and explanation");
   assert.equal(item.a.length,4,"Every question has exactly four choices: "+item.id);
   assert.equal(new Set(item.a.map(normalize)).size,4,"Answer choices are unique: "+item.id);
   assert.ok(Number.isInteger(item.c)&&item.c>=0&&item.c<4,"Correct answer index is valid: "+item.id);
   assert.ok(!allIds.has(item.id),"Question IDs are globally unique: "+item.id);
   assert.ok(!levelIds.has(item.id),"Question IDs do not repeat in a level: "+item.id);
   assert.ok(!allQuestions.has(normalize(item.q)),"Question prompts do not repeat across levels: "+item.q);
   assert.ok(!levelQuestions.has(normalize(item.q)),"Question prompt does not repeat in its level: "+item.q);
   allIds.add(item.id);levelIds.add(item.id);allQuestions.add(normalize(item.q));levelQuestions.add(normalize(item.q));
  }
 }
 for(const level of levels){
  ai.resetQuizLevel(level);
  const s=ai.create("quiz",level);
  assert.equal(s.game,"quiz");
  assert.equal(s.difficulty,level);
  assert.equal(s.status,"playing");
  assert.ok(quizBank[level].some(item=>item.id===s.quizQuestionId),"A selected question belongs to its chosen level");
  assert.equal(s.deck.length,quizBank[level].length-1,"The deck contains every other unseen question exactly once");
  const played=new Set();
  let count=0;
  while(s.status==="playing"&&count<quizBank[level].length){
   const current=s.question,questionId=s.quizQuestionId;
   assert.ok(current&&questionId,"A question is loaded while the quiz is active");
   assert.ok(!played.has(questionId),"No question repeats during a level session: "+questionId);
   played.add(questionId);
   const original=quizBank[level].find(item=>item.id===questionId);
   assert.equal(current.a[current.c],original.a[original.c],"Randomized answer order preserves the correct answer");
   const wrong=(current.c+1)%4;
   ai.apply(s,{type:"answer",value:wrong});
   assert.equal(s.quizAnswered,true,"Answer result is held on the same question");
   assert.equal(s.quizFeedback.isCorrect,false,"Wrong answers are explicitly marked incorrect");
   assert.equal(s.quizFeedback.selectedChoice,wrong);
   assert.equal(s.quizFeedback.correctChoice,current.c);
   assert.equal(s.question.id,questionId,"Question must not advance before the player requests the next one");
   ai.apply(s,{type:"nextQuestion"});
   count++;
   if(count<quizBank[level].length){
    assert.equal(s.status,"playing");
    assert.notEqual(s.quizQuestionId,questionId,"Next question is different");
   }
  }
  assert.equal(count,quizBank[level].length,"Every question in the selected level can be played once");
  assert.equal(played.size,quizBank[level].length);
  assert.equal(s.status,"finished","The quiz ends rather than repeating its question bank");
  assert.equal(s.quizExhausted,true);
  const exhausted=ai.create("quiz",level);
  assert.equal(exhausted.status,"finished","A completed level does not silently replay old questions");
  assert.equal(exhausted.quizQuestionId,undefined);
  ai.resetQuizLevel(level);
  const fresh=ai.create("quiz",level);
  assert.equal(fresh.status,"playing","An explicit level reset permits a new cycle");
  assert.equal(fresh.difficulty,level);
 }
 {
  const s=ai.create("quiz","expert");
  const questionId=s.quizQuestionId;
  ai.apply(s,{type:"answer",value:s.question.c});
  assert.equal(s.scores[0],1,"Correct answers award one point");
  assert.equal(s.quizFeedback.isCorrect,true,"Correct answers are explicitly marked correct");
  assert.equal(s.question.id,questionId,"The correct-answer feedback remains visible until Next");
  ai.apply(s,{type:"answer",value:(s.question.c+1)%4});
  assert.equal(s.scores[0],1,"A second click cannot score or change the locked answer");
  assert.equal(s.quizFeedback.isCorrect,true,"The first result cannot be overwritten");
  ai.apply(s,{type:"nextQuestion"});
  assert.notEqual(s.quizQuestionId,questionId);
 }
}
{
 const s=ai.create("wheel","easy");
 ai.apply(s,{type:"spin"});
 assert.equal(s.spins.length,2);
 assert.equal(s.spins[1].by,"أوراس");
 assert.ok(s.spins[0].result);
}
console.log("PASS: 10 local game AI engines create states and pass smoke tests.");
