const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..");
const client=fs.readFileSync(path.join(root,"online-games.js"),"utf8");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const sw=fs.readFileSync(path.join(root,"sw.js"),"utf8");
const css=fs.readFileSync(path.join(root,"styles.css"),"utf8");
const numberInput=require("../number-input.js");

assert.match(client,/id="onlineGuess" class="online-number-input" type="text" inputmode="numeric"/,
  "Online number guessing must use a text field with a numeric mobile keyboard");
assert.ok(client.includes('const parser=window.SuwadNumberInput?.parse;const guess=typeof parser==="function"?parser(val):null'),
  "Online guesses must use the shared Arabic/Persian digit parser");
assert.ok(!client.includes('id="onlineGuess" type="number"'),
  "Online number guessing must not use the native number field");
assert.ok(client.includes('if(room.game_key==="number"&&$("#onlineGuess"))$("#onlineGuess").onkeydown='),
  "Pressing Enter must submit an online number guess");
assert.equal(numberInput.parse("٤٠"),40,"Arabic-Indic digits must parse online");
assert.equal(numberInput.parse("۴٠"),40,"Mixed Persian/Arabic-Indic digits must parse");
assert.equal(numberInput.parse("40"),40,"Western digits must parse");
assert.equal(numberInput.parse("١٠١"),101,"Range validation remains separate from parsing");
assert.equal(numberInput.parse("٤٫٥"),null,"Decimal values must be rejected");
assert.equal(numberInput.parse(""),null,"Empty values must be rejected");
assert.ok(css.includes(".question-panel input.online-number-input{"),
  "Online numeric input needs explicit high-contrast styling");
assert.ok(html.includes('online-games.js?v=20261117-01'),
  "The browser must request the new online game client");
assert.ok(html.includes('styles.css?v=20261117-01'),
  "The browser must request the new input styling");
assert.ok(sw.includes('suwad-wanasa-shell-v94'),
  "The offline shell cache must be versioned for this update");
assert.ok(sw.includes('"./online-games.js"'),
  "The updated online game client must be included in the offline cache");
assert.ok(sw.includes('"./styles.css"'),
  "The updated styling must be included in the offline cache");
console.log("PASS: Online number input supports Arabic, Persian and Western digits, visible text entry, Enter submission, and updated PWA assets.");
