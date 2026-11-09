(() => {
  "use strict";
  const categories = [
    {id:"football-players",name:"مزاد لاعبي كرة القدم",short:"نجوم المستطيل الأخضر",icon:"⚽",kind:"stadium",accent:"stadium",intro:"كوّن تشكيلتك بالمزايدة على النجوم والبطاقات الرياضية.",fields:["النادي","المركز","العمر","التقييم","المهارات","القدم المفضلة","الندرة","الإنجازات"],sample:["مركز اللاعب","التقييم العام","المهارات الخاصة"],media:"بطاقة اللاعب وصورته ولقطات مهاراته",mode:"بطاقات اللاعبين"},
    {id:"wrestlers",name:"مزاد المصارعين",short:"أساطير الحلبة",icon:"🥊",kind:"arena",accent:"arena",intro:"نافس على أساطير الحلبة وشخصيات المصارعة وأحزمتها.",fields:["الاسم","اللقب","الوزن","الطول","أسلوب القتال","الإنجازات","سنوات النشاط","الندرة"],sample:["اللقب الأشهر","أسلوب المصارع","أبرز إنجاز"],media:"ملصق المصارع وصور الحلبة والأحزمة",mode:"بطاقات الحلبة"},
    {id:"rare-animals",name:"مزاد الحيوانات النادرة",short:"عالم الطبيعة",icon:"🦜",kind:"wild",accent:"wild",intro:"اكتشف كائنات نادرة بمعلومات علمية وبيئية. المزاد افتراضي وتثقيفي فقط، وليس لتجارة الحيوانات الحقيقية.",fields:["الاسم العلمي","الموطن","النظام الغذائي","الحجم","العمر التقريبي","حالة الحماية","السلوك","معلومة مميزة"],sample:["الموطن الطبيعي","حالة الحماية","معلومة علمية"],media:"صور توثيقية للكائن وموطنه",mode:"ملفات الحياة البرية"},
    {id:"cars",name:"مزاد السيارات",short:"محركات وتصاميم",icon:"🏎️",kind:"garage",accent:"garage",intro:"افحص المواصفات والحالة والتاريخ قبل ما تدخل بالمزايدة.",fields:["الشركة","الموديل","سنة الصنع","المحرك","القوة","ناقل الحركة","المسافة","الحالة"],sample:["قوة المحرك","سنة الصنع","حالة المركبة"],media:"معرض صور خارجي وداخلي وتفاصيل السيارة",mode:"ملف المركبة"},
    {id:"watches",name:"مزاد الساعات",short:"دقة وفخامة",icon:"⌚",kind:"atelier",accent:"atelier",intro:"تفحّص صناعة الساعة وإصدارها وموادها وحالتها.",fields:["العلامة","الموديل","رقم الإصدار","آلية الحركة","المادة","القطر","العلبة الأصلية","الحالة"],sample:["آلية الحركة","مادة الهيكل","الإصدار"],media:"صور مقرّبة للقرص والهيكل والعلبة",mode:"بطاقة القطعة"},
    {id:"video-games",name:"مزاد ألعاب الفيديو",short:"ألعاب وأجهزة",icon:"🎮",kind:"arcade",accent:"arcade",intro:"زايد على الألعاب والأجهزة والإصدارات والمقتنيات الرقمية الافتراضية.",fields:["اسم اللعبة","المنصة","سنة الإصدار","الناشر","النسخة","المنطقة","التقييم","حالة الغلاف"],sample:["المنصة","نوع الإصدار","التقييم"],media:"غلاف اللعبة وصور الجهاز أو الإصدار",mode:"بطاقة الإصدار"},
    {id:"real-estate",name:"مزاد العقارات",short:"مبانٍ ومساحات",icon:"🏙️",kind:"estate",accent:"estate",intro:"قارن الموقع والمساحة والتصميم والمرافق ضمن عالم افتراضي.",fields:["نوع العقار","المدينة الافتراضية","المساحة","عدد الغرف","الطوابق","سنة البناء","المرافق","الحالة"],sample:["المساحة","عدد الغرف","الموقع الافتراضي"],media:"صور الواجهة والمخطط والجولات البصرية",mode:"ملف العقار"},
    {id:"aircraft-ships",name:"مزاد الطائرات والسفن",short:"أساطيل ومركبات",icon:"🛩️",kind:"fleet",accent:"fleet",intro:"استعرض مركبات جوية وبحرية افتراضية مع مواصفاتها الفنية.",fields:["النوع","الشركة المصنعة","الطراز","سنة الصنع","السعة","المدى","السرعة","الحالة"],sample:["الطراز","السعة","المدى"],media:"صور المركبة ومخططها ومقصورتها",mode:"بطاقة الأسطول"},
    {id:"antiques",name:"مزاد الآثار والتحف",short:"قطع لها حكاية",icon:"🏺",kind:"museum",accent:"museum",intro:"اكتشف التحف والقطع التاريخية مع توثيق المصدر والعمر التقديري.",fields:["اسم القطعة","الفترة التاريخية","المادة","بلد المنشأ","العمر التقديري","الحالة","المصدر","التوثيق"],sample:["الفترة التاريخية","المادة","حالة التوثيق"],media:"صور تفصيلية للقطعة وبطاقة مصدرها",mode:"بطاقة المتحف"},
    {id:"rare-cards",name:"مزاد البطاقات النادرة",short:"إصدارات محدودة",icon:"🃏",kind:"cards",accent:"cards",intro:"وازن بين الندرة والإصدار والحالة قبل رفع عرضك.",fields:["السلسلة","رقم البطاقة","الإصدار","سنة الطباعة","التصنيف","الحالة","التقييم","الندرة"],sample:["رقم الإصدار","التصنيف","درجة الحالة"],media:"عرض أمامي وخلفي وتفاصيل الحواف",mode:"معرض البطاقات"},
    {id:"fictional-gear",name:"مزاد المعدات الخيالية",short:"عتاد من عوالم متخيلة",icon:"🛡️",kind:"fantasy",accent:"fantasy",intro:"معدات وأدوات خيالية داخل اللعبة فقط، بلا أسلحة حقيقية أو تداول واقعي.",fields:["اسم القطعة","العالم الخيالي","الفئة","المستوى","القدرات","المتانة","التأثير","الندرة"],sample:["العالم الخيالي","القدرات","المستوى"],media:"تصميم فني خيالي ودوران ثلاثي الأبعاد عند توفره",mode:"بطاقة العتاد"},
    {id:"mystery-lots",name:"مزاد المفاجآت",short:"كل صندوق وراه قصة",icon:"🎁",kind:"mystery",accent:"mystery",intro:"زايد على طرود افتراضية بمعلومات تلميحية تكشف تدريجياً قبل الحسم.",fields:["نوع الصندوق","عدد المحتويات","مستوى الغموض","التلميحات","القيمة التقديرية","فئة المحتوى","وقت الكشف","الندرة"],sample:["مستوى الغموض","عدد القطع","التلميح الحالي"],media:"صورة الصندوق ثم كشف بصري تدريجي للمحتويات",mode:"صندوق المفاجأة"}
  ];
  const root = document.getElementById("auctionSection");
  let auctionDb=null, auctionUser=null, activeCategory=null, activeRoomId=null, auctionChannel=null, auctionTimer=null, auctionBusy=false, auctionClosePending=false;
  if (!root) return;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const hub = () => {
    root.dataset.view = "hub";
    root.innerHTML = '<div class="auction-heading"><span class="auction-kicker">تجربة مستقلة داخل سَـوَاد وناسة</span><h2>قسم <em>المزادات</em></h2><p>كل مزاد إله عالمه وواجهته ومعلوماته الخاصة. اختار الفئة حتى تدخل تجربتها.</p></div><div class="auction-category-grid">'+categories.map(c=>'<button class="auction-category '+c.accent+'" data-auction-category="'+c.id+'"><span class="auction-category-art">'+c.icon+'</span><span class="auction-category-copy"><b>'+esc(c.name)+'</b><small>'+esc(c.short)+'</small><i>افتح المزاد <span>‹</span></i></span></button>').join("")+'</div><div class="auction-footnote">المزايدات والأرصدة افتراضية بالكامل. صور القطع الفعلية تُضاف بعد اعتماد مصادرها وتراخيص استخدامها.</div>';
  };
  const detail = c => {
    root.dataset.view = c.id;
    const fact = c.fields.map((f,i)=>'<div class="auction-fact"><small>'+esc(f)+'</small><b>'+esc(c.sample[i%c.sample.length])+'</b></div>').join("");
    const media = '<div class="auction-media-panel"><div class="auction-media-symbol">'+c.icon+'</div><span>'+esc(c.media)+'</span><small>معرض الصور واللقطات المتحركة</small></div>';
    const facts = '<div class="auction-facts">'+fact+'</div>';
    const info = '<div class="auction-info-panel"><span class="auction-panel-label">'+esc(c.mode)+'</span><h3>تفاصيل القطعة المعروضة</h3><p>تظهر هنا بيانات كل قطعة بشكل خاص بهذه الفئة، حتى تقدر تقيمها قبل المزايدة.</p>'+facts+'</div>';
    const room = '<div class="auction-room-preview"><div class="auction-room-setup"><span class="auction-panel-label">غرف هذا المزاد</span><h3>ابدأ منافسة مع أصدقائك</h3><p>الغرفة من لاعبين إلى ٨، برصيد افتراضي موحّد لكل لاعب.</p><div class="auction-room-options"><label>عدد اللاعبين <select data-auction-max><option value="2">٢</option><option value="4">٤</option><option value="6">٦</option><option value="8" selected>٨</option></select></label><label>الرصيد الافتراضي <select data-auction-budget><option value="10000">١٠٬٠٠٠</option><option value="50000">٥٠٬٠٠٠</option><option value="100000" selected>١٠٠٬٠٠٠</option><option value="250000">٢٥٠٬٠٠٠</option></select></label><label>نوع المزايدة <select data-auction-mode><option value="open">علنية</option><option value="secret">سرية</option></select></label><label>وقت الجولة <select data-auction-time><option value="30">٣٠ ثانية</option><option value="45" selected>٤٥ ثانية</option><option value="60">دقيقة</option><option value="90">٩٠ ثانية</option><option value="120">دقيقتان</option></select></label><label>عدد القطع <select data-auction-rounds><option value="1">١</option><option value="3">٣</option><option value="5" selected>٥</option><option value="10">١٠</option></select></label></div><button type="button" data-auction-create class="auction-action-primary">إنشاء غرفة مزاد</button><div class="auction-join-row"><input data-auction-code maxlength="6" placeholder="رمز الغرفة ٦ أحرف" aria-label="رمز الغرفة"><button type="button" data-auction-join>انضمام</button></div><small class="auction-engine-note">يحتاج تشغيل محرك المزاد وإضافة قطع موثّقة لهذه الفئة قبل بدء اللعب.</small></div></div>';
    const layouts = {
      stadium: '<div class="auction-layout-stadium"><div class="auction-stadium-poster">'+media+'<div class="auction-poster-caption"><b>ملعب النجوم</b><small>بطاقة رياضية وإحصاءات أداء</small></div></div>'+info+'</div>',
      arena: '<div class="auction-layout-arena"><div class="auction-arena-banner"><span>MAIN EVENT</span>'+media+'<b>ليلة الأبطال</b></div>'+info+'</div>',
      wild: '<div class="auction-layout-wild"><div class="auction-wild-intro">'+media+'<p>بطاقة معرفة بيئية</p></div>'+info+'</div>',
      garage: '<div class="auction-layout-garage"><div class="auction-garage-visual">'+media+'<div class="auction-garage-strip"><span>EXTERIOR</span><span>INTERIOR</span><span>ENGINE</span></div></div>'+info+'</div>',
      atelier: '<div class="auction-layout-atelier"><div class="auction-atelier-frame">'+media+'<span>COLLECTOR EDITION</span></div>'+info+'</div>',
      arcade: '<div class="auction-layout-arcade"><div class="auction-arcade-screen">'+media+'<span>GAME LIBRARY / COLLECTOR ITEM</span></div>'+info+'</div>',
      estate: '<div class="auction-layout-estate"><div class="auction-estate-blueprint">'+media+'<span>مخطط ومساحة العقار</span></div>'+info+'</div>',
      fleet: '<div class="auction-layout-fleet">'+info+'<div class="auction-fleet-media">'+media+'<span>ملف الأسطول الفني</span></div></div>',
      museum: '<div class="auction-layout-museum"><div class="auction-museum-object">'+media+'<span>سجل القطعة ومصدرها</span></div>'+info+'</div>',
      cards: '<div class="auction-layout-cards"><div class="auction-card-display">'+media+'<span>FRONT / BACK / CONDITION</span></div>'+info+'</div>',
      fantasy: '<div class="auction-layout-fantasy"><div class="auction-fantasy-relic">'+media+'<span>RELIC ARCHIVE</span></div>'+info+'</div>',
      mystery: '<div class="auction-layout-mystery"><div class="auction-mystery-box">'+media+'<span>محتويات مخفية حتى لحظة الكشف</span></div>'+info+'</div>'
    };
    root.innerHTML = '<div class="auction-detail '+c.accent+' '+c.kind+'"><button class="auction-back" type="button" data-auction-back>‹ رجوع لكل المزادات</button><header class="auction-detail-head"><span class="auction-detail-icon">'+c.icon+'</span><div><span class="auction-kicker">'+esc(c.short)+'</span><h2>'+esc(c.name)+'</h2><p>'+esc(c.intro)+'</p></div></header><div class="auction-showcase">'+(layouts[c.kind]||('<div>'+media+'</div>'+info))+'</div>'+room+'</div>';
  };
  async function ensureAuctionSession(){
    if(!window.supabase||!window.SUWAD_BACKEND?.url||!window.SUWAD_BACKEND?.anonKey)throw new Error("إعداد الاتصال غير متوفر.");
    if(!auctionDb)auctionDb=window.supabase.createClient(window.SUWAD_BACKEND.url,window.SUWAD_BACKEND.anonKey);
    let s=await auctionDb.auth.getSession();if(s.error)throw s.error;
    auctionUser=s.data.session?.user||null;
    if(!auctionUser){const nickname=(localStorage.getItem("sw_nickname")||"لاعب").trim().slice(0,24)||"لاعب";const uname="auction_"+Array.from(crypto.getRandomValues(new Uint8Array(7)),b=>b.toString(16).padStart(2,"0")).join("");const a=await auctionDb.auth.signInAnonymously({options:{data:{display_name:nickname,username:uname}}});if(a.error)throw a.error;auctionUser=a.data.user||a.data.session?.user;}
    if(!auctionUser)throw new Error("تعذّر تسجيل الدخول للمزاد.");
    return auctionUser;
  }
  async function auctionRequest(action,roomId,payload={}){
    await ensureAuctionSession();
    const {data,error}=await auctionDb.functions.invoke("auction-engine",{body:{action,roomId,payload}});
    if(error)throw new Error(data?.error||error.message||"تعذّر الاتصال بمحرك المزاد.");
    if(data?.error)throw new Error(data.error);
    return data;
  }
  function stopAuctionLive(){
    if(auctionChannel&&auctionDb)auctionDb.removeChannel(auctionChannel).catch(()=>{});
    auctionChannel=null;if(auctionTimer)clearInterval(auctionTimer);auctionTimer=null;auctionClosePending=false;
  }
  function showAuctionError(error){const msg=String(error?.message||error||"حدث خطأ غير متوقع.");const old=root.querySelector(".auction-error");if(old)old.remove();const el=document.createElement("p");el.className="auction-error";el.textContent=msg;root.querySelector(".auction-room-preview")?.prepend(el);}
  function renderAuctionSnapshot(data){
    const room=data.room, players=data.players||[], item=data.item, bids=data.bids||[], me=data.myPlayer;
    activeRoomId=room.id;window.__auctionUpdatedAt=room.updated_at;window.__auctionCurrentItemId=room.current_item_id;const area=root.querySelector(".auction-room-preview");if(!area)return;
    const host=room.host_id===auctionUser?.id, names=new Map(players.map(p=>[p.user_id,p.display_name]));
    const timerText=room.current_ends_at?Math.max(0,Math.ceil((Date.parse(room.current_ends_at)-Date.now())/1000))+" ث": "بانتظار البدء";
    const playerHtml=players.map(p=>'<div class="auction-player"><b>'+esc(p.display_name)+'</b><small>مقعد '+(p.seat+1)+' · '+Number(p.balance).toLocaleString("en-US")+' WCOIN</small></div>').join("");
    const bidHtml=bids.map(b=>'<div class="auction-bid-row"><span>'+esc(names.get(b.bidder_id)||"لاعب")+'</span><b>'+Number(b.amount).toLocaleString("en-US")+' WCOIN</b></div>').join("")||'<small>لا توجد عروض مسجلة بعد.</small>';
    const isSecret=room.bid_mode==="secret";
    const minBid=item?(isSecret?Number(item.opening_price)+Number(item.min_increment):Number(room.current_price??item.opening_price)+Number(room.min_increment??item.min_increment)):0;
    const active=item&&room.status==="active";
    area.innerHTML='<div class="auction-live-head"><div><span class="auction-panel-label">رمز الغرفة</span><b class="auction-room-code">'+esc(room.room_code)+'</b></div><span class="auction-live-status">'+(room.status==="lobby"?"ردهة الانتظار":room.status==="active"?"المزاد جارٍ":room.status==="completed"?"اكتمل المزاد":"أُلغيت الغرفة")+'</span></div><div class="auction-players-grid">'+playerHtml+'</div>'+(room.status==="lobby"?(host?'<button type="button" data-auction-start class="auction-action-primary" '+(players.length<2?"disabled":"")+'>ابدأ المزاد</button>':'<p class="auction-waiting">بانتظار صاحب الغرفة حتى يبدأ المزاد.</p>'):"")+(active?'<div class="auction-current-lot"><div><span class="auction-panel-label">القطعة الحالية · '+esc(String((data.lots||[]).length))+' / '+esc(String(room.settings?.roundsTotal||"—"))+'</span><h3>'+esc(item.title_ar)+'</h3><p>'+esc(item.subtitle_ar||item.description_ar)+'</p><div class="auction-price-line">'+(isSecret?'<span>مزايدة سرية · عروض اللاعبين مخفية</span>':'<span>السعر الحالي: '+Number(room.current_price).toLocaleString("en-US")+' WCOIN</span>')+'<b>ينتهي خلال '+timerText+'</b></div></div><div class="auction-bid-controls"><label>عرضك الافتراضي<input data-auction-amount type="number" min="'+minBid+'" max="'+Number(me?.balance||0)+'" step="1" placeholder="أقل عرض '+minBid+'"></label><button type="button" data-auction-bid class="auction-action-primary">تأكيد المزايدة</button><small>رصيدك: '+Number(me?.balance||0).toLocaleString("en-US")+' WCOIN · أقل عرض: '+minBid.toLocaleString("en-US")+'</small></div></div><div class="auction-bid-history"><b>سجل العروض '+(isSecret?"(عروضك السرية فقط)":"")+'</b>'+bidHtml+'</div><div class="auction-live-actions"><button type="button" data-auction-oras>خلّي أوراس يعلّق</button>'+(host?'<button type="button" data-auction-close>إغلاق القطعة / التالي</button>':'')+'<button type="button" data-auction-refresh>تحديث الحالة</button></div>':'')+(room.status==="completed"?'<div class="auction-finished"><b>انتهى المزاد!</b><p>تقدرون تراجعون أرصدة اللاعبين وسجل القطع.</p>'+playerHtml+'</div>':'')+'<div class="auction-live-note">'+(isSecret?"المزايدة السرية: لا تظهر عروض المنافسين أو صاحب أعلى عرض قبل إغلاق القطعة.":"المزايدة العلنية: تظهر العروض والسعر الحالي لجميع أعضاء الغرفة.")+'</div>';
    if(item){
      const info=root.querySelector(".auction-info-panel");
      if(info){info.querySelector("h3").textContent=item.title_ar;info.querySelector("p").textContent=item.description_ar||"";const facts=info.querySelector(".auction-facts");if(facts){const entries=Object.entries(item.facts||{});facts.innerHTML=entries.length?entries.map(([k,v])=>'<div class="auction-fact"><small>'+esc(k)+'</small><b>'+esc(typeof v==="string"?v:JSON.stringify(v))+'</b></div>').join(""):'<div class="auction-fact"><small>التقييم التقديري</small><b>'+Number(item.estimated_value).toLocaleString("en-US")+' WCOIN</b></div>';}}
      const mediaBox=root.querySelector(".auction-media-panel");
      if(mediaBox&&item.media?.length){const m=item.media.find(x=>x.is_primary)||item.media[0];let src=m.external_url;if(!src&&m.storage_path){const publicUrl=auctionDb.storage.from("auction-assets").getPublicUrl(m.storage_path);src=publicUrl.data?.publicUrl;}if(src&&/^https:\/\//i.test(src)){mediaBox.innerHTML='<img src="'+esc(src)+'" alt="'+esc(m.alt_ar)+'" loading="lazy"><span>'+esc(m.alt_ar)+'</span><small>'+esc(m.attribution||"")+'</small>';}}
    }
    stopAuctionLive();
    if(room.status==="active"||room.status==="lobby"){
      auctionChannel=auctionDb.channel("auction-"+room.id).on("postgres_changes",{event:"*",schema:"public",table:"auction_rooms",filter:"id=eq."+room.id},()=>refreshAuctionRoom()).on("postgres_changes",{event:"*",schema:"public",table:"auction_room_players",filter:"room_id=eq."+room.id},()=>refreshAuctionRoom()).subscribe();
      auctionTimer=setInterval(()=>{const timeEl=root.querySelector(".auction-price-line b");if(!timeEl||!room.current_ends_at)return;const left=Math.max(0,Math.ceil((Date.parse(room.current_ends_at)-Date.now())/1000));timeEl.textContent="ينتهي خلال "+left+" ث";if(left===0&&!auctionClosePending){auctionClosePending=true;auctionRequest("close",room.id,{expectedItemId:room.current_item_id}).then(renderAuctionSnapshot).catch(showAuctionError);}},1000);
    }
  }
  async function refreshAuctionRoom(){if(!activeRoomId)return;try{renderAuctionSnapshot(await auctionRequest("snapshot",activeRoomId));}catch(error){showAuctionError(error);}}
  async function createAuctionRoom(){
    if(auctionBusy)return;auctionBusy=true;
    try{const p={categoryId:activeCategory.id,displayName:(localStorage.getItem("sw_nickname")||"لاعب").trim().slice(0,24)||"لاعب",maxPlayers:Number(root.querySelector("[data-auction-max]").value),budget:Number(root.querySelector("[data-auction-budget]").value),bidMode:root.querySelector("[data-auction-mode]").value,roundTimeSeconds:Number(root.querySelector("[data-auction-time]").value),roundsTotal:Number(root.querySelector("[data-auction-rounds]").value)};const data=await auctionRequest("create",null,p);renderAuctionSnapshot(data);}catch(error){showAuctionError(error);}finally{auctionBusy=false;}
  }
  async function joinAuctionRoom(){
    if(auctionBusy)return;auctionBusy=true;
    try{const p={roomCode:root.querySelector("[data-auction-code]").value,displayName:(localStorage.getItem("sw_nickname")||"لاعب").trim().slice(0,24)||"لاعب"};const data=await auctionRequest("join",null,p);renderAuctionSnapshot(data);}catch(error){showAuctionError(error);}finally{auctionBusy=false;}
  }
  async function auctionOras(){
    try{await ensureAuctionSession();const {data,error}=await auctionDb.functions.invoke("wanasa-ai",{body:{mode:"auction_commentator",roomId:activeRoomId}});if(error||data?.error)throw new Error(data?.error||error.message);const line=data?.answer||"أوراس ساكت هالمرة.";const old=root.querySelector(".auction-oras-line");if(old)old.remove();const el=document.createElement("p");el.className="auction-oras-line";el.textContent="أوراس: "+line;root.querySelector(".auction-room-preview")?.append(el);}catch(error){showAuctionError(error);}
  }
  root.addEventListener("click", e => {
    const btn=e.target.closest("[data-auction-category],[data-auction-back]");
    if(!btn)return;
    if(btn.hasAttribute("data-auction-back")) {stopAuctionLive();activeRoomId=null;hub();}
    else if(btn.hasAttribute("data-auction-category")) {stopAuctionLive();activeRoomId=null;const c=categories.find(x=>x.id===btn.dataset.auctionCategory);if(c){activeCategory=c;detail(c);}}
    else if(btn.hasAttribute("data-auction-create")) createAuctionRoom();
    else if(btn.hasAttribute("data-auction-join")) joinAuctionRoom();
    else if(btn.hasAttribute("data-auction-start")) auctionRequest("start",activeRoomId).then(renderAuctionSnapshot).catch(showAuctionError);
    else if(btn.hasAttribute("data-auction-close")) auctionRequest("close",activeRoomId,{expectedItemId:window.__auctionCurrentItemId}).then(renderAuctionSnapshot).catch(showAuctionError);
    else if(btn.hasAttribute("data-auction-refresh")) refreshAuctionRoom();
    else if(btn.hasAttribute("data-auction-oras")) auctionOras();
    else if(btn.hasAttribute("data-auction-bid")) {const amount=Number(root.querySelector("[data-auction-amount]")?.value);const expected=root.querySelector(".auction-live-head")?.dataset.updatedAt;if(!Number.isSafeInteger(amount)||amount<1){showAuctionError(new Error("أدخل مبلغاً صحيحاً."));return;}auctionRequest("bid",activeRoomId,{amount,expectedUpdatedAt:window.__auctionUpdatedAt||expected||""}).then(renderAuctionSnapshot).catch(showAuctionError);}
    root.scrollIntoView({behavior:"smooth",block:"start"});
  });
  hub();
})();