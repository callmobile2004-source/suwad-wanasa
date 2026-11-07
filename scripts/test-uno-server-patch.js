const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const patch = fs.readFileSync(path.join(__dirname, "..", "supabase", "patches", "20261107_fix_uno_opening_draw2_target.sql"), "utf8");
assert.match(patch, /CREATE OR REPLACE FUNCTION public\.engine_v3_apply_action/);
assert.match(patch, /SECURITY DEFINER/);
assert.match(patch, /SET search_path TO ''/);
const opening = patch.slice(patch.indexOf("IF v_top->>'v'='draw2' THEN"));
assert.match(opening, /v_target_id:=v_players\[1\+v_turn\]/, "opening +2 must draw for the next player selected by the zero-based turn");
assert.doesNotMatch(opening.slice(0, opening.indexOf("END IF;")), /v_target_id:=v_players\[1\];/, "opening +2 must not draw for the player who just played the opening card");
for (const action of ["challenge-wild4", "accept-wild4", "call-uno", "catch-uno", "choose-start-color"]) {
  assert.ok(patch.includes(action), "server wrapper retains " + action);
}
assert.match(patch, /jsonb_array_length\(v_deck\)<>108/, "server UNO deck remains 108 cards");
console.log("PASS: review-only server UNO patch preserves wrapper security and fixes opening Draw Two target.");
