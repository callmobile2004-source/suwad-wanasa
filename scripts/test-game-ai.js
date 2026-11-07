const fs=require("node:fs");
const vm=require("node:vm");
const assert=require("node:assert/strict");
 require("../who-ai-engine.js");
const source=fs.readFileSync(require("node:path").join(__dirname,"..","game-ai-practice.js"),"utf8");
const window={SuwadWhoAI:globalThis.SuwadWhoAI};
const document={readyState:"loading",addEventListener(){}};
vm.runInNewContext(source,{window,document,Math,Date,Number,String,Array,Object,Error,RegExp,JSON});
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
 const unknownNames=["كلب","دلفين","بطريق","تمساح","خفاش","ذئب","ضبع"];
 for(const name of unknownNames){const u=ai.create("who","expert");u.category="الحيوانات";u.secret=name;
   assert.equal(ai.answerWhoQuestion(u,"هل الحيوان صغير الحجم؟").known,false,name+" is broad/variable and must abstain");
 }
 const saltwater=ai.create("who","expert");saltwater.category="الحيوانات";saltwater.secret="تمساح المياه المالحة";
 assert.equal(ai.answerWhoQuestion(saltwater,"هل الحيوان كبير؟").answer,"نعم، الحجم كبير.");
 const rabbit=ai.create("who","expert");rabbit.category="الحيوانات";rabbit.secret="أرنب أوروبي";
 assert.equal(ai.answerWhoQuestion(rabbit,"هل الحيوان صغير؟").answer,"نعم، الحجم صغير.");
 const tiger=ai.create("who","expert");tiger.category="الحيوانات";tiger.secret="ببر بنغالي";
 assert.equal(ai.answerWhoQuestion(tiger,"هل الحيوان كبير؟").answer,"نعم، الحجم كبير.");
 const ambiguousTiger=ai.create("who","expert");ambiguousTiger.category="الحيوانات";ambiguousTiger.secret="نمر";
 assert.equal(ai.answerWhoQuestion(ambiguousTiger,"هل الحيوان كبير؟").known,false,"ambiguous common name must not be assigned a species size.");
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
 const s=ai.create("tavla","hard"),before=s.positions[0].length+s.off[0];
 ai.apply(s,{type:"roll"});
 assert.equal(s.dice.length,2,"simplified tavla rolls two dice");
 ai.apply(s,{type:"move",point:s.positions[0][0]});
 assert.equal(s.dice.length,1,"first move consumes only the first die");
 ai.apply(s,{type:"move",point:s.positions[0][0]});
 assert.equal(s.dice.length,0,"second move consumes the second die");
 assert.equal(s.positions[0].length+s.off[0],before);
 if(s.status==="playing"&&s.turn===1)ai.botTurn(s);
 assert.equal(s.turn,0);
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
 const s=ai.create("quiz","expert");
 ai.apply(s,{type:"answer",value:s.question.c});
 assert.equal(s.scores[0],1);
 assert.equal(s.round,2);
}
{
 const s=ai.create("wheel","easy");
 ai.apply(s,{type:"spin"});
 assert.equal(s.spins.length,2);
 assert.equal(s.spins[1].by,"أوراس");
 assert.ok(s.spins[0].result);
}
console.log("PASS: 10 local game AI engines create states and pass smoke tests.");
