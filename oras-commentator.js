(() => {
"use strict";

const STORAGE_KEY="sw_oras_commentator_enabled";
let enabled=localStorage.getItem(STORAGE_KEY)==="true";
let lastSpokenAt=0;
const seen=new Map();

function supported(){
 return !!window.SuwadVoice?.isSupported();
}
function snapshot(state,updatedAt){
 return {
  updatedAt:String(updatedAt||""),
  eventAt:String(state?.tableFlip?.lastEvent?.createdAt||""),
  challengeStatus:String(state?.tableFlip?.activeChallenge?.status||""),
  phase:String(state?.phase||"")
 };
}
function chooseLine(gameKey,state,previous,current){
 const event=state?.tableFlip?.lastEvent;
 if(current.eventAt&&current.eventAt!==previous.eventAt){
  if(event?.type==="swap-turn")return "هاا، قلبنا الدور! انتبهوا، الدور تبدّل فجأة.";
  if(event?.type==="double-points")return "يا سلام! النقاط الجاية مضاعفة، لا تضيعون الفرصة.";
  if(event?.type==="challenge")return "عدنا تحدّي مفاجئ! يلا نشوف شلون راح يتصرف صاحب التحدّي.";
  if(event?.type==="bonus-points")return "نقطتين مفاجئة! المنافسة بعدها ما محسومة.";
 }
 if(current.challengeStatus!==previous.challengeStatus&&current.challengeStatus==="completed")
  return "كفو! التحدّي اكتمل والنقاط انضافت، نريد نشوف منو يلحقه.";
 const lines={
  snakes:["ها، النرد ما يرحم! ركّزوا قبل الرمية الجاية.","يمكن درج يرفعك ويمكن حيّة ترجعك، لا تفرحون بسرعة."],
  domino:["هاي القطعة ممكن تقلب السلسلة، فكروا قبل لا تلعبون.","الدومينوا صارت حامية، منو راح يخلّص قطعته أول؟"],
  tavla:["النرد حسمها؟ بعد أكو مجال تقلبون النتيجة.","ركزوا بالحركة الجاية، الطاولي تريد حساب."],
  colors:["بدّلوا خطتكم، الكروت بعدها تخبّي مفاجآت.","منو عنده الكارت اللي يغيّر مجرى اللعب؟"],
  quiz:["ها، ورّونا معلوماتكم! لا أحد يستعجل بالإجابة.","السؤال الجاي يحتاج تركيز، مو تخمين وبس."],
  yesno:["انتبهوا للكلمات، كلمة وحدة وتروح النقطة.","ها، منو راح ينجو من إي ولا؟"],
  who:["قرّبوا التخمين، السؤال الذكي يختصر الطريق.","لا تحرقون كل أسئلتكم بسرعة، فكروا زين."],
  most:["كل واحد يعرف ربعه، بس التصويت يفضح التوقعات.","منو راح يحصل أعلى تصويت هالمرة؟"],
  liar:["لا تكشفون كل أوراقكم، الكذّاب يمكن بيناتكم.","التلميح الذكي ينقذكم، والتلميح الزايد يفضحكم."],
  number:["قربتوا من الرقم؟ لا تستعجلون بالحكم.","كل تخمين يقرّبكم، بس السر بعده مخفي."]
 };
 const options=lines[gameKey]||["اللعب صار حامي! شدّوا حيلكم يا أبطال.","بعد عدنا مفاجآت، لا تعتبرون الجولة محسومة."];
 return options[Math.floor(Math.random()*options.length)];
}
function speak(text){
 if(!enabled||!supported()||!text)return false;
 const now=Date.now();
 if(now-lastSpokenAt<6500)return false;
 lastSpokenAt=now;
 window.SuwadVoice.speak(text,"commentator").catch(error=>console.warn("Oras commentator voice failed",error?.message||error));
 return true;
}
function observe(roomId,gameKey,state,updatedAt){
 if(!roomId||!state)return;
 const current=snapshot(state,updatedAt),previous=seen.get(roomId);
 seen.set(roomId,current);
 if(!previous||!enabled||current.updatedAt===previous.updatedAt||current.phase!=="playing")return;
 speak(chooseLine(gameKey,state,previous,current));
}
function toggle(){
 if(!supported())return false;
 enabled=!enabled;
 localStorage.setItem(STORAGE_KEY,String(enabled));
 if(!enabled)window.SuwadVoice?.stop();
 return enabled;
}
function stop(){
 window.SuwadVoice?.stop();
}
window.addEventListener("pagehide",stop);
window.SuwadOrasCommentator={
 isEnabled:()=>enabled,
 isSupported:supported,
 toggle,
 observe,
 stop
};
})();