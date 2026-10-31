const fs=require("node:fs");
const path=require("node:path");
const {spawnSync}=require("node:child_process");
const root=path.resolve(__dirname,".."),failures=[];
const pass=m=>console.log("PASS:",m),fail=m=>{failures.push(m);console.error("FAIL:",m)};
const jsFiles=["app.js","social.js","online-games.js","hussaini-audio.js","backend-config.js","sw.js"];
for(const file of jsFiles){const full=path.join(root,file);if(!fs.existsSync(full)){fail("Missing JavaScript file "+file);continue}const r=spawnSync(process.execPath,["--check",full],{encoding:"utf8"});if(r.status!==0)fail(file+" syntax error: "+(r.stderr||r.stdout).trim());else pass(file+" syntax")}
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const refs=[...html.matchAll(/(?:src|href)="(\.\/?[^"#?]+)(?:\?[^"#]*)?"/g)].map(m=>m[1]);
for(const ref of refs){const target=path.resolve(root,ref.replace(/^\.\//,""));if((target!==root&&!target.startsWith(root+path.sep))||!fs.existsSync(target))fail("Broken local HTML reference: "+ref)}
if(!failures.length)pass("Local HTML asset references");
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]),dupes=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
if(dupes.length)fail("Duplicate HTML IDs: "+dupes.join(", "));else pass("HTML IDs are unique");
const sw=fs.readFileSync(path.join(root,"sw.js"),"utf8"),core=sw.match(/const CORE=\[([^\]]*)\]/);
if(!core)fail("Missing service worker CORE list");else for(const asset of [...core[1].matchAll(/"([^"]+)"/g)].map(m=>m[1])){const target=path.resolve(root,asset.replace(/^\.\//,""));if((target!==root&&!target.startsWith(root+path.sep))||!fs.existsSync(target))fail("Missing service worker asset: "+asset)}
const online=fs.readFileSync(path.join(root,"online-games.js"),"utf8"),app=fs.readFileSync(path.join(root,"app.js"),"utf8"),social=fs.readFileSync(path.join(root,"social.js"),"utf8"),schema=fs.readFileSync(path.join(root,"supabase-schema.sql"),"utf8"),migration=fs.readFileSync(path.join(root,"supabase-public-chat-migration.sql"),"utf8");
const games=online.match(/const games=\{([\s\S]*?)\n\};/);
if(!games)fail("Cannot parse online game registry");else{const keys=[...games[1].matchAll(/^\s*(\w+):\{name:/gm)].map(m=>m[1]);for(const k of keys)if(!schema.includes("'"+k+"'"))fail("Game key missing from SQL: "+k);const wheel=app.match(/const wheelBaseGames=\[([\s\S]*?)\];/);if(!wheel)fail("Cannot parse wheel game registry");else for(const m of wheel[1].matchAll(/id:"([^"]+)"/g))if(!keys.includes(m[1]))fail("Wheel key missing online: "+m[1])}
for(const [name,sql] of [["schema",schema],["migration",migration]])for(const token of ["create table if not exists public.public_messages","alter table public.public_messages enable row level security","members read public chat","members send public chat as self","public_messages_rate_limit"])if(!sql.includes(token))fail(name+" missing "+token);
if(!social.includes("async function publicChat()")||!social.includes('if($("#openPublicChat"))$("#openPublicChat").onclick=publicChat;'))fail("Public chat button is not connected");
if(!social.includes('from("public_messages")')||!social.includes("setInterval"))fail("Public chat persistence/polling missing");
if(social.includes("الشات العام والغرف الشبكية يحتاجان مرحلة ربط إضافية"))fail("Obsolete public-chat placeholder remains");
if(!social.includes('ilike("username",v.toLowerCase())'))fail("Friend search does not query username");
if(!app.includes("window.setSuwadNickname"))fail("Account nickname sync missing");
if(!failures.length)pass("Game registry, public chat, friend search, account sync, migrations");
const backend=fs.readFileSync(path.join(root,"backend-config.js"),"utf8");const secretAssignment=/(?:^|[,{\s])(?:service_role|serviceRole|service_role_key|secret_key|secretKey)\s*[:=]\s*["\x27][^"\x27]+["\x27]/im.test(backend);if(secretAssignment)fail("Possible service-role/secret-key assignment detected");else pass("No service-role secret assignment in public config");
const readme=fs.readFileSync(path.join(root,"README.md"),"utf8");if(/الغرف ليست متصلة بين الأجهزة بعد|إنشاء الغرفة والانضمام إليها حالياً واجهات تجريبية/.test(readme))fail("README has obsolete prototype notes");else pass("README project description current");
if(failures.length)process.exit(1);console.log("Project validation completed.");
