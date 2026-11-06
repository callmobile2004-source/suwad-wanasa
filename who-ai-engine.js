(() => {
  "use strict";

  const UNKNOWN = "ما عندي معلومة موثوقة عن هالسؤال؛ جرّب صياغة ثانية.";
  const YES = "نعم";
  const NO = "لا";

  function normalize(value) {
    return String(value ?? "")
      .normalize("NFKC")
      .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/[پ]/g, "ب")
      .replace(/[چ]/g, "ج")
      .replace(/[گ]/g, "ك")
      .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
      .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
      .replace(/[؟?!.،,:؛()[\]{}"'`]/g, " ")
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
      small: new Set(["قطة","أرنب","أرنب أوروبي","بطة"]),
      medium: new Set(["فهد","ذئب رمادي","ضبع مرقط"]),
      large: new Set(["بقرة","أسد","فيل","زرافة","دب قطبي","جمل","حصان","تمساح المياه المالحة","ببر بنغالي"]),
      marine: new Set(["دلفين"]),
      marineNo: new Set(["بطة","بقرة","أسد","فيل","زرافة","نمر","قطة","كلب","ذئب","حصان","كنغر","فهد","ثعلب","غوريلا","باندا","أرنب","خفاش","قرد","جمل","غزال","ضبع","ماعز","خروف","حمار"]),
      mammal: new Set(["بقرة","أسد","فيل","زرافة","دلفين","نمر","قطة","كلب","ذئب","حصان","كنغر","فهد","دب قطبي","ثعلب","غوريلا","باندا","أرنب","خفاش","قرد","جمل","غزال","ضبع","ماعز","خروف","حمار"]),
      reptile: new Set(["تمساح","سلحفاة"]),
      bird: new Set(["بطة","بطريق","بومة"]),
      predator: new Set(["أسد","نمر","ذئب","تمساح","فهد","ثعلب","ضبع"]),
      domestic: new Set(["بقرة","قطة","كلب","حصان","ماعز","خروف","حمار","بطة"])
    },
    birds: {
      flightless: new Set(["بطريق","نعامة","كيوي"]),
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
      german: new Set(["مرسيدس","بي ام دبليو","bmw","أودي","بورشه","فولكس فاغن","فولفو"]),
      italian: new Set(["لامبورغيني","فيراري","ماكلارين"]),
      american: new Set(["فورد موستانغ","شيفروليه كامارو","دودج تشارجر","جيب رانجلر","تسلا"])
    },
    foods: {
      iraqi: new Set(["دولمة","تشريب","مسكوف","كبة","باجة","كليجة","تشريب لحم","قوزي","قيمة"]),
      sweet: new Set(["بقلاوة","كليجة","آيس كريم"])
    },
    fruit: {
      citrus: new Set(["برتقال","ليمون"]),
      red: new Set(["رمان","فراولة","كرز"]),
      tropical: new Set(["موز","مانجو","أناناس","جوافة","بابايا","تمر","أفوكادو","جوز الهند"])
    },
    sea: {
      mammal: new Set(["حوت أزرق","فقمة","أوركا","دلفين","الحوت الأحدب"]),
      fish: new Set(["قرش","سمكة المهرج","مانتا","سردين","تونة","سمكة أبو سيف","سمكة قرش المطرقة"]),
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
      individual: new Set(["التنس","الملاكمة","السباحة","الجمباز","الفورمولا 1","رفع الأثقال","المبارزة","الرماية","ركوب الدراجات","الجودو","التايكواندو","كرة الريشة","الغولف","التزلج","الاسكواش","تنس الطاولة"]),
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

  const categoryFactMap = {
    "الحيوانات":"animals", "الطيور":"birds", "الدول":"countries", "السيارات":"cars",
    "الأكلات":"foods", "الفواكه":"fruit", "كائنات البحر":"sea",
    "الآلات الموسيقية":"instruments", "الرياضات":"sports", "المعالم":"landmarks"
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
    ["marine", ["تعيش بالبحر","يعيش بالبحر","تعيش في البحر","يعيش في البحر","اعيش بالبحر","اعيش في البحر","بالبحر","بالمحيط","بحري"]],
    ["water", ["تعيش بالماء","يعيش بالماء","تعيش في الماء","يعيش في الماء","مائي"]],
    ["fly", ["تطير","يطير","تگدر تطير","يگدر يطير","تقدر تطير","يقدر يطير","تستطيع الطيران","استطيع الطيران","عندها اجنحه","عنده اجنحه","يطير بالجو"]],
    ["bird", ["من الطيور","طائر","طير"]],
    ["mammal", ["من الثدييات","ثديي","يرضع صغاره"]],
    ["reptile", ["من الزواحف","زاحف"]],
    ["predator", ["مفترس","يصيد حيوانات","ياكل لحوم"]],
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
    ["waterSport", ["رياضه مائيه","تلعب بالماء"]],
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

  function inSet(set, item) {
    if (!set) return null;
    for (const value of set) if (normalize(value) === item) return true;
    return false;
  }

  function findIntent(question) {
    const q = normalize(question);
    for (const [intent, phrases] of intentPatterns) {
      if (phrases.some(phrase => q.includes(normalize(phrase)))) return intent;
    }
    return "";
  }

  function answer(category, secret, question) {
    const profile = profiles[category];
    if (!profile || !String(secret ?? "").trim() || !String(question ?? "").trim()) {
      return { answer: UNKNOWN, known: false, source: "abstain", reason: "missing-context" };
    }
    const item = normalize(secret);
    const intent = findIntent(question);
    const group = categoryFactMap[category];
    const data = group ? facts[group] : null;
    let value = null;

    if (intent.startsWith("is")) {
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
        value = inSet(data.bird,item) === true ? true :
          (inSet(data.mammal,item) === true || inSet(data.reptile,item) === true ? false : null);
      } else if (intent === "isMarine" && group === "animals") {
        value = inSet(data.marine,item) === true ? true : inSet(data.marineNo,item);
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
          else value = (intent === "size" + size[0].toUpperCase() + size.slice(1) ? "نعم، الحجم " : "لا، الحجم ") + label + ".";
        }
      }
    } else if (intent === "arab" || ["asia","europe","africa","southAmerica","northAmerica","oceania"].includes(intent)) {
      if (group === "countries") value = inSet(data[intent], item);
    } else if (intent === "marine" || intent === "water") {
      if (group === "animals") value = intent === "marine" ? (inSet(data.marine,item) === true ? true : inSet(data.marineNo,item)) : (inSet(data.marine,item) === true ? true : inSet(data.marineNo,item));
      if (group === "sea") value = true;
    } else if (intent === "fly") {
      if (group === "animals") {
        const birds = inSet(data.bird,item);
        if (birds === true) value = item === normalize("بطريق") ? false : true;
        else if (item === normalize("خفاش")) value = true;
        else if (inSet(data.mammal,item) === true || inSet(data.reptile,item) === true) value = false;
      }
      if (group === "birds") value = inSet(data.flightless,item) === true ? false : true;
    } else if (intent === "bird") {
      if (group === "animals") value = inSet(data.bird,item);
      if (group === "birds") value = true;
    } else if (intent === "mammal") {
      if (group === "animals") value = inSet(data.mammal,item);
      if (group === "sea") value = inSet(data.mammal,item);
    } else if (intent === "reptile") {
      if (group === "animals") value = inSet(data.reptile,item);
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
        value = allKnown.has(secret) ? inSet(selected,item) : null;
      }
    } else if (intent.startsWith("instrument")) {
      if (group === "instruments") {
        const key = intent.slice("instrument".length).toLowerCase();
        const selected = data[key];
        const allKnown = new Set(Object.values(data).flatMap(set=>[...set]));
        value = allKnown.has(secret) ? inSet(selected,item) : null;
      }
    } else if (["teamSport","individualSport","waterSport","combatSport"].includes(intent)) {
      if (group === "sports") {
        const key = {teamSport:"team",individualSport:"individual",waterSport:"water",combatSport:"combat"}[intent];
        const selected = data[key];
        const allKnown = new Set(Object.values(data).flatMap(set=>[...set]));
        value = allKnown.has(secret) ? inSet(selected,item) : null;
      }
    } else if (intent.startsWith("is") === false && ["france","egypt","uae","china","india","italy","jordan","iraq","uk","peru","usa","saudi","brazil","cambodia"].includes(intent)) {
      if (group === "landmarks") { const known = new Set(Object.values(data).flatMap(set => [...set])); value = known.has(secret) ? inSet(data[intent],item) : null; }
    }

    if (value === null || value === undefined) {
      return { answer: UNKNOWN, known: false, source: "local-curated-facts", intent: intent || null };
    }
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
    getProfile: category => profiles[category] || null,
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