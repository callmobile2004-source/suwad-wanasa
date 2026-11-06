(() => {
  "use strict";
  const yes = "نعم";
  const no = "لا";
  const unknown = "ما عندي معلومة موثوقة عن هالسؤال؛ جرّب صياغة ثانية.";
  const normalize = value => String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[؟?!.،,:؛]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  const sets = {
    animals: {
      sea: new Set(["دلفين"]),
      seaNo: new Set(["بطة","بقرة","أسد","فيل","زرافة","نمر","قطة","كلب","ذئب","حصان","كنغر","فهد","ثعلب","غوريلا","باندا","أرنب","خفاش","قرد","جمل","غزال","ضبع","ماعز","خروف","حمار"]),
      water: new Set(["دلفين"]),
      waterNo: new Set(["بقرة","أسد","فيل","زرافة","نمر","قطة","كلب","ذئب","حصان","كنغر","فهد","دب قطبي","ثعلب","غوريلا","باندا","أرنب","خفاش","قرد","جمل","غزال","ضبع","ماعز","خروف","حمار"]),
      bird: new Set(["بطة","بطريق","بومة"]),
      fly: new Set(["بطة","بومة","خفاش"]),
      predator: new Set(["أسد","نمر","ذئب","تمساح","فهد","ثعلب","ضبع"]),
      domestic: new Set(["بقرة","قطة","كلب","حصان","ماعز","خروف","حمار","بطة"]),
      mammal: new Set(["أسد","فيل","زرافة","دلفين","نمر","قطة","كلب","ذئب","حصان","كنغر","فهد","دب قطبي","ثعلب","غوريلا","باندا","أرنب","خفاش","قرد","جمل","غزال","ضبع","ماعز","خروف","حمار"]),
      reptile: new Set(["تمساح","سلحفاة"]),
      // Game convention: adult body mass under 10 kg = small; 10–100 kg = medium; over 100 kg = large.
      // Only clearly named species / stable adult categories are classified. Broad names with major species or breed variation abstain.
      sizeSmall: new Set(["قطة","أرنب أوروبي"]),
      sizeMedium: new Set(["ذئب رمادي","ضبع مرقط"]),
      sizeLarge: new Set(["بقرة","أسد","فيل","زرافة","ببر بنغالي","تمساح المياه المالحة","دب قطبي","جمل","حصان عربي"])
    },
    birds: {
      flyNo: new Set(["بطريق","نعامة","كيوي"]),
      bird: new Set(["صقر","نسر","بومة","ببغاء","غراب","حمامة","طاووس","نعامة","بطّة","دجاجة","هدهد","كناري","لقلق","فلامنغو","نورس","عقاب","عصفور","ديك","إوزة","بجعة","نقّار الخشب","سنونو","كوكاتو","كيوي"])
    },
    countries: {
      arab: new Set(["العراق","مصر","المغرب","السعودية","الأردن","تونس"]),
      asia: new Set(["العراق","اليابان","تركيا","الهند","السعودية","الأردن","كوريا الجنوبية","إندونيسيا","الصين"]),
      europe: new Set(["إيطاليا","إسبانيا","فرنسا","ألمانيا","النرويج","البرتغال","اليونان"]),
      africa: new Set(["مصر","المغرب","تونس","جنوب أفريقيا"]),
      southAmerica: new Set(["البرازيل","الأرجنتين"]),
      northAmerica: new Set(["كندا","المكسيك"]),
      oceania: new Set(["أستراليا"])
    },
    cars: { electric: new Set(["تسلا"]) },
    foods: {
      iraqi: new Set(["دولمة","تشريب","مسكوف","كبة","باجة","كليجة","تشريب لحم","قوزي","قيمة"]),
      sweet: new Set(["بقلاوة","كليجة","آيس كريم"])
    },
    fruit: {
      red: new Set(["رمان","فراولة","كرز"]),
      citrus: new Set(["برتقال","ليمون"])
    }
  };

  const categoryKeys = {
    "الحيوانات":"animals", "الطيور":"birds", "الدول":"countries",
    "السيارات":"cars", "الأكلات":"foods", "الفواكه":"fruit"
  };

  function containsQuestion(q, words) { return words.some(word => q.includes(word)); }
  function answer(category, secret, question) {
    const q = normalize(question);
    const item = normalize(secret);
    const group = categoryKeys[category] || "";
    const inSet = (set) => [...set].some(value => normalize(value) === item);
    let result = null;

    const asksSmall = containsQuestion(q, ["صغير الحجم","صغيره الحجم","حجم صغير","صغير","صغيره"]);
    const asksLarge = containsQuestion(q, ["كبير الحجم","كبيره الحجم","حجم كبير","كبير","كبيره"]);
    const asksMedium = containsQuestion(q, ["متوسط الحجم","متوسطه الحجم","حجم متوسط","متوسط"]);
    const asksAnySize = containsQuestion(q, ["شنو حجمه","شنو حجمها","ما حجم","ما هو حجم","ما هو حجمه","ما هو حجمها","حجم الحيوان","حجمه شكد"]);
    if (group === "animals" && (asksSmall || asksLarge || asksMedium || asksAnySize)) {
      const sizes = [
        ["صغير", inSet(sets.animals.sizeSmall)],
        ["متوسط", inSet(sets.animals.sizeMedium)],
        ["كبير", inSet(sets.animals.sizeLarge)]
      ];
      const knownSize = sizes.filter(([, matches]) => matches);
      if (knownSize.length === 1) {
        const actualSize = knownSize[0][0];
        if (asksAnySize) result = "الحجم " + actualSize + ".";
        else if (asksMedium) result = actualSize === "متوسط" ? "نعم، الحجم متوسط." : "لا، الحجم " + actualSize + ".";
        else if (asksSmall) result = actualSize === "صغير" ? "نعم، الحجم صغير." : "لا، الحجم " + actualSize + ".";
        else if (asksLarge) result = actualSize === "كبير" ? "نعم، الحجم كبير." : "لا، الحجم " + actualSize + ".";
      }
      // Ambiguous and broadly named animals stay unknown; never guess a size or fall through to a generic animal answer.
    } else if (containsQuestion(q, ["دوله عربيه","عربيه","عربي"])) {
      if (group === "countries") result = inSet(sets.countries.arab) ? yes : no;
    } else if (containsQuestion(q, ["تقع في اسيا","في اسيا","اسيوي"])) {
      if (group === "countries") result = inSet(sets.countries.asia) ? yes : no;
    } else if (containsQuestion(q, ["تقع في اوروبا","في اوروبا","اوربي","اوربيه"])) {
      if (group === "countries") result = inSet(sets.countries.europe) ? yes : no;
    } else if (containsQuestion(q, ["في افريقيا","افريقي","افريقيه"])) {
      if (group === "countries") result = inSet(sets.countries.africa) ? yes : no;
    } else if (containsQuestion(q, ["في امريكا الجنوبيه","امريكا الجنوبيه"])) {
      if (group === "countries") result = inSet(sets.countries.southAmerica) ? yes : no;
    } else if (containsQuestion(q, ["في امريكا الشماليه","امريكا الشماليه"])) {
      if (group === "countries") result = inSet(sets.countries.northAmerica) ? yes : no;
    } else if (containsQuestion(q, ["في استراليا","اوقيانوسيا"])) {
      if (group === "countries") result = inSet(sets.countries.oceania) ? yes : no;
    } else if (containsQuestion(q, ["تعيش في البحر","يعيش في البحر","اعيش بالبحر","يعيش بالبحر","تعيش بالبحر","بالبحر","بحري","بحريه"])) {
      if (group === "animals") result = inSet(sets.animals.sea) ? yes : inSet(sets.animals.seaNo) ? no : null;
      if (group === "birds") result = null;
    } else if (containsQuestion(q, ["تعيش في الماء","يعيش في الماء","مائي"])) {
      if (group === "animals") result = inSet(sets.animals.water) ? yes : inSet(sets.animals.waterNo) ? no : null;
    } else if (containsQuestion(q, ["تطير","يطير","تقدر تطير","يقدر يطير","تستطيع الطيران","استطيع الطيران","اطير","عندها اجنحه","عنده اجنحه"])) {
      if (group === "animals") result = inSet(sets.animals.fly) ? yes : no;
      if (group === "birds") result = inSet(sets.birds.flyNo) ? no : yes;
    } else if (containsQuestion(q, ["طير","طائر","من الطيور"])) {
      if (group === "animals") result = inSet(sets.animals.bird) ? yes : no;
      if (group === "birds") result = yes;
    } else if (containsQuestion(q, ["مفترس","يصيد حيوانات"])) {
      if (group === "animals") result = inSet(sets.animals.predator) ? yes : no;
    } else if (containsQuestion(q, ["اليف","منزلي","نربيه بالبيت"])) {
      if (group === "animals") result = inSet(sets.animals.domestic) ? yes : no;
    } else if (containsQuestion(q, ["من الثدييات","ثديي"])) {
      if (group === "animals") result = inSet(sets.animals.mammal) ? yes : no;
    } else if (containsQuestion(q, ["من الزواحف","زاحف"])) {
      if (group === "animals") result = inSet(sets.animals.reptile) ? yes : no;
    } else if (containsQuestion(q, ["سياره كهربائيه","كهربائيه"])) {
      if (group === "cars") result = inSet(sets.cars.electric) ? yes : null;
    } else if (containsQuestion(q, ["اكله عراقيه","عراقيه"])) {
      if (group === "foods") result = inSet(sets.foods.iraqi) ? yes : no;
    } else if (containsQuestion(q, ["حلو","حلويات","حلوى"])) {
      if (group === "foods") result = inSet(sets.foods.sweet) ? yes : no;
    } else if (containsQuestion(q, ["فاكهه حمضيه","حمضي"])) {
      if (group === "fruit") result = inSet(sets.fruit.citrus) ? yes : no;
    } else if (containsQuestion(q, ["لونها احمر","احمر"])) {
      if (group === "fruit") result = inSet(sets.fruit.red) ? yes : null;
    } else if (containsQuestion(q, ["هل انت حيوان","هل هو حيوان","حيوان"])) {
      const animalCategories = ["الحيوانات","الطيور","كائنات البحر"];
      result = animalCategories.includes(category) ? yes : no;
    } else if (containsQuestion(q, ["هل انت دوله","هل هي دوله","دوله"])) {
      result = category === "الدول" ? yes : no;
    } else if (containsQuestion(q, ["هل انت شخصيه لعبه","شخصيه لعبه"])) {
      result = category === "شخصيات الألعاب" ? yes : no;
    } else if (containsQuestion(q, ["هل انت لاعب كره","لاعب كره قدم"])) {
      result = category === "لاعبو كرة القدم" ? yes : no;
    } else if (containsQuestion(q, ["هل انت مصارع","مصارع"])) {
      result = category === "المصارعين" ? yes : no;
    } else if (containsQuestion(q, ["هل انت فاكهه","فاكهه"])) {
      result = category === "الفواكه" ? yes : no;
    } else if (containsQuestion(q, ["هل انت مهنه","مهنه"])) {
      result = category === "المهن" ? yes : no;
    }

    return {
      answer: result || unknown,
      known: result !== null,
      source: "local-curated-facts"
    };
  }

  function mountHomeButtons() {
    const entries = [
      { selector: 'button[data-game="who"]', marker: "aiWhoPractice", label: "العب ضد أوراس 🤖", action: () => globalThis.startSuwadWhoPractice?.() },
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

  globalThis.SuwadWhoAI = Object.freeze({ answer });
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountHomeButtons);
    else mountHomeButtons();
  }
})();