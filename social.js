(() => {
"use strict";
const $=s=>document.querySelector(s), esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const back=$("#modalBackdrop"),body=$("#modalContent"),cfg=window.SUWAD_BACKEND||{};
let db=null,sess=null,me=null,refreshTimer=null,authReady=false,authInit=Promise.resolve(),authError=null;
const ready=!!(window.supabase&&cfg.url&&cfg.anonKey&&!cfg.url.includes("YOUR-PROJECT")&&!cfg.anonKey.includes("YOUR-ANON"));
function updateCommunityStatus(){
 const intro=document.querySelector(".community-section > .guide-intro");
 const foot=document.querySelector(".community-foot");
 const publicDesc=document.querySelector("#openPublicChat")?.parentElement?.querySelector("p");
 const friendsDesc=document.querySelector("#openFriends")?.parentElement?.querySelector("p");
 const privateDesc=document.querySelector("#openPrivateChat")?.parentElement?.querySelector("p");
 if(!ready){
  if(intro) intro.textContent="حسابات الأعضاء وطلبات الصداقة والشات الخاص تحتاج ربط قاعدة بيانات أولاً. افتح زر حسابك بالأعلى واتبع خطوات الإعداد؛ بعد الربط تقدر تسجّل وتبحث عن الأصدقاء بمعرّفهم.";
  if(foot) foot.textContent="الحسابات غير مفعّلة بعد: إعداد Supabase مطلوب مرة واحدة.";
  if(publicDesc) publicDesc.textContent="الشات العام يحتاج إعداد Supabase مرة واحدة حتى تتشارك الرسائل بين الأجهزة.";
  if(friendsDesc) friendsDesc.textContent="بعد إعداد قاعدة البيانات، ابحث باسم المستخدم أو معرّف الصداقة وأرسل طلباً.";
  if(privateDesc) privateDesc.textContent="المحادثة الخاصة بين الأصدقاء تعمل بعد إعداد قاعدة البيانات وقبول طلب الصداقة.";
 }else{
  if(intro) intro.textContent="خدمة الحسابات مهيّأة بالإعدادات. أنشئ حساباً من أيقونة الملف الشخصي، ثم ابحث عن أصدقائك باسم المستخدم أو معرّف الصداقة. إذا ظهرت مشكلة، تأكد من تنفيذ ملف SQL في Supabase.";
  if(foot) foot.textContent="الاتصال مهيّأ. إذا ظهرت مشكلة في الجداول أو الصلاحيات، راجع دليل Supabase وشغّل الترحيلات المطلوبة.";
  if(publicDesc) publicDesc.textContent="الشات العام يستخدم قاعدة البيانات المشتركة؛ في المشاريع القديمة شغّل ترحيل الشات العام مرة واحدة.";
  if(friendsDesc) friendsDesc.textContent="ابحث عن صديق باسم المستخدم أو معرّف الصداقة وأرسل طلباً.";
  if(privateDesc) privateDesc.textContent="بعد قبول طلب الصداقة، افتح محادثة خاصة وتبادل الرسائل بين الحسابين.";
 }
}
updateCommunityStatus();
function setNickname(value){const name=String(value||"").trim();if(!name)return;localStorage.setItem("sw_nickname",name);if(typeof window.setSuwadNickname==="function")window.setSuwadNickname(name);else{if($("#profileName"))$("#profileName").textContent=name;if($("#avatarMini"))$("#avatarMini").textContent=[...name][0]||"و"}}
if(ready){db=window.supabase.createClient(cfg.url,cfg.anonKey);authInit=db.auth.getSession().then(async x=>{if(x.error)throw x.error;sess=x.data.session||null;authReady=true;await loadMe()}).catch(e=>{authError=e;authReady=true;console.warn("auth initialization failed",e?.message||e)});db.auth.onAuthStateChange((_e,s)=>{sess=s||null;me=null;authReady=true;Promise.resolve().then(()=>loadMe())})}else authReady=true;
function modal(h){body.innerHTML=h;back.hidden=false;document.body.style.overflow="hidden";if(refreshTimer){clearInterval(refreshTimer);refreshTimer=null}}
function msg(t){const x=$("#toast");if(x){x.textContent=t;x.classList.add("show");setTimeout(()=>x.classList.remove("show"),2600)}else alert(t)}
function setupHint(){return '<div class="hint-box"><strong>إعداد Supabase مطلوب مرة واحدة:</strong><ol><li>أنشئ مشروعاً من <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">لوحة Supabase</a>.</li><li>فعّل Anonymous Sign-Ins، ثم ضع Project URL والمفتاح العام فقط في <code>backend-config.js</code>.</li><li>شغّل <a href="https://github.com/callmobile2004-source/suwad-wanasa/blob/main/supabase-schema.sql" target="_blank" rel="noopener noreferrer">supabase-schema.sql</a> كاملاً في SQL Editor.</li><li>إذا كان مشروعك مهيّأ من قبل، شغّل <a href="https://github.com/callmobile2004-source/suwad-wanasa/blob/main/supabase-public-chat-migration.sql" target="_blank" rel="noopener noreferrer">ترحيل الشات العام</a> مرة واحدة.</li><li>لتفعيل تعديل الاسم بأمان في قاعدة بيانات موجودة، شغّل <a href="https://github.com/callmobile2004-source/suwad-wanasa/blob/main/supabase-profile-name-migration.sql" target="_blank" rel="noopener noreferrer">ترحيل تعديل الاسم</a> مرة واحدة.</li><li>اضبط Site URL على <code>https://callmobile2004-source.github.io/suwad-wanasa/</code> في Authentication ثم URL Configuration.</li></ol><p><a href="https://github.com/callmobile2004-source/suwad-wanasa/blob/main/SUPABASE-SETUP.md" target="_blank" rel="noopener noreferrer">افتح دليل الإعداد الكامل</a>.</p><small>لا تضع service_role key أو أي مفتاح سري في ملفات الموقع.</small></div>'}
async function loadMe(){if(!db||!sess){me=null;return}const userId=sess.user.id;try{const r=await db.from("profiles").select("*").eq("id",userId).maybeSingle();if(r.error)throw r.error;if(sess?.user?.id!==userId)return;me=r.data||null;if(me)setNickname(me.display_name)}catch(e){me=null;console.warn("profile load failed",e?.message||e)}}
async function loadAccountProgression(){
 const el=$("#accountProgress");if(!el||!db||!me)return;
 el.innerHTML='<div class="account-progress-loading">جارٍ تحميل مستواك…</div>';
 try{
  const r=await db.from("player_leaderboard").select("xp,games_completed,achievement_count,level").eq("user_id",me.id).maybeSingle();
  if(r.error)throw r.error;
  const d=r.data||{xp:0,games_completed:0,achievement_count:0,level:1};
  const xp=Number(d.xp)||0,level=Number(d.level)||1,percent=xp%100;
  el.innerHTML='<div class="account-progress-card"><div class="account-progress-top"><span>مستواك في الوناسة</span><b>المستوى '+level.toLocaleString("ar-IQ")+'</b></div><div class="account-progress-xp">'+xp.toLocaleString("ar-IQ")+' نقطة خبرة</div><div class="account-progress-meter"><span style="width:'+percent+'%"></span></div><div class="account-progress-stats"><span>🎮 '+Number(d.games_completed||0).toLocaleString("ar-IQ")+' ألعاب</span><span>🏅 '+Number(d.achievement_count||0).toLocaleString("ar-IQ")+' أوسمة</span></div></div>';
 }catch(e){console.warn("account progression load failed",e);el.innerHTML='<p class="muted-note">تعذّر تحميل بيانات التقدم حالياً.</p>'}
}
function account(){
 if(!db){modal('<span class="pill">حسابات الوناسة</span><h2 id="modalTitle">ادخل للّمة 👋</h2><p class="modal-lead">الحسابات تحتاج إعداد Supabase وتفعيل Anonymous Sign-Ins.</p>'+setupHint());return}
 if(!authReady){modal('<span class="pill">حسابات الوناسة</span><h2 id="modalTitle">نتحقق من حسابك…</h2><p class="modal-lead" role="status">جارٍ استرجاع جلسة الدخول.</p>');authInit.then(()=>{if(!back.hidden)account()});return}
 if(sess&&!me){modal('<span class="pill">استعادة ملف العضو</span><h2 id="modalTitle">جلسة الدخول موجودة</h2><p class="modal-lead">دخلتَ بحساب محفوظ، لكن ملف العضو ما انقرأ. ما راح ننشئ حساباً ثانياً حتى ما ينقطع ربط الجلسة.</p><p class="hint-box">'+esc(authError?.message||"تأكد من تشغيل supabase-schema.sql ووجود جدول profiles وtrigger إنشاء الملف.")+'</p><button class="btn btn-gold full-btn" id="retryProfileLoad">إعادة المحاولة</button>'+setupHint());$("#retryProfileLoad").onclick=async()=>{const b=$("#retryProfileLoad");b.disabled=true;await loadMe();if(me)account();else{const p=$("#modalContent .hint-box");if(p)p.textContent="ما زال ملف العضو غير متاح. راجع Supabase SQL Editor وAuthentication Logs.";b.disabled=false}};return}
 if(sess&&me){modal('<span class="pill">ملف العضو</span><h2 id="modalTitle">'+esc(me.display_name)+'</h2><div class="turn-card"><div class="big-emoji">🪪</div><p>اسم المستخدم: <b dir="ltr">@'+esc(me.username)+'</b></p><p>معرّف الصداقة: <b>'+esc(me.friend_code)+'</b></p></div><div id="accountProgress" class="account-progress-slot"></div><button class="btn btn-ghost full-btn" id="openAllProgress">الإنجازات والمتصدرون</button><div class="field"><label for="editDisplayName">تغيير الاسم الظاهر للجميع</label><input id="editDisplayName" maxlength="24" value="'+esc(me.display_name)+'" autocomplete="nickname"></div><button class="btn btn-gold full-btn" id="saveDisplayName">حفظ الاسم الجديد</button><p id="nameFeedback" class="muted-note" role="status" aria-live="polite"></p><p class="muted-note">الاسم الظاهر يگدر أي لاعب يبحث عنه. اسم المستخدم ومعرّف الصداقة يبقون نفسهم وما يتغيرون.</p><div class="modal-actions"><button class="btn btn-ghost" id="copyCode">نسخ معرّف الصداقة</button><button class="btn btn-ghost" id="copyUsername">نسخ اسم المستخدم</button></div>');loadAccountProgression();$("#openAllProgress").onclick=()=>{back.hidden=true;document.body.style.overflow="";const panel=document.querySelector("#progression");if(panel)panel.hidden=false;location.hash="#progression";panel?.scrollIntoView({behavior:"smooth",block:"start"})};$("#saveDisplayName").onclick=async()=>{const input=$("#editDisplayName"),button=$("#saveDisplayName"),feedback=$("#nameFeedback"),display=input.value.trim();if([...display].length<2||[...display].length>24){feedback.textContent="الاسم لازم يكون من حرفين إلى ٢٤ حرفاً.";return}if(/[\x00-\x1F\x7F]/u.test(display)){feedback.textContent="احذف الرموز غير المسموحة من الاسم.";return}button.disabled=true;feedback.textContent="جارٍ حفظ الاسم…";try{const userId=sess?.user?.id;if(!userId||userId!==me.id)throw new Error("انتهت جلسة الدخول. سجّل الدخول من جديد.");const r=await db.from("profiles").update({display_name:display}).eq("id",userId).select("id,display_name,username,friend_code").single();if(r.error)throw r.error;if(sess?.user?.id!==userId)throw new Error("تغيّرت جلسة الحساب؛ أعد فتح الملف.");me={...me,...r.data};setNickname(me.display_name);account();msg("تم تحديث اسمك الظاهر للجميع.")}catch(e){feedback.textContent=(e.message||"تعذّر حفظ الاسم.")+" إذا استمرت المشكلة، طبّق ملف supabase-profile-name-migration.sql في Supabase."}finally{if($("#saveDisplayName"))$("#saveDisplayName").disabled=false}};$("#copyCode").onclick=async()=>{try{await navigator.clipboard.writeText(me.friend_code);msg("تم نسخ المعرّف")}catch{msg("معرّفك: "+me.friend_code)}};$("#copyUsername").onclick=async()=>{try{await navigator.clipboard.writeText("@"+me.username);msg("تم نسخ اسم المستخدم")}catch{msg("اسم المستخدم: @"+me.username)}};return}
 modal('<span class="pill">حسابات الوناسة</span><h2 id="modalTitle">شنو اسمك؟ 👋</h2><p class="modal-lead">اكتب الاسم اللي تحب يظهر للربع. عربي أو إنكليزي، والزخرفة مسموحة. ما نحتاج بريد إلكتروني ولا كلمة مرور.</p><div class="auth-name-notice" role="note"><span class="auth-notice-icon" aria-hidden="true">✦</span><span>قبول الأسماء العربية والإنگليزية والمزخرفة، بطول من حرفين إلى ٢٤ حرفاً.</span><span class="auth-notice-spark" aria-hidden="true">✧</span></div><div class="field"><label for="displayName">اسمك</label><input id="displayName" maxlength="24" autocomplete="nickname" placeholder="مثلاً: سَـوَاد أو 𝑺𝒖𝒘𝒂𝒅"></div><button class="btn btn-gold full-btn" id="authSubmit">دخول الوناسة</button><p id="authFeedback" class="muted-note" aria-live="polite"></p><p class="muted-note">تنبيه: الحساب ينحفظ على هذا الجهاز فقط. إذا مسحت بيانات المتصفح أو بدّلت الجهاز، ما نكدر نسترجعه بالاسم وحده.</p>');
 const feedback=$("#authFeedback"),submit=$("#authSubmit");
 submit.onclick=async()=>{const display=$("#displayName").value.trim();if([...display].length<2||[...display].length>24){feedback.textContent="الاسم لازم يكون من حرفين إلى ٢٤ حرفاً.";return}if(/[\x00-\x1F\x7F]/u.test(display)){feedback.textContent="احذف الرموز غير المسموحة من الاسم.";return}submit.disabled=true;feedback.textContent="لحظة، ندخّلك للّمة…";try{const username="u_"+Array.from(crypto.getRandomValues(new Uint8Array(8)),b=>b.toString(16).padStart(2,"0")).join("").slice(0,16);const r=await db.auth.signInAnonymously({options:{data:{display_name:display,username}}});if(r.error)throw r.error;sess=r.data.session||null;me=null;setNickname(display);await loadMe();if(me){account();msg("أهلاً بيك بالوناسة!")}else feedback.textContent="تم إنشاء جلسة الدخول، لكن ملف العضو لم يظهر. لا تعيد التسجيل؛ نفّذ ملف SQL وتحقق من trigger إنشاء profiles."}catch(e){feedback.textContent=(e.message||"تعذّر إكمال الدخول.")+" تأكد من تفعيل Anonymous Sign-Ins في Supabase."}finally{if($("#authSubmit"))$("#authSubmit").disabled=false}}
}
async function friends(){
 if(!db||!authReady||!sess||!me){account();return}
 modal('<span class="pill">الأصدقاء</span><h2 id="modalTitle">لمّ ربعك ♧</h2><p class="modal-lead">ابحث باسم اللاعب الظاهر، أو اسم المستخدم، أو معرّف الصداقة. البحث بالاسم يقبل جزءاً من الاسم ويعرض أكثر من نتيجة.</p><div class="field"><label for="lookupFriend">اسم اللاعب أو اسم المستخدم أو معرّف الصداقة</label><input id="lookupFriend" maxlength="40" placeholder="اكتب اسم اللاعب…"></div><button class="btn btn-gold full-btn" id="findFriend">بحث عن اللاعبين</button><p id="friendFeedback" class="muted-note" aria-live="polite"></p><div id="friendSearchResults"></div><div id="friendSections">جارٍ تحميل القائمة…</div>');
 const feedback=$("#friendFeedback"),results=$("#friendSearchResults"),button=$("#findFriend");
 async function sendRequest(found,btn){btn.disabled=true;try{const ins=await db.from("friend_requests").insert({sender_id:sess.user.id,receiver_id:found.id,status:"pending"});if(ins.error){if(ins.error.code==="23505")throw new Error("طلب الصداقة موجود مسبقاً أو أنكما أصدقاء بالفعل.");throw ins.error}btn.textContent="تم إرسال الطلب";feedback.textContent="انرسل طلب الصداقة إلى "+found.display_name+".";await loadFriendSections()}catch(e){feedback.textContent=e.message||"تعذّر إرسال طلب الصداقة.";btn.disabled=false}}
 button.onclick=async()=>{const raw=$("#lookupFriend").value.trim(),v=raw.replace(/^@/,""),f=feedback;if(!v){f.textContent="اكتب اسم اللاعب للبحث.";return}button.disabled=true;f.textContent="جارٍ البحث عن اللاعبين…";results.innerHTML="";try{let rows=[];if(v.toUpperCase().startsWith("WN-")){const r=await db.from("profiles").select("id,username,display_name,friend_code").neq("id",sess.user.id).eq("friend_code",v.toUpperCase()).limit(20);if(r.error)throw r.error;rows=r.data||[]}else if(raw.startsWith("@")){const r=await db.from("profiles").select("id,username,display_name,friend_code").neq("id",sess.user.id).ilike("username",v.toLowerCase()).limit(20);if(r.error)throw r.error;rows=r.data||[]}else{const safe=v.replace(/[%_]/g,"");const r=await db.from("profiles").select("id,username,display_name,friend_code").neq("id",sess.user.id).ilike("display_name","%"+safe+"%").order("display_name").limit(20);if(r.error)throw r.error;rows=r.data||[];if(!rows.length){const q=await db.from("profiles").select("id,username,display_name,friend_code").neq("id",sess.user.id).ilike("username",v.toLowerCase()).limit(20);if(q.error)throw q.error;rows=q.data||[]}}if(!rows.length){f.textContent="ما لكينا لاعب بهذا الاسم. جرّب جزءاً آخر من الاسم.";return}f.textContent="لقينا "+rows.length+" لاعب. اختار الشخص وأرسل طلب صداقة.";results.innerHTML=rows.map((p,i)=>'<div class="friend-row"><span class="friend-avatar">✦</span><span>'+esc(p.display_name)+' <small dir="ltr">@'+esc(p.username)+' • '+esc(p.friend_code)+'</small></span><button class="friend-open" data-add-player="'+i+'">إضافة صديق</button></div>').join("");results.querySelectorAll("[data-add-player]").forEach(b=>b.onclick=()=>sendRequest(rows[Number(b.dataset.addPlayer)],b))}catch(e){f.textContent=e.message||"صار خطأ أثناء البحث."}finally{button.disabled=false}};
 await loadFriendSections();
}
async function loadFriendSections(){
 const box=$("#friendSections");
 if(!box||!db||!sess)return;
 try{
  const incoming=await db.from("friend_requests").select("id,sender_id,profiles!friend_requests_sender_id_fkey(username,display_name,friend_code)").eq("receiver_id",sess.user.id).eq("status","pending");
  if(incoming.error)throw incoming.error;
  const outgoing=await db.from("friend_requests").select("id,receiver_id,profiles!friend_requests_receiver_id_fkey(username,display_name,friend_code)").eq("sender_id",sess.user.id).eq("status","pending");
  if(outgoing.error)throw outgoing.error;
  const accepted=await db.from("friend_requests").select("id,sender_id,receiver_id,status").eq("status","accepted").or("sender_id.eq."+sess.user.id+",receiver_id.eq."+sess.user.id);
  if(accepted.error)throw accepted.error;
  let h="<h3>طلبات واردة</h3>";
  h+=incoming.data.length
   ? incoming.data.map(x=>`<div class="friend-row"><span class="friend-avatar">♧</span><span>${esc(x.profiles?.display_name||"عضو")}</span><button class="friend-open" data-accept="${esc(x.id)}">قبول</button><button class="friend-remove" data-decline="${esc(x.id)}" aria-label="رفض الطلب">رفض</button></div>`).join("")
   : '<p class="empty-friends">ما عندك طلبات واردة.</p>';
  h+='<h3>طلبات مرسلة</h3>';
  h+=outgoing.data.length
   ? outgoing.data.map(x=>`<div class="friend-row"><span>${esc(x.profiles?.display_name||x.profiles?.username)}</span><span class="muted-note">بانتظار القبول</span></div>`).join("")
   : '<p class="empty-friends">ماكو طلبات مرسلة معلّقة.</p>';
  h+="<h3>أصدقائي</h3>";
  const rows=[];
  for(const x of accepted.data){
   const id=x.sender_id===sess.user.id?x.receiver_id:x.sender_id;
   const p=await db.from("profiles").select("username,display_name,friend_code").eq("id",id).maybeSingle();
   if(p.data)rows.push({id,p:p.data});
  }
  h+=rows.length
   ? rows.map(x=>`<div class="friend-row"><span class="friend-avatar">✦</span><span>${esc(x.p.display_name)} <small dir="ltr">@${esc(x.p.username)} • ${esc(x.p.friend_code)}</small></span><button class="friend-open" data-chat="${esc(x.id)}" data-name="${esc(x.p.display_name)}">راسل</button></div>`).join("")
   : '<p class="empty-friends">أصدقاؤك راح يظهرون بعد قبول الطلبات.</p>';
  box.innerHTML=h;
  box.querySelectorAll("[data-accept]").forEach(b=>b.onclick=async()=>{
   const r=await db.from("friend_requests").update({status:"accepted"}).eq("id",b.dataset.accept).eq("receiver_id",sess.user.id);
   if(r.error){msg(r.error.message);return}
   await loadFriendSections();msg("تم قبول طلب الصداقة!");
  });
  box.querySelectorAll("[data-decline]").forEach(b=>b.onclick=async()=>{const r=await db.from("friend_requests").update({status:"declined"}).eq("id",b.dataset.decline).eq("receiver_id",sess.user.id);if(r.error){msg("تعذّر رفض الطلب: "+r.error.message);return}await loadFriendSections();msg("تم رفض طلب الصداقة.")});
  box.querySelectorAll("[data-chat]").forEach(b=>b.onclick=()=>chat(b.dataset.chat,b.dataset.name));
 }catch(e){
  box.innerHTML='<p class="hint-box">تعذّر تحميل القائمة: '+esc(e.message)+'. تأكد من تطبيق ملف SQL.</p>';
 }
}
async function chat(id,name){
 if(!db||!sess)return account();
 modal('<span class="pill">محادثة خاصة</span><h2 id="modalTitle">سوالف ويّا '+esc(name)+'</h2><p class="muted-note">المحادثة خاصة بين الحسابين. لا ترسل معلومات حساسة.</p><div class="chat-messages" id="realMessages"><div class="chat-empty">جارٍ تحميل الرسائل…</div></div><div class="chat-compose"><input id="realMessageInput" maxlength="1000" placeholder="اكتب رسالتك…" autocomplete="off"><button class="btn btn-gold" id="sendRealMessage">إرسال</button></div><p class="muted-note" id="privateChatStatus" role="status" aria-live="polite"></p>');
 let loading=false,sending=false;
 async function pull(){const area=$("#realMessages");if(!area||loading)return;loading=true;try{const r=await db.from("messages").select("id,sender_id,body,created_at").or("and(sender_id.eq."+sess.user.id+",receiver_id.eq."+id+"),and(sender_id.eq."+id+",receiver_id.eq."+sess.user.id+")").order("created_at",{ascending:true}).limit(100);if(r.error)throw r.error;if(!$("#realMessages"))return;area.innerHTML=r.data.length?r.data.map(m=>'<div class="chat-bubble '+(m.sender_id===sess.user.id?"chat-mine":"")+'"><small>'+(m.sender_id===sess.user.id?"أنت":esc(name))+' • '+esc(new Date(m.created_at).toLocaleTimeString("ar-IQ",{hour:"2-digit",minute:"2-digit"}))+'</small><p>'+esc(m.body)+'</p></div>').join(""):'<div class="chat-empty">ابدأوا أول سالفة ✨</div>';area.scrollTop=area.scrollHeight;const st=$("#privateChatStatus");if(st)st.textContent="آخر تحديث "+new Date().toLocaleTimeString("ar-IQ",{hour:"2-digit",minute:"2-digit"})}catch(e){const st=$("#privateChatStatus");if(st)st.textContent="تعذّر تحديث المحادثة: "+(e.message||"تحقق من الاتصال وسياسات الأصدقاء.")}finally{loading=false}}
 async function send(){const input=$("#realMessageInput"),button=$("#sendRealMessage"),value=input?.value.trim();if(!value||sending)return;if([...value].length>1000){msg("الرسالة أطول من الحد المسموح.");return}sending=true;if(button)button.disabled=true;try{const r=await db.from("messages").insert({sender_id:sess.user.id,receiver_id:id,body:value});if(r.error)throw r.error;if(input)input.value="";await pull()}catch(e){const st=$("#privateChatStatus");if(st)st.textContent="تعذّر إرسال الرسالة: "+(e.message||"تحقق من الاتصال وقبول الصداقة.")}finally{sending=false;if($("#sendRealMessage"))$("#sendRealMessage").disabled=false}}
 $("#sendRealMessage").onclick=send;$("#realMessageInput").onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}};await pull();refreshTimer=setInterval(()=>{if($("#realMessages"))pull();else{clearInterval(refreshTimer);refreshTimer=null}},4000);
}
if($("#profileButton"))$("#profileButton").onclick=account;
if($("#openFriends"))$("#openFriends").onclick=friends;
if($("#openPrivateChat"))$("#openPrivateChat").onclick=friends;
async function publicChat(){
 if(!db){account();return}
 if(!authReady){modal('<span class="pill">شات اللمة</span><h2 id="modalTitle">نتحقق من حسابك…</h2><p class="modal-lead" role="status">جارٍ استرجاع جلسة الدخول.</p>');await authInit}
 if(!sess){account();return}
 modal('<span class="pill">شات اللمة</span><h2 id="modalTitle">الدردشة العامة 🌐</h2><p class="modal-lead">رسائل عامة مشتركة بين أعضاء الوناسة. احترم الربع ولا تنشر معلومات خاصة.</p><div id="publicChatStatus" class="muted-note" role="status" aria-live="polite">جارٍ الاتصال بالشات…</div><div class="chat-messages" id="publicMessages"><div class="chat-empty">جارٍ تحميل الرسائل…</div></div><div class="chat-compose"><input id="publicMessageInput" maxlength="500" placeholder="اكتب رسالة للّمة…" autocomplete="off"><button class="btn btn-gold" id="sendPublicMessage">إرسال</button></div><p class="muted-note">تتحدث الرسائل تلقائياً كل ٤ ثوانٍ. الحد الأقصى ٥٠٠ حرف.</p>');
 let loading=false,sending=false;const status=$("#publicChatStatus");
 const missing=e=>/public_messages|relation .* does not exist|schema cache|could not find the table|PGRST205|42P01/i.test(String(e?.message||e||""));
 function errorText(e,action){const m=String(e?.message||"تحقق من الاتصال.");if(missing(e))return "قاعدة البيانات قديمة: شغّل supabase-public-chat-migration.sql مرة واحدة في SQL Editor.";if(/rate|wait|ثانيتين|2 seconds/i.test(m))return "تم إرسال رسالة قبل لحظات؛ انتظر ثانيتين ثم أعد المحاولة.";if(/row-level security|permission denied|42501/i.test(m))return "صلاحيات الشات غير مفعّلة. أعد تشغيل ملف ترحيل الشات العام.";return "تعذّر "+action+": "+m}
 async function pull(){const area=$("#publicMessages");if(!area||loading)return;loading=true;try{const r=await db.from("public_messages").select("id,sender_id,body,created_at").order("created_at",{ascending:false}).limit(100);if(r.error)throw r.error;const rows=(r.data||[]).reverse(),ids=[...new Set(rows.map(x=>x.sender_id))];let names={};if(ids.length){const pr=await db.from("profiles").select("id,display_name").in("id",ids);if(!pr.error)(pr.data||[]).forEach(p=>names[p.id]=p.display_name)}if(!$("#publicMessages"))return;area.innerHTML=rows.length?rows.map(m=>'<div class="chat-bubble '+(m.sender_id===sess.user.id?"chat-mine":"")+'"><small>'+esc(names[m.sender_id]||"عضو اللمة")+' • '+esc(new Date(m.created_at).toLocaleTimeString("ar-IQ",{hour:"2-digit",minute:"2-digit"}))+'</small><p>'+esc(m.body)+'</p></div>').join(""):'<div class="chat-empty">بعد ماكو رسائل. افتحوا السالفة! ✨</div>';area.scrollTop=area.scrollHeight;const st=$("#publicChatStatus");if(st)st.textContent="آخر تحديث "+new Date().toLocaleTimeString("ar-IQ",{hour:"2-digit",minute:"2-digit"})+" • مزامنة تلقائية"}catch(e){if(status)status.textContent=errorText(e,"تحميل الرسائل");console.warn("public chat load failed",e)}finally{loading=false}}
 async function send(){const input=$("#publicMessageInput"),button=$("#sendPublicMessage"),value=input?.value.trim();if(!value||sending)return;if([...value].length>500){if(status)status.textContent="الرسالة طويلة؛ الحد ٥٠٠ حرف.";return}sending=true;if(button)button.disabled=true;try{const r=await db.from("public_messages").insert({sender_id:sess.user.id,body:value});if(r.error)throw r.error;if(input)input.value="";await pull()}catch(e){if(status)status.textContent=errorText(e,"إرسال الرسالة")}finally{sending=false;if($("#sendPublicMessage"))$("#sendPublicMessage").disabled=false}}
 $("#sendPublicMessage").onclick=send;$("#publicMessageInput").onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}};await pull();refreshTimer=setInterval(()=>{if($("#publicMessages"))pull();else{clearInterval(refreshTimer);refreshTimer=null}},4000);
}
if($("#openPublicChat"))$("#openPublicChat").onclick=publicChat;


})();