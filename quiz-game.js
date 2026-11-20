(() => {
"use strict";
if (window.SuwadQuizGame) return;

const LEVELS = ["easy","medium","hard","expert"];
const LEVEL_LABELS = {easy:"سهل",medium:"متوسط",hard:"صعب",expert:"خبير"};
const SEEN_KEY = "sw_quiz_standalone_seen_v1";
const SAVE_KEY = "sw_quiz_standalone_saved_v1";
const SETTINGS_KEY = "sw_quiz_standalone_settings_v1";
const BEST_KEY = "sw_quiz_standalone_best_v1";
const $ = (selector,root=document) => root.querySelector(selector);
let overlay = null;
let session = null;
let setup = {category:"general",difficulty:"medium",count:10,duration:15,mode:"solo",names:""};
let clockInterval = null;

function safe(value){
 return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
function randomIndex(max){
 if(max<=1)return 0;
 try{
  if(window.crypto?.getRandomValues){
   const sample=new Uint32Array(1),range=0x100000000,limit=Math.floor(range/max)*max;
   do{window.crypto.getRandomValues(sample)}while(sample[0]>=limit);
   return sample[0]%max;
  }
 }catch{}
 return Math.floor(Math.random()*max);
}
function shuffle(list){
 const out=list.slice();
 for(let i=out.length-1;i>0;i--){const j=randomIndex(i+1);[out[i],out[j]]=[out[j],out[i]]}
 return out;
}
function readObject(key){
 try{const value=JSON.parse(localStorage.getItem(key)||"{}");return value&&typeof value==="object"&&!Array.isArray(value)?value:{}}catch{return {}}
}
function writeObject(key,value){
 try{localStorage.setItem(key,JSON.stringify(value));return true}catch(error){console.warn("[quiz-game] storage write failed",error);return false}
}
function getCategories(){
 return (window.SuwadQuizHub?.categories||[]).filter(item=>item&&item.ready===true);
}
function getPool(categoryId,level){
 const bank=window.SuwadQuizQuestionBank;
 if(!bank||!LEVELS.includes(level))return [];
 if(categoryId==="general")return Array.isArray(bank[level])?bank[level]:[];
 return Array.isArray(bank.categories?.[categoryId]?.[level])?bank.categories[categoryId][level]:[];
}
function readSeen(){
 const value=readObject(SEEN_KEY);
 return value;
}
function availableQuestions(categoryId,level){
 const seen=readSeen(),categories=getCategories();
 const ids=categoryId==="mixed"?["general",...categories.map(item=>item.id)]:[categoryId];
 const output=[];
 for(const id of ids){
  const rows=getPool(id,level);
  const used=new Set(Array.isArray(seen[id]?.[level])?seen[id][level]:[]);
  for(const item of rows){
   if(!item||used.has(item.id))continue;
   if(!Array.isArray(item.a)||item.a.length!==4||new Set(item.a.map(value=>String(value).trim().normalize("NFKC").toLowerCase())).size!==4)continue;
   if(!Number.isInteger(item.c)||item.c<0||item.c>3||!String(item.q||"").trim())continue;
   output.push({...item,categoryId:id,categoryName:id==="general"?"الثقافة العامة":(categories.find(row=>row.id===id)?.name||id)});
  }
 }
 return output;
}
function parsePlayers(mode,names){
 if(mode!=="party")return [{name:"اللاعب",score:0,correct:0,wrong:0,streak:0,bestStreak:0}];
 const clean=[...new Set(String(names||"").split(/[\n,،;；]+/).map(x=>x.trim()).filter(Boolean))].slice(0,12);
 if(clean.length<2)throw new Error("أدخل اسمَي لاعبين على الأقل حتى تبدأ جولة اللمة.");
 return clean.map(name=>({name,score:0,correct:0,wrong:0,streak:0,bestStreak:0}));
}
function createSession(options={}){
 const categoryId=String(options.category||"general");
 const difficulty=LEVELS.includes(options.difficulty)?options.difficulty:"medium";
 const count=[10,20,50].includes(Number(options.count))?Number(options.count):10;
 const duration=[10,15,20].includes(Number(options.duration))?Number(options.duration):15;
 const mode=options.mode==="party"?"party":"solo";
 if(categoryId!=="mixed"&&categoryId!=="general"&&!getCategories().some(item=>item.id===categoryId))throw new Error("القسم المختار غير متاح حالياً.");
 const pool=availableQuestions(categoryId,difficulty);
 if(pool.length<count)throw new Error("المتاح في هذا الاختيار "+pool.length+" سؤالاً فقط. غيّر المستوى أو القسم أو أعد ضبط سجل عدم التكرار.");
 const deck=shuffle(pool).slice(0,count).map(item=>{
  const answers=item.a.map((label,index)=>({label,correct:index===item.c}));
  const randomized=shuffle(answers);
  return {
   id:item.id,categoryId:item.categoryId,categoryName:item.categoryName,
   question:item.q,options:randomized.map(x=>x.label),
   correctChoice:randomized.findIndex(x=>x.correct),
   explanation:item.explanation||"لا يتوفر شرح إضافي لهذا السؤال.",
   source:item.source||null
  };
 });
 const created={
  version:1,category:categoryId,difficulty,count,duration,mode,
  players:parsePlayers(mode,options.names),
  deck,index:0,answered:false,feedback:null,
  countdownStarted:false,deadlineAt:null,ready:mode==="solo",
  finished:false,createdAt:Date.now(),streak:0,totalCorrect:0,totalWrong:0
 };
 return created;
}
function recordSeen(question,levelOverride){
 if(!question?.categoryId||!question?.id)return;
 const store=readSeen(),level=LEVELS.includes(levelOverride)?levelOverride:(session?.difficulty||setup.difficulty);
 if(!store[question.categoryId]||typeof store[question.categoryId]!=="object")store[question.categoryId]={};
 if(!Array.isArray(store[question.categoryId][level]))store[question.categoryId][level]=[];
 if(!store[question.categoryId][level].includes(question.id))store[question.categoryId][level].push(question.id);
 writeObject(SEEN_KEY,store);
}
function persist(target=session){
 if(!target||target.finished){try{localStorage.removeItem(SAVE_KEY)}catch{};return}
 writeObject(SAVE_KEY,{savedAt:Date.now(),session:target});
}
function startTimer(target=session,now=Date.now()){
 if(!target||target.finished||target.answered||target.countdownStarted||!target.ready)return false;
 target.countdownStarted=true;
 target.deadlineAt=now+target.duration*1000;
 persist(target);
 return true;
}
function answer(choice,now=Date.now(),target=session){
 if(!target||target.finished||target.answered||!target.countdownStarted)return false;
 const question=target.deck[target.index];
 if(!question)return false;
 const expired=now>=Number(target.deadlineAt||0);
 const validChoice=Number.isInteger(choice)&&choice>=0&&choice<4;
 if(!expired&&!validChoice)return false;
 const player=target.players[target.index%target.players.length];
 const isCorrect=!expired&&choice===question.correctChoice;
 const remaining=expired?0:Math.max(0,Math.ceil((target.deadlineAt-now)/1000));
 const timeBonus=isCorrect?Math.min(50,remaining*3):0;
 player.streak=isCorrect?player.streak+1:0;
 player.bestStreak=Math.max(player.bestStreak,player.streak);
 const streakBonus=isCorrect&&player.streak>1?(Math.min(5,player.streak-1)*10):0;
 const points=isCorrect?100+timeBonus+streakBonus:0;
 if(isCorrect){player.score+=points;player.correct++;target.totalCorrect++;target.streak++}
 else{player.wrong++;target.totalWrong++;target.streak=0}
 target.answered=true;
 target.feedback={
  selectedChoice:validChoice&&!expired?choice:null,
  correctChoice:question.correctChoice,
  isCorrect,expired,points,timeBonus,streakBonus,
  explanation:question.explanation,
  source:question.source
 };
 recordSeen(question,target.difficulty);
 persist(target);
 return target.feedback;
}
function readyPlayer(target=session){
 if(!target||target.finished||target.mode!=="party"||target.ready)return false;
 target.ready=true;persist(target);return true;
}
function bestKey(target){return [target.mode,target.category,target.difficulty].join("|")}
function finish(target=session){
 if(!target)return null;
 target.finished=true;target.countdownStarted=false;target.deadlineAt=null;
 const store=readObject(BEST_KEY),key=bestKey(target);
 const current={
  score:target.players.reduce((sum,p)=>sum+p.score,0),
  correct:target.totalCorrect,wrong:target.totalWrong,
  total:target.count,completedAt:Date.now(),
  players:target.players.map(p=>({name:p.name,score:p.score,correct:p.correct,wrong:p.wrong}))
 };
 const previous=store[key];
 if(!previous||current.score>Number(previous.score||0))store[key]=current;
 writeObject(BEST_KEY,store);
 persist(target);
 return current;
}
function nextQuestion(target=session){
 if(!target||!target.answered||target.finished)return false;
 if(target.index+1>=target.count){finish(target);return true}
 target.index++;
 target.answered=false;target.feedback=null;
 target.countdownStarted=false;target.deadlineAt=null;
 target.ready=target.mode==="solo";
 persist(target);
 return true;
}
function clearClock(){
 if(clockInterval){clearInterval(clockInterval);clockInterval=null}
}
function ensureOverlay(){
 if(overlay&&overlay.isConnected)return overlay;
 overlay=document.createElement("div");
 overlay.className="sq-backdrop";
 overlay.hidden=true;
 overlay.innerHTML='<section class="sq-game" role="dialog" aria-modal="true" aria-label="تحدّي الأسئلة" dir="rtl"><header class="sq-header"><div class="sq-brand"><span>🧠</span><div><small>لعبة مستقلة داخل سَـوَاد وناسة</small><strong>تحدّي الأسئلة</strong></div></div><button type="button" class="sq-close" data-action="close" aria-label="إغلاق اللعبة">×</button></header><main class="sq-content" id="sqContent"></main></section>';
 document.body.appendChild(overlay);
 overlay.addEventListener("click",onClick);
 overlay.addEventListener("change",onChange);
 overlay.addEventListener("input",onInput);
 return overlay;
}
function loadSettings(){
 const value=readObject(SETTINGS_KEY);
 return {
  category:typeof value.category==="string"?value.category:"general",
  difficulty:LEVELS.includes(value.difficulty)?value.difficulty:"medium",
  count:[10,20,50].includes(Number(value.count))?Number(value.count):10,
  duration:[10,15,20].includes(Number(value.duration))?Number(value.duration):15,
  mode:value.mode==="party"?"party":"solo",
  names:typeof value.names==="string"?value.names:""
 };
}
function saveSettings(){
 writeObject(SETTINGS_KEY,setup);
}
function hasSaved(){
 const saved=readObject(SAVE_KEY);
 return !!saved.session&&!saved.session.finished&&Array.isArray(saved.session.deck)&&saved.session.deck.length>0;
}
function renderSetup(){
 clearClock();
 const root=$("#sqContent",overlay);
 const saved=hasSaved();
 const categoryForHub=setup.category==="mixed"?"general":setup.category;
 root.innerHTML='<section class="sq-hero"><span class="sq-kicker">اختبر معلوماتك… واربحها بالذكاء</span><h1>خلّ عقلك <em>يلعب!</em></h1><p>اختار قسمك ومستواك، نافس وحدك أو مرّر الجهاز للربع. كل جواب يطلع وياه تفسير ومصدر.</p><div class="sq-feature-pills"><span>18 بنك تخصصي</span><span>4 مستويات</span><span>أوفلاين وأونلاين</span></div></section><section class="sq-setup-card"><div class="sq-section-title"><div><small>جهّز الجولة</small><h2>إعدادات التحدّي</h2></div><span class="sq-step">01 / 02</span></div>'+ (window.SuwadQuizHub?.render(categoryForHub)||"")+
 '<div class="sq-form-grid"><label>مستوى الصعوبة<select id="sqDifficulty"><option value="easy">سهل</option><option value="medium">متوسط</option><option value="hard">صعب</option><option value="expert">خبير</option></select></label><label>عدد الأسئلة<select id="sqCount"><option value="10">جولة سريعة · 10</option><option value="20">جولة طويلة · 20</option><option value="50">ماراثون · 50</option></select></label><label>وقت السؤال<select id="sqDuration"><option value="10">10 ثواني</option><option value="15">15 ثانية</option><option value="20">20 ثانية</option></select></label><label>طريقة اللعب<select id="sqMode"><option value="solo">لاعب واحد</option><option value="party">اللمة · تمرير الجهاز</option></select></label></div><div class="sq-players" id="sqPlayersBox" hidden><label for="sqPlayers">أسماء اللاعبين <small>اسم بكل سطر، من لاعبين إلى 12 لاعباً</small></label><textarea id="sqPlayers" rows="3" placeholder="سواد&#10;أحمد&#10;علي"></textarea></div><div class="sq-actions"><button type="button" class="sq-primary" data-action="start">ابدأ التحدّي <span>✦</span></button><button type="button" class="sq-text-action" data-action="reset-history">إعادة دورة أسئلة هذا الاختيار</button>'+(saved?'<button type="button" class="sq-secondary" data-action="resume">كمّل جولتك المحفوظة</button>':"")+'</div><p class="sq-note">العدّ يبدأ يدوياً لكل سؤال، حتى تلحق تقرأ السؤال قبل احتساب الوقت. سجل الأسئلة المستهلكة منفصل عن تدريب أوراس.</p><div class="sq-error" id="sqError" role="status" aria-live="polite"></div></section><section class="sq-how"><article><b>🎯</b><strong>جاوب واربح</strong><span>100 نقطة للإجابة الصحيحة مع مكافأة للسرعة والتتابع.</span></article><article><b>⏱️</b><strong>وقت عادل</strong><span>ابدأ العد بنفسك، ولا ينحسب عليك وقت قبل الضغط.</span></article><article><b>📚</b><strong>تعلم من الجواب</strong><span>كل سؤال يعرض تفسيراً ومصدراً عند توفره.</span></article></section>';
 $("#sqDifficulty",root).value=setup.difficulty;
 $("#sqCount",root).value=String(setup.count);
 $("#sqDuration",root).value=String(setup.duration);
 $("#sqMode",root).value=setup.mode;
 $("#sqPlayers",root).value=setup.names;
 $("#sqPlayersBox",root).hidden=setup.mode!=="party";
 const categorySelect=$("#gaiQuizCategory",root);
 if(categorySelect){
  if(setup.category==="mixed"){
   const option=document.createElement("option");option.value="mixed";option.textContent="🎲 مزيج كل الأقسام";categorySelect.appendChild(option);
  }
  categorySelect.value=setup.category;
 }
 window.SuwadQuizHub?.mount(root,{onCategoryChange:id=>{setup.category=id;saveSettings();renderSetup()}});
}
function updateClock(){
 if(!session||!session.countdownStarted||session.answered||session.finished)return;
 const remaining=Math.max(0,Math.ceil((Number(session.deadlineAt)-Date.now())/1000));
 const value=$("#sqSeconds",overlay),ring=$("#sqClockRing",overlay),clock=$("#sqClock",overlay);
 if(value)value.textContent=String(remaining);
 if(ring)ring.style.setProperty("--sq-progress",String(remaining/session.duration*100)+"%");
 if(clock)clock.classList.toggle("is-urgent",remaining<=5);
 if(remaining<=0){clearClock();answer(null,Date.now());renderQuestion()}
}
function renderQuestion(){
 const root=$("#sqContent",overlay);if(!session)return;
 if(session.finished){renderResults();return}
 const q=session.deck[session.index],player=session.players[session.index%session.players.length];
 const progress=Math.round((session.index/session.count)*100);
 const questionCard=session.ready?'<div class="sq-question-card"><div class="sq-question-meta"><span>'+safe(q.categoryName)+'</span><span>٤ اختيارات</span></div><h1>'+safe(q.question)+'</h1></div>':"";
 const source=session.feedback?.source;
 const sourceMarkup=source&&/^https:\/\//.test(source.url)?'<a class="sq-source" href="'+safe(source.url)+'" target="_blank" rel="noopener noreferrer">المصدر: '+safe(source.label)+' ↗</a>':"";
 const options=q.options.map((value,i)=>{
  let cls="";
  if(session.answered&&i===q.correctChoice)cls="is-correct";
  else if(session.answered&&i===session.feedback?.selectedChoice&&!session.feedback?.isCorrect)cls="is-wrong";
  return '<button type="button" class="sq-answer '+cls+'" data-choice="'+i+'" '+(!session.countdownStarted||session.answered||!session.ready?"disabled":"")+'><span>'+String.fromCharCode(65+i)+'</span><b>'+safe(value)+'</b></button>';
 }).join("");
 const feedback=session.answered?'<section class="sq-feedback '+(session.feedback.isCorrect?"is-correct":"is-wrong")+'"><div class="sq-feedback-title">'+(session.feedback.expired?"انتهى الوقت":session.feedback.isCorrect?"إجابة صحيحة! أحسنت":"مو هذه الإجابة")+'</div><p>الإجابة الصحيحة: <strong>'+safe(q.options[q.correctChoice])+'</strong></p><p>'+safe(session.feedback.explanation)+'</p><div class="sq-points">+'+session.feedback.points+' نقطة</div>'+sourceMarkup+'</section>':"";
 const partyGate=session.mode==="party"&&!session.ready?'<section class="sq-pass"><span>📱</span><h2>مرّر الجهاز إلى '+safe(player.name)+'</h2><p>لاعبنا التالي جاهز؟ اضغط حتى يظهر السؤال، والعدّ ما يبدأ إلا من ضغطك مرة ثانية.</p><button type="button" class="sq-primary" data-action="ready">أنا جاهز</button></section>':"";
 root.innerHTML='<div class="sq-play-top"><button type="button" class="sq-back" data-action="setup">إعدادات الجولة</button><span class="sq-round-label">السؤال '+(session.index+1)+' من '+session.count+'</span><span class="sq-level">'+safe(LEVEL_LABELS[session.difficulty])+'</span></div><div class="sq-progress"><i style="width:'+progress+'%"></i></div><div class="sq-score-strip"><span>👤 '+safe(player.name)+'</span><span>⭐ '+player.score+' نقطة</span><span>🔥 '+player.streak+' متتالية</span></div>'+partyGate+questionCard+
 (session.ready?'<div class="sq-clock-row" id="sqClock"><span>⏳</span><div class="sq-clock-ring" id="sqClockRing"><b id="sqSeconds">'+(session.countdownStarted?Math.max(0,Math.ceil((session.deadlineAt-Date.now())/1000)):session.duration)+'</b></div><div class="sq-clock-copy"><strong>'+(session.countdownStarted?"الوقت يمشي":"خذ راحتك واقرأ")+'</strong><small>'+(session.countdownStarted?"اختار جوابك قبل الصفر":"ماكو وقت محسوب إلى أن تبدأ العد")+'</small></div><button type="button" class="sq-timer-start" data-action="timer" '+(session.countdownStarted||session.answered?"disabled":"")+'>'+(session.countdownStarted?"العد بدأ":"ابدأ الوقت")+'</button></div>':"")+
 (session.ready?'<div class="sq-answers">'+options+'</div>':"")+feedback+
 (session.answered?'<div class="sq-next-row"><button type="button" class="sq-primary" data-action="next">'+(session.index+1>=session.count?"عرض النتيجة النهائية":"السؤال التالي")+' <span>←</span></button></div>':"")+
 '<div class="sq-footer-note">لا تتكرر الأسئلة ضمن أول دورة لكل قسم ومستوى. إجاباتك ونتيجتك محفوظة على هذا الجهاز.</div>';
 if(session.countdownStarted&&!session.answered){clearClock();clockInterval=window.setInterval(updateClock,100);updateClock()}
}
function renderResults(){
 clearClock();
 const root=$("#sqContent",overlay),ranked=session.players.slice().sort((a,b)=>b.score-a.score);
 const winner=ranked[0],accuracy=session.count?Math.round(session.totalCorrect/session.count*100):0;
 root.innerHTML='<section class="sq-results-hero"><span>🏆</span><small>اكتمل التحدّي</small><h1>'+(session.mode==="party"?"الفائز هو":"نتيجتك النهائية")+'</h1><strong>'+safe(winner.name)+'</strong><b>'+winner.score+' نقطة</b></section><div class="sq-result-stats"><article><strong>'+session.totalCorrect+'</strong><span>إجابة صحيحة</span></article><article><strong>'+session.totalWrong+'</strong><span>إجابة خاطئة أو وقت منتهٍ</span></article><article><strong>'+accuracy+'%</strong><span>دقة الإجابات</span></article></div><section class="sq-leaderboard"><h2>ترتيب اللاعبين</h2>'+ranked.map((p,i)=>'<div class="sq-player-result"><span>'+(i+1)+'. '+safe(p.name)+'</span><strong>'+p.score+' نقطة</strong><small>'+p.correct+' صحيحة · '+p.wrong+' أخرى</small></div>').join("")+'</section><div class="sq-actions"><button type="button" class="sq-primary" data-action="replay">جولة جديدة</button><button type="button" class="sq-secondary" data-action="setup">العودة للإعدادات</button></div>';
}
function startFromSetup(){
 try{
  setup.category=$("#gaiQuizCategory",overlay)?.value||setup.category;
  setup.difficulty=$("#sqDifficulty",overlay)?.value||setup.difficulty;
  setup.count=Number($("#sqCount",overlay)?.value||setup.count);
  setup.duration=Number($("#sqDuration",overlay)?.value||setup.duration);
  setup.mode=$("#sqMode",overlay)?.value||setup.mode;
  setup.names=$("#sqPlayers",overlay)?.value||setup.names;
  saveSettings();
  session=createSession(setup);
  persist();
  renderQuestion();
 }catch(error){
  const errorBox=$("#sqError",overlay);if(errorBox)errorBox.textContent=error.message||"تعذّر بدء التحدّي.";
 }
}
function resume(){
 const saved=readObject(SAVE_KEY)?.session;
 if(!saved||!Array.isArray(saved.deck)||!saved.deck.length){renderSetup();return}
 if(saved.version!==1||!Array.isArray(saved.players)||!Number.isInteger(saved.index)||saved.index<0||saved.index>=saved.deck.length){try{localStorage.removeItem(SAVE_KEY)}catch{};renderSetup();return}
 session=saved;
 if(session.countdownStarted&&Date.now()>=Number(session.deadlineAt||0)&&!session.answered){answer(null,Date.now())}
 renderQuestion();
}
function onClick(event){
 const button=event.target.closest("[data-action],[data-choice]");
 if(!button||!overlay?.contains(button))return;
 if(button.hasAttribute("data-choice")){answer(Number(button.dataset.choice));renderQuestion();return}
 const action=button.dataset.action;
 if(action==="close"){close();return}
 if(action==="start"){startFromSetup();return}
 if(action==="resume"){resume();return}
 if(action==="reset-history"){
  const level=$("#sqDifficulty",overlay)?.value||setup.difficulty;
  const category=$("#gaiQuizCategory",overlay)?.value||setup.category;
  if(window.confirm?.("إعادة الأسئلة المستخدمة لهذا الاختيار؟ لن تُحذف النتائج أو الأسماء.")){
   resetHistory(category==="mixed"?"all":category,level);
   const box=$("#sqError",overlay);if(box)box.textContent="تمت إعادة دورة الأسئلة لهذا الاختيار فقط.";
  }
  return;
 }
 if(action==="timer"){if(startTimer())renderQuestion();return}
 if(action==="ready"){if(readyPlayer())renderQuestion();return}
 if(action==="next"){if(nextQuestion())renderQuestion();return}
 if(action==="setup"){session=null;renderSetup();return}
 if(action==="replay"){session=null;try{localStorage.removeItem(SAVE_KEY)}catch{};renderSetup();return}
}
function onChange(event){
 const id=event.target.id;
 if(id==="sqMode"){$("#sqPlayersBox",overlay).hidden=event.target.value!=="party"}
 if(id==="gaiQuizCategory")setup.category=event.target.value;
 if(id==="sqDifficulty")setup.difficulty=event.target.value;
 if(id==="sqCount")setup.count=Number(event.target.value);
 if(id==="sqDuration")setup.duration=Number(event.target.value);
 if(id==="sqMode")setup.mode=event.target.value;
 saveSettings();
}
function onInput(event){if(event.target.id==="sqPlayers"){setup.names=event.target.value;saveSettings()}}
function open(){
 setup=loadSettings();
 overlay=ensureOverlay();overlay.hidden=false;
 session=null;renderSetup();
 document.body.classList.add("sq-game-open");
}
function close(){
 clearClock();
 if(session&&!session.finished)persist();
 if(overlay)overlay.hidden=true;
 document.body.classList.remove("sq-game-open");
 session=null;
}
function resetHistory(categoryId,level){
 const seen=readSeen();
 if(categoryId==="all"){try{localStorage.removeItem(SEEN_KEY)}catch{};return true}
 if(!LEVELS.includes(level)||typeof categoryId!=="string")return false;
 if(seen[categoryId]){delete seen[categoryId][level];if(!Object.keys(seen[categoryId]).length)delete seen[categoryId]}
 return writeObject(SEEN_KEY,seen);
}
function showBest(){
 return readObject(BEST_KEY);
}
window.SuwadQuizGame={open,close,createSession,startTimer,answer,readyPlayer,nextQuestion,finish,resetHistory,showBest,hasSaved,__test:{getPool,availableQuestions,readSeen}};
document.addEventListener("click",event=>{
 const button=event.target.closest("[data-standalone-quiz]");
 if(!button)return;
 event.preventDefault();event.stopPropagation();
 open();
});
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&overlay&&!overlay.hidden)close()});
})();