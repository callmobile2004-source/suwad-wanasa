const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const document = {
  readyState: "loading",
  addEventListener() {},
  querySelectorAll() { return []; },
  querySelector() { return null; },
  body: { classList: { add() {}, remove() {} } },
};
const window = {};
const context = {
  window,
  document,
  localStorage: { getItem() { return null; }, setItem() {} },
  setTimeout() { return 1; },
  clearTimeout() {},
  console,
  Math,
  Date,
};
const source = fs.readFileSync(path.join(__dirname, "..", "game-ai-practice.js"), "utf8");
vm.runInNewContext(source, context, { filename: "game-ai-practice.js" });
const api = window.SuwadGameAIPractice;
assert.ok(api, "local practice engine must expose its existing testable API");

{
  const s = api.create("colors", "medium");
  const opening = s.discard[0];
  const openingDrawPenalty = opening.v === "draw2" ? 2 : 0;
  const openingSkipsFirstPlayer = ["draw2", "skip", "reverse"].includes(opening.v);
  const total = s.hands.reduce((n, hand) => n + hand.length, 0) + s.stock.length + s.discard.length;
  assert.equal(total, 108, "UNO deck must contain 108 cards");
  assert.deepEqual(
    Array.from(s.hands, hand => hand.length),
    [7 + openingDrawPenalty, 7],
    "each player receives seven cards, plus the correct opening Draw Two penalty",
  );
  assert.equal(s.discard.length, 1, "one opening card is placed on the discard pile");
  assert.equal(s.stock.length, 93 - openingDrawPenalty, "the stock reflects any opening Draw Two penalty");
  assert.notEqual(opening.v, "wild4", "Wild Draw Four cannot be the opening card");
  assert.equal(s.turn, openingSkipsFirstPlayer ? 1 : 0, "opening action cards determine who starts");
  assert.equal(s.direction, opening.v === "reverse" ? -1 : 1, "an opening Reverse changes direction");
  assert.equal(s.startWildPending, opening.v === "wild", "an opening Wild waits for a color choice");
  if (opening.v === "draw2") {
    assert.match(s.last, /كرت البداية \+٢/, "the opening Draw Two explains the penalty");
  }
}

function missedCallState() {
  const s = api.create("colors", "medium");
  s.hands = [
    [{ c: "أحمر", v: "2", kind: "number" }, { c: "أحمر", v: "3", kind: "number" }],
    [{ c: "أزرق", v: "5", kind: "number" }],
  ];
  s.stock = Array.from({ length: 20 }, (_, i) => ({ c: "أخضر", v: String(i % 10), kind: "number" }));
  s.discard = [{ c: "أحمر", v: "4", kind: "number" }];
  s.activeColor = "أحمر";
  s.drawn = [false, false];
  s.direction = 1;
  s.turn = 0;
  s.unoPending = 1;
  s.wild4Pending = null;
  s.startWildPending = false;
  return s;
}

{
  const s = missedCallState();
  api.apply(s, { type: "draw" });
  assert.equal(s.hands[1].length, 3, "if the human starts their turn without catching, Oras draws two penalty cards");
  assert.equal(s.hands[0].length, 3, "the human then draws their one requested card");
  assert.equal(s.unoPending, null, "the missed-call window closes exactly once");
}

{
  const s = missedCallState();
  api.apply(s, { type: "play", index: 0 });
  assert.equal(s.hands[1].length, 3, "playing instead of catching still penalizes the player who missed UNO");
  assert.equal(s.hands[0].length, 1, "the human's legal play is still applied after the penalty");
  assert.equal(s.unoPending, 0, "the new one-card state starts a fresh UNO call window");
}

function fixedUnoDeck(opening, wildFourBeforeOpening = false) {
  const deck = Array.from({ length: 108 }, (_, i) => ({
    c: "أحمر",
    v: String(i % 10),
    kind: "number",
  }));
  if (wildFourBeforeOpening) {
    deck[14] = { c: "wild", v: "wild4", kind: "wild" };
    deck[15] = opening;
  } else {
    deck[14] = opening;
  }
  return deck;
}

for (const [opening, expectedHands, expectedStock, expectedTurn, expectedDirection] of [
  [{ c: "أحمر", v: "draw2", kind: "action" }, [9, 7], 91, 1, 1],
  [{ c: "أزرق", v: "skip", kind: "action" }, [7, 7], 93, 1, 1],
  [{ c: "أخضر", v: "reverse", kind: "action" }, [7, 7], 93, 1, -1],
  [{ c: "wild", v: "wild", kind: "wild" }, [7, 7], 93, 0, 1],
  [{ c: "أصفر", v: "5", kind: "number" }, [7, 7], 93, 0, 1],
]) {
  const s = api.create("colors", "medium");
  api.dealPracticeUno(s, fixedUnoDeck(opening));
  assert.deepEqual(Array.from(s.hands, hand => hand.length), expectedHands, "opening action applies the correct opening hand size");
  assert.equal(s.stock.length, expectedStock, "opening action consumes only its official draw penalty");
  assert.equal(s.turn, expectedTurn, "opening action establishes the correct first turn");
  assert.equal(s.direction, expectedDirection, "opening Reverse flips direction only");
  assert.equal(s.discard[0].v, opening.v, "the selected opening card becomes the discard top");
  assert.equal(s.startWildPending, opening.v === "wild", "only a Wild opening requests a color");
}

{
  const s = api.create("colors", "medium");
  const validOpening = { c: "أحمر", v: "4", kind: "number" };
  api.dealPracticeUno(s, fixedUnoDeck(validOpening, true));
  assert.equal(s.discard[0].v, "4", "Wild Draw Four is skipped when selecting the opening card");
  assert.equal(s.stock.length, 93, "the rejected Wild Draw Four remains in the draw stock");
  assert.ok(s.stock.some(card => card.v === "wild4"), "the Wild Draw Four stays available for later play");
}

{
  const s = missedCallState();
  s.stock = [{ c: "أخضر", v: "7", kind: "number" }];
  s.discard = [
    { c: "أزرق", v: "1", kind: "number" },
    { c: "أحمر", v: "4", kind: "number" },
  ];
  api.apply(s, { type: "draw" });
  assert.equal(s.hands[1].length, 3, "the two-card missed-UNO penalty is fully drawn across a reshuffle");
  assert.deepEqual(
    Array.from(s.hands[1].slice(1), card => card.v).sort(),
    ["1", "7"],
    "reshuffling preserves both the last stock card and recyclable discard cards",
  );
  assert.equal(s.discard.length, 1, "only the top discard remains");
  assert.equal(s.discard[0].v, "4", "the top discard remains untouched");
  assert.equal(s.stock.length, 0);
}

{
  const s = missedCallState();
  api.apply(s, { type: "catchUno" });
  assert.equal(s.hands[1].length, 3, "catching UNO applies exactly two cards");
  assert.equal(s.unoPending, null);
  api.apply(s, { type: "draw" });
  assert.equal(s.hands[1].length, 3, "starting the turn after a successful catch must not double-penalize");
  assert.equal(s.hands[0].length, 3);
}

console.log("PASS: UNO 108-card deck, seven-card deal, opening card, missed-call penalty parity, catch window, and no double penalty.");
