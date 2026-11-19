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

assert.ok(html.includes('game-menu.css?v=20261117-02'),
  "The game menu stylesheet must be loaded");
assert.ok(html.includes('game-menu.js?v=20261117-04'),
  "The game menu controller must be loaded");
assert.ok(html.indexOf('game-menu.js?v=20261117-04') < html.indexOf('online-games.js?v=20261117-04'),
  "The game menu must intercept game launches before the online room click handler");
assert.ok(sw.includes('suwad-wanasa-shell-v106'),
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
  "saveLocalGameSnapshot(\"number\"","function renderLiarSession",
  "function renderMostSession","function renderYesNoSession",
  "saveLocalGameSnapshot(\"chess\"","startChessLocal(savedState=null)"
]) assert.ok(app.includes(token), "Local game progress must persist and resume: " + token);

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
for (const key of expectedGames) {
  assert.ok(css.includes('[data-game="'+key+'"]') || css.includes('[data-game="'+key+'"]'),
    "Game-specific gameplay theme must be defined for " + key);
}
assert.ok(app.includes('content.dataset.game=active.gameKey'),
  "Local game screens must carry their actual game identity");
assert.ok(practice.includes('layer.dataset.game=state.game'),
  "AI practice screens must carry their actual game identity");
assert.ok(domino.includes('layer.dataset.game="domino"'),
  "Domino practice screens must carry their actual game identity");
assert.ok(online.includes('c.dataset.game=active.gameKey') &&
  online.includes('data-game="') && online.includes('esc(room.game_key)'),
  "Online game room screens must carry their actual game identity");
assert.ok(css.includes(".game-visual.has-swgm-art"),
  "The game cards must use the clear vector artwork layer");
assert.ok(menu.includes("data-setting") && menu.includes("saveSettings"),
  "Game settings must be stored with an explicit save action");
assert.ok(menu.includes('button.id==="quickRandom"') &&
  menu.includes('button.id==="quickRandomAI"'),
  "Both wheel launch paths must open the wheel's game menu");

const assistant=read("game-assistant.js"),assistantCss=read("game-assistant.css"),typing=read("typing-effects.js"),homeCss=read("standalone-experiences.css");
assert.ok(!assistant.includes("واجهة أوراس الجديدة")&&!assistant.includes("جرب واجهة أوراس الجديدة"),"Old Oras banner must be removed");
assert.ok(assistant.includes('button.setAttribute("aria-label","فتح مساعد أوراس")'),"Oras launcher must be accessible");
assert.ok(assistantCss.includes("width:58px!important")&&assistantCss.includes("position:fixed!important"),"Oras launcher must float outside game layout");
assert.ok(typing.includes('const SELECTOR = [".typing-question", ".typing-answer"]')&&typing.includes("chars.length > 90"),"Typing effects must animate short question/answer text only");
assert.ok(homeCss.includes("#homePage .hero")&&homeCss.includes("#homePage #startNow"),"Homepage must use the updated console layout");
assert.ok(html.includes('id="startNow" data-nav-page="gamesPage"'),"Homepage start must open game catalogue");
assert.ok(!menu.includes('if(button.id==="startNow")'),"Homepage start must not launch a hard-coded game");
const learning=read("game-learning.js"),learningCss=read("game-learning.css"),gameCss=read("styles.css"); 
assert.ok(gameCss.includes(":not(#gameLearningOverlay)")&&gameCss.includes("body.modal-open>#gameLearningOverlay{pointer-events:auto!important"),"The game learning dialog must remain clickable above an open game"); 
assert.ok(learning.includes("overlay.onclick=event=>{if(event.target===overlay)close()}")&&learning.includes("lastFocus?.focus?.({preventScroll:true})"),"The game learning dialog must close reliably and restore focus"); 
assert.ok(html.includes("<h3>UNO</h3>")&&menu.includes('colors:{name:"UNO"')&&online.includes('colors:{name:"UNO"')&&practice.includes('colors:"UNO"'),"The former color-cards game must be named UNO in all modes"); 
assert.ok(gameCss.includes(".uno-card-oval")&&gameCss.includes("@keyframes uno-card-play-in")&&gameCss.includes("@keyframes uno-wild-reveal")&&gameCss.includes("@keyframes uno-call-pulse"),"UNO cards and special actions must have dedicated visual effects"); 
assert.ok(practice.includes("uno-card-oval")&&practice.includes("uno-discard-enter")&&practice.includes("uno-call-button"),"Offline UNO must render illustrated cards and an animated UNO call"); 
assert.ok(online.includes("uno-card-oval")&&online.includes("uno-discard-enter")&&online.includes("uno-call-button"),"Online UNO must render the same illustrated cards and animated UNO call"); 
assert.ok(app.includes("function chessPieceSvg")&&app.includes("window.SuwadChessPieceSvg=chessPieceSvg")&&online.includes("window.SuwadChessPieceSvg?.("),"Local and online chess must use matching vector pieces"); 
assert.ok(!domino.includes("🂠")&&domino.includes("ai-domino-back-tile"),"Domino AI hand backs must not depend on unsupported playing-card glyphs"); 
assert.ok(gameCss.includes(".uno-deck-stack")&&gameCss.includes(".chess-piece-svg"),"Deck stack and chessmen must be rendered without missing-font glyphs"); 
assert.ok(app.includes('id:"colors",name:"UNO",label:"UNO",icon:"🎴"'),"The game wheel must use the UNO name too");
assert.ok(!app.includes("🁣")&&!online.includes("🁣")&&!html.includes("🁣")&&!domino.includes("🁣"),"Domino labels must not rely on unsupported domino Unicode glyphs");
assert.ok(!app.includes("name:\"كروت الألوان\"")&&!html.includes("كروت الألوان"),"The old color-cards name must not remain in player-facing screens");
console.log("PASS: Final UNO naming and glyph-independent domino labels across wheel, tutorials, cards and online rooms.");
