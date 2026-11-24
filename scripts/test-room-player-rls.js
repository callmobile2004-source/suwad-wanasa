const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const roomEngine = fs.readFileSync(path.join(root, "supabase/functions/room-engine/index.ts"), "utf8");
const wanasaAi = fs.readFileSync(path.join(root, "supabase/functions/wanasa-ai/index.ts"), "utf8");

const failures = [];
const pass = (message) => console.log("PASS:", message);
const fail = (message) => failures.push(message);

if (!roomEngine.includes('Authorization: `Bearer ${accessToken}`')) {
  fail("room-engine user client must forward the verified caller JWT for RLS");
} else {
  pass("room-engine user client forwards the verified caller JWT");
}

if (!wanasaAi.includes('Authorization: `Bearer ${token}`')) {
  fail("wanasa-ai user client must forward the verified caller JWT for RLS");
} else {
  pass("wanasa-ai user client forwards the verified caller JWT");
}

if (/admin\s*\.from\(\s*["']game_room_players["']\s*\)/.test(roomEngine)) {
  fail("room-engine must not query game_room_players through the service-role client");
} else {
  pass("room-engine has no service-role reads from game_room_players");
}

if (/admin\s*\.from\(\s*["']game_room_players["']\s*\)/.test(wanasaAi)) {
  fail("wanasa-ai must not query game_room_players through the service-role client");
} else {
  pass("wanasa-ai has no service-role reads from game_room_players");
}

for (const [source, label] of [[roomEngine, "room-engine"], [wanasaAi, "wanasa-ai"]]) {
  if (!/userClient\s*\.from\(\s*["']game_room_players["']\s*\)/.test(source)) {
    fail(label + " must resolve room membership through the RLS-scoped user client");
  } else {
    pass(label + " resolves room membership through the RLS-scoped user client");
  }
}

if (!roomEngine.includes("chessPlayers.find((player) => player.user_id === actorId)") ||
    !roomEngine.includes('responseError("لست عضواً في هذه الغرفة.", 403, "42501")')) {
  fail("Chess player membership and denial behavior must remain intact");
}

if (!roomEngine.includes('if (!membership) return responseError("لست عضواً في هذه الغرفة.", 403);')) {
  fail("Tournament snapshot must continue rejecting non-members");
}

if (!wanasaAi.includes('if (!membership || !room || room.status !== "playing")')) {
  fail("Oras commentator must continue requiring an active room member");
} else {
  pass("Chess, tournament and Oras membership rejection guards are preserved");
}

if (!roomEngine.includes("createClient(supabaseUrl, serviceRoleKey") ||
    !wanasaAi.includes("createClient(url, service")) {
  fail("Privileged service client must remain available for server-authoritative actions");
} else {
  pass("Service-role clients remain available only for privileged server operations");
}

if (failures.length) {
  for (const message of failures) console.error("FAIL:", message);
  process.exit(1);
}

console.log("Room-player RLS source contract tests completed.");
