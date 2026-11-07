(() => {
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
 tavla:{name:"طاولي أصلية",icon:"🎲",min:2,max:2},
 colors:{name:"كروت الألوان",icon:"🃏",min:2,max:10},
 quiz:{name:"تحدّي الأسئلة",icon:"🧠",min:2,max:12},
  wheel:{name:"دولاب التحدي أونلاين",icon:"🎡",min:2,max:16}
};
let db=null, user=null, room=null, players=[], tournament=null,tournamentScores=[], channel=null,reactionChannel=null,reactionChannelReady=false,roomTimerInterval=null, poll=null, heartbeat=null,wheelFinishTimer=null,busy=false,roomTutorialKey="",roomTutorialStep=0,roomTutorialOpen=false,refreshInFlight=null,roomLifecycleVersion=0,refreshQueued=false,refreshQueuedSilent=true,refreshTimer=null,heartbeatInFlight=false,lastRenderedRoomFingerprint="",tavlaSelectedFrom=null,tavlaSelectedTurn=null;
let onlineWheelAudio=null,onlineWheelFrameId=null,lastOnlineWheelSpin=0,lastOnlineWheelAnimatedSpin=0,snakeAnimationFrame=null,snakeFinishTimer=null,snakeFinishMoveId=null;
function onlineSoundEnabled(){return typeof window.isSuwadSoundEnabled==="function"&&window.isSuwadSoundEnabled()}
function unlockOnlineWheelAudio(){try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;onlineWheelAudio=onlineWheelAudio||new Audio();if(onlineWheelAudio.state==="suspended")onlineWheelAudio.resume().catch(()=>{})}catch(e){}}
window.unlockSuwadOnlineAudio=unlockOnlineWheelAudio;
document.addEventListener("pointerdown",unlockOnlineWheelAudio,{passive:true});
function stopOnlineWheelMotion(){if(onlineWheelFrameId!==null){cancelAnimationFrame(onlineWheelFrameId);onlineWheelFrameId=null}}
function onlineWheelTick(){if(!onlineSoundEnabled())return;try{unlockOnlineWheelAudio();if(!onlineWheelAudio||onlineWheelAudio.state!=="running")return;const t=onlineWheelAudio.currentTime,o=onlineWheelAudio.createOscillator(),g=onlineWheelAudio.createGain();o.type="triangle";o.frequency.setValueAtTime(940,t);o.frequency.exponentialRampToValueAtTime(500,t+.034);g.gain.setValueAtTime(.09,t);g.gain.exponentialRampToValueAtTime(.001,t+.04);o.connect(g);g.connect(onlineWheelAudio.destination);o.start(t);o.stop(t+.042)}catch(e){}}
function onlineWheelFinish(){if(!onlineSoundEnabled())return;try{unlockOnlineWheelAudio();if(!onlineWheelAudio||onlineWheelAudio.state!=="running")return;const t=onlineWheelAudio.currentTime;[[660,0,.14],[880,.12,.16],[1175,.25,.22]].forEach(([f,d,dur])=>{const o=onlineWheelAudio.createOscillator(),g=onlineWheelAudio.createGain();o.type="sine";o.frequency.setValueAtTime(f,t+d);g.gain.setValueAtTime(.001,t+d);g.gain.linearRampToValueAtTime(.09,t+d+.025);g.gain.exponentialRampToValueAtTime(.001,t+d+dur);o.connect(g);g.connect(onlineWheelAudio.destination);o.start(t+d);o.stop(t+d+dur)})}catch(e){}}
function animateOnlineWheel(board){const spin=Number(board.spins||0);if(!board.spinning||!spin||spin<=lastOnlineWheelAnimatedSpin)return;stopOnlineWheelMotion();lastOnlineWheelAnimatedSpin=spin;const wheelEl=$(".online-wheel-visual");if(!wheelEl)return;const from=Number(board.startRotation||0),to=Number(board.rotation||0),duration=Number(board.spinDuration||5300),started=Number(board.spinStartedAt||Date.now()),arc=36;let lastSector=Math.floor((to-from)*Math.max(0,Math.min(1,(Date.now()-started)/duration))/arc);wheelEl.style.transition="none";function frame(now){if(!room||!$(".online-wheel-shell")||!room.game_state?.board?.spinning){stopOnlineWheelMotion();return}const elapsed=Math.max(0,Date.now()-started),p=Math.min(1,elapsed/duration),ease=1-Math.pow(1-p,4),angle=from+(to-from)*ease;wheelEl.style.transform="rotate("+angle+"deg)";const sector=Math.floor((to-from)*ease/arc);if(sector>lastSector){lastSector=sector;onlineWheelTick()}if(p<1)onlineWheelFrameId=requestAnimationFrame(frame);else{onlineWheelFrameId=null;wheelEl.style.transform="rotate("+to+"deg)"}}onlineWheelFrameId=requestAnimationFrame(frame)}
function toast(t){const x=$("#toast");if(x){x.textContent=t;x.classList.add("show");setTimeout(()=>x.classList.remove("show"),3000)}else alert(t)}
function show(html){const b=$("#modalBackdrop"),c=$("#modalContent");if(!b||!c)return;c.innerHTML=html;b.hidden=false;document.body.style.overflow="hidden";if(typeof window.mountSuwadGameAssistant==="function")window.mountSuwadGameAssistant(c,window.__SUWAD_ACTIVE_GAME?.gameKey,"online");$("#modalClose").onclick=close;const back=$("#modalBackButton");if(back)back.onclick=close}
function close(){if(room?.game_key==="wheel"&&$("#modalBackdrop")&&!$("#modalBackdrop").hidden){leaveRoom();return}stopOnlineWheelMotion();const b=$("#modalBackdrop");if(b)b.hidden=true;document.body.style.overflow=""}
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
  const g=games[gameSelect.value],options=[2,3,4,5,6,7,8,9,10,12,16].filter(n=>n>=g.min&&n<=g.max);
  select.innerHTML=options.map(n=>'<option value="'+n+'">'+n+' لاعبين بالمجموع</option>').join("");
  select.value=String(g.name==="دومينوا"?4:g.name==="طاولي أصلية"?2:options.includes(6)?6:options[0]);
 };
 gameSelect.onchange=syncMax;syncMax();
 button.onclick=()=>createRoom(gameSelect.value,$("#onlineRoomName").value.trim()||"لمة الربع",Number(select.value));
}
function inviteBox(){const link=roomLink(room.room_code);return '<div class="invite-panel room-invite-panel"><div class="room-invite-code"><small>كود اللمة</small><strong class="room-code">'+esc(room.room_code)+'</strong></div><div class="room-invite-actions"><button class="btn btn-ghost" id="copyRoomCode">نسخ الكود</button><button class="btn btn-ghost" id="copyRoomLink">نسخ الرابط</button><button class="btn btn-ghost" id="shareRoomLink">مشاركة الدعوة</button></div><img class="room-qr" alt="رمز QR لدعوة الغرفة" src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data='+encodeURIComponent(link)+'"><small>امسح الرمز حتى تنضم مباشرة إلى اللمة</small></div>'}
async function shareRoomInvite(){const link=roomLink(room.room_code);if(navigator.share){try{await navigator.share({title:"دعوة إلى سَـوَاد وناسة",text:"تعال نلعب سوا في سَـوَاد وناسة!",url:link});return}catch(e){if(e?.name==="AbortError")return}}await copy(link)}
async function copy(text){try{await navigator.clipboard.writeText(text);toast("تم النسخ")}catch{const x=document.createElement("textarea");x.value=text;document.body.append(x);x.select();document.execCommand("copy");x.remove();toast("تم النسخ")}}
function isHost(){return !!user&&room?.host_id===user.id}
function mePlayer(){return players.find(p=>p.user_id===user?.id)}
async function setState(next,extra={}){
 const result=await db.rpc("update_game_room_state",{
  p_room_id:room.id,p_game_state:next,
  p_status:extra.status??null,p_game_key:extra.game_key??null,
  p_expected_updated_at:room.updated_at??null
 });
 if(!result.error){const updated=Array.isArray(result.data)?result.data[0]:result.data;if(updated?.id)room=updated;}
 else if(result.error.code==="40001")await refreshRoom(true);
 return result;
}
async function readFunctionError(error,fallback){let message="";try{const body=await error.context?.json?.();message=body?.error||""}catch{}if(error.context?.status===409){await refreshRoom(true);throw Error(message||"تغيّرت حالة الغرفة؛ حدّث اللعبة وحاول مرة أخرى.")}throw Error(message||error.message||fallback)}
async function invokeNumberEngine(action,payload={}){const result=await db.functions.invoke("room-engine",{body:{action,roomId:room.id,expectedUpdatedAt:room.updated_at,...payload}});if(result.error)await readFunctionError(result.error,"تعذّر الاتصال بمحرك تخمين الرقم.");const updated=result.data?.room;if(!updated?.id)throw Error("استلمنا استجابة غير مكتملة من محرك تخمين الرقم.");room=updated;await refreshEngineSnapshot();await refreshPlayers();await refreshTournament();roomScreen();return room}
async function invokeGameEngine(action,payload={},retryOnce=false){const result=await db.functions.invoke("room-engine",{body:{action,roomId:room.id,expectedUpdatedAt:room.updated_at,payload}});if(result.error){if(action==="finish-snake-move"&&result.error.context?.status===409){await refreshRoom(true);if(!room?.game_state?.board?.pendingMove)return room;if(!retryOnce)return invokeGameEngine(action,payload,true)}if(action==="wheel-finish"&&result.error.context?.status===409){await refreshRoom(true);return room}if(action==="submit"&&!retryOnce&&result.error.context?.status===409){let code="";try{const response=result.error.context?.clone?.();const detail=await response?.json?.();code=detail?.code||""}catch{}if(code==="40001"){await refreshRoom(true);return invokeGameEngine(action,payload,true)}}await readFunctionError(result.error,"تعذّر تنفيذ الحركة على محرك الغرفة.");}const updated=result.data?.room;if(!updated?.id)throw Error("استلمنا استجابة غير مكتملة من محرك الغرفة.");room=updated;await refreshEngineSnapshot();await refreshPlayers();await refreshTournament();roomScreen();return room}
async function startGameOnline(){
 if(room?.game_key==="colors"&&room.game_state?.unoMatch?.matchWinnerId)return toast("انتهت مباراة UNO ووصل لاعب إلى ٥٠٠ نقطة؛ ابدأوا مباراة جديدة بغرفة جديدة.");
 if(tournament?.status==="completed")return toast("البطولة انتهت وتحدد بطل اللمة.");
 if(!isHost())return toast("بس الهوست يگدر يبدأ اللعبة.");
 if(players.length<games[room.game_key].min)return toast("بعدكم مو مكتملين: دخل "+players.length+" من "+games[room.game_key].min+" لاعبين مطلوبين. شارك كود الغرفة وانتظر اللاعب الثاني.");
 if(room.engine_version===1&&room.status!=="playing"){
  await invokeGameEngine("upgrade");
 }
 if(room.game_key==="number"){
  if(room.engine_version!==2)throw Error("غرفة تخمين الرقم لم تُرقَّ بعد إلى المحرك الخادمي.");
  if(room.status==="finished"||room.game_state?.phase==="finished")await invokeNumberEngine("restart-number");
  else if(room.status==="waiting")await invokeNumberEngine("start-number");
  else throw Error("لا يمكن بدء جولة جديدة قبل انتهاء الجولة الحالية.");
  return;
 }
 if(room.engine_version===3){
  if(room.status!=="waiting"&&room.status!=="finished")throw Error("لا يمكن إعادة الجولة قبل انتهاء الجولة الحالية.");
  await invokeGameEngine("start");
  return;
 }
 if(room.engine_version!==1)throw Error("إصدار محرك الغرفة غير معروف.");
 if(room.status==="playing")throw Error("هذه غرفة قديمة ما زالت تلعب؛ لا يمكن تغيير محركها في منتصف الجولة.");
 let state={phase:"playing",round:1,turn:0,scores:Object.fromEntries(players.map(p=>[p.user_id,0])),feed:["بدأت اللعبة!"],board:null};
 const k=room.game_key;
 if(k==="snakes")state.board={positions:players.map(()=>0),dice:null,finished:null};
 if(k==="domino")state.board=makeDominoBoard();
 if(k==="tavla")state.board={positions:players.map((p,i)=>Array.from({length:15},(_,j)=>({point:(i===0?[0,11,16,18][j%4] : [23,12,7,5][j%4]),id:j}))),dice:[],selected:null,moves:0};
 if(k==="quiz")state.board={question:0,answers:{}};
 if(k==="liar")state.board={question:"كل لاعب يكتب تلميحاً عن الموضوع الظاهر، وصوّتوا بعدها على المشتبه به.",hints:{},votes:{}};
 if(k==="most")state.board={question:0,votes:{}};
 if(k==="yesno")state.board={question:0,answers:{}};
 if(k==="who")state.board={question:0,guesses:{}};
 if(k==="wheel")state.board={rotation:0,result:null,spins:0,stage:"landing"};
 const r=await setState(state,{status:"playing"});
 if(r.error)throw r.error;
 room={...room,game_state:state,status:"playing"};
}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function makeDominoBoard(){const all=[];for(let a=0;a<=6;a++)for(let b=a;b<=6;b++)all.push([a,b]);shuffle(all);const hands={};players.forEach((p,i)=>hands[p.user_id]=all.splice(0,Math.max(5,Math.floor(28/players.length))));return {hands,chain:[],turn:0,draw:all,ended:false}}
const questions=["منو أكثر واحد يتأخر على اللمة؟","شنو أحلى سفرة تتمنّاها؟","منو يضحك أسرع واحد؟","شنو أكلة ما تملّ منها؟","منو أكثر واحد محظوظ؟","إذا ربحت مليون، شنو أول شي تشتريه؟"];
function roomFingerprint(){
 if(!room)return "";
 const roster=players.map(p=>({id:p.user_id,name:p.display_name,seat:p.seat,host:p.user_id===room.host_id,online:Date.now()-Date.parse(p.last_seen_at||p.joined_at||0)<90000}));
 return JSON.stringify({id:room.id,updated_at:room.updated_at,status:room.status,game_key:room.game_key,engine_version:room.engine_version,game_state:room.game_state,private_state:room.player_private_state||{},tournament:tournament||null,tournamentScores:tournamentScores||[],settings:room.settings||{},players:roster});
}
const ROOM_REACTIONS=["😂","👏","🔥","😮","❤️","💀"];
function renderRoomReactionsPanel(){
 return '<section class="room-reactions-panel"><div class="room-reactions-heading"><strong>تفاعلات الربع</strong><small>ضحكة أو تصفيق بدون ما توقفون اللعب</small></div><div class="room-reaction-buttons">'+ROOM_REACTIONS.map(emoji=>'<button type="button" data-room-reaction="'+emoji+'" aria-label="إرسال تفاعل '+emoji+'">'+emoji+'</button>').join("")+'</div><div id="roomReactionFeed" class="room-reaction-feed" aria-live="polite"></div></section>';
}
function showRoomReaction(payload){
 const emoji=String(payload?.emoji||"");
 if(!ROOM_REACTIONS.includes(emoji)||!room||!players.length)return;
 const feed=$("#roomReactionFeed");
 if(!feed)return;
 const item=document.createElement("div");
 item.className="room-reaction-toast";
 item.textContent=emoji+" تفاعل من الربع";
 feed.appendChild(item);
 while(feed.children.length>5)feed.firstElementChild.remove();
 setTimeout(()=>item.remove(),2800);
}
async function connectRoomReactions(roomId){
 if(reactionChannel){await db.removeChannel(reactionChannel);reactionChannel=null}reactionChannelReady=false;
 if(!room||room.id!==roomId||!db?.realtime)return;
 try{await db.realtime.setAuth()}catch(error){console.warn("Realtime auth refresh skipped",error)}
 const topic="suwad-room-reactions:"+roomId;
 const next=db.channel(topic,{config:{private:true}});
 next.on("broadcast",{event:"reaction"},message=>showRoomReaction(message?.payload||{}));
 next.subscribe((status,error)=>{
  if(status==="SUBSCRIBED")reactionChannelReady=true;
  if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"){reactionChannelReady=false;console.warn("Room reactions channel unavailable",status,error||"")}
 });
 reactionChannel=next;
}
async function sendRoomReaction(emoji){
 if(!ROOM_REACTIONS.includes(emoji))return;
 if(!reactionChannel||!reactionChannelReady)return toast("تفاعلات الغرفة بعدها تتصل؛ جرّب بعد لحظة.");
 try{
  const status=await reactionChannel.send({type:"broadcast",event:"reaction",payload:{emoji}});
  if(status!=="ok")toast("ما وصل التفاعل؛ جرّب مرة ثانية.");
 }catch(error){console.warn("Room reaction send failed",error);toast("تعذّر إرسال التفاعل حالياً.")}
}
function readRoomRules(){
 const saved=room?.settings?.rules||{};
 return {
  rounds:Number($("#customRounds")?.value??saved.rounds??5),
  timeLimitSeconds:Number($("#customTimeLimit")?.value??saved.timeLimitSeconds??0),
  pointsPerWin:Number($("#customPointsPerWin")?.value??saved.pointsPerWin??3),
  difficulty:$("#customDifficulty")?.value??saved.difficulty??"normal"
 };
}
function renderCustomRulesPanel(){
 if(!room||room.game_key==="wheel")return "";
 const rules=room.settings?.rules||{},rounds=Number(rules.rounds||5),time=Number(rules.timeLimitSeconds??0),points=Number(rules.pointsPerWin||3),difficulty=rules.difficulty||"normal";
 const timeLabel=time===0?"بدون مؤقت":time+" ثانية";
 const difficultyLabel=difficulty==="easy"?"سهل":difficulty==="hard"?"صعب":"متوسط";
 if(room.status==="waiting"&&isHost()){
  return '<section class="room-custom-rules-panel"><div class="room-tournament-heading"><span>⚙️ قوانين مخصصة</span><small>إعدادات الهوست قبل البداية</small></div><div class="room-custom-rules-grid"><label>عدد جولات البطولة<select id="customRounds"><option value="3" '+(rounds===3?'selected':'')+'>٣</option><option value="5" '+(rounds===5?'selected':'')+'>٥</option><option value="7" '+(rounds===7?'selected':'')+'>٧</option><option value="10" '+(rounds===10?'selected':'')+'>١٠</option></select></label><label>وقت الجولة<select id="customTimeLimit"><option value="0" '+(time===0?'selected':'')+'>بدون مؤقت</option><option value="30" '+(time===30?'selected':'')+'>٣٠ ثانية</option><option value="45" '+(time===45?'selected':'')+'>٤٥ ثانية</option><option value="60" '+(time===60?'selected':'')+'>دقيقة</option><option value="90" '+(time===90?'selected':'')+'>دقيقة ونصف</option><option value="120" '+(time===120?'selected':'')+'>دقيقتان</option></select></label><label>نقاط الفوز<select id="customPointsPerWin"><option value="1" '+(points===1?'selected':'')+'>١</option><option value="2" '+(points===2?'selected':'')+'>٢</option><option value="3" '+(points===3?'selected':'')+'>٣</option><option value="5" '+(points===5?'selected':'')+'>٥</option></select></label><label>مستوى الصعوبة<select id="customDifficulty"><option value="easy" '+(difficulty==="easy"?'selected':'')+'>سهل</option><option value="normal" '+(difficulty==="normal"?'selected':'')+'>متوسط</option><option value="hard" '+(difficulty==="hard"?'selected':'')+'>صعب</option></select></label></div><p>المؤقت ينهي الجولة بعد انتهاء الوقت بقرار الهوست. الصعوبة تغيّر نطاق تخمين الرقم ومتطلبات المهمات السرية.</p><button type="button" class="btn btn-gold full-btn" id="saveRoomRules">حفظ القوانين</button></section>';
 }
 return '<section class="room-custom-rules-panel room-custom-rules-readonly"><div class="room-tournament-heading"><span>⚙️ قوانين الغرفة</span><small>تم اعتمادها من الهوست</small></div><div class="room-custom-rules-summary"><span>'+rounds+' جولات</span><span>'+timeLabel+'</span><span>'+points+' نقاط للفوز</span><span>الصعوبة: '+difficultyLabel+'</span></div></section>';
}
function renderTournamentPanel(){
 if(!room||room.game_key==="wheel")return "";
 if(!tournament){
  if(room.status!=="waiting"||!isHost())return "";
  return '<section class="room-tournament-panel"><div class="room-tournament-heading"><span>🏆 بطولة الربع</span><small>منافسة جماعية بترتيب ونقاط تراكمية</small></div><p>كل الموجودين بالغرفة يدخلون البطولة تلقائياً، وتُسجّل نتيجة كل جولة حتى يتحدد البطل.</p><button type="button" class="btn btn-gold full-btn" id="createRoomTournament">إنشاء بطولة حسب القوانين المحفوظة</button></section>';
 }
 const completed=tournament.status==="completed";
 const champion=players.find(p=>p.user_id===tournament.champion_id);
 const rows=tournamentScores.map((score,index)=>{
  const player=players.find(p=>p.user_id===score.user_id);
  return '<div class="room-tournament-row"><span class="room-tournament-rank">'+(index+1)+'</span><strong>'+esc(player?.display_name||"لاعب غادر الغرفة")+'</strong><b>'+Number(score.points||0)+' نقطة</b><small>'+Number(score.wins||0)+' فوز</small></div>';
 }).join("");
 const progress=completed?'اكتملت كل الجولات':room.status==="finished"?'الجولة القادمة '+Number(tournament.current_round)+' من '+Number(tournament.total_rounds):'الجولة '+Number(tournament.current_round)+' من '+Number(tournament.total_rounds);
 return '<section class="room-tournament-panel '+(completed?'is-complete':'')+'"><div class="room-tournament-heading"><span>🏆 بطولة الربع</span><small>'+progress+'</small></div>'+(completed?'<div class="room-tournament-champion"><small>بطل اللمة</small><strong>👑 '+esc(champion?.display_name||"الفائز")+'</strong></div>':'<p>كل جولة تضيف نقاطاً للترتيب العام. الفائز النهائي يتحدد بعد آخر جولة.</p>')+'<div class="room-tournament-standings">'+(rows||'<small>بانتظار تسجيل نتائج الجولة الأولى.</small>')+'</div><div class="room-tournament-meta"><span>'+Number(tournament.total_rounds)+' جولات</span><span>الفوز = '+Number(tournament.points_per_win)+' نقاط</span></div></section>';
}
function renderRoomTimerPanel(state){
 if(!state?.turnDeadlineAt||state.phase!=="playing"||room?.game_key==="wheel")return "";
 return '<section class="room-round-timer"><div><span>⏱️ وقت الجولة</span><strong id="roomTimerValue">--:--</strong></div><small id="roomTimerHint">الوقت يمشي على كل اللاعبين بنفس الموعد.</small><button type="button" class="btn btn-gold full-btn" id="timeoutRoomRound" hidden>إنهاء الجولة بعد انتهاء الوقت</button></section>';
}
function syncRoomTimer(state){
 if(roomTimerInterval){clearInterval(roomTimerInterval);roomTimerInterval=null}
 const deadline=Date.parse(state?.turnDeadlineAt||"");
 if(!Number.isFinite(deadline)||state?.phase!=="playing")return;
 const update=()=>{
  const remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));
  const value=$("#roomTimerValue"),hint=$("#roomTimerHint"),button=$("#timeoutRoomRound");
  if(value)value.textContent=String(Math.floor(remaining/60)).padStart(2,"0")+":"+String(remaining%60).padStart(2,"0");
  if(hint)hint.textContent=remaining>0?"الوقت يمشي على كل اللاعبين بنفس الموعد.":(isHost()?"انتهى الوقت؛ تگدر تحسم الجولة هسه.":"انتهى الوقت، ننتظر الهوست يحسم الجولة.");
  if(button)button.hidden=remaining>0||!isHost();
  if(remaining<=0&&roomTimerInterval){clearInterval(roomTimerInterval);roomTimerInterval=null}
 };
 update();
 if(deadline>Date.now())roomTimerInterval=setInterval(update,1000);
}
function renderTableFlipPanel(state){
 const feature=state?.tableFlip||{},event=feature.lastEvent||null,challenge=feature.activeChallenge||null;
 let detail=event?'<div class="table-flip-event"><small>آخر مفاجأة</small><strong>'+esc(event.title||"قلب الطاولة")+'</strong><p>'+esc(event.message||"استعدوا للمفاجأة التالية!")+'</p></div>':'<div class="table-flip-event"><small>المفاجآت مفعّلة</small><strong>قلب الطاولة 🎲</strong><p>كلما تتقدمون باللعب، ممكن تطلع مفاجأة تغيّر مجرى الجولة.</p></div>';
 let challengeMarkup="";
 if(challenge&&challenge.status==="pending"){
  const mine=challenge.targetId===user?.id,claimed=!!challenge.claimed;
  challengeMarkup='<div class="table-flip-challenge"><div class="table-flip-challenge-head"><span>🎯 التحدّي المفاجئ</span><b>+'+Number(challenge.bonus||2)+' نقطة</b></div><strong>'+esc(challenge.targetName||"لاعب")+'</strong><p>'+esc(challenge.text||"نفّذ التحدّي أمام الربع.")+'</p>'+
   (mine&&!claimed?'<button type="button" class="btn btn-gold full-btn" data-table-flip-claim>أنجزت التحدّي</button>':
   (isHost()&&claimed?'<button type="button" class="btn btn-gold full-btn" data-table-flip-confirm>تأكيد الإنجاز ومنح النقاط</button>':
   (claimed?'<small class="table-flip-wait">تم إعلان الإنجاز، ننتظر تأكيد الهوست.</small>':
   '<small class="table-flip-wait">بانتظار اللاعب المكلّف بالتحدّي.</small>')))+
   '</div>';
 }else if(challenge&&challenge.status==="completed"){
  challengeMarkup='<div class="table-flip-challenge is-complete"><strong>🏆 اكتمل التحدّي</strong><p>'+esc(challenge.targetName||"اللاعب")+' حصل على +'+Number(challenge.awarded||challenge.bonus||2)+' نقطة.</p></div>';
 }
 const multiplier=feature.doubleNext?'<span class="table-flip-multiplier">×٢ النقاط القادمة</span>':"";
 return '<section class="table-flip-panel" aria-live="polite"><div class="table-flip-panel-top"><div><small>مفاجآت اللمة</small><h3>🎲 قلب الطاولة</h3></div>'+multiplier+'</div>'+detail+challengeMarkup+'</section>';
}
function renderSecretMissionPanel(state){
 const mission=room?.player_private_state?.secretMission;
 if(!mission||state?.phase==="lobby")return "";
 const required=Math.max(1,Number(mission.required||1)),progress=Math.min(required,Math.max(0,Number(mission.progress||0)));
 const completed=mission.status==="completed",percent=Math.round(progress/required*100);
 return '<section class="secret-mission-panel '+(completed?'is-complete':'')+'"><div class="secret-mission-head"><span>🔒 مهمتك السرية</span><b>'+(completed?'🏆 مكتملة':'خاصة بيك')+'</b></div><p>'+esc(mission.text||"نفّذ مهمتك من دون ما تكشفها للربع.")+'</p><div class="secret-mission-progress" role="progressbar" aria-label="تقدم المهمة السرية" aria-valuemin="0" aria-valuemax="'+required+'" aria-valuenow="'+progress+'"><span style="width:'+percent+'%"></span></div><small>'+(completed?'أحسنت! حصلت على مكافأة +'+Number(mission.bonus||3)+' نقاط.':'التقدم: '+progress+' / '+required+' • بقية اللاعبين ما يشوفون مهمتك.')+'</small></section>';
}
function renderOrasCommentatorPanel(){
 const api=window.SuwadOrasCommentator,supported=!!api?.isSupported?.(),enabled=!!api?.isEnabled?.();
 return '<section class="oras-commentator-panel"><div class="oras-commentator-copy"><span>🤖 أوراس المعلّق</span><small>'+(supported?'تعليقات عراقية صوتية اختيارية أثناء اللعب':'النطق الصوتي غير مدعوم بهذا المتصفح')+'</small></div><button type="button" class="oras-commentator-toggle" data-oras-toggle '+(supported?'':'disabled')+' aria-pressed="'+String(enabled)+'">'+(supported?(enabled?'🔇 كتم أوراس':'🔊 تشغيل أوراس'):'غير متاح')+'</button></section>';
}
function roomScreen(){
 if(!room)return;
 const g=games[room.game_key],host=isHost(),mine=mePlayer(),state=room.game_state||{phase:"lobby",feed:[]};
 window.__SUWAD_ACTIVE_GAME={gameKey:room.game_key,gameName:g?.name||room.game_key,mode:"online"};
 prepareRoomTutorial(room.game_key);
 if(room.game_key==="wheel"){
  if(!state.board?.spinning)stopOnlineWheelMotion();
  const stage=state.board?.stage||"landing";
  const spinNumber=Number(state.board?.spins||0);if(stage==="result"&&spinNumber>lastOnlineWheelSpin){lastOnlineWheelSpin=spinNumber;onlineWheelFinish()}
  let body='<div class="online-wheel-shell"><div class="online-wheel-room-head"><div><span class="pill">دولاب أونلاين مشترك</span><h2 id="modalTitle">🎡 '+esc(room.room_name)+'</h2><p class="modal-lead">الغرفة '+esc(room.room_code)+' • '+players.length+' لاعبين</p></div><button class="audio-close" id="leaveRoom" aria-label="مغادرة">×</button></div><div class="online-wheel-members">'+players.map((p,i)=>'<span>'+esc(p.display_name)+(p.user_id===room.host_id?' · الهوست':'')+'</span>').join("")+'</div>'+renderGame(g,state,mine,host)+(state.phase==='playing'?renderTableFlipPanel(state):'')+renderOrasCommentatorPanel()+(state.phase==='playing'?renderRoomReactionsPanel():'')+'</div>';
  show(body);window.SuwadOrasCommentator?.observe(room.id,room.game_key,state,room.updated_at);$("#leaveRoom").onclick=leaveRoom;const back=$("#modalBackButton");if(back)back.onclick=leaveRoom;const modalClose=$("#modalClose");if(modalClose)modalClose.onclick=leaveRoom;if(state.board?.spinning)animateOnlineWheel(state.board);wireGame(g,state,mine);lastRenderedRoomFingerprint=roomFingerprint();return;
 }
 const guide=roomTutorialOpen?guideMarkup(room.game_key,roomTutorialStep):"";
 const min=games[room.game_key].min,missing=Math.max(0,min-players.length),full=players.length>=room.max_players;
 const onlineCount=players.filter(p=>Date.now()-Date.parse(p.last_seen_at||p.joined_at||0)<90000).length;
 const capacity=Math.max(0,Math.min(100,Math.round(players.length/Math.max(1,room.max_players)*100)));
 const phaseLabel=state.phase==="playing"?"اللعبة شغّالة":state.phase==="finished"?"انتهت الجولة":"بانتظار الربع";
 let body='<main class="room-lobby-shell">'+
  '<section class="room-hero-panel"><div class="room-hero-topline"><span class="room-phase-badge '+(state.phase==="playing"?"is-playing":state.phase==="finished"?"is-finished":"is-waiting")+'"><i></i>'+phaseLabel+'</span><span class="room-host-chip">'+(host?"إنت مضيف اللمة":"غرفة الربع")+'</span></div><h2 id="modalTitle">'+g.icon+" "+esc(room.room_name)+'</h2><p class="room-game-caption">'+esc(g.name)+' <span>•</span> غرفة خاصة برمز دعوة</p><div class="room-hero-stats"><span><b>'+players.length+'</b><small>لاعب داخل الغرفة</small></span><span><b>'+onlineCount+'</b><small>متصل الآن</small></span><span><b>'+room.max_players+'</b><small>السعة الكاملة</small></span></div><button class="btn btn-ghost room-guide-trigger" id="toggleGameGuide" aria-expanded="'+String(roomTutorialOpen)+'">📖 شرح اللعبة المصوّر والصوتي</button></section>'+
  '<section class="room-capacity-panel"><div class="room-capacity-heading"><div><small>تجهيز اللمة</small><strong>مقاعد اللاعبين</strong></div><b>'+players.length+' / '+room.max_players+'</b></div><div class="room-capacity-track" role="progressbar" aria-label="المقاعد المشغولة" aria-valuemin="0" aria-valuemax="'+room.max_players+'" aria-valuenow="'+players.length+'"><span style="width:'+capacity+'%"></span></div><p>'+(missing>0?'باقي '+missing+' لاعب حتى تقدرون تبدون '+esc(g.name)+'.':state.phase==="playing"?"الكل داخل اللمة، استمتعوا باللعب!":"اكتمل الحد الأدنى، والمضيف يگدر يبدأ الجولة.")+'</p></section>'+
  '<div id="gameGuidePanel" class="game-guide-panel" '+(roomTutorialOpen?"":"hidden")+'>'+guide+'</div>'+
  '<section class="room-invite-section"><div class="room-section-heading"><div><small>خلّ الربع يلتحقون</small><h3>دعوة إلى اللمة</h3></div><span>🔗</span></div>'+inviteBox()+'</section>'+
  '<section class="room-player-list room-roster-panel"><div class="room-section-heading"><div><small>الموجودين حالياً</small><h3>ربعك بالغرفة</h3></div><span class="room-roster-count">'+players.length+' لاعب</span></div><div class="room-roster-grid">'+players.map((p,i)=>{const online=Date.now()-Date.parse(p.last_seen_at||p.joined_at||0)<90000,isMe=p.user_id===user?.id,isPlayerHost=p.user_id===room.host_id;return '<article class="room-player-card"><span class="room-seat-label">مقعد '+(i+1)+'</span><span class="room-player-avatar">'+esc((p.display_name||"?").trim().slice(0,1))+'</span><span class="room-player-identity"><strong>'+esc(p.display_name)+(isMe?' <small>إنت</small>':'')+'</strong><small>'+(isPlayerHost?'👑 مضيف اللمة':'لاعب')+'</small></span><span class="room-player-presence '+(online?'is-online':'is-offline')+'"><i></i>'+(online?'متصل':'غير متصل')+'</span></article>'}).join("")+'</div></section>';
 if(state.phase==="finished")body+='<div class="question-panel"><h3>🏁 انتهت الجولة!</h3>'+(room.game_key==="number"?'<p>الرقم الصحيح: <strong>'+esc(state.board?.revealed_number??state.board?.secret??"—")+'</strong></p>':'')+(state.board?.winner_id?'<p>الفائز: <strong>'+esc(players.find(p=>p.user_id===state.board.winner_id)?.display_name||"—")+'</strong></p>':'')+(room.game_key==="quiz"?'<p>النقاط: '+players.map(p=>esc(p.display_name)+' '+Number(state.scores?.[p.user_id]||0)).join(' • ')+'</p>':'')+(room.game_key==="colors"?renderUnoMatchSummary(state,false):'')+(room.game_key==="colors"&&state.unoMatch?.matchWinnerId?'<p>انتهت المباراة رسمياً بوصول اللاعب إلى ٥٠٠ نقطة.</p>':'<p>يگدر المضيف يبدأ الجولة التالية.</p>')+'</div>';
 if(state.phase==="finished")body+=renderSecretMissionPanel(state);
 else if(state.phase!=="playing"){
  body+='<div class="room-readiness"><b>'+(missing>0?'اللمة بعدها تنتظر':'اللمة جاهزة للانطلاق')+'</b><p>'+(missing>0?'حتى تبدأ '+esc(g.name)+' تحتاج '+missing+' لاعب '+(missing===1?'إضافي':'إضافيين')+'. شارك الدعوة ويا ربعك.':'اكتمل العدد المطلوب؛ الهوست يگدر يبدأ اللعب هسه.')+'</p>'+(full&&missing>0?'<small>الغرفة وصلت سعتها المحددة.</small>':'')+'</div><p class="muted-note">تگدر تنسخ الكود أو الرابط أو تشارك الدعوة مباشرة من الأعلى.</p>'+(host?'<button class="btn btn-gold full-btn" id="startOnlineGame" '+(missing>0?'disabled':'')+'>'+(missing>0?'بانتظار '+missing+' لاعب إضافي':'ابدأ اللمة والعبوا')+'</button>':'<p class="hint-box">ننتظر المضيف يبدأ اللعب بعد اكتمال العدد…</p>');
 }
 else body+=renderGame(g,state,mine,host)+renderTableFlipPanel(state)+renderSecretMissionPanel(state)+renderOrasCommentatorPanel()+renderRoomReactionsPanel();
 if(room.game_key!=="wheel")body+=renderCustomRulesPanel();
 if(state.phase==="playing"&&room.game_key!=="wheel")body+=renderRoomTimerPanel(state);
 if(state.phase!=="playing"||tournament)body+=renderTournamentPanel();
 body+='</main><div class="room-bottom-actions"><button class="btn btn-ghost" id="refreshRoom">تحديث حالة الغرفة</button>'+(host&&state.phase==="finished"&&tournament?.status!=="completed"&&!(room.game_key==="colors"&&state.unoMatch?.matchWinnerId)?'<button class="btn btn-ghost" id="restartOnlineGame">'+(room.game_key==="colors"||tournament?.status==="active"?"ابدأ الجولة التالية":"إعادة الجولة")+"</button>":'')+'</div>';
 show(body);
 syncRoomTimer(state);
 window.SuwadOrasCommentator?.observe(room.id,room.game_key,state,room.updated_at);
 const back=$("#modalBackButton");if(back)back.onclick=leaveRoom;
 $("#copyRoomCode").onclick=()=>copy(room.room_code);$("#copyRoomLink").onclick=()=>copy(roomLink(room.room_code));$("#leaveRoom").onclick=leaveRoom;$("#refreshRoom").onclick=refreshRoom;
 const createTournamentButton=$("#createRoomTournament");if(createTournamentButton)createTournamentButton.onclick=createRoomTournament;
 const share=$("#shareRoomLink");if(share)share.onclick=shareRoomInvite;
 const guideBtn=$("#toggleGameGuide");
 if(guideBtn)guideBtn.onclick=()=>{roomTutorialOpen=!roomTutorialOpen;localStorage.setItem("sw_online_tutorial_seen_"+room.game_key,"1");roomScreen()};
 const panel=$("#gameGuidePanel");
 if(panel&&roomTutorialOpen){const gdoc=gameGuides[room.game_key]||gameGuides.who,step=Math.min(roomTutorialStep,gdoc.steps.length-1),prev=$("#guidePrev"),next=$("#guideNext"),say=$("#speakGameGuide"),all=$("#speakFullGameGuide"),stop=$("#stopGameGuide");if(prev)prev.onclick=()=>{roomTutorialStep=Math.max(0,step-1);roomScreen()};if(next)next.onclick=()=>{roomTutorialStep=step===gdoc.steps.length-1?0:step+1;localStorage.setItem("sw_online_tutorial_seen_"+room.game_key,"1");roomScreen()};if(say)say.onclick=()=>speakGuide(room.game_key,false);if(all)all.onclick=()=>speakGuide(room.game_key,true);if(stop)stop.onclick=()=>{if("speechSynthesis"in window)speechSynthesis.cancel()}}
 if($("#startOnlineGame"))$("#startOnlineGame").onclick=async()=>{const b=$("#startOnlineGame");if(b)b.disabled=true;try{await startGameOnline();await refreshRoom()}catch(e){showError(e)}finally{const current=$("#startOnlineGame");if(current&&room&&room.game_state?.phase!=="playing")current.disabled=players.length<games[room.game_key].min}};
 if($("#restartOnlineGame"))$("#restartOnlineGame").onclick=()=>startGameOnline().then(()=>refreshRoom()).catch(showError);
 wireGame(g,state,mine);
 lastRenderedRoomFingerprint=roomFingerprint();
}

function snakeBoardOrder(){
 const order=[];
 for(let row=9;row>=0;row--){
  const cells=Array.from({length:10},(_,i)=>row*10+i+1);
  if(row%2===1)cells.reverse();
  order.push(...cells);
 }
 return order;
}
function dominoHalf(value){
 const layouts={0:[],1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
 return '<span class="domino-half" aria-label="'+Number(value)+'">'+Array.from({length:9},(_,i)=>'<i class="'+((layouts[Number(value)]||[]).includes(i)?'domino-pip':'')+'"></i>').join('')+'</span>';
}
function dominoTileMarkup(tile,extra=""){
 return '<span class="domino-real-tile '+extra+'">'+dominoHalf(tile?.[0]??0)+'<i class="domino-divider"></i>'+dominoHalf(tile?.[1]??0)+'</span>';
}
function unoCardLabel(card){
 const labels={skip:"⛔",reverse:"↻",draw2:"+2",wild:"🌈",wild4:"+4"};
 return labels[card?.v]||String(card?.v??"");
}
function unoCardMarkup(card,index,disabled=false){
 const colors=["أحمر","أزرق","أخضر","أصفر"],colorIndex=colors.indexOf(card?.c),wild=card?.c==="wild"||card?.kind==="wild";
 return '<button type="button" class="uno-card '+(wild?'uno-wild':'uno-color-'+Math.max(0,colorIndex))+'" data-color="'+index+'" '+(disabled?'disabled':'')+' aria-label="'+esc(wild?"كرت حر "+unoCardLabel(card):card?.c+" "+unoCardLabel(card))+'"><span class="uno-card-corner">'+(wild?'✦':esc(card?.c||""))+'</span><strong>'+esc(unoCardLabel(card))+'</strong><small>'+(wild?'WILD':esc(card?.c||""))+'</small></button>';
}
let lastAnimatedSnakeMoveId="",snakeMoveFinishTimer=null,snakeDiceSpinTimer=null,snakeDiceStopTimer=null;
function snakeCellCenter(board,number){
 const cell=board.querySelector('[data-cell="'+number+'"]');
 if(!cell)return null;
 const br=board.getBoundingClientRect(),r=cell.getBoundingClientRect();
 return {x:r.left-br.left+r.width/2,y:r.top-br.top+r.height/2};
}
function snakeWaitUntil(timestamp){
 return new Promise(resolve=>{const delay=Math.max(0,timestamp-Date.now());if(delay)window.setTimeout(resolve,delay);else resolve()});
}
function animateSnakeSegment(board,token,from,to,startAt,duration){
 return new Promise(resolve=>{
  const a=snakeCellCenter(board,from),z=snakeCellCenter(board,to);
  if(!a||!z){resolve();return}
  const frame=()=>{
   const p=Math.max(0,Math.min(1,(Date.now()-startAt)/Math.max(1,duration)));
   const eased=p*p*(3-2*p);
   token.style.left=(a.x+(z.x-a.x)*eased)+"px";
   token.style.top=(a.y+(z.y-a.y)*eased)+"px";
   if(p<1)requestAnimationFrame(frame);else resolve();
  };
  requestAnimationFrame(frame);
 });
}
async function animateSnakePendingMove(move){
 const id=String(move?.id||"");
 if(!id||id===lastAnimatedSnakeMoveId)return;
 const board=document.querySelector(".snakes-board");
 if(!board)return;
 lastAnimatedSnakeMoveId=id;
 const started=Date.parse(move.startedAt||""),startAt=Number.isFinite(started)?started:Date.now();
 const from=Number(move.from),landing=Number(move.landing),final=Number(move.final),die=Number(move.dice);
 const dice=document.querySelector("#snakeDice"),diceFaces=["","⚀","⚁","⚂","⚃","⚄","⚅"];
 if(dice){
  const remaining=Math.max(0,startAt+1100-Date.now());
  if(snakeDiceSpinTimer)clearInterval(snakeDiceSpinTimer);
  if(snakeDiceStopTimer)clearTimeout(snakeDiceStopTimer);
  if(remaining){
   dice.textContent=diceFaces[1+Math.floor(Math.random()*6)]||"🎲";
   dice.classList.remove("rolling");void dice.offsetWidth;dice.style.animationDuration=remaining+"ms";dice.classList.add("rolling");
   snakeDiceSpinTimer=window.setInterval(()=>{dice.textContent=diceFaces[1+Math.floor(Math.random()*6)]||"🎲"},90);
   snakeDiceStopTimer=window.setTimeout(()=>{clearInterval(snakeDiceSpinTimer);dice.textContent=diceFaces[die]||String(die);dice.classList.remove("rolling");dice.style.animationDuration=""},remaining);
  }else{dice.textContent=diceFaces[die]||String(die);dice.classList.remove("rolling")}
 }
 const token=document.createElement("span");
 token.className="snake-moving-token";
 token.textContent=String(players[Number(move.actorIndex)]?.display_name||"؟").trim().slice(0,1)||"؟";
 token.setAttribute("aria-label","قطعة اللاعب تتحرك");
 board.append(token);
 const staticToken=board.querySelector('[data-player-token="'+Number(move.actorIndex)+'"]');
 if(staticToken)staticToken.style.visibility="hidden";
 const first=snakeCellCenter(board,from);
 if(first){token.style.left=first.x+"px";token.style.top=first.y+"px"}
 await snakeWaitUntil(startAt+1100);
 const steps=[];
 if(landing>from)for(let n=from+1;n<=landing;n++)steps.push(n);
 for(let i=0;i<steps.length;i++){
  await animateSnakeSegment(board,token,i===0?from:steps[i-1],steps[i],startAt+1100+i*230,230);
 }
 if(final!==landing)await animateSnakeSegment(board,token,landing,final,startAt+1100+steps.length*230,850);
 const finishAt=startAt+Number(move.animationMs||1100+steps.length*230);
 if(players[Number(move.actorIndex)]?.user_id!==user?.id&&!isHost())return;
 if(snakeMoveFinishTimer)clearTimeout(snakeMoveFinishTimer);
 snakeMoveFinishTimer=window.setTimeout(()=>{
  if(!room||room.game_key!=="snakes"||room.game_state?.board?.pendingMove?.id!==id)return;
  invokeGameEngine("finish-snake-move").catch(async error=>{
   if(/تغيّرت حالة الغرفة|الحركة ما اكتملت/.test(String(error?.message||error)))await refreshRoom(true).catch(()=>{});
   else showError(error);
  });
 },Math.max(0,finishAt-Date.now()+100));
}

function renderUnoMatchSummary(state,compact=false){
 const match=state?.unoMatch||{},scores=match.scores||{},rounds=Array.isArray(match.rounds)?match.rounds:[],last=rounds[rounds.length-1],champion=match.matchWinnerId;
 const rows=players.map(p=>({id:p.user_id,name:p.display_name,score:Number(scores[p.user_id]||0)})).sort((a,b)=>b.score-a.score);
 return '<section class="question-panel uno-match-score '+(compact?'is-compact':'')+'"><div class="uno-match-score-head"><b>🏆 مباراة UNO إلى '+Number(match.targetScore||500)+' نقطة</b><span>الجولة '+Number(match.roundNumber||state?.round||1)+'</span></div><div class="uno-match-score-list">'+rows.map((p,i)=>'<div class="uno-match-score-row"><span>'+(i===0?'🥇 ':'')+esc(p.name)+'</span><strong>'+p.score+'</strong></div>').join('')+'</div>'+(last?'<p class="uno-round-result">الجولة السابقة: '+esc(players.find(p=>p.user_id===last.winnerId)?.display_name||'الفائز')+' حصل على '+Number(last.pointsAwarded||0)+' نقطة.</p>':'')+(champion?'<p class="uno-match-champion">👑 بطل المباراة: '+esc(players.find(p=>p.user_id===champion)?.display_name||'اللاعب الفائز')+'</p>':'')+'</section>';
}
function renderGame(g,s,mine,host){const b=s.board||{},myTurn=players[s.turn]?.user_id===user?.id;let h='<div class="online-game-board"><h3>🎮 '+esc(g.name)+'</h3><p class="turn-banner">'+(myTurn?'دورك هسه!':"الدور على "+esc(players[s.turn]?.display_name||"اللاعب التالي"))+'</p>';
if(room.game_key==="wheel"){
 const stage=b.stage||"landing",allChoices=["who","number","liar","yesno","most","snakes","domino","tavla","colors","quiz"],choices=allChoices,eligible=new Set(Array.isArray(b.eligibleGames)&&b.eligibleGames.length?b.eligibleGames:allChoices);
 const icons=["🧐","🔢","🤥","🙊","👀","🐍","🁣","🎲","🃏","🧠"];
 const wheel='<div class="online-wheel-wrap"><span class="online-wheel-pointer" aria-hidden="true">▼</span><div class="online-wheel-visual" style="transform:rotate('+Number(b.rotation||0)+'deg)" role="img" aria-label="دولاب التحدي بالألعاب المناسبة لعدد اللاعبين"><div class="online-wheel-disc">'+icons.map(x=>'<span>'+x+'</span>').join("")+'</div><div class="online-wheel-hub">سَـوَاد<small>وناسة</small></div></div></div>';
 const allLabels={who:"🧐 مَنُو آني؟",number:"🔢 الرقم",liar:"🤥 برا السالفة",yesno:"🙊 إي ولا",most:"👀 الأكثر",snakes:"🐍 حيّة ودرج",domino:"🁣 دومينوا",tavla:"🎲 طاولي",colors:"🃏 كروت",quiz:"🧠 أسئلة"};
 const library='<div class="online-wheel-legend">'+choices.map(key=>'<span class="'+(eligible.has(key)?"":"wheel-choice-disabled")+'">'+allLabels[key]+(eligible.has(key)?"":" · غير متاحة حالياً")+'</span>').join("")+'</div><p class="wheel-coming-title">ألعاب إضافية قريباً</p><div class="online-wheel-legend coming">'+["🎨 ارسم وخمّن","🎭 مثّلها!","🧩 شنو الرابط؟","🕵️ صاحب الجواب","🔊 خَمِّن الصوت","🧠 ذاكرة اللمة","⚖️ لو خيّروك؟","🔤 آخر حرف"].map(x=>'<span>'+x+'</span>').join("")+'</div>';
 if(stage==="landing"){h='<section class="online-wheel-stage wheel-landing"><div class="wheel-emblem">🌐🎡</div><span class="eyebrow">اختيار جماعي متزامن</span><h2>دولاب التحدي أونلاين</h2><p>لفة واحدة يشوفها كل الموجودين بنفس التوقيت، والنتيجة تنحفظ داخل الغرفة.</p><div class="wheel-howto"><b>قبل ما تبدون</b><p>المضيف يفتح ساحة الدولاب، وبعدها يلف مرة واحدة. كل لاعب يشوف الحركة والنتيجة نفسها.</p></div><div class="wheel-feature-row"><span>✦ '+players.length+' لاعبين بالغرفة</span><span>✧ '+(host?"إنت الهوست":"بانتظار الهوست")+'</span></div>'+(host?'<button class="btn btn-gold full-btn" id="enterOnlineWheelArena">ادخل ساحة الدولاب ✦</button>':'<p class="hint-box">ننتظر الهوست حتى يفتح ساحة الدولاب للجميع…</p>')+library+'</section>';return h}
 if(stage==="arena"){h='<section class="online-wheel-stage wheel-arena"><span class="pill">ساحة اللفّ المشتركة</span><h2>كلّكم على نفس اللفة 🎡</h2><p>'+(b.spinning?"الدولاب يدور على الخادم، والنتيجة نفسها توصل لكل اللاعبين.":host?"اضغط وخلّ النتيجة تظهر لكل اللاعبين.":"الهوست راح يلفّ الدولاب، والنتيجة توصلكم بنفس اللحظة.")+'</p>'+wheel+'<div class="wheel-status">'+(b.spinning?"جاري دوران الدولاب…":b.result?"النتيجة السابقة: "+esc(games[b.result]?.name||"—"):"الدولاب جاهز للفة الأولى")+'</div>'+(host&&!b.spinning?'<button class="btn btn-gold full-btn" id="spinOnlineWheel">ابدأ اللفة المشتركة ✦</button><button class="btn btn-ghost full-btn" id="backOnlineWheelLanding">واجهة الدولاب الرئيسية</button>':!b.spinning?'<p class="hint-box">بانتظار الهوست…</p>':'<p class="hint-box">كل اللاعبين يشوفون اللفة نفسها.</p>')+library+'</section>';return h}
 if(stage==="result"&&b.result){h='<section class="online-wheel-stage wheel-result-screen"><span class="eyebrow">النتيجة وصلت لكل اللاعبين</span><div class="wheel-result-orbit">'+(games[b.result]?.icon||"🎉")+'</div><h2>الدولاب اختار لكم!</h2><div class="wheel-result-card"><small>اللعبة المختارة</small><h3>'+esc(games[b.result]?.name||"لعبة")+'</h3><p>الاختيار محفوظ بالغرفة ويظهر نفسه لكل لاعب يرجع أو يتصل من جديد.</p></div>'+(host?'<button class="btn btn-gold full-btn" id="chooseOnlineWheelResult">اعتمد اللعبة المختارة وانتقل إليها</button><button class="btn btn-ghost full-btn" id="spinOnlineWheelAgain">لفّ مرة ثانية</button><button class="btn btn-ghost full-btn" id="backOnlineWheelLanding">واجهة الدولاب الرئيسية</button>':'<p class="hint-box">بانتظار الهوست يعتمد اللعبة أو يعيد اللفة.</p>')+library+'</section>';return h}
}
if(room.game_key==="snakes"){
 const pos=b.positions||[],snakeLinks=room.engine_version>=3?(b.snakes||[]):Object.entries(snakes).map(([from,to])=>({from:Number(from),to:Number(to)})),ladderLinks=room.engine_version>=3?(b.ladders||[]):Object.entries(ladders).map(([from,to])=>({from:Number(from),to:Number(to)})),snakeMap=new Map(snakeLinks.map(x=>[Number(x.from),Number(x.to)])),ladderMap=new Map(ladderLinks.map(x=>[Number(x.from),Number(x.to)])),pending=b.pendingMove;
 const cells=snakeBoardOrder().map(n=>{
  const snakeTo=snakeMap.get(n),ladderTo=ladderMap.get(n);
  const tokens=pos.map((p,j)=>p===n?'<i class="snake-player-token" data-player-token="'+j+'" title="'+esc(players[j]?.display_name||"")+'">'+esc((players[j]?.display_name||"?").slice(0,1))+'</i>':"").join("");
  return '<div class="snake-cell '+(snakeTo?'snake-cell-mark':ladderTo?'ladder-cell':'')+'" data-cell="'+n+'"><b>'+n+'</b>'+(snakeTo?'<small class="snake-link">🐍 ↓ '+snakeTo+'</small>':ladderTo?'<small class="ladder-link">🪜 ↑ '+ladderTo+'</small>':'')+tokens+'</div>';
 }).join("");
 const face=["","⚀","⚁","⚂","⚃","⚄","⚅"][Number(b.dice)||0]||"🎲";
 const moveText=pending?"جاري تحريك القطعة حسب نتيجة النرد…":b.lastMove?"آخر حركة: "+Number(b.lastMove.from)+" إلى "+Number(b.lastMove.final):"كل لاعب يتحرك بعد ظهور نتيجة نرده.";
 h+='<section class="snakes-game-panel"><div class="snakes-board" aria-label="لوحة حيّة ودرج من ١ إلى ١٠٠">'+cells+'</div><div class="snake-control-row"><div class="snake-dice-card"><small>النرد</small><div class="snake-dice" id="snakeDice">'+face+'</div><b>'+(b.dice?'الرقم '+b.dice:'بانتظار الرمية')+'</b></div><div class="snake-status-card"><small>حالة الحركة</small><strong>'+moveText+'</strong><span>عدد الثعابين: '+(b.snakes?.length||0)+' • السلالم: '+(b.ladders?.length||0)+'</span></div></div><p class="muted-note">ارمِ النرد، شاهد القطعة تتحرك خانة بخانة. إذا وصلت لرأس ثعبان تنزل إلى ذيله، وإذا وصلت لبداية درج تصعد إلى نهايته. الفوز بالوصول إلى ١٠٠ تماماً.</p><button class="btn btn-gold full-btn" id="rollSnake" '+(!myTurn||!!pending?'disabled':'')+'>'+(pending?'انتظر اكتمال الحركة':'🎲 ارمي النرد')+'</button></section>';
}
if(room.game_key==="domino"){
 const chain=b.chain||[],hand=room.engine_version>=3?(room.player_private_state?.hand||[]):(b.hands?.[user?.id]||[]),stock=Number(b.stock_count??b.draw?.length??0),left=chain.length?Number(chain[0][0]):null,right=chain.length?Number(chain[chain.length-1][1]):null,opening=b.openingTile;
 const legal=tile=>chain.length?([left,right].includes(Number(tile[0]))||[left,right].includes(Number(tile[1]))):(!opening||(players[s.turn]?.user_id===b.openingPlayerId&&Number(tile[0])===Number(opening[0])&&Number(tile[1])===Number(opening[1])));
 const canPlay=hand.some(legal),counts=players.map(p=>'<span class="domino-player-count">'+esc(p.display_name)+': '+Number(b.handCounts?.[p.user_id]??(p.user_id===user?.id?hand.length:0))+' قطع</span>').join("");
 h+='<section class="domino-game-panel"><div class="domino-table-top"><div><small>مجموعة الدبل ستة</small><strong>المخزون: '+stock+' قطعة</strong></div><div class="domino-player-counts">'+counts+'</div></div>'+(opening&&!chain.length?'<p class="domino-opening-note">بداية الجولة: '+(players.find(p=>p.user_id===b.openingPlayerId)?.display_name||"اللاعب الأول")+' يبدأ بأعلى قطعة '+opening[0]+'|'+opening[1]+'</p>':'')+'<div class="domino-chain-wrap"><small>سلسلة اللعب · الطرفان المفتوحان</small><div class="domino-chain">'+(chain.length?chain.map(t=>dominoTileMarkup(t,"domino-chain-piece")).join(""):'<span class="domino-empty">بانتظار قطعة البداية</span>')+'</div></div><div class="domino-hand-heading"><strong>قطعك</strong><span>'+hand.length+' قطع</span></div><div class="domino-hand">'+hand.map((t,i)=>'<button type="button" class="domino-tile '+(legal(t)?'is-legal':'is-blocked')+'" data-domino="'+i+'" '+(!myTurn||!legal(t)?'disabled':'')+' aria-label="قطعة '+t[0]+' و '+t[1]+'">'+dominoTileMarkup(t)+'</button>').join("")+'</div><div class="domino-actions"><button class="btn btn-ghost full-btn" id="drawDomino" '+(!myTurn||stock===0||canPlay||!chain.length?'disabled':'')+'>اسحب قطعة (إذا ما عندك حركة قانونية)</button>'+(stock===0&&!canPlay&&chain.length?'<button class="btn btn-ghost full-btn" id="passDomino" '+(!myTurn?'disabled':'')+'>مرّر الدور</button>':'')+'</div><p class="muted-note">الدبل ستة يحتوي ٢٨ قطعة. اللاعب يبدأ بأعلى دبل، وإذا ماكو دبل يبدأ بأعلى مجموع. طابق أحد الطرفين المفتوحين، واسحب فقط إذا ما عندك قطعة قانونية. إذا خلص المخزون وانسد اللعب، يفوز الأقل نقاطاً على يده.</p></section>';
}
if(room.game_key==="tavla"){
 const points=b.points||[],bar=b.bar||[0,0],off=b.off||[0,0],dice=b.dice||[];
 if(!myTurn||tavlaSelectedTurn!==s.turn){tavlaSelectedFrom=null;tavlaSelectedTurn=s.turn;}
 const selectedText=tavlaSelectedFrom===-1?"البار":tavlaSelectedFrom===null?"لم تختَر حجراً":"النقطة "+(tavlaSelectedFrom+1),diceNames={1:"يَك",2:"دو",3:"سِه",4:"چهار",5:"پَنج",6:"شِش"},doubleNames={1:"هَب يَك",2:"دو بَره",3:"دو سِه",4:"دورجي",5:"دا پَنج",6:"دو شِش"};
 h+='<p>الطاولي الأصلية: 15 حجر لكل لاعب. هدفك توصل كل أحجارك إلى بيتك ثم تخرجها.</p>'+
 '<div class="tavla-score"><span>أحجارك بالبار: '+Number(bar[s.turn]||0)+' • الخارجة: '+Number(off[s.turn]||0)+'/15</span><span>الخصم بالبار: '+Number(bar[(s.turn+1)%2]||0)+' • الخارجة: '+Number(off[(s.turn+1)%2]||0)+'/15</span></div>'+
 '<div class="tavla-track">'+Array.from({length:24},(_,i)=>{const p=points[i]||{},owner=p.owner,count=Number(p.count||0),mine=owner===s.turn&&count>0;return '<button class="tavla-point" data-tavla-from="'+i+'" data-owner="'+(owner===null||owner===undefined?"none":owner)+'" '+(!myTurn||!mine?'disabled':'')+'><b>'+(i+1)+'</b><span>'+(count?(owner===0?'⚪':'⚫')+' × '+count:'—')+'</span></button>'}).join("")+'</div>'+
 '<div class="tavla-bar"><button class="btn btn-ghost" data-tavla-from="-1" '+(!myTurn||!Number(bar[s.turn])?'disabled':'')+'>أحجارك بالبار: '+Number(bar[s.turn]||0)+' (اختَر للإدخال)</button><span>البار المقابل: '+Number(bar[(s.turn+1)%2]||0)+'</span></div>'+
 '<p>النرد: '+(dice.length?(dice.length===4?'دبل '+doubleNames[dice[0]]+' ('+dice[0]+' أربع مرات)':dice.map(d=>diceNames[d]+' ('+d+')').join(' + ')):'بانتظار الرمية')+' • الحجر المختار: '+selectedText+'</p>'+
 '<div class="tavla-dice">'+dice.map((d,i)=>'<button class="btn btn-ghost" data-tavla-die="'+d+'" '+(!myTurn||tavlaSelectedFrom===null?'disabled':'')+'>'+diceNames[d]+' ('+d+')</button>').join("")+'</div>'+
 '<button class="btn btn-gold full-btn" id="rollTavla" '+(!myTurn||dice.length?'disabled':'')+'>ارمِ النرد</button>'+
 '<button class="btn btn-ghost full-btn" id="passTavla" '+(!myTurn||!dice.length?'disabled':'')+'>ما عندي حركة قانونية، مرّر الدور</button>';
}
if(room.game_key==="colors"){
 const hand=room.engine_version>=3?(room.player_private_state?.hand||[]):(b.hands?.[user?.id]||[]),top=b.discard?.at(-1),active=b.activeColor||top?.c||"—",pending=b.unoPending,stock=Number(b.draw_count??b.deck?.length??0),canDraw=stock>0||(b.discard?.length||0)>1,drawn=!!room.player_private_state?.drawn,actionLocked=Boolean(b.wild4Pending||b.startWildPending);
 const discardMarkup=top?unoCardMarkup(top,-1,true):'<span class="uno-empty-card">ابدأ الجولة</span>';
 const callButton=pending?.playerId===user?.id?'<button class="btn btn-gold full-btn" id="callUno">📣 UNO! نادِ قبل ما يبدأ دور اللاعب التالي</button>':pending&&pending.playerId!==user?.id?'<button class="btn btn-ghost full-btn" id="catchUno">👀 صيد UNO (+٢ كرت)</button>':"";
 h+=renderUnoMatchSummary(s,true)+'<section class="uno-game-panel"><div class="uno-table-head"><div><small>لعبة UNO · ١٠٨ كروت</small><strong>اللون الحالي: '+esc(active)+'</strong></div><div class="uno-deck-count">🂠 '+stock+' كرت بالسحب</div></div><div class="uno-discard-area"><div><small>الكرت المفتوح</small>'+discardMarkup+'</div><div class="uno-current-rules"><strong>اتجاه اللعب: '+(Number(b.direction||1)===1?'مع عقارب الساعة':'عكس عقارب الساعة')+'</strong><span>تخطي ⛔ • عكس ↻ • سحب +٢ • كرت حر 🌈 • +٤</span></div></div><div class="uno-hand-heading"><strong>كروتك الخاصة</strong><span>'+hand.length+' كرت</span></div><div class="uno-hand">'+hand.map((c,i)=>unoCardMarkup(c,i,!myTurn||actionLocked||(drawn&&i!==hand.length-1))).join("")+'</div><div class="uno-wild-picker" id="wildColorPicker" hidden><strong>اختار اللون الجديد</strong><div>'+["أحمر","أزرق","أخضر","أصفر"].map(c=>'<button type="button" data-wild-color="'+c+'">'+c+'</button>').join("")+'</div></div>'+callButton+'<button class="btn btn-ghost full-btn" id="drawColor" '+(!myTurn||!canDraw||drawn||actionLocked?'disabled':'')+'>اسحب كرتاً واحداً</button><button class="btn btn-ghost full-btn" id="passColor" '+(!myTurn||!room.player_private_state?.drawn||actionLocked?'disabled':'')+'>مرّر الدور بعد السحب</button><p class="muted-note">طابق اللون أو الرقم أو الرمز. تخطي يتجاوز اللاعب التالي، والعكس يغيّر اتجاه اللعب، و+٢ أو +٤ يجعل اللاعب التالي يسحب ويتخطى دوره. إذا بقي كرت واحد نادِ UNO؛ إذا سبقك لاعب بالتصيّد تسحب كرتين. كرت +٤ لا يُلعب إذا عندك كرت من اللون الحالي.</p>'+(b.startWildPending&&myTurn?'<label for="wildColor">اختار لون بداية الجولة</label><select id="wildColor"><option value="">اختار اللون</option><option value="أحمر">أحمر</option><option value="أزرق">أزرق</option><option value="أخضر">أخضر</option><option value="أصفر">أصفر</option></select><button class="btn btn-gold full-btn" id="chooseStartWild">اعتمد لون البداية</button>':'')+(b.wild4Pending?.targetId===user?.id?'<button class="btn btn-gold full-btn" id="challengeWild4">اعترض على +٤</button><button class="btn btn-ghost full-btn" id="acceptWild4">اقبل +٤ واسحب ٤</button>':'')+'</section>';
}
if(["most","yesno","quiz","who","liar","number"].includes(room.game_key)){const prompts=room.game_key==="most"?questions:room.game_key==="yesno"?["هل تحب السفر؟","هل تگدر تعيش يوم بلا موبايل؟","هل تعتبر نفسك محظوظ؟"]:room.game_key==="quiz"?["شنو عاصمة العراق؟","كم عدد أيام الأسبوع؟","شنو أكبر كوكب بالمجموعة الشمسية؟"]:room.game_key==="who"?["اسأل عن العنصر السري بما يناسب الفئة المحددة","اكتب تخمينك للعنصر السري"]:room.game_key==="liar"?[b.question_text||b.question||"اكتب تلميحك"]:["خمّن الرقم بين ١ و١٠٠"];const prompt=prompts[(b.question||0)%prompts.length],liarVote=room.game_key==="liar"&&b.stage==="votes",privateLiar=room.engine_version>=3&&room.game_key==="liar"?room.player_private_state||{}:{},liarCard=room.game_key==="liar"&&room.engine_version>=3?'<div class="question-panel"><b>'+(privateLiar.role==="liar"?"بطاقتك: إنت الكذّاب 🤫":"كلمتك السرية")+'</b><p>'+esc(privateLiar.word||privateLiar.hint||"تعذّر استرجاع بطاقتك؛ حدّث الغرفة.")+'</p></div>':"",legacyAnswerKey=room.game_key==="who"?"guesses":room.game_key==="most"?"votes":room.game_key==="liar"?"votes":"answers",legacyReady=room.engine_version===1&&host&&Object.keys(b[legacyAnswerKey]||{}).length>=players.length,socialFinishKey=room.game_key==="who"?"guesses":room.game_key==="most"?"votes":room.game_key==="yesno"?"answers":"votes",socialFinishCount=Object.keys(b[socialFinishKey]||{}).filter(id=>players.some(p=>p.user_id===id)).length,socialHintsCount=Object.keys(b.hints||{}).filter(id=>players.some(p=>p.user_id===id)).length,socialFinishReady=room.engine_version>=3&&players.length>0&&(room.game_key==="liar"?(b.stage==="votes"&&socialHintsCount===players.length&&socialFinishCount===players.length):(["who","most","yesno"].includes(room.game_key)&&socialFinishCount===players.length));h+=liarCard+'<div class="question-panel"><span>الجولة '+(s.round||1)+'</span><h3>'+esc(prompt)+'</h3>'+(room.game_key==="number"?'<p class="number-engine-hint">'+esc(b.hint||("خمّن رقماً من ١ إلى "+Number(b.maxNumber||100)+"."))+'</p><small>محاولاتك: '+Number(b.tries?.[user?.id]||0)+'</small>':'')+(room.game_key==="number"?'<input id="onlineGuess" type="number" min="1" max="'+Number(b.maxNumber||100)+'" placeholder="رقم من ١ إلى '+Number(b.maxNumber||100)+'">':(room.game_key==="liar"&&liarVote)||room.game_key==="most"?'<select id="onlineVote"><option value="">اختار اللاعب</option>'+players.filter(p=>room.game_key==="most"||p.user_id!==user?.id).map(p=>'<option value="'+esc(p.user_id)+'">'+esc(p.display_name)+'</option>').join("")+'</select>':room.game_key==="liar"?'<input id="onlineHint" maxlength="80" placeholder="اكتب تلميحك">':room.game_key==="who"?'<input id="onlineGuess" maxlength="80" placeholder="اكتب تخمينك للشخصية">':'<input id="onlineAnswer" maxlength="120" placeholder="اكتب إجابتك أو تصويتك">')+'<button class="btn btn-gold full-btn" id="submitOnlineAnswer" '+(s.phase!=="playing"?'disabled':'')+'>إرسال الإجابة</button>'+(room.game_key==="liar"&&host&&b.stage!=="votes"&&Object.keys(b.hints||{}).length>=players.length?'<button class="btn btn-ghost full-btn" id="advanceLiarVote">ابدأ التصويت</button>':'')+'<div class="room-feed">'+(s.feed||[]).slice(-8).map(x=>'<p>'+esc(x)+'</p>').join("")+'</div>'+(legacyReady?'<button class="btn btn-gold full-btn" id="upgradeLegacyRoom">ترقية الغرفة للمحرك الخادمي الآمن</button>':'')+ (socialFinishReady&&host?'<button class="btn btn-gold full-btn" id="finishOnlineGame">إنهاء المباراة وحفظ المكافآت</button>':'')+'<button class="btn btn-ghost full-btn" id="nextOnlineRound" '+(!host?'disabled':'')+'>السؤال التالي</button></div>'}
h+='</div>';return h}

function wireGame(g,s,mine){
 const b=s.board||{},myTurn=players[s.turn]?.user_id===user?.id,server=room.engine_version>=3;
 const act=(name,payload={})=>invokeGameEngine(name,payload).catch(showError);
 if(server&&room.game_key==="snakes"&&b.pendingMove)animateSnakePendingMove(b.pendingMove);
 if($("#saveRoomRules"))$("#saveRoomRules").onclick=async()=>{
  const button=$("#saveRoomRules");if(button)button.disabled=true;
  try{await invokeGameEngine("update-room-rules",readRoomRules());toast("انحفظت قوانين الغرفة.");}
  catch(error){showError(error);const current=$("#saveRoomRules");if(current)current.disabled=false}
 };
 if($("#createRoomTournament"))$("#createRoomTournament").onclick=async()=>{
  const button=$("#createRoomTournament");if(button)button.disabled=true;
  try{
   const rules=readRoomRules();
   await invokeGameEngine("update-room-rules",rules);
   await invokeGameEngine("create-tournament",{totalRounds:rules.rounds,pointsPerWin:rules.pointsPerWin});
   toast("تم إنشاء بطولة الربع بالقوانين اللي اخترتها!");
  }catch(error){showError(error);const current=$("#createRoomTournament");if(current)current.disabled=false}
 };
 if($("#timeoutRoomRound"))$("#timeoutRoomRound").onclick=()=>act("timeout-room-round");

 if($("[data-table-flip-claim]"))$("[data-table-flip-claim]").onclick=()=>act("claim-table-flip-challenge");
 if($("[data-table-flip-confirm]"))$("[data-table-flip-confirm]").onclick=()=>act("confirm-table-flip-challenge");
 document.querySelectorAll("[data-room-reaction]").forEach(button=>{
  button.onclick=()=>sendRoomReaction(button.dataset.roomReaction);
 });

 if($("[data-oras-toggle]"))$("[data-oras-toggle]").onclick=()=>{
  const api=window.SuwadOrasCommentator;
  if(!api?.isSupported?.())return toast("النطق الصوتي غير مدعوم بهذا المتصفح.");
  const enabled=api.toggle();
  toast(enabled?"أوراس اشتغل، وراح يعلّق باللهجة العراقية.":"تم كتم أوراس.");
  roomScreen();
 };


 if(wheelFinishTimer){clearTimeout(wheelFinishTimer);wheelFinishTimer=null}
 if(server&&room.game_key==="wheel"&&b.spinning){
  const started=Date.parse(b.spinStartedAt||"");
  const elapsed=Number.isFinite(started)?Date.now()-started:0;
  const remaining=Math.max(0,Number(b.spinDuration||6500)-elapsed);
  wheelFinishTimer=setTimeout(()=>act("wheel-finish"),remaining+120);
 }
 if($("#enterOnlineWheelArena"))$("#enterOnlineWheelArena").onclick=async()=>{
  if(!isHost())return;
  if(server)return act("wheel-enter");
  const next={...s,board:{...b,stage:"arena"}},r=await setState(next,{status:"playing"});
  if(r.error)showError(r.error);else{room={...room,game_state:next};await refreshRoom()}
 };
 if($("#chooseOnlineWheelResult"))$("#chooseOnlineWheelResult").onclick=async()=>{
  if(!isHost()||!b.result)return;
  if(server)return act("wheel-select");
  const next={phase:"lobby",round:0,turn:0,feed:["اختار الدولاب لعبة "+games[b.result].name],scores:{},board:null};
  const r=await setState(next,{game_key:b.result,status:"waiting"});
  if(r.error)showError(r.error);else{room={...room,game_key:b.result,game_state:next,status:"waiting"};await refreshRoom()}
 };
 if($("#backOnlineWheelLanding"))$("#backOnlineWheelLanding").onclick=async()=>{
  if(!isHost())return;
  if(server)return act("wheel-back");
  const next={...s,board:{...b,result:null,stage:"landing"}},r=await setState(next,{status:"playing"});
  if(r.error)showError(r.error);else{room={...room,game_state:next};await refreshRoom()}
 };
 if($("#spinOnlineWheelAgain"))$("#spinOnlineWheelAgain").onclick=async()=>{
  if(!isHost()||busy)return;
  if(server)return act("wheel-again");
  const next={...s,board:{...b,result:null,stage:"arena"}},r=await setState(next,{status:"playing"});
  if(r.error)showError(r.error);else{room={...room,game_state:next};await refreshRoom()}
 };
 if($("#spinOnlineWheel"))$("#spinOnlineWheel").onclick=async()=>{
  if(!isHost()||busy)return;
  if(server)return act("wheel-spin");
  busy=true;
  const button=$("#spinOnlineWheel"),choices=["who","number","liar","yesno","most","snakes","domino","tavla","colors","quiz"];
  const resultIndex=Math.floor(Math.random()*choices.length),result=choices[resultIndex],startRotation=Number(b.rotation||0),arc=360/choices.length;
  const rotation=startRotation+360*(7+Math.floor(Math.random()*3))+((360-((startRotation+(resultIndex+.5)*arc)%360))%360);
  const duration=6500,spinNumber=(b.spins||0)+1,startedAt=Date.now();
  if(button){button.disabled=true;button.textContent="الدولاب يدور…"}
  const spinning={...s,phase:"playing",board:{...b,result:null,startRotation,rotation,spins:spinNumber,stage:"arena",spinning:true,spinStartedAt:startedAt,spinDuration:duration}};
  try{
   const begin=await setState(spinning,{status:"playing"});if(begin.error)throw begin.error;
   room={...room,game_state:spinning};await refreshRoom();
   await new Promise(resolve=>setTimeout(resolve,duration+120));
   const finished={...spinning,board:{...spinning.board,spinning:false,result,stage:"result"},feed:[...(s.feed||[]),nick()+" لفّ الدولاب واختار "+games[result].name]};
   const done=await setState(finished,{status:"playing"});if(done.error)throw done.error;
   room={...room,game_state:finished};await refreshRoom();
  }catch(e){showError(e)}finally{busy=false}
 };
 if($("#rollSnake"))$("#rollSnake").onclick=async()=>{
  if(!myTurn||b.pendingMove)return;
  if(server)return act("roll");
  const legacyLadders=Object.fromEntries((b.ladders||[]).map(x=>[x.from,x.to]));
  const legacySnakes=Object.fromEntries((b.snakes||[]).map(x=>[x.from,x.to]));
  const die=1+Math.floor(Math.random()*6),pos=[...(b.positions||[])],old=Number(pos[s.turn]||0),step=old+die;
  let next=step>100?200-step:step;
  if(step<=100)next=legacyLadders[next]||legacySnakes[next]||next;
  pos[s.turn]=next;
  const fin=next===100?s.turn:null;
  await setState({...s,turn:fin===null?(s.turn+1)%players.length:s.turn,board:{...b,positions:pos,dice:die,finished:fin},phase:fin===null?"playing":"finished",feed:[...(s.feed||[]),esc(players[s.turn].display_name)+" رمى "+die+" ووصل "+next]},{status:fin===null?"playing":"finished"}).then(r=>{if(r.error)showError(r.error)});
 };

 if($("#drawDomino"))$("#drawDomino").onclick=async()=>{
  if(server)return act("draw-domino");
  const draw=[...(b.draw||[])],hands={...b.hands},hand=[...(hands[user.id]||[])];
  if(!draw.length)return toast("خلصت القطع");
  hand.push(draw.pop());hands[user.id]=hand;
  await setState({...s,board:{...b,draw,hands},feed:[...(s.feed||[]),nick()+" سحب قطعة"]}).then(r=>r.error&&showError(r.error));
 };
 if($("#passDomino"))$("#passDomino").onclick=async()=>{if(server)return act("pass-domino");toast("تمرير الدور غير متاح في هذه الغرفة القديمة.")};
 document.querySelectorAll("[data-domino]").forEach(el=>el.onclick=async()=>{
  if(!myTurn)return;
  const index=Number(el.dataset.domino);
  if(server)return act("play-domino",{index});
  const hand=[...(b.hands?.[user.id]||[])],tile=hand[index],chain=[...(b.chain||[])];if(!tile)return;
  if(chain.length){
   const left=chain[0][0],right=chain.at(-1)[1];let side="right";
   if(tile[0]===right){}
   else if(tile[1]===right){tile.reverse()}
   else if(tile[1]===left){side="left"}
   else if(tile[0]===left){tile.reverse();side="left"}
   else return toast("هاي القطعة ما تطابق طرف السلسلة.");
   if(side==="left")chain.unshift(tile);else chain.push(tile);
  }else chain.push(tile);
  hand.splice(index,1);const hands={...b.hands,[user.id]:hand},win=hand.length===0;
  await setState({...s,phase:win?"finished":"playing",turn:(s.turn+1)%players.length,board:{...b,hands,chain},feed:[...(s.feed||[]),nick()+" لعب "+tile.join("|")]},{status:win?"finished":"playing"}).then(r=>r.error&&showError(r.error));
 });
 if($("#bearOffTavla"))$("#bearOffTavla").onclick=async()=>{if(!myTurn||!server)return;const destination=s.turn===0?Number(b.selected)+Number(b.dice[0]):Number(b.selected)-Number(b.dice[0]);return act("move-piece",{destination})};
 if($("#rollTavla"))$("#rollTavla").onclick=()=>{tavlaSelectedFrom=null;if(!myTurn)return;if(server)return act("roll");toast("الطاولي الأصلية تحتاج محرك الخادم.");};
 document.querySelectorAll("[data-tavla-from]").forEach(el=>el.onclick=()=>{
  if(!myTurn||!b.dice?.length)return;
  const from=Number(el.dataset.tavlaFrom);
  if(from===-1&&Number((b.bar||[])[s.turn]||0)<1)return;
  if(from>=0&&!((b.points||[])[from]?.owner===s.turn&&Number((b.points||[])[from]?.count)>0))return;
  tavlaSelectedFrom=from;tavlaSelectedTurn=s.turn;roomScreen();
 });
 document.querySelectorAll("[data-tavla-die]").forEach(el=>el.onclick=()=>{
  if(!myTurn||tavlaSelectedFrom===null)return toast("اختَر حجراً من اللوح أو من البار أولاً.");
  const die=Number(el.dataset.tavlaDie),from=tavlaSelectedFrom;tavlaSelectedFrom=null;
  if(server)return act("move-tavla",{from,die});
  toast("هذه الغرفة تحتاج محرك الطاولي الخادمي الجديد.");
 });
 if($("#passTavla"))$("#passTavla").onclick=()=>{tavlaSelectedFrom=null;if(server)return act("pass-tavla");};
 if($("#drawColor"))$("#drawColor").onclick=async()=>{
  if(!myTurn)return;
  if(server)return act("draw-color");
  toast("سحب الكروت غير متاح في هذه الغرفة القديمة.");
 };
 if($("#callUno"))$("#callUno").onclick=()=>{if(server)return act("call-uno");};
 if($("#catchUno"))$("#catchUno").onclick=()=>{if(server)return act("catch-uno");};
 if($("#chooseStartWild"))$("#chooseStartWild").onclick=()=>{const color=$("#wildColor")?.value;if(!color)return toast("اختار اللون أولاً.");if(server)return act("choose-start-color",{color});};
 if($("#challengeWild4"))$("#challengeWild4").onclick=()=>{if(server)return act("challenge-wild4");};
 if($("#acceptWild4"))$("#acceptWild4").onclick=()=>{if(server)return act("accept-wild4");};
 if($("#passColor"))$("#passColor").onclick=async()=>{
  if(!myTurn)return;
  if(server)return act("pass-color");
  toast("تمرير الدور غير متاح في هذه الغرفة القديمة.");
 };
 document.querySelectorAll("[data-color]").forEach(el=>el.onclick=async()=>{
  if(!myTurn)return;
  const index=Number(el.dataset.color);
  if(server){
   const hand=room.player_private_state?.hand||[],card=hand[index];
   if(!card)return;
   if(card.c==="wild"){
    const picker=$("#wildColorPicker");if(!picker)return;
    picker.hidden=false;picker.querySelectorAll("[data-wild-color]").forEach(choice=>{
     choice.onclick=()=>act("play-color",{index,color:choice.dataset.wildColor});
    });
    return;
   }
   return act("play-color",{index});
  }
  const hands={...b.hands},hand=[...(b.hands?.[user.id]||[])],card=hand[index],top=b.discard?.at(-1);if(!card)return;
  if(top&&card.c!==top.c&&card.v!==top.v)return toast("اختار كارت يطابق اللون أو الرقم.");
  hand.splice(index,1);hands[user.id]=hand;
  await setState({...s,phase:hand.length?"playing":"finished",turn:(s.turn+1)%players.length,board:{...b,hands,discard:[...(b.discard||[]),card]},feed:[...(s.feed||[]),nick()+" لعب كارت "+card.c+" "+card.v]},{status:hand.length?"playing":"finished"}).then(r=>r.error&&showError(r.error));
 });
 if($("#callUno"))$("#callUno").onclick=()=>act("call-uno");
 if($("#catchUno"))$("#catchUno").onclick=()=>act("catch-uno");
 if($("#submitOnlineAnswer"))$("#submitOnlineAnswer").onclick=async()=>{
  const input=$("#onlineVote")||$("#onlineGuess")||$("#onlineHint")||$("#onlineAnswer"),val=input?.value.trim();
  if(!val)return toast("اكتب إجابتك أولاً.");
  if(room.game_key==="number"){
   const guess=Number(val),max=Number(state?.board?.maxNumber||100);if(!Number.isInteger(guess)||guess<1||guess>max)return toast("أدخل رقماً صحيحاً من ١ إلى "+max+".");
   try{await invokeNumberEngine("guess-number",{guess});await refreshRoom()}catch(e){showError(e)}
   return;
  }
  if(server)return act("submit",{value:val});
  const feed=[...(s.feed||[]),nick()+": "+val],board={...b};
  if(room.game_key==="liar")board.hints={...(b.hints||{}),[user.id]:val};
  else if(room.game_key==="most")board.votes={...(b.votes||{}),[user.id]:val};
  else if(room.game_key==="yesno"||room.game_key==="quiz")board.answers={...(b.answers||{}),[user.id]:val};
  else if(room.game_key==="who")board.guesses={...(b.guesses||{}),[user.id]:val};
  await setState({...s,board,feed}).then(r=>r.error?showError(r.error):toast("وصلت إجابتك للغرفة!"));
 };
 if($("#advanceLiarVote"))$("#advanceLiarVote").onclick=async()=>{
  if(!isHost())return;
  if(server)return act("advance-vote");
  toast("التصويت غير مفعّل في هذه الغرفة القديمة.");
 };
 if($("#upgradeLegacyRoom"))$("#upgradeLegacyRoom").onclick=async()=>{if(!isHost())return;act("upgrade")};
 if($("#finishOnlineGame"))$("#finishOnlineGame").onclick=()=>{if(!isHost())return;act("finish-game")};
 if($("#nextOnlineRound"))$("#nextOnlineRound").onclick=async()=>{
  if(!isHost())return;
  if(server)return act("next-round");
  const next={...s,round:(s.round||1)+1,turn:((s.turn||0)+1)%players.length,board:{...b,question:((b.question||0)+1),answers:{},votes:{},hints:{},guesses:{}},feed:[...(s.feed||[]),"بدأت جولة جديدة"]};
  await setState(next).then(r=>r.error&&showError(r.error));
 };
}
async function refreshEngineSnapshot(roomId=room?.id){
 const lifecycle=roomLifecycleVersion;
 if(!room||!roomId||room.id!==roomId||Number(room.engine_version)<2)return;
 const result=await db.functions.invoke("room-engine",{body:{action:"snapshot",roomId}});
 if(result.error)await readFunctionError(result.error,"تعذّر استرجاع يدك الخاصة وحالة اللعبة.");
 if(lifecycle!==roomLifecycleVersion||!room||room.id!==roomId)return;
 const data=result.data;
 if(!data?.room?.id)throw Error("استلمنا لقطة غير مكتملة من محرك الغرفة.");
 room={...data.room,player_private_state:data.privateState||{}};
}
async function heartbeatRoom(){
 const roomId=room?.id,lifecycle=roomLifecycleVersion;
 if(!roomId||!user||heartbeatInFlight)return;
 heartbeatInFlight=true;
 try{
  const result=await db.rpc("heartbeat_game_room",{p_room_id:roomId});
  if(lifecycle===roomLifecycleVersion&&room?.id===roomId&&result.error&&result.error.code!=="42501")console.warn("room heartbeat failed",result.error);
 }catch(error){if(lifecycle===roomLifecycleVersion&&room?.id===roomId)console.warn("room heartbeat failed",error)}
 finally{heartbeatInFlight=false}
}
function scheduleRoomRefresh(){
 if(!room)return;
 if(refreshTimer)clearTimeout(refreshTimer);
 refreshTimer=setTimeout(()=>{refreshTimer=null;refreshRoom(true)},180);
}
async function enterRoom(id){
 roomLifecycleVersion++;refreshInFlight=null;
 if(channel){db.removeChannel(channel);channel=null}
 if(poll){clearInterval(poll);poll=null}
 if(heartbeat){clearInterval(heartbeat);heartbeat=null}
 if(refreshTimer){clearTimeout(refreshTimer);refreshTimer=null}
 refreshQueued=false;refreshQueuedSilent=true;lastRenderedRoomFingerprint="";
 if(wheelFinishTimer){clearTimeout(wheelFinishTimer);wheelFinishTimer=null}
 const rr=await db.from("game_rooms").select("*").eq("id",id).single();
 if(rr.error)throw rr.error;
 room=rr.data;
 await heartbeatRoom();
 await refreshPlayers(id);
 await refreshEngineSnapshot(id);
 await refreshTournament(id);
 await connectRoomReactions(id);
 roomScreen();
 channel=db.channel("room-"+id)
  .on("postgres_changes",{event:"*",schema:"public",table:"game_rooms",filter:"id=eq."+id},scheduleRoomRefresh)
  .on("postgres_changes",{event:"*",schema:"public",table:"game_room_players",filter:"room_id=eq."+id},scheduleRoomRefresh)
  .subscribe((status,error)=>{
   if(status==="CHANNEL_ERROR"||status==="TIMED_OUT")console.warn("room realtime channel issue",status,error||"");
   if(status==="SUBSCRIBED")scheduleRoomRefresh();
  });
 poll=setInterval(()=>{if(room?.id===id)scheduleRoomRefresh()},10000);
 heartbeat=setInterval(()=>{if(room?.id===id)heartbeatRoom()},20000);
}
async function refreshPlayers(roomId=room?.id){
 const lifecycle=roomLifecycleVersion;
 if(!room||!roomId||room.id!==roomId)return;
 const r=await db.from("game_room_players").select("*").eq("room_id",roomId).order("seat");
 if(r.error)throw r.error;
 if(lifecycle===roomLifecycleVersion&&room?.id===roomId)players=r.data||[];
}
async function refreshTournament(roomId=room?.id){
 if(!room||!roomId||room.id!==roomId)return;
 const lifecycle=roomLifecycleVersion;
 const result=await db.functions.invoke("room-engine",{body:{
  action:"tournament-snapshot",roomId,expectedUpdatedAt:room.updated_at
 }});
 if(result.error)await readFunctionError(result.error,"تعذّر تحميل بطولة الربع وترتيب اللاعبين.");
 if(lifecycle!==roomLifecycleVersion||!room||room.id!==roomId)return;
 tournament=result.data?.tournament||null;
 tournamentScores=Array.isArray(result.data?.scores)?result.data.scores:[];
}
async function createRoomTournament(){
 if(!room||!isHost()||tournament)return;
 const button=$("#createRoomTournament");
 if(button)button.disabled=true;
 try{
  const totalRounds=Number($("#tournamentRounds")?.value||5);
  const pointsPerWin=Number($("#tournamentPoints")?.value||3);
  const result=await db.functions.invoke("room-engine",{body:{
   action:"create-tournament",roomId:room.id,expectedUpdatedAt:room.updated_at,
   payload:{totalRounds,pointsPerWin}
  }});
  if(result.error)await readFunctionError(result.error,"تعذّر إنشاء بطولة الربع.");
  if(!result.data?.room?.id)throw Error("استلمنا استجابة غير مكتملة من إنشاء البطولة.");
  room=result.data.room;
  await refreshTournament();
  roomScreen();
  toast("انطلقت بطولة الربع! الترتيب راح يتحدّث بعد كل جولة.");
 }catch(error){showError(error)}
 finally{const current=$("#createRoomTournament");if(current)current.disabled=false}
}
async function refreshRoom(silent=false){
 if(!room)return;
 if(refreshInFlight){
  refreshQueued=true;
  if(!silent)refreshQueuedSilent=false;
  return refreshInFlight;
 }
 const roomId=room.id,lifecycle=roomLifecycleVersion;
 const run=(async()=>{
  try{
   const r=await db.from("game_rooms").select("*").eq("id",roomId).single();
   if(lifecycle!==roomLifecycleVersion||!room||room.id!==roomId)return;
   if(r.error)throw r.error;
   const previousUpdatedAt=room.updated_at;
   const previousPrivateState=room.player_private_state;
   room={...r.data,...(previousPrivateState?{player_private_state:previousPrivateState}:{})};
   await refreshPlayers(roomId);
   await refreshTournament(roomId);
   if(lifecycle!==roomLifecycleVersion||!room||room.id!==roomId)return;
   if(Number(room.engine_version)>=2&&(previousUpdatedAt!==room.updated_at||!previousPrivateState))await refreshEngineSnapshot(roomId);
   if(lifecycle!==roomLifecycleVersion||!room||room.id!==roomId)return;
   const fingerprint=roomFingerprint();
   const modal=$("#modalBackdrop"),content=$("#modalContent");
   const roomModalOpen=!!modal&&!modal.hidden&&!!content&&(!!content.querySelector(".online-room-head")||!!content.querySelector(".online-wheel-shell"));
   if(!silent||roomModalOpen){
    if(!silent||fingerprint!==lastRenderedRoomFingerprint)roomScreen();
   }
  }catch(e){if(lifecycle===roomLifecycleVersion&&room?.id===roomId){if(!silent)showError(e);else console.warn("room refresh failed",e)}}
 })();
 refreshInFlight=run;
 try{await run}
 finally{
  if(refreshInFlight===run)refreshInFlight=null;
  if(lifecycle!==roomLifecycleVersion)return;
  if(refreshQueued&&room?.id===roomId){
   const queuedSilent=refreshQueuedSilent;
   refreshQueued=false;refreshQueuedSilent=true;
   Promise.resolve().then(()=>refreshRoom(queuedSilent));
  }else if(!room||room.id!==roomId){refreshQueued=false;refreshQueuedSilent=true}
 }
}
async function leaveRoom(){
 if(!room)return;
 const leavingRoom=room,leavingUser=user;
 if(window.__SUWAD_ACTIVE_GAME?.mode==="online")window.__SUWAD_ACTIVE_GAME=null;
 window.SuwadOrasCommentator?.stop();
 stopOnlineWheelMotion();
 if(wheelFinishTimer){clearTimeout(wheelFinishTimer);wheelFinishTimer=null}
 roomLifecycleVersion++;refreshInFlight=null;
 if(channel)db.removeChannel(channel);
 channel=null;
 if(reactionChannel)db.removeChannel(reactionChannel);
 reactionChannel=null;reactionChannelReady=false;if(roomTimerInterval){clearInterval(roomTimerInterval);roomTimerInterval=null}
 if(refreshTimer){clearTimeout(refreshTimer);refreshTimer=null}
 refreshQueued=false;refreshQueuedSilent=true;lastRenderedRoomFingerprint="";
 if(poll)clearInterval(poll);
 poll=null;
 if(heartbeat)clearInterval(heartbeat);
 heartbeat=null;
 room=null;players=[];tournament=null;tournamentScores=[];
 history.replaceState({}, "",location.pathname+location.hash);
 const backdrop=$("#modalBackdrop");if(backdrop)backdrop.hidden=true;
 document.body.style.overflow="";
 toast("غادرت واجهة الغرفة؛ تگدر ترجع لنفس المقعد من رابط الدعوة.");
 if(leavingUser){
  try{
   const result=await db.rpc("leave_game_room",{p_room_id:leavingRoom.id});
   if(result.error)throw result.error;
  }catch(e){
   console.warn("leaveRoom presence update failed",e);
   toast("خرجت من الواجهة، لكن تعذّر تحديث حالة اتصال اللاعب: "+roomErrorText(e));
  }
 }
}
window.addEventListener("online",()=>{if(room){heartbeatRoom().then(scheduleRoomRefresh).catch(showError)}});
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&room){heartbeatRoom().then(scheduleRoomRefresh).catch(showError)}});


const roomTutorialArt={"who":[["🗂️","١. اختار الفئة",["🐾 الحيوانات","🎮 شخصيات الألعاب"]],["💬","٢. اكتب سؤالاً",["سؤال يناسب الفئة المختارة","مثال يتغير حسب الفئة"]],["🧠","٣. سجّل التلميح",["نعم","لا","أحتاج تلميح"]],["🎯","٤. ثبّت التخمين",["اختار الاسم","ثبّت تخميني"]]],"number":[["🔢","١. الرقم بين ١ و١٠٠",["١","٥٠","١٠٠"]],["⌨️","٢. أدخل تخمينك",["اكتب ٤٠","خمّن"]],["📈","٣. اقرأ التلميح",["أعلى","أقل"]],["🏆","٤. أصب الرقم",["رقم صحيح","محاولاتك"]]],"liar":[["👥","١. اكتبوا الأسماء",["علي","حسن","زهراء"]],["🔒","٢. مرّروا الجهاز",["لا تطالع الشاشة","اكشف بطاقتك"]],["🤫","٣. شاهد دورك",["الكلمة السرية","أو: أنت الكذّاب"]],["🗣️","٤. أعطوا تلميحاً",["من دون ذكر الكلمة","ناقشوا"]],["🗳️","٥. صوّتوا",["اختاروا المشتبه به","اكشفوا النتيجة"]]],"most":[["👥","١. أدخل أسماء الربع",["لاعب ١","لاعب ٢","لاعب ٣"]],["❓","٢. اقرأوا العبارة",["منو الأكثر احتمالاً؟","يتأخر على اللمة"]],["🗳️","٣. كل لاعب يصوّت",["اختار اسماً","صوّت له"]],["🏆","٤. شاهدوا الترتيب",["الأصوات","النتيجة"]]],"yesno":[["🙋","١. اختاروا اللاعب",["الدور على علي","مرّروا الجهاز"]],["❓","٢. اقرأ السؤال",["تحب السفر؟","جاوب بسرعة"]],["🚫","٣. تجنّب الكلمتين",["إي ✕","لا ✕"]],["✅","٤. احكموا على الإجابة",["نجا + نقطة","انكشف"]]],"snakes":[["🎲","١. ارْمِ النرد",["١","٢","٣","٤","٥","٦"]],["🔢","٢. تحرّك بالمربعات",["مكانك","خطوات النرد"]],["🪜","٣. اصعد الدرج",["بداية الدرج","نهاية أعلى"]],["🐍","٤. احذر الحيّة",["وقعت هنا","ارجع للخلف"]]],"domino":[["🁣","١. استلم قطعك",["٦ | ٦","٤ | ٢","٣ | ١"]],["🔗","٢. طابق الطرف",["طرف ٦","٦ | ٢"]],["🖐️","٣. اسحب عند الحاجة",["ما عندك تطابق؟","اسحب قطعة"]],["🏆","٤. خلّص قطعك",["آخر قطعة","فوز الجولة"]]],"tavla":[["🎲","١. ارْمِ النرد",["٣","٥"]],["⚫","٢. اختار قطعة إلك",["قطعتك","نقطة البداية"]],["➜","٣. حرّك حسب النرد",["٣ + ٥","نقطة الوصول"]],["👥","٤. بدّلوا الأدوار",["أنت","الخصم"]]],"colors":[["🃏","١. استلم سبع كروت",["أحمر ٢","أزرق ٤","أخضر ١"]],["🎨","٢. طابق اللون",["الكرت الظاهر","نفس اللون"]],["🔢","٣. أو طابق الرقم",["رقم ٤","رقم ٤"]],["🏆","٤. خلّص كروتك",["آخر كرت","فزت!"]]],"quiz":[["🧠","١. اقرأ السؤال",["شنو عاصمة العراق؟"]],["⌨️","٢. اكتب الإجابة",["بغداد","إرسال"]],["💬","٣. ناقشوا الإجابة",["قارنوا الإجابات","احسبوا النقاط"]],["⏭️","٤. انتقل للسؤال التالي",["السؤال ٢","جولة جديدة"]]]};
function prepareRoomTutorial(key){
 if(roomTutorialKey!==key){
  roomTutorialKey=key;roomTutorialStep=0;
  roomTutorialOpen=key!=="wheel"&&!localStorage.getItem("sw_online_tutorial_seen_"+key);
 }
}
roomTutorialArt.wheel=[["🎡","دولاب التحدي أونلاين",["كل اللاعبين يشوفون نفس الدولاب","المضيف يلف"]]];
function roomTutorialPicture(key,step){
 const list=roomTutorialArt[key]||roomTutorialArt.who,item=list[Math.min(step,list.length-1)]||list[0];
 return '<div class="tutorial-picture" role="img" aria-label="'+esc(item[1])+'"><div class="tutorial-picture-main"><span>'+item[0]+'</span><b>'+esc(item[1])+'</b></div><div class="tutorial-picture-items">'+item[2].map(x=>'<span>'+esc(x)+'</span>').join("")+'</div><div class="tutorial-picture-caption">رسم توضيحي للخطوة الحالية</div></div>';
}
const gameGuides={
who:{title:"خمّن منو آني؟",visual:"🧐💭",goal:"اعرف الشخصية أو الشيء اللي مختاره اللاعبون قبل غيرك.",steps:["اختاروا فئة مثل الحيوانات أو الدول أو شخصيات الألعاب.","بالتناوب اسأل سؤالاً جوابه نعم أو لا، ويكون مرتبطاً بالفئة المختارة. لا تستخدم صفات الحيوانات مع الدول أو الشخصيات.","ضيّق الاحتمالات بأسئلتك، وبعدها اكتب تخمينك.","اتفقوا على احتساب نقطة للتخمين الصحيح؛ هذا الإصدار يحتاج تطوير نظام البطاقة السرية حتى يصير تلقائياً بالكامل."],mode:"طور تخمين جماعي مبسّط."},
number:{title:"تخمين الرقم",visual:"🔢🎯",goal:"اكتشف الرقم السري بين ١ و١٠٠.",steps:["المضيف يبدأ الجولة ويظهر رقم سري مشترك.","كل لاعب يكتب تخمينه بالدور.","قارنوا التخمينات بالرقم السري؛ الأقرب أو من يصيبه يفوز.","ملاحظة: التلميحات التلقائية (أكبر/أصغر) والنتائج التفصيلية بعدّ المحاولات مو مفعّلة بالكامل حالياً."],mode:"تحدّي تخمين سريع."},
liar:{title:"منو الكذّاب؟ / برا السالفة",visual:"🤥🕵️",goal:"اكتشف اللاعب اللي ما يعرف الموضوع الحقيقي.",steps:["تتوزع كلمة سرية تلقائياً على اللاعبين، بينما يحصل لاعب واحد على بطاقة الكذّاب من دون معرفة الكلمة.","كل لاعب يكتب تلميحاً قصيراً لا يكشف الكلمة مباشرة؛ الكذّاب يحاول يندمج بتلميح مقنع.","بعد اكتمال التلميحات، المضيف ينقل الجولة إلى التصويت، وكل لاعب يصوّت على شخص آخر.","حالياً توزيع الأدوار والتلميحات والتصويت موجودة؛ كشف النتيجة واحتساب نقاط الفوز يحتاجان استكمالاً."],mode:"طور خداع وتصويت سري."},
most:{title:"منو الأكثر؟",visual:"👀😂",goal:"اختاروا اللاعب الأنسب للسؤال، وشوفوا اتفاق المجموعة.",steps:["اقرأوا السؤال الظاهر، مثل: منو أكثر واحد يتأخر؟","كل لاعب يكتب اسم الشخص أو يصوّت عليه.","اعرضوا الإجابات واحتسبوا النقاط باتفاقكم.","الأسئلة تتغيّر بين الجولات؛ التصويت الآلي والنتيجة النهائية ما زالا مبسّطين."],mode:"طور تصويت وضحك."},
yesno:{title:"ممنوع إي ولا",visual:"🙊🎙️",goal:"جاوب من دون ما تستخدم كلمات الموافقة أو الرفض الممنوعة.",steps:["يطرح لاعب سؤالاً على اللاعب صاحب الدور.","اكتب جوابك بسرعة من دون كلمات «إي» أو «لا» أو «نعم».","النظام يفحص النص ويضيف أو يخصم النقاط تلقائياً حسب الكلمات الممنوعة؛ ما يحلل الصوت المباشر.","تجنّب التحايل بتغيير الكتابة؛ فحص اللهجات والتهجئات البديلة يحتاج توسيعاً."],mode:"تحدّي نصّي مع احتساب آلي أولي."},
snakes:{title:"حيّة ودرج",visual:"🐍🪜🎲",goal:"وصل إلى المربع ١٠٠ قبل باقي اللاعبين.",steps:["بداية الجولة: كل لاعب يحصل على رمية نرد؛ أعلى نتيجة يبدأ، والمتعادلون يعيدون الرمية حتى ينحسم التعادل.","بدورك ارْمِ النرد وتحرك بعدد المربعات على اللوحة المتعرجة من ١ إلى ١٠٠.","إذا وقفت بالضبط على بداية سلّم تصعد إلى نهايته؛ وإذا وقفت على رأس حيّة تنزل إلى ذيلها. المرور فوقهما أو الوقوف بمنتصفهما ما يغيّر موقعك.","كل رمية ٦ تمنحك رمية إضافية؛ إذا طلعت ٦ ثلاث مرات متتالية تُلغى حركة الثالثة وينتقل الدور.","الفوز بالوصول إلى ١٠٠ بالضبط؛ إذا تجاوزتها ترتد للخلف بعد بلوغ ١٠٠. يمكن لأكثر من لاعب الوقوف بالمربع نفسه."],mode:"لوحة مشتركة، من لاعبين إلى ٦. تتولد ١٠ حيّات و٩ سلالم لكل جولة."},
domino:{title:"دومينوا",visual:"🁣🁤",goal:"تخلّص من قطعك بمطابقة الأرقام عند طرفي السلسلة.",steps:["تُستخدم مجموعة مزدوجة ستة: لاعبان يحصل كل منهما على ٧ قطع ويبقى ١٤ للسحب؛ ثلاثة لاعبين يحصل كل منهم على ٩ قطع مع استبعاد (٠|٠) ومن دون مخزون؛ أربعة لاعبين يحصل كل منهم على ٧ قطع وتُوزّع القطع الـ٢٨ كلها.","يبدأ صاحب أعلى دبل؛ وإذا ماكو دبل يبدأ صاحب أعلى قطعة حسب ترتيب المقارنة.","بدورك طابق أحد طرفي السلسلة. إذا ما عندك قطعة مناسبة اسحب من المخزون؛ وما يصير تمرّر والمخزون بعده بيه قطع.","إذا خلّص لاعب قطعه يفوز. وإذا انسد اللعب بعد نفاد المخزون ومرور الجميع، يفوز الأقل مجموعاً بالنقاط على قطعه؛ والتعادل يُسجل تعادلاً."],mode:"دومينو مزدوج ستة من لاعبين إلى ٤، والقطع الخاصة مخفية عن الخصوم."},
tavla:{title:"الطاولي الأصلية",visual:"🎲⚫⚪",goal:"أخرج أحجارك الخمسة عشر قبل خصمك مع حماية نقاطك وضرب أحجاره المنفردة.",steps:["تبدأ اللعبة بـ١٥ حجراً لكل لاعب على الترتيب التقليدي في النقاط الأربع الخاصة بكل لاعب.","في رمية الافتتاح يرمي كل لاعب نرداً واحداً؛ الأعلى يبدأ ويستخدم الرقمين. إذا تعادلت الرمية يعاد رمي النرد حتى يظهر فرق.","بعد الافتتاح يرمي اللاعب نردين في دوره. إذا ظهر دبل، يلعب الرقم نفسه أربع مرات. استخدم كل الحركات الممكنة، وإذا لم تبقَ حركة قانونية ينتقل الدور.","تحرك باتجاه بيتك. لا تدخل نقطة فيها حجران للخصم أو أكثر؛ وإذا كانت فيها قطعة واحدة فقط تضربها وترسلها إلى البار.","إذا كان عندك حجر بالبار، يجب إدخاله أولاً من جهة الخصم بحسب رقم النرد، ولا تحرك أي حجر آخر قبل إدخال جميع أحجار البار.","بعد وصول أحجارك الخمسة عشر كلها إلى بيتك، ابدأ إخراجها. استخدم الرقم المطابق، ويُسمح بالرقم الأكبر فقط إذا لم يبقَ حجر أبعد عن المخرج.","أول لاعب يخرج أحجاره الخمسة عشر يفوز. أسماء النرد: يَك، دو، سِه، چهار، پَنج، شِش؛ والدبل له تسميات خاصة تظهر مع الرمية."],mode:"طاولي قياسية للاعبين، بترتيب البداية والضرب والبار والإخراج."},
colors:{title:"UNO الكلاسيكية الأصلية",visual:"🟥🟦🟩🟨",goal:"تخلّص من كروتك واجمع نقاط كروت الخصوم حتى تصل إلى ٥٠٠ نقطة.",steps:["المجموعة الكلاسيكية ١٠٨ كروت: أرقام وألوان، تخطي، عكس، +٢، وأربع كروت حرة وأربع +٤. كل لاعب يبدأ بسبع كروت.","طابق اللون أو الرقم أو الرمز. إذا ما عندك كرت مناسب اسحب كرتاً واحداً، ويجوز لعب الكرت المسحوب فوراً إذا كان مناسباً؛ وإذا اخترت السحب رغم امتلاك كرت مناسب فلا تلعب غير الكرت المسحوب في ذلك الدور.","+٢ يجعل اللاعب التالي يسحب كرتين ويفقد دوره. التخطي يفوّت دور التالي، والعكس يغيّر اتجاه اللعب. لا يوجد تكديس للعقوبات في القواعد الكلاسيكية.","الكرت الحر يختار اللون. +٤ لا يجوز لعبه إذا كان بيدك كرت من اللون الحالي؛ ويحق للاعب المستهدف تحدّي قانونية لعبه. إذا كان غير قانوني يسحب صاحبه ٤، وإذا كان قانونياً يسحب المتحدي ٦ ويفقد دوره.","عندما تلعب الكرت قبل الأخير يجب أن تنادي UNO. إذا لم تفعل وتم اصطيادك قبل بدء دور اللاعب التالي، تسحب كرتين. لا توجد بطاقة تبديل أيدي في المجموعة الكلاسيكية.","تنتهي الجولة عند نفاد يد لاعب؛ تُحسب نقاط كروت الخصوم: الأرقام بقيمتها، وأوراق الحركة ٢٠، والكروت الحرة و+٤ بقيمة ٥٠. أول من يصل إلى ٥٠٠ نقطة يفوز بالمباراة."],mode:"القواعد الكلاسيكية من لاعبين إلى ١٠؛ لا تكديس ولا تبديل أيدي ولا قواعد منزلية."},
quiz:{title:"تحدّي الأسئلة",visual:"🧠❓",goal:"جاوب عن السؤال بشكل صحيح وتنافس مع أصدقائك.",steps:["اقرأ السؤال الظاهر داخل اللوحة.","اكتب إجابتك واضغط إرسال الإجابة.","النظام يصحح الإجابة ويضيف نقطة للإجابة الصحيحة تلقائياً.","الموجود حالياً ثلاث أسئلة فقط؛ يحتاج بنك أسئلة أوسع وتصنيفات ومستويات صعوبة."],mode:"طور معلومات عامة بتصحيح آلي محدود."}
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
window.__SUWAD_ACTIVE_ROOM=()=>room?({id:room.id,room_code:room.room_code,room_name:room.room_name,status:room.status}):null;
window.joinSuwadOnlineRoom=(code)=>joinRoom(code);
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
