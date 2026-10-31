const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const fail = message => { console.error("FAIL:", message); process.exitCode = 1; };
const pass = message => console.log("PASS:", message);

const jsFiles = ["app.js", "social.js", "online-games.js", "hussaini-audio.js", "backend-config.js", "sw.js"];
for (const file of jsFiles) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) { fail("Missing JavaScript file " + file); continue; }
  const result = spawnSync(process.execPath, ["--check", full], { encoding: "utf8" });
  if (result.status !== 0) fail(file + " syntax error: " + (result.stderr || result.stdout).trim());
  else pass(file + " syntax");
}

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const localRefs = [...html.matchAll(/(?:src|href)="(\.\/?[^"#?]+)(?:\?[^"#]*)?"/g)].map(m => m[1]);
for (const ref of localRefs) {
  const target = path.resolve(root, ref.replace(/^\.\//, ""));
  if ((target !== root && !target.startsWith(root + path.sep)) || !fs.existsSync(target)) fail("Broken local HTML reference: " + ref);
}
if (!process.exitCode) pass("Local HTML asset references");

const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const coreMatch = sw.match(/const CORE=\[([^\]]*)\]/);
if (!coreMatch) fail("Could not read service-worker CORE list");
else {
  const assets = [...coreMatch[1].matchAll(/"([^"]+)"/g)].map(m => m[1]);
  for (const asset of assets) {
    const target = path.resolve(root, asset.replace(/^\.\//, ""));
    if ((target !== root && !target.startsWith(root + path.sep)) || !fs.existsSync(target)) fail("Missing service-worker asset: " + asset);
  }
  if (!process.exitCode) pass("Service-worker core assets");
}

const online = fs.readFileSync(path.join(root, "online-games.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const schema = fs.readFileSync(path.join(root, "supabase-schema.sql"), "utf8");
const gameBlock = online.match(/const games=\{([\s\S]*?)\n\};/);
if (!gameBlock) fail("Could not read online game registry");
else {
  const keys = [...gameBlock[1].matchAll(/^\s*(\w+):\{name:/gm)].map(m => m[1]);
  for (const key of keys) {
    if (!schema.includes("'" + key + "'")) fail("Game key missing from Supabase schema constraint: " + key);
  }
  const wheelBlock = app.match(/const wheelBaseGames=\[([\s\S]*?)\];/);
  if (!wheelBlock) fail("Could not read wheel game registry");
  else {
    const wheelKeys = [...wheelBlock[1].matchAll(/id:"([^"]+)"/g)].map(m => m[1]);
    for (const key of wheelKeys) if (!keys.includes(key)) fail("Wheel game is not registered online: " + key);
    if (!process.exitCode) pass("Wheel, online registry, and Supabase game keys agree");
  }
}

if (!schema.includes("create table if not exists public.public_messages") || !fs.existsSync(path.join(root, "supabase-public-chat-migration.sql"))) {
  fail("Public chat schema or migration is missing");
} else pass("Public chat schema and migration exist");

if (process.exitCode) process.exit(1);
console.log("Project validation completed.");
