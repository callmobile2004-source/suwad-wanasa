(() => {
"use strict";
if (window.SuwadQuizHub) return;

const STORAGE_KEY = "sw_quiz_wheels_v1";
const categories = [
 {id:"general",name:"الثقافة العامة",icon:"🧠",ready:true,sourceLabel:"بنك الثقافة العامة الحالي"},
 {id:"wrestlers",name:"المصارعين",icon:"🤼",ready:false,sources:[{label:"WWE – ملفات المصارعين وتاريخ الألقاب",url:"https://www.wwe.com/superstars"},{label:"WWE – تاريخ البطولات",url:"https://www.wwe.com/titlehistory"}]},
 {id:"aqeeda-imami",name:"العقيدة – الإمامية",icon:"🕌",ready:false,sources:[{label:"القرآن الكريم",url:"https://quran.com/"},{label:"العقيدة الإمامية – باب الإمامة",url:"https://al-islam.org/our-belief-naser-makarem-shirazi/chapter-5-imamate"},{label:"عقيدة الإمامية – كتاب عقائد الإمامية",url:"https://al-islam.org/it/faith-imamiyyah-shiah-muhammad-ridha-al-muzaffar/part-3-imamate"},{label:"مدخل إلى كتاب الإرشاد – الإمامة",url:"https://al-islam.org/introduction-kitab-al-irshad-muhammad-rida-jafari/imamate"}]},
 {id:"aqeeda-sunni",name:"العقيدة – السُنية",icon:"☪️",ready:false,sources:[{label:"القرآن الكريم",url:"https://quran.com/"},{label:"صحيح البخاري",url:"https://sunnah.com/bukhari"},{label:"صحيح مسلم",url:"https://sunnah.com/muslim"}]},
 {id:"anime",name:"الأنمي",icon:"🌸",ready:false,sources:[{label:"NARUTO – الموقع الرسمي للأنمي",url:"https://naruto-official.com/en/anime"},{label:"VIZ – صفحة Naruto الرسمية للناشر",url:"https://www.viz.com/naruto"}]},
 {id:"cars",name:"السيارات",icon:"🚗",ready:false,sources:[{label:"مواقع الشركات المصنّعة الرسمية",url:"https://global.toyota/en/"},{label:"Mercedes-Benz – الموقع الرسمي",url:"https://group.mercedes-benz.com/"}]},
 {id:"brands",name:"البراندات",icon:"🏷️",ready:false,sources:[{label:"المواقع الرسمية للشركات والعلامات",url:"https://www.interbrand.com/"}]},
 {id:"gaming",name:"الألعاب والگيمنك",icon:"🎮",ready:false,sources:[{label:"Nintendo – الموقع الرسمي",url:"https://www.nintendo.com/"},{label:"PlayStation – الموقع الرسمي",url:"https://www.playstation.com/"}]},
 {id:"math",name:"الرياضيات",icon:"📐",ready:false,sources:[{label:"OpenStax – كتب الرياضيات المفتوحة",url:"https://openstax.org/subjects/math"},{label:"NIST – المراجع الرياضية",url:"https://www.nist.gov/"}]},
 {id:"medicine",name:"الطب",icon:"🩺",ready:false,sources:[{label:"MedlinePlus – المكتبة الطبية الوطنية",url:"https://medlineplus.gov/"},{label:"منظمة الصحة العالمية",url:"https://www.who.int/"}]},
 {id:"football",name:"كرة القدم",icon:"⚽",ready:false,sources:[{label:"FIFA – الموقع الرسمي",url:"https://www.fifa.com/"},{label:"الاتحادات والفرق الرسمية",url:"https://www.the-afc.com/"}]},
 {id:"geography",name:"الجغرافيا والدول",icon:"🌍",ready:false,sources:[{label:"الأمم المتحدة – الدول الأعضاء",url:"https://www.un.org/en/about-us/member-states"},{label:"CIA World Factbook",url:"https://www.cia.gov/the-world-factbook/"}]},
 {id:"history",name:"التاريخ والحضارات",icon:"🏛️",ready:false,sources:[{label:"الموسوعة البريطانية",url:"https://www.britannica.com/"},{label:"UNESCO – التراث العالمي",url:"https://whc.unesco.org/"}]},
 {id:"science",name:"العلوم والطبيعة",icon:"🔬",ready:false,sources:[{label:"NASA Science",url:"https://science.nasa.gov/"},{label:"National Geographic Education",url:"https://education.nationalgeographic.org/"}]},
 {id:"space",name:"الفضاء والفلك",icon:"🪐",ready:false,sources:[{label:"NASA – النظام الشمسي",url:"https://science.nasa.gov/solar-system/"},{label:"الاتحاد الفلكي الدولي",url:"https://www.iau.org/"}]},
 {id:"animals",name:"الحيوانات والكائنات",icon:"🐾",ready:false,sources:[{label:"Smithsonian National Zoo",url:"https://nationalzoo.si.edu/"},{label:"IUCN Red List",url:"https://www.iucnredlist.org/"}]},
 {id:"cinema",name:"الأفلام والمسلسلات",icon:"🎬",ready:false,sources:[{label:"المواقع الرسمية للأعمال والاستوديوهات",url:"https://www.oscars.org/"}]},
 {id:"food",name:"الأكلات والمطبخ",icon:"🍲",ready:false,sources:[{label:"FAO – منظمة الأغذية والزراعة",url:"https://www.fao.org/"},{label:"USDA FoodData Central",url:"https://fdc.nal.usda.gov/"}]},
 {id:"technology",name:"التقنية والإنترنت",icon:"💻",ready:false,sources:[{label:"MDN Web Docs",url:"https://developer.mozilla.org/"},{label:"W3C Standards",url:"https://www.w3.org/"}]},
 {id:"literature",name:"اللغة والأدب",icon:"📚",ready:false,sources:[{label:"مكتبة الكونغرس",url:"https://www.loc.gov/"},{label:"المعجم الوسيط – مجمع اللغة العربية",url:"https://www.arabicacademy.gov.eg/"}]},
 {id:"nature",name:"البيئة والمناخ",icon:"🌱",ready:false,sources:[{label:"برنامج الأمم المتحدة للبيئة",url:"https://www.unep.org/"},{label:"IPCC",url:"https://www.ipcc.ch/"}]}
];
const $ = (sel,root=document) => root.querySelector(sel);
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const category = id => categories.find(item=>item.id===id) || categories[0];
const randomIndex = length => {
 if(length<=1)return 0;
 try{const data=new Uint32Array(1);crypto.getRandomValues(data);return Math.floor((data[0]/4294967296)*length)}catch{return Math.floor(Math.random()*length)}
};
const readStore = () => {
 try { const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed:{} } catch { return {} }
};
const writeStore = store => {
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify(store));return true}catch(error){console.warn("[quiz-wheel] could not save wheel state",error);return false}
};
const wheelState = id => {
 const store=readStore(),value=store[id]&&typeof store[id]==="object"?store[id]:{};
 return {names:Array.isArray(value.names)?value.names.filter(x=>typeof x==="string"&&x.trim()):[],removed:Array.isArray(value.removed)?value.removed.filter(x=>typeof x==="string"&&x.trim()):[],history:Array.isArray(value.history)?value.history.slice(-30):[]};
};
const saveWheelState = (id,mutator) => {
 const store=readStore(),current=wheelState(id);mutator(current);store[id]={names:[...new Set(current.names.map(x=>x.trim()).filter(Boolean))],removed:[...new Set(current.removed.map(x=>x.trim()).filter(Boolean))],history:current.history.slice(-30)};return writeStore(store);
};
let overlay=null,spinFrame=0,audioContext=null,currentSpin=null,categoryPickCallback=null;
const tone = (frequency=920,duration=.025,gain=.075) => {
 try{
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  audioContext=audioContext||new AC();if(audioContext.state==="suspended")audioContext.resume();
  const osc=audioContext.createOscillator(),amp=audioContext.createGain(),now=audioContext.currentTime;
  osc.type="triangle";osc.frequency.setValueAtTime(frequency,now);
  amp.gain.setValueAtTime(gain,now);amp.gain.exponentialRampToValueAtTime(.001,now+duration);
  osc.connect(amp);amp.connect(audioContext.destination);osc.start(now);osc.stop(now+duration);
 }catch{}
};
const winSound = () => [523,659,784,1046].forEach((hz,i)=>setTimeout(()=>tone(hz,.16,.11),i*95));
function render(id="general"){
 const selected=category(id),ready=selected.ready;
 return '<section class="suwad-quiz-hub" aria-label="أقسام تحدّي الأسئلة">'+
  '<div class="suwad-quiz-category-row"><label for="gaiQuizCategory">القسم</label><select id="gaiQuizCategory">'+categories.map(c=>'<option value="'+c.id+'" '+(c.id===selected.id?"selected":"")+'>'+c.icon+' '+escapeHTML(c.name)+'</option>').join("")+'</select></div>'+
  '<div class="suwad-quiz-hub-actions"><button type="button" id="gaiCategoryWheel" class="suwad-wheel-action">🎡 عجلة الأقسام</button><button type="button" id="gaiNamesWheel" class="suwad-wheel-action">🎯 دولاب الأسماء لهذا القسم</button></div>'+
  '<div class="suwad-quiz-bank-status '+(ready?"is-ready":"is-pending")+'"><span>'+(ready?"✓":"◷")+'</span><div><strong>'+(ready?"بنك القسم متاح":"بنك هذا القسم قيد التدقيق")+'</strong><small>'+(ready?"الأسئلة الحالية موزعة على أربعة مستويات.":"لن نفعّل الأسئلة قبل اكتمال 100 سؤال مختلف على الأقل، وتوثيق مصدر كل إجابة.")+'</small></div></div>'+
  '</section>';
}
function ensureOverlay(){
 if(overlay&&overlay.isConnected)return overlay;
 overlay=document.createElement("div");overlay.className="suwad-wheel-backdrop";overlay.hidden=true;overlay.innerHTML='<section class="suwad-wheel-dialog" role="dialog" aria-modal="true" aria-labelledby="suwadWheelTitle"><header><div><small>تحدّي الأسئلة</small><h2 id="suwadWheelTitle">دولاب الاختيار</h2></div><button type="button" class="suwad-wheel-close" aria-label="إغلاق">×</button></header><div class="suwad-wheel-toolbar"><label class="suwad-wheel-section-label">القسم <select id="suwadWheelSection"></select></label><span id="suwadWheelCount"></span></div><div class="suwad-wheel-stage"><span class="suwad-wheel-pointer" aria-hidden="true">▼</span><canvas id="suwadWheelCanvas" width="620" height="620" aria-label="عجلة دوّارة"></canvas></div><div class="suwad-wheel-result" id="suwadWheelResult" hidden aria-live="polite"></div><div class="suwad-wheel-editor"><label for="suwadWheelNamesInput">أضف الأسماء، كل اسم بسطر مستقل</label><textarea id="suwadWheelNamesInput" rows="4" placeholder="اسم ١&#10;اسم ٢&#10;اسم ٣"></textarea><div class="suwad-wheel-editor-actions"><button type="button" id="suwadWheelAdd">إضافة الأسماء</button><button type="button" id="suwadWheelRestore" class="is-secondary">استرجاع المحذوف</button></div><div class="suwad-wheel-list" id="suwadWheelList"></div></div><div class="suwad-wheel-footer"><button type="button" id="suwadWheelSpin" class="suwad-wheel-spin">ابدأ اللفة</button><small>تُحفظ أسماء كل قسم بصورة مستقلة على هذا الجهاز.</small></div></section>';
 document.body.appendChild(overlay);
 overlay.querySelector(".suwad-wheel-close").addEventListener("click",closeOverlay);
 overlay.addEventListener("suwad:category-picked",event=>{const callback=categoryPickCallback;categoryPickCallback=null;callback?.(event.detail.id)});
 overlay.addEventListener("click",event=>{if(event.target===overlay)closeOverlay()});
 overlay.querySelector("#suwadWheelSection").addEventListener("change",event=>{if(currentSpin)return;openWheel(event.target.value,overlay.dataset.mode==="categories"?"categories":"names")});
 overlay.querySelector("#suwadWheelAdd").addEventListener("click",addNames);
 overlay.querySelector("#suwadWheelRestore").addEventListener("click",restoreNames);
 overlay.querySelector("#suwadWheelSpin").addEventListener("click",spinNames);
 overlay.querySelector("#suwadWheelList").addEventListener("click",event=>{
  const button=event.target.closest("[data-remove-name]");if(!button||currentSpin)return;
  const id=overlay.dataset.category||"general",name=button.dataset.removeName;
  saveWheelState(id,s=>{s.names=s.names.filter(x=>x!==name);s.removed.push(name)});
  refreshWheel();
 });
 overlay.querySelector("#suwadWheelResult").addEventListener("click",event=>{
  const button=event.target.closest("[data-result-choice]");if(!button)return;
  const choice=button.dataset.resultChoice,id=overlay.dataset.category||"general",name=overlay.dataset.resultName||"";
  if(choice==="remove")saveWheelState(id,s=>{s.names=s.names.filter(x=>x!==name);s.removed.push(name)});
  overlay.querySelector("#suwadWheelResult").hidden=true;overlay.dataset.resultName="";
  refreshWheel();
 });
 return overlay;
}
function drawWheel(rotation=0){
 if(!overlay)return;
 const canvas=$("#suwadWheelCanvas",overlay),ctx=canvas?.getContext("2d");if(!ctx)return;
 const id=overlay.dataset.category||"general",mode=overlay.dataset.mode||"names";
 const items=mode==="categories"?categories.map(c=>c.name):wheelState(id).names;
 const dpr=Math.min(window.devicePixelRatio||1,2),size=620;
 if(canvas.width!==Math.round(size*dpr)){canvas.width=Math.round(size*dpr);canvas.height=Math.round(size*dpr)}canvas.style.width="min(78vw,430px)";canvas.style.height="min(78vw,430px)";
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,size,size);
 const cx=size/2,cy=size/2,r=296;ctx.save();ctx.translate(cx,cy);ctx.rotate(rotation);
 if(!items.length){ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fillStyle="#202a30";ctx.fill();ctx.fillStyle="#f1dfbc";ctx.font="bold 24px sans-serif";ctx.textAlign="center";ctx.fillText("أضف أسماء حتى تبدأ",0,8);ctx.restore();return}
 const slice=Math.PI*2/items.length;
 items.forEach((item,i)=>{
  const start=-Math.PI/2+i*slice,end=start+slice;
  const hue=(i*137.508+28)%360;
  ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,r,start,end);ctx.closePath();ctx.fillStyle="hsl("+hue+" 52% "+(i%2?31:38)+"%)";ctx.fill();
  ctx.strokeStyle="rgba(255,239,204,.55)";ctx.lineWidth=2;ctx.stroke();
  if(items.length<=80){
   ctx.save();ctx.rotate(start+slice/2);ctx.textAlign="right";ctx.fillStyle="#fff9ed";ctx.font="bold "+Math.max(10,Math.min(17,28-items.length*.15))+"px sans-serif";
   const label=String(item).length>22?String(item).slice(0,21)+"…":String(item);ctx.fillText(label,r-20,6);ctx.restore();
  }
 });
 ctx.beginPath();ctx.arc(0,0,42,0,Math.PI*2);ctx.fillStyle="#e9d4aa";ctx.fill();ctx.strokeStyle="#5b4127";ctx.lineWidth=5;ctx.stroke();ctx.fillStyle="#302315";ctx.font="bold 26px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("س",0,1);
 ctx.restore();
}
function updateCount(){
 if(!overlay)return;const state=wheelState(overlay.dataset.category||"general"),count=$("#suwadWheelCount",overlay);
 if(count)count.textContent=state.names.length+" اسم · "+state.removed.length+" مخفي";
}
function refreshWheel(){
 if(!overlay)return;const state=wheelState(overlay.dataset.category||"general"),list=$("#suwadWheelList",overlay);
 list.innerHTML=state.names.map(name=>'<div><span>'+escapeHTML(name)+'</span><button type="button" data-remove-name="'+escapeHTML(name)+'" aria-label="إخفاء '+escapeHTML(name)+'">×</button></div>').join("")||'<p class="suwad-wheel-empty">ماكو أسماء بهذا الدولاب بعد. أضف الأسماء أعلاه.</p>';
 const restore=$("#suwadWheelRestore",overlay);restore.disabled=!state.removed.length;
 $("#suwadWheelSpin",overlay).disabled=state.names.length<2||!!currentSpin;
 $("#suwadWheelSpin",overlay).textContent=state.names.length<2?"أضف اسمين على الأقل":"ابدأ اللفة";
 updateCount();drawWheel();
}
function openWheel(id="general",mode="names"){
 const root=ensureOverlay();if(currentSpin)return;
 root.dataset.category=id;root.dataset.mode=mode;root.dataset.rotation="0";
 const section=$("#suwadWheelSection",root);
 section.innerHTML=categories.map(c=>'<option value="'+c.id+'" '+(c.id===id?"selected":"")+'>'+c.icon+" "+escapeHTML(c.name)+'</option>').join("");
 root.querySelector("#suwadWheelTitle").textContent=mode==="categories"?"عجلة الأقسام":"دولاب الأسماء";
 root.querySelector(".suwad-wheel-editor").hidden=mode==="categories";
 root.querySelector("#suwadWheelCount").textContent=mode==="categories"?categories.length+" قسماً":"";
 $("#suwadWheelResult",root).hidden=true;
 root.hidden=false;refreshWheel();
 if(mode==="categories"){$("#suwadWheelSpin",root).disabled=false;$("#suwadWheelSpin",root).textContent="اختار قسماً";}
}
function closeOverlay(){
 if(currentSpin)return;
 if(overlay)overlay.hidden=true;
}
function addNames(){
 if(currentSpin||!overlay)return;
 const id=overlay.dataset.category||"general",input=$("#suwadWheelNamesInput",overlay);
 const values=String(input.value||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(!values.length)return;
 const before=wheelState(id).names.length;
 saveWheelState(id,s=>{s.names.push(...values)});
 const after=wheelState(id).names.length;
 input.value="";refreshWheel();
 const result=$("#suwadWheelResult",overlay);result.hidden=false;
 result.className="suwad-wheel-inline-note";result.textContent="تمت إضافة "+(after-before)+" اسم. العدد الحالي: "+after+".";
}
function restoreNames(){
 if(currentSpin||!overlay)return;
 const id=overlay.dataset.category||"general";
 saveWheelState(id,s=>{s.names.push(...s.removed);s.removed=[]});
 refreshWheel();
}
function spinNames(){
 if(!overlay||currentSpin)return;
 const mode=overlay.dataset.mode||"names",id=overlay.dataset.category||"general";
 const items=mode==="categories"?categories.map(c=>c.name):wheelState(id).names;
 if(items.length<(mode==="categories"?2:2))return;
 const index=randomIndex(items.length),slice=Math.PI*2/items.length;
 const current=Number(overlay.dataset.rotation||0),center=-Math.PI/2+(index+.5)*slice;
 const delta=(5+randomIndex(4))*Math.PI*2+(((-Math.PI/2-center-current)%(Math.PI*2)+(Math.PI*2))%(Math.PI*2));
 const start=current,target=current+delta,duration=6500+randomIndex(1200),began=performance.now();
 const button=$("#suwadWheelSpin",overlay);button.disabled=true;button.textContent="تدور...";
 currentSpin={lastTick:-1};
 const pointerIndex=angle=>{const normalized=(((-Math.PI/2-angle)%(Math.PI*2))+(Math.PI*2))%(Math.PI*2);return Math.floor(normalized/slice)%items.length};
 const tick=now=>{
  if(!currentSpin)return;
  const t=Math.min(1,(now-began)/duration);
  const eased=t<.17?0.12*Math.pow(t/.17,2.3):0.12+0.88*(1-Math.pow(1-(t-.17)/.83,4.2));
  const rotation=start+(target-start)*eased;
  overlay.dataset.rotation=String(rotation);drawWheel(rotation);
  const passed=pointerIndex(rotation);
  if(passed!==currentSpin.lastTick){currentSpin.lastTick=passed;tone(780+(passed%5)*75,.022,.065)}
  if(t<1){spinFrame=requestAnimationFrame(tick);return}
  overlay.dataset.rotation=String(target);drawWheel(target);currentSpin=null;
  tone(570,.12,.10);setTimeout(()=>winSound(),100);
  const picked=items[index],result=$("#suwadWheelResult",overlay);
  if(mode==="categories"){
   const chosen=categories.find(c=>c.name===picked)||categories[0];
   result.hidden=false;result.className="suwad-wheel-result is-winner";
   result.innerHTML='<span>✦ تم الاختيار ✦</span><strong>'+chosen.icon+" "+escapeHTML(chosen.name)+'</strong><button type="button" data-result-choice="select-category">فتح هذا القسم</button>';
   result.querySelector("[data-result-choice]").addEventListener("click",()=>{closeOverlay();overlay.dispatchEvent(new CustomEvent("suwad:category-picked",{detail:{id:chosen.id}}))});
   button.disabled=false;button.textContent="لف مرة ثانية";
  }else{
   const state=wheelState(id);state.history.push({name:picked,at:Date.now()});saveWheelState(id,s=>{s.history=state.history});
   overlay.dataset.resultName=picked;result.hidden=false;result.className="suwad-wheel-result is-winner";
   result.innerHTML='<span>✦ الاسم المختار ✦</span><strong>'+escapeHTML(picked)+'</strong><div class="suwad-wheel-result-actions"><button type="button" data-result-choice="keep">خليه بالدولاب</button><button type="button" data-result-choice="remove" class="is-remove">اخفِ الاسم من الدولاب</button></div>';
   button.disabled=false;button.textContent="لف مرة ثانية";
  }
  updateCount();
 };
 spinFrame=requestAnimationFrame(tick);
}
function mount(root,callbacks={}){
 if(!root)return;

 const select=$("#gaiQuizCategory",root);
 if(select&&!select.dataset.hubBound){select.dataset.hubBound="1";select.addEventListener("change",()=>callbacks.onCategoryChange?.(select.value))}
 const catButton=$("#gaiCategoryWheel",root);
 if(catButton&&!catButton.dataset.hubBound){catButton.dataset.hubBound="1";catButton.addEventListener("click",()=>{categoryPickCallback=callbacks.onCategoryChange;openWheel("general","categories")})}
 const namesButton=$("#gaiNamesWheel",root);
 if(namesButton&&!namesButton.dataset.hubBound){namesButton.dataset.hubBound="1";namesButton.addEventListener("click",()=>openWheel(select?.value||"general","names"))}
}
window.SuwadQuizHub={categories,render,mount,openWheel,getCategory:category,wheelState};
})();