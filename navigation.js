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
 if(footer)home.append(footer);
 gamePage.append(games);communityPage.append(community);
 extras.insertAdjacentHTML("beforeend","<section class=\"extras-tools\"><article class=\"extras-tool-card\"><span class=\"extras-tool-icon\">🤖</span><div><h2>تدريب أوراس</h2><p>اختار اللعبة ومستوى التحدي، وابدأ تجربة فردية مستقلة.</p></div><label>اللعبة<select id=\"orasGame\"><option value=\"who\">خمّن منو آني؟</option><option value=\"number\">تخمين الرقم</option><option value=\"liar\">برا السالفة</option><option value=\"yesno\">ممنوع إي ولا</option><option value=\"most\">منو الأكثر؟</option><option value=\"snakes\">حيّة ودرج</option><option value=\"tavla\">طاولي</option><option value=\"colors\">كروت الألوان</option><option value=\"quiz\">تحدّي الأسئلة</option><option value=\"wheel\">الدولاب</option></select></label><label>مستوى الذكاء<select id=\"orasDifficulty\"><option value=\"easy\">سهل</option><option value=\"medium\" selected>متوسط</option><option value=\"hard\">صعب</option><option value=\"expert\">خبير</option></select></label><button type=\"button\" class=\"btn btn-gold\" id=\"startOrasPractice\">ابدأ التدريب</button></article><article class=\"extras-tool-card\"><span class=\"extras-tool-icon\">♫</span><div><h2>الصوت والمؤثرات</h2><p>تحكم بالأصوات والمؤثرات أثناء اللعب.</p></div><button type=\"button\" class=\"btn btn-ghost\" id=\"visibleSoundToggle\">تحميل حالة الصوت…</button><small class=\"extras-tool-note\">تفضيل الصوت يُحفظ على هذا الجهاز.</small></article></section>");
 const guide=document.createElement("div");guide.className="guide-page-content";if(how)guide.append(how);if(categories)guide.append(categories);extras.append(guide);
 const hiddenControls=document.createElement("div");hiddenControls.hidden=true;const audio=$("#hussainiAudioLauncher"),sound=$("#soundToggle");if(audio)hiddenControls.append(audio);if(sound)hiddenControls.append(sound);document.body.append(hiddenControls);
 const toggle=$("#menuToggle"),drawer=$("#siteDrawer"),scrim=$("#drawerScrim"),drawerClose=$("#drawerClose");
 if(!toggle||!drawer||!scrim||!drawerClose)throw new Error("Three-dot navigation controls are missing");
 toggle.textContent="⋮";toggle.setAttribute("aria-label","فتح قائمة الأقسام");toggle.setAttribute("aria-expanded","false");
 top.replaceChildren(profile,toggle);top.classList.add("profile-only-topbar");
 const drawerHead=$(".drawer-head",drawer);drawer.replaceChildren(drawerHead);
 const addDrawerLink=(label,icon,page,description="")=>{const a=document.createElement("a");a.href="#"+page.replace("Page","");a.className="drawer-destination";a.dataset.navPage=page;a.innerHTML='<span class="drawer-destination-icon">'+icon+'</span><span><b>'+label+'</b>'+(description?'<small>'+description+'</small>':'')+'</span><span class="drawer-chevron">‹</span>';drawer.append(a)};
 addDrawerLink("الرئيسية","⌂","homePage","الصفحة الرئيسية");
 addDrawerLink("الألعاب","🎮","gamesPage","كل الألعاب والأطوار");
 addDrawerLink("المجتمع والأصدقاء","♧","communityPage","الشات والأصدقاء والمحادثات");
 addDrawerLink("أوراس والأدوات","🤖","extrasPage","التدريب والصوت والإعدادات");
 const audioLink=document.createElement("button");audioLink.type="button";audioLink.className="drawer-destination";audioLink.dataset.drawerAudio="true";audioLink.innerHTML='<span class="drawer-destination-icon">♫</span><span><b>القصائد الحسينية</b><small>المكتبة الصوتية</small></span><span class="drawer-chevron">‹</span>';drawer.append(audioLink);
 const openDrawer=()=>{drawer.inert=false;drawer.setAttribute("aria-hidden","false");scrim.hidden=false;requestAnimationFrame(()=>drawer.classList.add("is-open"));toggle.setAttribute("aria-expanded","true");document.body.classList.add("drawer-open");drawerClose.focus({preventScroll:true})};
 const closeDrawer=()=>{drawer.classList.remove("is-open");drawer.setAttribute("aria-hidden","true");drawer.inert=true;scrim.hidden=true;toggle.setAttribute("aria-expanded","false");document.body.classList.remove("drawer-open");toggle.focus({preventScroll:true})};
 toggle.addEventListener("click",()=>toggle.getAttribute("aria-expanded")==="true"?closeDrawer():openDrawer());
 drawerClose.addEventListener("click",closeDrawer);scrim.addEventListener("click",closeDrawer);
 document.addEventListener("keydown",event=>{if(event.key==="Escape"&&toggle.getAttribute("aria-expanded")==="true")closeDrawer()});
 const pages=[home,gamePage,communityPage,extras];
 let current="homePage",lastPage="homePage",transitionSequence=0,transitionAnimations=[];
 pages.forEach(page=>{page.style.viewTransitionName="suwad-page"});
 function show(id,addHistory=true){
  if(!pages.some(p=>p.id===id))id="homePage";
  const target=pages.find(p=>p.id===id),source=pages.find(p=>p.id===current);
  if(id===current){if(addHistory){const url=new URL(location.href);url.hash=id==="homePage"?"":id.replace("Page","");history.pushState({suwadPage:id},"",url)}return}
  const sequence=++transitionSequence;
  transitionAnimations.forEach(animation=>{try{animation.cancel()}catch(_){}});transitionAnimations=[];
  const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
  const commit=()=>{
   if(sequence!==transitionSequence)return;
   pages.forEach(page=>{page.hidden=page.id!==id;page.classList.toggle("page-active",page.id===id)});
   current=id;lastPage=id;document.body.dataset.activePage=id;
   window.scrollTo({top:0,left:0,behavior:"instant"});
   const heading=$(".page-heading h1",target);if(heading){heading.setAttribute("tabindex","-1");heading.focus({preventScroll:true})}
  };
  if(reduced||!source||typeof source.animate!=="function"){commit()}
  else{
   const outgoing=source.animate(
    [{opacity:1,transform:"translate3d(0,0,0) scale(1)",filter:"blur(0)"},{opacity:0,transform:"translate3d(-26px,0,0) scale(.985)",filter:"blur(3px)"}],
    {duration:210,easing:"cubic-bezier(.4,0,.2,1)",fill:"both"}
   );
   transitionAnimations=[outgoing];
   outgoing.finished.then(()=>{
    if(sequence!==transitionSequence)return;
    commit();
    const incoming=target.animate(
     [{opacity:0,transform:"translate3d(30px,12px,0) scale(.975)",filter:"blur(4px)"},{opacity:1,transform:"translate3d(0,0,0) scale(1)",filter:"blur(0)"}],
     {duration:430,easing:"cubic-bezier(.16,1,.3,1)",fill:"both"}
    );
    transitionAnimations=[incoming];
    return incoming.finished;
   }).catch(()=>{});
  }
  if(addHistory){const url=new URL(location.href);url.hash=id==="homePage"?"":id.replace("Page","");history.pushState({suwadPage:id},"",url)}
 }
 document.addEventListener("click",e=>{if(e.target.closest("[data-drawer-audio]")){closeDrawer();audio?.click();return}const navPage=e.target.closest("[data-nav-page]");if(navPage){e.preventDefault();show(navPage.dataset.navPage);closeDrawer();return}if(e.target.closest("#visibleSoundToggle")){sound?.click();const b=$("#visibleSoundToggle");if(b)b.textContent=localStorage.getItem("sw_sound_enabled")==="false"?"تشغيل المؤثرات الصوتية":"كتم المؤثرات الصوتية";return}if(e.target.closest("#startOrasPractice")){const key=$("#orasGame")?.value||"who",level=$("#orasDifficulty")?.value||"medium";if(window.SuwadGameAIPractice?.start)window.SuwadGameAIPractice.start(key,level);else toast("تدريب أوراس غير جاهز حالياً");return}const go=e.target.closest("[data-page-go]");if(go){show(go.dataset.pageGo);return}if(e.target.closest("[data-go-home]")){show("homePage");return}if(e.target.closest("[data-open-audio]")){audio?.click();return}if(e.target.closest("[data-open-sound]")){show("extrasPage");return}if(e.target.closest("[data-open-ai]")){show("extrasPage");return}});
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