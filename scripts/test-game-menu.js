const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

const html = read("index.html");
const sw = read("sw.js");
const menu = read("game-menu.js");
const css = read("game-menu.css");
const art = read("assets/game-art.svg");
const app = read("app.js");
const practice = read("game-ai-practice.js");
const domino = read("ai-practice.js");
const online = read("online-games.js");

const expectedGames = [
  "who","number","liar","yesno","most","snakes",
  "domino","tavla","colors","quiz","chess","wheel"
];

assert.ok(html.includes('game-menu.css?v=20261117-01'),
  "The game menu stylesheet must be loaded");
assert.ok(html.includes('game-menu.js?v=20261117-01'),
  "The game menu controller must be loaded");
assert.ok(html.indexOf('game-menu.js?v=20261117-01') < html.indexOf('online-games.js?v=20261117-01'),
  "The game menu must intercept game launches before the online room click handler");
assert.ok(sw.includes('suwad-wanasa-shell-v95'),
  "The service worker shell must use the new cache version");

const coreMatch = sw.match(/const CORE=\[([^\]]*)\]/);
assert.ok(coreMatch, "The service worker CORE cache list must exist");
const coreAssets = [...coreMatch[1].matchAll(/"([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(coreAssets).size, coreAssets.length,
  "The service worker CORE cache list must not contain duplicates");
for (const file of ["./game-menu.css","./game-menu.js","./assets/game-art.svg"]) {
  assert.ok(coreAssets.includes(file), file + " must be available offline");
  assert.ok(fs.existsSync(path.join(root, file.replace(/^\.\//, ""))),
    file + " must exist in the repository");
}

for (const key of expectedGames) {
  assert.ok(menu.includes(key + ":{name:") || menu.includes(key + ":{name:") || new RegExp("\\b"+key+":\\{name:").test(menu),
    "The game menu must define its own identity for " + key);
  assert.ok(art.includes('<symbol id="' + key + '"'),
    "Crisp vector artwork must exist for " + key);
}
for (const label of ["بداية اللعبة","بداية جديدة","تكملة","إعدادات اللعبة"]) {
  assert.ok(menu.includes(label), "The game menu must show: " + label);
}
for (const token of [
  "function resumeKind","function continueGame","window.SuwadGameMenu",
  "window.SuwadGameAIPractice?.resume","window.SuwadDominoPractice?.resumeSaved",
  "window.resumeSuwadSavedRoom","window.resumeSuwadLocalGame"
]) assert.ok(menu.includes(token), "The menu must connect a real action: " + token);

for (const token of [
  "function saveLocalGameSnapshot","function readLocalGameSnapshot",
  "window.resumeSuwadLocalGame","saveLocalGameSnapshot(\"who\"",
  "saveLocalGameSnapshot(\"number\""
]) assert.ok(app.includes(token), "Local Who/Number progress must persist: " + token);

for (const token of [
  "function persistPracticeState","function resume(game)",
  "hasSavedGame:hasSavedPracticeGame","clearSavedGame:clearSavedPracticeGame"
]) assert.ok(practice.includes(token), "AI practice resume support is missing: " + token);

for (const token of [
  "function resumeSaved()","function hasSaved()","function clearSaved()",
  "window.SuwadDominoPractice={open,resumeSaved,hasSaved,clearSaved}"
]) assert.ok(domino.includes(token), "Domino practice resume support is missing: " + token);

for (const token of [
  "sw_online_last_room_v1_","window.hasSuwadSavedRoom",
  "window.clearSuwadSavedRoom","window.resumeSuwadSavedRoom"
]) assert.ok(online.includes(token), "Online room continue support is missing: " + token);

assert.ok(css.includes(".swgm-overlay") && css.includes(".swgm-art-stage") &&
  css.includes("@media(max-width:620px)"),
  "The per-game menu must have a full-screen responsive layout");
assert.ok(css.includes(".game-visual.has-swgm-art"),
  "The game cards must use the clear vector artwork layer");
assert.ok(menu.includes("data-setting") && menu.includes("saveSettings"),
  "Game settings must be stored with an explicit save action");
assert.ok(menu.includes('button.id==="quickRandom"') &&
  menu.includes('button.id==="quickRandomAI"'),
  "Both wheel launch paths must open the wheel's game menu");

console.log("PASS: Per-game menu, start/new/continue/settings actions, vector game artwork, local and online resume paths, responsive styles and offline assets.");
