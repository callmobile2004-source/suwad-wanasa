(()=>{"use strict";
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
function init(){
 const main=$("#home"),top=$("#home")&&$(".topbar"),profile=$("#profileButton"),footer=$(".footer");
 if(!main||!top||!profile)return;
 const hero=$(".hero",main),quick=$(".quick-wrap",main),community=$("#community"),games=$("#games"),how=$("#how"),categories=$("#categories");
 if(!hero||!quick||!community||!games)throw new Error("Standalone page setup: required existing sections are missing");
 const makePage=(id,title,subtitle)=>{const page=document.createElement("section");page.className="app-page";page.id=id;page.hidden=true;page.dataset.page=id;page.innerHTML='<div class="page-heading"><div><span class="page-kicker">سَـوَاد وناسة</span><h1>'+title+'</h1><p>'+subtitle+'</p></div><button class="page-home-button" type="button" data-go-home>⌂ الرئيسية</button></div>';return page};
 const home=makePage("homePage","مكان اللمة الحلوة","اختار وين تحب تروح، وكل تجربة إلها مساحتها الخاصة.");
 const gamePage=makePage("gamesPage","عالم الألعاب","اختار لعبة، وتفتح إلك بواجهة مستقلة بكل تفاصيلها.");
 const communityPage=makePage("communityPage","مجتمع الوناسة","تواصل ويا أصدقائك، وخلّ اللمة تستمر.");
 const extras=makePage("extrasPage","مساحات إضافية","كل خدمة بصفحة مستقلة، بدون زحمة الأيقونات.");
 home.hidden=false;
 main.replaceChildren(home,gamePage,communityPage,extras);
 home.append(hero,quick);
 const hub=document.createElement("section");hub.className="home-destinations";hub.innerHTML='<div class="hub-title"><span>مساحاتك</span><h2>كل شي بمكانه</h2><p>ماكو ألعاب متكدسة بالرئيسية. افتح القسم اللي تريده.</p></div><div class="destination-grid"><button class="destination-card destination-games" data-page-go="gamesPage"><span class="destination-art">🎮<i>✦</i><i>✧</i></span><b>الألعاب</b><small>كل لعبة بواجهة مستقلة</small><span class="destination-enter">استكشف الألعاب <b>‹</b></span></button><button class="destination-card destination-community" data-page-go="communityPage"><span class="destination-art">♧<i>✦</i><i>✧</i></span><b>المجتمع والأصدقاء</b><small>الشات العام والخاص والأصدقاء</small><span class="destination-enter">افتح المجتمع <b>‹</b></span></button><button class="destination-card destination-audio" data-open-audio><span class="destination-art">♫<i>✦</i><i>✧</i></span><b>مكتبة القصائد الحسينية</b><small>مجلسك الصوتي داخل الموقع</small><span class="destination-enter">افتح المكتبة <b>‹</b></span></button><button class="destination-card destination-ai" data-open-ai><span class="destination-art">🤖<i>✦</i><i>✧</i></span><b>تدريب أوراس</b><small>تحديات فردية ضد الذكاء الاصطناعي</small><span class="destination-enter">ابدأ التدريب <b>‹</b></span></button><button class="destination-card destination-settings" data-open-sound><span class="destination-art">♫<i>✦</i><i>✧</i></span><b>الصوت والمؤثرات</b><small>تحكم بأجواء اللعب</small><span class="destination-enter">إعدادات الصوت <b>‹</b></span></button></div>';
 home.append(hub);if(footer)home.append(footer);
 gamePage.append(games);communityPage.append(community);
 extras.insertAdjacentHTML("beforeend","<section class=\"extras-tools\"><article class=\"extras-tool-card\"><span class=\"extras-tool-icon\">🤖</span><div><h2>تدريب أوراس</h2><p>اختار اللعبة ومستوى التحدي، وابدأ تجربة فردية مستقلة.</p></div><label>اللعبة<select id=\"orasGame\"><option value=\"who\">خمّن منو آني؟</option><option value=\"number\">تخمين الرقم</option><option value=\"liar\">برا السالفة</option><option value=\"yesno\">ممنوع إي ولا</option><option value=\"most\">منو الأكثر؟</option><option value=\"snakes\">حيّة ودرج</option><option value=\"tavla\">طاولي</option><option value=\"colors\">كروت الألوان</option><option value=\"quiz\">تحدّي الأسئلة</option><option value=\"wheel\">الدولاب</option></select></label><label>مستوى الذكاء<select id=\"orasDifficulty\"><option value=\"easy\">سهل</option><option value=\"medium\" selected>متوسط</option><option value=\"hard\">صعب</option><option value=\"expert\">خبير</option></select></label><button type=\"button\" class=\"btn btn-gold\" id=\"startOrasPractice\">ابدأ التدريب</button></article><article class=\"extras-tool-card\"><span class=\"extras-tool-icon\">♫</span><div><h2>الصوت والمؤثرات</h2><p>تحكم بالأصوات والمؤثرات أثناء اللعب.</p></div><button type=\"button\" class=\"btn btn-ghost\" id=\"visibleSoundToggle\">تحميل حالة الصوت…</button><small class=\"extras-tool-note\">تفضيل الصوت يُحفظ على هذا الجهاز.</small></article></section>");
 const guide=document.createElement("div");guide.className="guide-page-content";if(how)guide.append(how);if(categories)guide.append(categories);extras.append(guide);
 const hiddenControls=document.createElement("div");hiddenControls.hidden=true;const audio=$("#hussainiAudioLauncher"),sound=$("#soundToggle");if(audio)hiddenControls.append(audio);if(sound)hiddenControls.append(sound);document.body.append(hiddenControls);
 top.replaceChildren(profile);top.classList.add("profile-only-topbar");
 const pages=[home,gamePage,communityPage,extras];
 let current="homePage",lastPage="homePage";
 function show(id,addHistory=true){if(!pages.some(p=>p.id===id))id="homePage";pages.forEach(p=>{p.hidden=p.id!==id;p.classList.toggle("page-active",p.id===id)});current=id;lastPage=id;document.body.dataset.activePage=id;window.scrollTo({top:0,behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});if(addHistory){const url=new URL(location.href);url.hash=id==="homePage"?"":id.replace("Page","");history.pushState({suwadPage:id},"",url)}}
 document.addEventListener("click",e=>{if(e.target.closest("#visibleSoundToggle")){sound?.click();const b=$("#visibleSoundToggle");if(b)b.textContent=localStorage.getItem("sw_sound_enabled")==="false"?"تشغيل المؤثرات الصوتية":"كتم المؤثرات الصوتية";return}if(e.target.closest("#startOrasPractice")){const key=$("#orasGame")?.value||"who",level=$("#orasDifficulty")?.value||"medium";if(window.SuwadGameAIPractice?.start)window.SuwadGameAIPractice.start(key,level);else toast("تدريب أوراس غير جاهز حالياً");return}const go=e.target.closest("[data-page-go]");if(go){show(go.dataset.pageGo);return}if(e.target.closest("[data-go-home]")){show("homePage");return}if(e.target.closest("[data-open-audio]")){audio?.click();return}if(e.target.closest("[data-open-sound]")){show("extrasPage");sound?.click();return}if(e.target.closest("[data-open-ai]")){show("extrasPage");return}});
 window.addEventListener("popstate",e=>show(e.state?.suwadPage||"homePage",false));
 const requested=location.hash.replace("#","");const route={games:"gamesPage",community:"communityPage",home:"homePage",extras:"extrasPage"}[requested];if(route)show(route,false);else show("homePage",false);
 // Existing game dialogs become full-screen, self-contained game experiences.
 const backdrop=$("#modalBackdrop"),dialog=backdrop?.querySelector(".modal"),content=$("#modalContent"),close=$("#modalClose"),back=$("#modalBackButton");
 if(dialog&&content){
  const head=document.createElement("header");head.className="standalone-game-head";head.innerHTML='<div class="standalone-game-title"><small>تجربة مستقلة</small><strong>اللعبة</strong></div><span class="standalone-game-live">● مباشر</span>';
  if(close){close.textContent="‹";close.setAttribute("aria-label","إغلاق اللعبة");head.append(close)}
  if(back)back.remove();
  dialog.prepend(head);
  const title=$(".standalone-game-title strong",head);
  const updateTitle=()=>{const t=$("#modalTitle",content);if(t?.textContent.trim())title.textContent=t.textContent.trim()};
  new MutationObserver(updateTitle).observe(content,{subtree:true,childList:true,characterData:true});
  const observer=new MutationObserver(()=>{const opened=!backdrop.hidden;document.body.classList.toggle("standalone-game-open",opened);if(opened){updateTitle();dialog.scrollTop=0}});
  observer.observe(backdrop,{attributes:true,attributeFilter:["hidden"]});
  updateTitle();
 }
 const audioObserver=new MutationObserver(()=>{const lib=$("#hussainiLibrary");document.body.classList.toggle("standalone-audio-open",!!lib&&!lib.hidden)});audioObserver.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["hidden"]});
 // Motion stickers are decorative and never block controls.
 const sticker=document.createElement("div");sticker.className="floating-sticker sticker-one";sticker.setAttribute("aria-hidden","true");sticker.textContent="✨";document.body.append(sticker);
 const sticker2=document.createElement("div");sticker2.className="floating-sticker sticker-two";sticker2.setAttribute("aria-hidden","true");sticker2.textContent="😂";document.body.append(sticker2);["🌟","🎈","🎮"].forEach((symbol,i)=>{const el=document.createElement("div");el.className="floating-sticker sticker-extra sticker-extra-"+i;el.setAttribute("aria-hidden","true");el.textContent=symbol;document.body.append(el)});const soundLabel=$("#visibleSoundToggle");if(soundLabel)soundLabel.textContent=localStorage.getItem("sw_sound_enabled")==="false"?"تشغيل المؤثرات الصوتية":"كتم المؤثرات الصوتية";
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();