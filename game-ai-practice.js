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
  snakes:"حيّة ودرج",tavla:"الطاولي الكلاسيكية",colors:"كروت الألوان",quiz:"تحدّي الأسئلة",wheel:"الدولاب"
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
  "الحيوانات": [
    "بطة",
    "بقرة",
    "أسد",
    "فيل",
    "زرافة",
    "بطريق",
    "دلفين",
    "نمر",
    "قطة",
    "كلب",
    "ذئب",
    "حصان",
    "كنغر",
    "تمساح",
    "بومة",
    "فهد",
    "دب قطبي",
    "ثعلب",
    "غوريلا",
    "باندا",
    "سلحفاة",
    "أرنب",
    "خفاش",
    "قرد",
    "جمل",
    "غزال",
    "ضبع",
    "ماعز",
    "خروف",
    "حمار"
  ],
  "الدول": [
    "العراق",
    "مصر",
    "اليابان",
    "البرازيل",
    "إيطاليا",
    "كندا",
    "المغرب",
    "تركيا",
    "أستراليا",
    "الهند",
    "الأرجنتين",
    "إسبانيا",
    "فرنسا",
    "ألمانيا",
    "المكسيك",
    "السعودية",
    "الأردن",
    "تونس",
    "كوريا الجنوبية",
    "النرويج",
    "إندونيسيا",
    "جنوب أفريقيا",
    "الصين",
    "روسيا",
    "البرتغال",
    "اليونان"
  ],
  "المصارعين": [
    "أندرتيكر",
    "جون سينا",
    "رومان رينز",
    "ذا روك",
    "ستون كولد",
    "باتيستا",
    "تريبل إتش",
    "راندي أورتن",
    "سي إم بانك",
    "شون مايكلز",
    "غولدبيرغ",
    "إيدج",
    "ري ميستيريو",
    "بروك ليسنر",
    "كودي رودز",
    "كين",
    "براي وايت",
    "درو ماكنتاير",
    "إيه جاي ستايلز",
    "سيث رولينز",
    "كيفن أوينز",
    "فين بالور",
    "بوكر تي"
  ],
  "لاعبو كرة القدم": [
    "ليونيل ميسي",
    "كريستيانو رونالدو",
    "نيمار",
    "محمد صلاح",
    "كيليان مبابي",
    "زين الدين زيدان",
    "رونالدينيو",
    "رونالدو نازاريو",
    "لوكا مودريتش",
    "إيرلينغ هالاند",
    "جود بيلينغهام",
    "سالم الدوسري",
    "يونس محمود",
    "علي عدنان",
    "أندريس إنييستا",
    "تشافي",
    "كريم بنزيما",
    "سيرجيو راموس",
    "روبرت ليفاندوفسكي",
    "كيفن دي بروين",
    "هاري كين",
    "رياض محرز",
    "أشرف حكيمي",
    "سون هيونغ مين"
  ],
  "شخصيات الألعاب": [
    "كراتوس",
    "ماريو",
    "سونيك",
    "لارا كروفت",
    "ماستر شيف",
    "سبايدرمان",
    "آرثر مورغان",
    "جون مارستون",
    "ناثان دريك",
    "ليون كينيدي",
    "جيرالت",
    "إيزيـو أوديتوري",
    "سكوربيون",
    "رايدن",
    "سوليد سنيك",
    "كراش بانديكوت",
    "باك مان",
    "سيفيرووث",
    "آشلي غراهام",
    "ألوي",
    "سبيكتر",
    "ليتل ماك",
    "دوم سلاير"
  ],
  "الأفلام": [
    "جوكر",
    "دارث فيدر",
    "جاك سبارو",
    "باتمان",
    "شيرلوك هولمز",
    "هاري بوتر",
    "إنديانا جونز",
    "فورست غامب",
    "روكي بالبوا",
    "جون ويك",
    "سبايدرمان",
    "آيرون مان",
    "ثور",
    "كابتن أمريكا",
    "شريك",
    "وودي",
    "إلسا",
    "نيمو",
    "مستر بين",
    "رامبو",
    "تيرميناتور",
    "كينغ كونغ",
    "غودزيلا",
    "هالك"
  ],
  "الأنمي": [
    "ناروتو",
    "غوكو",
    "لوفي",
    "زورو",
    "إيرين",
    "ليفاي",
    "إيتاتشي",
    "ساسكي",
    "كاكاشي",
    "غوجو ساتورو",
    "تانجيرو",
    "نيزوكو",
    "لايت ياغامي",
    "إل",
    "إدوارد إلريك",
    "كيلوا",
    "غون",
    "سايتاما",
    "ميكاسا",
    "ريوك",
    "إينوسكي",
    "زينيتسو",
    "روك لي",
    "مادارا",
    "بروك"
  ],
  "السيارات": [
    "لامبورغيني",
    "فيراري",
    "تويوتا",
    "مرسيدس",
    "جيب رانجلر",
    "نيسان جي تي آر",
    "BMW",
    "أودي",
    "بورشه",
    "رولز رويس",
    "فورد موستانغ",
    "شيفروليه كامارو",
    "تسلا",
    "هوندا",
    "لكزس",
    "ماكلارين",
    "هيونداي",
    "كيا",
    "فولكس فاغن",
    "دودج تشارجر",
    "سوبارو",
    "مازدا",
    "فولفو",
    "بنتلي"
  ],
  "الأكلات": [
    "دولمة",
    "برياني",
    "بيتزا",
    "كبسة",
    "تشريب",
    "سوشي",
    "برغر",
    "مسكوف",
    "كبة",
    "باجة",
    "منسف",
    "تبولة",
    "فلافل",
    "شاورما",
    "بقلاوة",
    "كليجة",
    "تشريب لحم",
    "مقلوبة",
    "قوزي",
    "قيمة",
    "كباب",
    "فطائر",
    "معكرونة",
    "آيس كريم"
  ],
  "الطيور": [
    "صقر",
    "نسر",
    "بومة",
    "ببغاء",
    "غراب",
    "حمامة",
    "طاووس",
    "نعامة",
    "بطّة",
    "دجاجة",
    "هدهد",
    "كناري",
    "لقلق",
    "فلامنغو",
    "نورس",
    "عقاب",
    "عصفور",
    "ديك",
    "إوزة",
    "بجعة",
    "نقّار الخشب",
    "سنونو",
    "كوكاتو",
    "كيوي"
  ],
  "كائنات البحر": [
    "قرش",
    "حوت أزرق",
    "أخطبوط",
    "حبار",
    "فرس البحر",
    "نجم البحر",
    "قنديل البحر",
    "سلطعون",
    "روبيان",
    "فقمة",
    "أوركا",
    "سمكة المهرج",
    "مانتا",
    "ثعبان البحر",
    "محار",
    "خيار البحر",
    "دلفين",
    "سردين",
    "تونة",
    "سمكة أبو سيف",
    "كركند",
    "قنفذ البحر",
    "سمكة قرش المطرقة",
    "الحوت الأحدب"
  ],
  "الأبطال الخارقون": [
    "سوبرمان",
    "باتمان",
    "سبايدرمان",
    "آيرون مان",
    "ثور",
    "هالك",
    "ووندر وومن",
    "فلاش",
    "أكوامان",
    "بلاك بانثر",
    "دكتور سترينج",
    "ديدبول",
    "وولفرين",
    "كابتن أمريكا",
    "ثانوس",
    "لوكي",
    "كابتن مارفل",
    "آنت مان",
    "هوك آي",
    "بلاك ويدو",
    "فينوم",
    "غرين لانترن",
    "شازام",
    "ريد هود"
  ],
  "المهن": [
    "طبيب",
    "مهندس",
    "طيّار",
    "شرطي",
    "إطفائي",
    "معلّم",
    "طباخ",
    "مزارع",
    "مصور",
    "محقق",
    "ممرض",
    "ميكانيكي",
    "لاعب كرة",
    "مذيع",
    "نجّار",
    "صياد",
    "خبّاز",
    "كهربائي",
    "سبّاك",
    "محامي",
    "قاضٍ",
    "سائق",
    "حلاق",
    "مبرمج"
  ],
  "المعالم": [
    "برج إيفل",
    "الأهرامات",
    "برج خليفة",
    "سور الصين العظيم",
    "تمثال الحرية",
    "تاج محل",
    "الكولوسيوم",
    "البتراء",
    "زقورة أور",
    "ساعة بيغ بن",
    "ماتشو بيتشو",
    "أبو الهول",
    "برج بيزا",
    "الكعبة",
    "شلالات نياگرا",
    "دار الأوبرا",
    "تمثال المسيح الفادي",
    "قصر الحمراء",
    "مسجد قرطبة",
    "أيا صوفيا",
    "جبل إيفرست",
    "معبد أنغكور وات",
    "جزيرة الفصح",
    "قصر فرساي"
  ],
  "الفواكه": [
    "تفاح",
    "موز",
    "برتقال",
    "رمان",
    "مانجو",
    "عنب",
    "بطيخ",
    "فراولة",
    "أناناس",
    "كيوي",
    "خوخ",
    "مشمش",
    "تين",
    "تمر",
    "كمثرى",
    "كرز",
    "ليمون",
    "جوافة",
    "بابايا",
    "شمام",
    "توت",
    "أفوكادو",
    "برقوق",
    "جوز الهند"
  ],
  "الآلات الموسيقية": [
    "عود",
    "گيتار",
    "بيانو",
    "كمان",
    "ناي",
    "طبلة",
    "قانون",
    "ساكسفون",
    "أكورديون",
    "مزمار",
    "تشيلو",
    "ترومبيت",
    "دف",
    "قيثارة",
    "هارمونيكا",
    "بزق",
    "ربابة",
    "كونترباص",
    "فلوت",
    "كلارينيت",
    "ترومبون",
    "بوق",
    "سنطور",
    "غيتار باس"
  ],
  "الرياضات": [
    "كرة القدم",
    "كرة السلة",
    "التنس",
    "الملاكمة",
    "المصارعة",
    "السباحة",
    "الجمباز",
    "كرة الطائرة",
    "الكريكيت",
    "الفورمولا 1",
    "رفع الأثقال",
    "المبارزة",
    "الرماية",
    "ركوب الدراجات",
    "الجودو",
    "التايكواندو",
    "كرة اليد",
    "كرة الريشة",
    "البيسبول",
    "الغولف",
    "التزلج",
    "الرجبي",
    "الاسكواش",
    "تنس الطاولة"
  ],
  "شخصيات تاريخية": [
    "صلاح الدين الأيوبي",
    "ابن سينا",
    "الخوارزمي",
    "كليوباترا",
    "الإسكندر الأكبر",
    "نابليون",
    "ليوناردو دا فينشي",
    "أينشتاين",
    "غاليليو",
    "ابن بطوطة",
    "هانيبال",
    "جوليوس قيصر",
    "ماري كوري",
    "نيلسون مانديلا",
    "تشرشل",
    "توت عنخ آمون",
    "أرسطو",
    "أفلاطون",
    "ابن خلدون",
    "عمر الخيام",
    "ماركو بولو",
    "فنسنت فان غوخ",
    "مارتن لوثر كينغ",
    "غاندي"
  ]
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
const COLORS = ["أحمر","أزرق","أخضر","أصفر"];
const UNO_LABELS = {skip:"⛔",reverse:"↻",draw2:"+٢",wild:"🌈",wild4:"+٤"};
const $ = (s,r=document)=>r.querySelector(s);
const esc = s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const rand = n=>Math.floor(Math.random()*n);
const shuffle = a=>{const x=a.slice();for(let i=x.length-1;i>0;i--){const j=rand(i+1);[x[i],x[j]]=[x[j],x[i]]}return x};

let layer=null,state=null,timer=null,localSnakeMoveId="";
function makeSnakeLinks(){
 const used=new Set([1,100]),snakes=[],ladders=[],pick=values=>values[rand(values.length)];
 for(let i=0;i<6;i++){
  const heads=Array.from({length:81},(_,n)=>n+18).filter(n=>!used.has(n));
  const head=pick(heads),tails=Array.from({length:Math.max(0,head-10)},(_,n)=>n+2).filter(n=>n<=head-8&&!used.has(n));
  const tail=pick(tails);used.add(head);used.add(tail);snakes.push({from:head,to:tail});
 }
 for(let i=0;i<6;i++){
  const starts=Array.from({length:87},(_,n)=>n+2).filter(n=>!used.has(n));
  const from=pick(starts),ends=Array.from({length:99-from},(_,n)=>n+from+8).filter(n=>n<=99&&!used.has(n));
  const to=pick(ends);used.add(from);used.add(to);ladders.push({from,to});
 }
 return {snakes,ladders};
}
function snakeBoardOrder(){
 const out=[];for(let row=9;row>=0;row--){const line=Array.from({length:10},(_,i)=>row*10+i+1);if(row%2===1)line.reverse();out.push(...line)}return out;
}
function buildUnoDeck(){
 const deck=[];
 for(const c of COLORS){
  deck.push({c,v:"0",kind:"number"});
  for(let n=1;n<=9;n++)for(let copy=0;copy<2;copy++)deck.push({c,v:String(n),kind:"number"});
  for(const v of ["skip","reverse","draw2"])for(let copy=0;copy<2;copy++)deck.push({c,v,kind:"action"});
 }
 for(let i=0;i<4;i++)deck.push({c:"wild",v:"wild",kind:"wild"},{c:"wild",v:"wild4",kind:"wild"});
 return shuffle(deck);
}
function drawUnoCards(s,player,count){
 if(s.stock.length<count&&s.discard.length>1){const top=s.discard.pop();s.stock=shuffle(s.discard);s.discard=[top]}
 let drawn=0;for(let i=0;i<count&&s.stock.length;i++){s.hands[player].push(s.stock.pop());drawn++}return drawn;
}
function dealPracticeUno(s,deck=buildUnoDeck()){
 const cards=deck.slice();
 s.hands=[cards.splice(0,7),cards.splice(0,7)];
 const topIndex=cards.findIndex(card=>card.v!=="wild4");
 if(topIndex<0)throw new Error("UNO needs a non-Wild-Draw-Four opening card.");
 const top=cards.splice(topIndex,1)[0];
 s.discard=[top];s.stock=cards;s.drawn=[false,false];s.direction=1;
 s.activeColor=top.c==="wild"?null:top.c;s.unoPending=null;s.wildIndex=null;
 s.wild4Pending=null;s.roundEndPending=null;s.unoMatchScores=s.unoMatchScores||[0,0];
 s.unoRound=s.unoRound||1;s.matchWinner=null;s.startWildPending=top.v==="wild";
 s.turn=0;
 if(top.v==="reverse"){s.direction=-1;s.turn=1}
 else if(top.v==="skip")s.turn=1;
 else if(top.v==="draw2"){drawUnoCards(s,1,2);s.turn=1}
 s.last=top.v==="wild"?"كرت البداية حر؛ اختار اللون حتى تبدأ الجولة.":
   top.v==="draw2"?"كرت البداية +٢؛ أوراس سحب كرتين ويبدأ اللعب.":
   top.v==="skip"?"كرت البداية تخطي؛ أوراس يبدأ دوره بعد التخطي.":
   top.v==="reverse"?"كرت البداية عكس؛ انعكس الاتجاه ويبدأ أوراس.":
   "استلمت ٧ كروت. طابق اللون أو الرقم أو الرمز، ولا تنسَ نداء UNO. المباراة إلى ٥٠٠ نقطة.";
 return s;
}
function botCallsUno(s){
 const chance=[0.62,0.82,0.94,0.985][difficultyRank(s)];
 return Math.random()<chance;
}
function unoPlayable(card,activeColor,top){return !!card&&(card.c==="wild"||card.c===activeColor||card.v===top?.v)}

function unoCardPoints(card){
 if(card&&/^\d+$/.test(String(card.v)))return Number(card.v);
 if(card&&["skip","reverse","draw2"].includes(card.v))return 20;
 if(card&&["wild","wild4"].includes(card.v))return 50;
 return 0;
}
function settlePracticeUnoRound(s,winner){
 if(!Array.isArray(s.unoMatchScores))s.unoMatchScores=[0,0];
 const loser=1-winner,award=(s.hands[loser]||[]).reduce((sum,card)=>sum+unoCardPoints(card),0);
 s.unoMatchScores[winner]+=award;s.unoRoundPoints=award;s.unoRoundWinner=winner;
 s.unoRound=s.unoRound||1;s.round=s.unoRound;s.wild4Pending=null;s.roundEndPending=null;s.unoPending=null;
 if(s.unoMatchScores[winner]>=500){s.matchWinner=winner;return finish(s,winner,(winner===0?"فزت بمباراة UNO! ":"أوراس فاز بمباراة UNO! ")+"وصل إلى ٥٠٠ نقطة. نقاط الجولة "+award+"؛ المجموع "+s.unoMatchScores[winner]+".");}
 s.matchWinner=null;
 return finish(s,winner,(winner===0?"فزت بالجولة! ":"أوراس فاز بالجولة. ")+"أُضيفت "+award+" نقطة من كروت الخصم. نتيجة المباراة: إنت "+s.unoMatchScores[0]+" • أوراس "+s.unoMatchScores[1]+" من ٥٠٠. ابدأ الجولة التالية للمتابعة.");
}
function resolvePracticeWild4(s,action,actor){
 const pending=s.wild4Pending;
 if(!pending||pending.target!==actor){s.last="ماكو اعتراض +٤ موجّه إلك حالياً.";return s}
 if(s.unoPending===pending.offender){drawUnoCards(s,pending.offender,2);s.unoPending=null;}
 const direction=s.direction||1,other=(actor+direction+2)%2;
 let next=other,message="";
 if(action==="acceptWild4"){drawUnoCards(s,actor,4);message="قبلت +٤ وسحبت أربع كروت.";}
 else if(pending.illegal){drawUnoCards(s,pending.offender,4);next=actor;s.roundEndPending=null;message="اعتراضك صحيح؛ اللاعب لعب +٤ بصورة مخالفة وسحب أربع كروت.";}
 else{drawUnoCards(s,actor,6);message="الاعتراض غير صحيح؛ سحبت ست كروت.";}
 s.wild4Pending=null;s.drawn[actor]=false;s.turn=next;
 if(s.roundEndPending!==null&&s.roundEndPending!==undefined&&!(action==="challengeWild4"&&pending.illegal)){
  const winner=s.roundEndPending;return settlePracticeUnoRound(s,winner);
 }
 s.last=message+(s.unoPending===null?"":"");return s;
}

function playPracticeUno(s,player,index,color){
 const hand=s.hands[player],top=s.discard[s.discard.length-1],active=s.activeColor||top?.c,card=hand[index];
 if(s.wild4Pending){s.last="احسم اعتراض +٤ أو اقبلها قبل لعب أي كرت.";return s}
 if(!card){s.last="الكرت المختار غير موجود.";return s}
 if(s.drawn[player]&&index!==hand.length-1){s.last="بعد السحب تگدر تلعب الكرت الجديد فقط.";return s}
 let chosen=card.c,illegalWild4=false;
 if(card.c==="wild"){
  if(!COLORS.includes(color)){s.wildIndex=index;s.last="اختار اللون الجديد للكرت الحر.";return s}
  if(card.v==="wild4")illegalWild4=hand.some((x,i)=>i!==index&&x.c===active);
  chosen=color;
 }else if(card.c!==active&&card.v!==top?.v){s.last="اختار كرتاً يطابق اللون أو الرقم أو الرمز.";return s}
 hand.splice(index,1);s.discard.push({...card,c:chosen});s.activeColor=chosen;s.drawn[player]=false;s.wildIndex=null;
 const empty=hand.length===0,oneLeft=hand.length===1;
 s.unoPending=oneLeft?(player===0?0:(botCallsUno(s)?null:1)):null;
 const direction=s.direction||1;let next=(player+direction+2)%2;
 if(card.v==="reverse"){s.direction=-direction;next=player}
 else if(card.v==="skip"){next=player}
 else if(card.v==="draw2"){drawUnoCards(s,(player+direction+2)%2,2);next=player}
 s.turn=next;
 s.last=(player===0?"لعبت ":"أوراس لعب ")+(card.c==="wild"?(card.v==="wild4"?"كرت +٤":"كرت حر"):(card.c+" "+(UNO_LABELS[card.v]||card.v)))+" واختار اللون "+chosen+".";
 if(oneLeft&&player===1)s.last+=s.unoPending===1?" أوراس نسى نداء UNO؛ تگدر تصيده قبل ما تبدأ دورك.":" أوراس نادى UNO تلقائياً.";
 if(card.v==="wild4"){
  s.wild4Pending={offender:player,target:next,illegal:illegalWild4,activeColor:active};
  if(empty)s.roundEndPending=player;
  s.last+=illegalWild4?" تگدر تعترض لأن عنده كرت من اللون السابق.":" اللاعب التالي يگدر يقبل +٤ أو يعترض عليها.";
  return s;
 }
 if(empty)return settlePracticeUnoRound(s,player);
 return s;
}
function prepareLocalSnakeMove(s,actor,dice){
 const from=s.positions[actor],landing=from+dice>100?from:from+dice;
 let final=landing,kind="normal";
 const ladder=s.ladders.find(x=>x.from===landing),snake=s.snakes.find(x=>x.from===landing);
 if(ladder){final=ladder.to;kind="ladder"}else if(snake){final=snake.to;kind="snake"}
 const steps=Math.max(0,landing-from);
 s.dice=dice;s.pendingMove={id:String(Date.now())+"-"+Math.random().toString(36).slice(2),actor,dice,from,landing,final,kind,startedAt:Date.now(),animationMs:1100+steps*230+(kind==="normal"?0:850)};
 s.last=(actor===0?"رميت":"أوراس رمى")+" النرد وظهر "+dice+".";return s;
}
function localSnakeCenter(board,n){
 const cell=board.querySelector('[data-cell="'+n+'"]');if(!cell)return null;
 const br=board.getBoundingClientRect(),r=cell.getBoundingClientRect();return{x:r.left-br.left+r.width/2,y:r.top-br.top+r.height/2};
}
function localSnakeWait(t){return new Promise(resolve=>{const d=Math.max(0,t-Date.now());if(d)window.setTimeout(resolve,d);else resolve()})}
function localSnakeSegment(board,token,from,to,startAt,duration){
 return new Promise(resolve=>{
  const a=localSnakeCenter(board,from),b=localSnakeCenter(board,to);if(!a||!b){resolve();return}
  const frame=()=>{const p=Math.max(0,Math.min(1,(Date.now()-startAt)/Math.max(1,duration))),e=p*p*(3-2*p);token.style.left=(a.x+(b.x-a.x)*e)+"px";token.style.top=(a.y+(b.y-a.y)*e)+"px";if(p<1)requestAnimationFrame(frame);else resolve()};
  requestAnimationFrame(frame);
 });
}
async function animateLocalSnakeMove(move){
 if(!move||move.id===localSnakeMoveId)return;
 const board=document.querySelector(".gai-snakes-board");if(!board)return;
 localSnakeMoveId=move.id;const started=Number(move.startedAt)||Date.now(),dice=document.querySelector("#gaiSnakeDice"),faces=["","⚀","⚁","⚂","⚃","⚄","⚅"];
 if(dice){const remain=Math.max(0,started+1100-Date.now());if(remain){dice.classList.add("rolling");dice.textContent=faces[1+rand(6)];const spin=window.setInterval(()=>dice.textContent=faces[1+rand(6)],90);window.setTimeout(()=>{clearInterval(spin);dice.textContent=faces[move.dice];dice.classList.remove("rolling")},remain)}else dice.textContent=faces[move.dice]}
 const token=document.createElement("span");token.className="snake-moving-token";token.textContent=move.actor===0?"إ":"أ";board.append(token);
 const staticToken=board.querySelector('[data-player-token="'+move.actor+'"]');if(staticToken)staticToken.style.visibility="hidden";
 const start=localSnakeCenter(board,move.from);if(start){token.style.left=start.x+"px";token.style.top=start.y+"px"}
 await localSnakeWait(started+1100);const steps=[];if(move.landing>move.from)for(let n=move.from+1;n<=move.landing;n++)steps.push(n);
 for(let i=0;i<steps.length;i++)await localSnakeSegment(board,token,i===0?move.from:steps[i-1],steps[i],started+1100+i*230,230);
 if(move.final!==move.landing)await localSnakeSegment(board,token,move.landing,move.final,started+1100+steps.length*230,850);
 await localSnakeWait(started+move.animationMs);completeLocalSnakeMove(move);
}
function completeLocalSnakeMove(move){
 if(!state||state.pendingMove?.id!==move.id)return;
 state.positions[move.actor]=move.final;state.pendingMove=null;
 if(move.final===100){finish(state,move.actor,move.actor===0?"وصلت للمربع ١٠٠ وفزت!":"أوراس وصل للمربع ١٠٠ وفاز.");render();return}
 state.turn=move.actor===0?1:0;render();if(move.actor===0)scheduleBotTurn(650);
}
function scheduleBotTurn(delay=700){
 clearTimeout(timer);
 timer=window.setTimeout(()=>{
  if(!state||state.status!=="playing"||state.turn!==1)return;
  botTurn(state);render();
  if(state.game==="snakes"&&state.pendingMove)animateLocalSnakeMove(state.pendingMove);
  else if(state.game==="colors"&&state.turn===1&&state.status==="playing")scheduleBotTurn(850);
 },delay);
}
function practiceUnoCard(card,index,disabled=false){
 const ci=COLORS.indexOf(card.c),wild=card.c==="wild"||card.kind==="wild",label=UNO_LABELS[card.v]||card.v;
 return '<button type="button" class="uno-card '+(wild?"uno-wild":"uno-color-"+Math.max(0,ci))+'" data-act="play" data-index="'+index+'" '+(disabled?"disabled":"")+'><span class="uno-card-corner">'+(wild?"✦":esc(card.c))+'</span><strong>'+esc(label)+'</strong><small>'+(wild?"WILD":esc(card.c))+'</small></button>';
}


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
 else if(game==="snakes"){s.positions=[0,0];s.dice=null;const links=makeSnakeLinks();s.snakes=links.snakes;s.ladders=links.ladders;s.pendingMove=null;s.last="ابدأ برمية النرد. بكل جولة تتغير مواقع ستة ثعابين وستة سلالم."}
 else if(game==="tavla"){
   s.tavla=window.SuwadTavlaRules.createInitialState();s.turn=s.tavla.turn;s.selectedFrom=null;
   s.last="رمية الافتتاح: إنت "+s.tavla.openingRolls[0]+" وأوراس "+s.tavla.openingRolls[1]+". "+(s.turn===0?"إنت تبدأ.":"أوراس يبدأ.")+" استخدم كل أرقام النرد بحركات قانونية.";
 }
 else if(game==="colors"){
   s.unoMatchScores=[0,0];s.unoRound=1;dealPracticeUno(s);
 }
 else if(game==="quiz"){s.deck=shuffle(QUESTIONS);s.question=s.deck.pop();s.answers=[null,null];s.last=s.question.q}
 else if(game==="wheel"){s.spins=[];s.last="الدولاب لعبة حظ؛ الصعوبة لا تغيّر احتمالات النتيجة."}
 else throw new Error("محرك اللعبة غير معروف: "+game);
 return s;
}
function finish(s,winner,message){s.status="finished";s.winner=winner;s.last=message|| (winner===0?"فزت على أوراس!":"أوراس فاز هالمرة.");return s}
function difficultyRank(s){return ({easy:0,medium:1,hard:2,expert:3})[s.difficulty]??1}
function answerWhoQuestion(s,question){
 if(!s||s.game!=="who"||s.status!=="playing")return{answer:"ما عندي معلومة موثوقة عن هالسؤال؛ جرّب صياغة ثانية.",known:false};
 const q=String(question||"").trim().slice(0,120);
 if(!q)return{answer:"اكتب سؤالاً أولاً.",known:false};
 if(s.log.length>=s.askLimit)return{answer:"خلصت أسئلة هالمستوى. ثبّت تخمينك أو ابدأ جولة جديدة.",known:false,exhausted:true,remaining:0};
 const result=window.SuwadWhoAI?.answer(s.category,s.secret,q)||{answer:"ما عندي معلومة موثوقة عن هالسؤال؛ جرّب صياغة ثانية.",known:false};
 s.log.push({q,a:result.answer});
 s.last=result.answer+" (باقي "+(s.askLimit-s.log.length)+" أسئلة).";
 return {...result,remaining:Math.max(0,s.askLimit-s.log.length)};
}
function answerCurrentWho(question){
 // Only answer locally while this exact local Who-practice session is visible and active.
 // A hidden/stale session must not hijack the assistant in another Who game surface.
 if(!state||state.game!=="who"||!layer||layer.hidden||state.status!=="playing")return null;
 const result=answerWhoQuestion(state,question);
 render();
 return result;
}
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
     const result=answerWhoQuestion(s,question);
     s.last=result.answer+(result.exhausted?"":" (باقي "+(result.remaining??0)+" أسئلة).");return s;
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
 if(s.game==="snakes"&&action.type==="roll"&&s.turn===0&&!s.pendingMove)return prepareLocalSnakeMove(s,0,1+rand(6));
 if(s.game==="tavla"){
   if(action.type==="selectPoint"&&s.turn===0){const point=Number(action.point),legal=window.SuwadTavlaRules.getLegalMoves(s.tavla,0);if(legal.some(m=>m.from===point)){s.selectedFrom=point;s.last="اختار حركة قانونية من الخيارات الظاهرة.";return s}s.last="ما عندك قطعة قابلة للحركة من هالنقطة.";return s}
   if(action.type==="selectBar"&&s.turn===0){if(s.tavla.bar[0]>0&&window.SuwadTavlaRules.getLegalMoves(s.tavla,0).some(m=>m.from===-1)){s.selectedFrom=-1;s.last="عندك حجر بالبار؛ لازم تدخله أولاً.";return s}s.last="ما عندك حجر قابل للدخول من البار.";return s}
   if(action.type==="roll"&&s.turn===0){const rolled=window.SuwadTavlaRules.rollTurn(s.tavla,0);if(rolled.error){s.last=rolled.error;return s}s.tavla=rolled.state;s.turn=s.tavla.turn;s.selectedFrom=null;s.last="رميت النرد: "+s.tavla.lastRoll.join(" و ")+(s.tavla.lastRoll[0]===s.tavla.lastRoll[1]?" (دبل، أربع حركات).":"");if(s.turn!==0)s.last+=" ماكو حركة قانونية؛ انتقل الدور إلى أوراس.";return s}
   if(action.type==="move"&&s.turn===0){const result=window.SuwadTavlaRules.applyMove(s.tavla,0,{from:Number(action.from),die:Number(action.die)});if(result.error){s.last=result.error;return s}s.tavla=result.state;s.turn=s.tavla.turn;s.selectedFrom=null;if(s.tavla.status==="finished"){const m=s.tavla.winMultiplier||1;return finish(s,0,"فزت بالطاولي! أخرجت أحجارك الـ١٥. نتيجة الفوز: "+(m===3?"باك گامون ×٣":m===2?"گامون ×٢":"فوز عادي ×١")+".")}s.last=result.move.hit?"ضربت حجر الخصم ورجع للبار.":result.move.bearOff?"أخرجت حجراً من اللوحة.":"حركة قانونية؛ المتبقي من النرد: "+(s.tavla.dice.join(" و ")||"انتهى دورك")+".";return s}
 }
 if(s.game==="colors"){
   if(action.type==="chooseStartColor"&&s.startWildPending&&COLORS.includes(action.color)){s.activeColor=action.color;s.startWildPending=false;s.last="اختير لون البداية: "+action.color+".";return s}
   if(action.type==="callUno"&&s.unoPending===0){s.unoPending=null;s.last="ناديت UNO بوقته!";return s}
   if(action.type==="catchUno"&&s.unoPending===1){drawUnoCards(s,1,2);s.unoPending=null;s.last="صيدت أوراس قبل ما يبدأ دورك؛ يسحب كرتين.";return s}
   if(action.type==="challengeWild4")return resolvePracticeWild4(s,"challengeWild4",s.turn);
   if(action.type==="acceptWild4")return resolvePracticeWild4(s,"acceptWild4",s.turn);
   if(s.wild4Pending){s.last="احسم اعتراض +٤ أو اقبلها قبل أي حركة ثانية.";return s}
   if(action.type==="play"&&s.turn===0){if(s.unoPending===1)s.unoPending=null;return playPracticeUno(s,0,Number(action.index),action.color)}
   if(action.type==="draw"&&s.turn===0){
     if(s.unoPending===1)s.unoPending=null;
     if(s.drawn[0]){s.last="سحبت كرتاً بالفعل؛ العب الكرت الجديد أو مرّر.";return s}
     if(!drawUnoCards(s,0,1)){s.last="ما بقت كروت للسحب؛ ما تگدر تسحب حالياً.";return s}
     s.drawn[0]=true;s.last="سحبت كرتاً واحداً. تگدر تلعب الكرت الجديد إذا يناسب أو تمرّر.";return s;
   }
   if(action.type==="pass"&&s.turn===0&&s.drawn[0]){
     if(s.unoPending===1)s.unoPending=null;
     s.drawn[0]=false;s.turn=1;s.last="مرّرت الدور بعد السحب.";return s;
   }
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
 if(s.game==="snakes"&&s.turn===1&&!s.pendingMove)return prepareLocalSnakeMove(s,1,1+rand(6));
 if(s.game==="tavla"&&s.turn===1){s.tavla=window.SuwadTavlaRules.playBotTurn(s.tavla,s.difficulty,Math.random);s.turn=s.tavla.turn;s.selectedFrom=null;if(s.tavla.status==="finished"){const m=s.tavla.winMultiplier||1;return finish(s,1,"أوراس فاز بالطاولي وأخرج أحجاره الـ١٥. نتيجة الفوز: "+(m===3?"باك گامون ×٣":m===2?"گامون ×٢":"فوز عادي ×١")+".")}s.last="أوراس أكمل كل حركاته القانونية حسب رمية النرد. دورك هسه.";return s}
 if(s.game==="colors"&&s.turn===1){
   if(s.wild4Pending&&s.wild4Pending.target===1){
     const pending=s.wild4Pending,rank=difficultyRank(s);
     const challenge=pending.illegal?rank===3||Math.random()<[.35,.62,.86,1][rank]:Math.random()<[.02,.05,.1,.18][rank];
     return resolvePracticeWild4(s,challenge?"challengeWild4":"acceptWild4",1);
   }
   const missedUno=s.unoPending===0;
   if(missedUno){drawUnoCards(s,0,2);s.unoPending=null}
   const hand=s.hands[1],top=s.discard[s.discard.length-1],active=s.activeColor||top.c;
   let legal=hand.map((c,i)=>({c,i})).filter(x=>unoPlayable(x.c,active,top)&&!(x.c.v==="wild4"&&hand.some((h,j)=>j!==x.i&&h.c===active)));
   if(!legal.length){
     if(!drawUnoCards(s,1,1)){s.last="أوراس ما عنده كرت قانوني والمخزون خلص؛ مرّر الدور.";s.turn=0;return s}
     const drawn=hand.length-1,card=hand[drawn];
     if(!unoPlayable(card,active,top)||(card.v==="wild4"&&hand.some((h,j)=>j!==drawn&&h.c===active))){s.last="أوراس سحب كرتاً وما يطابق؛ انتهى دوره.";s.turn=0;return s}
     legal=[{c:card,i:drawn}];
   }
   const rank=difficultyRank(s);
   legal.sort((a,b)=>{const score=x=>{const same=hand.filter(c=>c.c===x.c.c).length;return rank===0?rand(4):same*(rank+1)+(x.c.v==="skip"||x.c.v==="reverse"?2:0)+(x.c.v==="draw2"||x.c.v==="wild4"?4:0)};return score(b)-score(a)});
   const picked=legal[0],card=picked.c;let chosen=null;
   if(card.c==="wild"){const counts=COLORS.map(c=>({c,n:hand.filter((h,i)=>i!==picked.i&&h.c===c).length})).sort((a,b)=>b.n-a.n);chosen=counts[0]?.n?counts[0].c:COLORS[rand(COLORS.length)]}
   const result=playPracticeUno(s,1,picked.i,chosen);
   if(missedUno&&result.status==="playing")result.last="أوراس صادك لأنك ما ناديت UNO؛ سحبت كرتين. "+result.last;
   return result;
 }
 return s;
}
function render(){
 if(!layer||!state)return;
 const s=state,rank=difficultyRank(s),done=s.status==="finished";
 const whoGuide=window.SuwadWhoAI?.getQuestionGuide(s.category)||{};
 let body="";
 if(s.game==="who")body='<p>الفئة: '+esc(s.category)+'</p><div class="gai-feed">'+s.log.map(x=>'<article class="gai-exchange"><p class="typing-question">سألت: '+esc(x.q)+'</p><p class="typing-answer">أوراس: '+esc(x.a)+'</p></article>').join("")+'</div><input id="gaiText" maxlength="120" placeholder="'+esc(whoGuide.placeholder||"اكتب سؤالاً يناسب الفئة المختارة")+'">'+(whoGuide.example?'<small class="gai-note">مثال مناسب للفئة: '+esc(whoGuide.example)+'</small>':'<small class="gai-note">ما عندي مثال موثوق جاهز لهذه الفئة؛ اسأل عن معلومة محددة.</small>')+'<button data-act="ask" class="gai-primary">اسأل أوراس</button><select id="gaiWhoGuess"><option value="">اختار تخمينك</option>'+WHO_CATEGORIES[s.category].map(x=>'<option>'+esc(x)+'</option>').join("")+'</select><button data-act="whoGuess">ثبّت تخميني</button>';
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
 if(s.game==="snakes"){
   const snakeMap=new Map(s.snakes.map(x=>[x.from,x.to])),ladderMap=new Map(s.ladders.map(x=>[x.from,x.to]));
   const cells=snakeBoardOrder().map(n=>{
     const tokens=s.positions.map((p,i)=>p===n?'<i class="snake-player-token" data-player-token="'+i+'">'+(i===0?"إ":"أ")+'</i>':"").join("");
     const snakeTo=snakeMap.get(n),ladderTo=ladderMap.get(n);
     return '<div class="snake-cell '+(snakeTo?"snake-cell-mark":ladderTo?"ladder-cell":"")+'" data-cell="'+n+'"><b>'+n+'</b>'+(snakeTo?'<small class="snake-link">🐍 ↓ '+snakeTo+'</small>':ladderTo?'<small class="ladder-link">🪜 ↑ '+ladderTo+'</small>':"")+tokens+'</div>';
   }).join("");
   const face=["","⚀","⚁","⚂","⚃","⚄","⚅"][Number(s.dice)||0]||"🎲";
   body='<p class="gai-note">كل جولة تتوزع ستة ثعابين وستة سلالم بمواقع عشوائية. حركة القطعة تظهر خانة بخانة، ودور أوراس يبدأ بعد اكتمال حركتك.</p><div class="snakes-board gai-snakes-board">'+cells+'</div><div class="snake-control-row"><div class="snake-dice-card"><small>النرد</small><div class="snake-dice" id="gaiSnakeDice">'+face+'</div><b>'+(s.dice?"الرقم "+s.dice:"بانتظار الرمية")+'</b></div><div class="snake-status-card"><small>المواقع</small><strong>أنت: '+s.positions[0]+' • أوراس: '+s.positions[1]+'</strong><span>٦ ثعابين • ٦ سلالم</span></div></div><button data-act="roll" class="gai-primary" '+(s.turn!==0||!!s.pendingMove?'disabled':'')+'>🎲 ارْمِ النرد</button>';
 }
 if(s.game==="tavla"){
   const b=s.tavla,legal=window.SuwadTavlaRules.getLegalMoves(b,0),selected=legal.filter(m=>m.from===s.selectedFrom);
   const pointMarkup=(point,top)=>{const p=b.points[point],owned=p.owner!==null&&p.count>0,checkers=owned?Array.from({length:Math.min(5,p.count)},()=>'<i class="tavla-checker '+(p.owner===0?'is-white':'is-black')+'"></i>').join(""):"";return '<button type="button" class="tavla-point '+(top?'is-top':'is-bottom')+' '+(owned?'has-checkers':'')+' '+(s.selectedFrom===point?'is-selected':'')+' '+(legal.some(m=>m.from===point)?'is-available':'')+'" data-act="selectPoint" data-point="'+point+'" aria-label="النقطة '+(point+1)+'، '+(p.count||0)+' حجر">'+checkers+(p.count>5?'<b class="tavla-stack-count">'+p.count+'</b>':"")+'<small>'+String(point+1).padStart(2,"0")+'</small></button>'};
   const tl=Array.from({length:6},(_,i)=>pointMarkup(12+i,true)).join(""),tr=Array.from({length:6},(_,i)=>pointMarkup(18+i,true)).join(""),bl=Array.from({length:6},(_,i)=>pointMarkup(5-i,false)).join(""),br=Array.from({length:6},(_,i)=>pointMarkup(11-i,false)).join("");
   const bar='<button type="button" class="tavla-bar" data-act="selectBar" '+(b.bar[0]?'':'disabled')+'>البار <b>أنت '+b.bar[0]+' • أوراس '+b.bar[1]+'</b></button>';
   const options=selected.length?'<div class="tavla-move-options"><strong>اختار النقلة القانونية</strong>'+selected.map(m=>'<button type="button" data-act="move" data-from="'+m.from+'" data-die="'+m.die+'">🎲 '+m.die+' : '+(m.from===-1?'من البار':'من '+(m.from+1))+' إلى '+(m.bearOff?'خارج اللوحة':String(m.to+1))+(m.hit?' • ضرب حجر الخصم':'')+'</button>').join("")+'</div>':'<p class="tavla-help">'+(b.dice.length?'اختار نقطة بيها حجر إلك، وبعدها اختار نقلة من الخيارات.':'اضغط «ارمِ النرد» حتى تبدأ حركتك.')+'</p>';
   const dice=b.dice.map(d=>'<span class="tavla-die">'+d+'</span>').join("");
   body='<div class="tavla-score-row"><span>⚪ أحجارك: '+(15-b.off[0])+'/15 • إخراج '+b.off[0]+'</span><span>⚫ أوراس: '+(15-b.off[1])+'/15 • إخراج '+b.off[1]+'</span></div><div class="tavla-dice-row"><strong>النرد المتبقي</strong><div>'+(dice||'<span class="tavla-no-dice">بانتظار الرمية</span>')+'</div></div><div class="tavla-board" role="group" aria-label="لوحة الطاولي الكلاسيكية ذات ٢٤ نقطة"><div class="tavla-board-row"><div class="tavla-board-half">'+tl+'</div><div class="tavla-middle-gap"></div><div class="tavla-board-half">'+tr+'</div></div><div class="tavla-board-center">'+bar+'</div><div class="tavla-board-row"><div class="tavla-board-half">'+bl+'</div><div class="tavla-middle-gap"></div><div class="tavla-board-half">'+br+'</div></div></div>'+options+'<button data-act="roll" class="gai-primary" '+(s.turn!==0||b.dice.length?'disabled':'')+'>🎲 ارْمِ النرد</button><p class="gai-note">قواعد الطاولي: ١٥ حجر لكل لاعب، الدخول من البار أولاً، إغلاق النقاط، ضرب الحجر المفرد، مضاعفات النرد، ثم إخراج الأحجار بعد وصولها كلها إلى البيت.</p>';
 }
 if(s.game==="colors"){
   const top=s.discard[s.discard.length-1],active=s.activeColor||(top?.c==="wild"?"اختيار لون البداية":top?.c)||"—",pending=s.unoPending;
   const call=pending===0?'<button data-act="callUno" class="gai-primary">📣 نادِ UNO</button>':pending===1?'<button data-act="catchUno" class="gai-primary">👀 صيد أوراس (+٢ كرت)</button>':"";
   const wild4=s.wild4Pending,challenge=wild4&&wild4.target===0?'<div class="uno-challenge-panel"><strong>أوراس لعب +٤. اختار قرارك:</strong><button data-act="challengeWild4" class="gai-primary">⚖️ اعترض على +٤</button><button data-act="acceptWild4">اقبل +٤ واسحب ٤ كروت</button></div>':wild4?'<p class="uno-challenge-wait">بانتظار قرار اللاعب المستهدف بخصوص +٤.</p>':"";
   const picker=Number.isInteger(s.wildIndex)?'<div class="uno-wild-picker"><strong>اختار اللون الجديد</strong><div>'+COLORS.map(c=>'<button data-act="chooseColor" data-color="'+c+'">'+c+'</button>').join("")+'</div></div>':"";
   const startPicker=s.startWildPending?'<div class="uno-wild-picker"><strong>كرت البداية حر؛ اختار لون الجولة</strong><div>'+COLORS.map(c=>'<button data-act="chooseStartColor" data-color="'+c+'">'+c+'</button>').join("")+'</div></div>':"";
   const score='<div class="uno-match-score"><span>الجولة '+s.unoRound+'</span><span>إنت '+s.unoMatchScores[0]+' / ٥٠٠</span><span>أوراس '+s.unoMatchScores[1]+' / ٥٠٠</span></div>';
   body=score+'<div class="uno-table-head"><div><small>UNO القياسية · ١٠٨ كروت</small><strong>اللون الحالي: '+esc(active)+'</strong></div><div class="uno-deck-count">🂠 '+s.stock.length+' كرت بالسحب</div></div><div class="uno-discard-area"><div><small>الكرت المفتوح</small>'+practiceUnoCard(top,-1,true)+'</div><div class="uno-current-rules"><strong>اتجاه اللعب: '+(s.direction===-1?"عكس عقارب الساعة":"مع عقارب الساعة")+'</strong><span>تخطي ⛔ • عكس ↻ • +٢ • كرت حر 🌈 • +٤</span></div></div><div class="uno-hand-heading"><strong>كروتك ('+s.hands[0].length+')</strong><span>أوراس: '+s.hands[1].length+' كرت</span></div><div class="uno-hand">'+s.hands[0].map((c,i)=>practiceUnoCard(c,i,s.turn!==0||!!wild4||s.startWildPending||(s.drawn[0]&&i!==s.hands[0].length-1))).join("")+'</div>'+picker+startPicker+call+challenge+'<button data-act="draw" class="gai-primary" '+(s.turn!==0||!!wild4||s.startWildPending||s.drawn[0]||(!s.stock.length&&s.discard.length<=1)?'disabled':'')+'>اسحب كرتاً واحداً</button><button data-act="pass" '+(s.turn!==0||!!wild4||s.startWildPending||!s.drawn[0]?'disabled':'')+'>مرّر الدور بعد السحب</button><p class="gai-note">طابق اللون أو الرقم أو الرمز. التخطي والعكس يخلّيان اللاعب نفسه يلعب مرة ثانية في مواجهة لاعب واحد. +٢ يسحب كرتين ويتخطى الدور. +٤ يتيح للاعب التالي القبول أو الاعتراض؛ إذا كان مخالفاً يسحب صاحبه ٤، وإذا كان قانونياً يسحب المعترض ٦. نداء UNO مطلوب عند بقاء كرت واحد، والتصيّد للاعب التالي فقط. المباراة إلى ٥٠٠ نقطة.</p>';
 }
 if(s.game==="quiz")body='<h3>'+esc(s.question.q)+'</h3><div class="gai-answers">'+s.question.a.map((a,i)=>'<button data-act="answer" data-value="'+i+'">'+esc(a)+'</button>').join("")+'</div><p>نقاطك '+s.scores[0]+' • أوراس '+s.scores[1]+'</p>';
 if(s.game==="wheel")body='<p class="gai-note">الدولاب حظ عادل؛ مستوى الصعوبة لا يغيّر احتمالات الاختيار.</p>'+'<p>عدد اللفات: '+s.spins.length+'</p><div class="gai-wheel">'+s.spins.slice(-4).map(x=>'<div>🎯 '+esc(x.result)+'</div>').join("")+'</div><button data-act="spin" class="gai-primary">لفّ الدولاب</button>';
 const logs=s.feed.slice(-5).map(x=>'<li>'+esc(x)+'</li>').join("");
 layer.innerHTML='<section class="gai-dialog" role="dialog" aria-modal="true"><header><div><small>تدريب محلي مستقل • بلا XP أو إنجازات أو غرف</small><h2>'+GAME_NAMES[s.game]+' ضد أوراس 🤖</h2></div><button data-act="close" class="gai-close" aria-label="إغلاق">×</button></header><div class="gai-meta"><label>الصعوبة <select id="gaiDifficulty">'+DIFFICULTIES.map(d=>'<option value="'+d.id+'" '+(s.difficulty===d.id?"selected":"")+'>'+d.label+'</option>').join("")+'</select></label><span>الجولة '+s.round+'</span></div><div class="gai-status">'+(done?"🏁 انتهت الجولة":s.pendingMove?"🎲 حركة القطعة":s.turn===0?"دورك":"دور أوراس")+'<p>'+esc(s.last)+'</p></div><main>'+body+'</main>'+(logs?'<ol class="gai-feed">'+logs+'</ol>':"")+(done?(s.game==="colors"?(s.matchWinner!=null?'<p class="uno-match-won">🏆 انتهت مباراة UNO ووصل الفائز إلى ٥٠٠ نقطة.</p>':'<button data-act="restart" class="gai-primary">جولة UNO التالية</button>'):'<button data-act="restart" class="gai-primary">جولة جديدة</button>'):"")+'</section>';
 layer.querySelectorAll("[data-act]").forEach(b=>b.addEventListener("click",()=>handle(b.dataset.act,b.dataset)));
 const input=$("#gaiNumber",layer);if(input)input.addEventListener("keydown",e=>{if(e.key==="Enter")handle("guess",{value:input.value})});
 const text=$("#gaiText",layer);if(text&&s.game==="liar")text.addEventListener("keydown",e=>{if(e.key==="Enter")handle("hint",{value:text.value})});
 if(text&&s.game==="who")text.addEventListener("keydown",e=>{if(e.key==="Enter")handle("ask",{value:text.value})});
}
function handle(type,data){
 if(type==="close"){close();return}
 if(type==="restart"){if(state.game==="colors"&&Array.isArray(state.unoMatchScores)&&state.matchWinner==null){const scores=state.unoMatchScores.slice(),round=(state.unoRound||1)+1,difficulty=state.difficulty;state=create("colors",difficulty);state.unoMatchScores=scores;state.unoRound=round;state.round=round;state.last="بدأت جولة UNO رقم "+round+". نقاط المباراة: إنت "+scores[0]+" وأوراس "+scores[1]+".";render();if(state.turn===1)scheduleBotTurn(500);return}start(state.game,state.difficulty);return}
 clearTimeout(timer);
 if(type==="guess")apply(state,{type:"guess",value:data.value||$("#gaiNumber",layer)?.value});
 else if(type==="hint")apply(state,{type:"hint",value:data.value||$("#gaiText",layer)?.value});
 else if(type==="ask")apply(state,{type:"ask",value:data.value||$("#gaiText",layer)?.value});
 else if(type==="whoGuess")apply(state,{type:"guess",value:$("#gaiWhoGuess",layer)?.value});
 else if(type==="answer")apply(state,{type:"answer",value:data.value});
 else if(type==="vote")apply(state,{type:"vote",value:data.value});
 else if(type==="roll")apply(state,{type:"roll"});
 else if(type==="selectPoint")apply(state,{type:"selectPoint",point:data.point});
 else if(type==="selectBar")apply(state,{type:"selectBar"});
 else if(type==="move")apply(state,{type:"move",from:data.from,die:data.die});
 else if(type==="play")apply(state,{type:"play",index:data.index,color:data.color});
 else if(type==="chooseColor")apply(state,{type:"play",index:state.wildIndex,color:data.color});
 else if(type==="chooseStartColor")apply(state,{type:"chooseStartColor",color:data.color});
 else if(type==="callUno")apply(state,{type:"callUno"});
 else if(type==="catchUno")apply(state,{type:"catchUno"});
 else if(type==="challengeWild4")apply(state,{type:"challengeWild4"});
 else if(type==="acceptWild4")apply(state,{type:"acceptWild4"});
 else if(type==="draw")apply(state,{type:"draw"});
 else if(type==="pass")apply(state,{type:"pass"});
 else if(type==="spin")apply(state,{type:"spin"});
 const diff=$("#gaiDifficulty",layer);if(diff&&diff.value!==state.difficulty)state.difficulty=diff.value;
 if(state.game==="snakes"&&state.pendingMove){render();animateLocalSnakeMove(state.pendingMove);return}
 if(state.status==="playing"&&state.turn===1){
  if(state.game==="colors"&&state.unoPending===0)scheduleBotTurn(2500);
  else scheduleBotTurn(650);
 }
 render();
}
function start(game,difficulty){
 clearTimeout(timer);localSnakeMoveId="";state=create(game,difficulty||"medium");
 window.__SUWAD_WHO_ANSWER=game==="who"?answerCurrentWho:null;
 if(!layer){layer=document.createElement("div");layer.className="gai-backdrop";layer.hidden=true;document.body.appendChild(layer)}
 window.setSuwadGameAssistantContext?.(game,"practice");
 layer.hidden=false;document.body.classList.add("gai-open");render();
 if(state.status==="playing"&&state.turn===1)scheduleBotTurn(500);
 if(typeof window.mountSuwadGameAssistant==="function")window.mountSuwadGameAssistant(layer,game,"practice");
}
function close(){clearTimeout(timer);if(layer)layer.hidden=true;window.__SUWAD_WHO_ANSWER=null;document.body.classList.remove("gai-open")}
function mount(){
 const map={number:"number",liar:"liar",yesno:"yesno",most:"most",snakes:"snakes",tavla:"tavla",colors:"colors",quiz:"quiz"};
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
window.SuwadGameAIPractice={start:start,create:create,apply:apply,botTurn:botTurn,answerWhoQuestion:answerWhoQuestion,dealPracticeUno:dealPracticeUno,difficulties:DIFFICULTIES.map(x=>x.id),games:Object.keys(GAME_NAMES)};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount);else mount();
})();