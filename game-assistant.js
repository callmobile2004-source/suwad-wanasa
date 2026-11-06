(() => {
"use strict";
const $=selector=>document.querySelector(selector);
const GAMES=[
 {key:"who",name:"خَمِّنْ مَنُو آني؟",icon:"🧐"},
 {key:"number",name:"تخمين الرقم",icon:"🔢"},
 {key:"liar",name:"بَرا السالفة",icon:"🤥"},
 {key:"yesno",name:"ممنوع إي ولا",icon:"🙊"},
 {key:"most",name:"مَنُو الأَكْثَر؟",icon:"👀"},
 {key:"snakes",name:"حيّة ودرج",icon:"🐍"},
 {key:"domino",name:"دومينوا",icon:"🁣"},
 {key:"tavla",name:"طاولي مبسّطة",icon:"🎲"},
 {key:"colors",name:"كروت الألوان",icon:"🃏"},
 {key:"quiz",name:"تحدّي الأسئلة",icon:"🧠"},
 {key:"wheel",name:"دولاب التحدي",icon:"🎡"}
];
const STICKERS=["😂","🤨","🧠","😱","🤦","👀","🥳","🗿","🤡","🔥","🐐","🏳️"];
const conversations=new Map();
let overlay=null,activeKey="who",busy=false;
function gameInfo(key){return GAMES.find(game=>game.key===key)||GAMES[0]}
function activeContext(){const context=window.__SUWAD_ACTIVE_GAME||{};const key=GAMES.some(g=>g.key===context.gameKey)?context.gameKey:activeKey;return {...context,gameKey:key,gameName:context.gameName||gameInfo(key).name}}
function setContext(key,mode){if(!GAMES.some(g=>g.key===key))return;activeKey=key;window.__SUWAD_ACTIVE_GAME={...(window.__SUWAD_ACTIVE_GAME||{}),gameKey:key,gameName:gameInfo(key).name,mode:mode||window.__SUWAD_ACTIVE_GAME?.mode||"practice"}}
function detectFromText(root){
 const text=(root?.textContent||"").slice(0,1800);
 const rules=[
  ["who",/خمن|خمّن|الشخصية السرية|منو آني/],
  ["number",/تخمين الرقم|خمن الرقم|١ إلى ١٠٠|1 إلى 100/],
  ["liar",/برا السالفة|الكذّاب|الكذاب/],
  ["yesno",/ممنوع إي ولا|لا إي ولا/],
  ["most",/منو الأكثر|مَنُو الأَكْثَر/],
  ["snakes",/حية ودرج|حيّة ودرج/],
  ["domino",/دومينوا|الدومينوا/],
  ["tavla",/طاولي/],
  ["colors",/كروت الألوان|كروت الالوان/],
  ["quiz",/تحدي الأسئلة|تحدّي الأسئلة/],
  ["wheel",/دولاب التحدي/]
 ];
 for(const [key,pattern] of rules)if(pattern.test(text))return key;
 return "";
}
function isGameSurface(root){
 if(!root)return false;
 return !!root.querySelector(".online-room-head,.online-game-board,.game-topline,.turn-card,.number-form,.question-panel,#beginWho,#catSelect,.gai-panel,.gai-board");
}
function makeLauncher(host,floating=false){
 if(!host||host.querySelector(":scope > .wanasa-assistant-launcher"))return;
 const button=document.createElement("button");
 button.type="button";
 button.className="wanasa-assistant-launcher"+(floating?" wanasa-assistant-launcher-floating":"");
 button.innerHTML='<span class="wanasa-assistant-launcher-icon">🤖</span><span><b>اسأل أوراس</b><small>مساعدك داخل اللعبة</small></span><span class="wanasa-assistant-launcher-mark">فتح الواجهة الكاملة ✦</span>';
 button.addEventListener("click",openAssistant);
 if(floating)host.append(button);else host.prepend(button);
}
function scan(){
 const backdrop=$("#modalBackdrop"),content=$("#modalContent");
 if(backdrop&&!backdrop.hidden&&isGameSurface(content)){
  const detected=detectFromText(content);
  if(detected&&!window.__SUWAD_ACTIVE_GAME?.gameKey)setContext(detected,"practice");
  makeLauncher(content,false);
 }
 const practice=document.querySelector(".gai-backdrop:not([hidden])");
 if(practice)makeLauncher(practice,true);
}
function ensureOverlay(){
 if(overlay)return overlay;
 overlay=document.createElement("section");
 overlay.className="wanasa-assistant-overlay";
 overlay.hidden=true;
 overlay.setAttribute("role","dialog");
 overlay.setAttribute("aria-modal","true");
 overlay.setAttribute("aria-labelledby","wanasaAssistantTitle");
 overlay.innerHTML=
 '<div class="wanasa-assistant-window">'+
  '<header class="wanasa-assistant-header">'+
   '<div class="wanasa-assistant-brand"><span class="wanasa-assistant-avatar">🤖</span><div><h2 id="wanasaAssistantTitle">أوراس، مساعد الوناسة</h2><p id="wanasaAssistantSubtitle">مساعدك داخل اللعبة</p></div></div>'+
   '<div class="wanasa-assistant-header-actions"><button type="button" id="wanasaAssistantClear" class="wanasa-assistant-clear">مسح المحادثة</button><button type="button" id="wanasaAssistantClose" class="wanasa-assistant-close" aria-label="إغلاق">×</button></div>'+
  '</header>'+
  '<div class="wanasa-assistant-main">'+
   '<div class="wanasa-assistant-context"><label for="wanasaAssistantGame">اللعبة الحالية</label><select id="wanasaAssistantGame">'+GAMES.map(g=>'<option value="'+g.key+'">'+g.icon+" "+g.name+"</option>").join("")+'</select></div>'+
   '<div class="wanasa-assistant-trust">أجاوبك بوضوح. إذا ما عندي معلومة مؤكدة أگلك، وما أغيّر نتيجة اللعبة أو أكشف الأسرار.</div>'+
   '<div class="wanasa-assistant-messages" id="wanasaAssistantMessages" role="log" aria-live="polite"></div>'+
  '</div>'+
  '<footer class="wanasa-assistant-footer">'+
   '<div class="wanasa-assistant-stickers" aria-label="ملصقات الوناسة">'+STICKERS.map(s=>'<button type="button" class="wanasa-assistant-sticker" data-assistant-sticker="'+s+'" aria-label="إضافة ملصق '+s+'">'+s+"</button>").join("")+'</div>'+
   '<div class="wanasa-assistant-compose"><textarea id="wanasaAssistantInput" rows="2" maxlength="700" placeholder="اكتب سؤالك لأوراس هنا…"></textarea><button type="button" id="wanasaAssistantSend" class="wanasa-assistant-send"><span>إرسال</span><b>➤</b></button></div>'+
   '<p class="wanasa-assistant-footnote">قد يخطئ الذكاء الاصطناعي؛ لا تعتمد عليه وحده في المعلومات الحساسة. الحد الحالي ١٢ طلباً لكل ساعة للحساب.</p>'+
  '</footer>'+
 '</div>';
 const host=$("#modalBackdrop")&&!$("#modalBackdrop").hidden?$("#modalBackdrop"):document.body;
 host.append(overlay);
 overlay.querySelector("#wanasaAssistantClose").addEventListener("click",closeAssistant);
 overlay.addEventListener("click",event=>{if(event.target===overlay)closeAssistant()});
 overlay.querySelector("#wanasaAssistantGame").addEventListener("change",event=>{
  setContext(event.target.value,activeContext().mode);
  renderMessages();
 });
 overlay.querySelector("#wanasaAssistantClear").addEventListener("click",()=>{
  conversations.delete(activeKey);
  renderMessages();
 });
 overlay.querySelector("#wanasaAssistantSend").addEventListener("click",sendQuestion);
 overlay.querySelector("#wanasaAssistantInput").addEventListener("keydown",event=>{
  if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();sendQuestion()}
 });
 overlay.querySelectorAll("[data-assistant-sticker]").forEach(button=>button.addEventListener("click",()=>{
  const input=overlay.querySelector("#wanasaAssistantInput");
  input.value=(input.value||"")+button.dataset.assistantSticker;
  input.focus();
 }));
 return overlay;
}
function appendMessage(role,text,meta){
 const area=overlay.querySelector("#wanasaAssistantMessages");
 const article=document.createElement("article");
 article.className="wanasa-assistant-message "+(role==="user"?"is-user":"is-assistant");
 const head=document.createElement("div");head.className="wanasa-assistant-message-head";
 head.textContent=role==="user"?"أنت": "أوراس 🤖";
 const body=document.createElement("p");body.textContent=text;
 article.append(head,body);
 if(meta){const note=document.createElement("small");note.textContent=meta;article.append(note)}
 area.append(article);area.scrollTop=area.scrollHeight;
}
function renderMessages(){
 if(!overlay)return;
 const area=overlay.querySelector("#wanasaAssistantMessages");
 area.replaceChildren();
 const context=activeContext();
 overlay.querySelector("#wanasaAssistantGame").value=context.gameKey;
 overlay.querySelector("#wanasaAssistantSubtitle").textContent=context.gameName+" • مساعدك داخل اللعبة";
 const rows=conversations.get(context.gameKey)||[];
 if(!rows.length){
  appendMessage("assistant","هلا بيك! اسألني عن قواعد اللعبة أو شلون تلعب أو اطلب أفكاراً مناسبة إلها. إذا ما أعرف جواباً موثوقاً، راح أگلك بصراحة.","أوراس • جاهز للمساعدة");
 }else rows.forEach(row=>appendMessage(row.role,row.text,row.meta));
}
function saveMessage(role,text,meta){
 const rows=conversations.get(activeKey)||[];
 rows.push({role,text,meta:meta||""});
 conversations.set(activeKey,rows.slice(-40));
}
async function getClient(){
 const context=window.__SUWAD_SOCIAL_CONTEXT?.();
 const db=context?.db;
 if(!db)throw new Error("خدمة الحسابات غير مهيّأة. تأكد من إعداد Supabase واتصال الموقع.");
 const sessionResult=await db.auth.getSession();
 if(sessionResult.error)throw sessionResult.error;
 if(!sessionResult.data?.session){
  const nickname=(localStorage.getItem("sw_nickname")||"ضيف الوناسة").trim();
  const signed=await db.auth.signInAnonymously({options:{data:{display_name:nickname||"ضيف الوناسة"}}});
  if(signed.error)throw signed.error;
 }
 return db;
}
async function invokeAssistant(gameKey,question){
 const db=await getClient();
 const result=await db.functions.invoke("wanasa-ai",{body:{mode:"game_help",gameKey,question}});
 if(result.error){
  let message=result.error.message||"تعذّر الاتصال بالمساعد.";
  const response=result.error.context;
  if(response&&typeof response.clone==="function"){
   const body=await response.clone().json().catch(()=>null);
   if(typeof body?.error==="string"&&body.error.trim())message=body.error.trim();
  }
  throw new Error(message);
 }
 const answer=String(result.data?.answer||"").trim();
 if(!answer)throw new Error("المساعد ما رجّع جواباً واضحاً. جرّب صياغة ثانية.");
 return answer;
}
async function sendQuestion(){
 if(busy)return;
 const input=overlay.querySelector("#wanasaAssistantInput");
 const button=overlay.querySelector("#wanasaAssistantSend");
 const question=input.value.trim();
 if(!question)return;
 const context=activeContext(),gameKey=context.gameKey;
 busy=true;button.disabled=true;input.disabled=true;
 input.value="";
 saveMessage("user",question);
 appendMessage("user",question);
 appendMessage("assistant","لحظة، أراجع سؤالك…","جارٍ التفكير");
 try{
  let answer="",meta="";
  if(gameKey==="who"&&context.mode==="practice"&&typeof window.__SUWAD_WHO_ANSWER==="function"){
   const local=window.__SUWAD_WHO_ANSWER(question);
   answer=String(local?.answer||"ما عندي معلومة موثوقة عن هالسؤال؛ جرّب صياغة ثانية.");
   meta=local?.known?"معلومة من قاعدة الحقائق المحلية":"ماكو معلومة مؤكدة ضمن الحقائق المتوفرة";
  }else{
   answer=await invokeAssistant(gameKey,question);
   meta="مساعدة ذكاء اصطناعي • راجع المعلومة إذا كانت مهمة";
  }
  const rows=conversations.get(gameKey)||[];
  if(rows.length&&rows[rows.length-1]?.text==="لحظة، أراجع سؤالك…")rows.pop();
  saveMessage("assistant",answer,meta);
  renderMessages();
 }catch(error){
  const rows=conversations.get(gameKey)||[];
  if(rows.length&&rows[rows.length-1]?.text==="لحظة، أراجع سؤالك…")rows.pop();
  const message=String(error?.message||"تعذّر الحصول على إجابة.");
  saveMessage("assistant","ما قدرت أجيب هالمرة: "+message,"تحقق من الاتصال أو أعد المحاولة بعد قليل");
  renderMessages();
 }finally{
  busy=false;
  if(overlay){overlay.querySelector("#wanasaAssistantSend").disabled=false;overlay.querySelector("#wanasaAssistantInput").disabled=false;overlay.querySelector("#wanasaAssistantInput").focus()}
 }
}
function openAssistant(){
 const panel=ensureOverlay();
 const context=activeContext();
 if(context.gameKey)setContext(context.gameKey,context.mode);
 panel.hidden=false;
 document.body.classList.add("wanasa-assistant-open");
 renderMessages();
 panel.querySelector("#wanasaAssistantInput").focus({preventScroll:true});
}
function closeAssistant(){
 if(!overlay)return;
 overlay.hidden=true;
 document.body.classList.remove("wanasa-assistant-open");
}
document.addEventListener("click",event=>{
 const trigger=event.target.closest("[data-online-game],[data-extra-game],[data-game],[data-gai-launch],[data-ai-practice]");
 if(!trigger)return;
 const key=trigger.dataset.onlineGame||trigger.dataset.extraGame||trigger.dataset.game||trigger.dataset.gaiLaunch||trigger.dataset.aiPractice;
 if(key)setContext(key,trigger.hasAttribute("data-online-game")?"online":"practice");
},true);
const observer=new MutationObserver(scan);
observer.observe(document.body,{childList:true,subtree:true});
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&overlay&&!overlay.hidden)closeAssistant()});
window.openSuwadGameAssistant=openAssistant;
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",scan);else scan();
})();