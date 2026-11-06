const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "game-ai-practice.js"), "utf8");
const window = {};
const document = { readyState: "loading", addEventListener() {} };
vm.runInNewContext(source, { window, document, console, Math, Date, Promise, setTimeout, clearTimeout }, { filename: "game-ai-practice.js" });
const engine = window.SuwadGameAIPractice;
assert.ok(engine, "local practice engine exports its test surface");

// Every new local Snakes round receives six distinct snakes and six distinct ladders.
const snakes = engine.create("snakes", "medium");
assert.equal(snakes.snakes.length, 6);
assert.equal(snakes.ladders.length, 6);
const occupied = [...snakes.snakes.flatMap(x => [x.from, x.to]), ...snakes.ladders.flatMap(x => [x.from, x.to])];
assert.equal(new Set(occupied).size, 24, "snake and ladder endpoints do not overlap");
assert.ok(snakes.snakes.every(x => x.from > x.to && x.from - x.to >= 8));
assert.ok(snakes.ladders.every(x => x.to > x.from && x.to - x.from >= 8));
const humanRoll = engine.apply(snakes, { type: "roll" });
assert.ok(humanRoll.pendingMove);
assert.equal(humanRoll.pendingMove.actor, 0);
assert.equal(humanRoll.positions[0], 0, "piece stays at its old square until animation completes");
assert.equal(humanRoll.turn, 0, "turn does not change before movement completes");
assert.ok(humanRoll.dice >= 1 && humanRoll.dice <= 6);
const botState = { ...snakes, turn: 1, pendingMove: null, positions: [0, 0] };
const botRoll = engine.botTurn(botState);
assert.equal(botRoll.pendingMove.actor, 1);
assert.equal(botRoll.positions[1], 0, "Oras movement is also deferred until animation");

// The local card mode uses the standard 108-card UNO deck and seven cards per player.
const uno = engine.create("colors", "medium");
assert.equal(uno.hands[0].length, 7);
assert.equal(uno.hands[1].length, 7);
assert.equal(uno.stock.length + uno.discard.length + uno.hands[0].length + uno.hands[1].length, 108);
const cardCounts = new Map();
for (const card of [...uno.hands[0], ...uno.hands[1], ...uno.stock, ...uno.discard]) {
  const key = card.c === "wild" ? "wild" : card.c;
  cardCounts.set(key, (cardCounts.get(key) || 0) + 1);
}
for (const color of ["أحمر", "أزرق", "أخضر", "أصفر"]) assert.equal(cardCounts.get(color), 25);
assert.equal(cardCounts.get("wild"), 8);

// Wild color choice and UNO call.
const wild = engine.create("colors", "medium");
wild.hands[0] = [{ c: "wild", v: "wild", kind: "wild" }, { c: "أحمر", v: "2", kind: "number" }];
wild.discard = [{ c: "أحمر", v: "5", kind: "number" }];
wild.activeColor = "أحمر";
let result = engine.apply(wild, { type: "play", index: 0 });
assert.equal(result.wildIndex, 0, "wild card asks for a selected color");
result = engine.apply(wild, { type: "play", index: 0, color: "أزرق" });
assert.equal(result.activeColor, "أزرق");
assert.equal(result.hands[0].length, 1);
assert.equal(result.unoPending, 0);
engine.apply(wild, { type: "callUno" });
assert.equal(wild.unoPending, null);

// Wild Draw Four cannot be played while a card of the current color is held.
const illegalFour = engine.create("colors", "medium");
illegalFour.hands[0] = [{ c: "wild", v: "wild4", kind: "wild" }, { c: "أزرق", v: "2", kind: "number" }];
illegalFour.discard = [{ c: "أزرق", v: "5", kind: "number" }];
illegalFour.activeColor = "أزرق";
engine.apply(illegalFour, { type: "play", index: 0, color: "أحمر" });
assert.equal(illegalFour.hands[0].length, 2);
assert.match(illegalFour.last, /ما ينلعب/);

// Legal Wild Draw Four draws four cards and skips the next player.
const legalFour = engine.create("colors", "medium");
legalFour.hands[0] = [{ c: "wild", v: "wild4", kind: "wild" }, { c: "أحمر", v: "2", kind: "number" }];
legalFour.hands[1] = [{ c: "أخضر", v: "3", kind: "number" }];
legalFour.discard = [{ c: "أزرق", v: "5", kind: "number" }];
legalFour.activeColor = "أزرق";
engine.apply(legalFour, { type: "play", index: 0, color: "أحمر" });
assert.equal(legalFour.hands[1].length, 5);
assert.equal(legalFour.turn, 0);

// Reverse and Skip both return the turn to the same player in a two-player game.
for (const action of ["reverse", "skip"]) {
  const state = engine.create("colors", "medium");
  state.hands[0] = [{ c: "أزرق", v: action, kind: "action" }, { c: "أحمر", v: "7", kind: "number" }];
  state.discard = [{ c: "أزرق", v: "5", kind: "number" }];
  state.activeColor = "أزرق";
  engine.apply(state, { type: "play", index: 0 });
  assert.equal(state.turn, 0, action + " skips the other player in a two-player game");
  if (action === "reverse") assert.equal(state.direction, -1);
}

// A missed UNO call is caught by Oras and draws two cards.
const missed = engine.create("colors", "medium");
missed.hands[0] = [{ c: "أزرق", v: "3", kind: "number" }, { c: "أحمر", v: "7", kind: "number" }];
missed.hands[1] = [{ c: "أخضر", v: "2", kind: "number" }, { c: "أصفر", v: "8", kind: "number" }];
missed.discard = [{ c: "أزرق", v: "5", kind: "number" }];
missed.activeColor = "أزرق";
engine.apply(missed, { type: "play", index: 0 });
assert.equal(missed.unoPending, 0);
engine.botTurn(missed);
assert.equal(missed.hands[0].length, 3, "missed UNO call incurs a two-card penalty");

console.log("Local practice Snakes and UNO rules passed.");
