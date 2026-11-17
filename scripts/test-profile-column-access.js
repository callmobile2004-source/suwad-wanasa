const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const source = fs.readFileSync(path.join(__dirname, "..", "social.js"), "utf8");
const profileQueries = [...source.matchAll(/\.from\(["']profiles["']\)\s*\.select\(\s*["']([^"']+)["']\s*\)/g)];

assert.ok(profileQueries.length > 0, "Expected direct profiles queries in social.js");
for (const match of profileQueries) {
  assert.notEqual(match[1].trim(), "*", "Profiles queries must never request every column");
  assert.ok(!match[1].split(",").some(column => column.trim() === "*"),
    "Profiles queries must not include wildcard columns");
}
assert.ok(
  source.includes('db.from("profiles").select("id,username,display_name,friend_code,created_at,avatar_url,equipped_title_id").eq("id",userId).maybeSingle()'),
  "Own-profile query must use the explicit columns granted to authenticated users",
);
console.log("Profile column-access regression tests passed.");
