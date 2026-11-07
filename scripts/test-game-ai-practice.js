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

// Local UNO uses the same 108-card classic deck and seven-card opening hands as online.
const unoOpening = engine.create("colors", "medium");
assert.equal(unoOpening.hands[0].length, 7);
assert.equal(unoOpening.hands[1].length, 7);
assert.equal(unoOpening.discard.length, 1);
assert.notEqual(unoOpening.discard[0].v, "wild4", "Wild Draw Four cannot be the opening discard");
assert.equal(unoOpening.stock.length + unoOpening.hands[0].length + unoOpening.hands[1].length + unoOpening.discard.length, 108);

// Opening card effects match the online UNO engine.
function openingDeck(opening) {
  const deck = Array.from({ length: 108 }, (_, i) => ({ c: ["أحمر", "أزرق", "أخضر", "أصفر"][i % 4], v: String(i % 10), kind: "number" }));
  deck[14] = { c: "wild", v: "wild4", kind: "wild" };
  deck[15] = opening;
  return deck;
}
const openingCases = [
  [{ c: "أحمر", v: "reverse", kind: "action" }, 1, -1],
  [{ c: "أحمر", v: "skip", kind: "action" }, 1, 1],
  [{ c: "أحمر", v: "draw2", kind: "action" }, 1, 1],
  [{ c: "أحمر", v: "3", kind: "number" }, 0, 1],
  [{ c: "wild", v: "wild", kind: "wild" }, 0, 1]
];
for (const [card, expectedTurn, expectedDirection] of openingCases) {
  const state = engine.create("colors", "medium");
  engine.dealPracticeUno(state, openingDeck(card));
  assert.equal(state.discard[0].v, card.v);
  assert.equal(state.turn, expectedTurn, card.v + " opening turn");
  assert.equal(state.direction, expectedDirection, card.v + " opening direction");
  assert.ok(state.stock.some(x => x.v === "wild4"), "Wild Draw Four remains in stock");
  if (card.v === "draw2") assert.equal(state.hands[1].length, 9);
  if (card.v === "wild") {
    assert.equal(state.startWildPending, true);
    assert.equal(state.activeColor, null);
    engine.apply(state, { type: "chooseStartColor", color: "أخضر" });
    assert.equal(state.activeColor, "أخضر");
    assert.equal(state.startWildPending, false);
  }
}

// Wild Draw Four bluffing is allowed, and the next player can challenge an illegal play.
const illegalFour = engine.create("colors", "medium");
illegalFour.hands[0] = [{ c: "wild", v: "wild4", kind: "wild" }, { c: "أزرق", v: "2", kind: "number" }];
illegalFour.hands[1] = [{ c: "أخضر", v: "3", kind: "number" }];
illegalFour.discard = [{ c: "أزرق", v: "5", kind: "number" }];
illegalFour.activeColor = "أزرق";
engine.apply(illegalFour, { type: "play", index: 0, color: "أحمر" });
assert.equal(illegalFour.wild4Pending.illegal, true);
assert.equal(illegalFour.turn, 1);
assert.equal(illegalFour.hands[1].length, 1, "no cards are drawn until the target responds");
engine.apply(illegalFour, { type: "callUno" });
engine.apply(illegalFour, { type: "challengeWild4" });
assert.equal(illegalFour.hands[0].length, 5, "successful challenge makes the offender draw four");
assert.equal(illegalFour.turn, 1, "successful challenge gives the target their turn");
assert.equal(illegalFour.wild4Pending, null);

// A legal +4 can be accepted for four cards or unsuccessfully challenged for six.
const acceptedFour = engine.create("colors", "medium");
acceptedFour.hands[0] = [{ c: "wild", v: "wild4", kind: "wild" }, { c: "أحمر", v: "2", kind: "number" }];
acceptedFour.hands[1] = [{ c: "أخضر", v: "3", kind: "number" }];
acceptedFour.discard = [{ c: "أزرق", v: "5", kind: "number" }];
acceptedFour.activeColor = "أزرق";
engine.apply(acceptedFour, { type: "play", index: 0, color: "أحمر" });
engine.apply(acceptedFour, { type: "callUno" });
engine.apply(acceptedFour, { type: "acceptWild4" });
assert.equal(acceptedFour.hands[1].length, 5);
assert.equal(acceptedFour.turn, 0);

const failedChallenge = engine.create("colors", "medium");
failedChallenge.hands[0] = [{ c: "wild", v: "wild4", kind: "wild" }, { c: "أحمر", v: "2", kind: "number" }];
failedChallenge.hands[1] = [{ c: "أخضر", v: "3", kind: "number" }];
failedChallenge.discard = [{ c: "أزرق", v: "5", kind: "number" }];
failedChallenge.activeColor = "أزرق";
engine.apply(failedChallenge, { type: "play", index: 0, color: "أحمر" });
engine.apply(failedChallenge, { type: "callUno" });
engine.apply(failedChallenge, { type: "challengeWild4" });
assert.equal(failedChallenge.hands[1].length, 7, "failed challenge makes the challenger draw six");
assert.equal(failedChallenge.turn, 0);

// A final-card +4 waits for the challenge window before awarding the round and 500-point match score.
const lastFour = engine.create("colors", "medium");
lastFour.hands[0] = [{ c: "wild", v: "wild4", kind: "wild" }];
lastFour.hands[1] = [{ c: "أزرق", v: "5", kind: "number" }];
lastFour.discard = [{ c: "أزرق", v: "2", kind: "number" }];
lastFour.activeColor = "أزرق";
lastFour.unoMatchScores = [495, 0];
engine.apply(lastFour, { type: "play", index: 0, color: "أحمر" });
assert.equal(lastFour.status, "playing", "round cannot settle before +4 response");
assert.equal(lastFour.roundEndPending, 0);
engine.apply(lastFour, { type: "acceptWild4" });
assert.equal(lastFour.status, "finished");
assert.equal(lastFour.matchWinner, 0, "500-point target ends the match");
assert.ok(lastFour.unoMatchScores[0] >= 500);
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


// Catching Oras before the human starts their turn draws two cards for Oras.
const catchOras = engine.create("colors", "medium");
catchOras.hands[1] = [{ c: "أحمر", v: "2", kind: "number" }];
catchOras.stock = Array.from({ length: 8 }, (_, i) => ({ c: "أزرق", v: String(i), kind: "number" }));
catchOras.unoPending = 1;
engine.apply(catchOras, { type: "catchUno" });
assert.equal(catchOras.hands[1].length, 3);
assert.equal(catchOras.unoPending, null);

// Draw Two gives the opponent two cards and skips their turn in a two-player game.
const drawTwo = engine.create("colors", "medium");
drawTwo.hands[0] = [{ c: "أزرق", v: "draw2", kind: "action" }, { c: "أحمر", v: "7", kind: "number" }];
drawTwo.hands[1] = [{ c: "أخضر", v: "3", kind: "number" }];
drawTwo.discard = [{ c: "أزرق", v: "5", kind: "number" }];
drawTwo.activeColor = "أزرق";
engine.apply(drawTwo, { type: "play", index: 0 });
assert.equal(drawTwo.hands[1].length, 3);
assert.equal(drawTwo.turn, 0);

console.log("Local practice Snakes and UNO rules passed.");
