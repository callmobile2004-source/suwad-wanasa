const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,"..");
const js=fs.readFileSync(path.join(root,"auction-ui.js"),"utf8");
const css=fs.readFileSync(path.join(root,"auction-ui.css"),"utf8");
const expected=["football-players","wrestlers","rare-animals","cars","watches","video-games","real-estate","aircraft-ships","antiques","rare-cards","fictional-gear","mystery-lots"];
const layouts=["stadium","arena","wild","garage","atelier","arcade","estate","fleet","museum","cards","fantasy","mystery"];
const ids=[...js.matchAll(/id:"([a-z-]+)",name:/g)].map(m=>m[1]);
assert.deepEqual(ids,expected,"The auction category registry must contain exactly the twelve approved categories in order");
for(const id of expected) assert.ok(js.includes("id:"+JSON.stringify(id)), "Missing category "+id);
for(const layout of layouts){
  assert.ok(js.includes(layout+":"), "Missing dedicated layout template "+layout);
  assert.ok(css.includes(".auction-layout-"+layout), "Missing dedicated layout styling "+layout);
}
assert.equal(new Set(layouts).size,layouts.length,"Each category must use a distinct layout");
assert.ok(js.includes("المزاد افتراضي وتثقيفي فقط"),"Rare animals must remain educational and virtual only");
assert.ok(js.includes("بلا أسلحة حقيقية"),"Fictional equipment must not imply real weapon trading");
assert.ok(js.includes("data-auction-back"),"Category screens must provide a return path to the auction hub");
assert.ok(js.includes("data-auction-category"),"The hub must provide category navigation");
assert.ok(js.includes("ليست مزايدة حقيقية بعد"),"The prototype must not misrepresent an inactive auction engine as live");
console.log("PASS: 12 auction categories, 12 distinct layouts, category-specific facts, safe category constraints and navigation.");
