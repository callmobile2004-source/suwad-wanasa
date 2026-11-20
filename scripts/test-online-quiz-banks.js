const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const bankFiles=[
 "quiz-question-bank.js",
 "quiz-category-banks.js",
 "quiz-football-space-banks.js",
 "quiz-popculture-banks.js",
 "quiz-auto-brands-gaming-banks.js",
 "quiz-gaming-bank.js"
];
const readyCategories=[
 "wrestlers","football","space","anime","cars",
 "brands","gaming","math","medicine"
];
const levels=["easy","medium","hard","expert"];
const read=file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");

function loadBrowserBanks(){
 const context={console:{warn(){},error(){}}};
 context.window=context;
 vm.createContext(context);
 for(const file of bankFiles)vm.runInContext(read(file),context,{filename:file});
 return context.SuwadQuizQuestionBank;
}
function loadEdgeBanks(){
 const context={console:{warn(){},error(){}}};
 vm.createContext(context);
 for(const file of bankFiles){
  const source=read(path.join("supabase/functions/_shared",file)).replace(/\bwindow\b/g,"globalThis");
  vm.runInContext(source,context,{filename:"edge:"+file});
 }
 return context.SuwadQuizQuestionBank;
}
const browser=loadBrowserBanks(),edge=loadEdgeBanks();
assert.ok(browser&&edge,"Both browser and Edge Function banks are loaded");
const canonical=value=>JSON.stringify(value);
for(const level of levels){
 assert.equal(edge[level]?.length,browser[level]?.length,"General level count matches the offline bank: "+level);
 assert.equal(canonical(edge[level]),canonical(browser[level]),"General questions match byte-for-byte after serialization: "+level);
}
for(const category of readyCategories){
 const browserLevels=browser.categories?.[category],edgeLevels=edge.categories?.[category];
 assert.ok(browserLevels&&edgeLevels,"Ready specialist bank exists in both runtimes: "+category);
 for(const level of levels){
  const a=browserLevels[level],b=edgeLevels[level];
  assert.ok(Array.isArray(a)&&Array.isArray(b),"Question level exists: "+category+"/"+level);
  assert.equal(a.length,25,"Exactly 25 offline questions: "+category+"/"+level);
  assert.equal(b.length,25,"Exactly 25 online questions: "+category+"/"+level);
  assert.equal(canonical(a),canonical(b),"Online and offline question data stays identical: "+category+"/"+level);
  for(const question of b){
   assert.equal(question.a.length,4,"Four options: "+question.id);
   assert.equal(new Set(question.a.map(value=>String(value).trim().toLowerCase())).size,4,"Unique answer options: "+question.id);
   assert.ok(question.source?.label&&/^https:\/\//.test(question.source.url),"HTTPS correction source: "+question.id);
   assert.ok(question.explanation?.trim(),"Explanation exists: "+question.id);
  }
 }
}
const total=readyCategories.reduce((sum,category)=>sum+levels.reduce((count,level)=>count+edge.categories[category][level].length,0),0);
assert.equal(total,900,"Nine ready specialist banks contain 900 sourced questions, including football and space");
assert.ok(!browser.categories?.["aqeeda-imami"]&&!browser.categories?.["aqeeda-sunni"],"Removed creed categories do not load");
assert.ok(browser.categories?.football&&browser.categories?.space,"Replacement banks load in the browser");
console.log("PASS: Online Edge question banks match the offline data exactly across 9 specialist categories and all 4 levels (900 questions), including football and space.");
