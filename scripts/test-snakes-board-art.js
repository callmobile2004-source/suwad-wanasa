"use strict";
const assert=require("node:assert/strict");
global.window=global;
require("../snakes-board-art.js");
const art=global.SuwadSnakesBoardArt;
assert.equal(art.boardOrder().length,100);
assert.equal(new Set(art.boardOrder()).size,100);
assert.deepEqual(art.center(100),{x:50,y:50});
assert.deepEqual(art.center(1),{x:50,y:950});
const svg=art.overlay([{from:80,to:10},{from:90,to:20}],[{from:3,to:40},{from:15,to:70}]);
assert.equal((svg.match(/class="snake-art-serpent"/g)||[]).length,2);
assert.equal((svg.match(/class="snake-art-ladder"/g)||[]).length,2);
assert.match(svg,/data-link-from="80" data-link-to="10"/);
const cube=art.cube("testDice",6);
assert.equal((cube.match(/class="snake-die-face/g)||[]).length,6);
assert.match(cube,/data-result="6"/);
console.log("Snakes board art and dice tests passed.");

const layouts=Array.from({length:80},()=>art.generateLayout());
for(const layout of layouts){
 assert.ok(layout.snakes.length>=2&&layout.snakes.length<=6);
 assert.ok(layout.ladders.length>=2&&layout.ladders.length<=6);
 assert.notEqual(layout.snakes.length,layout.ladders.length);
 const links=[...layout.snakes,...layout.ladders];
 const lanes=links.map(x=>art.center(x.from).x);
 assert.equal(new Set(lanes).size,lanes.length,"each link occupies a separate vertical lane");
 for(const link of links)assert.equal(art.center(link.from).x,art.center(link.to).x,"link endpoints share one vertical lane");
 const endpoints=links.flatMap(x=>[x.from,x.to]);
 assert.equal(new Set(endpoints).size,endpoints.length,"all links must have unique endpoints");
 for(const link of layout.snakes)assert.ok(link.from-link.to>=9&&link.from<=98&&link.to>=2);
 for(const link of layout.ladders)assert.ok(link.to-link.from>=9&&link.to<=99&&link.from>=2);
 const rendered=art.overlay(layout.snakes,layout.ladders);
 assert.equal((rendered.match(/class="snake-art-serpent"/g)||[]).length,layout.snakes.length);
 assert.equal((rendered.match(/class="snake-art-ladder"/g)||[]).length,layout.ladders.length);
}
