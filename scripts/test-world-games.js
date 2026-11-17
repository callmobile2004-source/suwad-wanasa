const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const menu = fs.readFileSync(path.join(root, "game-menu.js"), "utf8");
const source = fs.readFileSync(path.join(root, "world-games.js"), "utf8");
const css = fs.readFileSync(path.join(root, "world-games.css"), "utf8");
const expected = ["cipher","doodle","ad","dub","story","invention","silent"];
for (const key of expected) {
  assert.ok(source.includes(key + ":{name:"), "Missing new game definition: " + key);
  assert.ok(menu.includes(key + ":{name:"), "Legacy launcher missing the new game entry: " + key);
  assert.ok(fs.existsSync(path.join(root, "assets/world-games", key + ".svg")), "Missing original artwork: " + key);
  const art = fs.readFileSync(path.join(root, "assets/world-games", key + ".svg"), "utf8");
  assert.match(art, /<svg[^>]+viewBox=/, "Artwork must be a local SVG: " + key);
}
assert.ok(index.includes("world-games.css?v=20261117-01"));
assert.ok(index.includes("world-games.js?v=20261117-01"));
assert.ok(sw.includes('"./world-games.css"') && sw.includes('"./world-games.js"'));
for (const key of expected) assert.ok(sw.includes('"./assets/world-games/' + key + '.svg"'), "Offline cache missing " + key);
for (const token of ["data-wg-theme","data-theme","sw_wanasa_theme_v1","prefers-reduced-motion","@keyframes wg-float","sw-world-modal-open"]) assert.ok(css.includes(token), "Missing theme/motion styling: " + token);
assert.ok(menu.includes("SuwadWorldGames?.isGame(game)"), "Legacy game menu must route new games to their dedicated world");
assert.ok(menu.includes('kind==="world"'), "Legacy Continue must understand world-game saves");
assert.ok(source.includes("navigator.mediaDevices?.getUserMedia"), "Dubbing must request microphone permission explicitly");
assert.ok(source.includes("URL.createObjectURL"), "Dubbing playback must use local in-session audio");
assert.ok(source.includes("function cipherCheck"), "Cipher needs real code matching feedback");
assert.ok(source.includes("function drawSavedStrokes"), "Drawing game needs a working canvas renderer");
assert.ok(source.includes("deadlineAt=Date.now()+45000"), "Silent charades needs a real timed round");
assert.ok(source.includes("localStorage.setItem(PREFIX+state.game"), "Each game must save under its own key");
assert.ok(source.includes("أونلاين</strong><small>يحتاج محرك غرف مستقل"), "Unavailable online mode must not be advertised as ready");

const memory = new Map();
const mockRoot = {hidden:true,dataset:{},innerHTML:"",attrs:{},addEventListener(){},setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]}};
const document = {
  createElement(){return mockRoot},
  body:{appendChild(){},classList:{add(){},remove(){},toggle(){}}},
  addEventListener(){},
  querySelector(){return null},
  querySelectorAll(){return []},
  documentElement:{dataset:{}}
};
const localStorage = {
  getItem(k){return memory.has(k)?memory.get(k):null},
  setItem(k,v){memory.set(k,String(v))},
  removeItem(k){memory.delete(k)}
};
const window = {matchMedia(){return {matches:false}}};
vm.runInNewContext(source,{window,document,localStorage,console,Math,Date,URL,Blob,FormData:function(){},setInterval,clearInterval,navigator:{},MediaRecorder:undefined});
assert.deepEqual(Array.from(window.SuwadWorldGames.games), expected);
for (const key of expected) assert.equal(window.SuwadWorldGames.isGame(key), true);
assert.equal(window.SuwadWorldGames.isGame("unsupported"), false);
assert.equal(window.SuwadWorldGames.start("cipher","solo"), true);
assert.equal(window.SuwadWorldGames.hasSaved("cipher"), true);
assert.ok(mockRoot.innerHTML.includes("اكسر الرمز المخفي"));
const feedback = window.SuwadWorldGames.scoreCipherGuess([1,2,3,4],[1,3,2,4]);
assert.equal(feedback.exact, 2);
assert.equal(feedback.misplaced, 2);
assert.equal(window.SuwadWorldGames.resume("cipher"), true);
assert.equal(window.SuwadWorldGames.clearSaved("cipher"), true);
assert.equal(window.SuwadWorldGames.hasSaved("cipher"), false);
assert.equal(window.SuwadWorldGames.start("ad","solo"), true);
assert.equal(window.SuwadWorldGames.hasSaved("ad"), true, "Writing-stage games must be resumable");
assert.equal(window.SuwadWorldGames.resume("ad"), true);
assert.ok(mockRoot.innerHTML.includes("سوّق هذا المنتج"));
assert.equal(window.SuwadWorldGames.clearSaved("ad"), true);
assert.equal(window.SuwadWorldGames.start("doodle","party"), true);
assert.equal(window.SuwadWorldGames.hasSaved("doodle"), true);
assert.ok(mockRoot.innerHTML.includes("wg-doodle-canvas"));
console.log("PASS: seven independent game worlds, local artwork, modes, training, theme, motion, offline assets, saves, cipher scoring, drawing canvas, local dubbing and charades timer.");
