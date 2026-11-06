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
function setNickname(value){const name=String(value||"").trim();if(!name)return;localStorage.setItem("sw_nickname",name);if(typeof window.setSuwadNickname==="function")window.setSuwadNickname(name);else if($("#profileName"))$("#profileName").textContent=name;applyProfileAvatar(me?.avatar_url)}
if(ready){db=window.supabase.createClient(cfg.url,cfg.anonKey);authInit=db.auth.getSession().then(async x=>{if(x.error)throw x.error;sess=x.data.session||null;authReady=true;await loadMe()}).catch(e=>{authError=e;authReady=true;console.warn("auth initialization failed",e?.message||e)});db.auth.onAuthStateChange((_e,s)=>{sess=s||null;me=null;authReady=true;Promise.resolve().then(()=>loadMe())})}else authReady=true;
window.__SUWAD_SOCIAL_CONTEXT=()=>({db,sess,me});
async function touchPresence(){if(!db||!sess?.user?.id||document.hidden)return;try{await db.from("profiles").update({last_seen_at:new Date().toISOString()}).eq("id",sess.user.id)}catch(e){console.warn("presence heartbeat failed",e?.message||e)}}
touchPresence();setInterval(touchPresence,45000);document.addEventListener("visibilitychange",()=>{if(!document.hidden)touchPresence()});
function modal(h){body.innerHTML=h;back.hidden=false;document.body.style.overflow="hidden";if(refreshTimer){clearInterval(refreshTimer);refreshTimer=null}}
function msg(t){const x=$("#toast");if(x){x.textContent=t;x.classList.add("show");setTimeout(()=>x.classList.remove("show"),2600)}else alert(t)}
function setupHint(){return '<div class="hint-box"><strong>إعداد Supabase مطلوب مرة واحدة:</strong><ol><li>أنشئ مشروعاً من <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">لوحة Supabase</a>.</li><li>فعّل Anonymous Sign-Ins، ثم ضع Project URL والمفتاح العام فقط في <code>backend-config.js</code>.</li><li>شغّل <a href="https://github.com/callmobile2004-source/suwad-wanasa/blob/main/supabase-schema.sql" target="_blank" rel="noopener noreferrer">supabase-schema.sql</a> كاملاً في SQL Editor.</li><li>إذا كان مشروعك مهيّأ من قبل، شغّل <a href="https://github.com/callmobile2004-source/suwad-wanasa/blob/main/supabase-public-chat-migration.sql" target="_blank" rel="noopener noreferrer">ترحيل الشات العام</a> مرة واحدة.</li><li>لتفعيل تعديل الاسم بأمان في قاعدة بيانات موجودة، شغّل <a href="https://github.com/callmobile2004-source/suwad-wanasa/blob/main/supabase-profile-name-migration.sql" target="_blank" rel="noopener noreferrer">ترحيل تعديل الاسم</a> مرة واحدة.</li><li>اضبط Site URL على <code>https://callmobile2004-source.github.io/suwad-wanasa/</code> في Authentication ثم URL Configuration.</li></ol><p><a href="https://github.com/callmobile2004-source/suwad-wanasa/blob/main/SUPABASE-SETUP.md" target="_blank" rel="noopener noreferrer">افتح دليل الإعداد الكامل</a>.</p><small>لا تضع service_role key أو أي مفتاح سري في ملفات الموقع.</small></div>'}
async function loadMe(){if(!db||!sess){me=null;return}const userId=sess.user.id;try{const r=await db.from("profiles").select("*").eq("id",userId).maybeSingle();if(r.error)throw r.error;if(sess?.user?.id!==userId)return;me=r.data||null;if(me){setNickname(me.display_name);applyProfileAvatar(me.avatar_url);touchPresence()}}catch(e){me=null;console.warn("profile load failed",e?.message||e)}}
function safeAvatarUrl(value){const url=String(value||"");return cfg.url&&url.startsWith(cfg.url+"/storage/v1/object/public/avatars/")?url:""}
function applyProfileAvatar(value){const avatar=$("#avatarMini");if(!avatar)return;const url=safeAvatarUrl(value);if(!url){avatar.textContent=[...(me?.display_name||localStorage.getItem("sw_nickname")||"و")][0]||"و";return}const img=document.createElement("img");img.src=url;img.alt="";img.loading="lazy";avatar.replaceChildren(img)}
async function loadProfileAchievements(){
 const root=$("#profileAchievementManager");if(!root||!db||!me)return;
 root.innerHTML='<div class="account-progress-loading">جارٍ تحميل إنجازاتك…</div>';
 try{
  const [catalog,earned]=await Promise.all([
   db.from("achievements").select("id,title,description,icon,requirement_games").order("requirement_games"),
   db.from("player_achievements").select("achievement_id").eq("user_id",me.id)
  ]);
  if(catalog.error)throw catalog.error;if(earned.error)throw earned.error;
  const own=new Set((earned.data||[]).map(x=>x.achievement_id));
  root.innerHTML='<div class="profile-achievement-head"><b>إنجازاتي</b><span>🏆 '+own.size+'/'+(catalog.data||[]).length+'</span></div><div class="profile-achievement-grid">'+(catalog.data||[]).map(a=>{const done=own.has(a.id);return '<article class="profile-achievement-item '+(done?'is-unlocked':'is-locked')+'"><span>'+esc(a.icon)+'</span><div><b>'+esc(a.title)+'</b><small>'+esc(a.description)+'</small><em>'+(done?'تم فتح الإنجاز ✓':'يُفتح بعد '+Number(a.requirement_games).toLocaleString('ar-IQ')+' ألعاب')+'</em></div></article>'}).join("")+'</div>';
 }catch(e){console.warn("profile achievements load failed",e);root.innerHTML='<p class="muted-note">تعذّر تحميل الإنجازات حالياً.</p>'}
}
async function loadProfileTitles(){
 const root=$("#profileTitleManager");if(!root||!db||!me)return;
 root.innerHTML='<div class="account-progress-loading">جارٍ تحميل الألقاب المجانية…</div>';
 try{
  const [catalog,owned,stats]=await Promise.all([
   db.from("profile_titles").select("id,title,description,icon,requirement_games,requirement_xp").eq("is_active",true).order("requirement_games").order("requirement_xp"),
   db.from("player_titles").select("title_id").eq("user_id",me.id),
   db.from("player_leaderboard").select("xp,games_completed").eq("user_id",me.id).maybeSingle()
  ]);
  if(catalog.error)throw catalog.error;if(owned.error)throw owned.error;if(stats.error)throw stats.error;
  const unlocked=new Set((owned.data||[]).map(x=>x.title_id)),progress=stats.data||{xp:0,games_completed:0};
  const choices=(catalog.data||[]).filter(t=>unlocked.has(t.id));
  const current=(catalog.data||[]).find(t=>t.id===me.equipped_title_id);
  root.innerHTML='<div class="profile-title-head"><div><b>الألقاب المجانية</b><small>افتحها باللعب والإنجاز، بدون شراء أو دفع.</small></div><span>🏅 '+unlocked.size+'/'+(catalog.data||[]).length+'</span></div>'+
   '<div class="profile-title-equip"><label for="equippedTitle">لقبك الظاهر</label><select id="equippedTitle"><option value="">بدون لقب</option>'+choices.map(t=>'<option value="'+esc(t.id)+'" '+(me.equipped_title_id===t.id?'selected':'')+'>'+esc(t.icon)+' '+esc(t.title)+'</option>').join("")+'</select><button type="button" class="btn btn-gold full-btn" id="saveEquippedTitle">حفظ اللقب</button></div>'+
   '<div class="profile-title-grid">'+(catalog.data||[]).map(t=>{const on=unlocked.has(t.id),gamesLeft=Math.max(0,Number(t.requirement_games)-Number(progress.games_completed||0)),xpLeft=Math.max(0,Number(t.requirement_xp)-Number(progress.xp||0)),task=[];if(Number(t.requirement_games)>0)task.push(gamesLeft?('باقي '+gamesLeft+' لعبة'):'شرط الألعاب مكتمل');if(Number(t.requirement_xp)>0)task.push(xpLeft?('باقي '+xpLeft+' نقطة خبرة'):'شرط الخبرة مكتمل');return '<article class="profile-title-item '+(on?'is-unlocked':'is-locked')+'"><span>'+esc(t.icon)+'</span><div><b>'+esc(t.title)+'</b><small>'+esc(t.description)+'</small><em>'+(on?'تم فتحه ✓':esc(task.join(' • ')))+'</em></div></article>'}).join("")+'</div>';
  $("#saveEquippedTitle").onclick=async()=>{const button=$("#saveEquippedTitle"),value=$("#equippedTitle").value||null;button.disabled=true;try{const r=await db.from("profiles").update({equipped_title_id:value}).eq("id",me.id).select("id,equipped_title_id").single();if(r.error)throw r.error;me={...me,...r.data};msg("تم تحديث لقبك الظاهر.");loadProfileTitles()}catch(e){msg(e.message||"تعذّر حفظ اللقب.")}finally{if($("#saveEquippedTitle"))$("#saveEquippedTitle").disabled=false}};
 }catch(e){console.warn("profile titles load failed",e);root.innerHTML='<p class="muted-note">تعذّر تحميل الألقاب. حدّث الصفحة إذا استمرت المشكلة.</p>'}
}
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
 if(sess&&me){
 const avatar=safeAvatarUrl(me.avatar_url),avatarMarkup=avatar?'<img src="'+esc(avatar)+'" alt="الصورة الشخصية">':'<span>✦</span>';
 const currentTitle=me.equipped_title_id||"";
 modal(`<span class="pill">ملف اللاعب الحقيقي</span><div class="profile-hero"><div class="profile-avatar-large" id="profileAvatarPreview">${avatarMarkup}</div><div><h2 id="modalTitle">${esc(me.display_name)}</h2><p dir="ltr">@${esc(me.username)}</p><small>معرّف الصداقة: ${esc(me.friend_code)}</small></div></div>
 <div class="profile-identity-card"><div><span>المعرّف الفريد</span><b dir="ltr">@${esc(me.username)}</b></div><div><span>معرّف الصداقة</span><b>${esc(me.friend_code)}</b></div></div>
 <div class="field"><label for="profileAvatarFile">صورتك الشخصية</label><input id="profileAvatarFile" type="file" accept="image/jpeg,image/png,image/webp"><small class="muted-note">JPG أو PNG أو WebP، بحد أقصى 3 ميغابايت.</small></div><button type="button" class="btn btn-gold full-btn" id="uploadProfileAvatar">رفع الصورة الشخصية</button><p id="avatarFeedback" class="muted-note" role="status" aria-live="polite"></p>
 <div id="accountProgress" class="account-progress-slot"></div><button class="btn btn-ghost full-btn" id="openAllProgress">الإنجازات والمتصدرون</button>
 <div class="field"><label for="editDisplayName">اسم العرض</label><input id="editDisplayName" maxlength="24" value="${esc(me.display_name)}" autocomplete="nickname"></div>
 <div class="field"><label for="editUsername">معرّفك الفريد (بالإنكليزي)</label><input id="editUsername" maxlength="20" value="${esc(me.username)}" dir="ltr" autocomplete="username"><small class="muted-note">من 3 إلى 20 حرفاً أو رقماً أو شرطة سفلية، ويجب أن يكون غير مستخدم.</small></div>
 <button class="btn btn-gold full-btn" id="saveDisplayName">حفظ بيانات الملف</button><p id="nameFeedback" class="muted-note" role="status" aria-live="polite"></p>
 <section id="profileAchievementManager" class="profile-achievement-manager"></section><section id="profileTitleManager" class="profile-title-manager"></section>
 <div class="modal-actions"><button class="btn btn-ghost" id="copyCode">نسخ معرّف الصداقة</button><button class="btn btn-ghost" id="copyUsername">نسخ المعرّف</button></div>`);
 loadAccountProgression();loadProfileTitles();loadProfileAchievements();
 $("#openAllProgress").onclick=()=>{back.hidden=true;document.body.style.overflow="";const panel=document.querySelector("#progression");if(panel)panel.hidden=false;location.hash="#progression";panel?.scrollIntoView({behavior:"smooth",block:"start"})};
 $("#profileAvatarFile").onchange=()=>{const file=$("#profileAvatarFile").files?.[0],preview=$("#profileAvatarPreview");if(!file||!preview)return;if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>3145728){$("#avatarFeedback").textContent="اختار صورة JPG أو PNG أو WebP أصغر من 3 ميغابايت.";return}const url=URL.createObjectURL(file);preview.innerHTML='<img src="'+url+'" alt="معاينة الصورة الشخصية">';$("#avatarFeedback").textContent="هاي معاينة الصورة قبل الرفع."};
 $("#uploadProfileAvatar").onclick=async()=>{const input=$("#profileAvatarFile"),button=$("#uploadProfileAvatar"),feedback=$("#avatarFeedback"),file=input.files?.[0];if(!file){feedback.textContent="اختار صورة أولاً.";return}if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>3145728){feedback.textContent="الصورة لازم تكون JPG أو PNG أو WebP وأقل من 3 ميغابايت.";return}const userId=sess?.user?.id;if(!userId||userId!==me.id){feedback.textContent="انتهت جلسة الحساب؛ سجّل الدخول من جديد.";return}button.disabled=true;feedback.textContent="جارٍ رفع الصورة…";try{const path=userId+"/avatar";const up=await db.storage.from("avatars").upload(path,file,{upsert:true,contentType:file.type,cacheControl:"0"});if(up.error)throw up.error;const publicUrl=db.storage.from("avatars").getPublicUrl(path).data.publicUrl+"?v="+Date.now();const saved=await db.from("profiles").update({avatar_url:publicUrl}).eq("id",userId).select("id,avatar_url").single();if(saved.error)throw saved.error;if(sess?.user?.id!==userId)throw new Error("تغيّرت جلسة الحساب؛ أعد فتح الملف.");me={...me,...saved.data};applyProfileAvatar(me.avatar_url);feedback.textContent="تم حفظ صورتك الشخصية.";account()}catch(e){feedback.textContent=e.message||"تعذّر رفع الصورة. تحقق من اتصالك وصلاحيات التخزين."}finally{if($("#uploadProfileAvatar"))$("#uploadProfileAvatar").disabled=false}};
 $("#saveDisplayName").onclick=async()=>{const input=$("#editDisplayName"),handle=$("#editUsername"),button=$("#saveDisplayName"),feedback=$("#nameFeedback"),display=input.value.trim(),username=handle.value.trim().toLowerCase();if([...display].length<2||[...display].length>24){feedback.textContent="الاسم لازم يكون من حرفين إلى ٢٤ حرفاً.";return}if(/[\x00-\x1F\x7F]/u.test(display)){feedback.textContent="احذف الرموز غير المسموحة من الاسم.";return}if(!/^[a-z0-9_]{3,20}$/.test(username)){feedback.textContent="المعرّف لازم يكون 3 إلى 20 حرفاً أو رقماً أو شرطة سفلية.";return}button.disabled=true;feedback.textContent="جارٍ حفظ بيانات الملف…";try{const userId=sess?.user?.id;if(!userId||userId!==me.id)throw new Error("انتهت جلسة الدخول. سجّل الدخول من جديد.");const r=await db.from("profiles").update({display_name:display,username}).eq("id",userId).select("id,display_name,username,friend_code").single();if(r.error)throw r.error;if(sess?.user?.id!==userId)throw new Error("تغيّرت جلسة الحساب؛ أعد فتح الملف.");me={...me,...r.data};setNickname(me.display_name);account();msg("تم تحديث اسمك ومعرّفك.")}catch(e){feedback.textContent=e.message||"تعذّر حفظ بيانات الملف. قد يكون المعرّف مستخدماً بالفعل."}finally{if($("#saveDisplayName"))$("#saveDisplayName").disabled=false}};
 $("#copyCode").onclick=async()=>{try{await navigator.clipboard.writeText(me.friend_code);msg("تم نسخ معرّف الصداقة")}catch{msg("معرّف الصداقة: "+me.friend_code)}};
 $("#copyUsername").onclick=async()=>{try{await navigator.clipboard.writeText("@"+me.username);msg("تم نسخ المعرّف")}catch{msg("المعرّف: @"+me.username)}};
 return
}
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
 await loadFriendSections();refreshTimer=setInterval(()=>{if($("#friendSections"))loadFriendSections();else{clearInterval(refreshTimer);refreshTimer=null}},20000);
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
   const p=await db.from("profiles").select("username,display_name,friend_code,last_seen_at").eq("id",id).maybeSingle();
   if(p.data)rows.push({id,p:p.data});
  }
  h+=rows.length
   ? rows.map(x=>`<div class="friend-row"><span class="friend-avatar">✦</span><span>${esc(x.p.display_name)} <small dir="ltr">@${esc(x.p.username)} • ${esc(x.p.friend_code)}</small><small class="presence-label ${x.p.last_seen_at&&Date.now()-new Date(x.p.last_seen_at).getTime()<90000?"is-online":"is-offline"}">${x.p.last_seen_at&&Date.now()-new Date(x.p.last_seen_at).getTime()<90000?"متصل الآن":"غير متصل"}</small></span><button class="friend-open" data-chat="${esc(x.id)}" data-name="${esc(x.p.display_name)}">راسل</button>${window.__SUWAD_ACTIVE_ROOM?.()?`<button class="friend-open" data-invite-game="${esc(x.id)}">دعوة للعب</button>`:""}</div>`).join("")
   : '<p class="empty-friends">أصدقاؤك راح يظهرون بعد قبول الطلبات.</p>';
  box.innerHTML=h;
  box.querySelectorAll("[data-accept]").forEach(b=>b.onclick=async()=>{
   const r=await db.from("friend_requests").update({status:"accepted"}).eq("id",b.dataset.accept).eq("receiver_id",sess.user.id);
   if(r.error){msg(r.error.message);return}
   await loadFriendSections();msg("تم قبول طلب الصداقة!");
  });
  box.querySelectorAll("[data-decline]").forEach(b=>b.onclick=async()=>{const r=await db.from("friend_requests").update({status:"declined"}).eq("id",b.dataset.decline).eq("receiver_id",sess.user.id);if(r.error){msg("تعذّر رفض الطلب: "+r.error.message);return}await loadFriendSections();msg("تم رفض طلب الصداقة.")});
  box.querySelectorAll("[data-chat]").forEach(b=>b.onclick=()=>chat(b.dataset.chat,b.dataset.name));
  box.querySelectorAll("[data-invite-game]").forEach(b=>b.onclick=async()=>{const active=window.__SUWAD_ACTIVE_ROOM?.();if(!active){msg("افتح غرفة لعب أولاً حتى ترسل الدعوة.");return}b.disabled=true;try{const sent=await db.from("game_invites").insert({room_id:active.id,sender_id:sess.user.id,receiver_id:b.dataset.inviteGame});if(sent.error)throw sent.error;msg("تم إرسال دعوة اللعب إلى صديقك.")}catch(e){msg(e.message||"تعذّر إرسال الدعوة. تأكد أنكما صديقان وأنك داخل الغرفة.")}finally{b.disabled=false}});
 }catch(e){
  box.innerHTML='<p class="hint-box">تعذّر تحميل القائمة: '+esc(e.message)+'. تأكد من تطبيق ملف SQL.</p>';
 }
}
async function chat(id,name){
 if(!db||!sess)return account();
 modal('<span class="pill">محادثة خاصة</span><h2 id="modalTitle">سوالف ويّا '+esc(name)+'</h2><p class="muted-note">المحادثة خاصة بين الحسابين. لا ترسل معلومات حساسة.</p><div class="chat-messages" id="realMessages"><div class="chat-empty">جارٍ تحميل الرسائل…</div></div><div class="chat-compose"><input id="realMessageInput" maxlength="1000" placeholder="اكتب رسالتك…" autocomplete="off"><button class="btn btn-gold" id="sendRealMessage">إرسال</button></div><p class="muted-note" id="privateChatStatus" role="status" aria-live="polite"></p>');
 let loading=false,sending=false;
 async function pull(){const area=$("#realMessages");if(!area||loading)return;loading=true;try{const r=await db.from("messages").select("id,sender_id,body,created_at,edited_at").or("and(sender_id.eq."+sess.user.id+",receiver_id.eq."+id+"),and(sender_id.eq."+id+",receiver_id.eq."+sess.user.id+")").order("created_at",{ascending:true}).limit(100);if(r.error)throw r.error;if(!$("#realMessages"))return;area.innerHTML=r.data.length?r.data.map(m=>'<div class="chat-bubble '+(m.sender_id===sess.user.id?"chat-mine":"")+'"><small>'+(m.sender_id===sess.user.id?"أنت":esc(name))+' • '+esc(new Date(m.created_at).toLocaleTimeString("ar-IQ",{hour:"2-digit",minute:"2-digit"}))+(m.edited_at?" • تم التعديل":"")+'</small><p>'+esc(m.body)+'</p>'+(m.sender_id===sess.user.id?'<button type="button" class="chat-edit-btn" data-edit-private="'+esc(m.id)+'">تعديل</button>':"")+'</div>').join(""):'<div class="chat-empty">ابدأوا أول سالفة ✨</div>';area.querySelectorAll("[data-edit-private]").forEach(b=>b.onclick=async()=>{const row=r.data.find(x=>x.id===b.dataset.editPrivate);if(!row)return;const value=prompt("عدّل رسالتك:",row.body);if(value===null||!value.trim()||value.trim().length>1000)return;const saved=await db.from("messages").update({body:value.trim()}).eq("id",row.id).eq("sender_id",sess.user.id).select("id").maybeSingle();if(saved.error||!saved.data){msg(saved.error?.message||"ما قدرنا نعدّل الرسالة.");return}await pull()});area.scrollTop=area.scrollHeight;const st=$("#privateChatStatus");if(st)st.textContent="آخر تحديث "+new Date().toLocaleTimeString("ar-IQ",{hour:"2-digit",minute:"2-digit"})}catch(e){const st=$("#privateChatStatus");if(st)st.textContent="تعذّر تحديث المحادثة: "+(e.message||"تحقق من الاتصال وسياسات الأصدقاء.")}finally{loading=false}}
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
 function setAiStatus(message,keepMs=20000){if(!status)return;status.textContent=message;status.dataset.aiUntil=String(Date.now()+keepMs)}
 const missing=e=>/public_messages|relation .* does not exist|schema cache|could not find the table|PGRST205|42P01/i.test(String(e?.message||e||""));
 function errorText(e,action){const m=String(e?.message||"تحقق من الاتصال.");if(missing(e))return "قاعدة البيانات قديمة: شغّل supabase-public-chat-migration.sql مرة واحدة في SQL Editor.";if(/rate|wait|ثانيتين|2 seconds/i.test(m))return "تم إرسال رسالة قبل لحظات؛ انتظر ثانيتين ثم أعد المحاولة.";if(/row-level security|permission denied|42501/i.test(m))return "صلاحيات الشات غير مفعّلة. أعد تشغيل ملف ترحيل الشات العام.";return "تعذّر "+action+": "+m}
 async function pull(){const area=$("#publicMessages");if(!area||loading)return;loading=true;try{const r=await db.from("public_messages").select("id,sender_id,body,created_at,edited_at").order("created_at",{ascending:false}).limit(100);if(r.error)throw r.error;const rows=(r.data||[]).reverse(),ids=[...new Set(rows.map(x=>x.sender_id))];let names={};if(ids.length){const pr=await db.from("profiles").select("id,display_name").in("id",ids);if(!pr.error)(pr.data||[]).forEach(p=>names[p.id]=p.display_name)}if(!$("#publicMessages"))return;const replyResult=rows.length?await db.from("public_chat_ai_replies").select("message_id,response").in("message_id",rows.map(x=>x.id)):({data:[]});const replies=new Map((replyResult.data||[]).map(x=>[x.message_id,x.response]));area.innerHTML=rows.length?rows.map(m=>'<div class="chat-bubble '+(m.sender_id===sess.user.id?"chat-mine":"")+'"><small>'+esc(names[m.sender_id]||"عضو اللمة")+' • '+esc(new Date(m.created_at).toLocaleTimeString("ar-IQ",{hour:"2-digit",minute:"2-digit"}))+(m.edited_at?" • تم التعديل":"")+'</small><p>'+esc(m.body)+'</p>'+(m.sender_id===sess.user.id?'<button type="button" class="chat-edit-btn" data-edit-public="'+esc(m.id)+'">تعديل</button>':"")+(replies.has(m.id)?'<div class="ai-reply"><b>🤖 مساعد الوناسة</b><p>'+esc(replies.get(m.id))+'</p></div>':"")+'</div>').join(""):'<div class="chat-empty">بعد ماكو رسائل. افتحوا السالفة! ✨</div>';area.querySelectorAll("[data-edit-public]").forEach(b=>b.onclick=async()=>{const row=rows.find(x=>x.id===b.dataset.editPublic);if(!row)return;const value=prompt("عدّل رسالتك:",row.body);if(value===null||!value.trim()||value.trim().length>500)return;const saved=await db.from("public_messages").update({body:value.trim()}).eq("id",row.id).eq("sender_id",sess.user.id).select("id").maybeSingle();if(saved.error||!saved.data){msg(saved.error?.message||"ما قدرنا نعدّل الرسالة.");return}await pull()});area.scrollTop=area.scrollHeight;const st=$("#publicChatStatus");if(st&&Date.now()>=Number(st.dataset.aiUntil||0))st.textContent="آخر تحديث "+new Date().toLocaleTimeString("ar-IQ",{hour:"2-digit",minute:"2-digit"})+" • مزامنة تلقائية"}catch(e){if(status)status.textContent=errorText(e,"تحميل الرسائل");console.warn("public chat load failed",e)}finally{loading=false}}
 async function send(){const input=$("#publicMessageInput"),button=$("#sendPublicMessage"),value=input?.value.trim();if(!value||sending)return;if([...value].length>500){if(status)status.textContent="الرسالة طويلة؛ الحد ٥٠٠ حرف.";return}sending=true;if(button)button.disabled=true;try{const r=await db.from("public_messages").insert({sender_id:sess.user.id,body:value}).select("id").single();if(r.error)throw r.error;if(input)input.value="";await pull();if(/@مساعد_الوناسة|@مساعد|@wanasaai/i.test(value)){setAiStatus("🤖 مساعد الوناسة يفكر…",120000);const ai=await db.functions.invoke("wanasa-ai",{body:{mode:"public_chat",messageId:r.data.id}});if(ai.error){const httpStatus=ai.error?.context?.status;setAiStatus("انرسلت رسالتك، لكن المساعد ما قدر يرد"+(httpStatus?" (HTTP "+httpStatus+")":"")+": "+(ai.error.message||"راجع إعدادات المساعد وسجلاته."),30000);console.warn("wanasa AI request failed",{status:httpStatus||null,message:ai.error.message||"unknown"});}else{await pull();setAiStatus("🤖 مساعد الوناسة ردّ عليك.",15000)}}}catch(e){if(status)status.textContent=errorText(e,"إرسال الرسالة")}finally{sending=false;if($("#sendPublicMessage"))$("#sendPublicMessage").disabled=false}}
 $("#sendPublicMessage").onclick=send;$("#publicMessageInput").onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}};await pull();refreshTimer=setInterval(()=>{if($("#publicMessages"))pull();else{clearInterval(refreshTimer);refreshTimer=null}},4000);
}

if($("#openPublicChat"))$("#openPublicChat").onclick=publicChat;

async function openAiLab(){
 if(!db||!sess){account();return}
 if(!authReady){modal('<h2 id="modalTitle">غرفة التجارب</h2><p class="muted-note">جارٍ التحقق من حسابك…</p>');await authInit}
 if(!sess){account();return}
 modal('<span class="pill">مساحة خاصة بحسابك فقط</span><h2 id="modalTitle">🧪 غرفة التجارب</h2><p class="muted-note">كل ما تكتبه هنا يبقى في محادثتك الخاصة مع مساعد الوناسة. لا يُرسل إلى الشات العام ولا يظهر للأصدقاء.</p><div id="aiLabStatus" class="muted-note" role="status" aria-live="polite">جارٍ تحميل محادثتك الخاصة…</div><div class="chat-messages" id="aiLabMessages"><div class="chat-empty">جارٍ تحميل التجارب…</div></div><div class="chat-compose"><input id="aiLabInput" maxlength="1000" placeholder="اكتب للمساعد هنا، بشكل خاص…" autocomplete="off"><button class="btn btn-gold" id="aiLabSend">إرسال</button></div><p class="muted-note">خصوصية الغرفة مفعّلة على مستوى الخادم. لا تستخدمها لإرسال كلمات مرور أو بيانات شديدة الحساسية.</p>');
 let sending=false,loading=false;
 const status=$("#aiLabStatus"),area=$("#aiLabMessages");
 const render=rows=>{if(!area)return;area.innerHTML=rows.length?rows.map(m=>'<div class="chat-bubble '+(m.role==="user"?"chat-mine":"")+'"><small>'+(m.role==="user"?"أنت":"🤖 مساعد الوناسة")+' • '+esc(new Date(m.created_at).toLocaleTimeString("ar-IQ",{hour:"2-digit",minute:"2-digit"}))+'</small><p>'+esc(m.body)+'</p></div>').join(""):'<div class="chat-empty">هذه مساحة تجاربك الخاصة. اكتب أول رسالة للمساعد ✨</div>';area.scrollTop=area.scrollHeight};
 async function history(){if(loading||!$("#aiLabMessages"))return;loading=true;try{const r=await db.functions.invoke("wanasa-ai",{body:{mode:"private_chat",action:"history"}});if(r.error)throw r.error;render(r.data?.messages||[]);if(status)status.textContent="محادثتك الخاصة محفوظة بحسابك فقط."}catch(e){if(status)status.textContent="تعذّر تحميل غرفة التجارب: "+(e.message||"تحقق من الاتصال.")}finally{loading=false}}
 async function send(){const input=$("#aiLabInput"),button=$("#aiLabSend"),value=input?.value.trim();if(!value||sending)return;if([...value].length>1000){if(status)status.textContent="الرسالة طويلة؛ الحد ١٠٠٠ حرف.";return}sending=true;if(button)button.disabled=true;if(input)input.value="";if(status)status.textContent="🤖 مساعد الوناسة يقرأ رسالتك الخاصة…";try{const r=await db.functions.invoke("wanasa-ai",{body:{mode:"private_chat",action:"send",message:value}});if(r.error)throw r.error;await history();if(status)status.textContent="🤖 "+(r.data?.answer||"وصل رد المساعد.")}catch(e){await history();if(status)status.textContent="ما قدر المساعد يرد هالمرة: "+(e.message||"تحقق من الاتصال.")}finally{sending=false;if($("#aiLabSend"))$("#aiLabSend").disabled=false}}
 $("#aiLabSend").onclick=send;$("#aiLabInput").onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}};await history();
}
function ensureSocialActions(){
 const actions=document.querySelector(".top-actions");if(!actions||!db||!sess)return;
 if(!$("#socialNotificationsButton")){const b=document.createElement("button");b.id="socialNotificationsButton";b.type="button";b.className="icon-btn social-action-btn";b.setAttribute("aria-label","الإشعارات");b.title="الإشعارات";b.innerHTML="♧<span id=\"socialNotificationCount\" hidden></span>";actions.prepend(b);b.onclick=openNotifications}
 if(!$("#wanasaAiButton")){const b=document.createElement("button");b.id="wanasaAiButton";b.type="button";b.className="icon-btn social-action-btn";b.setAttribute("aria-label","مساعد الوناسة");b.title="مساعد الوناسة";b.textContent="🤖";actions.prepend(b);b.onclick=openAiHelper}
 if(!$("#wanasaAiLabButton")){const b=document.createElement("button");b.id="wanasaAiLabButton";b.type="button";b.className="icon-btn social-action-btn";b.setAttribute("aria-label","غرفة التجارب الخاصة");b.title="غرفة التجارب الخاصة";b.textContent="🧪";actions.prepend(b);b.onclick=openAiLab}
 refreshNotificationCount();
}
let notificationChannel=null,lastNotificationUser="";
async function refreshNotificationCount(){
 if(!db||!sess?.user?.id)return;
 const r=await db.from("notifications").select("id",{count:"exact",head:true}).is("read_at",null);
 if(r.error)return;
 const count=Number(r.count)||0,el=$("#socialNotificationCount");
 if(el){el.hidden=!count;el.textContent=count>99?"99+":String(count)}
}
async function openNotifications(){
 if(!db||!sess){account();return}
 modal('<span class="pill">تنبيهات اللمة</span><h2 id="modalTitle">إشعاراتك 🔔</h2><p class="modal-lead">طلبات الصداقة ودعوات اللعب تبقى محفوظة هنا حتى لو كنت خارج اللعبة.</p><div id="socialNotificationsList" class="social-notifications-list">جارٍ تحميل الإشعارات…</div>');
 const list=$("#socialNotificationsList");
 try{
  const r=await db.from("notifications").select("id,actor_id,notification_type,title,body,payload,read_at,created_at").order("created_at",{ascending:false}).limit(40);
  if(r.error)throw r.error;
  const rows=r.data||[];
  list.innerHTML=rows.length?rows.map(n=>'<article class="social-notification '+(n.read_at?"is-read":"")+'"><div><b>'+esc(n.title)+'</b><p>'+esc(n.body)+'</p><small>'+esc(new Date(n.created_at).toLocaleString("ar-IQ"))+'</small></div><button class="btn btn-ghost" data-notification="'+esc(n.id)+'" data-type="'+esc(n.notification_type)+'" data-payload="'+esc(JSON.stringify(n.payload||{}))+'">'+(n.notification_type==="game_invite"?"فتح الدعوة":"عرض")+'</button></article>').join(""):'<p class="empty-friends">ما عندك إشعارات حالياً.</p>';
  list.querySelectorAll("[data-notification]").forEach(b=>b.onclick=async()=>{
   const payload=JSON.parse(b.dataset.payload||"{}");
   await db.from("notifications").update({read_at:new Date().toISOString()}).eq("id",b.dataset.notification);
   if(b.dataset.type==="friend_request"){back.hidden=true;document.body.style.overflow="";friends();return}
   if(b.dataset.type==="game_invite"){
    const invite=await db.from("game_invites").select("id,room_id,status").eq("id",payload.game_invite_id).maybeSingle();
    if(invite.error||!invite.data||invite.data.status!=="pending"){msg("الدعوة انتهت أو لم تعد متاحة.");await refreshNotificationCount();return}
    const roomInfo=await db.from("game_rooms").select("room_code,status").eq("id",invite.data.room_id).maybeSingle();
    if(roomInfo.error||!roomInfo.data||!["waiting","playing"].includes(roomInfo.data.status)){msg("الغرفة لم تعد متاحة.");return}
    const accepted=await db.from("game_invites").update({status:"accepted",responded_at:new Date().toISOString()}).eq("id",invite.data.id).eq("receiver_id",sess.user.id);
    if(accepted.error){msg(accepted.error.message);return}
    back.hidden=true;document.body.style.overflow="";if(window.joinSuwadOnlineRoom)window.joinSuwadOnlineRoom(roomInfo.data.room_code);else msg("حدّث الصفحة حتى تفتح دعوة اللعب.");
   }
   await refreshNotificationCount();
  });
  const unread=rows.filter(n=>!n.read_at).map(n=>n.id);
  if(unread.length)await db.from("notifications").update({read_at:new Date().toISOString()}).in("id",unread);
  await refreshNotificationCount();
 }catch(e){list.innerHTML='<p class="hint-box">تعذّر تحميل الإشعارات. '+esc(e.message||"تحقق من إعداد قاعدة البيانات.")+'</p>'}
}
function openAiHelper(){
 if(!db||!sess){account();return}
 modal('<span class="pill">ذكاء اصطناعي</span><h2 id="modalTitle">مساعد الوناسة 🤖</h2><p class="modal-lead">اسأله عن قواعد الألعاب، أفكار التحديات، أو ساعدك تختار طريقة اللعب. وفي الشات العام نادِه بكتابة @مساعد.</p><div class="field"><label for="wanasaAiGame">اللعبة</label><select id="wanasaAiGame"><option value="who">خمن منو آني</option><option value="number">تخمين الرقم</option><option value="liar">برا السالفة</option><option value="yesno">ممنوع إي ولا</option><option value="most">منو الأكثر</option><option value="snakes">حية ودرج</option><option value="domino">دومينوا</option><option value="tavla">طاولي</option><option value="colors">كروت الألوان</option><option value="quiz">تحدي الأسئلة</option><option value="wheel">دولاب الوناسة</option></select></div><div class="field"><label for="wanasaAiQuestion">سؤالك</label><textarea id="wanasaAiQuestion" maxlength="700" placeholder="مثلاً: اقترح لنا ٥ أسئلة مضحكة للعبة…"></textarea></div><button class="btn btn-gold full-btn" id="askWanasaAi">اسأل المساعد</button><div id="wanasaAiAnswer" class="ai-answer" aria-live="polite"></div>');
 $("#askWanasaAi").onclick=async()=>{const b=$("#askWanasaAi"),q=$("#wanasaAiQuestion")?.value.trim(),out=$("#wanasaAiAnswer");if(!q){out.textContent="اكتب سؤالك أولاً.";return}b.disabled=true;out.textContent="المساعد يفكر…";try{const result=await db.functions.invoke("wanasa-ai",{body:{mode:"game_help",gameKey:$("#wanasaAiGame").value,question:q}});if(result.error)throw result.error;out.textContent=result.data?.answer||"ما وصل رد واضح."}catch(e){out.textContent=e.message||"تعذّر الاتصال بالمساعد. تأكد من إضافة مفتاح Gemini إلى أسرار Supabase."}finally{b.disabled=false}};
}
function watchSocialNotifications(){
 if(!db||!sess?.user?.id)return;
 if(lastNotificationUser===sess.user.id)return;
 lastNotificationUser=sess.user.id;ensureSocialActions();
 if(notificationChannel)db.removeChannel(notificationChannel);
 notificationChannel=db.channel("wanasa-notifications-"+sess.user.id).on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications",filter:"recipient_id=eq."+sess.user.id},payload=>{refreshNotificationCount();if("Notification"in window&&Notification.permission==="granted"&&document.hidden){try{new Notification(payload.new.title,{body:payload.new.body,icon:"./assets/icon.svg",tag:payload.new.id})}catch(e){}}}).subscribe();
}
setInterval(watchSocialNotifications,2500);


})();