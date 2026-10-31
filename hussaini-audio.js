(() => {
"use strict";
const catalog = [
["مسافرين","مسلم الوائلي","qptvkF5hvsE","عزاء حسيني"],
["خويه عباس","سيد فاقد الموسوي","vH0cMgZDw70","محرم 1447"],
["ها يا مسلم","خضر عباس","BdA2la3Y_CQ","محرم 1446"],
["كل خطوة نمشيها","خضر عباس","rtIJEJU3nR4","للمشاية"],
["هذه أرض كربلا","جليل الكربلائي","je26HFc2BbU","من تراث المنبر"],
["يبن الزهره مشكور","مسلم الوائلي","rS1p2VytE8","قصيدة حسينية"],
["المايحب حسين","مسلم الوائلي","C62MbqYdKO8","هيئة الأئمة المعصومين"],
["فزاعيات","مسلم الوائلي","et8HXdPy574","قصيدة حسينية"],
["شهامة ومرجلة","مسلم الوائلي","K17h3Mht5Gc","قصيدة حسينية"],
["كون ياخذني الهوه","ميثم التمار","yKkxe9Kz7N4","زيارة الحسين"],
["آيا حسين","باسم الكربلائي","","قصيدة حسينية"],
["باجر","باسم الكربلائي","","ليلة 6 محرم"],
["قد ماتت فاطمة","مسلم الوائلي","","استشهاد السيدة الزهراء"],
["ياصاحبي","مسلم الوائلي","","قصيدة فاطمية"],
["أم گلبي انتي","مسلم الوائلي","","قصيدة حسينية"],
["شال الشهيد حسين","مسلم الوائلي","","تراث حسيني"],
["الفاتحة لحسين","مسلم الوائلي","","قصيدة حسينية"],
["الصبح عنك رايحة","مسلم الوائلي","","قصيدة حسينية"],
["راح الولد","مسلم الوائلي","","نعي حسيني"],
["عباس اكعد أتعبني","مسلم الوائلي","","نعي أبي الفضل العباس"],
["نذرت الماي","مسلم الوائلي","","نعي حسيني"],
["عابر ديرة ديرة","مسلم الوائلي","","هيئة أبي الشهداء"],
["كل خطوة نمشيها","خضر عباس","rtIJEJU3nR4","قصيدة المشاية"],
["إحرقوا دار الرسول","جليل الكربلائي","","قصيدة تراثية"],
["ريحانة الهادي","جليل الكربلائي","","قصيدة شور"],
["مصاب الضلع","جليل الكربلائي","","نعي فاطمي"],
["غصن الهيل","أحمد الساعدي","","قصيدة حسينية"],
["ياطيحة ولاية يمبچي الزلم","أحمد الساعدي","","قصيدة حسينية"],
["أين المفر","أحمد الفتلاوي","","قصيدة حسينية"],
["سورة الماي","أحمد الساعدي","","قصيدة حسينية"],
["حدايكم كتله توانه","علي الجابري","","قصيدة حسينية"],
["قراريع","علي الدلفي","","قصيدة حسينية"],
["ابن أمي","مرتضى حرب","","نعي حسيني"],
["شنهو صار","باسم الكربلائي","","قصيدة حسينية"],
["آخر رسالة","باسم الكربلائي","","قصيدة حسينية"],
["بالعافية","باسم الكربلائي","","قصيدة حسينية"],
["يا طير احچي منكس","سيد فاقد الموسوي","","قصيدة حسينية"],
["من العراق إلى الشام","كرار الكربلائي","","قصيدة حسينية"],
["الموت أمة بالنفس شلة","مدين العياشي","","قصيدة حسينية"],
["يا زينب","باسم الكربلائي","","مجالس حسينية"]
].map((x,i)=>({id:i+1,title:x[0],reciter:x[1],video:x[2],note:x[3]}));
let overlay, dock, frame, current=null, selectedReciter="الكل", query="";
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function ensure(){
 if($("#hussainiLibrary")) return;
 const button=$("#hussainiAudioLauncher");
 if(button) button.addEventListener("click",openLibrary);
 overlay=document.createElement("div");overlay.className="hussaini-library-backdrop";overlay.id="hussainiLibrary";overlay.hidden=true;
 overlay.innerHTML='<section class="hussaini-library" role="dialog" aria-modal="true" aria-labelledby="hussainiTitle"><header class="hussaini-library-head"><div><span class="audio-eyebrow">صوت العزاء الحسيني</span><h2 id="hussainiTitle">مكتبة <em>القصائد الحسينية</em></h2><p>اختار الرادود، تصفّح قصائده، وخلي الصوت مستمر أثناء اللعب.</p></div><button class="audio-close" id="hussainiClose" aria-label="إغلاق المكتبة">×</button></header><div class="audio-feature"><div class="audio-disc">♫</div><div><b>مجلسك على ذوقك</b><small>المشغّل يبقى موجود حتى إذا سكّرت المكتبة أو فتحت لعبة.</small></div><span class="audio-equalizer" aria-hidden="true"><i></i><i></i><i></i><i></i></span></div><div class="audio-filters"><label class="audio-search"><span>⌕</span><input id="hussainiSearch" type="search" placeholder="ابحث عن قصيدة أو رادود…"></label><select id="hussainiReciter" aria-label="اختيار الرادود"><option value="الكل">كل الرواديد</option></select><span class="audio-count" id="hussainiCount"></span></div><div class="audio-reciter-chips" id="hussainiChips"></div><div class="audio-track-list" id="hussainiTracks"></div><p class="audio-footnote">التشغيل داخل الموقع متاح للقصائد المرتبطة بمقاطع مضمّنة. لبقية العناوين، افتح نتيجة البحث على يوتيوب؛ ما نرفع الملفات الصوتية ولا نستضيفها بالموقع.</p></section>';
 document.body.appendChild(overlay);
 dock=document.createElement("aside");dock.className="hussaini-player-dock";dock.id="hussainiPlayerDock";dock.hidden=true;
 dock.innerHTML='<div class="audio-dock-art">♫</div><div class="audio-dock-meta"><b id="hussainiNowTitle">القصيدة</b><small id="hussainiNowReciter">الرادود</small><span class="audio-live-line"><i></i> المشغّل مستمر أثناء اللعب</span></div><button class="audio-dock-library" id="hussainiBackToLibrary" aria-label="فتح مكتبة القصائد" title="مكتبة القصائد">☷</button><button class="audio-dock-hide" id="hussainiHideDock" aria-label="إخفاء المشغّل" title="إخفاء المشغّل">−</button><div class="audio-player-frame" id="hussainiFrameHost"></div>';
 document.body.appendChild(dock);
 $("#hussainiClose").onclick=closeLibrary;
 overlay.addEventListener("click",e=>{if(e.target===overlay)closeLibrary()});
 $("#hussainiSearch").addEventListener("input",e=>{query=e.target.value.trim();renderTracks()});
 $("#hussainiReciter").addEventListener("change",e=>{selectedReciter=e.target.value;renderTracks();renderChips()});
 $("#hussainiBackToLibrary").onclick=openLibrary;
 $("#hussainiHideDock").onclick=()=>{dock.classList.toggle("dock-compact");$("#hussainiHideDock").textContent=dock.classList.contains("dock-compact")?"+":"−"};
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&overlay&&!overlay.hidden)closeLibrary()});
 const reciters=[...new Set(catalog.map(t=>t.reciter))];
 $("#hussainiReciter").innerHTML='<option value="الكل">كل الرواديد</option>'+reciters.map(r=>'<option>'+esc(r)+'</option>').join("");
 renderChips();renderTracks();
}
function renderChips(){
 const box=$("#hussainiChips");if(!box)return;
 const list=["الكل",...new Set(catalog.map(t=>t.reciter))];
 box.innerHTML=list.map(r=>'<button type="button" class="audio-chip '+(selectedReciter===r?'is-active':'')+'" data-reciter="'+esc(r)+'">'+esc(r)+'</button>').join("");
 box.querySelectorAll("[data-reciter]").forEach(b=>b.onclick=()=>{selectedReciter=b.dataset.reciter;$("#hussainiReciter").value=selectedReciter;renderChips();renderTracks()});
}
function renderTracks(){
 const box=$("#hussainiTracks");if(!box)return;
 const list=catalog.filter(t=>(selectedReciter==="الكل"||t.reciter===selectedReciter)&&(!query||(t.title+" "+t.reciter+" "+t.note).toLowerCase().includes(query.toLowerCase())));
 $("#hussainiCount").textContent=list.length+" قصيدة";
 box.innerHTML=list.map(t=>'<article class="audio-track '+(current?.id===t.id?'is-playing':'')+'"><span class="audio-track-number">'+String(t.id).padStart(2,"0")+'</span><button type="button" class="audio-track-play" data-track="'+t.id+'" aria-label="تشغيل '+esc(t.title)+'">'+(current?.id===t.id?'♫':'▶')+'</button><div class="audio-track-info"><b>'+esc(t.title)+'</b><small>'+esc(t.reciter)+' <span>•</span> '+esc(t.note)+'</small></div><span class="audio-track-status">'+(t.video?'تشغيل داخل الموقع':'بحث عن المصدر')+'</span></article>').join("")||'<p class="audio-empty">ماكو نتائج مطابقة. جرّب اسم ثاني.</p>';
 box.querySelectorAll("[data-track]").forEach(b=>b.onclick=()=>playTrack(catalog.find(t=>t.id===Number(b.dataset.track))));
}
function playTrack(track){
 if(!track)return;
 if(track.video){
   current=track;
   $("#hussainiNowTitle").textContent=track.title;$("#hussainiNowReciter").textContent=track.reciter;
   dock.hidden=false;dock.classList.remove("dock-compact");
   const host=$("#hussainiFrameHost");
   host.innerHTML='<iframe title="تشغيل '+esc(track.title)+' - '+esc(track.reciter)+'" src="https://www.youtube-nocookie.com/embed/'+encodeURIComponent(track.video)+'?autoplay=1&playsinline=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>';
   renderTracks();
 }else{
   const search=encodeURIComponent(track.title+" "+track.reciter+" قصيدة حسينية");
   window.open("https://www.youtube.com/results?search_query="+search,"_blank","noopener,noreferrer");
   if(typeof window.toast==="function") window.toast("فتحنا نتائج القصيدة على يوتيوب؛ التشغيل داخل الموقع متاح للعناوين المضمّنة.");
 }
}
function hostHasFrame(){return !!$("#hussainiFrameHost iframe")}
function openLibrary(){ensure();overlay.hidden=false;document.body.classList.add("audio-library-open");renderTracks()}
function closeLibrary(){if(overlay){overlay.hidden=true;document.body.classList.remove("audio-library-open")}}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",ensure);else ensure();
})();