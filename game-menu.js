(() => {
"use strict";
if (window.SuwadGameMenu) return;
const $ = (selector, root=document) => root.querySelector(selector);
const definitions = {
  who:{name:"خَمِّنْ مَنُو آني؟",description:"اسأل أوراس، حلّل التلميحات، واكتشف الشخصية أو الشيء السري.",icon:"🕵️",features:["تخمين ذكي","فئات متنوعة","تدريب فردي"]},
  number:{name:"تخمين الرقم",description:"اكتشف الرقم المخفي خطوة بخطوة، وتابع محاولاتك من نفس المكان.",icon:"🔢",features:["١ إلى ١٠٠","تلميحات أعلى وأقل","محاولات محفوظة"]},
  liar:{name:"بَرا السالفة",description:"اكتشف اللاعب الذي لا يعرف الكلمة السرية قبل أن تنكشف خطته.",icon:"🤥",features:["بطاقات سرية","نقاش وتخمين","لعبة جماعية"]},
  yesno:{name:"ممنوع إي ولا",description:"جاوب بسرعة من دون استخدام كلمتي إي ولا، واجمع نقاط اللمة.",icon:"🙊",features:["أسئلة سريعة","تحكيم جماعي","نقاط"]},
  most:{name:"مَنُو الأَكْثَر؟",description:"صوّتوا على الشخص الأقرب لكل موقف، وشاهدوا ترتيب الأصوات.",icon:"👀",features:["تصويت","عبارات متغيرة","نتيجة نهائية"]},
  snakes:{name:"حَيّة ودرج",description:"ارمِ النرد، اصعد السلالم، وابتعد عن الحيّات حتى تصل للمربع ١٠٠.",icon:"🐍",features:["لوحة واضحة","نرد متحرك","حركة متدرجة"]},
  domino:{name:"دومينوا",description:"طابق أطراف القطع، خطّط لحركاتك، وحاول تخلّص يدك قبل أوراس.",icon:"🁣",features:["قطع فعلية","دبل ستة","تدريب ضد أوراس"]},
  tavla:{name:"الطاولي الكلاسيكية",description:"لعبة الطاولة بقواعد الحركة والضرب والدخول من البار وإخراج الأحجار.",icon:"🎲",features:["٢٤ نقطة","١٥ حجر لكل لاعب","قواعد قانونية"]},
  colors:{name:"كروت الألوان",description:"طابق اللون أو الرقم، واستعمل كروت الحركة حتى تفوز بمباراة UNO.",icon:"🃏",features:["١٠٨ كروت","نداء UNO","مباراة إلى ٥٠٠"]},
  quiz:{name:"تحدّي الأسئلة",description:"اختبر معلوماتك، أجب عن الأسئلة، واجمع النقاط ضد أوراس أو الربع.",icon:"🧠",features:["معلومات عامة","اختيارات","نتيجة ونقاط"]},
  chess:{name:"الشطرنج",description:"خطط لكل نقلة، احمِ ملكك، وحقق كش مات بقواعد الشطرنج الكاملة.",icon:"♟️",features:["قواعد كاملة","ترقية وتبييت","محلي وأونلاين"]},
  wheel:{name:"دولاب الوناسة",description:"خلّ الدولاب يختار لكم لعبة، وابدأوا تحدياً جديداً مع الربع.",icon:"🎡",features:["اختيار عشوائي","لفة سينمائية","ألعاب متعددة"]}
};
const SAVE_SETTINGS_PREFIX="sw_game_settings_v1_";
const bypass=new WeakSet();
let overlay=null,current=null;
const modeLabels={local:"لعب محلي",online:"غرف أونلاين",ai:"تدريب ضد أوراس",dominoAI:"تدريب دومينوا"};
function safe(value){
 return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function getSettings(game){
 try{
  const value=JSON.parse(localStorage.getItem(SAVE_SETTINGS_PREFIX+game)||"null")||{};
  return {difficulty:["easy","medium","hard","expert"].includes(value.difficulty)?value.difficulty:"medium",
   tutorial:value.tutorial!==false,sound:localStorage.getItem("sw_sound_enabled")!=="false",motion:value.motion!==false};
 }catch{return {difficulty:"medium",tutorial:true,sound:true,motion:true}}
}
function setSettings(game,value){
 try{localStorage.setItem(SAVE_SETTINGS_PREFIX+game,JSON.stringify(value))}catch{}
}
function roomAvailable(game){
 try{
  const active=window.__SUWAD_ACTIVE_ROOM?.();
  const sameActive=!!active&&window.__SUWAD_ACTIVE_GAME?.gameKey===game&&window.__SUWAD_ACTIVE_GAME?.mode==="online";
  return sameActive||!!window.hasSuwadSavedRoom?.(game);
 }catch{return false}
}
function resumeKind(game,mode){
 if(mode==="online")return roomAvailable(game)?"online":null;
 if(mode==="ai")return window.SuwadGameAIPractice?.hasSavedGame?.(game)?"ai":null;
 if(mode==="dominoAI")return window.SuwadDominoPractice?.hasSaved?.()?"dominoAI":null;
 if(window.hasSuwadLocalGameSave?.(game))return "local";
 if(game==="domino"&&window.SuwadDominoPractice?.hasSaved?.())return "dominoAI";
 if(window.SuwadGameAIPractice?.hasSavedGame?.(game))return "ai";
 if(roomAvailable(game))return "online";
 return null;
}
function artwork(game,cls=""){
 return '<svg class="'+cls+'" viewBox="0 0 420 260" role="img" aria-label="'+safe(definitions[game]?.name||game)+'"><use href="./assets/game-art.svg#'+safe(game)+'"></use></svg>';
}
function injectCardArtwork(){
 document.querySelectorAll(".game-card").forEach(card=>{
  const key=String(card.id||"").replace(/^game-/,"");
  const visual=$(".game-visual",card);
  if(!definitions[key]||!visual||visual.querySelector(".swgm-card-art"))return;
  const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
  svg.setAttribute("class","swgm-card-art");
  svg.setAttribute("viewBox","0 0 420 260");
  svg.setAttribute("aria-hidden","true");
  const use=document.createElementNS("http://www.w3.org/2000/svg","use");
  use.setAttribute("href","./assets/game-art.svg#"+key);
  svg.append(use);visual.prepend(svg);visual.classList.add("has-swgm-art");
 });
}
function ensureOverlay(){
 if(overlay)return overlay;
 overlay=document.createElement("div");
 overlay.className="swgm-overlay";
 overlay.hidden=true;
 overlay.addEventListener("click",onOverlayClick);
 overlay.addEventListener("change",onSettingsChange);
 document.body.append(overlay);
 return overlay;
}
function option(action,number,title,description,disabled=false,primary=false,extraClass=""){
 return '<button type="button" class="swgm-option '+(primary?"swgm-option-primary ":"")+(extraClass||"")+'" data-action="'+action+'" '+(disabled?"disabled":"")+'><span class="swgm-option-number">'+number+'</span><span class="swgm-option-copy"><strong>'+title+'</strong><small>'+description+'</small></span><span class="swgm-option-mark">'+(disabled?"•":"●")+'</span></button>';
}
function openMenu(game,mode="local",button=null,difficultyOverride=null){
 if(!definitions[game])return false;
 closeMenu();
 current={game,mode,button};
 const d=definitions[game],s=getSettings(game);
 if(["easy","medium","hard","expert"].includes(difficultyOverride)){s.difficulty=difficultyOverride;setSettings(game,s)}
 const canResume=!!resumeKind(game,mode);
 const root=ensureOverlay();
 root.dataset.game=game;
 root.innerHTML='<div class="swgm-shell" dir="rtl"><header class="swgm-top"><div class="swgm-brand"><span class="swgm-brand-mark">س</span><span>سَـوَاد وناسة <small>تجربة لعبة مستقلة</small></span></div><div class="swgm-top-actions"><span class="swgm-mode">'+(modeLabels[mode]||"اللعبة")+'</span><button class="swgm-exit" type="button" data-action="exit">إغلاق</button></div></header><main class="swgm-content"><section class="swgm-art-panel"><span class="swgm-eyebrow">مستعد تبدي الوناسة؟</span><h1 class="swgm-title">'+safe(d.name)+'</h1><p class="swgm-subtitle">'+safe(d.description)+'</p><div class="swgm-art-stage">'+artwork(game)+'</div><div class="swgm-feature-list">'+d.features.map(x=>'<span>'+safe(x)+'</span>').join("")+'</div></section><section class="swgm-menu-panel"><div class="swgm-menu-heading"><small>القائمة الرئيسية للعبة</small><h2>اختار شتريد تسوي</h2></div><div class="swgm-menu-options">'+
 option("begin","01","بداية اللعبة","افتح إعداد الجولة وابدأ اللعب",false,true)+
 option("new","02","بداية جديدة","ابدأ من الصفر وتجاهل الحفظ السابق")+
 option("continue","03","تكملة",""+(canResume?"ارجع إلى آخر جولة محفوظة":"ماكو جولة محفوظة حالياً"),!canResume,false)+
 option("settings","04","إعدادات اللعبة","الصوت والشرح والحركة ومستوى التدريب",false,false,"swgm-option-settings")+
 '</div><p class="swgm-menu-foot">الحفظ يبقى على هذا الجهاز أو داخل غرفة الأونلاين حسب نوع اللعب. لا تُحذف بيانات أي لعبة أخرى عند بدء جولة جديدة.</p></section></main></div>';
 root.hidden=false;document.body.classList.add("swgm-menu-open");
 const closeButton=$('[data-action="exit"]',root);closeButton?.focus({preventScroll:true});
 return true;
}
function renderSettings(){
 if(!current||!overlay)return;
 const {game,mode}=current,d=definitions[game],s=getSettings(game);
 overlay.dataset.game=game;
 overlay.innerHTML='<div class="swgm-shell" dir="rtl"><header class="swgm-top"><div class="swgm-brand"><span class="swgm-brand-mark">س</span><span>سَـوَاد وناسة</span></div><button type="button" class="swgm-back" data-action="back">رجوع للقائمة</button></header><main class="swgm-content" style="grid-template-columns:1fr;max-width:800px;width:100%;margin:auto"><section class="swgm-settings-panel"><span class="swgm-eyebrow">'+safe(d.name)+'</span><h1>إعدادات اللعبة</h1><p class="swgm-settings-intro">تفضيلات مستقلة لهذه اللعبة، وتنحفظ على هذا الجهاز. تغيّر إعداد التدريب من دون المساس بقواعد اللعب أو بيانات الغرف.</p>'+
 '<div class="swgm-setting-row"><div class="swgm-setting-label"><strong>مستوى التدريب الافتراضي</strong><small>يُستخدم عند اختيار تدريب أوراس لهذه اللعبة.</small></div><select data-setting="difficulty"><option value="easy" '+(s.difficulty==="easy"?"selected":"")+'>سهل</option><option value="medium" '+(s.difficulty==="medium"?"selected":"")+'>متوسط</option><option value="hard" '+(s.difficulty==="hard"?"selected":"")+'>صعب</option><option value="expert" '+(s.difficulty==="expert"?"selected":"")+'>خبير</option></select></div>'+
 '<div class="swgm-setting-row"><div class="swgm-setting-label"><strong>شرح اللعبة قبل البداية</strong><small>اعرض التعليمات المصوّرة داخل اللعبة عند توفرها.</small></div><input class="swgm-toggle" type="checkbox" data-setting="tutorial" '+(s.tutorial?"checked":"")+'></div>'+
 '<div class="swgm-setting-row"><div class="swgm-setting-label"><strong>المؤثرات الصوتية</strong><small>تفضيل الصوت العام للموقع، ويُطبّق على جميع الألعاب.</small></div><input class="swgm-toggle" type="checkbox" data-setting="sound" '+(s.sound?"checked":"")+'></div>'+
 '<div class="swgm-setting-row"><div class="swgm-setting-label"><strong>الحركة والانتقالات</strong><small>أوقف الحركة الزخرفية والانتقالات لهذه الواجهة إذا تفضّل شاشة ثابتة.</small></div><input class="swgm-toggle" type="checkbox" data-setting="motion" '+(s.motion?"checked":"")+'></div>'+
 '<div class="swgm-settings-actions"><button type="button" data-action="back">إلغاء</button><button type="button" class="swgm-save-settings" data-action="save-settings">حفظ الإعدادات</button></div><p class="swgm-settings-note">إعداد الصوت والحركة عام على هذا الجهاز. مستوى التدريب والشرح خاصان باللعبة المحددة.</p></section></main></div>';
}
function syncGlobalSetting(name,value){
 if(name==="sound"){
  const currentSound=localStorage.getItem("sw_sound_enabled")!=="false";
  if(currentSound!==value)$("#soundToggle")?.click();
 }
 if(name==="motion"){
  try{localStorage.setItem("sw_game_motion_enabled",String(value))}catch{}
  document.body.classList.toggle("swgm-reduce-motion",!value);
 }
 if(name==="tutorial"&&current){
  try{
   const keys=["sw_local_tutorial_seen_"+current.game,"sw_online_tutorial_seen_"+current.game];
   keys.forEach(key=>value?localStorage.removeItem(key):localStorage.setItem(key,"1"));
  }catch{}
 }
}
function onSettingsChange(event){
 if(!current||!event.target.matches("[data-setting]"))return;
 const {game}=current,s=getSettings(game),name=event.target.dataset.setting;
 const value=name==="difficulty"?event.target.value:!!event.target.checked;
 s[name]=value;setSettings(game,s);syncGlobalSetting(name,value);
}
function onOverlayClick(event){
 const button=event.target.closest("[data-action]");
 if(!button||!overlay?.contains(button))return;
 const action=button.dataset.action;
 if(action==="exit"){closeMenu();return}
 if(action==="back"){renderMenuAgain();return}
 if(action==="settings"){renderSettings();return}
 if(action==="save-settings"){renderMenuAgain();return}
 if(action==="begin"||action==="new"){launch(action==="new");return}
 if(action==="continue"){continueGame();return}
}
function renderMenuAgain(){
 if(!current)return;
 const {game,mode,button}=current;openMenu(game,mode,button);
}
function removeSaved(game){
 window.clearSuwadLocalGameSave?.(game);
 window.SuwadGameAIPractice?.clearSavedGame?.(game);
 if(game==="domino")window.SuwadDominoPractice?.clearSaved?.();
 window.clearSuwadSavedRoom?.(game);
}
function closeMenu(){
 if(overlay){overlay.hidden=true;overlay.innerHTML="";overlay.removeAttribute("data-game")}
 current=null;document.body.classList.remove("swgm-menu-open");
}
function launch(isNew){
 if(!current)return;
 const {game,mode,button}=current;
 if(isNew)removeSaved(game);
 const s=getSettings(game);
 closeMenu();
 try{
  if(mode==="ai"){
   if(window.SuwadGameAIPractice?.start){window.SuwadGameAIPractice.start(game,s.difficulty);return}
  }
  if(mode==="dominoAI"){
   if(button){bypass.add(button);button.click();return}
   if(window.SuwadDominoPractice?.open){window.SuwadDominoPractice.open();return}
  }
  if(button&&button.isConnected){bypass.add(button);button.click();return}
  if(mode==="online"&&window.openSuwadOnlineRoom){window.openSuwadOnlineRoom(game);return}
  if(window.SuwadGameAIPractice?.start){window.SuwadGameAIPractice.start(game,s.difficulty);return}
  toast("مسار بداية اللعبة غير متاح حالياً.");
 }catch(error){console.error("Game launch failed:",error);toast("تعذّر فتح اللعبة. ارجع للقائمة وحاول مرة ثانية.")}
}
async function continueGame(){
 if(!current)return;
 const {game,mode}=current;
 const kind=resumeKind(game,mode);
 if(!kind){renderMenuAgain();return}
 closeMenu();
 try{
  let result=false;
  if(kind==="online")result=await window.resumeSuwadSavedRoom?.(game);
  else if(kind==="local")result=window.resumeSuwadLocalGame?.(game);
  else if(kind==="ai")result=window.SuwadGameAIPractice?.resume?.(game);
  else if(kind==="dominoAI")result=window.SuwadDominoPractice?.resumeSaved?.();
  if(!result){toast("ما قدرنا نسترجع الجولة المحفوظة؛ ابدأ جولة جديدة أو افحص الاتصال.");if(current===null)openMenu(game,mode);return}
 }catch(error){
  console.error("Resume game failed:",error);
  toast("تعذّر استرجاع الجولة. إذا كانت أونلاين، افحص اتصال الغرفة.");
  openMenu(game,mode);
 }
}
function resolveLaunchButton(button){
 if(button.dataset.onlineGame)return {game:button.dataset.onlineGame,mode:"online"};
 if(button.dataset.aiPractice)return {game:button.dataset.aiPractice,mode:"dominoAI"};
 if(button.dataset.gaiLaunch)return {game:button.dataset.gaiLaunch,mode:"ai"};
 if(button.dataset.aiWhoPractice)return {game:"who",mode:"local"};
 if(button.dataset.extraGame)return {game:button.dataset.extraGame,mode:"local"};
 if(button.dataset.game)return {game:button.dataset.game,mode:"local"};
 if(button.id==="startNow")return {game:"who",mode:"local"};
 return null;
}
function interceptLaunch(event){
 const button=event.target.closest("button");
 if(!button)return;
 if(bypass.has(button)){bypass.delete(button);return}
 const details=resolveLaunchButton(button);
 if(!details||!definitions[details.game])return;
 event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
 openMenu(details.game,details.mode,button);
}
function applyInitialPreferences(){
 try{if(localStorage.getItem("sw_game_motion_enabled")==="false")document.body.classList.add("swgm-reduce-motion")}catch{}
}
window.openSuwadGameMenu=(game,mode="ai")=>openMenu(String(game||""),mode,null);
window.SuwadGameMenu={open:openMenu,close:closeMenu,hasResume:(game,mode="local")=>!!resumeKind(game,mode),definitions:Object.keys(definitions)};
document.addEventListener("click",interceptLaunch,true);
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{injectCardArtwork();applyInitialPreferences()},{once:true});
else{injectCardArtwork();applyInitialPreferences()}
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&overlay&&!overlay.hidden)closeMenu()});
})();