const fs=require("node:fs");
const path=require("node:path");
const {spawnSync}=require("node:child_process");
const root=path.resolve(__dirname,".."),failures=[];
const pass=m=>console.log("PASS:",m),fail=m=>{failures.push(m);console.error("FAIL:",m)};
const jsFiles=["app.js","tavla-rules.js","chess.js","snakes-board-art.js","game-motion.js","wanasa-voice.js","number-input.js","who-ai-engine.js","scripts/test-who-ai.js","scripts/test-snakes-board-art.js","social.js","online-games.js","hussaini-audio.js","backend-config.js","progression.js","game-learning.js","ai-practice.js","game-ai-practice.js","scripts/test-game-ai-practice.js","scripts/test-domino-practice.js","game-assistant.js","oras-commentator.js","navigation.js","typing-effects.js","app-update.js","sw.js"];
for(const file of jsFiles){const full=path.join(root,file);if(!fs.existsSync(full)){fail("Missing JavaScript file "+file);continue}const r=spawnSync(process.execPath,["--check",full],{encoding:"utf8"});if(r.status!==0)fail(file+" syntax error: "+(r.stderr||r.stdout).trim());else pass(file+" syntax")}
const motionRun=spawnSync(process.execPath,[path.join(root,"scripts/test-game-motion.js")],{encoding:"utf8"});if(motionRun.status!==0)fail("Shared game motion tests failed: "+(motionRun.stderr||motionRun.stdout).trim());else pass((motionRun.stdout||"").trim());
const localPracticeRun=spawnSync(process.execPath,[path.join(root,"scripts/test-game-ai-practice.js")],{encoding:"utf8"});if(localPracticeRun.status!==0)fail("Local practice game regression tests failed: "+(localPracticeRun.stderr||localPracticeRun.stdout).trim());else pass("Local practice Snakes and UNO rule regression tests");
const dominoRun=spawnSync(process.execPath,[path.join(root,"scripts/test-domino-practice.js")],{encoding:"utf8"});if(dominoRun.status!==0)fail("Domino practice regression tests failed: "+(dominoRun.stderr||dominoRun.stdout).trim());else pass((dominoRun.stdout||"").trim());
const tavlaRun=spawnSync(process.execPath,[path.join(root,"scripts/test-tavla-rules.js")],{encoding:"utf8"});if(tavlaRun.status!==0)fail("Backgammon rules regression tests failed: "+(tavlaRun.stderr||tavlaRun.stdout).trim());else pass((tavlaRun.stdout||"").trim());
const snakesArtRun=spawnSync(process.execPath,[path.join(root,"scripts/test-snakes-board-art.js")],{encoding:"utf8"});if(snakesArtRun.status!==0)fail("Snakes artwork regression tests failed: "+(snakesArtRun.stderr||snakesArtRun.stdout).trim());else pass((snakesArtRun.stdout||"").trim());
const chessRun=spawnSync(process.execPath,[path.join(root,"scripts/test-chess.js")],{encoding:"utf8"});if(chessRun.status!==0)fail("Chess rules regression tests failed: "+(chessRun.stderr||chessRun.stdout).trim());else pass((chessRun.stdout||"").trim());
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
const edge=fs.readFileSync(path.join(root,"supabase/functions/room-engine/index.ts"),"utf8");
const tavlaRules=fs.readFileSync(path.join(root,"tavla-rules.js"),"utf8"),gameAiPractice=fs.readFileSync(path.join(root,"game-ai-practice.js"),"utf8"),dominoPractice=fs.readFileSync(path.join(root,"ai-practice.js"),"utf8"),dominoPracticeStyles=fs.readFileSync(path.join(root,"ai-practice.css"),"utf8");
if(!html.includes("snakes-board-art.js?v=20261108-01")||!sw.includes('"./snakes-board-art.js"')||!gameAiPractice.includes("SuwadSnakesBoardArt")||!online.includes("SuwadSnakesBoardArt"))fail("Snakes and ladders shared artwork renderer is not loaded in both modes and offline cache");else pass("Shared snakes artwork and 3D dice are available in local and online modes");

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
if(!learning.includes("SuwadVoice")||!learning.includes("tutorial")||!learning.includes("robot-arm-right")||!learning.includes("data-learning-game"))fail("Cloud voice, animated guide or game-card entry point is missing");
if(!learningCss.includes("@media(prefers-reduced-motion:reduce)")||!learningCss.includes("@media(max-width:640px)"))fail("Game learning accessibility or mobile styles are missing");else pass("Ten in-app illustrated voice tutorials and animated robot");
const assistant=fs.readFileSync(path.join(root,"game-assistant.js"),"utf8"),assistantCss=fs.readFileSync(path.join(root,"game-assistant.css"),"utf8");
const voice=fs.readFileSync(path.join(root,"wanasa-voice.js"),"utf8"),ttsFunction=fs.readFileSync(path.join(root,"supabase/functions/wanasa-tts/index.ts"),"utf8");
if(!voice.includes('functions.invoke("wanasa-tts"')||!ttsFunction.includes("gemini-2.5-flash-preview-tts")||!ttsFunction.includes("Object.hasOwn(VOICES, kind)")||!ttsFunction.includes("auth.user.id"))fail("Authenticated Gemini TTS service or voice client is incomplete");
for(const preset of ["Sulafat","Sadachbia","Achird"])if(!ttsFunction.includes(preset))fail("Dedicated TTS voice preset missing: "+preset);
if(!app.includes('SuwadVoice?.speak(textToRead,"tutorial")')||!assistant.includes('SuwadVoice?.speak(text,"assistant")'))fail("Game tutorial or Oras assistant is not connected to its dedicated voice");
else pass("Dedicated authenticated TTS voices for tutorials, commentator and Oras assistant");
for(const key of ["who","number","liar","yesno","most","snakes","domino","tavla","colors","quiz","wheel"])if(!assistant.includes('key:"'+key+'"'))fail("Game assistant missing game "+key);
if(!assistant.includes('functions.invoke("wanasa-ai"')||!assistant.includes('mode:"game_help"'))fail("Game assistant is not connected to the existing protected AI function");

if(!gameAiPractice.includes('!layer||layer.hidden||state.status!=="playing"')||!gameAiPractice.includes("window.__SUWAD_WHO_ANSWER=null"))fail("Local Who answer callback is not guarded against hidden or stale practice sessions");
if(!assistant.includes('if(local&&typeof local.answer==="string")')||!assistant.includes("answer=await invokeAssistant(gameKey,question,context.mode)")||!assistant.includes("gameMode:safeGameMode"))fail("Who assistant does not fall back to the protected AI function when no live local practice session exists");
else pass("Who assistant routes only live local practice sessions to curated facts and safely falls back to AI");
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
const roomEnginePath=path.join(root,"supabase/functions/room-engine/index.ts");if(!fs.existsSync(roomEnginePath))fail("Missing authenticated room engine Edge Function");else{const engine=fs.readFileSync(roomEnginePath,"utf8");if(!engine.includes("Deno.serve")||!engine.includes("auth.getUser(accessToken)")||!engine.includes("SUPABASE_SERVICE_ROLE_KEY")||!engine.includes("admin.rpc"))fail("Room engine must authenticate caller and derive actor identity from verified claims");if(!engine.includes("function secureSecret(maxNumber = 100)")||(engine.split("rpcArgs.p_secret = secureSecret(configuredMax);").length-1)!==2||!engine.includes("engine_v2_guess_number"))fail("Room engine server-side actions are incomplete");if(!online.includes('db.functions.invoke("room-engine"'))fail("Number game frontend is not connected to the room engine");if(online.includes("secret:Math.floor(Math.random()*100)+1")||online.includes("n===b.secret"))fail("Number game secret or winner logic remains client-side");if(!engine.includes("MAX_BODY_CHARS")||!engine.includes("P0001")||!engine.includes("ALLOWED_ORIGIN"))fail("Room engine request-size or rate-limit handling is missing");else pass("Authenticated authoritative number-game gateway");}
const engineSql=fs.readFileSync(path.join(root,"supabase-authoritative-number-engine-migration.sql"),"utf8");for(const token of ["private.are_friends","private.is_game_room_member","engine_v2_start_number_game","engine_v2_guess_number","engine_v2_restart_number_game","engine_version=case when v_target_game='number' then 2 else 1 end","game_room_private_state","game_room_engine_events"])if(!engineSql.includes(token))fail("Authoritative number migration missing "+token);if(/\bdrop\s+table\b|\btruncate\b/i.test(engineSql))fail("Authoritative number migration contains destructive data operations");else pass("Additive server-engine migration");

const roomV3MigrationPath=path.join(root,"supabase-authoritative-room-engines-v3-migration.sql"),roomV3TestPath=path.join(root,"scripts/test-authoritative-room-engines.sql");
if(!fs.existsSync(roomV3MigrationPath)||!fs.existsSync(roomV3TestPath))fail("Missing authoritative room-engine v3 migration or rollback-only smoke tests");else{
 const roomV3=fs.readFileSync(roomV3MigrationPath,"utf8"),roomTests=fs.readFileSync(roomV3TestPath,"utf8"),edge=fs.readFileSync(path.join(root,"supabase/functions/room-engine/index.ts"),"utf8");
 for(const token of ["game_room_player_private_state","game_room_action_events","engine_v3_get_snapshot","engine_v3_apply_action","heartbeat_game_room","last_seen_at","pass-domino","wheel-finish","engine_version in (1,2,3)"])if(!roomV3.includes(token))fail("Room-engine v3 migration missing "+token);
 if(/\bdrop\s+table\b|\btruncate\b/i.test(roomV3))fail("Room-engine v3 migration contains destructive table operations");
  for(const game of ["snakes","domino","colors","quiz","who","most","yesno","liar","wheel"])if(!roomTests.includes("'"+game+"'"))fail("Room-engine smoke tests missing game "+game);
 for(const token of ["rollback;","client-authored state rejected","disconnect/reconnect same seat","stale concurrent write rejected","private secret and liar role isolation","server wheel result and reconnect-safe finish","active legacy round upgrade rejected","completed party round promoted safely"])if(!roomTests.includes(token))fail("Room-engine smoke tests missing assertion "+token);
  if(!edge.includes("engine_v3_apply_action")||!edge.includes("engine_v3_get_snapshot")||!edge.includes("pass-domino")||!edge.includes("move-tavla")||!edge.includes("pass-tavla")||!edge.includes("wheel-finish"))fail("Edge gateway is missing one or more v3 game actions");
  const migrationDir=path.join(root,"supabase/migrations");
  const migrationSql=fs.existsSync(migrationDir)?fs.readdirSync(migrationDir).filter(name=>name.endsWith(".sql")).map(name=>fs.readFileSync(path.join(migrationDir,name),"utf8")).join("\\n"):"";
  const allRoomSql=roomV3+"\\n"+migrationSql;
   const tavlaMigrationSql=fs.readFileSync(path.join(root,"supabase/migrations/20261107162001_tavla_maximum_dice_rules.sql"),"utf8");
   const tavlaIntegrationTest=fs.readFileSync(path.join(root,"scripts/test-tavla-authoritative-migration.sql"),"utf8");
   if(!tavlaMigrationSql.includes("private.tavla_apply_action")||!tavlaMigrationSql.includes("move-tavla")||!tavlaMigrationSql.includes("tavla_max_usable_dice")||!tavlaIntegrationTest.includes("move-tavla")||!tavlaIntegrationTest.includes("Bar priority")||!tavlaIntegrationTest.includes("maximum number of dice")||!tavlaIntegrationTest.includes("ROLLBACK;"))fail("Online classic Tavla migration and PostgreSQL regression coverage are incomplete");
   else pass("Online classic Tavla server migration and PostgreSQL regression coverage");
   const gamePolicy=fs.readFileSync(path.join(root,"supabase/functions/wanasa-ai/game-policy.ts"),"utf8");
   if(!gamePolicy.includes("الطاولي الأونلاين")||!gamePolicy.includes('mode === "online"')||!gamePolicy.includes("محرك PostgreSQL الخاص يتحقق"))fail("Oras must distinguish server-authoritative online Tavla rules");
}

const whoEngineText=fs.readFileSync(path.join(root,"who-ai-engine.js"),"utf8");
require(path.join(root,"who-ai-engine.js"));
const whoAI=globalThis.SuwadWhoAI;
if(!whoAI||!whoEngineText.includes("mountHomeButtons")||!app.includes("startSuwadWhoPractice")||!app.includes("startSuwadNumberPractice")||whoAI.answer("الحيوانات","دلفين","هل أعيش بالبحر؟").answer!=="نعم"||whoAI.answer("الدول","العراق","هل أنا دولة عربية؟").answer!=="نعم"||whoAI.answer("الحيوانات","أسد","هل أعيش بالبحر؟").answer!=="لا"||whoAI.answer("الحيوانات","أسد","هل أستطيع الطيران؟").answer!=="لا"||whoAI.answer("الحيوانات","ذئب رمادي","هل الحيوان صغير؟").answer!=="لا، الحجم متوسط."||whoAI.answer("الحيوانات","ذئب رمادي","هل الحيوان كبير؟").answer!=="لا، الحجم متوسط."||whoAI.answer("الحيوانات","قطة","هل الحيوان صغير؟").answer!=="نعم، الحجم صغير."||whoAI.answer("الحيوانات","كلب","هل الحيوان صغير؟").known!==false||whoAI.answer("الحيوانات","أسد","هل أحب الجزر؟").answer!=="ما عندي معلومة موثوقة عن هالسؤال؛ جرّب صياغة ثانية.")fail("Who AI factual answer engine failed a deterministic test");else pass("Who AI answers known facts and safely abstains on unsupported questions");
if(!app.includes("whoQuestionsAsked++")||!app.includes("expert:4")||!app.includes("whoDifficulty"))fail("Who Am I difficulty does not enforce its question budget");else pass("Who Am I difficulty changes the available question count");
const practiceSource=fs.readFileSync(path.join(root,"game-ai-practice.js"),"utf8");
if(!practiceSource.includes("function answerWhoQuestion")||!practiceSource.includes("window.__SUWAD_WHO_ANSWER=game===\"who\"?answerCurrentWho:null")||!assistant.includes('if(gameKey==="who"&&context.mode==="practice")')||assistant.includes('if(gameKey==="who"&&context.mode==="practice"&&typeof window.__SUWAD_WHO_ANSWER==="function")'))fail("Who AI practice and the new Oras assistant do not share the same local fact engine");
else pass("New Oras assistant uses the same authoritative local Who facts and never falls back to Gemini for secret answers");
if(!app.includes("bindWhoGuessAction")||!app.includes("content.addEventListener(\"click\"")||!app.includes("handleWhoGuess")||!app.includes("normalizeWhoGuess")||!app.includes("id=\"guessFeedback\"")||!app.includes("role=\"status\""))fail("Who Am I guess button must use stable delegated click handling and visible Oras feedback");else pass("Who Am I guess action is delegated reliably and reports correct/incorrect results visibly");
if(whoEngineText.includes('marker: "aiNumberPractice"'))fail("Who AI module still injects a misleading non-AI number shortcut");
const numberInputSource=fs.readFileSync(path.join(root,"number-input.js"),"utf8");
if(!html.includes('number-input.js?v=20261106-01')||!sw.includes('"./number-input.js"')||!app.includes('window.SuwadNumberInput?.parse($("#numberInput").value)')||!app.includes('inputmode="numeric"')||!roomUiCss.includes(".number-form input{min-width:0;flex:1;min-height:50px"))fail("Number practice input is missing Arabic digit parsing, accessible mobile keyboard, visible styling or offline registration");else pass("Arabic/English number input is accessible, styled and available offline");
const numberInputTest=spawnSync(process.execPath,[path.join(__dirname,"test-number-input.js")],{encoding:"utf8"});
if(numberInputTest.status!==0)fail("Number input regression tests failed: "+(numberInputTest.stderr||numberInputTest.stdout).trim());else pass((numberInputTest.stdout||"").trim());
const whoAiTest=spawnSync(process.execPath,[path.join(__dirname,"test-who-ai.js")],{encoding:"utf8"});
if(whoAiTest.status!==0)fail("Who AI knowledge regression tests failed: "+(whoAiTest.stderr||whoAiTest.stdout).trim());else pass((whoAiTest.stdout||"").trim());
if(!app.includes('{"سهل":"easy","متوسط":"medium","صعب":"hard","خبير":"expert"}'))fail("Who AI Arabic difficulty labels are not normalized to the internal levels");else pass("Who AI difficulty limits use the selected Arabic level");
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
const customRulesSql=fs.readFileSync(path.join(root,"supabase-custom-rules-migration.sql"),"utf8");
const realisticGamesSql=fs.readFileSync(path.join(root,"supabase-realistic-snakes-domino-uno-migration.sql"),"utf8"),dominoSideSql=fs.readFileSync(path.join(root,"supabase/migrations/20261107190000_domino_choose_chain_end.sql"),"utf8");
const customRulesTest=fs.readFileSync(path.join(root,"scripts/test-custom-rules.sql"),"utf8");
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

if(!orasCommentator.includes('SuwadVoice.speak(text,"commentator")')||!orasCommentator.includes("STORAGE_KEY"))fail("Oras commentator must use the dedicated cloud voice and persistent mute preference");
if(!online.includes("renderOrasCommentatorPanel")||!online.includes("SuwadOrasCommentator?.observe")||!online.includes("data-oras-toggle"))fail("Oras commentator is not wired to online game events and room controls");
if(!html.includes("wanasa-voice.js")||html.indexOf("wanasa-voice.js")>html.indexOf("oras-commentator.js")||!sw.includes("./wanasa-voice.js")||!tableFlipStyles.includes(".oras-commentator-panel"))fail("Shared voice engine, load order or commentator UI assets are missing");
else pass("Gemini TTS Oras commentary with local mute preference");

if(!online.includes("renderTournamentPanel")||!online.includes("createRoomTournament")||!online.includes("tournament-snapshot")||online.includes('db.from("game_room_tournaments")'))fail("Tournament UI must use authenticated room-engine snapshot and creation actions");
if(!roomEngine.includes("TOURNAMENT_ACTIONS")||!roomEngine.includes("tournament-snapshot")||!roomEngine.includes("engine_create_room_tournament"))fail("Room engine is missing authenticated tournament actions");
for(const token of ["game_room_tournaments","game_room_tournament_scores","game_room_tournament_rounds","engine_create_room_tournament","private.record_room_tournament_round","game_room_tournament_round_after_finish"])if(!tournamentSql.includes(token))fail("Tournament migration is missing "+token);
if(!tableFlipStyles.includes(".room-tournament-panel")||!html.includes("online-games.js?v=20261108-08"))fail("Tournament standings styles or versioned client asset are missing");
if(!tournamentTest.includes("BEGIN;")||!tournamentTest.includes("ROLLBACK;")||!tournamentTest.includes("engine_create_room_tournament")||!tournamentTest.includes("champion_id"))fail("Tournament regression test must cover creation, cumulative rounds and champion selection");
else pass("Friend-room tournaments, cumulative standings and champion selection");

if(!online.includes("renderRoomReactionsPanel")||!online.includes("connectRoomReactions")||!online.includes("sendRoomReaction")||!online.includes("config:{private:true}"))fail("Room reactions are not wired to private authenticated broadcasts");
if(!reactionsSql.includes("suwad_room_reactions_receive")||!reactionsSql.includes("suwad_room_reactions_send")||!reactionsSql.includes("private.is_game_room_member"))fail("Room reaction policies do not restrict broadcast access to room members");
if(!tableFlipStyles.includes(".room-reactions-panel")||!new RegExp("suwad-wanasa-shell-v[0-9]+").test(sw))fail("Room reaction styling or offline cache refresh is missing");
else pass("Private live emoji reactions restricted to current room members");

for(const token of ["ADD COLUMN IF NOT EXISTS settings","engine_update_room_rules","engine_timeout_room_round","turnDeadlineAt","maxNumber","private.assign_secret_missions","private.track_secret_mission"])if(!customRulesSql.includes(token))fail("Custom rules migration is missing "+token);
if(/\\bdrop\\s+table\\b|\\btruncate\\b/i.test(customRulesSql))fail("Custom rules migration contains destructive data operations");
if(!roomEngine.includes("ROOM_RULE_ACTIONS")||!roomEngine.includes("engine_update_room_rules")||!roomEngine.includes("engine_timeout_room_round")||!(roomEngine.match(/rpcArgs\.p_secret = secureSecret\(configuredMax\);/g)||[]).length===2)fail("Room engine gateway is missing custom rules, timeout or difficulty support");
if(!online.includes("renderCustomRulesPanel")||!online.includes("renderRoomTimerPanel")||!online.includes("syncRoomTimer")||!online.includes("timeout-room-round"))fail("Custom rules or synchronized timer UI is incomplete");
if(!tableFlipStyles.includes(".room-custom-rules-panel")||!tableFlipStyles.includes(".room-round-timer")||!html.includes("online-games.js?v=20261108-08"))fail("Custom rules styles or versioned client asset are missing");
if(!customRulesTest.includes("BEGIN;")||!customRulesTest.includes("ROLLBACK;")||!customRulesTest.includes("engine_timeout_room_round")||!customRulesTest.includes("maxNumber"))fail("Custom rules regression test must cover timers, timeout, difficulty and rollback");
else pass("Host-configurable room rules, round timer and difficulty");

if(!tableFlipStyles.includes("#beginWho")||!tableFlipStyles.includes("#startOnlineGame")||!tableFlipStyles.includes("min-height:64px")||!html.includes("styles.css?v=20261108-03"))fail("Primary game start and replay buttons are not sufficiently prominent across local and online games");
else pass("Large, mobile-friendly start and replay buttons across all games");




if(!online.includes('act("challenge-wild4")')||!online.includes('act("accept-wild4")')||!online.includes("canCatchUno")||!online.includes("unoMatch")||!gameAiPractice.includes("resolvePracticeWild4")||!gameAiPractice.includes("unoMatchScores"))fail("UNO local and online challenge/scoring rules must be available in both modes");
if(!online.includes("renderTavlaGame")||!online.includes('act("move-tavla",{from,die})')||!online.includes("data-tavla-point")||!online.includes("points.length!==24")||!online.includes("Array.isArray(b.bar)")||!online.includes("Array.isArray(b.off)")||!gameAiPractice.includes("SuwadTavlaRules.playBotTurn")||!gameAiPractice.includes("tavla-board")||!tavlaRules.includes("function getLegalMoves")||!tavlaRules.includes("winMultiplier"))fail("Classic backgammon local rules or online board-shape safety gate are incomplete");else pass("Classic local Backgammon and online server board-shape safety gate");
const tavlaRender=online.slice(online.indexOf("function renderTavlaGame"),online.indexOf("function renderGame",online.indexOf("function renderTavlaGame")));
if(!tavlaRender.includes("لا نغيّر قواعدها")||tavlaRender.includes("upgradeLegacyRoom"))fail("Legacy Tavla rooms must not be promoted into a new engine contract");
if(!gameAiPractice.includes("makeSnakeLinks")||!gameAiPractice.includes("buildUnoDeck")||!gameAiPractice.includes("animateLocalSnakeMove")||!gameAiPractice.includes("callUno")||!gameAiPractice.includes("catchUno"))fail("Local practice mode must use randomized snakes and full UNO rules");
if(gameAiPractice.includes("ستة ثعابين")||gameAiPractice.includes("ستة سلالم")||learning.includes("ستة ثعابين")||learning.includes("ستة سلالم")||!learning.includes("تتغير أعداد ومواقع الثعابين والسلالم"))fail("Snakes tutorial and local practice must describe the variable generated board accurately");
else pass("Variable snakes and ladders counts match the board generator");
const authoritativeSmokeSql=fs.readFileSync(path.join(root,"scripts/test-authoritative-room-engines.sql"),"utf8");
const variableBoardSql=fs.readFileSync(path.join(root,"supabase/migrations/20261107230000_variable_snakes_ladders_layout.sql"),"utf8");
const variableBoardIntegrationTest=fs.readFileSync(path.join(root,"scripts/test-variable-snakes-migration.sql"),"utf8");
if(!variableBoardIntegrationTest.includes("ROLLBACK;")||!variableBoardIntegrationTest.includes("public.engine_v3_apply_action(")||!variableBoardIntegrationTest.includes("public.engine_v3_apply_action_core(")||!variableBoardIntegrationTest.toLowerCase().includes("not between 2 and 5"))fail("Variable snakes migration needs a rollback-only PostgreSQL integration test for both core and wrapper");
if(!variableBoardSql.includes("2 + floor(random()*4)::integer")||!variableBoardSql.includes("wrapper_migration")||!variableBoardSql.includes("public.engine_v3_apply_action(uuid,uuid,text,jsonb,timestamp with time zone)")||!variableBoardSql.includes("v_deck:=private.generate_snakes_board_layout()")||!authoritativeSmokeSql.includes("not between 2 and 5")||!authoritativeSmokeSql.includes("> 9")||!authoritativeSmokeSql.includes("public.engine_v3_apply_action(")||authoritativeSmokeSql.includes("six randomized snakes and ladders"))fail("Variable snakes migration must patch both the core and the public wrapper, and smoke-test the wrapper");
else pass("Authoritative SQL smoke test matches variable snakes and ladders counts");
if(!dominoPractice.includes("openingChoice")||!dominoPractice.includes("openingTile")||!dominoPractice.includes("ai-domino-pip-face")||!dominoPractice.includes("pendingMoveOptions")||!dominoPractice.includes("SuwadDominoRules")||!dominoPracticeStyles.includes(".ai-domino-pip-face")||!dominoPracticeStyles.includes(".ai-domino-side-choice"))fail("Domino AI practice must use the highest opening tile, real pip faces and left/right selection");
if(!online.includes("animateSnakePendingMove")||!online.includes("finish-snake-move")||!online.includes("snakeBoardOrder")||!online.includes("data-cell="))fail("Snakes and Ladders must animate the die and server-authoritative movement");
if(!online.includes("animateLegacySnakeMove")||!online.includes("pendingMove={id:")||!online.includes("lastMove:{from,landing,final"))fail("Legacy online Snakes and Ladders must animate the piece before committing the landing square");
if(!gameAiPractice.includes("scheduleBotTurn(delay=1900)")||!gameAiPractice.includes("scheduleBotTurn(1900)"))fail("Practice AI turn pacing is too abrupt");
if(!roomUiCss.includes("--suwad-piece-motion:480ms")||!roomUiCss.includes("suwad-piece-enter 480ms"))fail("Shared piece movement timing is not set to a moderate pace");
else pass("Moderate turn pacing and animated legacy online snakes movement");

if(!online.includes("dominoTileMarkup")||!online.includes("openingTile")||!online.includes("domino-chain-piece")||!online.includes("legalSides")||!online.includes('act("play-domino",{index,side})')||!online.includes("room.player_private_state?.hand||[]"))fail("Online Domino must render private real tiles and allow legal placement on either end");
if(!dominoSideSql.includes("v_side:=coalesce(v_action_payload->>'side','auto')")||!dominoSideSql.includes("v_side='left'")||!dominoSideSql.includes("v_side='right'"))fail("Domino database migration does not enforce the selected chain end");
if(!online.includes("unoCardMarkup")||!online.includes("wildColorPicker")||!online.includes("callUno")||!online.includes("catchUno")||!online.includes("challengeWild4")||!online.includes("acceptWild4"))fail("UNO card faces, wild-color choice or UNO call/catch UI is missing");
if(!edge.includes('"finish-snake-move"')||!edge.includes('"call-uno"')||!edge.includes('"catch-uno"'))fail("Room-engine gateway is missing snake/UNO actions");
for(const token of ["engine_v3_apply_action_core","finish-snake-move","animationMs","pendingMove","private.draw_uno_cards","openingTile","consecutivePasses","wild4","draw2","call-uno","catch-uno"])if(!realisticGamesSql.includes(token))fail("Realistic game migration missing "+token);
if(!tableFlipStyles.includes(".snake-moving-token")||!tableFlipStyles.includes(".domino-real-tile")||!tableFlipStyles.includes(".uno-card"))fail("Realistic game board styles are incomplete");
if(!learning.includes("٢٤ نقطة")||!learning.includes("باك گامون")||!html.includes("طاولي كلاسيكية"))fail("Backgammon rules tutorial or game description is not updated");
if(!learning.includes("١٠٨ كروت")||!learning.includes("أعلى دبل")||!learning.includes("خانة بخانة"))fail("Updated board-game tutorial rules are missing");
else pass("Realistic Snakes movement, authentic double-six Domino and UNO card rules");

const coverCss=fs.readFileSync(path.join(root,"styles.css"),"utf8"),motionController=fs.readFileSync(path.join(root,"game-motion.js"),"utf8");
const coverImages=[...html.matchAll(/<img class="game-cover-photo" src="([^"]+)" alt="([^"]+)" loading="lazy" decoding="async">/g)];
if(coverImages.length!==12||new Set(coverImages.map(x=>x[1])).size!==12||coverImages.some(x=>!x[2].trim()))fail("Every game card must have its own centered, descriptive real-photo cover");
if(!coverCss.includes("@keyframes game-cover-drift")||!coverCss.includes("prefers-reduced-motion:reduce")||!coverCss.includes("game-cover-photo"))fail("Floating game covers must move smoothly and respect reduced-motion accessibility");
if(!html.includes("game-motion.js?v=20261108-02")||!motionController.includes("function prepare")||!motionController.includes("function flip"))fail("The shared FLIP movement controller is not loaded or wired");
if(!online.includes('data-motion-group="chess-')||!online.includes('data-motion-group="tavla-')||!online.includes('data-motion-group="domino-')||!online.includes('data-motion-group="uno-')||!gameAiPractice.includes('data-motion-group="tavla-')||!gameAiPractice.includes('data-motion-group="uno-')||!fs.readFileSync(path.join(root,"ai-practice.js"),"utf8").includes("tileMotionKey(t)")||!app.includes('data-motion-group="chess-'))fail("Real piece/card movement groups are missing from local or online board games");
if(!html.includes("<h3>اونو - UNO</h3>")||!app.includes('name:"اونو - UNO"')||!learning.includes('name:"اونو - UNO"')||!assistant.includes('name:"اونو - UNO"')||!gameAiPractice.includes('colors:"اونو - UNO"')||!online.includes('colors:{name:"اونو - UNO"'))fail("UNO display name is not consistent across the catalogue, tutorials, assistant and games");
else pass("Unique floating real-photo covers, consistent UNO naming and FLIP movement for board pieces/cards");



const chessMigration=fs.readFileSync(path.join(root,"supabase/migrations/20261107162006_authoritative_chess_engine.sql"),"utf8");
if(!html.includes('id="game-chess"')||!html.includes('data-game="chess"')||!html.includes('data-online-game="chess"'))fail("Chess catalogue must expose local and online entry points");
if(!online.includes('chess:{name:"الشطرنج"')||!online.includes("function renderChessGame")||!online.includes('act("move-chess"')||!online.includes('act("claim-chess-draw"')||!online.includes('act("resign-chess"'))fail("Online chess UI is missing its registry, board or authoritative actions");
if(!edge.includes("CHESS_ACTIONS")||!edge.includes("./chess-rules.ts")||!fs.existsSync(path.join(root,"supabase/functions/room-engine/chess-rules.ts")))fail("Deployed chess engine source or rules module is missing from repository");
if(!chessMigration.includes("engine_v3_apply_chess_action")||!chessMigration.includes("WHEN 'chess' THEN v_min:=2; v_max:=2;")||!chessMigration.includes("GRANT EXECUTE ON FUNCTION public.engine_v3_apply_chess_action"))fail("Authoritative chess database migration is incomplete");
if(!html.includes('game-motion.js?v=')||!sw.includes('"./game-motion.js"'))fail("Shared game motion controller is not loaded and cached offline");else pass("Shared game motion controller is loaded and cached offline");
const coreStart=sw.indexOf("const CORE=[");
const coreEnd=sw.indexOf("];",coreStart);
const coreSource=coreStart>=0&&coreEnd>coreStart?sw.slice(coreStart,coreEnd):"";
const coreAssets=[...coreSource.matchAll(/"([^"]+)"/g)].map(match=>match[1]);
if(!coreSource||new Set(coreAssets).size!==coreAssets.length)fail("Service worker CORE cache must not contain duplicate asset URLs");
else pass("Service worker install cache contains unique asset URLs");
if(!html.includes("chess-game.css")||!html.includes('src="chess.js')||!sw.includes('"./chess.js"')||!sw.includes('"./chess-game.css"'))fail("Offline chess assets are not linked and cached");
else pass("Local and server-authoritative chess entry points, migration, and offline assets");


if(!learning.includes('chess:{name:"الشطرنج"')||!learning.includes('if(/الشطرنج/.test(s))return"chess"'))fail("Illustrated voice chess tutorial is missing");
if(!online.includes('room.game_key==="chess"?"":renderTableFlipPanel')||!online.includes('!["wheel","chess"].includes(room.game_key)'))fail("Chess room must not expose unsupported table-flip, custom-rule or timer controls");
else pass("Chess tutorial and isolated room controls");
if(failures.length)process.exit(1);console.log("Project validation completed.");
