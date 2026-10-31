(() => {
"use strict";
const $=s=>document.querySelector(s), esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const back=$("#modalBackdrop"),body=$("#modalContent"),cfg=window.SUWAD_BACKEND||{};
let db=null,sess=null,me=null,refreshTimer=null;
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
  if(publicDesc) publicDesc.textContent="الشات العام المشترك يحتاج تطوير وربط إضافي، وهو غير متاح حالياً.";
  if(friendsDesc) friendsDesc.textContent="بعد إعداد قاعدة البيانات، ابحث باسم المستخدم أو معرّف الصداقة وأرسل طلباً.";
  if(privateDesc) privateDesc.textContent="المحادثة الخاصة بين الأصدقاء تعمل بعد إعداد قاعدة البيانات وقبول طلب الصداقة.";
 }else{
  if(intro) intro.textContent="خدمة الحسابات مهيّأة بالإعدادات. أنشئ حساباً من أيقونة الملف الشخصي، ثم ابحث عن أصدقائك باسم المستخدم أو معرّف الصداقة. إذا ظهرت مشكلة، تأكد من تنفيذ ملف SQL في Supabase.";
  if(foot) foot.textContent="إعدادات الاتصال موجودة؛ يلزم التأكد من تطبيق مخطط قاعدة البيانات وسياسات الأمان.";
  if(publicDesc) publicDesc.textContent="الشات العام المشترك يحتاج تطوير وربط إضافي، وهو غير متاح حالياً.";
  if(friendsDesc) friendsDesc.textContent="ابحث عن صديق باسم المستخدم أو معرّف الصداقة وأرسل طلباً.";
  if(privateDesc) privateDesc.textContent="بعد قبول طلب الصداقة، افتح محادثة خاصة وتبادل الرسائل بين الحسابين.";
 }
}
updateCommunityStatus();
if(ready){db=window.supabase.createClient(cfg.url,cfg.anonKey);db.auth.getSession().then(x=>{sess=x.data.session;loadMe()});db.auth.onAuthStateChange((_e,s)=>{sess=s;loadMe()});}
function modal(h){body.innerHTML=h;back.hidden=false;document.body.style.overflow="hidden";if(refreshTimer){clearInterval(refreshTimer);refreshTimer=null}}
function msg(t){const x=$("#toast");if(x){x.textContent=t;x.classList.add("show");setTimeout(()=>x.classList.remove("show"),2600)}else alert(t)}
function setupHint(){return '<div class="hint-box"><strong>باقي إعداد خارجي واحد حتى يشتغل التسجيل بين الأجهزة:</strong><ol><li>أنشئ مشروعاً مجانياً من <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">لوحة Supabase</a>.</li><li>انسخ Project URL و Publishable/anon key إلى ملف <code>backend-config.js</code> بالمستودع.</li><li>افتح <a href="https://github.com/callmobile2004-source/suwad-wanasa/blob/main/supabase-schema.sql" target="_blank" rel="noopener noreferrer">ملف SQL</a> وانسخه إلى SQL Editor في مشروع Supabase وشغّله.</li><li>أضف رابط الموقع في Authentication ثم URL Configuration: <code>https://callmobile2004-source.github.io/suwad-wanasa/</code>.</li></ol><p><a href="https://github.com/callmobile2004-source/suwad-wanasa/blob/main/SUPABASE-SETUP.md" target="_blank" rel="noopener noreferrer">افتح دليل الإعداد الكامل</a>.</p><small>لا تضع service_role key في الموقع ولا ترسل أي مفتاح سري. من دون مشروع Supabase فعلي لا يمكن تشغيل الحسابات بين الأجهزة.</small></div>'}
async function loadMe(){if(!db||!sess)return;try{const r=await db.from("profiles").select("*").eq("id",sess.user.id).maybeSingle();if(r.error)throw r.error;me=r.data;if(me){if($("#profileName"))$("#profileName").textContent=me.display_name;if($("#avatarMini"))$("#avatarMini").textContent=[...me.display_name][0]||"و"}}catch(e){console.warn(e.message)}}
function account(){
if(!db){modal('<span class="pill">حسابات الوناسة</span><h2 id="modalTitle">ادخل للّمة 👋</h2><p class="modal-lead">الحسابات تحتاج إعداد Supabase، وتفعيل الدخول المجهول (Anonymous Sign-Ins). بعد التفعيل، تدخل باسمك فقط من دون بريد أو كلمة مرور.</p>'+setupHint());return}
if(sess&&me){modal('<span class="pill">ملف العضو</span><h2 id="modalTitle">'+esc(me.display_name)+'</h2><div class="turn-card"><div class="big-emoji">🪪</div><p>معرّف الصداقة: <b>'+esc(me.friend_code)+'</b></p></div><p class="muted-note">حسابك محفوظ على هذا الجهاز. احتفظ بمعرّف الصداقة حتى يضيفك أصدقاؤك. لا تسجّل الخروج، لأن الاسم وحده لا يكفي لاسترجاع الحساب على جهاز آخر.</p><div class="modal-actions"><button class="btn btn-ghost" id="copyCode">نسخ المعرّف</button></div>');$("#copyCode").onclick=async()=>{try{await navigator.clipboard.writeText(me.friend_code);msg("تم نسخ المعرّف")}catch{msg("معرّفك: "+me.friend_code)}};return}
modal('<span class="pill">حسابات الوناسة</span><h2 id="modalTitle">شنو اسمك؟ 👋</h2><p class="modal-lead">اكتب الاسم اللي تحب يظهر للربع. عربي أو إنكليزي، والزخرفة مسموحة. ما نحتاج بريد إلكتروني ولا كلمة مرور.</p><div class="auth-name-notice" role="note"><span class="auth-notice-icon" aria-hidden="true">✦</span><span>قبول الأسماء العربية والإنگليزية والمزخرفة، بطول من حرفين إلى ٢٤ حرفاً.</span><span class="auth-notice-spark" aria-hidden="true">✧</span></div><div class="field"><label for="displayName">اسمك</label><input id="displayName" maxlength="24" autocomplete="nickname" placeholder="مثلاً: سَـوَاد أو 𝑺𝒖𝒘𝒂𝒅"></div><button class="btn btn-gold full-btn" id="authSubmit">دخول الوناسة</button><p id="authFeedback" class="muted-note" aria-live="polite"></p><p class="muted-note">تنبيه: الحساب ينحفظ على هذا الجهاز فقط. إذا مسحت بيانات المتصفح أو بدّلت الجهاز، ما نكدر نسترجعه بالاسم وحده.</p>');
const feedback=$("#authFeedback"),submit=$("#authSubmit");
submit.onclick=async()=>{const display=$("#displayName").value.trim();if([...display].length<2||[...display].length>24)return feedback.textContent="الاسم لازم يكون من حرفين إلى ٢٤ حرفاً.";if(/[\x00-\x1F\x7F]/u.test(display))return feedback.textContent="احذف الرموز غير المسموحة من الاسم.";submit.disabled=true;feedback.textContent="لحظة، ندخّلك للّمة…";try{const username="u_"+Array.from(crypto.getRandomValues(new Uint8Array(8)),b=>b.toString(16).padStart(2,"0")).join("").slice(0,16);const r=await db.auth.signInAnonymously({options:{data:{display_name:display,username}}});if(r.error)throw r.error;sess=r.data.session;await loadMe();if(me){account();msg("أهلاً بيك بالوناسة!")}else feedback.textContent="تم إنشاء جلسة الدخول، بس الملف ما ظهر. تأكد من تشغيل ملف SQL وتفعيل الدخول المجهول في Supabase."}catch(e){feedback.textContent=(e.message||"تعذّر إكمال الدخول.")+" افتح Supabase ثم Authentication ثم Sign In / Providers وفعّل Anonymous Sign-Ins."}finally{if($("#authSubmit"))$("#authSubmit").disabled=false}}
}
async function friends(){if(!db||!sess||!me){account();return}modal('<span class="pill">الأصدقاء</span><h2 id="modalTitle">لمّ ربعك ♧</h2><p class="modal-lead">ابحث باسم المستخدم أو المعرّف العشوائي وأرسل طلب صداقة.</p><div class="field"><label>اسم المستخدم أو المعرّف</label><input id="lookupFriend" maxlength="32" placeholder="@username أو WN-AB12CD"></div><button class="btn btn-gold full-btn" id="findFriend">بحث وإرسال طلب</button><p id="friendFeedback" class="muted-note"></p><div id="friendSections">جارٍ تحميل القائمة…</div>');
$("#findFriend").onclick=async()=>{const v=$("#lookupFriend").value.trim().replace(/^@/,""),f=$("#friendFeedback");if(!v)return f.textContent="اكتب اسم المستخدم أو المعرّف.";f.textContent="جارٍ البحث…";try{let q=db.from("profiles").select("id,username,display_name,friend_code").neq("id",sess.user.id).limit(1);q=v.toUpperCase().startsWith("WN-")?q.eq("friend_code",v.toUpperCase()):q.ilike("display_name",v);const r=await q.maybeSingle();if(r.error)throw r.error;if(!r.data)return f.textContent="ما لكينا حساب بهذا الاسم أو المعرّف.";const ins=await db.from("friend_requests").insert({sender_id:sess.user.id,receiver_id:r.data.id,status:"pending"});if(ins.error)throw new Error(ins.error.code==="23505"?"هذا الطلب موجود من قبل أو أنكما أصدقاء.":ins.error.message);f.textContent="انرسل طلب الصداقة إلى "+r.data.display_name+".";await loadFriendSections()}catch(e){f.textContent=e.message||"صار خطأ أثناء البحث."}};
await loadFriendSections()}
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
   ? incoming.data.map(x=>`<div class="friend-row"><span class="friend-avatar">♧</span><span>${esc(x.profiles?.display_name||"عضو")}</span><button class="friend-open" data-accept="${esc(x.id)}">قبول</button></div>`).join("")
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
   ? rows.map(x=>`<div class="friend-row"><span class="friend-avatar">✦</span><span>${esc(x.p.display_name)} <small>${esc(x.p.friend_code)}</small></span><button class="friend-open" data-chat="${esc(x.id)}" data-name="${esc(x.p.display_name)}">راسل</button></div>`).join("")
   : '<p class="empty-friends">أصدقاؤك راح يظهرون بعد قبول الطلبات.</p>';
  box.innerHTML=h;
  box.querySelectorAll("[data-accept]").forEach(b=>b.onclick=async()=>{
   const r=await db.from("friend_requests").update({status:"accepted"}).eq("id",b.dataset.accept).eq("receiver_id",sess.user.id);
   if(r.error){msg(r.error.message);return}
   await loadFriendSections();msg("تم قبول طلب الصداقة!");
  });
  box.querySelectorAll("[data-chat]").forEach(b=>b.onclick=()=>chat(b.dataset.chat,b.dataset.name));
 }catch(e){
  box.innerHTML='<p class="hint-box">تعذّر تحميل القائمة: '+esc(e.message)+'. تأكد من تطبيق ملف SQL.</p>';
 }
}
async function chat(id,name){modal('<span class="pill">محادثة خاصة</span><h2 id="modalTitle">سوالف ويّا '+esc(name)+'</h2><p class="muted-note">المحادثة خاصة بين الحسابين. لا ترسل معلومات حساسة.</p><div class="chat-messages" id="realMessages"><div class="chat-empty">جارٍ تحميل الرسائل…</div></div><div class="chat-compose"><input id="realMessageInput" maxlength="1000" placeholder="اكتب رسالتك…"><button class="btn btn-gold" id="sendRealMessage">إرسال</button></div>');async function pull(){const area=$("#realMessages");if(!area)return;const r=await db.from("messages").select("id,sender_id,body,created_at").or("and(sender_id.eq."+sess.user.id+",receiver_id.eq."+id+"),and(sender_id.eq."+id+",receiver_id.eq."+sess.user.id+")").order("created_at",{ascending:true}).limit(100);if(r.error){area.innerHTML='<p class="chat-empty">'+esc(r.error.message)+'</p>';return}area.innerHTML=r.data.length?r.data.map(m=>'<div class="chat-bubble '+(m.sender_id===sess.user.id?"chat-mine":"")+'"><small>'+(m.sender_id===sess.user.id?"أنت":"صديقك")+' • '+esc(new Date(m.created_at).toLocaleTimeString("ar-IQ",{hour:"2-digit",minute:"2-digit"}))+'</small><p>'+esc(m.body)+'</p></div>').join(""):'<div class="chat-empty">ابدأوا أول سالفة ✨</div>';area.scrollTop=area.scrollHeight}async function send(){const input=$("#realMessageInput"),value=input?.value.trim();if(!value)return;const r=await db.from("messages").insert({sender_id:sess.user.id,receiver_id:id,body:value});if(r.error){msg(r.error.message);return}input.value="";pull()}$("#sendRealMessage").onclick=send;$("#realMessageInput").onkeydown=e=>{if(e.key==="Enter")send()};await pull();refreshTimer=setInterval(pull,4000)}
if($("#profileButton"))$("#profileButton").onclick=account;
if($("#openFriends"))$("#openFriends").onclick=friends;
if($("#openPrivateChat"))$("#openPrivateChat").onclick=friends;
async function publicChat(){
 if(!db||!sess){account();return}
 modal('<span class="pill">شات اللمة</span><h2 id="modalTitle">الدردشة العامة 🌐</h2><p class="modal-lead">رسائل عامة يقدر يشوفها كل أعضاء اللمة. خلكم محترمين ولا تنشرون معلومات خاصة.</p><div id="publicChatStatus" class="muted-note" role="status" aria-live="polite">جارٍ الاتصال بالشات…</div><div class="chat-messages" id="publicMessages"><div class="chat-empty">جارٍ تحميل الرسائل…</div></div><div class="chat-compose"><input id="publicMessageInput" maxlength="500" placeholder="اكتب رسالة للّمة…" autocomplete="off"><button class="btn btn-gold" id="sendPublicMessage">إرسال</button></div><p class="muted-note">الرسائل محفوظة على الخادم. لا ترسل معلومات شخصية أو كلمات مرور.</p>');
 let loading=false;
 const status=$("#publicChatStatus");
 async function pull(){
  const area=$("#publicMessages");if(!area||loading)return;loading=true;
  try{
   const r=await db.from("public_messages").select("id,sender_id,body,created_at").order("created_at",{ascending:false}).limit(100);
   if(r.error)throw r.error;
   const rows=(r.data||[]).reverse(),ids=[...new Set(rows.map(x=>x.sender_id))];
   let names={};
   if(ids.length){const pr=await db.from("profiles").select("id,display_name").in("id",ids);if(pr.error)throw pr.error;(pr.data||[]).forEach(p=>names[p.id]=p.display_name)}
   if(!$("#publicMessages"))return;
   area.innerHTML=rows.length?rows.map(m=>'<div class="chat-bubble '+(m.sender_id===sess.user.id?"chat-mine":"")+'"><small>'+esc(names[m.sender_id]||"عضو اللمة")+' • '+esc(new Date(m.created_at).toLocaleTimeString("ar-IQ",{hour:"2-digit",minute:"2-digit"}))+'</small><p>'+esc(m.body)+'</p></div>').join(""):'<div class="chat-empty">بعد ماكو رسائل. افتحوا السالفة! ✨</div>';
   area.scrollTop=area.scrollHeight;
   if(status)status.textContent="متصل بالشات العام • آخر تحديث "+new Date().toLocaleTimeString("ar-IQ",{hour:"2-digit",minute:"2-digit"});
  }catch(e){
   if(status)status.textContent=/public_messages|relation .* does not exist|schema cache|could not find the table/i.test(String(e.message||e))?"قاعدة البيانات تحتاج تحديث الشات العام: شغّل ملف supabase-public-chat-migration.sql في SQL Editor.":("تعذّر تحميل الرسائل: "+(e.message||"خطأ اتصال"));
   console.warn("public chat load failed",e);
  }finally{loading=false}
 }
 async function send(){
  const input=$("#publicMessageInput"),button=$("#sendPublicMessage"),value=input?.value.trim();
  if(!value)return;
  if([...value].length>500){if(status)status.textContent="الرسالة طويلة؛ الحد ٥٠٠ حرف.";return}
  if(button)button.disabled=true;
  try{
   const r=await db.from("public_messages").insert({sender_id:sess.user.id,body:value});
   if(r.error)throw r.error;
   if(input)input.value="";
   await pull();
  }catch(e){
   if(status)status.textContent=/public_messages|relation .* does not exist|schema cache|could not find the table/i.test(String(e.message||e))?"تحديث قاعدة البيانات مطلوب. شغّل ملف supabase-public-chat-migration.sql في Supabase.":"تعذّر إرسال الرسالة: "+(e.message||"تحقق من الاتصال.");
  }finally{if($("#sendPublicMessage"))$("#sendPublicMessage").disabled=false}
 }
 $("#sendPublicMessage").onclick=send;
 $("#publicMessageInput").onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}};
 await pull();refreshTimer=setInterval(()=>{if($("#publicMessages"))pull();else{clearInterval(refreshTimer);refreshTimer=null}},4000);
}
if($("#openPublicChat"))$("#openPublicChat").onclick=publicChat;


})();