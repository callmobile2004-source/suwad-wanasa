const assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm");
const source=fs.readFileSync(require("node:path").join(__dirname,"..","ai-practice.js"),"utf8");
const document={readyState:"loading",addEventListener(){},querySelectorAll(){return[]}};
const window={};
const context={window,document,localStorage:{getItem(){return null},setItem(){}},setTimeout(){return 1},clearTimeout(){},console};
vm.runInNewContext(source,context,{filename:"ai-practice.js"});
const rules=window.SuwadDominoRules;
assert.ok(rules,"local Domino rules are exposed for regression tests");
const game=rules.fresh("expert","calm");
assert.equal(game.hand.length,2);
assert.equal(game.hand[0].length,7);
assert.equal(game.hand[1].length,7);
assert.equal(game.stock.length,14);
const all=[...game.hand[0],...game.hand[1],...game.stock];
assert.equal(all.length,28);
assert.equal(new Set(all.map(t=>t.join(":"))).size,28,"double-six set contains 28 unique tiles");
assert.ok(all.every(t=>Number.isInteger(t[0])&&Number.isInteger(t[1])&&t[0]>=0&&t[1]<=6));
assert.ok(game.hand[game.openingPlayer].some(t=>t[0]===game.openingTile[0]&&t[1]===game.openingTile[1]));
{
 const choice=rules.openingChoice([[[6,6],[6,5],[5,5]],[[6,4],[4,4],[0,0]]]);
 assert.equal(choice.player,0);
 assert.deepEqual(Array.from(choice.tile),[6,6],"highest double opens before any non-double");
}
{
 const choice=rules.openingChoice([[[6,5],[5,4]],[[6,4],[5,3]]]);
 assert.deepEqual(Array.from(choice.tile),[6,5],"when no double exists, highest pip total opens");
}
{
 const chain=[[6,4],[3,2]],hand=[[6,2],[2,5],[6,1],[1,3]];
 const moves=rules.legalMoves(hand,chain,null);
 const both=moves.filter(m=>m.index===0);
 assert.deepEqual(Array.from(both,m=>m.side).sort(),["left","right"],"a tile matching both open ends offers both choices");
 assert.deepEqual(Array.from(both.find(m=>m.side==="left").tile),[2,6]);
 assert.deepEqual(Array.from(both.find(m=>m.side==="right").tile),[2,6]);
 assert.ok(moves.some(m=>m.index===1&&m.side==="right"));
 assert.ok(moves.some(m=>m.index===2&&m.side==="left"));
 assert.equal(moves.some(m=>m.index===3),false,"non-matching tile is not legal");
}
{
 const opening=rules.legalMoves([[6,6],[6,5]],[],[6,6]);
 assert.equal(opening.length,1);
 assert.equal(opening[0].index,0,"opening player must play the selected opening tile");
}
assert.equal(rules.pipCount([[1,2],[6,6]]),15);
{
 const hand=[[6,2],[4,1],[3,3]],moves=rules.legalMoves(hand,[[6,4],[3,2]],null);
 const selected=rules.chooseAI(moves,hand,"expert");
 assert.ok(moves.some(m=>m.index===selected.index&&m.side===selected.side));
}
console.log("PASS: local double-six Domino deck, 7-tile deal, opening choice, both-end placement, matching, and pip scoring.");
