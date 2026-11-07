(() => {
  "use strict";

  const knowledge = typeof module !== "undefined" && module.exports
    ? require("./who-ai-knowledge.js")
    : globalThis.SuwadWhoKnowledge;

  const UNKNOWN = "ما عندي معلومة موثوقة عن هالسؤال؛ جرّب صياغة ثانية.";
  const YES = "نعم";
  const NO = "لا";

  function normalize(value) {
    return String(value ?? "")
      .normalize("NFKC")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/[پ]/g, "ب")
      .replace(/[چ]/g, "ج")
      .replace(/[گک]/g, "ك")
      .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
      .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
      .replace(/[؟?!.،,:؛()[\]{}"'`«»“”؛]/g, " ")
      .replace(/[\u066B\u066C]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleLowerCase("ar");
  }

  const profiles = {
    "الحيوانات": { type:"animal", flags:["animal"], aliases:["حيوان","الحيوان"] },
    "الطيور": { type:"bird", flags:["animal","bird"], aliases:["طيور","طير"] },
    "كائنات البحر": { type:"marine", flags:["animal","marine"], aliases:["كائن بحري","حيوان بحري"] },
    "الدول": { type:"country", flags:["country"], aliases:["دولة","بلد"] },
    "المصارعين": { type:"wrestler", flags:["person","realPerson","athlete","wrestler"], aliases:["مصارع","مصارعين"] },
    "لاعبو كرة القدم": { type:"footballer", flags:["person","realPerson","athlete","footballer"], aliases:["لاعب كرة","لاعب كرة قدم"] },
    "شخصيات الألعاب": { type:"gameCharacter", flags:["fictional","character","gameCharacter"], aliases:["شخصية لعبة","شخصيات العاب"] },
    "الأفلام": { type:"filmCharacter", flags:["fictional","character","filmCharacter"], aliases:["افلام","شخصية فيلم","شخصيات افلام"] },
    "الأنمي": { type:"animeCharacter", flags:["fictional","character","animeCharacter"], aliases:["انمي","شخصية انمي"] },
    "السيارات": { type:"car", flags:["vehicle","car"], aliases:["سيارة","سيارات"] },
    "الأكلات": { type:"food", flags:["food"], aliases:["اكل","اكلة","اطعمة"] },
    "الأبطال الخارقون": { type:"superhero", flags:["fictional","character","superhero"], aliases:["ابطال خارقون","بطل خارق"] },
    "المهن": { type:"profession", flags:["profession"], aliases:["مهنة","وظيفة"] },
    "المعالم": { type:"landmark", flags:["landmark","place"], aliases:["معلم","معالم سياحية"] },
    "الفواكه": { type:"fruit", flags:["fruit","plantFood"], aliases:["فاكهة","فواكه"] },
    "الآلات الموسيقية": { type:"instrument", flags:["instrument"], aliases:["الة موسيقية","الات موسيقية"] },
    "الرياضات": { type:"sport", flags:["sport"], aliases:["رياضة","رياضات"] },
    "شخصيات تاريخية": { type:"historicalPerson", flags:["person","realPerson","historicalPerson"], aliases:["شخصية تاريخية","شخصيات تاريخيه"] }
  };

  function resolveCategory(category) {
    const target = normalize(category);
    for (const [name, profile] of Object.entries(profiles)) {
      if (normalize(name) === target || (profile.aliases || []).some(alias => normalize(alias) === target)) return name;
    }
    return String(category ?? "").trim();
  }

  function canonicalItem(category, secret) {
    const item = normalize(secret);
    const aliases = knowledge?.entityAliases?.[category] || {};
    for (const [alias, canonical] of Object.entries(aliases)) {
      if (normalize(alias) === item) return normalize(canonical);
    }
    return item;
  }

  function isKnownItem(category, item) {
    const items = knowledge?.categoryItems?.[category];
    return Array.isArray(items) && items.some(value => normalize(value) === item);
  }

  /*
   * Curated fact references used for stable classification:
   * - UN Statistics Division M49: https://unstats.un.org/unsd/methodology/m49/
   * - FAO fruit morphology and citrus/tropical groupings: https://www.fao.org/4/y2515e/y2515e04.htm
   * - Cambridge Guide to Orchestration, instrument families: https://assets.cambridge.org/97811070/25165/frontmatter/9781107025165_frontmatter.pdf
   * - UNESCO World Heritage Centre entries for landmark locations: https://whc.unesco.org/
   * Facts not represented in the curated sets intentionally return UNKNOWN.
   */
  const facts = {
    animals: {
      // Game rubric: adult body mass under 10 kg = small, 10–100 kg = medium, over 100 kg = large.
      // Cheetah adult weight is about 34–64 kg (Smithsonian National Zoo).
      // https://nationalzoo.si.edu/animals/cheetah
      small: new Set(["قطة","أرنب","بطة"]),
      known: new Set(["بطة","بقرة","أسد","فيل","زرافة","بطريق","دلفين","نمر","قطة","كلب","ذئب","حصان","كنغر","تمساح","بومة","فهد","دب قطبي","ثعلب","غوريلا","باندا","سلحفاة","أرنب","خفاش","قرد","جمل","غزال","ضبع","ماعز","خروف","حمار"]),
      medium: new Set(["فهد","ذئب"]),
      large: new Set(["بقرة","أسد","فيل","زرافة","دب قطبي","جمل","حصان","نمر"]),
      marine: new Set(["دلفين"]),
      marineNo: new Set(["بطة","بقرة","أسد","فيل","زرافة","نمر","قطة","كلب","ذئب","حصان","كنغر","فهد","ثعلب","غوريلا","باندا","أرنب","خفاش","قرد","جمل","غزال","ضبع","ماعز","خروف","حمار"]),
      mammal: new Set(["بقرة","أسد","فيل","زرافة","دلفين","نمر","قطة","كلب","ذئب","حصان","كنغر","فهد","دب قطبي","ثعلب","غوريلا","باندا","أرنب","خفاش","قرد","جمل","غزال","ضبع","ماعز","خروف","حمار"]),
      reptile: new Set(["تمساح","سلحفاة"]),
      bird: new Set(["بطة","بطريق","بومة"]),
      predator: new Set(["أسد","نمر","ذئب","تمساح","فهد","ثعلب","ضبع"]),
      domestic: new Set(["بقرة","قطة","كلب","حصان","ماعز","خروف","حمار","بطة"])
    },
    birds: {
      flightless: new Set(["نعامة","كيوي"]),
      flightCapable: new Set(["صقر","نسر","بومة","ببغاء","غراب","حمامة","طاووس","بطّة","دجاجة","هدهد","كناري","لقلق","فلامنغو","نورس","عقاب","عصفور","ديك","إوزة","بجعة","نقار الخشب","سنونو","كوكاتو"]),
      waterBird: new Set(["بطّة","بطة","بجعة","إوزة","نورس","فلامنغو","لقلق"])
    },
    countries: {
      arab: new Set(["العراق","مصر","المغرب","السعودية","الأردن","تونس"]),
      asia: new Set(["العراق","اليابان","تركيا","الهند","السعودية","الأردن","كوريا الجنوبية","إندونيسيا","الصين"]),
      europe: new Set(["إيطاليا","إسبانيا","فرنسا","ألمانيا","النرويج","البرتغال","اليونان","روسيا"]),
      africa: new Set(["مصر","المغرب","تونس","جنوب أفريقيا"]),
      southAmerica: new Set(["البرازيل","الأرجنتين"]),
      northAmerica: new Set(["كندا","المكسيك"]),
      oceania: new Set(["أستراليا"])
    },
    cars: {
      electric: new Set(["تسلا"]),
      japanese: new Set(["تويوتا","نيسان جي تي آر","هوندا","لكزس","سوبارو","مازدا"]),
      german: new Set(["مرسيدس","بي ام دبليو","bmw","أودي","بورشه","فولكس فاغن"]),
      italian: new Set(["لامبورغيني","فيراري"]),
      american: new Set(["فورد موستانغ","شيفروليه كامارو","دودج تشارجر","جيب رانجلر","تسلا"])
    },
    foods: {
      iraqi: new Set(["دولمة","تشريب","مسكوف","كبة","باجة","كليجة","تشريب لحم","قوزي","قيمة"]),
      sweet: new Set(["بقلاوة","كليجة","آيس كريم"])
    },
    fruit: {
      citrus: new Set(["برتقال","ليمون"]),
      red: new Set(["رمان","فراولة","كرز"]),
      tropical: new Set(["موز","مانجو","أناناس","جوافة","بابايا","أفوكادو","جوز الهند"])
    },
    sea: {
      mammal: new Set(["حوت أزرق","فقمة","أوركا","دلفين","الحوت الأحدب"]),
      fish: new Set(["قرش","فرس البحر","سمكة المهرج","مانتا","ثعبان البحر","سردين","تونة","سمكة أبو سيف","سمكة قرش المطرقة"]),
      invertebrate: new Set(["أخطبوط","حبار","نجم البحر","قنديل البحر","سلطعون","روبيان","محار","خيار البحر","كركند","قنفذ البحر"])
    },
    instruments: {
      string: new Set(["عود","گيتار","كمان","قانون","تشيلو","قيثارة","بزق","ربابة","كونترباص","سنطور","غيتار باس"]),
      wind: new Set(["ناي","ساكسفون","مزمار","ترومبيت","فلوت","كلارينيت","ترومبون","بوق","هارمونيكا"]),
      percussion: new Set(["طبلة","دف"]),
      keyboard: new Set(["بيانو","أكورديون"])
    },
    sports: {
      team: new Set(["كرة القدم","كرة السلة","كرة الطائرة","الكريكيت","كرة اليد","البيسبول","الرجبي"]),
      individual: new Set(["التنس","الملاكمة","المصارعة","السباحة","الجمباز","الفورمولا 1","رفع الأثقال","المبارزة","الرماية","ركوب الدراجات","الجودو","التايكواندو","كرة الريشة","الغولف","التزلج","الاسكواش","تنس الطاولة"]),
      water: new Set(["السباحة"]),
      combat: new Set(["الملاكمة","المصارعة","الجودو","التايكواندو","المبارزة"])
    },
    landmarks: {
      france: new Set(["برج إيفل","قصر فرساي"]),
      egypt: new Set(["الأهرامات","أبو الهول"]),
      uae: new Set(["برج خليفة"]),
      china: new Set(["سور الصين العظيم"]),
      india: new Set(["تاج محل"]),
      italy: new Set(["الكولوسيوم","برج بيزا"]),
      jordan: new Set(["البتراء"]),
      iraq: new Set(["زقورة أور"]),
      uk: new Set(["ساعة بيغ بن"]),
      peru: new Set(["ماتشو بيتشو"]),
      usa: new Set(["تمثال الحرية"]),
      saudi: new Set(["الكعبة"]),
      brazil: new Set(["تمثال المسيح الفادي"]),
      cambodia: new Set(["معبد أنغكور وات"])
    }
  };

  for (const [group, additions] of Object.entries(knowledge?.additionalFacts || {})) {
    const target = facts[group] || (facts[group] = {});
    for (const [key, values] of Object.entries(additions)) {
      const incoming = values instanceof Set ? values : new Set(values || []);
      target[key] = target[key] instanceof Set
        ? new Set([...target[key], ...incoming])
        : new Set(incoming);
    }
  }

  const questionGuides = Object.freeze({
    "الحيوانات": { placeholder:"اسأل عن الحيوان المختار، مثلاً: هل هو من الثدييات؟", example:"هل هو من الثدييات؟" },
    "الطيور": { placeholder:"اسأل عن الطائر المختار، مثلاً: هل يگدر يطير؟", example:"هل يگدر يطير؟" },
    "كائنات البحر": { placeholder:"اسأل عن الكائن البحري، مثلاً: هل هو من الثدييات؟", example:"هل هو من الثدييات؟" },
    "الدول": { placeholder:"اسأل عن الدولة المختارة، مثلاً: هل تقع في آسيا؟", example:"هل تقع في آسيا؟" },
    "المصارعين": { placeholder:"اسأل عن موطن المصارع، مثلاً: هل هو من أيرلندا؟", example:"هل هو من أيرلندا؟" },
    "لاعبو كرة القدم": { placeholder:"اسأل عن بلد اللاعب، مثلاً: هل هو من الأرجنتين؟", example:"هل هو من الأرجنتين؟" },
    "شخصيات الألعاب": { placeholder:"اسأل عن اللعبة التي تنتمي إلها الشخصية، مثلاً: هل هي من God of War؟", example:"هل هي من God of War؟" },
    "الأفلام": { placeholder:"اسأل عن عالم الفيلم، مثلاً: هل هي من عالم مارفل؟", example:"هل هي من عالم مارفل؟" },
    "الأنمي": { placeholder:"اسأل عن مسلسل الأنمي، مثلاً: هل هي من ناروتو؟", example:"هل هي من ناروتو؟" },
    "السيارات": { placeholder:"اسأل عن السيارة المختارة، مثلاً: هل هي كهربائية؟", example:"هل هي كهربائية؟" },
    "الأكلات": { placeholder:"اسأل عن الأكلة المختارة، مثلاً: هل هي حلوى؟", example:"هل هي حلوى؟" },
    "الأبطال الخارقون": { placeholder:"اسأل عن عالم الشخصية، مثلاً: هل هي من عالم دي سي؟", example:"هل هي من عالم دي سي؟" },
    "المهن": { placeholder:"اسأل عن مجال المهنة، مثلاً: هل هي من المهن الطبية؟", example:"هل هي من المهن الطبية؟" },
    "المعالم": { placeholder:"اسأل عن المعلم المختار، مثلاً: هل يقع في العراق؟", example:"هل يقع في العراق؟" },
    "الفواكه": { placeholder:"اسأل عن الفاكهة المختارة، مثلاً: هل هي من الحمضيات؟", example:"هل هي من الحمضيات؟" },
    "الآلات الموسيقية": { placeholder:"اسأل عن الآلة المختارة، مثلاً: هل تُعزف بالنفخ؟", example:"هل تُعزف بالنفخ؟" },
    "الرياضات": { placeholder:"اسأل عن الرياضة المختارة، مثلاً: هل تُلعب جماعياً؟", example:"هل تُلعب جماعياً؟" },
    "شخصيات تاريخية": { placeholder:"اسأل عن مجال الشخصية، مثلاً: هل هي عالمة؟", example:"هل هي عالمة؟" }
  });

  function getQuestionGuide(category) {
    category = resolveCategory(category);
    return questionGuides[category] || {
      placeholder: "اكتب سؤالاً يناسب الفئة المختارة.",
      example: "اسأل عن نوع العنصر أو صفته المرتبطة بالفئة."
    };
  }

  const categorySpecificIntents = {
    sizeSmall:["الحيوانات"], sizeLarge:["الحيوانات"], sizeMedium:["الحيوانات"], sizeAny:["الحيوانات"],
    arab:["الدول"], asia:["الدول"], europe:["الدول"], africa:["الدول"],
    southAmerica:["الدول"], northAmerica:["الدول"], oceania:["الدول"],
    marine:["الحيوانات","كائنات البحر"], water:["الحيوانات","كائنات البحر"],
    fly:["الحيوانات","الطيور"], bird:["الحيوانات","الطيور"],
    mammal:["الحيوانات","كائنات البحر"], reptile:["الحيوانات"], predator:["الحيوانات"], domestic:["الحيوانات"],
    electric:["السيارات"], iraqiFood:["الأكلات"], sweet:["الأكلات"],
    citrus:["الفواكه"], red:["الفواكه"], tropical:["الفواكه"],
    fish:["كائنات البحر"], invertebrate:["كائنات البحر"],
    instrumentString:["الآلات الموسيقية"], instrumentWind:["الآلات الموسيقية"],
    instrumentPercussion:["الآلات الموسيقية"], instrumentKeyboard:["الآلات الموسيقية"],
    teamSport:["الرياضات"], individualSport:["الرياضات"], waterSport:["الرياضات"], combatSport:["الرياضات"],
    france:["المعالم"], egypt:["المعالم"], uae:["المعالم"], china:["المعالم"], india:["المعالم"],
    italy:["المعالم"], jordan:["المعالم"], iraq:["المعالم"], uk:["المعالم"], peru:["المعالم"],
    usa:["المعالم"], saudi:["المعالم"], brazil:["المعالم"], cambodia:["المعالم"]
  };

  for (const [intent, entries] of Object.entries(knowledge?.factIntents || {})) {
    categorySpecificIntents[intent] = Object.keys(entries);
  }

  function categoryMismatch(category, intent) {
    const allowed = categorySpecificIntents[intent];
    if (!allowed || allowed.includes(category)) return null;
    const intentDomain = {
      sizeSmall:"الحيوانات", sizeLarge:"الحيوانات", sizeMedium:"الحيوانات", sizeAny:"الحيوانات",
      marine:"كائنات البحر والحيوانات", water:"كائنات البحر والحيوانات", fly:"الحيوانات والطيور",
      bird:"الحيوانات والطيور", isBird:"الحيوانات والطيور", mammal:"الحيوانات وكائنات البحر",
      reptile:"الحيوانات", predator:"الحيوانات", domestic:"الحيوانات",
      arab:"الدول", asia:"الدول", europe:"الدول", africa:"الدول", southAmerica:"الدول",
      northAmerica:"الدول", oceania:"الدول", electric:"السيارات", iraqiFood:"الأكلات",
      sweet:"الأكلات", citrus:"الفواكه", red:"الفواكه", tropical:"الفواكه",
      fish:"كائنات البحر", invertebrate:"كائنات البحر", instrumentString:"الآلات الموسيقية",
      instrumentWind:"الآلات الموسيقية", instrumentPercussion:"الآلات الموسيقية",
      instrumentKeyboard:"الآلات الموسيقية", teamSport:"الرياضات", individualSport:"الرياضات",
      waterSport:"الرياضات", combatSport:"الرياضات", france:"المعالم", egypt:"المعالم",
      uae:"المعالم", china:"المعالم", india:"المعالم", italy:"المعالم", jordan:"المعالم",
      iraq:"المعالم", uk:"المعالم", peru:"المعالم", usa:"المعالم", saudi:"المعالم",
      brazil:"المعالم", cambodia:"المعالم"
    };
    const guide = getQuestionGuide(category);
    const knowledgeDomains = knowledge?.factIntents?.[intent]
      ? [...new Set(Object.values(knowledge.factIntents[intent]).map(entry => entry.label))].join(" أو ")
      : (intentDomain[intent] || "مجالاً آخر");
    return "هذا السؤال يخص " + knowledgeDomains +
      "، مو فئة «" + category + "». جرّب سؤالاً يناسب الفئة الحالية، مثلاً: " + guide.example;
  }

  const categoryFactMap = {
    "الحيوانات":"animals", "الطيور":"birds", "الدول":"countries", "السيارات":"cars",
    "الأكلات":"foods", "الفواكه":"fruit", "كائنات البحر":"sea",
    "الآلات الموسيقية":"instruments", "الرياضات":"sports", "المعالم":"landmarks",
    "المصارعين":"wrestlers", "لاعبو كرة القدم":"footballers", "شخصيات الألعاب":"gameCharacters",
    "الأفلام":"filmCharacters", "الأنمي":"animeCharacters", "الأبطال الخارقون":"superheroes",
    "المهن":"professions", "شخصيات تاريخية":"historical"
  };

  const intentPatterns = [
    ["sizeSmall", ["صغير الحجم","حجم صغير","صغيره","صغير"]],
    ["sizeLarge", ["كبير الحجم","حجم كبير","كبيره","كبير"]],
    ["sizeMedium", ["متوسط الحجم","حجم متوسط","متوسطه","متوسط"]],
    ["sizeAny", ["شنو حجمه","شنو حجمها","شكد حجمه","حجمه شكد","ما حجم","ما هو حجم","حجم الحيوان"]],
    ["arab", ["دوله عربيه","بلد عربي","عربيه","عربي"]],
    ["asia", ["في اسيا","باسيا","اسيوي","اسيوية"]],
    ["europe", ["في اوروبا","باوروبا","اوربي","اوروبية"]],
    ["africa", ["في افريقيا","بافريقيا","افريقي"]],
    ["southAmerica", ["امريكا الجنوبيه","امريكا اللاتينيه"]],
    ["northAmerica", ["امريكا الشماليه"]],
    ["oceania", ["اوقيانوسيا","في استراليا"]],
    ["isMarine", ["كائن بحري","حيوان بحري","من كائنات البحر"]],
    ["marine", ["تعيش بالبحر","يعيش بالبحر","تعيش في البحر","يعيش في البحر","اعيش بالبحر","اعيش في البحر","بالبحر","بالمحيط","بحري"]],
    ["water", ["تعيش بالماء","يعيش بالماء","تعيش في الماء","يعيش في الماء"]],
    ["fly", ["تطير","يطير","تگدر تطير","يگدر يطير","تقدر تطير","يقدر يطير","يستطيع الطيران","تستطيع الطيران","استطيع الطيران","يقدر على الطيران","تقدر على الطيران","قادر يطير","قادرة تطير","يمكنه الطيران","يمكنها الطيران","عندها اجنحه","عنده اجنحه","لها اجنحه","له اجنحه","يطير بالجو"]],
    ["isBird", ["من الطيور","طائر","طير","هل هو طائر","هل هي طائرة"]],
    ["bird", ["من الطيور","طائر","طير"]],
    ["mammal", ["من الثدييات","ثديي","يرضع صغاره"]],
    ["reptile", ["من الزواحف","زاحف"]],
    ["predator", ["مفترس","من المفترسات","يصيد حيوانات","ياكل لحوم"]],
    ["domestic", ["اليف","منزلي","نربيه بالبيت","ينربى بالبيت"]],
    ["electric", ["سياره كهربائيه","كهربائيه"]],
    ["iraqiFood", ["اكله عراقيه","اكل عراقي","من الاكلات العراقيه"]],
    ["sweet", ["حلوى","حلويات","حلو"]],
    ["citrus", ["فاكهه حمضيه","حمضي","من الحمضيات"]],
    ["red", ["لونه احمر","لونها احمر","احمر"]],
    ["tropical", ["استوائي","استوائيه"]],
    ["fish", ["من الاسماك","سمكه","سمك"]],
    ["invertebrate", ["لافقاري","من اللافقاريات"]],
    ["instrumentString", ["وتري","من الالات الوترية","يعزف بالاوتار"]],
    ["instrumentWind", ["نفخي","هوائي","ينعزف بالنفخ","اله نفخ"]],
    ["instrumentPercussion", ["ايقاعي","من الايقاعيات","ينضرب باليد"]],
    ["instrumentKeyboard", ["لوحة مفاتيح","لوحة المفاتيح","من الالات ذات المفاتيح"]],
    ["teamSport", ["رياضه جماعيه","تلعب بفريق","لعبة جماعية"]],
    ["individualSport", ["رياضه فرديه","تلعب فردي","لعبة فردية"]],
    ["waterSport", ["رياضه مائيه","تلعب بالماء","مائيه"]],
    ["combatSport", ["رياضه قتاليه","قتاليه"]],
    ["isAnimal", ["انت حيوان","انت من الحيوانات","هو حيوان","حيوان"]],
    ["isBird", ["انت طير","من الطيور","هل هو طائر"]],
    ["isMarine", ["كائن بحري","حيوان بحري","من كائنات البحر"]],
    ["isCountry", ["انت دوله","انت بلد","هي دوله","دوله"]],
    ["isPerson", ["انت انسان","انت شخص حقيقي","شخص حقيقي","انسان"]],
    ["isFictional", ["شخصيه خياليه","خيالي","من الخيال"]],
    ["isGameCharacter", ["شخصيه لعبه","شخصية لعبة"]],
    ["isFilmCharacter", ["شخصيه فيلم","من فيلم"]],
    ["isAnimeCharacter", ["شخصيه انمي","من الانمي"]],
    ["isSuperhero", ["بطل خارق","من الابطال الخارقين"]],
    ["isCar", ["سياره","مركبه"]],
    ["isFood", ["اكله","طعام","من الاكلات"]],
    ["isFruit", ["فاكهه","من الفواكه"]],
    ["isProfession", ["مهنه","وظيفه","عمل"]],
    ["isLandmark", ["معلم سياحي","من المعالم","مكان مشهور"]],
    ["france", ["في فرنسا","بفرنسا"]], ["egypt", ["في مصر","بمصر"]],
    ["uae", ["في الامارات","بالامارات"]], ["china", ["في الصين","بالصين"]],
    ["india", ["في الهند","بالهند"]], ["italy", ["في ايطاليا","بايطاليا"]],
    ["jordan", ["في الاردن","بالاردن"]], ["iraq", ["في العراق","بالعراق"]],
    ["uk", ["في بريطانيا","في لندن","ببريطانيا"]], ["peru", ["في بيرو","ببيرو"]],
    ["usa", ["في امريكا","بالولايات المتحده"]], ["saudi", ["في السعوديه","بالسعوديه"]],
    ["brazil", ["في البرازيل","بالبرازيل"]], ["cambodia", ["في كمبوديا","بكمبوديا"]],
    ["isInstrument", ["اله موسيقيه","آلة موسيقية","من الالات الموسيقيه"]],
    ["isSport", ["رياضه","لعبه رياضيه"]],
    ["isWrestler", ["مصارع","من المصارعين"]],
    ["isFootballer", ["لاعب كره قدم","لاعب كرة","من لاعبي كرة القدم"]],
    ["isHistorical", ["شخصيه تاريخيه","من التاريخ","شخص تاريخي"]],
    ["isCharacter", ["انت شخصيه","شخصية"]],
  ];

  intentPatterns.push(...(knowledge?.intentPatterns || []));

  function inSet(set, item) {
    if (!set) return null;
    for (const value of set) if (normalize(value) === item) return true;
    return false;
  }

  // Keep specific intents ahead of broad category intents to avoid shadowing.
  function findIntent(question) {
    const q = normalize(question);
    let winner = "";
    let winnerLength = 0;
    let winnerPriority = -1;
    for (let index = 0; index < intentPatterns.length; index++) {
      const [intent, phrases] = intentPatterns[index];
      const priority = knowledge?.factIntents?.[intent] ? 1 : 0;
      for (const phrase of phrases) {
        const candidate = normalize(phrase);
        if (!candidate || !q.includes(candidate)) continue;
        if (candidate.length > winnerLength || (candidate.length === winnerLength && priority > winnerPriority)) {
          winner = intent;
          winnerLength = candidate.length;
          winnerPriority = priority;
        }
      }
    }
    return winner;
  }

  // Detect only a clear negation immediately attached to the matched predicate.
  // This avoids treating phrases such as "لا يزال" or "ما حجم" as negative questions.
  const NEGATION_WORDS = new Set(["لا","ما","مو","مش","ليس","ليست","مب"]);
  const NEGATION_BRIDGES = new Set(["هو","هي","من","يقدر","تقدر","يستطيع","تستطيع","قادر","قادرة","عنده","عندها","له","لها","صحيح","انه","انها","يمكنه","يمكنها"]);
  function questionPolarity(question, intent) {
    if (!intent) return "positive";
    const q = normalize(question);
    const entry = intentPatterns.find(([name]) => name === intent);
    if (!entry) return "positive";
    const phrases = entry[1].map(normalize).filter(Boolean).sort((a,b)=>b.length-a.length);
    for (const phrase of phrases) {
      const at = q.indexOf(phrase);
      if (at < 0) continue;
      const prefixWords = q.slice(0, at).trim().split(" ").filter(Boolean);
      const window = prefixWords.slice(-5);
      const firstNegation = window.findIndex(word => NEGATION_WORDS.has(word));
      if (firstNegation < 0) continue;
      const tail = window.slice(firstNegation);
      if (!tail.slice(1).every(word => NEGATION_BRIDGES.has(word) || NEGATION_WORDS.has(word))) continue;
      const count = tail.filter(word => NEGATION_WORDS.has(word)).length;
      return count === 1 ? "negative" : "ambiguous";
    }
    return "positive";
  }

  // Deterministic answers are limited to the curated facts above; unknowns always abstain.
  function answer(category, secret, question) {
    category = resolveCategory(category);
    const profile = profiles[category];
    if (!profile || !String(secret ?? "").trim() || !String(question ?? "").trim()) {
      return { answer: UNKNOWN, known: false, source: "abstain", reason: "missing-context" };
    }
    const item = canonicalItem(category, secret);
    if (!isKnownItem(category, item)) {
      return { answer: UNKNOWN, known: false, source: "abstain", reason: "unknown-entity" };
    }
    const intent = findIntent(question);
    const polarity = questionPolarity(question, intent);
    if (polarity === "ambiguous") return { answer: UNKNOWN, known: false, source: "abstain", reason: "ambiguous-negation", intent: intent || null };
    const group = categoryFactMap[category];
    const data = group ? facts[group] : null;
    const mismatch = categoryMismatch(category, intent);
    if (mismatch) return { answer: mismatch, known: false, source: "category-guidance", reason: "category-mismatch", intent };
    let value = null;
    const specificFact = knowledge?.factIntents?.[intent]?.[category];
    if (specificFact) {
      const selected = inSet(data?.[specificFact.key], item);
      const known = specificFact.knownKey ? inSet(data?.[specificFact.knownKey], item) : null;
      if (selected === true) value = true;
      else if (known === true) value = false;
    } else if (intent.startsWith("is")) {
      const flagByIntent = {
        isAnimal:"animal", isBird:"bird", isMarine:"marine", isCountry:"country",
        isPerson:"realPerson", isFictional:"fictional", isCharacter:"character",
        isGameCharacter:"gameCharacter", isFilmCharacter:"filmCharacter",
        isAnimeCharacter:"animeCharacter", isSuperhero:"superhero", isCar:"car",
        isFood:"food", isFruit:"fruit", isProfession:"profession", isLandmark:"landmark",
        isInstrument:"instrument", isSport:"sport", isWrestler:"wrestler",
        isFootballer:"footballer", isHistorical:"historicalPerson"
      };
      const flag = flagByIntent[intent];
      if (intent === "isBird" && group === "animals") {
        value = inSet(data.bird,item) === true ? true : (inSet(data.known,item) === true ? false : null);
      } else if (intent === "isMarine" && group === "animals") {
        value = inSet(data.marine,item) === true ? true : (inSet(data.known,item) === true ? false : null);
      } else if (flag === "realPerson" && profile.flags.includes("fictional")) value = null;
      else value = profile.flags.includes(flag);
    } else if (intent === "sizeSmall" || intent === "sizeLarge" || intent === "sizeMedium" || intent === "sizeAny") {
      if (group === "animals") {
        const sizes = [
          ["small", inSet(data.small, item)],
          ["medium", inSet(data.medium, item)],
          ["large", inSet(data.large, item)]
        ].filter(([, found]) => found === true);
        if (sizes.length === 1) {
          const size = sizes[0][0];
          const label = {small:"صغير",medium:"متوسط",large:"كبير"}[size];
          if (intent === "sizeAny") value = "الحجم " + label + ".";
          else {
            const matchesRequestedSize = intent === "size" + size[0].toUpperCase() + size.slice(1);
            const answerYes = polarity === "negative" ? !matchesRequestedSize : matchesRequestedSize;
            value = (answerYes ? "نعم، الحجم " : "لا، الحجم ") + label + ".";
          }
        }
      }
    } else if (intent === "arab" || ["asia","europe","africa","southAmerica","northAmerica","oceania"].includes(intent)) {
      if (group === "countries") value = inSet(data[intent], item);
    } else if (intent === "marine" || intent === "water") {
      if (group === "animals") value = inSet(data.marine,item) === true ? true : (inSet(data.known,item) === true ? false : null);
      if (group === "sea") {
        const knownSeaLife = new Set([...data.mammal, ...data.fish, ...data.invertebrate]);
        value = inSet(knownSeaLife, item);
      }
    } else if (intent === "fly") {
      if (group === "animals") {
        const birds = inSet(data.bird,item);
        if (birds === true) value = item === normalize("بطريق") ? false : true;
        else if (item === normalize("خفاش")) value = true;
        else if (inSet(data.known,item) === true) value = false;
      }
      if (group === "birds") value = inSet(data.flightless,item) === true ? false : (inSet(data.flightCapable,item) === true ? true : null);
    } else if (intent === "bird") {
      if (group === "animals") value = inSet(data.bird,item) === true ? true : (inSet(data.known,item) === true ? false : null);
      if (group === "birds") {
        const knownBird = new Set([...data.flightless, ...data.flightCapable]);
        value = inSet(knownBird, item);
      }
    } else if (intent === "mammal") {
      if (group === "animals") value = inSet(data.known,item) === true ? inSet(data.mammal,item) : null;
      if (group === "sea") value = inSet(data.mammal,item);
    } else if (intent === "reptile") {
      if (group === "animals") value = inSet(data.known,item) === true ? inSet(data.reptile,item) : null;
    } else if (intent === "predator" || intent === "domestic") {
      if (group === "animals") value = inSet(data[intent],item) === true ? true : null;
    } else if (intent === "electric") {
      if (group === "cars") value = inSet(data.electric,item) === true ? true : null;
    } else if (intent === "iraqiFood" || intent === "sweet") {
      if (group === "foods") value = inSet(data[intent === "iraqiFood" ? "iraqi" : "sweet"],item);
    } else if (["citrus","red","tropical"].includes(intent)) {
      if (group === "fruit") value = intent === "citrus" ? inSet(data[intent],item) : (inSet(data[intent],item) === true ? true : null);
    } else if (["fish","invertebrate"].includes(intent)) {
      if (group === "sea") {
        const selected = data[intent];
        const allKnown = new Set([...data.mammal,...data.fish,...data.invertebrate]);
        value = inSet(allKnown,item) === true ? inSet(selected,item) : null;
      }
    } else if (intent.startsWith("instrument")) {
      if (group === "instruments") {
        const key = intent.slice("instrument".length).toLowerCase();
        const selected = data[key];
        const allKnown = new Set(Object.values(data).flatMap(set=>[...set]));
        value = inSet(allKnown,item) === true ? inSet(selected,item) : null;
      }
    } else if (["teamSport","individualSport","waterSport","combatSport"].includes(intent)) {
      if (group === "sports") {
        const key = {teamSport:"team",individualSport:"individual",waterSport:"water",combatSport:"combat"}[intent];
        const selected = data[key];
        const allKnown = new Set(Object.values(data).flatMap(set=>[...set]));
        value = inSet(allKnown,item) === true ? inSet(selected,item) : null;
      }
    } else if (intent.startsWith("is") === false && ["france","egypt","uae","china","india","italy","jordan","iraq","uk","peru","usa","saudi","brazil","cambodia"].includes(intent)) {
      if (group === "landmarks") { const known = new Set(Object.values(data).flatMap(set => [...set])); value = inSet(known,item) === true ? inSet(data[intent],item) : null; }
    }

    if (value === null || value === undefined) {
      return { answer: UNKNOWN, known: false, source: "local-curated-facts", intent: intent || null };
    }
    if (typeof value === "boolean" && polarity === "negative") value = !value;
    return {
      answer: typeof value === "string" ? value : value ? YES : NO,
      known: true,
      source: "local-curated-facts",
      intent
    };
  }

  const api = Object.freeze({
    answer,
    normalize,
    getCategories: () => Object.keys(profiles),
    getQuestionGuide,
    getProfile: category => profiles[resolveCategory(category)] || null,
    resolveCategory,
    getItems: category => (knowledge?.categoryItems?.[resolveCategory(category)] || []).slice(),
    getFacts: category => {
      const group = categoryFactMap[resolveCategory(category)];
      const data = group ? facts[group] : null;
      return data ? Object.fromEntries(Object.entries(data).filter(([, value]) => value instanceof Set).map(([key, value]) => [key, [...value]])) : {};
    },
    getFactIntents: () => knowledge?.factIntents || {},
    getFactSources: () => knowledge?.factSources || {},
    unknown: UNKNOWN
  });
  globalThis.SuwadWhoAI = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  function mountHomeButtons() {
    const entries = [
      { selector: 'button[data-game="who"]', marker: "aiWhoPractice", label: "العب ضد أوراس 🤖", action: () => globalThis.startSuwadWhoPractice?.() }
    ];
    for (const entry of entries) {
      const trigger = document.querySelector(entry.selector);
      const card = trigger?.closest(".game-card");
      const host = card?.querySelector(".game-info");
      if (!host || host.querySelector("[data-ai-who-practice], [data-ai-number-practice]")) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-ghost ai-practice-card-btn";
      button.dataset[entry.marker] = "true";
      button.textContent = entry.label;
      button.addEventListener("click", entry.action);
      host.append(button);
    }
  }
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountHomeButtons);
    else mountHomeButtons();
  }
})();