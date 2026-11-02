(() => {
"use strict";
const cfg=window.SUWAD_BACKEND||{};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const section=document.createElement("section");
section.id="progression";
section.className="section wrap progression-section";
section.innerHTML='<div class="section-heading"><div><span class="eyebrow">تقدّمك محفوظ بحسابك</span><h2>إنجازات <em>ومتصدّرو الوناسة</em></h2></div><button type="button" class="btn btn-ghost progression-refresh" id="progressRefresh">تحديث البيانات</button></div><div id="progressContent" aria-live="polite"><div class="progress-loading">جارٍ تحميل سجل الوناسة…</div></div>';
const community=document.querySelector("#community");
if(community)community.parentNode.insertBefore(section,community);
const nav=document.querySelector(".top-nav");
if(nav&&!nav.querySelector('[href="#progression"]')){const a=document.createElement("a");a.href="#progression";a.textContent="الإنجازات";nav.append(a);}
const quick=document.querySelector(".quick-panel");
if(quick&&!document.querySelector("#quickProgression")){
 const item=document.createElement("button");item.type="button";item.id="quickProgression";item.className="quick-item";
 item.innerHTML='<span class="quick-icon gold">🏆</span><span><b>إنجازاتي والمتصدرون</b><small>شوف نقاطك وأوسمتك</small></span><span class="quick-arrow">‹</span>';
 item.addEventListener("click",()=>{location.hash="#progression";section.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});});
 quick.append(item);
}
const css=document.createElement("link");css.rel="stylesheet";css.href="progression.css?v=20261102-01";document.head.append(css);
const content=()=>document.querySelector("#progressContent");
let db=null,user=null,rows=[],achievements=[],unlocked=[],mode="xp";
function level(xp){return Math.floor(Math.max(0,Number(xp)||0)/100)+1}
function render(){
 const root=content();if(!root)return;
 const me=rows.find(x=>x.user_id===user?.id);
 const xp=Number(me?.xp||0),lv=level(xp),into=xp%100;
 const tabs=[["xp","النقاط"],["level","المستوى"],["achievement_count","الإنجازات"],["games_completed","الألعاب"]];
 const sorted=[...rows].sort((a,b)=>Number(b[mode]||0)-Number(a[mode]||0)||Number(b.xp||0)-Number(a.xp||0));
 const top=sorted.slice(0,20);
 const ownUnlocked=unlocked.filter(x=>x.user_id===user?.id).map(x=>x.achievement_id);
 root.innerHTML=
 '<div class="progress-overview">'+
 '<article class="progress-main-card"><div class="progress-card-top"><span class="progress-emblem">✦</span><span class="progress-label">مستواك الحالي</span></div><div class="progress-level-number">'+lv+'</div><h3>'+(me?esc(me.display_name):"سجّل دخولك حتى يظهر تقدمك")+'</h3><p class="progress-xp">'+xp.toLocaleString("ar-IQ")+' نقطة خبرة</p><div class="progress-meter"><span style="width:'+into+'%"></span></div><small>'+(100-into)+' نقطة للمستوى التالي</small></article>'+
 '<div class="progress-stats"><article><span>🎮</span><b>'+Number(me?.games_completed||0).toLocaleString("ar-IQ")+'</b><small>ألعاب مكتملة</small></article><article><span>🏅</span><b>'+Number(me?.achievement_count||0).toLocaleString("ar-IQ")+'</b><small>إنجازات مفتوحة</small></article><article><span>⭐</span><b>'+xp.toLocaleString("ar-IQ")+'</b><small>مجموع النقاط</small></article></div></div>'+
 '<div class="progress-columns"><section class="progress-panel"><div class="progress-panel-head"><div><span class="eyebrow">خطواتك وإنجازاتك</span><h3>سجل الأوسمة</h3></div><span class="progress-count">'+ownUnlocked.length+'/'+achievements.length+'</span></div><div class="achievement-grid">'+achievements.map(a=>{const on=ownUnlocked.includes(a.id);return '<article class="achievement-item '+(on?"is-unlocked":"is-locked")+'"><span class="achievement-icon">'+esc(a.icon)+'</span><div><b>'+esc(a.title)+'</b><p>'+esc(a.description)+'</p><small>'+(on?"تم فتح الإنجاز":"يُفتح عند إكمال "+Number(a.requirement_games).toLocaleString("ar-IQ")+" ألعاب")+'</small></div><span class="achievement-state">'+(on?"✓":"🔒")+'</span></article>'}).join("")+'</div></section>'+
 '<section class="progress-panel leaderboard-panel"><div class="progress-panel-head"><div><span class="eyebrow">نافس ربعك</span><h3>لوحة المتصدرين</h3></div><span class="progress-count">'+rows.length+' لاعب</span></div><div class="leaderboard-tabs">'+tabs.map(t=>'<button type="button" data-sort="'+t[0]+'" class="'+(mode===t[0]?"active":"")+'">'+t[1]+'</button>').join("")+'</div><ol class="leaderboard-list">'+(top.length?top.map((p,i)=>'<li class="'+(p.user_id===user?.id?"is-me":"")+'"><span class="leader-rank">'+(i+1)+'</span><span class="leader-avatar">'+esc((p.display_name||"؟").trim().slice(0,1))+'</span><span class="leader-name">'+esc(p.display_name||"لاعب")+'<small>المستوى '+Number(p.level||1)+'</small></span><b class="leader-score">'+Number(p[mode]||0).toLocaleString("ar-IQ")+'</b></li>').join(""):'<li class="progress-empty">ماكو نتائج لحد الآن. أكملوا ألعابكم حتى تبدأ المنافسة.</li>')+'</ol></section></div>'+
 '<p class="progress-footnote">تُحتسب نقاط المشاركة تلقائياً للألعاب المدعومة عند اكتمال الجولة. الأوسمة مرتبطة بعدد الألعاب المكتملة، ولا توجد مكافآت فوز غير متحققة.</p>';
 root.querySelectorAll("[data-sort]").forEach(b=>b.addEventListener("click",()=>{mode=b.dataset.sort;render()}));
}
async function load(){
 const root=content();if(!root)return;
 if(!window.supabase||!cfg.url||!cfg.anonKey){root.innerHTML='<div class="progress-empty">نظام الإنجازات يحتاج اتصال قاعدة البيانات.</div>';return}
 if(!db)db=window.supabase.createClient(cfg.url,cfg.anonKey);
 root.innerHTML='<div class="progress-loading">جارٍ تحديث النقاط والأوسمة…</div>';
 try{
  const session=await db.auth.getSession();if(session.error)throw session.error;user=session.data.session?.user||null;
  if(!user){rows=[];achievements=[];unlocked=[];root.innerHTML='<div class="progress-empty">سجّل دخولك من زر الملف الشخصي حتى نعرض نقاطك وأوسمتك ولوحة المتصدرين.</div>';return}
  const [lb,aa,ua]=await Promise.all([
   db.from("player_leaderboard").select("user_id,display_name,username,xp,games_completed,achievement_count,level").order("xp",{ascending:false}).limit(100),
   db.from("achievements").select("id,title,description,icon,requirement_games").order("requirement_games"),
   db.from("player_achievements").select("user_id,achievement_id")
  ]);
  if(lb.error)throw lb.error;if(aa.error)throw aa.error;if(ua.error)throw ua.error;
  rows=lb.data||[];achievements=aa.data||[];unlocked=ua.data||[];
  render();
 }catch(e){console.warn("progression load failed",e);root.innerHTML='<div class="progress-empty">تعذّر تحميل الإنجازات حالياً. تأكد من تطبيق ترحيل نظام التقدم في قاعدة البيانات، ثم اضغط تحديث.</div>'}
}
document.querySelector("#progressRefresh")?.addEventListener("click",load);
if("IntersectionObserver" in window){const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){load();observer.disconnect()}},{rootMargin:"160px"});observer.observe(section)}else load();
window.addEventListener("hashchange",()=>{if(location.hash==="#progression")load()});
window.addEventListener("focus",()=>{if(location.hash==="#progression")load()});
})();