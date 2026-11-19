const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const memory=new Map();
const localStorage={getItem(key){return memory.has(key)?memory.get(key):null},setItem(key,value){memory.set(key,String(value))}};
const window={};
const source=fs.readFileSync(path.join(__dirname,"..","quiz-hub.js"),"utf8");
vm.runInNewContext(source,{window,localStorage,console,Math,Date,Uint32Array,crypto:{getRandomValues(array){array[0]=123456789;return array}}});
const hub=window.SuwadQuizHub;
assert.ok(hub,"Quiz hub API is exposed");
assert.ok(hub.categories.length>=20,"Quiz categories contain the requested categories and extra popular topics");
const ids=hub.categories.map(item=>item.id);
assert.equal(new Set(ids).size,ids.length,"Category IDs are unique");
for(const id of ["wrestlers","aqeeda-imami","aqeeda-sunni","anime","cars","brands","gaming","math","medicine"]){
 assert.ok(ids.includes(id),"Required quiz category exists: "+id);
}
for(const category of hub.categories){
 assert.ok(category.name&&category.icon,"Every category has a readable name and icon");
 if(category.id!=="general"){
  assert.equal(category.ready,false,"A specialist category stays disabled until its audited 100+ sourced questions are present: "+category.id);
  assert.ok(Array.isArray(category.sources)&&category.sources.length>0,"Every specialist category has an identified source policy: "+category.id);
  for(const item of category.sources)assert.match(item.url,/^https:\/\//,"Category source links must be HTTPS");
 }
}
assert.equal(hub.getCategory("not-a-category").id,"general","Unknown category safely falls back to general");
assert.match(hub.render("aqeeda-imami"),/gaiQuizCategory/,"Category selector is rendered");
assert.match(hub.render("aqeeda-imami"),/العقيدة/,"Arabic category names are shown");
assert.match(hub.render("aqeeda-imami"),/قيد التدقيق/,"Unverified category is not advertised as playable");
memory.set("sw_quiz_wheels_v1",JSON.stringify({
 wrestlers:{names:["جون سينا","أندرتيكر"],removed:["باتيستا"],history:[]},
 anime:{names:["ناروتو"],removed:[],history:[]}
}));
assert.deepEqual(Array.from(hub.wheelState("wrestlers").names),["جون سينا","أندرتيكر"]);
assert.deepEqual(Array.from(hub.wheelState("wrestlers").removed),["باتيستا"]);
assert.deepEqual(Array.from(hub.wheelState("anime").names),["ناروتو"]);
assert.deepEqual(Array.from(hub.wheelState("cars").names),[],"An untouched wheel stays empty and independent");
console.log("PASS: quiz categories, source policies, pending-bank safeguards, and isolated wheel storage.");
