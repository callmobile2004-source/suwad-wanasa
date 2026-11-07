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
  const total = s.hands.reduce((n, hand) => n + hand.length, 0) + s.stock.length + s.discard.length;
  assert.equal(total, 108, "UNO deck must contain 108 cards");
  assert.deepEqual(s.hands.map(hand => hand.length), [7, 7], "each player receives seven cards");
  assert.equal(s.discard.length, 1, "one opening card is placed on the discard pile");
  assert.equal(s.stock.length, 93, "93 cards remain after dealing and opening");
  assert.notEqual(s.discard[0].v, "wild4", "Wild Draw Four cannot be the opening card");
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
    s.hands[1].slice(1).map(card => card.v).sort(),
    ["1", "7"],
    "reshuffling preserves both the last stock card and recyclable discard cards",
  );
  assert.deepEqual(s.discard, [{ c: "أحمر", v: "4", kind: "number" }], "the top discard remains untouched");
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
