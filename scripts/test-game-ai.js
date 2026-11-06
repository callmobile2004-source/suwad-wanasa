const fs=require("node:fs");
const vm=require("node:vm");
const assert=require("node:assert/strict");
const source=fs.readFileSync(require("node:path").join(__dirname,"..","game-ai-practice.js"),"utf8");
const window={SuwadWhoAI:{answer:(category,secret,q)=>({answer:q.includes("بحر")?(secret==="دلفين"?"نعم":"لا"):"ما عندي معلومة موثوقة عن هالسؤال."})}};
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
 if(s.status==="playing"&&s.turn===1)ai.botTurn(s);
 assert.equal(s.turn,0);
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
