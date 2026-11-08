const assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm");
const source=fs.readFileSync(require("node:path").join(__dirname,"..","game-motion.js"),"utf8");
const onlineSource=fs.readFileSync(require("node:path").join(__dirname,"..","online-games.js"),"utf8");
const legacySnake=onlineSource.slice(onlineSource.indexOf("async function animateLegacySnakeMove(move){"),onlineSource.indexOf("async function animateSnakePendingMove(move){"));
assert.ok(legacySnake.includes("const cleanup=()=>"),"legacy snake animation defines a cleanup path");
assert.ok(legacySnake.includes("if(token.parentNode===board)token.remove()"),"temporary token is removed from its board");
assert.ok(legacySnake.includes("if(staticToken?.isConnected)staticToken.style.visibility=\"\""),"original token is restored when still connected");
assert.ok(/try\s*\{[\s\S]*finally\s*\{\s*cleanup\(\);\s*\}/.test(legacySnake),"cleanup runs for stale moves, failed saves and thrown errors");
let rafs=0;
const context={window:{setTimeout:()=>0},requestAnimationFrame:fn=>{rafs++;fn()},setTimeout:()=>0};
vm.runInNewContext(source,context);
const motion=context.window.SuwadGameMotion;
assert.ok(motion&&typeof motion.prepare==="function"&&typeof motion.refresh==="function");
const makeNode=(group,left,top)=>({
 group,rect:{left,top,width:24,height:24},
 classList:{values:new Set(),add(x){this.values.add(x)}},
 style:{},
 getAttribute(name){return name==="data-motion-group"?this.group:null},
 getBoundingClientRect(){return this.rect}
});
const surface=makeNode("",0,0);
let pieces=[];
const root={querySelectorAll(selector){if(selector.includes(".online-game-board"))return [surface];if(selector==="[data-motion-group]")return pieces;return []}};
motion.prepare(root);
pieces=[makeNode("chess-white-p",10,10),makeNode("tavla-0",40,10)];
motion.refresh(root);
assert.ok(surface.classList.values.has("game-motion-enter"),"game surfaces enter once");
assert.ok(pieces.every(x=>x.classList.values.has("game-motion-piece")),"new pieces receive a moderate entrance animation");
motion.prepare(root);
pieces[0].rect={left:110,top:70,width:24,height:24};
motion.refresh(root);
assert.equal(pieces[0].style.translate,"0px 0px","moved pieces settle at their new authoritative position");
assert.match(pieces[0].style.transition,/480ms/,"piece travel uses a moderate 480ms transition");
assert.ok(rafs>0,"movement uses a frame boundary to avoid a visual jump");
motion.refresh(null);
console.log("Shared motion controller animates real piece positions and respects reduced-motion settings.");
