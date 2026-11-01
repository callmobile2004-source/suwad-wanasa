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
function toast(t){const x=$("#toast");if(x){x.textContent=t;x.classList.add("show");setTimeout(()=>x.classList.remove("show"),3000)}else alert(t)}
function show(html){const b=$("#modalBackdrop"),c=$("#modalContent");if(!b||!c)return;c.innerHTML=html;b.hidden=false;document.body.style.overflow="hidden";$("#modalClose").onclick=close}
function close(){const b=$("#modalBackdrop");if(b)b.hidden=true;document.body.style.overflow=""}
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
 if(code==="42501"||/row-level security|permission denied|not allowed/i.test(m))return "صلاحيات قاعدة البيانات تمنع إنشاء الغرفة أو تسجيل اللاعب. أعد تشغيل ملف supabase-schema.sql كاملاً في SQL Editor.";
 if(/game_rooms|game_room_players|create_game_room|join_game_room|update_game_room_state|schema cache|relation .* does not exist|could not find the table/i.test(m))return "تحديث أمان الغرف غير مطبّق بعد. شغّل supabase-room-security-migration.sql مرة واحدة في SQL Editor.";
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
function setState(next,extra={}){
 return db.rpc("update_game_room_state",{
  p_room_id:room.id,p_game_state:next,
  p_status:extra.status??null,p_game_key:extra.game_key??null,
  p_expected_updated_at:room.updated_at??null
 });
}
async function startGameOnline(){if(!isHost())return toast("بس الهوست يگدر يبدأ اللعبة.");if(players.length<games[room.game_key].min)return toast("بعدكم مو مكتملين: دخل "+players.length+" من "+games[room.game_key].min+" لاعبين مطلوبين. شارك كود الغرفة وانتظر اللاعب الثاني.");let state={phase:"playing",round:1,turn:0,scores:Object.fromEntries(players.map(p=>[p.user_id,0])),feed:["بدأت اللعبة!"],board:null};const k=room.game_key;if(k==="snakes")state.board={positions:players.map(()=>0),dice:null,finished:null};if(k==="domino")state.board=makeDominoBoard();if(k==="tavla")state.board={positions:players.map((p,i)=>Array.from({length:15},(_,j)=>({point:(i===0?[0,11,16,18][j%4] : [23,12,7,5][j%4]),id:j}))),dice:[],selected:null,moves:0};if(k==="colors"){const deck=shuffle(Array.from({length:60},(_,i)=>({c:["أحمر","أزرق","أخضر","أصفر"][i%4],v:["١","٢","٣","٤","تخطي"][Math.floor(i/4)%5]})));const hands={};players.forEach(p=>hands[p.user_id]=deck.splice(0,7));state.board={deck,discard:[deck.pop()],hands,turn:0};}if(k==="quiz")state.board={question:0,answers:{}};if(k==="number")state.board={secret:Math.floor(Math.random()*100)+1,tries:{}};if(k==="liar")state.board={question:"كل لاعب يكتب تلميحاً عن الموضوع الظاهر، وصوّتوا بعدها على المشتبه به.",hints:{},votes:{}};if(k==="most")state.board={question:0,votes:{}};if(k==="yesno")state.board={question:0,answers:{}};if(k==="who")state.board={question:0,guesses:{}};if(k==="wheel")state.board={rotation:0,result:null,spins:0};const r=await setState(state,{status:"playing"});if(r.error)throw r.error;room={...room,game_state:state,status:"playing"};}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function makeDominoBoard(){const all=[];for(let a=0;a<=6;a++)for(let b=a;b<=6;b++)all.push([a,b]);shuffle(all);const hands={};players.forEach((p,i)=>hands[p.user_id]=all.splice(0,Math.max(5,Math.floor(28/players.length))));return {hands,chain:[],turn:0,draw:all,ended:false}}
const ladders={3:22,8:30,20:41,27:56,50:67,71:91,80:99},snakes={17:4,34:12,62:19,87:24,95:75,99:78};
const questions=["منو أكثر واحد يتأخر على اللمة؟","شنو أحلى سفرة تتمنّاها؟","منو يضحك أسرع واحد؟","شنو أكلة ما تملّ منها؟","منو أكثر واحد محظوظ؟","إذا ربحت مليون، شنو أول شي تشتريه؟"];
function roomScreen(){
 if(!room)return;
 const g=games[room.game_key],host=isHost(),mine=mePlayer(),state=room.game_state||{phase:"lobby",feed:[]};
 prepareRoomTutorial(room.game_key);
 const guide=roomTutorialOpen?guideMarkup(room.game_key,roomTutorialStep):"";
 let body='<div class="online-room-head"><div><span class="pill">'+(state.phase==="playing"?"اللعبة شغالة":"غرفة أونلاين")+'</span><h2 id="modalTitle">'+g.icon+" "+esc(room.room_name)+'</h2><p class="modal-lead">'+esc(g.name)+' • '+players.length+'/'+room.max_players+' لاعبين</p><button class="btn btn-ghost" id="toggleGameGuide" aria-expanded="'+String(roomTutorialOpen)+'">📖 شرح مصوّر وصوتي</button></div><button class="audio-close" id="leaveRoom" aria-label="مغادرة">×</button></div><div id="gameGuidePanel" class="game-guide-panel" '+(roomTutorialOpen?"":"hidden")+'>'+guide+'</div>'+inviteBox()+'<div class="room-player-list"><h3>اللاعبون</h3>'+players.map((p,i)=>'<div class="friend-row"><span class="friend-avatar">'+(i+1)+'</span><span>'+esc(p.display_name)+(p.user_id===room.host_id?' <small>المضيف</small>':'')+'</span><b>'+(p.user_id===user.id?'إنت':'متصل')+'</b></div>').join("")+'</div>';
 if(state.phase==="finished")body+='<div class="question-panel"><h3>🏁 انتهت الجولة!</h3><p>يگدر المضيف يبدأ جولة جديدة.</p></div>';
 else if(state.phase!=="playing"){
 const min=games[room.game_key].min,missing=Math.max(0,min-players.length),full=players.length>=room.max_players;
 body+='<div class="room-readiness"><b>اللاعبون داخل الغرفة: '+players.length+' من '+room.max_players+'</b><p>'+(missing>0?'حتى تبدأ '+esc(g.name)+' تحتاج '+missing+' لاعب '+(missing===1?'إضافي':'إضافيين')+'. انسخ كود الغرفة وارسله لربعك.':'اكتمل العدد المطلوب؛ الهوست يگدر يبدأ اللعب هسه.')+'</p>'+(full&&missing>0?'<small>الغرفة وصلت سعتها المحددة، غيّر عدد اللاعبين إذا تحتاج أكثر.</small>':'')+'</div><p class="muted-note">كود الغرفة ورابط الدعوة والـ QR موجودة أعلاه. اللاعب الثاني يفتح الرابط أو يدخل الكود من زر «انضم إلى غرفة».</p>'+(host?'<button class="btn btn-gold full-btn" id="startOnlineGame" '+(missing>0?'disabled':'')+'>'+(missing>0?'بانتظار '+missing+' لاعب إضافي':'ابدأ اللعبة')+'</button>':'<p class="hint-box">ننتظر المضيف يبدأ اللعبة بعد اكتمال العدد…</p>');
 if(room.game_key==="wheel")body+=renderGame(g,state,mine,host);
 }
 else body+=renderGame(g,state,mine,host);
 body+='<div class="room-bottom-actions"><button class="btn btn-ghost" id="refreshRoom">تحديث</button>'+(host&&(state.phase==="playing"||state.phase==="finished")?'<button class="btn btn-ghost" id="restartOnlineGame">إعادة الجولة</button>':'')+'</div>';
 show(body);
 $("#copyRoomCode").onclick=()=>copy(room.room_code);$("#copyRoomLink").onclick=()=>copy(roomLink(room.room_code));$("#leaveRoom").onclick=leaveRoom;$("#refreshRoom").onclick=refreshRoom;
 const guideBtn=$("#toggleGameGuide");
 if(guideBtn)guideBtn.onclick=()=>{
  roomTutorialOpen=!roomTutorialOpen;
  localStorage.setItem("sw_online_tutorial_seen_"+room.game_key,"1");
  roomScreen();
 };
 const panel=$("#gameGuidePanel");
 if(panel&&roomTutorialOpen){
  const gdoc=gameGuides[room.game_key]||gameGuides.who,step=Math.min(roomTutorialStep,gdoc.steps.length-1);
  const prev=$("#guidePrev"),next=$("#guideNext"),say=$("#speakGameGuide"),all=$("#speakFullGameGuide"),stop=$("#stopGameGuide");
  if(prev)prev.onclick=()=>{roomTutorialStep=Math.max(0,step-1);roomScreen()};
  if(next)next.onclick=()=>{roomTutorialStep=step===gdoc.steps.length-1?0:step+1;localStorage.setItem("sw_online_tutorial_seen_"+room.game_key,"1");roomScreen()};
  if(say)say.onclick=()=>speakGuide(room.game_key,false);
  if(all)all.onclick=()=>speakGuide(room.game_key,true);
  if(stop)stop.onclick=()=>{if("speechSynthesis"in window)speechSynthesis.cancel()};
 }
 if($("#startOnlineGame"))$("#startOnlineGame").onclick=async()=>{const b=$("#startOnlineGame");if(b)b.disabled=true;try{await startGameOnline();await refreshRoom()}catch(e){showError(e)}finally{const current=$("#startOnlineGame");if(current&&room&&room.game_state?.phase!=="playing")current.disabled=players.length<games[room.game_key].min}};
 if($("#restartOnlineGame"))$("#restartOnlineGame").onclick=()=>startGameOnline().catch(showError);
 wireGame(g,state,mine);
}
function renderGame(g,s,mine,host){const b=s.board||{},myTurn=players[s.turn]?.user_id===user?.id;let h='<div class="online-game-board"><h3>🎮 '+esc(g.name)+'</h3><p class="turn-banner">'+(myTurn?'دورك هسه!':"الدور على "+esc(players[s.turn]?.display_name||"اللاعب التالي"))+'</p>';
if(room.game_key==="wheel"){const chosen=b.result?games[b.result]?.name||"اختيار جديد":"بانتظار أول لفة";h+='<div class="question-panel online-wheel-panel"><div class="online-wheel-visual" style="transform:rotate('+Number(b.rotation||0)+'deg)"><span>🎡</span></div><h3>'+esc(chosen)+'</h3><p>كل الموجودين يشوفون نفس النتيجة. الهوست وحده يلف الدولاب.</p><button class="btn btn-gold full-btn" id="spinOnlineWheel" '+(!host?"disabled":"") +'>لفّ الدولاب المشترك ✦</button>'+(b.result&&host?'<button class="btn btn-ghost full-btn" id="chooseOnlineWheelResult">اعتمد اللعبة المختارة وابدأ الغرفة</button>':'')+'</div>'}if(room.game_key==="snakes"){h+='<div class="snakes-board">'+Array.from({length:100},(_,i)=>{const n=100-i;const pos=b.positions||[];return '<div class="snake-cell '+(ladders[n]?'ladder-cell':snakes[n]?'snake-cell-mark':'')+'"><b>'+n+'</b>'+(pos.map((p,j)=>p===n?'<i title="'+esc(players[j]?.display_name||"")+'">'+esc((players[j]?.display_name||"?").slice(0,1))+'</i>':"").join(""))+'</div>'}).join("")+'</div><p class="muted-note">الدرج: ٣، ٨، ٢٠، ٢٧، ٥٠، ٧١، ٨٠. الحيّات ترجعك للخلف.</p><button class="btn btn-gold full-btn" id="rollSnake" '+(!myTurn?'disabled':'')+'>🎲 ارمي النرد</button><p>آخر رمية: '+(b.dice??"—")+'</p>'}
if(room.game_key==="domino"){const chain=b.chain||[],hand=b.hands?.[user?.id]||[];h+='<p>السلسلة: <strong class="domino-chain">'+(chain.length?chain.map(t=>t[0]+"|"+t[1]).join("  ·  "):"ابدأ بأي قطعة")+'</strong></p><p>قطعك ('+hand.length+') — هذا طور مفتوح لسهولة اللعب الجماعي؛ القطع ظاهرة للاعبين.</p><div class="domino-hand">'+hand.map((t,i)=>'<button class="domino-tile" data-domino="'+i+'" '+(!myTurn?'disabled':'')+'><b>'+t[0]+'</b><i></i><b>'+t[1]+'</b></button>').join("")+'</div><button class="btn btn-ghost full-btn" id="drawDomino" '+(!myTurn||!b.draw?.length?'disabled':'')+'>اسحب قطعة</button>'}
if(room.game_key==="tavla"){h+='<p>طاولي مبسّطة: ارمي النرد ثم اختار إحدى قطعك لتحريكها. الاتجاه يظهر حسب دورك.</p><div class="tavla-track">'+Array.from({length:24},(_,i)=>'<button class="tavla-point" data-point="'+i+'"><b>'+i+'</b><span>'+((b.positions||[]).flat().filter(p=>p.point===i).length)+'</span></button>').join("")+'</div><p>نتيجة النرد: '+(b.dice?.join(" + ")||"—")+'</p><button class="btn btn-gold full-btn" id="rollTavla" '+(!myTurn||b.dice?.length?'disabled':'')+'>ارمِ النرد</button>'}
if(room.game_key==="colors"){h+='<p>كروت الألوان: حاول تطابق اللون أو الرقم.</p><p>اللون الحالي: '+esc(b.discard?.at(-1)?.c||"اختار أول كارت")+'</p><div class="domino-hand">'+(b.hands?.[user?.id]||[]).map((c,i)=>'<button class="color-card color-'+["أحمر","أزرق","أخضر","أصفر"].indexOf(c.c)+'" data-color="'+i+'" '+(!myTurn?'disabled':'')+'>'+esc(c.c)+'<b>'+esc(c.v)+'</b></button>').join("")+'</div>'}
if(["most","yesno","quiz","who","liar","number"].includes(room.game_key)){const prompts=room.game_key==="most"?questions:room.game_key==="yesno"?["هل تحب السفر؟","هل تگدر تعيش يوم بلا موبايل؟","هل تعتبر نفسك محظوظ؟"]:room.game_key==="quiz"?["شنو عاصمة العراق؟","كم عدد أيام الأسبوع؟","شنو أكبر كوكب بالمجموعة الشمسية؟"]:room.game_key==="who"?["خمّن الشخصية السرية: هل هي من عالم الحيوانات؟","اكتب تخمينك للشخصية"]:room.game_key==="liar"?[b.question||"اكتب تلميحك"]:["خمّن الرقم بين ١ و١٠٠"];const prompt=prompts[(b.question||0)%prompts.length];h+='<div class="question-panel"><span>الجولة '+(s.round||1)+'</span><h3>'+esc(prompt)+'</h3>'+(room.game_key==="number"?'<input id="onlineGuess" type="number" min="1" max="100" placeholder="رقم من ١ إلى ١٠٠">':room.game_key==="liar"?'<input id="onlineHint" maxlength="80" placeholder="اكتب تلميحك">':room.game_key==="who"?'<input id="onlineGuess" maxlength="80" placeholder="اكتب تخمينك">':'<input id="onlineAnswer" maxlength="120" placeholder="اكتب إجابتك أو تصويتك">')+'<button class="btn btn-gold full-btn" id="submitOnlineAnswer" '+(s.phase!=="playing"?'disabled':'')+'>إرسال الإجابة</button><div class="room-feed">'+(s.feed||[]).slice(-8).map(x=>'<p>'+esc(x)+'</p>').join("")+'</div><button class="btn btn-ghost full-btn" id="nextOnlineRound" '+(!host?'disabled':'')+'>السؤال التالي</button></div>'}
h+='</div>';return h}
function wireGame(g,s,mine){const b=s.board||{},myTurn=players[s.turn]?.user_id===user?.id;
if($("#chooseOnlineWheelResult"))$("#chooseOnlineWheelResult").onclick=async()=>{if(!isHost()||!b.result)return;const next={phase:"lobby",round:0,turn:0,feed:["اختار الدولاب لعبة "+games[b.result].name],scores:{},board:null};const r=await setState(next,{game_key:b.result,status:"waiting"});if(r.error)showError(r.error);else{room={...room,game_key:b.result,game_state:next,status:"waiting"};await refreshRoom()}};
 if($("#spinOnlineWheel"))$("#spinOnlineWheel").onclick=async()=>{if(!isHost())return;const choices=["who","number","liar","yesno","most","snakes","domino","tavla","colors","quiz"],result=choices[Math.floor(Math.random()*choices.length)],rotation=Number(b.rotation||0)+360*(7+Math.floor(Math.random()*3))+Math.floor(Math.random()*360);const next={...s,phase:"playing",board:{...b,result,rotation,spins:(b.spins||0)+1},feed:[...(s.feed||[]),nick()+" لفّ الدولاب واختار "+games[result].name]};const r=await setState(next,{status:"waiting"});if(r.error)showError(r.error);else{room={...room,game_state:next};await refreshRoom()}};
if($("#rollSnake"))$("#rollSnake").onclick=async()=>{if(!myTurn)return;const die=1+Math.floor(Math.random()*6),pos=[...(b.positions||[])],old=pos[s.turn],step=old+die;let next=step>100?old:step;next=ladders[next]||snakes[next]||next;pos[s.turn]=next;const fin=next===100?s.turn:null;await setState({...s,turn:fin===null?(s.turn+1)%players.length:s.turn,board:{...b,positions:pos,dice:die,finished:fin},phase:fin===null?"playing":"finished",feed:[...(s.feed||[]),esc(players[s.turn].display_name)+" رمى "+die+" ووصل "+next]},{status:fin===null?"playing":"finished"}).then(r=>{if(r.error)showError(r.error)})};
if($("#drawDomino"))$("#drawDomino").onclick=async()=>{const draw=[...(b.draw||[])],hands={...b.hands},hand=[...(hands[user.id]||[])];if(!draw.length)return toast("خلصت القطع");hand.push(draw.pop());hands[user.id]=hand;await setState({...s,board:{...b,draw,hands},feed:[...(s.feed||[]),nick()+" سحب قطعة"]}).then(r=>r.error&&showError(r.error))};
document.querySelectorAll("[data-domino]").forEach(el=>el.onclick=async()=>{const hand=[...(b.hands?.[user.id]||[])],tile=hand[Number(el.dataset.domino)],chain=[...(b.chain||[])];if(!tile||!myTurn)return;if(chain.length){const left=chain[0][0],right=chain.at(-1)[1];let side="right";if(tile[0]===right){}else if(tile[1]===right){tile.reverse()}else if(tile[1]===left){tile.reverse();side="left"}else if(tile[0]===left){side="left"}else return toast("هاي القطعة ما تطابق طرف السلسلة.");if(side==="left")chain.unshift(tile);else chain.push(tile)}else chain.push(tile);hand.splice(Number(el.dataset.domino),1);const hands={...b.hands,[user.id]:hand};const win=hand.length===0;await setState({...s,phase:win?"finished":"playing",turn:(s.turn+1)%players.length,board:{...b,hands,chain},feed:[...(s.feed||[]),nick()+" لعب "+tile.join("|")]},{status:win?"finished":"playing"}).then(r=>r.error&&showError(r.error))});
if($("#rollTavla"))$("#rollTavla").onclick=async()=>{const dice=[1+Math.floor(Math.random()*6),1+Math.floor(Math.random()*6)];await setState({...s,board:{...b,dice,selected:null},feed:[...(s.feed||[]),nick()+" رمى "+dice.join(" و ")]}).then(r=>r.error&&showError(r.error))};
document.querySelectorAll("[data-point]").forEach(el=>el.onclick=async()=>{if(!myTurn||!b.dice?.length)return;const point=Number(el.dataset.point),pos=(b.positions||[]).map(a=>a.map(p=>({...p}))),minePieces=pos[s.turn]||[];if(b.selected===null||b.selected===undefined){const piece=minePieces.find(p=>p.point===point);if(!piece)return toast("اختار نقطة بيها قطعة إلك.");await setState({...s,board:{...b,positions:pos,selected:point}}).then(r=>r.error&&showError(r.error));return}const die=b.dice[0],dest=room.game_key==="tavla"?(s.turn===0?b.selected+die:b.selected-die):point;if(point!==dest)return toast("الوجهة لازم تطابق حركة النرد ("+dest+").");const piece=minePieces.find(p=>p.point===b.selected);if(!piece)return;piece.point=dest;const rest=b.dice.slice(1);await setState({...s,turn:rest.length?s.turn:(s.turn+1)%players.length,board:{...b,positions:pos,dice:rest,selected:null},feed:[...(s.feed||[]),nick()+" حرّك قطعة إلى "+dest]},{status:"playing"}).then(r=>r.error&&showError(r.error))});
document.querySelectorAll("[data-color]").forEach(el=>el.onclick=async()=>{if(!myTurn)return;const hands={...b.hands},hand=[...(hands[user.id]||[])],card=hand[Number(el.dataset.color)],top=b.discard?.at(-1);if(!card)return;if(top&&card.c!==top.c&&card.v!==top.v)return toast("اختار كارت يطابق اللون أو الرقم.");hand.splice(Number(el.dataset.color),1);hands[user.id]=hand;await setState({...s,phase:hand.length?"playing":"finished",turn:(s.turn+1)%players.length,board:{...b,hands,discard:[...(b.discard||[]),card]},feed:[...(s.feed||[]),nick()+" لعب كارت "+card.c+" "+card.v]},{status:hand.length?"playing":"finished"}).then(r=>r.error&&showError(r.error))});
if($("#submitOnlineAnswer"))$("#submitOnlineAnswer").onclick=async()=>{const input=$("#onlineGuess")||$("#onlineHint")||$("#onlineAnswer"),val=input?.value.trim();if(!val)return toast("اكتب إجابتك أولاً.");const feed=[...(s.feed||[]),nick()+": "+val];const board={...b};if(room.game_key==="number"){const n=Number(val),tries={...(b.tries||{})};tries[user.id]=(tries[user.id]||0)+1;feed.push(n===b.secret?"🎉 إجابة صحيحة!":n<b.secret?"الرقم أكبر من "+n:"الرقم أصغر من "+n);if(n===b.secret)feed.push("فاز "+nick()+" بعد "+tries[user.id]+" محاولات.");board.tries=tries;}else if(room.game_key==="liar")board.hints={...(b.hints||{}),[user.id]:val};else if(room.game_key==="most")board.votes={...(b.votes||{}),[user.id]:val};else if(room.game_key==="yesno"||room.game_key==="quiz")board.answers={...(b.answers||{}),[user.id]:val};else if(room.game_key==="who")board.guesses={...(b.guesses||{}),[user.id]:val};await setState({...s,board,feed,round:(s.round||1)+(room.game_key==="number"&&Number(val)===b.secret?0:0)}).then(r=>r.error?showError(r.error):toast("وصلت إجابتك للغرفة!"))};
if($("#nextOnlineRound"))$("#nextOnlineRound").onclick=async()=>{if(!isHost())return;const next={...s,round:(s.round||1)+1,turn:((s.turn||0)+1)%players.length,board:{...b,question:((b.question||0)+1),answers:{},votes:{},hints:{},guesses:{}},feed:[...(s.feed||[]),"بدأت جولة جديدة"]};await setState(next).then(r=>r.error&&showError(r.error))};
}
async function enterRoom(id){if(channel){db.removeChannel(channel);channel=null}const rr=await db.from("game_rooms").select("*").eq("id",id).single();if(rr.error)throw rr.error;room=rr.data;await refreshPlayers();roomScreen();channel=db.channel("room-"+id).on("postgres_changes",{event:"*",schema:"public",table:"game_rooms",filter:"id=eq."+id},payload=>{if(payload.new){room=payload.new;refreshPlayers().then(roomScreen)}}).on("postgres_changes",{event:"*",schema:"public",table:"game_room_players",filter:"room_id=eq."+id},()=>refreshPlayers().then(roomScreen)).subscribe();if(poll)clearInterval(poll);poll=setInterval(()=>{if(room)refreshRoom(true)},6000)}
async function refreshPlayers(){if(!room)return;const r=await db.from("game_room_players").select("*").eq("room_id",room.id).order("seat");if(r.error)throw r.error;players=r.data||[]}
async function refreshRoom(silent=false){if(!room)return;try{const r=await db.from("game_rooms").select("*").eq("id",room.id).single();if(r.error)throw r.error;room=r.data;await refreshPlayers();if(!silent)roomScreen();else if(!$("#modalBackdrop").hidden&&$("#modalContent").querySelector(".online-room-head"))roomScreen()}catch(e){if(!silent)showError(e)}}
async function leaveRoom(){if(!room)return;try{if(channel)db.removeChannel(channel);channel=null;if(poll)clearInterval(poll);poll=null;if(user){const result=await db.rpc("leave_game_room",{p_room_id:room.id});if(result.error)throw result.error}}catch(e){console.warn(e)}room=null;players=[];history.replaceState({}, "",location.pathname+location.hash);close();toast("غادرت الغرفة")}

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
document.addEventListener("click",intercept,true);
document.addEventListener("DOMContentLoaded",()=>{if(!window.supabase||!cfg.url||!cfg.anonKey){toast("الغرف الأونلاين تحتاج إعداد Supabase.");return}const params=new URLSearchParams(location.search),code=params.get("room");if(code)setTimeout(()=>joinRoom(code),350)});
window.addEventListener("beforeunload",()=>{if(channel&&db)db.removeChannel(channel);if(poll)clearInterval(poll)});
})();
