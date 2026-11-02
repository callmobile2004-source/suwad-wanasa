async function joinRoom(code,game){
 if(busy)return;
 busy=true;
 try{
  await ensureSession();
  const joined=await db.rpc("join_game_room",{p_room_code:String(code||"").toUpperCase().trim(),p_display_name:nick()});
  if(joined.error)throw joined.error;
  const joinedRoom=Array.isArray(joined.data)?joined.data[0]:joined.data;
  if(!joinedRoom?.id)throw Error("لم ترجع قاعدة البيانات معلومات الغرفة.");
  close();
  await enterRoom(joinedRoom.id);
  history.replaceState({}, "",roomLink(joinedRoom.room_code));
 }catch(e){showError(e)}finally{busy=false}
}(() => {
"use strict";
const cfg=window.SUWAD_BACKEND||{}, $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const games={
 who:{name:"خَمِّنْ مَنُو آني؟",icon:"🧐",min:2,max:12},
 number:{name:"تخمين الرقم",icon:"🔢",min:2,max:8},
 liar:{name:"بَرا السالفة / مَنُو الكذّاب؟",icon:"🤥",min:3,max:16},
 most:{name:"مَنُو الأَكْثَر؟",icon:"👀",min:2,max:12},
 yesno:{name:"ممنوع إي ولا",icon:"🙊",min:2,max:12},
 snakes:{name:"حيّة ودرج",icon:"🐍",min:2,max:6},
 domino:{name:"دومينوا",icon:"🁣",min:2,max:4},
 tavla:{name:"طاولي مبسّطة",icon:"🎲",min:2,max:2},
 colors:{name:"كروت الألوان",icon:"🃏",min:2,max:8},
 quiz:{name:"تحدّي الأسئلة",icon:"🧠",min:2,max:12},
  wheel:{name:"دولاب الوناسة أونلاين",icon:"🎡",min:2,max:16}
};
let db=null, user=null, room=null, players=[], channel=null, poll=null, busy=false,roomTutorialKey="",roomTutorialStep=0,roomTutorialOpen=false;
let onlineWheelAudio=null,onlineWheelFrameId=null,lastOnlineWheelSpin=0,lastOnlineWheelAnimatedSpin=0;
let liarCard=null,liarCardKey="",liarCardRound=0,liarCardLoadingKey="",liarCardErrorKey="";
let dominoHand=null,dominoHandKey="",dominoHandLoadingKey="",dominoHandErrorKey="";
let colorsHand=null,colorsHandKey="",colorsHandLoadingKey="",colorsHandErrorKey="",selectedTavlaPoint=null;
function onlineSoundEnabled(){return typeof window.isSuwadSoundEnabled==="function"&&window.isSuwadSoundEnabled()}
function unlockOnlineWheelAudio(){try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;onlineWheelAudio=onlineWheelAudio||new Audio();if(onlineWheelAudio.state==="suspended")onlineWheelAudio.resume().catch(()=>{})}catch(e){}}
window.unlockSuwadOnlineAudio=unlockOnlineWheelAudio;
document.addEventListener("pointerdown",unlockOnlineWheelAudio,{passive:true});
function stopOnlineWheelMotion(){if(onlineWheelFrameId!==null){cancelAnimationFrame(onlineWheelFrameId);onlineWheelFrameId=null}}
function onlineWheelTick(){if(!onlineSoundEnabled())return;try{unlockOnlineWheelAudio();if(!onlineWheelAudio||onlineWheelAudio.state!=="running")return;const t=onlineWheelAudio.currentTime,o=onlineWheelAudio.createOscillator(),g=onlineWheelAudio.createGain();o.type="triangle";o.frequency.setValueAtTime(940,t);o.frequency.exponentialRampToValueAtTime(500,t+.034);g.gain.setValueAtTime(.09,t);g.gain.exponentialRampToValueAtTime(.001,t+.04);o.connect(g);g.connect(onlineWheelAudio.destination);o.start(t);o.stop(t+.042)}catch(e){}}
function onlineWheelFinish(){if(!onlineSoundEnabled())return;try{unlockOnlineWheelAudio();if(!onlineWheelAudio||onlineWheelAudio.state!=="running")return;const t=onlineWheelAudio.currentTime;[[660,0,.14],[880,.12,.16],[1175,.25,.22]].forEach(([f,d,dur])=>{const o=onlineWheelAudio.createOscillator(),g=onlineWheelAudio.createGain();o.type="sine";o.frequency.setValueAtTime(f,t+d);g.gain.setValueAtTime(.001,t+d);g.gain.linearRampToValueAtTime(.09,t+d+.025);g.gain.exponentialRampToValueAtTime(.001,t+d+dur);o.connect(g);g.connect(onlineWheelAudio.destination);o.start(t+d);o.stop(t+d+dur)})}catch(e){}}
function animateOnlineWheel(board){const spin=Number(board.spins||0);if(!board.spinning||!spin||spin<=lastOnlineWheelAnimatedSpin)return;stopOnlineWheelMotion();lastOnlineWheelAnimatedSpin=spin;const wheelEl=$(".online-wheel-visual");if(!wheelEl)return;const from=Number(board.startRotation||0),to=Number(board.rotation||0),duration=Number(board.spinDuration||5300),started=Number(board.spinStartedAt||Date.now()),arc=36;let lastSector=Math.floor((to-from)*Math.max(0,Math.min(1,(Date.now()-started)/duration))/arc);wheelEl.style.transition="none";function frame(now){if(!room||!$(".online-wheel-shell")||!room.game_state?.board?.spinning){stopOnlineWheelMotion();return}const elapsed=Math.max(0,Date.now()-started),p=Math.min(1,elapsed/duration),ease=1-Math.pow(1-p,4),angle=from+(to-from)*ease;wheelEl.style.transform="rotate("+angle+"deg)";const sector=Math.floor((to-from)*ease/arc);if(sector>lastSector){lastSector=sector;onlineWheelTick()}if(p<1)onlineWheelFrameId=requestAnimationFrame(frame);else{onlineWheelFrameId=null;wheelEl.style.transform="rotate("+to+"deg)"}}onlineWheelFrameId=requestAnimationFrame(frame)}
function toast(t){const x=$("#toast");if(x){x.textContent=t;x.classList.add("show");setTimeout(()=>x.classList.remove("show"),3000)}else alert(t)}
function show(html){const b=$("#modalBackdrop"),c=$("#modalContent");if(!b||!c)return;c.innerHTML=html;b.hidden=false;document.body.style.overflow="hidden";$("#modalClose").onclick=close;const back=$("#modalBackButton");if(back)back.onclick=close}
function close(){if(room){leaveRoom();return}stopOnlineWheelMotion();const b=$("#modalBackdrop");if(b)b.hidden=true;document.body.style.overflow=""}
function nick(){return (localStorage.getItem("sw_nickname")||"").trim()||"ضيف الوناسة"}
function gameOptions(selected){return Object.entries(games).map(([k,g])=>'<option value="'+k+'" '+(k===selected?"selected":"")+'>'+g.icon+" "+g.name+"</option>").join("")}
function namePrompt(){return new Promise(resolve=>{if(localStorage.getItem("sw_nickname"))return resolve(nick());show('<h2 id="modalTitle">شنو اسمك باللعبة؟</h2><p class="modal-lead">اسم عربي أو إنكليزي من حرفين إلى ٢٤ حرفاً.</p><div class="field"><label>اسم اللاعب</label><input id="onlineNick" maxlength="24" placeholder="اكتب اسمك" autocomplete="nickname"></div><button class="btn btn-gold full-btn" id="saveOnlineNick">متابعة</button>');$("#saveOnlineNick").onclick=()=>{const n=$("#onlineNick").value.trim();if([...n].length<2||[...n].length>24)return toast("الاسم لازم يكون من حرفين إلى ٢٤ حرفاً");localStorage.setItem("sw_nickname",n);if($("#profileName"))$("#profileName").textContent=n;if($("#avatarMini"))$("#avatarMini").textContent=[...n][0];close();resolve(n)}})}
async function ensureSession(){
 if(!window.supabase||!cfg.url||!cfg.anonKey)throw Error("إعداد الاتصال غير متوفر. تأكد من تحميل مكتبة Supabase وإعداداتها العامة.");
 if(!db)db=window.supabase.createClient(cfg.url,cfg.anonKey);
 if(!localStorage.getItem("sw_nickname"))await namePrompt();
 const sessionResult=await db.auth.getSession();
 if(sessionResult.error)throw sessionResult.error;
 user=sessionResult.data.session?.user||null;
 if(!user){
  const uname="p_"+Array.from(crypto.getRandomValues(new Uint8Array(8)),b=>b.toString(16).padStart(2,"0")).join("").slice(0,10);
  const authResult=await db.auth.signInAnonymously({options:{data:{display_name:nick(),username:uname}}});
  if(authResult.error)throw authResult.error;
  user=authResult.data.user||authResult.data.session?.user||null;
 }
 if(!user)throw Error("لم يكتمل تسجيل الدخول المجهول. تأكد من تفعيل Anonymous Sign-Ins في Supabase.");
 return user;
}
function roomErrorText(e){
 const m=String(e?.message||e?.details||e||"حدث خطأ غير معروف"),code=String(e?.code||"");
 if(/anonymous sign-?ins? (are )?disabled|anonymous provider.*disabled/i.test(m))return "الدخول المجهول غير مفعّل في Supabase. فعّله من Authentication ثم Sign In / Providers ثم Anonymous Sign-Ins.";
 if(/create_game_room|join_game_room|update_game_room_state|leave_game_room|PGRST202|42883|schema cache|game_rooms|game_room_players|relation .* does not exist|could not find the table/i.test(m))return "ترحيل أمان الغرف غير مطبّق أو لم يتحدّث مخطط Supabase بعد. شغّل supabase-room-security-migration.sql مرة واحدة في SQL Editor.";
if(code==="42501"||/row-level security|permission denied|not allowed/i.test(m))return "صلاحيات قاعدة البيانات تمنع هذه العملية. تأكد من تطبيق supabase-room-security-migration.sql على مشروع Supabase الصحيح.";
if(/failed to fetch|networkerror|load failed|fetch failed|timeout/i.test(m))return "المتصفح ما قدر يوصل إلى خادم Supabase. هذا مو خطأ بعدد اللاعبين: افحص أن مشروع Supabase مو متوقف، وأن Project URL وPublishable key صحيحان في Settings ثم API Keys، وبعدها جرّب شبكة إنترنت ثانية. إذا فشل اختبار الاتصال أدناه فالمشكلة بالخادم أو الشبكة وليست بإعدادات الغرفة.";
 if(code==="23505"||/duplicate key/i.test(m))return "صار تعارض برمز الغرفة أو مقعد اللاعب. اضغط إنشاء الغرفة مرة ثانية.";
 return m;
}
async function diagnoseBackend(){
 const configuredUrl=String(cfg.url||"").trim().replace(/\/$/,"");
 let projectHost="";
 try{projectHost=new URL(configuredUrl).hostname;}catch{}
 const projectRef=projectHost.endsWith(".supabase.co")?projectHost.slice(0,-".supabase.co".length):"";
 if(!/^[a-z]{20}$/.test(projectRef)){
  return "إعداد رابط Supabase داخل الموقع غير صحيح على الأغلب: الرابط الحالي هو "+configuredUrl+" ومعرّف المشروع فيه لا يطابق صيغة Supabase المعتادة (20 حرفاً صغيراً). افتح Supabase Dashboard ثم مشروعك ثم Settings > API، وانسخ Project URL كاملاً كما هو، ثم استبدل قيمة url في ملف backend-config.js داخل GitHub. لا تحذف أو تخمّن أي حرف؛ المفتاح العام لا يعوّض رابطاً خاطئاً.";
 }
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
 try{
  const response=await fetch(cfg.url.replace(/\/$/,"")+"/auth/v1/health",{method:"GET",cache:"no-store",signal:controller.signal});
  if(response.ok)return "اختبار الاتصال نجح: خادم Supabase يرد. حدّث الصفحة تحديثاً كاملاً، وإذا استمر الخطأ افتح Supabase Settings ثم API Keys وتأكد من المفتاح العام.";
  return "وصلنا إلى خادم Supabase لكنه رجّع HTTP "+response.status+". افتح مشروع Supabase وتأكد أنه نشط، ثم راجع Settings ثم API Keys.";
 }catch(e){
  return "فشل اختبار الوصول إلى "+cfg.url+" خلال ٨ ثوانٍ. افتح لوحة Supabase وتأكد أن المشروع Active؛ إذا كان Active جرّب بيانات الهاتف بدل Wi‑Fi أو العكس، وأوقف VPN أو DNS الحاجب مؤقتاً. GitHub Pages وحده ما يقدر يصلح خادم Supabase متوقفاً أو اتصالاً محجوباً.";
 }finally{clearTimeout(timer)}
}
async function showError(e){
 console.error(e);
 if(/failed to fetch|networkerror|load failed|fetch failed|timeout/i.test(String(e?.message||e))){
  toast(await diagnoseBackend());
 }else toast(roomErrorText(e));
}
function randomCode(){const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let out="";for(let i=0;i<6;i++)out+=chars[Math.floor(Math.random()*chars.length)];return out}
function roomLink(code){const u=new URL(location.href);u.searchParams.set("room",code);u.hash="";return u.toString()}
function setRoomCreateStatus(message,type="info"){
 const el=$("#roomCreateStatus");
 if(el){el.textContent=message;el.dataset.state=type;}
 else if(message)toast(message);
}
async function createRoom(game,name,max){
 if(busy)return;
 busy=true;
 const button=$("#confirmCreate");
 if(button){button.disabled=true;button.textContent="جارٍ إنشاء الغرفة…";}
 setRoomCreateStatus("جارٍ تسجيل الدخول وإنشاء الغرفة…","info");
 try{
  await ensureSession();
  const init={phase:"lobby",round:0,turn:0,feed:["أهلاً بيكم! الهوست يبدأ من يكتملون."],scores:{},board:null};
  let createdRoom=null,lastError=null;
  for(let attempt=0;attempt<4;attempt++){
   const created=await db.rpc("create_game_room",{p_room_code:randomCode(),p_room_name:name,p_game_key:game,p_max_players:max,p_game_state:init,p_display_name:nick()});
   if(!created.error){createdRoom=Array.isArray(created.data)?created.data[0]:created.data;break;}
   lastError=created.error;
   if(created.error.code!=="23505")throw created.error;
  }
  if(!createdRoom)throw lastError||Error("تعذّر إنشاء الغرفة.");
  history.replaceState({}, "",roomLink(createdRoom.room_code));
  close();
  await enterRoom(createdRoom.id);
 }catch(e){
  console.error("createRoom failed",e);
  setRoomCreateStatus(/failed to fetch|networkerror|load failed|fetch failed|timeout/i.test(String(e?.message||e))?await diagnoseBackend():roomErrorText(e),"error");
 }finally{
  busy=false;
  const current=$("#confirmCreate");
  if(current){current.disabled=false;current.textContent="أنشئ الغرفة وطلع الدعوة";}
 }
}
function roomForm(mode,selected="who",prefill=""){
 if(mode==="join"){
  show('<h2 id="modalTitle">انضم إلى غرفة أونلاين</h2><p class="modal-lead">اكتب الكود، أو افتح رابط الدعوة اللي وصلك.</p><div class="field"><label>كود الغرفة</label><input id="joinCodeInput" maxlength="8" placeholder="مثلاً A7K9Q2" value="'+esc(prefill)+'" autocapitalize="characters"></div><button class="btn btn-gold full-btn" id="confirmJoin">انضم للغرفة</button><p class="muted-note">تحتاج إنترنت واتصال قاعدة بيانات الغرف.</p>');
  $("#confirmJoin").onclick=()=>joinRoom($("#joinCodeInput").value);
  return;
 }
 show('<h2 id="modalTitle">أنشئ غرفة أونلاين ✨</h2><p class="modal-lead">كل اللاعبين يدخلون نفس الغرفة بالكود أو رابط الدعوة أو QR.</p><div class="field"><label>اسم الغرفة</label><input id="onlineRoomName" maxlength="32" value="لمة الربع" placeholder="لمة الربع"></div><div class="field"><label>اللعبة</label><select id="onlineRoomGame">'+gameOptions(selected)+'</select></div><div class="field"><label>العدد الكلي للاعبين (إنتَ وأصدقاؤك)</label><select id="onlineRoomMax"></select><small class="room-field-hint">مثلاً: اختيار ٢ يعني إنتَ ولاعب واحد تدعوه للغرفة، مو لاعبين إضافيين.</small></div><button class="btn btn-gold full-btn" id="confirmCreate">أنشئ الغرفة وطلع الدعوة</button><p id="roomCreateStatus" class="room-create-status" role="status" aria-live="polite"></p><p class="muted-note">بعد إنشاء الغرفة انسخ الرمز وارسله للاعب الثاني. تبدأ الجولة بعد دخول العدد المطلوب.</p>');
 const select=$("#onlineRoomMax"),gameSelect=$("#onlineRoomGame"),button=$("#confirmCreate");
 const syncMax=()=>{
  const g=games[gameSelect.value],options=[2,3,4,5,6,8,10,12,16].filter(n=>n>=g.min&&n<=g.max);
  select.innerHTML=options.map(n=>'<option value="'+n+'">'+n+' لاعبين بالمجموع</option>').join("");
  select.value=String(g.name==="دومينوا"?4:g.name==="طاولي مبسّطة"?2:options.includes(6)?6:options[0]);
 };
 gameSelect.onchange=syncMax;syncMax();
 button.onclick=()=>createRoom(gameSelect.value,$("#onlineRoomName").value.trim()||"لمة الربع",Number(select.value));
}
function inviteBox(){const link=roomLink(room.room_code);return '<div class="invite-panel"><div><small>كود الغرفة</small><strong class="room-code">'+esc(room.room_code)+'</strong></div><button class="btn btn-ghost" id="copyRoomCode">نسخ الكود</button><button class="btn btn-ghost" id="copyRoomLink">نسخ رابط الدعوة</button><img class="room-qr" alt="QR لدعوة الغرفة" src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data='+encodeURIComponent(link)+'"><small>امسح الباركود حتى تفتح رابط الغرفة</small></div>'}
async function copy(text){try{await navigator.clipboard.writeText(text);toast("تم النسخ")}catch{const x=document.createElement("textarea");x.value=text;document.body.append(x);x.select();document.execCommand("copy");x.remove();toast("تم النسخ")}}
function isHost(){return !!user&&room?.host_id===user.id}
function mePlayer(){return players.find(p=>p.user_id===user?.id)}
async function setState(){
 throw new Error("تم إيقاف إرسال حالة اللعبة من المتصفح. نفّذ الحركة عبر محرك الغرفة الخادمي.");
}
async function invokeRoomEngine(action,extra={}){
 if(!room||room.engine_version!==2)throw new Error("الغرفة تحتاج ترقية محرك الخادم قبل اللعب.");
 const result=await db.functions.invoke("room-engine-v2",{body:{
  action,room_id:room.id,...extra,
  ...(action==="get_liar_card"||action==="get_domino_hand"||action==="get_colors_hand"?{}:{expected_updated_at:room.updated_at})
 }});
 if(result.error)throw result.error;
 if(result.data?.room?.id)room=result.data.room;
 return result.data;
}
async function loadDominoHand(){
 if(!room||!user||room.game_key!=="domino"||room.engine_version!==2||room.game_state?.phase!=="playing")return;
 const roomId=room.id,playerId=user.id,round=Number(room.game_state?.round||1);
 const key=roomId+":"+playerId+":"+round;
 if(dominoHand&&dominoHandKey===key)return;
 if(dominoHandLoadingKey===key||dominoHandErrorKey===key)return;
 dominoHandLoadingKey=key;
 try{
  const result=await db.functions.invoke("room-engine-v2",{body:{action:"get_domino_hand",room_id:roomId}});
  if(room?.id!==roomId||user?.id!==playerId||Number(room.game_state?.round||1)!==round)return;
  if(result.error)throw result.error;
  if(!Array.isArray(result.data?.card?.tiles)||!result.data.card.tiles.every(tile=>Array.isArray(tile)&&tile.length===2&&tile.every(n=>Number.isInteger(n)&&n>=0&&n<=6)))throw Error("يد الدومينو المستلمة غير صالحة.");
  dominoHand=result.data.card;
  dominoHandKey=key;
  dominoHandErrorKey="";
  roomScreen();
 }catch(error){
  if(room?.id===roomId&&user?.id===playerId&&Number(room.game_state?.round||1)===round){
   dominoHand=null;dominoHandKey="";dominoHandErrorKey=key;
   roomScreen();
  }
 }finally{
  if(dominoHandLoadingKey===key)dominoHandLoadingKey="";
 }
}
function dominoTileCanPlay(tile,board,openingTile){
 if(!Array.isArray(tile)||tile.length!==2)return false;
 const [a,b]=tile.map(Number);
 if(!Array.isArray(board.chain)||board.chain.length===0){
  return Array.isArray(openingTile)&&a===Number(openingTile[0])&&b===Number(openingTile[1]);
 }
 return a===Number(board.left_end)||b===Number(board.left_end)||
        a===Number(board.right_end)||b===Number(board.right_end);
}
async function loadColorsHand(){
 if(!room||!user||room.game_key!=="colors"||room.engine_version!==2||room.game_state?.phase!=="playing")return;
 const roomId=room.id,playerId=user.id,round=Number(room.game_state?.round||1);
 const key=roomId+":"+playerId+":"+round;
 if(colorsHand&&colorsHandKey===key)return;
 if(colorsHandLoadingKey===key||colorsHandErrorKey===key)return;
 colorsHandLoadingKey=key;
 try{
  const result=await invokeRoomEngine("get_colors_hand");
  if(room?.id!==roomId||user?.id!==playerId||Number(room.game_state?.round||1)!==round)return;
  const tiles=result?.card?.tiles;
  if(!Array.isArray(tiles)||tiles.length>60||!tiles.every(card=>card&&typeof card.c==="string"&&typeof card.v==="string"))throw new Error("يد الألوان المستلمة غير صالحة.");
  colorsHand={tiles};colorsHandKey=key;colorsHandErrorKey="";
  roomScreen();
 }catch(error){
  if(room?.id===roomId&&user?.id===playerId&&Number(room.game_state?.round||1)===round){
   colorsHand=null;colorsHandKey="";colorsHandErrorKey=key;roomScreen();
  }
 }finally{
  if(colorsHandLoadingKey===key)colorsHandLoadingKey="";
 }
}
async function loadLiarCard(){
 if(!room||!user||room.game_key!=="liar"||room.engine_version!==2||room.game_state?.phase!=="playing")return;
 const roomId=room.id,playerId=user.id,round=Number(room.game_state?.round||1);
 const key=roomId+":"+playerId+":"+round;
 if(liarCard&&liarCardKey===roomId+":"+playerId&&liarCardRound===round)return;
 if(liarCardLoadingKey===key||liarCardErrorKey===key)return;
 liarCardLoadingKey=key;
 try{
  const result=await db.functions.invoke("room-engine-v2",{body:{action:"get_liar_card",room_id:roomId}});
  if(room?.id!==roomId||user?.id!==playerId||Number(room.game_state?.round||1)!==round)return;
  if(result.error)throw result.error;
  if(!result.data?.card||typeof result.data.card.is_outsider!=="boolean")throw Error("بطاقة الدور غير صالحة.");
  liarCard=result.data.card;
  liarCardKey=roomId+":"+playerId;
  liarCardRound=round;
  liarCardErrorKey="";
  roomScreen();
 }catch(error){
  if(room?.id===roomId&&user?.id===playerId&&Number(room.game_state?.round||1)===round){
   liarCard=null;liarCardKey="";liarCardErrorKey=key;
   roomScreen();
  }
 }finally{
  if(liarCardLoadingKey===key)liarCardLoadingKey="";
 }
}
async function startGameOnline(){if(!isHost())return toast("بس الهوست يگدر يبدأ اللعبة.");if(players.length<games[room.game_key].min)return toast("بعدكم مو مكتملين: دخل "+players.length+" من "+games[room.game_key].min+" لاعبين مطلوبين. شارك كود الغرفة وانتظر اللاعب الثاني.");let state={phase:"playing",round:1,turn:0,scores:Object.fromEntries(players.map(p=>[p.user_id,0])),feed:["بدأت اللعبة!"],board:null};const k=room.game_key;if(k==="domino"&&room.engine_version===2){const engine=await db.functions.invoke("room-engine-v2",{body:{action:"start_domino",room_id:room.id,expected_updated_at:room.updated_at}});if(engine.error)throw engine.error;if(!engine.data?.room?.id)throw Error("محرك الدومينو لم يرجع حالة الغرفة.");dominoHand=null;dominoHandKey="";dominoHandErrorKey="";room=engine.data.room;return;}if(k==="snakes"&&room.engine_version===2){const engine=await db.functions.invoke("room-engine-v2",{body:{action:"start_snakes",room_id:room.id,expected_updated_at:room.updated_at}});if(engine.error)throw engine.error;if(!engine.data?.room?.id)throw Error("محرك حيّة ودرج لم يرجع حالة الغرفة.");room=engine.data.room;return;}if(k==="liar"&&room.engine_version===2){const engine=await db.functions.invoke("room-engine-v2",{body:{action:"start_liar",room_id:room.id,expected_updated_at:room.updated_at}});if(engine.error)throw engine.error;if(!engine.data?.room?.id)throw Error("محرك برا السالفة لم يرجع حالة الغرفة.");liarCard=null;liarCardKey="";liarCardRound=0;liarCardErrorKey="";room=engine.data.room;return;}if(k==="number"&&room.engine_version===2){const engine=await db.functions.invoke("room-engine-v2",{body:{action:"start_number",room_id:room.id,expected_updated_at:room.updated_at}});if(engine.error)throw engine.error;if(!engine.data?.room?.id)throw Error("محرك تخمين الرقم لم يرجع حالة الغرفة.");room=engine.data.room;return;}if(k==="most"&&room.engine_version===2){const engine=await db.functions.invoke("room-engine-v2",{body:{action:"start_most",room_id:room.id,expected_updated_at:room.updated_at}});if(engine.error)throw engine.error;if(!engine.data?.room?.id)throw Error("محرك التصويت لم يرجع حالة الغرفة.");room=engine.data.room;return;}if(k==="quiz"&&room.engine_version===2){const engine=await db.functions.invoke("room-engine-v2",{body:{action:"start_quiz",room_id:room.id,expected_updated_at:room.updated_at}});if(engine.error)throw engine.error;if(!engine.data?.room?.id)throw Error("محرك المسابقة لم يرجع حالة الغرفة.");room=engine.data.room;return;}if(k==="yesno"&&room.engine_version===2){const engine=await db.functions.invoke("room-engine-v2",{body:{action:"start_yesno",room_id:room.id,expected_updated_at:room.updated_at}});if(engine.error)throw engine.error;if(!engine.data?.room?.id)throw Error("محرك نعم أو لا لم يرجع حالة الغرفة.");room=engine.data.room;return;}if(k==="snakes")state.board={positions:players.map(()=>0),dice:null,finished:null};if(k==="domino")state.board=makeDominoBoard();if(k==="tavla")state.board={positions:players.map((p,i)=>Array.from({length:15},(_,j)=>({point:(i===0?[0,11,16,18][j%4] : [23,12,7,5][j%4]),id:j}))),dice:[],selected:null,moves:0};if(k==="colors"){const deck=shuffle(Array.from({length:60},(_,i)=>({c:["أحمر","أزرق","أخضر","أصفر"][i%4],v:["١","٢","٣","٤","تخطي"][Math.floor(i/4)%5]})));const hands={};players.forEach(p=>hands[p.user_id]=deck.splice(0,7));state.board={deck,discard:[deck.pop()],hands,turn:0};}if(k==="quiz")state.board={question:0,answers:{}};if(k==="number")state.board={secret:Math.floor(Math.random()*100)+1,tries:{}};if(k==="liar")state.board={question:"كل لاعب يكتب تلميحاً عن الموضوع الظاهر، وصوّتوا بعدها على المشتبه به.",hints:{},votes:{}};if(k==="most")state.board={question:0,votes:{}};if(k==="yesno")state.board={question:0,answers:{}};if(k==="who")state.board={question:0,guesses:{}};if(k==="wheel")state.board={rotation:0,result:null,spins:0,stage:"landing"};const r=await setState(state,{status:"playing"});if(r.error)throw r.error;room={...room,game_state:state,status:"playing"};}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function makeDominoBoard(){const all=[];for(let a=0;a<=6;a++)for(let b=a;b<=6;b++)all.push([a,b]);shuffle(all);const hands={};players.forEach((p,i)=>hands[p.user_id]=all.splice(0,Math.max(5,Math.floor(28/players.length))));return {hands,chain:[],turn:0,draw:all,ended:false}}
const ladders={3:22,8:30,20:41,27:56,50:67,71:91,80:99},snakes={17:4,34:12,62:19,87:24,95:75,99:78};
const questions=["منو أكثر واحد يتأخر على اللمة؟","شنو أحلى سفرة تتمنّاها؟","منو يضحك أسرع واحد؟","شنو أكلة ما تملّ منها؟","منو أكثر واحد محظوظ؟","إذا ربحت مليون، شنو أول شي تشتريه؟"];
const quizPrompts=["شنو عاصمة العراق؟","كم عدد أيام الأسبوع؟","شنو أكبر كوكب بالمجموعة الشمسية؟"];
const yesnoPrompts=["هل تحب السفر؟","هل تگدر تعيش يوم بلا موبايل؟","هل تعتبر نفسك محظوظ؟"];
function roomScreen(){
 if(!room)return;
 const g=games[room.game_key],host=isHost(),mine=mePlayer(),state=room.game_state||{phase:"lobby",feed:[]};
 prepareRoomTutorial(room.game_key);
 if(room.game_key==="wheel"){
  if(!state.board?.spinning)stopOnlineWheelMotion();
  const stage=state.board?.stage||"landing";
  const spinNumber=Number(state.board?.spins||0);if(stage==="result"&&spinNumber>lastOnlineWheelSpin){lastOnlineWheelSpin=spinNumber;onlineWheelFinish()}
  let body='<div class="online-wheel-shell"><div class="online-wheel-room-head"><div><span class="pill">دولاب أونلاين مشترك</span><h2 id="modalTitle">🎡 '+esc(room.room_name)+'</h2><p class="modal-lead">الغرفة '+esc(room.room_code)+' • '+players.length+' لاعبين</p></div><button class="audio-close" id="leaveRoom" aria-label="مغادرة">×</button></div><div class="online-wheel-members">'+players.map((p,i)=>'<span>'+esc(p.display_name)+(p.user_id===room.host_id?' · الهوست':'')+'</span>').join("")+'</div>'+renderGame(g,state,mine,host)+'</div>';
  show(body);$("#leaveRoom").onclick=leaveRoom;const back=$("#modalBackButton");if(back)back.onclick=leaveRoom;const modalClose=$("#modalClose");if(modalClose)modalClose.onclick=leaveRoom;if(state.board?.spinning)animateOnlineWheel(state.board);wireGame(g,state,mine);return;
 }
 const guide=roomTutorialOpen?guideMarkup(room.game_key,roomTutorialStep):"";
 let body='<div class="online-room-head"><div><span class="pill">'+(state.phase==="playing"?"اللعبة شغالة":"غرفة أونلاين")+'</span><h2 id="modalTitle">'+g.icon+" "+esc(room.room_name)+'</h2><p class="modal-lead">'+esc(g.name)+' • '+players.length+'/'+room.max_players+' لاعبين</p><button class="btn btn-ghost" id="toggleGameGuide" aria-expanded="'+String(roomTutorialOpen)+'">📖 شرح مصوّر وصوتي</button></div><button class="audio-close" id="leaveRoom" aria-label="مغادرة">×</button></div><div id="gameGuidePanel" class="game-guide-panel" '+(roomTutorialOpen?"":"hidden")+'>'+guide+'</div>'+inviteBox()+'<div class="room-player-list"><h3>اللاعبون</h3>'+players.map((p,i)=>'<div class="friend-row"><span class="friend-avatar">'+(i+1)+'</span><span>'+esc(p.display_name)+(p.user_id===room.host_id?' <small>المضيف</small>':'')+'</span><b>'+(p.user_id===user.id?'إنت':'متصل')+'</b></div>').join("")+'</div>';
 if(state.phase==="finished"&&!(room.engine_version===2&&["liar","snakes","domino"].includes(room.game_key)))body+='<div class="question-panel"><h3>🏁 انتهت الجولة!</h3><p>يگدر المضيف يبدأ جولة جديدة.</p></div>';
 else if(state.phase!=="playing"&&!(room.engine_version===2&&["liar","snakes","domino"].includes(room.game_key))){
 const min=games[room.game_key].min,missing=Math.max(0,min-players.length),full=players.length>=room.max_players;
 body+='<div class="room-readiness"><b>اللاعبون داخل الغرفة: '+players.length+' من '+room.max_players+'</b><p>'+(missing>0?'حتى تبدأ '+esc(g.name)+' تحتاج '+missing+' لاعب '+(missing===1?'إضافي':'إضافيين')+'. انسخ كود الغرفة وارسله لربعك.':'اكتمل العدد المطلوب؛ الهوست يگدر يبدأ اللعب هسه.')+'</p>'+(full&&missing>0?'<small>الغرفة وصلت سعتها المحددة، غيّر عدد اللاعبين إذا تحتاج أكثر.</small>':'')+'</div><p class="muted-note">كود الغرفة ورابط الدعوة والـ QR موجودة أعلاه. اللاعب الثاني يفتح الرابط أو يدخل الكود من زر «انضم إلى غرفة».</p>'+(host?'<button class="btn btn-gold full-btn" id="startOnlineGame" '+(missing>0?'disabled':'')+'>'+(missing>0?'بانتظار '+missing+' لاعب إضافي':'ابدأ اللعبة')+'</button>':'<p class="hint-box">ننتظر المضيف يبدأ اللعبة بعد اكتمال العدد…</p>');
 }
 else body+=renderGame(g,state,mine,host);
 body+='<div class="room-bottom-actions"><button class="btn btn-ghost" id="refreshRoom">تحديث</button>'+(host&&(state.phase==="playing"||state.phase==="finished")&&!(room.engine_version===2&&["number","most","quiz","yesno","liar","snakes","domino"].includes(room.game_key))?'<button class="btn btn-ghost" id="restartOnlineGame">إعادة الجولة</button>':'')+'</div>';
 show(body);
 const back=$("#modalBackButton");if(back)back.onclick=leaveRoom;
 $("#copyRoomCode").onclick=()=>copy(room.room_code);$("#copyRoomLink").onclick=()=>copy(roomLink(room.room_code));$("#leaveRoom").onclick=leaveRoom;$("#refreshRoom").onclick=refreshRoom;
 const guideBtn=$("#toggleGameGuide");
 if(guideBtn)guideBtn.onclick=()=>{roomTutorialOpen=!roomTutorialOpen;localStorage.setItem("sw_online_tutorial_seen_"+room.game_key,"1");roomScreen()};
 const panel=$("#gameGuidePanel");
 if(panel&&roomTutorialOpen){const gdoc=gameGuides[room.game_key]||gameGuides.who,step=Math.min(roomTutorialStep,gdoc.steps.length-1),prev=$("#guidePrev"),next=$("#guideNext"),say=$("#speakGameGuide"),all=$("#speakFullGameGuide"),stop=$("#stopGameGuide");if(prev)prev.onclick=()=>{roomTutorialStep=Math.max(0,step-1);roomScreen()};if(next)next.onclick=()=>{roomTutorialStep=step===gdoc.steps.length-1?0:step+1;localStorage.setItem("sw_online_tutorial_seen_"+room.game_key,"1");roomScreen()};if(say)say.onclick=()=>speakGuide(room.game_key,false);if(all)all.onclick=()=>speakGuide(room.game_key,true);if(stop)stop.onclick=()=>{if("speechSynthesis"in window)speechSynthesis.cancel()}}
 if($("#startOnlineGame"))$("#startOnlineGame").onclick=async()=>{const b=$("#startOnlineGame");if(b)b.disabled=true;try{await startGameOnline();await refreshRoom()}catch(e){showError(e)}finally{const current=$("#startOnlineGame");if(current&&room&&room.game_state?.phase!=="playing")current.disabled=players.length<games[room.game_key].min}};
 if($("#restartOnlineGame"))$("#restartOnlineGame").onclick=()=>startGameOnline().catch(showError);
 wireGame(g,state,mine);
 if(room.game_key==="liar"&&room.engine_version===2&&state.phase==="playing")loadLiarCard();
 if(room.game_key==="domino"&&room.engine_version===2&&state.phase==="playing")loadDominoHand();
}
function renderGame(g,s,mine,host){const b=s.board||{},myTurn=room?.game_key==="domino"&&room.engine_version===2?b.current_player_id===user?.id:players[s.turn]?.user_id===user?.id;let h='<div class="online-game-board"><h3>🎮 '+esc(g.name)+'</h3><p class="turn-banner">'+(s.phase==="finished"?"انتهت الجولة":myTurn?"دورك هسه!":"الدور على "+esc(players[s.turn]?.display_name||"اللاعب التالي"))+'</p>';
if(room.game_key==="wheel"){
 const stage=b.stage||"landing",choices=["who","number","liar","yesno","most","snakes","domino","tavla","colors","quiz"];
 const icons=["🧐","🔢","🤥","🙊","👀","🐍","🁣","🎲","🃏","🧠"];
 const wheel='<div class="online-wheel-wrap"><span class="online-wheel-pointer" aria-hidden="true">▼</span><div class="online-wheel-visual" style="transform:rotate('+Number(b.rotation||0)+'deg)" role="img" aria-label="دولاب الوناسة بعشر ألعاب"><div class="online-wheel-disc">'+icons.map(x=>'<span>'+x+'</span>').join("")+'</div><div class="online-wheel-hub">سَـوَاد<small>وناسة</small></div></div></div>';
 const library='<div class="online-wheel-legend">'+["🧐 مَنُو آني؟","🔢 الرقم","🤥 برا السالفة","🙊 إي ولا","👀 الأكثر","🐍 حيّة ودرج","🁣 دومينوا","🎲 طاولي","🃏 كروت","🧠 أسئلة"].map(x=>'<span>'+x+'</span>').join("")+'</div><p class="wheel-coming-title">ألعاب إضافية قريباً</p><div class="online-wheel-legend coming">'+["🎨 ارسم وخمّن","🎭 مثّلها!","🧩 شنو الرابط؟","🕵️ صاحب الجواب","🔊 خَمِّن الصوت","🧠 ذاكرة اللمة","⚖️ لو خيّروك؟","🔤 آخر حرف"].map(x=>'<span>'+x+'</span>').join("")+'</div>';
 if(stage==="landing"){h='<section class="online-wheel-stage wheel-landing"><div class="wheel-emblem">🌐🎡</div><span class="eyebrow">اختيار جماعي متزامن</span><h2>دولاب الوناسة أونلاين</h2><p>لفة واحدة يشوفها كل الموجودين بنفس التوقيت، والنتيجة تنحفظ داخل الغرفة.</p><div class="wheel-howto"><b>قبل ما تبدون</b><p>المضيف يفتح ساحة الدولاب، وبعدها يلف مرة واحدة. كل لاعب يشوف الحركة والنتيجة نفسها.</p></div><div class="wheel-feature-row"><span>✦ '+players.length+' لاعبين بالغرفة</span><span>✧ '+(host?"إنت الهوست":"بانتظار الهوست")+'</span></div>'+(host?'<button class="btn btn-gold full-btn" id="enterOnlineWheelArena">ادخل ساحة الدولاب ✦</button>':'<p class="hint-box">ننتظر الهوست حتى يفتح ساحة الدولاب للجميع…</p>')+library+'</section>';return h}
 if(stage==="arena"){h='<section class="online-wheel-stage wheel-arena"><span class="pill">ساحة اللفّ المشتركة</span><h2>كلّكم على نفس اللفة 🎡</h2><p>'+(host?"اضغط وخلّ النتيجة تظهر لكل اللاعبين.":"الهوست راح يلفّ الدولاب، والنتيجة توصلكم بنفس اللحظة.")+'</p>'+wheel+'<div class="wheel-status">'+(b.result?"النتيجة السابقة: "+esc(games[b.result]?.name||"—"):"الدولاب جاهز للفة الأولى")+'</div>'+(host?'<button class="btn btn-gold full-btn" id="spinOnlineWheel">ابدأ اللفة المشتركة ✦</button><button class="btn btn-ghost full-btn" id="backOnlineWheelLanding">واجهة الدولاب الرئيسية</button>':'<p class="hint-box">بانتظار اللفة من الهوست…</p>')+library+'</section>';return h}
 if(stage==="result"&&b.result){h='<section class="online-wheel-stage wheel-result-screen"><span class="eyebrow">النتيجة وصلت لكل اللاعبين</span><div class="wheel-result-orbit">'+(games[b.result]?.icon||"🎉")+'</div><h2>الدولاب اختار لكم!</h2><div class="wheel-result-card"><small>اللعبة المختارة</small><h3>'+esc(games[b.result]?.name||"لعبة")+'</h3><p>الاختيار محفوظ بالغرفة ويظهر نفسه لكل لاعب يرجع أو يتصل من جديد.</p></div>'+(host?'<button class="btn btn-gold full-btn" id="chooseOnlineWheelResult">اعتمد اللعبة المختارة وانتقل إليها</button><button class="btn btn-ghost full-btn" id="spinOnlineWheelAgain">لفّ مرة ثانية</button><button class="btn btn-ghost full-btn" id="backOnlineWheelLanding">واجهة الدولاب الرئيسية</button>':'<p class="hint-box">بانتظار الهوست يعتمد اللعبة أو يعيد اللفة.</p>')+library+'</section>';return h}
}
if(room.game_key==="liar"&&room.engine_version===2){
 const card=liarCard&&liarCardKey===room.id+":"+user?.id&&liarCardRound===Number(s.round||1)?liarCard:null;
 const playerName=id=>players.find(p=>p.user_id===id)?.display_name||"لاعب";
 if(s.phase==="finished"||b.phase==="finished"){
  const tally=Object.entries(b.tally||{}).sort((a,c)=>Number(c[1])-Number(a[1]));
  const tallyMarkup=tally.map(([id,count])=>"<p>"+esc(playerName(id))+" <strong>"+Number(count)+"</strong> صوت</p>").join("")||"<p>لا توجد أصوات مكتملة.</p>";
  const leaders=Array.isArray(b.leaders)?b.leaders.map(playerName):[];
  const scores=Object.entries(s.scores||{}).map(([id,score])=>esc(playerName(id))+" "+Number(score)).join(" • ");
  const endReason=b.finish_reason==="player_left"?"انتهت الجولة لأن لاعباً غادر الغرفة.":"اكتمل التصويت.";
  h+='<section class="question-panel"><span class="pill">نتيجة برا السالفة</span><h3>🏁 انتهت الجولة</h3><p>'+esc(endReason)+'</p><p>الكلمة السرية: <strong>'+esc(b.secret_word||"غير متاحة")+'</strong></p><p>اللاعب الذي كان برا السالفة: <strong>'+esc(playerName(b.outsider_id))+'</strong></p><p>'+(b.outsider_caught?"✅ تم كشف اللاعب الغريب.":"🤫 اللاعب الغريب نجا من التصويت.")+'</p><h4>نتائج التصويت</h4><div class="room-feed">'+tallyMarkup+'</div><p>'+(leaders.length?"أكثر الأصوات: "+esc(leaders.join("، ")):"لا يوجد فائز منفرد.")+'</p><p>نقاط الجولة: '+scores+'</p>'+(host?'<button class="btn btn-gold full-btn" id="restartLiarGame">ابدأ جولة جديدة</button>':'<p class="hint-box">بانتظار المضيف يبدأ جولة جديدة.</p>')+'</section>';
  return h+"</div>";
 }
 const cardMarkup=card
  ?(card.is_outsider
    ?'<div class="liar-secret-card outsider"><span>🤥</span><b>أنت برا السالفة!</b><small>ما تعرف الكلمة السرية. حاول تكتشف الموضوع من تلميحات الآخرين.</small></div>'
    :'<div class="liar-secret-card insider"><span>🔐 الكلمة السرية</span><strong>'+esc(card.secret_word)+'</strong><small>الفئة: '+esc(card.category)+'</small></div>')
  :'<div class="question-panel">'+(liarCardErrorKey===room.id+":"+user?.id+":"+Number(s.round||1)?'تعذّر تحميل بطاقتك السرية. تأكد من نشر محرك الغرف على بيئة الاختبار. <button class="btn btn-ghost full-btn" id="retryLiarCard">إعادة المحاولة</button>':'جاري تحميل بطاقتك السرية…')+'</div>';
 h+='<section class="question-panel"><span class="pill">بطاقتك خاصة ولا تظهر لبقية اللاعبين</span>'+cardMarkup+'<p>الفئة: <strong>'+esc(b.category||"—")+'</strong></p>';
 if(b.phase==="hints"){
  h+='<h3>🗣️ مرحلة التلميحات</h3><p>كل لاعب يكتب تلميحاً واحداً من دون كشف الكلمة نفسها.</p><p>التلميحات المسجلة: '+Number(b.hint_count||0)+' من '+Number(b.hint_total||players.length)+'</p>';
  if(!card)h+='<p class="hint-box">لا ترسل أي شيء قبل استلام بطاقتك.</p>';
  else if(card.has_submitted_hint)h+='<p class="hint-box">✅ وصل تلميحك. انتظر بقية اللاعبين؛ التلميحات تظهر للجميع بعد اكتمالها.</p>';
  else h+='<label for="liarHintInput">تلميحك (حتى ١٠٠ حرف)</label><input id="liarHintInput" maxlength="100" autocomplete="off" placeholder="اكتب تلميحاً لا يكشف الكلمة مباشرة"><button class="btn btn-gold full-btn" id="submitLiarHint">إرسال التلميح</button>';
 }else if(b.phase==="voting"){
  const hints=Array.isArray(b.hints)?b.hints:[];
  h+='<h3>🗳️ مرحلة التصويت</h3><p>اقرأوا التلميحات وحددوا من تعتقدون أنه لا يعرف الكلمة.</p><div class="room-feed">'+(hints.map(item=>'<p><strong>'+esc(item.player_name||playerName(item.player_id))+'</strong>: '+esc(item.hint)+'</p>').join("")||"<p>لا توجد تلميحات معروضة.</p>")+'</div><p>الأصوات المسجلة: '+Number(b.vote_count||0)+' من '+Number(b.vote_total||players.length)+'</p>';
  if(!card)h+='<p class="hint-box">جاري تحميل بطاقتك…</p>';
  else if(card.has_voted)h+='<p class="hint-box">✅ تم تسجيل صوتك بسرية. انتظر اكتمال التصويت.</p>';
  else {
   const options=players.filter(p=>p.user_id!==user?.id).map(p=>'<option value="'+esc(p.user_id)+'">'+esc(p.display_name)+'</option>').join("");
   h+='<label for="liarVoteTarget">منو تتوقع برا السالفة؟</label><select id="liarVoteTarget"><option value="">اختار لاعباً</option>'+options+'</select><button class="btn btn-gold full-btn" id="voteLiar">تأكيد التصويت</button>';
  }
 }else{
  h+='<p class="hint-box">مرحلة اللعبة غير معروفة. حدّث الغرفة أو أعد المحاولة.</p>';
 }
 h+='</section>';
 return h+"</div>";
}
if(room.game_key==="domino"&&room.engine_version===2){
 const board=b,handData=dominoHand&&dominoHandKey===room.id+":"+user?.id+":"+Number(s.round||1)?dominoHand:null;
 const hand=handData?.tiles||[];
 const playerName=id=>players.find(p=>p.user_id===id)?.display_name||"غادر اللاعب";
 const order=Array.isArray(b.player_order)?b.player_order:players.map(p=>p.user_id);
 const counts=b.hand_counts||{};
 const chain=Array.isArray(b.chain)?b.chain:[];
 const chainMarkup=chain.length?chain.map(tile=>'<span class="domino-chain-tile">'+Number(tile[0])+'<i></i>'+Number(tile[1])+'</span>').join(""):'<span class="muted-note">ابدأوا بالدبل ستة</span>';
 const members=order.map(id=>'<div class="domino-member"><b>'+esc(playerName(id))+'</b><span>'+Number(counts[id]||0)+' قطعة</span></div>').join("");
 if(s.phase==="finished"||b.finish_reason){
  const winnerIds=Array.isArray(b.winner_ids)?b.winner_ids:[];
  const pips=Object.entries(b.pip_totals||{}).map(([id,total])=>'<p>'+esc(playerName(id))+': '+Number(total)+' نقطة على القطع المتبقية</p>').join("");
  const resultText=b.finish_reason==="player_left"?"انتهت الجولة لأن لاعباً غادر الغرفة.":b.finish_reason==="blocked"?(winnerIds.length===1?"انسدت اللعبة؛ فاز صاحب أقل مجموع نقاط.":"انسدت اللعبة وتعادل اللاعبون الأقل نقاطاً."):"أفرغ اللاعب يده من القطع وفاز.";
  h+='<section class="question-panel domino-v2"><span class="pill">دومينوا · نتائج الجولة</span><h3>🏁 انتهت الجولة</h3><p>'+esc(resultText)+'</p>'+
    (winnerIds.length?'<p>الفائز: <strong>'+esc(winnerIds.map(playerName).join("، "))+'</strong></p>':'')+
    '<div class="domino-chain">'+chainMarkup+'</div><div class="domino-members">'+members+'</div>'+
    (pips?'<h4>مجموع نقاط القطع المتبقية</h4>'+pips:'')+
    (host?'<button class="btn btn-gold full-btn" id="restartDominoGame">ابدأ جولة جديدة</button>':'<p class="hint-box">بانتظار المضيف يبدأ جولة جديدة.</p>')+
    '</section>';
  return h+"</div>";
 }
 const myTurn=b.current_player_id===user?.id;
 const canTiles=hand.filter(tile=>dominoTileCanPlay(tile,b,handData?.opening_tile));
 const tileMarkup=hand.map((tile,index)=>{
  const legal=dominoTileCanPlay(tile,b,handData?.opening_tile);
  return '<button type="button" class="domino-tile '+(legal&&myTurn?'domino-legal':'')+'" data-domino-index="'+index+'" '+(!legal||!myTurn?'disabled':'')+' aria-label="العب قطعة '+tile[0]+' و '+tile[1]+'"><b>'+tile[0]+'</b><i></i><b>'+tile[1]+'</b></button>';
 }).join("");
 const handArea=handData
  ?'<div class="domino-hand">'+tileMarkup+'</div>'
  :'<div class="question-panel">'+(dominoHandErrorKey===room.id+":"+user?.id+":"+Number(s.round||1)?'تعذّر تحميل يدك الخاصة. <button class="btn btn-ghost full-btn" id="retryDominoHand">إعادة المحاولة</button>':'جاري تحميل قطعك الخاصة…')+'</div>';
 const status=myTurn
  ?(canTiles.length?"عندك "+canTiles.length+" قطعة قانونية؛ اختار وحدة للعب.":Number(b.boneyard_count||0)>0?"ما عندك قطعة تطابق الطرفين؛ اسحب قطعة من الكومة.":"ما عندك حركة قانونية والكومة فارغة؛ مرّر الدور.")
  :"بانتظار "+playerName(b.current_player_id)+" حتى يلعب.";
 h+='<section class="question-panel domino-v2"><span class="pill">محرك خادمي · قطعك خاصة</span><p>'+esc(status)+'</p>'+
   '<div class="domino-chain">'+chainMarkup+'</div>'+
   '<div class="domino-endpoints"><span>الطرف الأيسر: <b>'+(b.left_end??"—")+'</b></span><span>الطرف الأيمن: <b>'+(b.right_end??"—")+'</b></span></div>'+
   '<div class="domino-members">'+members+'</div>'+
   '<div class="domino-pile">كومة السحب: <b>'+Number(b.boneyard_count||0)+'</b> قطعة</div>'+
   '<h4>قطعك الخاصة ('+hand.length+')</h4>'+handArea+
   (myTurn&&handData&&!canTiles.length&&Number(b.boneyard_count||0)>0?'<button type="button" class="btn btn-gold full-btn" id="drawDomino">اسحب قطعة</button>':'')+
   (myTurn&&handData&&!canTiles.length&&Number(b.boneyard_count||0)===0?'<button type="button" class="btn btn-ghost full-btn" id="passDomino">مرّر الدور</button>':'')+
   '</section>';
 return h+"</div>";
}
if(room.game_key==="snakes"&&room.engine_version===2){
 const positions=Array.isArray(b.positions)?b.positions:[];
 const order=Array.isArray(b.player_order)?b.player_order:players.map(p=>p.user_id);
 const display=id=>players.find(p=>p.user_id===id)?.display_name||"غادر اللاعب";
 const boardMarkup='<div class="snakes-board">'+Array.from({length:100},(_,i)=>{
  const n=100-i;
  return '<div class="snake-cell '+(ladders[n]?'ladder-cell':snakes[n]?'snake-cell-mark':'')+'"><b>'+n+'</b>'+
   positions.map((p,j)=>p===n?'<i title="'+esc(display(order[j]))+'">'+esc(display(order[j]).slice(0,1))+'</i>':"").join("")+
   '</div>';
 }).join("")+'</div>';
 const standings=order.map((id,i)=>'<p><strong>'+esc(display(id))+'</strong>: خانة '+Number(positions[i]||0)+'</p>').join("");
 if(s.phase==="finished"){
  const winner=Number.isInteger(b.finished)&&b.finished>=0?order[b.finished]:null;
  h+='<section class="question-panel"><span class="pill">نتيجة حيّة ودرج</span><h3>🏁 انتهت الجولة</h3>'+
    (b.finish_reason==="player_left"?'<p>انتهت الجولة لأن لاعباً غادر الغرفة.</p>':winner?'<p>🏆 الفائز: <strong>'+esc(display(winner))+'</strong></p>':'<p>انتهت الجولة.</p>')+
    '<div class="room-feed">'+standings+'</div>'+boardMarkup+
    (host?'<button class="btn btn-gold full-btn" id="restartSnakesGame">ابدأ جولة جديدة</button>':'<p class="hint-box">بانتظار المضيف يبدأ جولة جديدة.</p>')+
    '</section>';
 }else{
  h+='<section class="snakes-online-v2"><p>النرد والحركة محسوبان بالخادم. كل لاعب يرمي فقط في دوره، والفوز يتطلب الوصول إلى ١٠٠ بالضبط.</p>'+boardMarkup+
   '<p class="muted-note">الدرج يصعد: ٣، ٨، ٢٠، ٢٧، ٥٠، ٧١، ٨٠. الحيّات تنزل: ١٧، ٣٤، ٦٢، ٨٧، ٩٥، ٩٩.</p>'+
   '<p>آخر رمية: <strong>'+(b.dice??"—")+'</strong></p>'+
   '<div class="room-feed">'+standings+'</div>'+
   '<button class="btn btn-gold full-btn" id="rollSnake" '+(!myTurn?'disabled':'')+'>🎲 ارمي النرد من الخادم</button>'+
   '</section>';
 }
 return h+"</div>";
}
if(room.game_key==="snakes"){h+='<div class="snakes-board">'+Array.from({length:100},(_,i)=>{const n=100-i;const pos=b.positions||[];return '<div class="snake-cell '+(ladders[n]?'ladder-cell':snakes[n]?'snake-cell-mark':'')+'"><b>'+n+'</b>'+(pos.map((p,j)=>p===n?'<i title="'+esc(players[j]?.display_name||"")+'">'+esc((players[j]?.display_name||"?").slice(0,1))+'</i>':"").join(""))+'</div>'}).join("")+'</div><p class="muted-note">الدرج: ٣، ٨، ٢٠، ٢٧، ٥٠، ٧١، ٨٠. الحيّات ترجعك للخلف.</p><button class="btn btn-gold full-btn" id="rollSnake" '+(!myTurn?'disabled':'')+'>🎲 ارمي النرد</button><p>آخر رمية: '+(b.dice??"—")+'</p>'}
if(room.game_key==="domino"){const chain=b.chain||[],hand=b.hands?.[user?.id]||[];h+='<p>السلسلة: <strong class="domino-chain">'+(chain.length?chain.map(t=>t[0]+"|"+t[1]).join("  ·  "):"ابدأ بأي قطعة")+'</strong></p><p>قطعك ('+hand.length+') — هذا طور مفتوح لسهولة اللعب الجماعي؛ القطع ظاهرة للاعبين.</p><div class="domino-hand">'+hand.map((t,i)=>'<button class="domino-tile" data-domino="'+i+'" '+(!myTurn?'disabled':'')+'><b>'+t[0]+'</b><i></i><b>'+t[1]+'</b></button>').join("")+'</div><button class="btn btn-ghost full-btn" id="drawDomino" '+(!myTurn||!b.draw?.length?'disabled':'')+'>اسحب قطعة</button>'}
if(room.game_key==="tavla"){h+='<p>طاولي مبسّطة: ارمي النرد ثم اختار إحدى قطعك لتحريكها. الاتجاه يظهر حسب دورك.</p><div class="tavla-track">'+Array.from({length:24},(_,i)=>'<button class="tavla-point" data-point="'+i+'"><b>'+i+'</b><span>'+((b.positions||[]).flat().filter(p=>p.point===i).length)+'</span></button>').join("")+'</div><p>نتيجة النرد: '+(b.dice?.join(" + ")||"—")+'</p><button class="btn btn-gold full-btn" id="rollTavla" '+(!myTurn||b.dice?.length?'disabled':'')+'>ارمِ النرد</button>'}
if(room.game_key==="colors"){h+='<p>كروت الألوان: حاول تطابق اللون أو الرقم.</p><p>اللون الحالي: '+esc(b.discard?.at(-1)?.c||"اختار أول كارت")+'</p><div class="domino-hand">'+(b.hands?.[user?.id]||[]).map((c,i)=>'<button class="color-card color-'+["أحمر","أزرق","أخضر","أصفر"].indexOf(c.c)+'" data-color="'+i+'" '+(!myTurn?'disabled':'')+'>'+esc(c.c)+'<b>'+esc(c.v)+'</b></button>').join("")+'</div>'}
if(room.game_key==="yesno"&&room.engine_version===2){
 const qIndex=Number(b.question)||0;
 const prompt=yesnoPrompts[qIndex]||yesnoPrompts[0];
 if(b.phase==="results"||b.phase==="finished"){
  h+='<div class="question-panel"><span>الجولة '+(s.round||1)+' • السؤال '+(qIndex+1)+'</span><h3>'+esc(prompt)+'</h3><div class="room-feed"><p>نعم: <strong>'+Number(b.yes_count||0)+'</strong></p><p>لا: <strong>'+Number(b.no_count||0)+'</strong></p></div>'+(host?'<button class="btn btn-gold full-btn" id="nextOnlineRound">'+(b.phase==="finished"?"ابدأ لعبة جديدة":qIndex>=2?"إنهاء اللعبة":"السؤال التالي")+'</button>':'<p class="hint-box">بانتظار المضيف.</p>')+'</div>';
 }else{
  h+='<div class="question-panel"><span>الجولة '+(s.round||1)+' • السؤال '+(qIndex+1)+'</span><h3>'+esc(prompt)+'</h3><label for="onlineYesNoChoice">اختار إجابتك</label><select id="onlineYesNoChoice"><option value="yes">نعم</option><option value="no">لا</option></select><p>الإجابات المسجلة: '+Number(b.answer_count||0)+' من '+Number(b.answer_total||players.length)+'</p><button class="btn btn-gold full-btn" id="submitOnlineAnswer">إرسال الإجابة</button><p class="hint-box">اختيارك يبقى مخفياً حتى يجيب الجميع.</p></div>';
 }
}
if(room.game_key==="quiz"&&room.engine_version===2){
 const qIndex=Number(b.question)||0;
 const prompt=quizPrompts[qIndex]||quizPrompts[0];
 const nameOf=id=>b.player_names?.[id]||players.find(p=>p.user_id===id)?.display_name||"لاعب";
 if(b.phase==="results"||b.phase==="finished"){
  const results=Object.entries(b.results||{}).map(([id,correct])=>'<p>'+esc(nameOf(id))+' <strong>'+(correct?"إجابة صحيحة":"إجابة غير صحيحة")+'</strong></p>').join("");
  const scoreMarkup=Object.entries(s.scores||{}).map(([id,score])=>esc(nameOf(id))+' '+Number(score)).join(' • ');
  const answerText=b.correct_answer?'<h4>الإجابة الصحيحة: '+esc(b.correct_answer)+'</h4>':'<p>انتهت المسابقة لعدم كفاية اللاعبين.</p>';
  h+='<div class="question-panel"><span>الجولة '+(s.round||1)+' • السؤال '+(qIndex+1)+'</span><h3>'+esc(prompt)+'</h3>'+answerText+'<div class="room-feed">'+results+'</div><p>النقاط: '+scoreMarkup+'</p>'+(host?'<button class="btn btn-gold full-btn" id="nextOnlineRound">'+(b.phase==="finished"?"ابدأ مسابقة جديدة":qIndex>=2?"إنهاء المسابقة":"السؤال التالي")+'</button>':'<p class="hint-box">بانتظار المضيف.</p>')+'</div>';
 }else if(players.length<2){
  h+='<div class="question-panel"><h3>'+esc(prompt)+'</h3><p>ما بقى عدد كافٍ من اللاعبين لإكمال المسابقة.</p>'+(host?'<button class="btn btn-gold full-btn" id="nextOnlineRound">إنهاء المسابقة</button>':'<p class="hint-box">بانتظار المضيف لإنهاء المسابقة.</p>')+'</div>';
 }else{
  h+='<div class="question-panel"><span>الجولة '+(s.round||1)+' • السؤال '+(qIndex+1)+'</span><h3>'+esc(prompt)+'</h3><input id="onlineQuizAnswer" type="text" maxlength="120" autocomplete="off" placeholder="اكتب إجابتك"><p>الإجابات المسجلة: '+Number(b.answer_count||0)+' من '+Number(b.answer_total||players.length)+'</p><button class="btn btn-gold full-btn" id="submitOnlineAnswer">إرسال الإجابة</button><p class="hint-box">إجابة واحدة لكل لاعب. تظهر الإجابة الصحيحة بعد مشاركة الجميع.</p><div class="room-feed">'+(s.feed||[]).slice(-6).map(x=>'<p>'+esc(x)+'</p>').join("")+'</div></div>';
 }
}
if(room.game_key==="most"&&room.engine_version===2){
 const prompt=questions[(Number(b.question)||0)%questions.length];
 if(b.phase==="results"||b.phase==="finished"){
  const ranked=Object.entries(b.tally||{}).sort((a,c)=>Number(c[1])-Number(a[1]));
  const nameOf=id=>b.player_names?.[id]||players.find(p=>p.user_id===id)?.display_name||"لاعب";
  const tallyMarkup=ranked.map(([id,count])=>'<p>'+esc(nameOf(id))+' <strong>'+Number(count)+'</strong> صوت</p>').join("");
  const winnerIds=Array.isArray(b.winners)?b.winners:[];
  const winners=winnerIds.map(id=>nameOf(id));
  const scoreMarkup=Object.entries(s.scores||{}).map(([id,score])=>esc(nameOf(id))+' '+Number(score)).join(' • ');
  h+='<div class="question-panel"><span>الجولة '+(s.round||1)+' • السؤال '+(Number(b.question)+1)+'</span><h3>'+esc(prompt)+'</h3><h4>نتيجة التصويت</h4><div class="room-feed">'+tallyMarkup+'</div><p>'+(winners.length?'الأكثر تصويتاً: '+esc(winners.join('، ')):'ماكو نتيجة مسجلة')+'</p><p>نقاط اللمة: '+scoreMarkup+'</p>'+(host?'<button class="btn btn-gold full-btn" id="nextOnlineRound">'+(b.phase==="finished"?"ابدأ لعبة جديدة":Number(b.question)>=5?"إنهاء اللعبة":"السؤال التالي")+'</button>':'<p class="hint-box">بانتظار المضيف.</p>')+'</div>';
 }else if(players.length<2){
  h+='<div class="question-panel"><h3>'+esc(prompt)+'</h3><p>ما بقى عدد كافٍ من اللاعبين لإكمال التصويت.</p>'+(host?'<button class="btn btn-gold full-btn" id="nextOnlineRound">إنهاء اللعبة</button>':'<p class="hint-box">بانتظار المضيف لإنهاء اللعبة.</p>')+'</div>';
 }else{
  const options=players.map(p=>'<option value="'+esc(p.user_id)+'">'+esc(p.display_name)+'</option>').join("");
  h+='<div class="question-panel"><span>الجولة '+(s.round||1)+' • السؤال '+(Number(b.question)+1)+'</span><h3>'+esc(prompt)+'</h3><label for="onlineMostVote">اختار اللاعب اللي ينطبق عليه السؤال</label><select id="onlineMostVote">'+options+'</select><p>الأصوات المسجلة: '+Number(b.vote_count||0)+' من '+Number(b.vote_total||players.length)+'</p><button class="btn btn-gold full-btn" id="submitOnlineAnswer">إرسال التصويت</button><div class="room-feed">'+(s.feed||[]).slice(-6).map(x=>'<p>'+esc(x)+'</p>').join("")+'</div></div>';
 }
}
if(["most","yesno","quiz","who","liar","number"].includes(room.game_key)&&!(room.engine_version===2&&["most","quiz","yesno"].includes(room.game_key))){const prompts=room.game_key==="most"?questions:room.game_key==="yesno"?["هل تحب السفر؟","هل تگدر تعيش يوم بلا موبايل؟","هل تعتبر نفسك محظوظ؟"]:room.game_key==="quiz"?["شنو عاصمة العراق؟","كم عدد أيام الأسبوع؟","شنو أكبر كوكب بالمجموعة الشمسية؟"]:room.game_key==="who"?["خمّن الشخصية السرية: هل هي من عالم الحيوانات؟","اكتب تخمينك للشخصية"]:room.game_key==="liar"?[b.question||"اكتب تلميحك"]:["خمّن الرقم بين ١ و١٠٠"];const prompt=prompts[(b.question||0)%prompts.length];h+='<div class="question-panel"><span>الجولة '+(s.round||1)+'</span><h3>'+esc(prompt)+'</h3>'+(room.game_key==="number"?'<input id="onlineGuess" type="number" min="1" max="100" placeholder="رقم من ١ إلى ١٠٠">':room.game_key==="liar"?'<input id="onlineHint" maxlength="80" placeholder="اكتب تلميحك">':room.game_key==="who"?'<input id="onlineGuess" maxlength="80" placeholder="اكتب تخمينك">':'<input id="onlineAnswer" maxlength="120" placeholder="اكتب إجابتك أو تصويتك">')+'<button class="btn btn-gold full-btn" id="submitOnlineAnswer" '+(s.phase!=="playing"?'disabled':'')+'>إرسال الإجابة</button><div class="room-feed">'+(s.feed||[]).slice(-8).map(x=>'<p>'+esc(x)+'</p>').join("")+'</div><button class="btn btn-ghost full-btn" id="nextOnlineRound" '+((!host||(room.game_key==="number"&&room.engine_version===2&&s.phase!=="finished"))?'disabled':'')+'>'+(room.game_key==="number"&&room.engine_version===2?"ابدأ جولة جديدة":"السؤال التالي")+'</button></div>'}
h+='</div>';return h}
function wireGame(g,s,mine){const b=s.board||{},myTurn=players[s.turn]?.user_id===user?.id;
if($("#retryDominoHand"))$("#retryDominoHand").onclick=()=>{dominoHandErrorKey="";loadDominoHand()};
document.querySelectorAll("[data-domino-index]").forEach(button=>button.onclick=async()=>{
 if(!room||!myTurn||!dominoHand)return;
 const index=Number(button.dataset.dominoIndex),tile=dominoHand.tiles[index];
 if(!tile)return;
 button.disabled=true;
 try{
  const result=await db.functions.invoke("room-engine-v2",{body:{
   action:"play_domino",room_id:room.id,tile_a:Number(tile[0]),tile_b:Number(tile[1]),
   side:"auto",expected_updated_at:room.updated_at
  }});
  if(result.error)throw result.error;
  if(!result.data?.room?.id)throw Error("محرك الدومينو لم يرجع حالة الغرفة.");
  room=result.data.room;dominoHand=null;dominoHandKey="";dominoHandErrorKey="";await refreshRoom();
 }catch(error){showError(error);button.disabled=false;await refreshRoom(true)}
});
if($("#drawDomino"))$("#drawDomino").onclick=async()=>{
 const button=$("#drawDomino");if(button)button.disabled=true;
 try{
  const result=await db.functions.invoke("room-engine-v2",{body:{action:"draw_domino",room_id:room.id,expected_updated_at:room.updated_at}});
  if(result.error)throw result.error;
  if(!result.data?.room?.id)throw Error("محرك السحب لم يرجع حالة الغرفة.");
  room=result.data.room;dominoHand=null;dominoHandKey="";dominoHandErrorKey="";await refreshRoom();
 }catch(error){showError(error);if(button)button.disabled=false;await refreshRoom(true)}
};
if($("#passDomino"))$("#passDomino").onclick=async()=>{
 const button=$("#passDomino");if(button)button.disabled=true;
 try{
  const result=await db.functions.invoke("room-engine-v2",{body:{action:"pass_domino",room_id:room.id,expected_updated_at:room.updated_at}});
  if(result.error)throw result.error;
  if(!result.data?.room?.id)throw Error("محرك تمرير الدور لم يرجع حالة الغرفة.");
  room=result.data.room;dominoHand=null;dominoHandKey="";dominoHandErrorKey="";await refreshRoom();
 }catch(error){showError(error);if(button)button.disabled=false;await refreshRoom(true)}
};
if($("#restartDominoGame"))$("#restartDominoGame").onclick=async()=>{
 if(!isHost())return toast("إعادة الجولة من صلاحية المضيف فقط.");
 const button=$("#restartDominoGame");if(button)button.disabled=true;
 try{
  const result=await db.functions.invoke("room-engine-v2",{body:{action:"restart_domino",room_id:room.id,expected_updated_at:room.updated_at}});
  if(result.error)throw result.error;
  if(!result.data?.room?.id)throw Error("لم يرجع الخادم حالة الجولة الجديدة.");
  room=result.data.room;dominoHand=null;dominoHandKey="";dominoHandErrorKey="";await refreshRoom();
 }catch(error){showError(error);if(button)button.disabled=false}
};
if($("#retryLiarCard"))$("#retryLiarCard").onclick=()=>{liarCardErrorKey="";loadLiarCard()};
if($("#submitLiarHint"))$("#submitLiarHint").onclick=async()=>{
 const hint=$("#liarHintInput")?.value.trim();
 if(!hint||hint.length>100)return toast("اكتب تلميحاً من حرف إلى ١٠٠ حرف.");
 const button=$("#submitLiarHint");if(button)button.disabled=true;
 try{
  const result=await db.functions.invoke("room-engine-v2",{body:{action:"submit_liar_hint",room_id:room.id,hint,expected_updated_at:room.updated_at}});
  if(result.error)throw result.error;
  if(!result.data?.room?.id)throw Error("لم يرجع الخادم حالة الغرفة.");
  room=result.data.room;liarCard=null;liarCardKey="";liarCardErrorKey="";await refreshRoom();
 }catch(error){showError(error);if(button)button.disabled=false}
};
if($("#voteLiar"))$("#voteLiar").onclick=async()=>{
 const target=$("#liarVoteTarget")?.value;
 if(!target||target===user?.id)return toast("اختار لاعباً آخر حتى تصوّت.");
 const button=$("#voteLiar");if(button)button.disabled=true;
 try{
  const result=await db.functions.invoke("room-engine-v2",{body:{action:"vote_liar",room_id:room.id,vote_target:target,expected_updated_at:room.updated_at}});
  if(result.error)throw result.error;
  if(!result.data?.room?.id)throw Error("لم يرجع الخادم نتيجة التصويت.");
  room=result.data.room;liarCard=null;liarCardKey="";await refreshRoom();
 }catch(error){showError(error);if(button)button.disabled=false}
};
if($("#restartLiarGame"))$("#restartLiarGame").onclick=async()=>{
 if(!isHost())return toast("إعادة الجولة من صلاحية المضيف فقط.");
 const button=$("#restartLiarGame");if(button)button.disabled=true;
 try{
  const result=await db.functions.invoke("room-engine-v2",{body:{action:"restart_liar",room_id:room.id,expected_updated_at:room.updated_at}});
  if(result.error)throw result.error;
  if(!result.data?.room?.id)throw Error("لم يرجع الخادم حالة الجولة الجديدة.");
  room=result.data.room;liarCard=null;liarCardKey="";liarCardRound=0;liarCardErrorKey="";await refreshRoom();
 }catch(error){showError(error);if(button)button.disabled=false}
};
if($("#restartSnakesGame"))$("#restartSnakesGame").onclick=async()=>{
 if(!isHost())return toast("إعادة الجولة من صلاحية المضيف فقط.");
 const button=$("#restartSnakesGame");if(button)button.disabled=true;
 try{
  const result=await db.functions.invoke("room-engine-v2",{body:{action:"restart_snakes",room_id:room.id,expected_updated_at:room.updated_at}});
  if(result.error)throw result.error;
  if(!result.data?.room?.id)throw Error("لم يرجع الخادم حالة الجولة الجديدة.");
  room=result.data.room;await refreshRoom();
 }catch(error){showError(error);if(button)button.disabled=false}
};


if($("#enterOnlineWheelArena"))$("#enterOnlineWheelArena").onclick=async()=>{if(!isHost())return;const next={...s,board:{...b,stage:"arena"}};const r=await setState(next,{status:"playing"});if(r.error)showError(r.error);else{room={...room,game_state:next};await refreshRoom()}};
if($("#chooseOnlineWheelResult"))$("#chooseOnlineWheelResult").onclick=async()=>{if(!isHost()||!b.result)return;const next={phase:"lobby",round:0,turn:0,feed:["اختار الدولاب لعبة "+games[b.result].name],scores:{},board:null};const r=await setState(next,{game_key:b.result,status:"waiting"});if(r.error)showError(r.error);else{room={...room,game_key:b.result,game_state:next,status:"waiting"};await refreshRoom()}};
if($("#backOnlineWheelLanding"))$("#backOnlineWheelLanding").onclick=async()=>{if(!isHost())return;const next={...s,board:{...b,result:null,stage:"landing"}};const r=await setState(next,{status:"playing"});if(r.error)showError(r.error);else{room={...room,game_state:next};await refreshRoom()}};
if($("#spinOnlineWheelAgain"))$("#spinOnlineWheelAgain").onclick=async()=>{if(!isHost()||busy)return;const next={...s,board:{...b,result:null,stage:"arena"}};const r=await setState(next,{status:"playing"});if(r.error)showError(r.error);else{room={...room,game_state:next};await refreshRoom()}};
if($("#spinOnlineWheel"))$("#spinOnlineWheel").onclick=async()=>{if(!isHost()||busy)return;busy=true;const button=$("#spinOnlineWheel"),choices=["who","number","liar","yesno","most","snakes","domino","tavla","colors","quiz"].filter(key=>players.length>=games[key].min&&players.length<=games[key].max);if(!choices.length){busy=false;return toast("عدد اللاعبين الحالي ما يناسب أي لعبة بالدولاب.")}const resultIndex=Math.floor(Math.random()*choices.length),result=choices[resultIndex],startRotation=Number(b.rotation||0),arc=360/choices.length,rotation=startRotation+360*(7+Math.floor(Math.random()*3))+((360-((startRotation+(resultIndex+.5)*arc)%360))%360),duration=6500,spinNumber=(b.spins||0)+1,startedAt=Date.now();if(button){button.disabled=true;button.textContent="الدولاب يدور…"}const spinning={...s,phase:"playing",board:{...b,result:null,startRotation,rotation,spins:spinNumber,stage:"arena",spinning:true,spinStartedAt:startedAt,spinDuration:duration}};try{const begin=await setState(spinning,{status:"playing"});if(begin.error)throw begin.error;room={...room,game_state:spinning};await refreshRoom();await new Promise(resolve=>setTimeout(resolve,duration+120));const finished={...spinning,board:{...spinning.board,spinning:false,result,stage:"result"},feed:[...(s.feed||[]),nick()+" لفّ الدولاب واختار "+games[result].name]};const done=await setState(finished,{status:"playing"});if(done.error)throw done.error;room={...room,game_state:finished};await refreshRoom()}catch(e){showError(e)}finally{busy=false}};
if($("#rollSnake"))$("#rollSnake").onclick=async()=>{
 if(!myTurn)return;
 const button=$("#rollSnake");if(button)button.disabled=true;
 try{
  if(room.engine_version===2){
   const result=await db.functions.invoke("room-engine-v2",{body:{action:"roll_snakes",room_id:room.id,expected_updated_at:room.updated_at}});
   if(result.error)throw result.error;
   if(!result.data?.room?.id)throw Error("محرك النرد لم يرجع حالة الغرفة.");
   room=result.data.room;await refreshRoom();return;
  }
  const die=1+Math.floor(Math.random()*6),pos=[...(b.positions||[])],old=pos[s.turn],step=old+die;
  let next=step>100?old:step;next=ladders[next]||snakes[next]||next;pos[s.turn]=next;
  const fin=next===100?s.turn:null;
  await setState({...s,turn:fin===null?(s.turn+1)%players.length:s.turn,board:{...b,positions:pos,dice:die,finished:fin},phase:fin===null?"playing":"finished",feed:[...(s.feed||[]),esc(players[s.turn].display_name)+" رمى "+die+" ووصل "+next]},{status:fin===null?"playing":"finished"}).then(r=>{if(r.error)showError(r.error)});
 }catch(error){showError(error);if(button)button.disabled=false}
};
if(room.engine_version!==2&&$("#drawDomino"))$("#drawDomino").onclick=async()=>{const draw=[...(b.draw||[])],hands={...b.hands},hand=[...(hands[user.id]||[])];if(!draw.length)return toast("خلصت القطع");hand.push(draw.pop());hands[user.id]=hand;await setState({...s,board:{...b,draw,hands},feed:[...(s.feed||[]),nick()+" سحب قطعة"]}).then(r=>r.error&&showError(r.error))};
document.querySelectorAll("[data-domino]").forEach(el=>el.onclick=async()=>{const hand=[...(b.hands?.[user.id]||[])],tile=hand[Number(el.dataset.domino)],chain=[...(b.chain||[])];if(!tile||!myTurn)return;if(chain.length){const left=chain[0][0],right=chain.at(-1)[1];let side="right";if(tile[0]===right){}else if(tile[1]===right){tile.reverse()}else if(tile[1]===left){tile.reverse();side="left"}else if(tile[0]===left){side="left"}else return toast("هاي القطعة ما تطابق طرف السلسلة.");if(side==="left")chain.unshift(tile);else chain.push(tile)}else chain.push(tile);hand.splice(Number(el.dataset.domino),1);const hands={...b.hands,[user.id]:hand};const win=hand.length===0;await setState({...s,phase:win?"finished":"playing",turn:(s.turn+1)%players.length,board:{...b,hands,chain},feed:[...(s.feed||[]),nick()+" لعب "+tile.join("|")]},{status:win?"finished":"playing"}).then(r=>r.error&&showError(r.error))});
if($("#rollTavla"))$("#rollTavla").onclick=async()=>{const dice=[1+Math.floor(Math.random()*6),1+Math.floor(Math.random()*6)];await setState({...s,board:{...b,dice,selected:null},feed:[...(s.feed||[]),nick()+" رمى "+dice.join(" و ")]}).then(r=>r.error&&showError(r.error))};
document.querySelectorAll("[data-point]").forEach(el=>el.onclick=async()=>{if(!myTurn||!b.dice?.length)return;const point=Number(el.dataset.point),pos=(b.positions||[]).map(a=>a.map(p=>({...p}))),minePieces=pos[s.turn]||[];if(b.selected===null||b.selected===undefined){const piece=minePieces.find(p=>p.point===point);if(!piece)return toast("اختار نقطة بيها قطعة إلك.");await setState({...s,board:{...b,positions:pos,selected:point}}).then(r=>r.error&&showError(r.error));return}const die=b.dice[0],dest=room.game_key==="tavla"?(s.turn===0?b.selected+die:b.selected-die):point;if(point!==dest)return toast("الوجهة لازم تطابق حركة النرد ("+dest+").");const piece=minePieces.find(p=>p.point===b.selected);if(!piece)return;piece.point=dest;const rest=b.dice.slice(1);await setState({...s,turn:rest.length?s.turn:(s.turn+1)%players.length,board:{...b,positions:pos,dice:rest,selected:null},feed:[...(s.feed||[]),nick()+" حرّك قطعة إلى "+dest]},{status:"playing"}).then(r=>r.error&&showError(r.error))});
document.querySelectorAll("[data-color]").forEach(el=>el.onclick=async()=>{if(!myTurn)return;const hands={...b.hands},hand=[...(hands[user.id]||[])],card=hand[Number(el.dataset.color)],top=b.discard?.at(-1);if(!card)return;if(top&&card.c!==top.c&&card.v!==top.v)return toast("اختار كارت يطابق اللون أو الرقم.");hand.splice(Number(el.dataset.color),1);hands[user.id]=hand;await setState({...s,phase:hand.length?"playing":"finished",turn:(s.turn+1)%players.length,board:{...b,hands,discard:[...(b.discard||[]),card]},feed:[...(s.feed||[]),nick()+" لعب كارت "+card.c+" "+card.v]},{status:hand.length?"playing":"finished"}).then(r=>r.error&&showError(r.error))});
if($("#submitOnlineAnswer"))$("#submitOnlineAnswer").onclick=async()=>{
 if(room.game_key==="yesno"&&room.engine_version===2){
  const choice=$("#onlineYesNoChoice")?.value;
  if(choice!=="yes"&&choice!=="no")return toast("اختار نعم أو لا.");
  const engine=await db.functions.invoke("room-engine-v2",{body:{action:"answer_yesno",room_id:room.id,answer_yesno:choice==="yes",expected_updated_at:room.updated_at}});
  if(engine.error){showError(engine.error);return;}
  if(!engine.data?.room?.id){toast("لم تصل نتيجة الإجابة من الخادم.");return;}
  room=engine.data.room;await refreshRoom();toast("تم تسجيل اختيارك بسرية.");return;
 }
 if(room.game_key==="quiz"&&room.engine_version===2){
  const answer=$("#onlineQuizAnswer")?.value.trim();
  if(!answer||answer.length>120)return toast("اكتب إجابة بين حرف واحد و١٢٠ حرفاً.");
  const engine=await db.functions.invoke("room-engine-v2",{body:{action:"answer_quiz",room_id:room.id,answer,expected_updated_at:room.updated_at}});
  if(engine.error){showError(engine.error);return;}
  if(!engine.data?.room?.id){toast("لم تصل نتيجة الإجابة من الخادم.");return;}
  room=engine.data.room;await refreshRoom();toast("تم تسجيل إجابتك بسرية.");return;
 }
 if(room.game_key==="most"&&room.engine_version===2){
  const voteTarget=$("#onlineMostVote")?.value;
  if(!voteTarget)return toast("اختار لاعباً قبل إرسال التصويت.");
  const engine=await db.functions.invoke("room-engine-v2",{body:{action:"vote_most",room_id:room.id,vote_target:voteTarget,expected_updated_at:room.updated_at}});
  if(engine.error){showError(engine.error);return;}
  if(!engine.data?.room?.id){toast("لم تصل نتيجة التصويت من الخادم.");return;}
  room=engine.data.room;await refreshRoom();toast("تم تسجيل صوتك بسرية.");return;
 }
 const input=$("#onlineGuess")||$("#onlineHint")||$("#onlineAnswer"),val=input?.value.trim();if(!val)return toast("اكتب إجابتك أولاً.");if(room.game_key==="number"&&room.engine_version===2){const guess=Number(val);if(!Number.isInteger(guess)||guess<1||guess>100)return toast("أدخل رقماً صحيحاً من ١ إلى ١٠٠.");const engine=await db.functions.invoke("room-engine-v2",{body:{action:"guess_number",room_id:room.id,guess,expected_updated_at:room.updated_at}});if(engine.error){showError(engine.error);return;}if(!engine.data?.room?.id){toast("لم تصل نتيجة التخمين من الخادم.");return;}room=engine.data.room;await refreshRoom();toast("تم تسجيل التخمين من الخادم.");return;}const feed=[...(s.feed||[]),nick()+": "+val];const board={...b};if(room.game_key==="number"){const n=Number(val),tries={...(b.tries||{})};tries[user.id]=(tries[user.id]||0)+1;feed.push(n===b.secret?"🎉 إجابة صحيحة!":n<b.secret?"الرقم أكبر من "+n:"الرقم أصغر من "+n);if(n===b.secret)feed.push("فاز "+nick()+" بعد "+tries[user.id]+" محاولات.");board.tries=tries;}else if(room.game_key==="liar")board.hints={...(b.hints||{}),[user.id]:val};else if(room.game_key==="most")board.votes={...(b.votes||{}),[user.id]:val};else if(room.game_key==="yesno"||room.game_key==="quiz")board.answers={...(b.answers||{}),[user.id]:val};else if(room.game_key==="who")board.guesses={...(b.guesses||{}),[user.id]:val};await setState({...s,board,feed,round:(s.round||1)+(room.game_key==="number"&&Number(val)===b.secret?0:0)}).then(r=>r.error?showError(r.error):toast("وصلت إجابتك للغرفة!"))};
if($("#nextOnlineRound"))$("#nextOnlineRound").onclick=async()=>{
  if(!isHost())return;
  if(room.game_key==="yesno"&&room.engine_version===2){
   const action=b.phase==="finished"?"restart_yesno":"next_yesno";
   const engine=await db.functions.invoke("room-engine-v2",{body:{action,room_id:room.id,expected_updated_at:room.updated_at}});
   if(engine.error){showError(engine.error);return;}
   if(!engine.data?.room?.id){toast("لم تصل حالة اللعبة من الخادم.");return;}
   room=engine.data.room;await refreshRoom();return;
  }
  if(room.game_key==="quiz"&&room.engine_version===2){
   const action=b.phase==="finished"?"restart_quiz":"next_quiz";
   const engine=await db.functions.invoke("room-engine-v2",{body:{action,room_id:room.id,expected_updated_at:room.updated_at}});
   if(engine.error){showError(engine.error);return;}
   if(!engine.data?.room?.id){toast("لم تصل حالة المسابقة من الخادم.");return;}
   room=engine.data.room;await refreshRoom();return;
  }
  if(room.game_key==="most"&&room.engine_version===2){
   const action=b.phase==="finished"?"restart_most":"next_most";
   const engine=await db.functions.invoke("room-engine-v2",{body:{action,room_id:room.id,expected_updated_at:room.updated_at}});
   if(engine.error){showError(engine.error);return;}
   if(!engine.data?.room?.id){toast("لم تصل حالة اللعبة من الخادم.");return;}
   room=engine.data.room;await refreshRoom();return;
  }
  if(room.game_key==="number"&&room.engine_version===2){
   if(s.phase!=="finished")return toast("لا يمكن بدء جولة جديدة قبل انتهاء الجولة الحالية.");
   const engine=await db.functions.invoke("room-engine-v2",{body:{action:"restart_number",room_id:room.id,expected_updated_at:room.updated_at}});
   if(engine.error){showError(engine.error);return;}
   if(!engine.data?.room?.id){toast("لم تصل حالة الجولة الجديدة من الخادم.");return;}
   room=engine.data.room;await refreshRoom();toast("بدأت جولة جديدة.");return;
  }
  const next={...s,round:(s.round||1)+1,turn:((s.turn||0)+1)%players.length,board:{...b,question:((b.question||0)+1),answers:{},votes:{},hints:{},guesses:{}},feed:[...(s.feed||[]),"بدأت جولة جديدة"]};
  await setState(next).then(r=>r.error&&showError(r.error));
};
}
async function enterRoom(id){liarCard=null;liarCardKey="";liarCardRound=0;liarCardLoadingKey="";liarCardErrorKey="";dominoHand=null;dominoHandKey="";dominoHandLoadingKey="";dominoHandErrorKey="";if(channel){db.removeChannel(channel);channel=null}const rr=await db.from("game_rooms").select("*").eq("id",id).single();if(rr.error)throw rr.error;room=rr.data;await refreshPlayers();roomScreen();channel=db.channel("room-"+id).on("postgres_changes",{event:"*",schema:"public",table:"game_rooms",filter:"id=eq."+id},payload=>{if(payload.new){room=payload.new;refreshPlayers().then(roomScreen)}}).on("postgres_changes",{event:"*",schema:"public",table:"game_room_players",filter:"room_id=eq."+id},()=>refreshPlayers().then(roomScreen)).subscribe();if(poll)clearInterval(poll);poll=setInterval(()=>{if(room)refreshRoom(true)},6000)}
async function refreshPlayers(){if(!room)return;const r=await db.from("game_room_players").select("*").eq("room_id",room.id).order("seat");if(r.error)throw r.error;players=r.data||[]}
async function refreshRoom(silent=false){if(!room)return;try{const r=await db.from("game_rooms").select("*").eq("id",room.id).single();if(r.error)throw r.error;room=r.data;await refreshPlayers();if(!silent)roomScreen();else if(!$("#modalBackdrop").hidden&&($("#modalContent").querySelector(".online-room-head")||$("#modalContent").querySelector(".online-wheel-shell")))roomScreen()}catch(e){if(!silent)showError(e)}}
async function leaveRoom(){if(!room)return;const leavingRoom=room,leavingUser=user;liarCard=null;liarCardKey="";liarCardRound=0;liarCardLoadingKey="";liarCardErrorKey="";dominoHand=null;dominoHandKey="";dominoHandLoadingKey="";dominoHandErrorKey="";stopOnlineWheelMotion();if(channel)db.removeChannel(channel);channel=null;if(poll)clearInterval(poll);poll=null;room=null;players=[];history.replaceState({}, "",location.pathname+location.hash);const backdrop=$("#modalBackdrop");if(backdrop)backdrop.hidden=true;document.body.style.overflow="";toast("غادرت الغرفة");if(leavingUser){try{const result=await db.rpc("leave_game_room",{p_room_id:leavingRoom.id});if(result.error)throw result.error}catch(e){console.warn("leaveRoom server cleanup failed",e);toast("خرجت من الواجهة، لكن تعذّر تأكيد المغادرة من الخادم: "+roomErrorText(e))}}}

const roomTutorialArt={"who":[["🗂️","١. اختار الفئة",["🐾 الحيوانات","🎮 شخصيات الألعاب"]],["💬","٢. اكتب سؤالاً",["هل أعيش بالبحر؟","هل أنا شخصية كرتونية؟"]],["🧠","٣. سجّل التلميح",["نعم","لا","أحتاج تلميح"]],["🎯","٤. ثبّت التخمين",["اختار الاسم","ثبّت تخميني"]]],"number":[["🔢","١. الرقم بين ١ و١٠٠",["١","٥٠","١٠٠"]],["⌨️","٢. أدخل تخمينك",["اكتب ٤٠","خمّن"]],["📈","٣. اقرأ التلميح",["أعلى","أقل"]],["🏆","٤. أصب الرقم",["رقم صحيح","محاولاتك"]]],"liar":[["👥","١. اكتبوا الأسماء",["علي","حسن","زهراء"]],["🔒","٢. مرّروا الجهاز",["لا تطالع الشاشة","اكشف بطاقتك"]],["🤫","٣. شاهد دورك",["الكلمة السرية","أو: أنت الكذّاب"]],["🗣️","٤. أعطوا تلميحاً",["من دون ذكر الكلمة","ناقشوا"]],["🗳️","٥. صوّتوا",["اختاروا المشتبه به","اكشفوا النتيجة"]]],"most":[["👥","١. أدخل أسماء الربع",["لاعب ١","لاعب ٢","لاعب ٣"]],["❓","٢. اقرأوا العبارة",["منو الأكثر احتمالاً؟","يتأخر على اللمة"]],["🗳️","٣. كل لاعب يصوّت",["اختار اسماً","صوّت له"]],["🏆","٤. شاهدوا الترتيب",["الأصوات","النتيجة"]]],"yesno":[["🙋","١. اختاروا اللاعب",["الدور على علي","مرّروا الجهاز"]],["❓","٢. اقرأ السؤال",["تحب السفر؟","جاوب بسرعة"]],["🚫","٣. تجنّب الكلمتين",["إي ✕","لا ✕"]],["✅","٤. احكموا على الإجابة",["نجا + نقطة","انكشف"]]],"snakes":[["🎲","١. ارْمِ النرد",["١","٢","٣","٤","٥","٦"]],["🔢","٢. تحرّك بالمربعات",["مكانك","خطوات النرد"]],["🪜","٣. اصعد الدرج",["بداية الدرج","نهاية أعلى"]],["🐍","٤. احذر الحيّة",["وقعت هنا","ارجع للخلف"]]],"domino":[["🁣","١. استلم قطعك",["٦ | ٦","٤ | ٢","٣ | ١"]],["🔗","٢. طابق الطرف",["طرف ٦","٦ | ٢"]],["🖐️","٣. اسحب عند الحاجة",["ما عندك تطابق؟","اسحب قطعة"]],["🏆","٤. خلّص قطعك",["آخر قطعة","فوز الجولة"]]],"tavla":[["🎲","١. ارْمِ النرد",["٣","٥"]],["⚫","٢. اختار قطعة إلك",["قطعتك","نقطة البداية"]],["➜","٣. حرّك حسب النرد",["٣ + ٥","نقطة الوصول"]],["👥","٤. بدّلوا الأدوار",["أنت","الخصم"]]],"colors":[["🃏","١. استلم سبع كروت",["أحمر ٢","أزرق ٤","أخضر ١"]],["🎨","٢. طابق اللون",["الكرت الظاهر","نفس اللون"]],["🔢","٣. أو طابق الرقم",["رقم ٤","رقم ٤"]],["🏆","٤. خلّص كروتك",["آخر كرت","فزت!"]]],"quiz":[["🧠","١. اقرأ السؤال",["شنو عاصمة العراق؟"]],["⌨️","٢. اكتب الإجابة",["بغداد","إرسال"]],["💬","٣. ناقشوا الإجابة",["قارنوا الإجابات","احسبوا النقاط"]],["⏭️","٤. انتقل للسؤال التالي",["السؤال ٢","جولة جديدة"]]]};
function prepareRoomTutorial(key){
 if(roomTutorialKey!==key){
  roomTutorialKey=key;roomTutorialStep=0;
  roomTutorialOpen=key!=="wheel"&&!localStorage.getItem("sw_online_tutorial_seen_"+key);
 }
}
roomTutorialArt.wheel=[["🎡","دولاب الوناسة أونلاين",["كل اللاعبين يشوفون نفس الدولاب","المضيف يلف"]]];
function roomTutorialPicture(key,step){
 const list=roomTutorialArt[key]||roomTutorialArt.who,item=list[Math.min(step,list.length-1)]||list[0];
 return '<div class="tutorial-picture" role="img" aria-label="'+esc(item[1])+'"><div class="tutorial-picture-main"><span>'+item[0]+'</span><b>'+esc(item[1])+'</b></div><div class="tutorial-picture-items">'+item[2].map(x=>'<span>'+esc(x)+'</span>').join("")+'</div><div class="tutorial-picture-caption">رسم توضيحي للخطوة الحالية</div></div>';
}
const gameGuides={
who:{title:"خمّن منو آني؟",visual:"🧐💭",goal:"اعرف الشخصية أو الشيء اللي مختاره اللاعبون قبل غيرك.",steps:["اختاروا فئة مثل الحيوانات أو الدول أو شخصيات الألعاب.","بالتناوب اسأل سؤالاً جوابه نعم أو لا، مثل: هل هي شخصية كرتونية؟","ضيّق الاحتمالات بأسئلتك، وبعدها اكتب تخمينك.","اتفقوا على احتساب نقطة للتخمين الصحيح؛ هذا الإصدار يحتاج تطوير نظام البطاقة السرية حتى يصير تلقائياً بالكامل."],mode:"طور تخمين جماعي مبسّط."},
number:{title:"تخمين الرقم",visual:"🔢🎯",goal:"اكتشف الرقم السري بين ١ و١٠٠.",steps:["المضيف يبدأ الجولة ويظهر رقم سري مشترك.","كل لاعب يكتب تخمينه بالدور.","قارنوا التخمينات بالرقم السري؛ الأقرب أو من يصيبه يفوز.","ملاحظة: التلميحات التلقائية (أكبر/أصغر) والنتائج التفصيلية بعدّ المحاولات مو مفعّلة بالكامل حالياً."],mode:"تحدّي تخمين سريع."},
liar:{title:"منو الكذّاب؟ / برا السالفة",visual:"🤥🕵️",goal:"اكتشف اللاعب اللي ما يعرف الموضوع الحقيقي.",steps:["اختاروا موضوعاً واحداً يتفق عليه اللاعبون خارج اللعبة أو يحدده المضيف.","كل لاعب يكتب تلميحاً قصيراً بدون ما يكشف الكلمة مباشرة.","ناقشوا التلميحات وصوّتوا على الشخص المشكوك بيه.","هذا الإصدار يعرض التلميحات داخل الغرفة؛ توزيع كلمة سرية سرياً لكل لاعب يحتاج إضافة لاحقة."],mode:"طور خداع وتصويت مبسّط."},
most:{title:"منو الأكثر؟",visual:"👀😂",goal:"اختاروا اللاعب الأنسب للسؤال، وشوفوا اتفاق المجموعة.",steps:["اقرأوا السؤال الظاهر، مثل: منو أكثر واحد يتأخر؟","كل لاعب يكتب اسم الشخص أو يصوّت عليه.","اعرضوا الإجابات واحتسبوا النقاط باتفاقكم.","الأسئلة تتغيّر بين الجولات؛ التصويت الآلي والنتيجة النهائية ما زالا مبسّطين."],mode:"طور تصويت وضحك."},
yesno:{title:"ممنوع إي ولا",visual:"🙊🎙️",goal:"جاوب من دون ما تنطق كلمتي «إي» أو «لا».",steps:["يطرح لاعب سؤالاً على اللاعب صاحب الدور.","جاوب بسرعة وبأي صياغة ثانية، لكن تجنّب «إي» و«لا».","الربع يراقبون الإجابة ويختارون: نجا أو انكشف.","اللعبة هنا تعتمد التحكيم الجماعي؛ ماكو كشف تلقائي للكلمات بالصوت."],mode:"طور كلام وتحدّي مباشر."},
snakes:{title:"حيّة ودرج",visual:"🐍🪜🎲",goal:"وصل إلى المربع ١٠٠ قبل باقي اللاعبين.",steps:["كل لاعب ينتظر دوره ويضغط «ارمي النرد».","تحرّك بعدد النرد؛ إذا وصلت لبداية درج تصعد.","إذا وقعت على حيّة ترجع للمربع الأقل المحدد.","لازم توصل إلى ١٠٠ بالضبط؛ إذا تجاوزته تبقى بمكانك."],mode:"لوحة مرئية، من لاعبين إلى ٦."},
domino:{title:"دومينوا",visual:"🁣🁤",goal:"تخلّص من قطعك بمطابقة الأرقام عند طرفي السلسلة.",steps:["كل لاعب يستلم قطع دومينو.","بدورك اضغط قطعة تطابق أحد طرفي السلسلة؛ إذا ما عندك قطعة مناسبة اسحب.","الفائز هو أول لاعب يتخلّص من كل قطعه، أو اتفقوا على نهاية الجولة.","تنبيه: هذا الطور مفتوح، يعني القطع ظاهرة للجميع، وقواعد الفوز النهائية مبسّطة."],mode:"دومينو مفتوح من لاعبين إلى ٤."},
tavla:{title:"طاولي مبسّطة",visual:"🎲⚫⚪",goal:"حرّك القطع على المسار وفق رمية النرد.",steps:["اللاعبان يتناوبان على رمي النرد.","اختار نقاط اللوحة لتحريك القطع بحسب نتيجة النرد.","راقب اتجاه حركتك وقطع خصمك.","تنبيه مهم: هذه واجهة تجريبية مبسّطة وليست لعبة طاولي كاملة بقواعد الضرب والإخراج والتحشية."],mode:"طور تجريبي للاعبين فقط."},
colors:{title:"كروت الألوان",visual:"🟥🟦🟩🟨",goal:"تخلّص من أوراقك بمطابقة اللون أو الرقم.",steps:["كل لاعب يبدأ بسبع كروت.","بدورك العب كرتاً يطابق لون أو رقم الكرت الظاهر، حسب القواعد المتفق عليها.","إذا ما عندك كرت مناسب، اسحب كرتاً.","أول لاعب يخلّص كروته يفوز؛ بعض الكروت الخاصة والاتجاهات ما زالت مبسّطة."],mode:"طور كروت جماعي مبسّط."},
quiz:{title:"تحدّي الأسئلة",visual:"🧠❓",goal:"جاوب عن السؤال بشكل صحيح وتنافس مع أصدقائك.",steps:["اقرأ السؤال الظاهر داخل اللوحة.","اكتب إجابتك واضغط إرسال الإجابة.","قارنوا الإجابات الصحيحة واتفقوا على النقاط.","الأسئلة الحالية عيّنة قصيرة، ومفتاح الإجابات والتصحيح الآلي يحتاجان إكمالاً."],mode:"طور معلومات عامة مبسّط."}
};
function guideMarkup(key,step=0){
 const g=gameGuides[key]||gameGuides.who,idx=Math.max(0,Math.min(step,g.steps.length-1));
 return '<article class="guide-detail"><div class="tutorial-progress"><span>الخطوة '+(idx+1)+' من '+g.steps.length+'</span><span>'+esc(g.title)+'</span></div>'+roomTutorialPicture(key,idx)+'<p class="tutorial-step-text">'+esc(g.steps[idx])+'</p><p class="guide-mode"><b>الهدف:</b> '+esc(g.goal)+' <b>الطور:</b> '+esc(g.mode)+'</p><div class="tutorial-audio-actions"><button class="btn btn-gold" id="speakGameGuide">🔊 اسمع الخطوة</button><button class="btn btn-ghost" id="speakFullGameGuide">▶ اسمع الشرح كاملاً</button><button class="btn btn-ghost" id="stopGameGuide">إيقاف</button></div><div class="tutorial-nav"><button class="btn btn-ghost" id="guidePrev" '+(idx===0?"disabled":"")+'>السابق</button><button class="btn btn-gold" id="guideNext">'+(idx===g.steps.length-1?"إعادة من البداية":"الخطوة التالية")+'</button></div><p class="muted-note">الصوت من قارئ النصوص العربي في جهازك؛ إذا لم تتوفر خدمة عربية يبقى الشرح المصوّر والمكتوب ظاهراً.</p></article>';
}
function speakGuide(key,full=false){
 if(!("speechSynthesis"in window)||!("SpeechSynthesisUtterance"in window))return toast("ميزة قراءة النص غير مدعومة بهذا المتصفح.");
 window.speechSynthesis.cancel();
 const g=gameGuides[key]||gameGuides.who,step=Math.min(roomTutorialStep,g.steps.length-1);
 const words=full?[g.title,g.goal,"طريقة اللعب.",...g.steps,"الطور: "+g.mode]:[g.title,"الخطوة "+(step+1)+".",g.steps[step]];
 const utter=new SpeechSynthesisUtterance(words.join(". "));utter.lang="ar-IQ";utter.rate=.9;utter.pitch=1;
 const voices=window.speechSynthesis.getVoices();utter.voice=voices.find(v=>/^ar-IQ$/i.test(v.lang))||voices.find(v=>/^ar/i.test(v.lang))||null;
 window.speechSynthesis.speak(utter);
}
function openCreate(game){roomForm("create",games[game]?game:"who")}
 window.openSuwadOnlineRoom=(game="wheel")=>{if(!localStorage.getItem("sw_nickname")){namePrompt().then(()=>roomForm("create",games[game]?game:"wheel"));return}roomForm("create",games[game]?game:"wheel")};
function intercept(e){
 const t=e.target.closest("button");
 if(!t)return;
 const game=t.dataset.onlineGame;
 if(game){e.preventDefault();e.stopImmediatePropagation();openCreate(game);return}
 if(t.id==="quickCreate" || t.id==="createRoomTop"){e.preventDefault();e.stopImmediatePropagation();roomForm("create");return}
 if(t.id==="quickJoin"){e.preventDefault();e.stopImmediatePropagation();roomForm("join");return}
}
document.addEventListener("pointerdown",()=>{if($(".online-wheel-shell")){try{onlineWheelAudio=onlineWheelAudio||new(window.AudioContext||window.webkitAudioContext)();if(onlineWheelAudio.state==="suspended")onlineWheelAudio.resume()}catch(e){}}},{passive:true});
document.addEventListener("click",intercept,true);
document.addEventListener("DOMContentLoaded",()=>{if(!window.supabase||!cfg.url||!cfg.anonKey){toast("الغرف الأونلاين تحتاج إعداد Supabase.");return}const params=new URLSearchParams(location.search),code=params.get("room");if(code)setTimeout(()=>joinRoom(code),350)});
window.addEventListener("beforeunload",()=>{if(channel&&db)db.removeChannel(channel);if(poll)clearInterval(poll)});
})();
