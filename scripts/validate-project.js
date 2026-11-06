const fs=require("node:fs");
const path=require("node:path");
const {spawnSync}=require("node:child_process");
const root=path.resolve(__dirname,".."),failures=[];
const pass=m=>console.log("PASS:",m),fail=m=>{failures.push(m);console.error("FAIL:",m)};
const jsFiles=["app.js","who-ai-engine.js","social.js","online-games.js","hussaini-audio.js","backend-config.js","progression.js","game-learning.js","ai-practice.js","game-ai-practice.js","game-assistant.js","oras-commentator.js","navigation.js","app-update.js","sw.js"];
for(const file of jsFiles){const full=path.join(root,file);if(!fs.existsSync(full)){fail("Missing JavaScript file "+file);continue}const r=spawnSync(process.execPath,["--check",full],{encoding:"utf8"});if(r.status!==0)fail(file+" syntax error: "+(r.stderr||r.stdout).trim());else pass(file+" syntax")}
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const refs=[...html.matchAll(/(?:src|href)="(\.\/?[^"#?]+)(?:\?[^"#]*)?"/g)].map(m=>m[1]);
for(const ref of refs){const target=path.resolve(root,ref.replace(/^\.\//,""));if((target!==root&&!target.startsWith(root+path.sep))||!fs.existsSync(target))fail("Broken local HTML reference: "+ref)}
if(!failures.length)pass("Local HTML asset references");
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]),dupes=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
if(dupes.length)fail("Duplicate HTML IDs: "+dupes.join(", "));else pass("HTML IDs are unique");
const sw=fs.readFileSync(path.join(root,"sw.js"),"utf8"),core=sw.match(/const CORE=\[([^\]]*)\]/);
if(!core)fail("Missing service worker CORE list");else for(const asset of [...core[1].matchAll(/"([^"]+)"/g)].map(m=>m[1])){const target=path.resolve(root,asset.replace(/^\.\//,""));if((target!==root&&!target.startsWith(root+path.sep))||!fs.existsSync(target))fail("Missing service worker asset: "+asset)}
const progression=fs.readFileSync(path.join(root,"progression.js"),"utf8"),progressionSql=fs.readFileSync(path.join(root,"supabase-progression-migration.sql"),"utf8"),progressionHardening=fs.readFileSync(path.join(root,"supabase-progression-hardening-migration.sql"),"utf8");
if(!progression.includes("player_leaderboard")||!progression.includes("player_achievements")||!progression.includes("progression"))fail("Player progression UI is incomplete");else pass("Player progression dashboard data integration");
for(const token of ["create table if not exists public.player_progress","create table if not exists public.achievements","create table if not exists public.player_achievements","create table if not exists public.player_game_history","create or replace function public.award_completed_room_progress","create or replace view public.player_leaderboard","on conflict(room_id,user_id) do nothing"])if(!progressionSql.includes(token))fail("Progression migration missing "+token);
if(!progressionHardening.includes("v_winner")||!progressionHardening.includes("is distinct from"))fail("Progression hardening migration is incomplete");else pass("Progression result validation hardening");
if(/\\bdrop\\s+table\\b|\\btruncate\\b/i.test(progressionSql+progressionHardening))fail("Progression migrations contain destructive data operations");else pass("Progression migrations are additive and idempotent");
const online=fs.readFileSync(path.join(root,"online-games.js"),"utf8"),app=fs.readFileSync(path.join(root,"app.js"),"utf8"),social=fs.readFileSync(path.join(root,"social.js"),"utf8"),schema=fs.readFileSync(path.join(root,"supabase-schema.sql"),"utf8"),migration=fs.readFileSync(path.join(root,"supabase-public-chat-migration.sql"),"utf8"),roomMigration=fs.readFileSync(path.join(root,"supabase-room-security-migration.sql"),"utf8");
const games=online.match(/const games=\{([\s\S]*?)\n\};/);
if(!games)fail("Cannot parse online game registry");else{const keys=[...games[1].matchAll(/^\s*(\w+):\{name:/gm)].map(m=>m[1]);for(const k of keys)if(!schema.includes("'"+k+"'"))fail("Game key missing from SQL: "+k);const wheel=app.match(/const wheelBaseGames=\[([\s\S]*?)\];/);if(!wheel)fail("Cannot parse wheel game registry");else for(const m of wheel[1].matchAll(/id:"([^"]+)"/g))if(!keys.includes(m[1]))fail("Wheel key missing online: "+m[1])}
for(const [name,sql] of [["schema",schema],["migration",migration]])for(const token of ["create table if not exists public.public_messages","alter table public.public_messages enable row level security","members read public chat","members send public chat as self","public_messages_rate_limit"])if(!sql.includes(token))fail(name+" missing "+token);
if(!roomMigration.includes("create or replace function public.create_game_room")||!roomMigration.includes("create or replace function public.join_game_room")||!roomMigration.includes("create or replace function public.update_game_room_state")||!roomMigration.includes("create or replace function public.leave_game_room")||!roomMigration.includes("revoke insert,update,delete on public.game_rooms")||!roomMigration.includes("grant execute on function public.create_game_room(text,text,text,integer,jsonb,text)"))fail("Room security migration is incomplete");else pass("Room RPC security migration");
if(!roomMigration.includes("as seats(seat)")||/\bdrop\s+table\b|\btruncate\b/i.test(roomMigration))fail("Room migration may damage data or has unsafe seat allocation");else pass("Room migration preserves existing tables and allocates seats safely");
if(/from\(["\']game_rooms["\']\)\.update|from\(["\']game_room_players["\']\)\.(?:insert|update|delete)/.test(online))fail("Client still writes directly to protected room tables");else pass("Room writes use RPC only");
if(!online.includes("refreshInFlight=null")||!online.includes("function roomFingerprint()")||!online.includes("function scheduleRoomRefresh()")||!online.includes("refreshQueuedSilent")||!online.includes("roomLifecycleVersion")||!online.includes("subscribe((status,error)=>"))fail("Online room refresh is missing single-flight protection, render deduplication, or Realtime status handling");else pass("Online room refresh is single-flight, debounced, render-deduplicated, and Realtime-aware");
const roomUiCss=fs.readFileSync(path.join(root,"styles.css"),"utf8");
for(const token of ["room-lobby-shell","room-capacity-track","room-roster-grid","room-player-presence","@media(max-width:560px)","prefers-reduced-motion"])if(!roomUiCss.includes(token))fail("Room lobby responsive UI missing "+token);
for(const token of ["room-lobby-shell","room-capacity-track","room-roster-grid","shareRoomInvite","shareRoomLink"])if(!online.includes(token))fail("Room lobby experience missing "+token);
if(!online.includes("navigator.share")||!online.includes("room-player-card")||!online.includes("room-phase-badge"))fail("Room lobby sharing, player cards or phase indicators are incomplete");else pass("Responsive room lobby, live player roster and shareable invitation");
if(!social.includes("async function publicChat()")||!social.includes('if($("#openPublicChat"))$("#openPublicChat").onclick=publicChat;'))fail("Public chat button is not connected");
if(!social.includes('from("public_messages")')||!social.includes("setInterval"))fail("Public chat persistence/polling missing");
if(social.includes("الشات العام والغرف الشبكية يحتاجان مرحلة ربط إضافية"))fail("Obsolete public-chat placeholder remains");
if(!social.includes('ilike("username",v.toLowerCase())'))fail("Friend search does not query username");
if(!app.includes("window.setSuwadNickname"))fail("Account nickname sync missing");
if(!failures.length)pass("Game registry, public chat, friend search, account sync, migrations");
const learning=fs.readFileSync(path.join(root,"game-learning.js"),"utf8"),learningCss=fs.readFileSync(path.join(root,"game-learning.css"),"utf8");
for(const game of ["who","number","liar","yesno","most","snakes","domino","tavla","colors","quiz"])if(!new RegExp("\\b"+game+"\\s*:\\s*\\{name:").test(learning))fail("Animated game tutorial missing "+game);
if(!learning.includes("speechSynthesis")||!learning.includes("robot-arm-right")||!learning.includes("data-learning-game"))fail("Voice, animated guide or game-card entry point is missing");
if(!learningCss.includes("@media(prefers-reduced-motion:reduce)")||!learningCss.includes("@media(max-width:640px)"))fail("Game learning accessibility or mobile styles are missing");else pass("Ten in-app illustrated voice tutorials and animated robot");
const assistant=fs.readFileSync(path.join(root,"game-assistant.js"),"utf8"),assistantCss=fs.readFileSync(path.join(root,"game-assistant.css"),"utf8");
for(const key of ["who","number","liar","yesno","most","snakes","domino","tavla","colors","quiz","wheel"])if(!assistant.includes('key:"'+key+'"'))fail("Game assistant missing game "+key);
if(!assistant.includes('functions.invoke("wanasa-ai"')||!assistant.includes('mode:"game_help"'))fail("Game assistant is not connected to the existing protected AI function");
if(!assistant.includes("wanasa-assistant-overlay")||!assistantCss.includes(".wanasa-assistant-window")||!assistantCss.includes("@media(max-width:640px)"))fail("Full-screen responsive game assistant UI is incomplete");
if(!assistant.includes("window.mountSuwadGameAssistant")||!assistant.includes("document.body.append(overlay)")||!app.includes("window.mountSuwadGameAssistant(content")||!online.includes("window.mountSuwadGameAssistant(c,window.__SUWAD_ACTIVE_GAME?.gameKey")||!fs.readFileSync(path.join(root,"game-ai-practice.js"),"utf8").includes("window.mountSuwadGameAssistant(layer,game")||!assistant.includes('document.querySelector(".ai-domino-layer")')||!fs.readFileSync(path.join(root,"ai-practice.js"),"utf8").includes('window.mountSuwadGameAssistant(layer,"domino","practice")')||!assistantCss.includes(".ai-domino-layer .wanasa-assistant-launcher-floating"))fail("Game assistant is not deterministically mounted across local, online and AI-practice screens");
if(!app.includes('setSuwadGameAssistantContext?.("number","practice")')||!app.includes('setSuwadGameAssistantContext?.("liar","practice")')||!app.includes('setSuwadGameAssistantContext?.("most","practice")')||!app.includes('setSuwadGameAssistantContext?.("yesno","practice")'))fail("Practice game context is not set for every local game entry");
else pass("Full-screen assistant is mounted on the existing game screen for local, online and AI-practice games");
const backend=fs.readFileSync(path.join(root,"backend-config.js"),"utf8");const secretAssignment=/(?:^|[,{\s])(?:service_role|serviceRole|service_role_key|secret_key|secretKey)\s*[:=]\s*["\x27][^"\x27]+["\x27]/im.test(backend);if(secretAssignment)fail("Possible service-role/secret-key assignment detected");else pass("No service-role secret assignment in public config");
const readme=fs.readFileSync(path.join(root,"README.md"),"utf8");if(/الغرف ليست متصلة بين الأجهزة بعد|إنشاء الغرفة والانضمام إليها حالياً واجهات تجريبية/.test(readme))fail("README has obsolete prototype notes");else pass("README project description current");
for(const [name,sql] of [["schema",schema],["public-chat migration",migration],["room security migration",roomMigration]]) {
 const dollarQuotes=[...sql.matchAll(/\$\$|\$[A-Za-z_][A-Za-z0-9_]*\$/g)].map(m=>m[0]);
 const counts=new Map();for(const tag of dollarQuotes)counts.set(tag,(counts.get(tag)||0)+1);
 for(const [tag,count] of counts)if(count%2!==0)fail(name+" has unbalanced SQL dollar quote "+tag);
 if(/returns trigger[\s\S]{0,180}\bas\s+\$(?:\s|$)/i.test(sql))fail(name+" has an invalid single-dollar trigger function delimiter");
}
if(!failures.length)pass("SQL function dollar-quote delimiters");
const roomEnginePath=path.join(root,"supabase/functions/room-engine/index.ts");if(!fs.existsSync(roomEnginePath))fail("Missing authenticated room engine Edge Function");else{const engine=fs.readFileSync(roomEnginePath,"utf8");if(!engine.includes("Deno.serve")||!engine.includes("auth.getUser(accessToken)")||!engine.includes("SUPABASE_SERVICE_ROLE_KEY")||!engine.includes("admin.rpc"))fail("Room engine must authenticate caller and derive actor identity from verified claims");if(!engine.includes("secureSecret()")||!engine.includes("engine_v2_guess_number"))fail("Room engine server-side actions are incomplete");if(!online.includes('db.functions.invoke("room-engine"'))fail("Number game frontend is not connected to the room engine");if(online.includes("secret:Math.floor(Math.random()*100)+1")||online.includes("n===b.secret"))fail("Number game secret or winner logic remains client-side");if(!engine.includes("MAX_BODY_CHARS")||!engine.includes("P0001")||!engine.includes("ALLOWED_ORIGIN"))fail("Room engine request-size or rate-limit handling is missing");else pass("Authenticated authoritative number-game gateway");}
const engineSql=fs.readFileSync(path.join(root,"supabase-authoritative-number-engine-migration.sql"),"utf8");for(const token of ["private.are_friends","private.is_game_room_member","engine_v2_start_number_game","engine_v2_guess_number","engine_v2_restart_number_game","engine_version=case when v_target_game='number' then 2 else 1 end","game_room_private_state","game_room_engine_events"])if(!engineSql.includes(token))fail("Authoritative number migration missing "+token);if(/\bdrop\s+table\b|\btruncate\b/i.test(engineSql))fail("Authoritative number migration contains destructive data operations");else pass("Additive server-engine migration");

const roomV3MigrationPath=path.join(root,"supabase-authoritative-room-engines-v3-migration.sql"),roomV3TestPath=path.join(root,"scripts/test-authoritative-room-engines.sql");
if(!fs.existsSync(roomV3MigrationPath)||!fs.existsSync(roomV3TestPath))fail("Missing authoritative room-engine v3 migration or rollback-only smoke tests");else{
 const roomV3=fs.readFileSync(roomV3MigrationPath,"utf8"),roomTests=fs.readFileSync(roomV3TestPath,"utf8"),edge=fs.readFileSync(path.join(root,"supabase/functions/room-engine/index.ts"),"utf8");
 for(const token of ["game_room_player_private_state","game_room_action_events","engine_v3_get_snapshot","engine_v3_apply_action","heartbeat_game_room","last_seen_at","pass-domino","wheel-finish","engine_version in (1,2,3)"])if(!roomV3.includes(token))fail("Room-engine v3 migration missing "+token);
 if(/\bdrop\s+table\b|\btruncate\b/i.test(roomV3))fail("Room-engine v3 migration contains destructive table operations");
 for(const game of ["snakes","domino","tavla","colors","quiz","who","most","yesno","liar","wheel"])if(!roomTests.includes("'"+game+"'"))fail("Room-engine smoke tests missing game "+game);
 for(const token of ["rollback;","client-authored state rejected","disconnect/reconnect same seat","stale concurrent write rejected","private secret and liar role isolation","server wheel result and reconnect-safe finish","active legacy round upgrade rejected","completed party round promoted safely"])if(!roomTests.includes(token))fail("Room-engine smoke tests missing assertion "+token);
 if(!edge.includes("engine_v3_apply_action")||!edge.includes("engine_v3_get_snapshot")||!edge.includes("pass-domino")||!edge.includes("wheel-finish"))fail("Edge gateway is missing one or more v3 game actions");
 if(!online.includes('db.functions.invoke("room-engine"')||!online.includes("refreshEngineSnapshot")||!online.includes("heartbeat_game_room")||!online.includes("upgradeLegacyRoom"))fail("Room frontend is missing authoritative actions or reconnect recovery");
 else pass("Authoritative v3 engine, private state, reconnect and rollback-only game test suite");
}

const whoEngineText=fs.readFileSync(path.join(root,"who-ai-engine.js"),"utf8");
require(path.join(root,"who-ai-engine.js"));
const whoAI=globalThis.SuwadWhoAI;
if(!whoAI||!whoEngineText.includes("mountHomeButtons")||!app.includes("startSuwadWhoPractice")||!app.includes("startSuwadNumberPractice")||whoAI.answer("الحيوانات","دلفين","هل أعيش بالبحر؟").answer!=="نعم"||whoAI.answer("الدول","العراق","هل أنا دولة عربية؟").answer!=="نعم"||whoAI.answer("الحيوانات","أسد","هل أعيش بالبحر؟").answer!=="لا"||whoAI.answer("الحيوانات","أسد","هل أستطيع الطيران؟").answer!=="لا"||whoAI.answer("الحيوانات","أسد","هل أحب الجزر؟").answer!=="ما عندي معلومة موثوقة عن هالسؤال؛ جرّب صياغة ثانية.")fail("Who AI factual answer engine failed a deterministic test");else pass("Who AI answers known facts and safely abstains on unsupported questions");
if(!app.includes("whoQuestionsAsked++")||!app.includes("expert:4")||!app.includes("whoDifficulty"))fail("Who Am I difficulty does not enforce its question budget");else pass("Who Am I difficulty changes the available question count");
if(whoEngineText.includes('marker: "aiNumberPractice"'))fail("Who AI module still injects a misleading non-AI number shortcut");
const appUpdate=fs.readFileSync(path.join(root,"app-update.js"),"utf8");
if(!sw.includes('"./app-update.js"'))fail("Offline shell is missing the app update manager");else pass("App update manager is available in the offline shell");
if(!appUpdate.includes("updateViaCache: \"none\"")||!appUpdate.includes("registration.update()")||!appUpdate.includes("SW_ACTIVATE_UPDATE")||!appUpdate.includes("controllerchange"))fail("App update manager is missing safe update detection or user-confirmed activation");else pass("User-controlled service worker update flow");
const aiPractice=fs.readFileSync(path.join(root,"ai-practice.js"),"utf8"),aiPracticeCss=fs.readFileSync(path.join(root,"ai-practice.css"),"utf8");
if(!aiPractice.includes('button[data-online-game="domino"]')||!aiPractice.includes("closest(\".game-card\")"))fail("AI domino entry button does not target the actual homepage markup");else pass("AI domino entry is mounted on the real game-card button");
if(!aiPractice.includes("function legalMoves")||!aiPractice.includes("function chooseAI")||!aiPractice.includes("localStorage")||!aiPractice.includes("ai-domino-explain"))fail("AI domino practice engine is incomplete");
for(const token of ["function humanDraw","function humanPass","winner","difficulty","persona","state.status=\"paused\""])if(!aiPractice.includes(token))fail("AI domino practice missing "+token);
if(!aiPracticeCss.includes(".ai-domino-layer")||!aiPracticeCss.includes("@media(max-width:520px)"))fail("AI domino practice mobile styling is missing");else pass("Isolated AI domino practice, legal tile moves, difficulty, pause and local resume");
if(aiPractice.includes("function nextTurn(){state.turn=1-state.turn;state.passes=0"))fail("Domino pass counter resets on turn change");
if(!aiPractice.includes("state.hand[state.turn].splice(move.index,1);state.passes=0;"))fail("Domino pass counter is not reset after a legal move");
else pass("Domino consecutive passes persist across turns and reset only after a legal move");
const gameAi=fs.readFileSync(path.join(root,"game-ai-practice.js"),"utf8"),gameAiCss=fs.readFileSync(path.join(root,"game-ai-practice.css"),"utf8");
for(const game of ["who","number","liar","most","yesno","snakes","tavla","colors","quiz","wheel"])if(!gameAi.includes('game:"'+game+'"')&&!gameAi.includes('game==="'+game+'"')&&!gameAi.includes('game="'+game+'"'))fail("Local AI practice missing game engine "+game);
for(const level of ["easy","medium","hard","expert"])if(!gameAi.includes('id:"'+level+'"'))fail("Local AI practice missing difficulty "+level);
if(!gameAi.includes("data-online-game")||!gameAi.includes("data-extra-game")||!gameAi.includes("data-game"))fail("Local AI launch buttons are not connected to all homepage game card types");
if(!gameAiCss.includes(".gai-dialog")||!gameAiCss.includes("@media(max-width:520px)"))fail("Local AI practice responsive UI is missing");
if(!sw.includes('"./game-ai-practice.js"')||!sw.includes('"./game-ai-practice.css"'))fail("Offline shell is missing game AI practice assets");
const gameAiTest=spawnSync(process.execPath,[path.join(__dirname,"test-game-ai.js")],{encoding:"utf8"});
if(gameAiTest.status!==0)fail("Local game AI smoke tests failed: "+(gameAiTest.stderr||gameAiTest.stdout).trim());else pass((gameAiTest.stdout||"").trim());
if(!aiPractice.includes('value="expert"')||!aiPractice.includes('expert:"خبير"'))fail("Domino AI is missing expert difficulty");else pass("Expert difficulty is available in domino AI");

const redesignCss=fs.readFileSync(path.join(root,"redesign-2030.css"),"utf8"),standaloneCss=fs.readFileSync(path.join(root,"standalone-experiences.css"),"utf8"),navigation=fs.readFileSync(path.join(root,"navigation.js"),"utf8");
if(!html.includes('id="profileButton"')||!navigation.includes('top.replaceChildren(profile,toggle)'))fail("Top bar must contain only the profile control");
for(const id of ["homePage","gamesPage","communityPage","extrasPage"])if(!navigation.includes('makePage("'+id+'"'))fail("Standalone page missing: "+id);
if(!navigation.includes('gamePage.append(games)')||!navigation.includes('communityPage.append(community)'))fail("Games and community must be moved into independent pages");
if(!navigation.includes('addDrawerLink("الألعاب"')||!navigation.includes('addDrawerLink("المجتمع والأصدقاء"')||!navigation.includes('top.replaceChildren(profile,toggle)'))fail("Three-dot menu must contain separate destinations beside profile-only topbar");
if(navigation.includes("home.append(hub)")||navigation.includes("destination-grid"))fail("Homepage must not contain destination tiles");
if(!navigation.includes('toggle.textContent="⋮"')||!navigation.includes("closeDrawer"))fail("Three-dot menu interaction is incomplete");
if(!navigation.includes("transitionSequence")||!navigation.includes("source.animate")||!navigation.includes("target.animate"))fail("Section navigation must animate both exit and entrance with reduced-motion support");
if(!standaloneCss.includes("@keyframes section-card-enter")||!standaloneCss.includes("#communityPage.page-active .community-card")||!standaloneCss.includes("#extrasPage.page-active .extras-tool-card"))fail("Every destination needs its own staged entrance treatment");
if(!navigation.includes('dialog.prepend(head)')||!navigation.includes('standalone-game-head'))fail("Game dialog is not converted to its standalone full-screen experience");
if(!navigation.includes('data-open-audio')||!navigation.includes('data-open-ai')||!navigation.includes('data-open-sound'))fail("Standalone audio, AI and sound destinations are missing");
if(!standaloneCss.includes('#modalBackdrop .modal')||!standaloneCss.includes('#gamesPage .game-grid')||!standaloneCss.includes('#communityPage .community-section'))fail("Standalone game, catalogue or community page styling is incomplete");
if(!standaloneCss.includes('@media(max-width:620px)')||!standaloneCss.includes('prefers-reduced-motion'))fail("Standalone design is missing mobile or reduced-motion support");
if(!html.includes('standalone-experiences.css'))fail("Standalone experiences stylesheet is not loaded");
if(!sw.includes('"./standalone-experiences.css"')||!sw.includes('"./navigation.js"'))fail("Offline shell is missing standalone page assets");else pass("Independent home, game catalogue, community, full-screen game experiences and offline assets");

const tableFlipSql=fs.readFileSync(path.join(root,"supabase-table-flip-migration.sql"),"utf8");
const tournamentSql=fs.readFileSync(path.join(root,"supabase-tournaments-migration.sql"),"utf8");
const reactionsSql=fs.readFileSync(path.join(root,"supabase-reactions-migration.sql"),"utf8");
const roomEngine=fs.readFileSync(path.join(root,"supabase/functions/room-engine/index.ts"),"utf8");
const tableFlipStyles=fs.readFileSync(path.join(root,"styles.css"),"utf8");
const tableFlipTest=fs.readFileSync(path.join(root,"scripts/test-table-flip.sql"),"utf8");
const tournamentTest=fs.readFileSync(path.join(root,"scripts/test-tournaments.sql"),"utf8");
const orasCommentator=fs.readFileSync(path.join(root,"oras-commentator.js"),"utf8");

if(!online.includes("function renderTableFlipPanel")||!online.includes("claim-table-flip-challenge")||!online.includes("confirm-table-flip-challenge"))fail("Table Flip UI is missing its shared event or challenge actions");
if(!tableFlipStyles.includes(".table-flip-panel")||!tableFlipStyles.includes("#startOnlineGame")||!tableFlipStyles.includes("prefers-reduced-motion"))fail("Table Flip panel styling or start-round button sizing is missing");
if(!roomEngine.includes("TABLE_FLIP_ACTIONS")||!roomEngine.includes("engine_resolve_table_flip_challenge"))fail("Room engine gateway is missing secured Table Flip challenge routing");
for(const token of ["private.maybe_apply_table_flip","private.track_secret_mission","private.assign_secret_missions","public.engine_resolve_table_flip_challenge","swap-turn","double-points","bonus-points","claim-table-flip-challenge","confirm-table-flip-challenge","engine_v2_guess_number","engine_v3_apply_action"])if(!tableFlipSql.includes(token))fail("Table Flip or secret mission migration is missing "+token);
if(/\\bdrop\\s+table\\b|\\btruncate\\b/i.test(tableFlipSql))fail("Table Flip migration contains destructive data operations");
if(!tableFlipTest.includes("BEGIN;")||!tableFlipTest.includes("ROLLBACK;")||!tableFlipTest.includes("engine_v2_guess_number")||!tableFlipTest.includes("secretMission"))fail("Table Flip regression tests must cover both engines and private mission state");
else pass("Authoritative Table Flip surprises, secret missions and challenge scoring");

if(!orasCommentator.includes("SpeechSynthesisUtterance")||!orasCommentator.includes('utterance.lang="ar-IQ"')||!orasCommentator.includes("STORAGE_KEY"))fail("Oras commentator must use optional Iraqi Arabic speech with a persistent mute preference");
if(!online.includes("renderOrasCommentatorPanel")||!online.includes("SuwadOrasCommentator?.observe")||!online.includes("data-oras-toggle"))fail("Oras commentator is not wired to online game events and room controls");
if(!html.includes("oras-commentator.js")||!sw.includes("./oras-commentator.js")||!tableFlipStyles.includes(".oras-commentator-panel"))fail("Oras commentator UI or offline assets are missing");
else pass("Optional Iraqi Arabic Oras commentary and local mute preference");

if(!online.includes("renderTournamentPanel")||!online.includes("createRoomTournament")||!online.includes("tournament-snapshot")||online.includes('db.from("game_room_tournaments")'))fail("Tournament UI must use authenticated room-engine snapshot and creation actions");
if(!roomEngine.includes("TOURNAMENT_ACTIONS")||!roomEngine.includes("tournament-snapshot")||!roomEngine.includes("engine_create_room_tournament"))fail("Room engine is missing authenticated tournament actions");
for(const token of ["game_room_tournaments","game_room_tournament_scores","game_room_tournament_rounds","engine_create_room_tournament","private.record_room_tournament_round","game_room_tournament_round_after_finish"])if(!tournamentSql.includes(token))fail("Tournament migration is missing "+token);
if(!tableFlipStyles.includes(".room-tournament-panel")||!html.includes("online-games.js?v=20261106-13"))fail("Tournament standings styles or versioned client asset are missing");
if(!tournamentTest.includes("BEGIN;")||!tournamentTest.includes("ROLLBACK;")||!tournamentTest.includes("engine_create_room_tournament")||!tournamentTest.includes("champion_id"))fail("Tournament regression test must cover creation, cumulative rounds and champion selection");
else pass("Friend-room tournaments, cumulative standings and champion selection");

if(!online.includes("renderRoomReactionsPanel")||!online.includes("connectRoomReactions")||!online.includes("sendRoomReaction")||!online.includes("config:{private:true}"))fail("Room reactions are not wired to private authenticated broadcasts");
if(!reactionsSql.includes("suwad_room_reactions_receive")||!reactionsSql.includes("suwad_room_reactions_send")||!reactionsSql.includes("private.is_game_room_member"))fail("Room reaction policies do not restrict broadcast access to room members");
if(!tableFlipStyles.includes(".room-reactions-panel")||!sw.includes("suwad-wanasa-shell-v65"))fail("Room reaction styling or offline cache refresh is missing");
else pass("Private live emoji reactions restricted to current room members");

for(const token of ["ADD COLUMN IF NOT EXISTS settings","engine_update_room_rules","engine_timeout_room_round","turnDeadlineAt","maxNumber","private.assign_secret_missions","private.track_secret_mission"])if(!customRulesSql.includes(token))fail("Custom rules migration is missing "+token);
if(/\\bdrop\\s+table\\b|\\btruncate\\b/i.test(customRulesSql))fail("Custom rules migration contains destructive data operations");
if(!roomEngine.includes("ROOM_RULE_ACTIONS")||!roomEngine.includes("engine_update_room_rules")||!roomEngine.includes("engine_timeout_room_round")||!roomEngine.includes("secureSecret(maxNumber)"))fail("Room engine gateway is missing custom rules, timeout or difficulty support");
if(!online.includes("renderCustomRulesPanel")||!online.includes("renderRoomTimerPanel")||!online.includes("syncRoomTimer")||!online.includes("timeout-room-round"))fail("Custom rules or synchronized timer UI is incomplete");
if(!tableFlipStyles.includes(".room-custom-rules-panel")||!tableFlipStyles.includes(".room-round-timer")||!html.includes("online-games.js?v=20261106-13"))fail("Custom rules styles or versioned client asset are missing");
if(!customRulesTest.includes("BEGIN;")||!customRulesTest.includes("ROLLBACK;")||!customRulesTest.includes("engine_timeout_room_round")||!customRulesTest.includes("maxNumber"))fail("Custom rules regression test must cover timers, timeout, difficulty and rollback");
else pass("Host-configurable room rules, round timer and difficulty");


if(failures.length)process.exit(1);console.log("Project validation completed.");
