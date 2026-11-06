(() => {
"use strict";
if (window.SuwadGameAIPractice) return;

const DIFFICULTIES = [
  {id:"easy",label:"سهل"},
  {id:"medium",label:"متوسط"},
  {id:"hard",label:"صعب"},
  {id:"expert",label:"خبير"}
];
const GAME_NAMES = {
  who:"خَمِّن مَنُو آني؟",number:"تخمين الرقم",liar:"برا السالفة",most:"منو الأكثر؟",yesno:"ممنوع إي ولا",
  snakes:"حيّة ودرج",tavla:"الطاولي المبسّطة",colors:"كروت الألوان",quiz:"تحدّي الأسئلة",wheel:"الدولاب"
};
const QUESTIONS = [
  {q:"ما عاصمة العراق؟",a:["البصرة","بغداد","الموصل","أربيل"],c:1},
  {q:"كم عدد أيام الأسبوع؟",a:["خمسة","ستة","سبعة","ثمانية"],c:2},
  {q:"أي كوكب يُعرف بالكوكب الأحمر؟",a:["الزهرة","المريخ","المشتري","زحل"],c:1},
  {q:"ما الحيوان المعروف بسفينة الصحراء؟",a:["الحصان","الجمل","الفيل","الغزال"],c:1},
  {q:"كم ضلعاً للمثلث؟",a:["اثنان","ثلاثة","أربعة","خمسة"],c:1},
  {q:"ما أكبر محيط في العالم؟",a:["الأطلسي","الهندي","الهادئ","المتجمد"],c:2},
  {q:"ما العضو الذي يضخ الدم؟",a:["الرئة","القلب","الكبد","الكلية"],c:1},
  {q:"كم دقيقة في الساعة؟",a:["٣٠","٤٥","٦٠","٩٠"],c:2},
  {q:"أي فصل يأتي بعد الشتاء؟",a:["الصيف","الخريف","الربيع","الشتاء"],c:2},
  {q:"ما عاصمة مصر؟",a:["الإسكندرية","القاهرة","الجيزة","الأقصر"],c:1},
  {q:"ما الغاز الذي تحتاجه النار للاشتعال؟",a:["الأوكسجين","النيتروجين","الهيليوم","الهيدروجين"],c:0},
  {q:"كم عدد ألوان قوس قزح الشائعة؟",a:["خمسة","ستة","سبعة","ثمانية"],c:2},
  {q:"أي حيوان يبيض؟",a:["القطة","الدجاجة","الحصان","البقرة"],c:1},
  {q:"ما ناتج ٩ × ٧؟",a:["٥٦","٦٣","٧٢","٧٩"],c:1},
  {q:"أي جهة تشرق منها الشمس؟",a:["الغرب","الشمال","الشرق","الجنوب"],c:2}
];
const WHO_CATEGORIES = {
  "الحيوانات":["أسد","فيل","دلفين","نمر","قطة","كلب","تمساح","بطريق","جمل","خفاش"],
  "الدول":["العراق","مصر","اليابان","البرازيل","إيطاليا","كندا","تركيا","الهند"],
  "الأكلات":["دولمة","برياني","بيتزا","كبسة","مسكوف","كبة","فلافل","شاورما"],
  "السيارات":["لامبورغيني","فيراري","تويوتا","مرسيدس","نيسان جي تي آر","BMW","تسلا"],
  "الطيور":["صقر","نسر","بومة","ببغاء","حمامة","نعامة"]
};
const LIAR_WORDS = ["بغداد","تمرة","دجلة","قهوة","نخلة","سفينة","قمر","مطر","مدرسة","أسد","بحر","صحراء"];
const MOST_PROMPTS = [
  "منو الأكثر احتمالاً يتأخر على اللمة؟",
  "منو الأكثر يضحك على نكتة قديمة؟",
  "منو الأكثر ينسى وين حط موبايله؟",
  "منو الأكثر يسافر بدون تخطيط؟",
  "منو الأكثر يطلب أكل زيادة؟",
  "منو الأكثر يحوّل السالفة إلى ضحك؟"
];
const YESNO_QUESTIONS = [
  "شنو أول شي تسويه إذا صحيت متأخر؟",
  "لو ربحت رحلة مجانية، وين تروح؟",
  "منو آخر شخص ضحكك اليوم؟",
  "احچي عن أكلة تحبها.",
  "شنو أكثر تطبيق تستخدمه؟"
];
const YESNO_TRAPS = [
  "تحب الشاي؟ جاوب بجملة كاملة.",
  "مو صحيح إنك تحب السفر؟",
  "هل سبق وتأخرت عن موعد مهم؟",
  "تگدر تقول إنك ما تحب الوناسة؟",
  "أنت مو من محبي القهوة، صحيح؟",
  "لو سألتك: ما تحب الأكل الحار؟ شتجاوب؟"
];
const WHEEL_CHOICES = ["خَمِّن مَنُو آني؟","تخمين الرقم","برا السالفة","ممنوع إي ولا","منو الأكثر؟","حيّة ودرج","دومينوا","طاولي مبسّطة","كروت الألوان","تحدّي الأسئلة"];
const SNAKES = {3:22,8:30,20:41,27:56,50:67,71:91,80:99,17:4,34:12,62:19,87:24,95:75,99:78};
const COLORS = ["أحمر","أزرق","أخضر","أصفر"];
const VALUES = ["١","٢","٣","٤","تخطي"];
const $ = (s,r=document)=>r.querySelector(s);
const esc = s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const rand = n=>Math.floor(Math.random()*n);
const shuffle = a=>{const x=a.slice();for(let i=x.length-1;i>0;i--){const j=rand(i+1);[x[i],x[j]]=[x[j],x[i]]}return x};
let layer=null,state=null,timer=null;

function base(game,difficulty){
 return {game:game,difficulty:difficulty||"medium",turn:0,status:"playing",scores:[0,0],round:1,feed:[],last:"بدأ التدريب ضد أوراس 🤖",winner:null};
}
function create(game,difficulty){
 const s=base(game,difficulty);
 if(game==="number"){s.secret=1+rand(100);s.range=[1,100];s.tries=[0,0];s.history=[]}
 else if(game==="who"){s.category=Object.keys(WHO_CATEGORIES)[rand(Object.keys(WHO_CATEGORIES).length)];s.secret=WHO_CATEGORIES[s.category][rand(WHO_CATEGORIES[s.category].length)];s.log=[];s.askLimit=[10,8,6,4][difficultyRank(s)];s.last="الفئة: "+s.category+"؛ اسأل أوراس أسئلة نعم أو لا حتى تعرف الشيء السري."}
 else if(game==="liar"){
   s.names=["إنت","أوراس ١","أوراس ٢","أوراس ٣"];s.liar=rand(4);s.word=LIAR_WORDS[rand(LIAR_WORDS.length)];s.stage="hints";s.hints=[];s.votes=[];s.humanRole=s.liar===0?"liar":"player";s.last=s.humanRole==="liar"?"إنت برا السالفة! حاول تندمج من دون ما تعرف الكلمة.":"الكلمة السرية: "+s.word+"؛ لا تكشفها بالتلميح.";
 }
 else if(game==="most"){s.names=["إنت","أوراس ١","أوراس ٢","أوراس ٣"];s.prompt=MOST_PROMPTS[rand(MOST_PROMPTS.length)];s.votes=[];s.last=s.prompt}
 else if(game==="yesno"){s.questions=shuffle(difficultyRank(s)>=2?YESNO_QUESTIONS.concat(YESNO_TRAPS):YESNO_QUESTIONS);s.questionIndex=0;s.last=s.questions[0];s.turn=0}
 else if(game==="snakes"){s.positions=[0,0];s.dice=null;s.last="ابدأ برمية النرد. أول لاعب يصل إلى ١٠٠ يفوز."}
 else if(game==="tavla"){
   s.positions=[[],[]];for(let i=0;i<15;i++){s.positions[0].push([0,11,16,18][i%4]);s.positions[1].push([23,12,7,5][i%4])}
   s.dice=[];s.selected=null;s.off=[0,0];s.last="هذه هي الطاولي المبسّطة الموجودة في اللعبة: نردان وحركتان منفصلتان على مسار من ٠ إلى ٢٣.";
 }
 else if(game==="colors"){
   let deck=[];for(let copy=0;copy<3;copy++)for(const c of COLORS)for(const v of VALUES)deck.push({c:c,v:v});
   deck=shuffle(deck);s.hands=[deck.splice(0,7),deck.splice(0,7)];s.discard=[deck.pop()];s.stock=deck;s.drawn=[false,false];s.last="طابق اللون أو القيمة. إذا ما عندك حركة اسحب كرتاً.";
 }
 else if(game==="quiz"){s.deck=shuffle(QUESTIONS);s.question=s.deck.pop();s.answers=[null,null];s.last=s.question.q}
 else if(game==="wheel"){s.spins=[];s.last="الدولاب لعبة حظ؛ الصعوبة لا تغيّر احتمالات النتيجة."}
 else throw new Error("محرك اللعبة غير معروف: "+game);
 return s;
}
function finish(s,winner,message){s.status="finished";s.winner=winner;s.last=message|| (winner===0?"فزت على أوراس!":"أوراس فاز هالمرة.");return s}
function difficultyRank(s){return ({easy:0,medium:1,hard:2,expert:3})[s.difficulty]??1}
function safeGuess(s){
 const [lo,hi]=s.range,rank=difficultyRank(s);
 if(rank===0)return lo+rand(hi-lo+1);
 if(rank===1){const mid=Math.floor((lo+hi)/2);return Math.max(lo,Math.min(hi,mid+(rand(5)-2)*Math.max(1,Math.floor((hi-lo)/12))))}
 if(rank===2){const mid=Math.floor((lo+hi)/2);return Math.max(lo,Math.min(hi,mid+(rand(3)-1)))}
 return Math.floor((lo+hi)/2);
}
function botGuess(s){
 const n=safeGuess(s);s.tries[1]++;s.history.push({player:1,guess:n});
 if(n===s.secret)return finish(s,1,"أوراس وصل للرقم "+n+" وفاز بعد "+s.tries[1]+" محاولة.");
 if(n<s.secret)s.range[0]=Math.max(s.range[0],n+1);else s.range[1]=Math.min(s.range[1],n-1);
 s.last="أوراس خمّن "+n+"؛ الرقم السري "+(n<s.secret?"أكبر":"أصغر")+". دورك هسه.";
 s.turn=0;return s;
}
function apply(s,action){
 if(!s||s.status!=="playing")return s;
 const rank=difficultyRank(s);
 if(s.game==="who"){
   if(action.type==="ask"){
     const question=String(action.value||"").trim().slice(0,120);if(!question){s.last="اكتب سؤالاً أولاً.";return s}
     if(s.log.length>=s.askLimit){s.last="خلصت أسئلة هالمستوى. ثبّت تخمينك هسه.";return s}
     const result=window.SuwadWhoAI?.answer(s.category,s.secret,question);
     const answer=result?.answer||"ما عندي معلومة موثوقة عن هالسؤال.";
     s.log.push({q:question,a:answer});s.last=answer+" (باقي "+(s.askLimit-s.log.length)+" أسئلة).";return s;
   }
   if(action.type==="guess"){
     const guess=String(action.value||"").trim();if(!guess){s.last="اختار تخمينك من القائمة.";return s}
     const norm=x=>String(x).toLowerCase().replace(/[ًٌٍَُِّْٰـ]/g,"").replace(/\s+/g,"");
     return finish(s,norm(guess)===norm(s.secret)?0:1,norm(guess)===norm(s.secret)?"أحسنت! عرفت "+s.secret+".":"مو هي! الجواب الصحيح كان "+s.secret+".");
   }
 }
 if(s.game==="number"){
   if(action.type!=="guess"||s.turn!==0)return s;
   const n=Number(action.value);if(!Number.isInteger(n)||n<s.range[0]||n>s.range[1]){s.last="اختار رقماً ضمن المجال "+s.range[0]+" إلى "+s.range[1]+".";return s}
   s.tries[0]++;s.history.push({player:0,guess:n});
   if(n===s.secret)return finish(s,0,"صبت الرقم "+n+" وفزت على أوراس!");
   if(n<s.secret)s.range[0]=Math.max(s.range[0],n+1);else s.range[1]=Math.min(s.range[1],n-1);
   s.last="تخمينك "+n+"؛ الرقم السري "+(n<s.secret?"أكبر":"أصغر")+". هسه دور أوراس.";
   s.turn=1;return s;
 }
 if(s.game==="liar"){
   if(s.stage==="hints"&&action.type==="hint"){
     const hint=String(action.value||"").trim().slice(0,80);if(!hint){s.last="اكتب تلميحاً قصيراً أولاً.";return s}
     s.hints[0]=hint;
     for(let i=1;i<4;i++){
       if(i===s.liar)s.hints[i]=["شي معروف","مرتبط بالحياة","سمعت بيه قبل"][rand(3)];
       else s.hints[i]=botHint(s.word,rank,i);
     }
     s.stage="vote";s.last="انتهت التلميحات. راجع كلام الربع وصوّت على الشخص اللي تشك بيه.";return s;
   }
   if(s.stage==="vote"&&action.type==="vote"){
     const suspect=Number(action.value);if(!Number.isInteger(suspect)||suspect<1||suspect>3){s.last="اختار واحداً من أوراس ١ أو ٢ أو ٣.";return s}
     s.votes[0]=suspect;
     for(let i=1;i<4;i++)s.votes[i]=botVoteLiar(s,i,rank);
     const counts=[0,0,0,0];s.votes.forEach(v=>{if(Number.isInteger(v))counts[v]++});
     const max=Math.max(...counts),suspects=counts.map((v,i)=>v===max?i:-1).filter(i=>i>=0),caught=suspects.includes(s.liar);
     if(s.humanRole==="liar"){
       const won=!caught;return finish(s,won?0:1,won?"نجحت بالخداع! ما كشفوك. الكلمة كانت: "+s.word:"كشفوك! إنت كنت برا السالفة. الكلمة: "+s.word);
     }
     return finish(s,caught?0:1,caught?"صوّتّوا على برا السالفة الصحيح! الكلمة: "+s.word:"ما كشفتوا برا السالفة. كان "+s.names[s.liar]+" والكلمة: "+s.word);
   }
 }
 if(s.game==="most"&&action.type==="vote"){
   const pick=Number(action.value);if(!Number.isInteger(pick)||pick<1||pick>3){s.last="اختار واحداً من أوراس ١ أو ٢ أو ٣.";return s}
   s.votes[0]=pick;
   for(let i=1;i<4;i++)s.votes[i]=botMostVote(s,i,rank);
   const counts=[0,0,0,0];s.votes.forEach(v=>counts[v]++);
   const max=Math.max(...counts),winners=counts.map((v,i)=>v===max?i:-1).filter(i=>i>=0);
   s.last="نتيجة التصويت: "+counts.map((n,i)=>s.names[i]+" "+n+" صوت").join("، ")+". "+(winners.length===1?"الأكثر هو "+s.names[winners[0]]:"تعادل بين أكثر من لاعب.");
   s.status="finished";s.winner=null;return s;
 }
 if(s.game==="yesno"&&action.type==="answer"){
   const text=String(action.value||"").trim().slice(0,160);if(!text){s.last="اكتب جوابك أولاً.";return s}
   const normalized=text.toLowerCase().replace(/[ًٌٍَُِّْٰـ]/g,"").replace(/[إأآ]/g,"ا");
   const tokens=normalized.split(/[\s,،.?!؟;:]+/).filter(Boolean);
   const caught=tokens.some(word=>["اي","نعم","لا","اجل","كلا"].includes(word));
   if(caught){s.scores[1]++;s.last="انمسكت! جوابك احتوى كلمة ممنوعة. أوراس يسجل نقطة."}
   else{s.scores[0]++;s.last="نجوت من الفخ! جوابك ما احتوى الكلمات الممنوعة."}
   s.questionIndex++;
   if(s.questionIndex>=s.questions.length)return finish(s,s.scores[0]>s.scores[1]?0:s.scores[1]>s.scores[0]?1:null,"انتهى التحدي. نتيجتك "+s.scores[0]+" مقابل "+s.scores[1]+".");
   s.last+=" السؤال التالي: "+s.questions[s.questionIndex];return s;
 }
 if(s.game==="snakes"&&action.type==="roll"&&s.turn===0){
   const dice=1+rand(6);s.dice=dice;let next=s.positions[0]+dice;
   if(next<=100)next=SNAKES[next]??next;
   else next=s.positions[0];
   s.positions[0]=next;s.last="رميت "+dice+" ووصلت للمربع "+next+".";
   if(next===100)return finish(s,0,"وصلت للمربع ١٠٠ وفزت!");
   s.turn=1;return s;
 }
 if(s.game==="tavla"){
   if(action.type==="roll"&&s.turn===0&&s.dice.length===0){s.dice=[1+rand(6),1+rand(6)];s.selected=null;s.last="النرد: "+s.dice[0]+" و"+s.dice[1]+". استخدم النتيجتين وحدة بعد الثانية.";return s}
   if(action.type==="move"&&s.turn===0&&s.dice.length&&s.selected===null){
     const point=Number(action.point);if(!s.positions[0].includes(point)){s.last="ما عندك قطعة بهالنقطة.";return s}
     const dest=point+s.dice[0],index=s.positions[0].indexOf(point);s.positions[0].splice(index,1);
     if(dest>23)s.off[0]++;else s.positions[0].push(dest);
     s.dice.shift();s.selected=null;s.last=dest>23?"أخرجت قطعة من المسار.":"حرّكت قطعة إلى النقطة "+dest+".";
     if(s.off[0]>=15)return finish(s,0,"أخرجت كل قطعك وفزت!");
     if(s.dice.length===0)s.turn=1;return s;
   }
 }
 if(s.game==="colors"){
   if(action.type==="play"&&s.turn===0){
     const index=Number(action.index),hand=s.hands[0],card=hand[index],top=s.discard[s.discard.length-1];
     if(!card){s.last="الكرت المختار غير موجود.";return s}
     if(card.c!==top.c&&card.v!==top.v){s.last="اختار كرتاً يطابق اللون أو القيمة.";return s}
     hand.splice(index,1);s.discard.push(card);s.drawn[0]=false;s.last="لعبت "+card.c+" "+card.v+".";
     if(!hand.length)return finish(s,0,"خلّصت كروتك وفزت!");
     s.turn=1;return s;
   }
   if(action.type==="draw"&&s.turn===0){
     if(s.drawn[0]){s.last="سحبت كرتاً بالفعل؛ العب أو مرّر.";return s}
     if(!s.stock.length&&s.discard.length>1){const top=s.discard.pop();s.stock=shuffle(s.discard);s.discard=[top]}
     if(!s.stock.length){s.last="ما بقت كروت للسحب.";return s}
     s.hands[0].push(s.stock.pop());s.drawn[0]=true;s.last="سحبت كرتاً. إذا يطابق اللون أو القيمة تگدر تلعبه، وإلا مرّر.";
     return s;
   }
   if(action.type==="pass"&&s.turn===0&&s.drawn[0]){s.drawn[0]=false;s.turn=1;s.last="مرّرت الدور بعد السحب.";return s}
 }
 if(s.game==="quiz"&&action.type==="answer"){
   const choice=Number(action.value);if(!Number.isInteger(choice)||choice<0||choice>3){s.last="اختار إجابة من الخيارات.";return s}
   const correct=choice===s.question.c;if(correct)s.scores[0]++;
   const rankChance=[.48,.65,.82,.94][rank],botCorrect=Math.random()<rankChance;
   if(botCorrect)s.scores[1]++;
   s.last=(correct?"إجابتك صحيحة. ":"إجابتك مو صحيحة. ")+(botCorrect?"أوراس جاوب صح.":"أوراس أخطأ.")+" الصحيح: "+s.question.a[s.question.c]+".";
   s.round++;
   if(s.deck.length===0)return finish(s,s.scores[0]>s.scores[1]?0:s.scores[1]>s.scores[0]?1:null,"انتهى بنك الأسئلة. نتيجتك "+s.scores[0]+" مقابل "+s.scores[1]+".");
   s.question=s.deck.pop();return s;
 }
 if(s.game==="wheel"&&action.type==="spin"){
   const result=WHEEL_CHOICES[rand(WHEEL_CHOICES.length)],botResult=WHEEL_CHOICES[rand(WHEEL_CHOICES.length)];s.spins.push({by:"إنت",result},{by:"أوراس",result:botResult});s.last="نتيجتك: "+result+"؛ نتيجة أوراس: "+botResult+". الدولاب يعتمد على الحظ، مو على مستوى الذكاء.";return s;
 }
 return s;
}
function botHint(word,rank,index){
 const clues={بغداد:"مدينة عراقية",تمرة:"شي من النخلة",دجلة:"نهر معروف",قهوة:"مشروب",نخلة:"شجرة",سفينة:"وسيلة نقل",قمر:"نشوفه بالليل",مطر:"ينزل من السماء",مدرسة:"مكان للتعلم",أسد:"حيوان قوي",بحر:"مكان مائي واسع",صحراء:"مكان جاف"};
 const vague=["شي معروف","نشوفه بحياتنا","مرتبط بالناس","إله علاقة بالطبيعة"];
 return rank===0?vague[rand(vague.length)]:rank===1?(clues[word]||vague[0]):rank===2?(clues[word]||vague[1]):(clues[word]||vague[2]);
}
function botVoteLiar(s,bot,rank){
 const candidates=s.hints.map((h,i)=>({i,v:/شي معروف|مرتبط بالحياة|سمعت بيه|نشوفه بحياتنا/.test(h||"")?2:0})).filter(x=>x.i!==bot);
 if(rank===0)return candidates[rand(candidates.length)].i;
 if(rank===1&&Math.random()<.55)return candidates[rand(candidates.length)].i;
 candidates.sort((a,b)=>b.v-a.v);
 return candidates[0]?.i??(bot===1?2:1);
}
function botMostVote(s,bot,rank){
 if(rank===0||rank===1)return 1+rand(3);
 const prompt=s.prompt;
 if(/يتأخر/.test(prompt))return rank===3?(bot===1?1:bot===2?2:3):(bot===1?1:2);
 if(/ينسى/.test(prompt))return bot===2?2:bot===3?3:1;
 if(/يضحك/.test(prompt))return bot===3?3:bot===2?2:1;
 return 1+rand(3);
}
function botTurn(s){
 if(!s||s.status!=="playing")return s;
 if(s.game==="number"&&s.turn===1)return botGuess(s);
 if(s.game==="snakes"&&s.turn===1){
   const dice=1+rand(6);let next=s.positions[1]+dice;if(next<=100)next=SNAKES[next]??next;else next=s.positions[1];
   s.positions[1]=next;s.dice=dice;s.last="أوراس رمى "+dice+" ووصل إلى "+next+".";
   if(next===100)return finish(s,1,"أوراس وصل للمربع ١٠٠ وفاز.");
   s.turn=0;return s;
 }
 if(s.game==="tavla"&&s.turn===1){
   const dice=[1+rand(6),1+rand(6)],rank=difficultyRank(s),points=s.positions[1],moves=[];
   if(!points.length)return finish(s,0,"أوراس ما بقت عنده قطع.");
   for(const die of dice){
     if(!points.length)break;
     let point=points[rand(points.length)];
     if(rank>=2)point=points.slice().sort((a,b)=>a-b)[0];
     const dest=point-die,index=points.indexOf(point);points.splice(index,1);
     if(dest<0)s.off[1]++;else points.push(dest);
     moves.push(die+" من "+point+(dest<0?" إلى خارج اللوحة":" إلى "+dest));
     if(s.off[1]>=15)return finish(s,1,"أوراس أخرج كل قطعه وفاز.");
   }
   s.last="أوراس رمى "+dice.join(" و")+"؛ "+moves.join("، ")+".";
   s.turn=0;return s;
 }
 if(s.game==="colors"&&s.turn===1){
   const hand=s.hands[1],top=s.discard[s.discard.length-1];
   const legal=hand.map((c,i)=>({c,i})).filter(x=>x.c.c===top.c||x.c.v===top.v);
   if(!legal.length){
     if(!s.stock.length&&s.discard.length>1){const keep=s.discard.pop();s.stock=shuffle(s.discard);s.discard=[keep]}
     if(s.stock.length){hand.push(s.stock.pop());s.last="أوراس سحب كرتاً.";if(hand.length&& (hand[hand.length-1].c===top.c||hand[hand.length-1].v===top.v)){s.last+=" ولعبه مباشرة.";const c=hand.pop();s.discard.push(c);if(!hand.length)return finish(s,1,"أوراس خلّص كروته وفاز.")}}
     s.turn=0;return s;
   }
   const rank=difficultyRank(s);
   legal.sort((a,b)=>{
     const score=x=>{const same=hand.filter(c=>c.c===x.c.c).length;return (rank===0?rand(4):same* (rank+1)+(x.c.v==="تخطي"?2:0))};
     return score(b)-score(a)
   });
   const picked=legal[0].c;hand.splice(legal[0].i,1);s.discard.push(picked);s.last="أوراس لعب "+picked.c+" "+picked.v+".";
   if(!hand.length)return finish(s,1,"أوراس خلّص كروته وفاز.");
   s.turn=0;return s;
 }
 return s;
}
function render(){
 if(!layer||!state)return;
 const s=state,rank=difficultyRank(s),done=s.status==="finished";
 let body="";
 if(s.game==="who")body='<p>الفئة: '+esc(s.category)+'</p><div class="gai-feed">'+s.log.map(x=>'<p><b>سؤالك:</b> '+esc(x.q)+'<br><b>أوراس:</b> '+esc(x.a)+'</p>').join("")+'</div><input id="gaiText" maxlength="120" placeholder="اسأل سؤال نعم أو لا"><button data-act="ask" class="gai-primary">اسأل أوراس</button><select id="gaiWhoGuess"><option value="">اختار تخمينك</option>'+WHO_CATEGORIES[s.category].map(x=>'<option>'+esc(x)+'</option>').join("")+'</select><button data-act="whoGuess">ثبّت تخميني</button>';
 if(s.game==="number")body='<p>الرقم بين '+s.range[0]+' و'+s.range[1]+' • محاولاتك '+s.tries[0]+' • محاولات أوراس '+s.tries[1]+'</p><input id="gaiNumber" type="number" min="'+s.range[0]+'" max="'+s.range[1]+'" placeholder="اكتب تخمينك"><button data-act="guess" class="gai-primary">خمّن</button>';
 if(s.game==="liar"){
   body='<p>مرحلة: '+(s.stage==="hints"?"التلميحات":"التصويت")+'</p><p class="gai-secret">'+(s.humanRole==="liar"?"🕵️ إنت برا السالفة. حاول تندمج.":"🔐 الكلمة السرية: "+esc(s.word))+'</p>';
   body+='<div class="gai-list">'+s.names.map((n,i)=>'<div><b>'+esc(n)+'</b><span>'+(s.hints[i]?esc(s.hints[i]):"بانتظار التلميح")+'</span></div>').join("")+'</div>';
   if(s.stage==="hints")body+='<input id="gaiText" maxlength="80" placeholder="اكتب تلميحك من دون كشف الكلمة"><button data-act="hint" class="gai-primary">أرسل التلميح</button>';
   else body+='<p>منو تشك بيه؟</p>'+[1,2,3].map(i=>'<button data-act="vote" data-value="'+i+'">'+s.names[i]+'</button>').join("");
 }
 if(s.game==="most"){
   body='<h3>'+esc(s.prompt)+'</h3><p>اختار منو تتوقع تنطبق عليه العبارة:</p>'+[1,2,3].map(i=>'<button data-act="vote" data-value="'+i+'">'+s.names[i]+'</button>').join("");
 }
 if(s.game==="yesno")body='<h3>'+esc(s.questions[s.questionIndex])+'</h3><p>جاوب بجملة طبيعية. أوراس يفحص وجود الكلمات الممنوعة.</p><textarea id="gaiText" maxlength="160" placeholder="اكتب جوابك"></textarea><button data-act="answer" class="gai-primary">تحقق من الجواب</button><p>نقاطك '+s.scores[0]+' • أوراس '+s.scores[1]+'</p>';
 if(s.game==="snakes")body='<p class="gai-note">هذا الطور يعتمد على رمية النرد؛ مستويات الصعوبة لا تتلاعب بالحظ.</p>'+'<p>موقعك: '+s.positions[0]+' • موقع أوراس: '+s.positions[1]+'</p><div class="gai-board">'+Array.from({length:100},(_,i)=>100-i).map(n=>'<span class="'+(s.positions[0]===n?"gai-me":s.positions[1]===n?"gai-bot":"")+'">'+n+'</span>').join("")+'</div><button data-act="roll" class="gai-primary">🎲 ارْمِ النرد</button>';
 if(s.game==="tavla"){
   body='<p>قطعك المتبقية: '+s.positions[0].length+' • قطع أوراس: '+s.positions[1].length+' • أخرجت: '+s.off[0]+' مقابل '+s.off[1]+'</p>';
   body+='<p>نتائج النرد المتبقية: '+(s.dice.length?s.dice.join(" و"):"لم ترمِ بعد")+'</p><div class="gai-list">'+[...new Set(s.positions[0])].sort((a,b)=>a-b).map(p=>'<button data-act="move" data-point="'+p+'" '+(!s.dice.length?"disabled":"") +'>حرّك قطعة من النقطة '+p+'</button>').join("")+'</div><button data-act="roll" class="gai-primary" '+(s.dice.length?"disabled":"") +'>🎲 ارْمِ نردين</button>';
 }
 if(s.game==="colors"){
   const top=s.discard[s.discard.length-1];
   body='<p>الكرت المفتوح: <b>'+top.c+' '+top.v+'</b> • مخزون السحب '+s.stock.length+'</p><p>كروتك ('+s.hands[0].length+'):</p><div class="gai-cards">'+s.hands[0].map((c,i)=>'<button data-act="play" data-index="'+i+'" style="border-color:'+({"أحمر":"#e05b5b","أزرق":"#559be0","أخضر":"#4da77b","أصفر":"#d5b94e"}[c.c])+'">'+c.c+'<b>'+c.v+'</b></button>').join("")+'</div><button data-act="draw" class="gai-primary">اسحب كرتاً</button><button data-act="pass">مرّر الدور بعد السحب</button>';
 }
 if(s.game==="quiz")body='<h3>'+esc(s.question.q)+'</h3><div class="gai-answers">'+s.question.a.map((a,i)=>'<button data-act="answer" data-value="'+i+'">'+esc(a)+'</button>').join("")+'</div><p>نقاطك '+s.scores[0]+' • أوراس '+s.scores[1]+'</p>';
 if(s.game==="wheel")body='<p class="gai-note">الدولاب حظ عادل؛ مستوى الصعوبة لا يغيّر احتمالات الاختيار.</p>'+'<p>عدد اللفات: '+s.spins.length+'</p><div class="gai-wheel">'+s.spins.slice(-4).map(x=>'<div>🎯 '+esc(x.result)+'</div>').join("")+'</div><button data-act="spin" class="gai-primary">لفّ الدولاب</button>';
 const logs=s.feed.slice(-5).map(x=>'<li>'+esc(x)+'</li>').join("");
 layer.innerHTML='<section class="gai-dialog" role="dialog" aria-modal="true"><header><div><small>تدريب محلي مستقل • بلا XP أو إنجازات أو غرف</small><h2>'+GAME_NAMES[s.game]+' ضد أوراس 🤖</h2></div><button data-act="close" class="gai-close" aria-label="إغلاق">×</button></header><div class="gai-meta"><label>الصعوبة <select id="gaiDifficulty">'+DIFFICULTIES.map(d=>'<option value="'+d.id+'" '+(s.difficulty===d.id?"selected":"")+'>'+d.label+'</option>').join("")+'</select></label><span>الجولة '+s.round+'</span></div><div class="gai-status">'+(done?"🏁 انتهت الجولة":s.turn===0?"دورك":"دور أوراس")+'<p>'+esc(s.last)+'</p></div><main>'+body+'</main>'+(logs?'<ol class="gai-feed">'+logs+'</ol>':"")+(done?'<button data-act="restart" class="gai-primary">جولة جديدة</button>':"")+'</section>';
 layer.querySelectorAll("[data-act]").forEach(b=>b.addEventListener("click",()=>handle(b.dataset.act,b.dataset)));
 const input=$("#gaiNumber",layer);if(input)input.addEventListener("keydown",e=>{if(e.key==="Enter")handle("guess",{value:input.value})});
 const text=$("#gaiText",layer);if(text&&s.game==="liar")text.addEventListener("keydown",e=>{if(e.key==="Enter")handle("hint",{value:text.value})});
 if(text&&s.game==="who")text.addEventListener("keydown",e=>{if(e.key==="Enter")handle("ask",{value:text.value})});
}
function handle(type,data){
 if(type==="close"){close();return}
 if(type==="restart"){start(state.game,state.difficulty);return}
 if(type==="guess")apply(state,{type:"guess",value:data.value||$("#gaiNumber",layer)?.value});
 else if(type==="hint")apply(state,{type:"hint",value:data.value||$("#gaiText",layer)?.value});
 else if(type==="ask")apply(state,{type:"ask",value:data.value||$("#gaiText",layer)?.value});
 else if(type==="whoGuess")apply(state,{type:"guess",value:$("#gaiWhoGuess",layer)?.value});
 else if(type==="answer")apply(state,{type:"answer",value:data.value});
 else if(type==="vote")apply(state,{type:"vote",value:data.value});
 else if(type==="roll")apply(state,{type:"roll"});
 else if(type==="move")apply(state,{type:"move",point:data.point});
 else if(type==="play")apply(state,{type:"play",index:data.index});
 else if(type==="draw")apply(state,{type:"draw"});
 else if(type==="pass")apply(state,{type:"pass"});
 else if(type==="spin")apply(state,{type:"spin"});
 const diff=$("#gaiDifficulty",layer);if(diff&&diff.value!==state.difficulty)state.difficulty=diff.value;
 if(state.status==="playing"&&state.turn===1){
   if(state.game==="number"||state.game==="snakes"||state.game==="tavla"||state.game==="colors")botTurn(state);
 }
 render();
}
function start(game,difficulty){
 clearTimeout(timer);state=create(game,difficulty||"medium");
 if(!layer){layer=document.createElement("div");layer.className="gai-backdrop";layer.hidden=true;document.body.appendChild(layer)}
 layer.hidden=false;document.body.classList.add("gai-open");render();
}
function close(){clearTimeout(timer);if(layer)layer.hidden=true;document.body.classList.remove("gai-open")}
function mount(){
 const map={liar:"liar",yesno:"yesno",most:"most",snakes:"snakes",tavla:"tavla",colors:"colors",quiz:"quiz"};
 Object.entries(map).forEach(([id,key])=>{
   const selector='[data-game="'+id+'"],[data-extra-game="'+id+'"],[data-online-game="'+id+'"]';
   document.querySelectorAll(selector).forEach(trigger=>{
     const card=trigger.closest(".game-card"),host=card&&card.querySelector(".game-info");
     if(!host||host.querySelector('[data-gai-launch="'+key+'"]'))return;
     if(key==="domino")return;
     const b=document.createElement("button");b.type="button";b.className="btn btn-ghost gai-launch";b.dataset.gaiLaunch=key;b.textContent="تدريب ضد أوراس 🤖";
     b.addEventListener("click",()=>start(key,"medium"));host.appendChild(b);
   });
 });
 const quick=$("#quickRandom");
 if(quick&&!$("#quickRandomAI")){const b=document.createElement("button");b.id="quickRandomAI";b.type="button";b.className="btn btn-ghost gai-launch";b.textContent="تدريب الدولاب ضد AI";b.addEventListener("click",()=>start("wheel","medium"));quick.insertAdjacentElement("afterend",b)}
}
window.SuwadGameAIPractice={start:start,create:create,apply:apply,botTurn:botTurn,difficulties:DIFFICULTIES.map(x=>x.id),games:Object.keys(GAME_NAMES)};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount);else mount();
})();