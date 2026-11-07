(() => {
  "use strict";

  // The category pool is mirrored from app.js and checked for exact parity by test-who-ai.js.
  // Keep this registry authoritative for validating secrets before any yes/no answer is returned.
  const categoryItems = Object.freeze({
    "الحيوانات": ["بطة","بقرة","أسد","فيل","زرافة","بطريق","دلفين","نمر","قطة","كلب","ذئب","حصان","كنغر","تمساح","بومة","فهد","دب قطبي","ثعلب","غوريلا","باندا","سلحفاة","أرنب","خفاش","قرد","جمل","غزال","ضبع","ماعز","خروف","حمار"],
    "الدول": ["العراق","مصر","اليابان","البرازيل","إيطاليا","كندا","المغرب","تركيا","أستراليا","الهند","الأرجنتين","إسبانيا","فرنسا","ألمانيا","المكسيك","السعودية","الأردن","تونس","كوريا الجنوبية","النرويج","إندونيسيا","جنوب أفريقيا","الصين","روسيا","البرتغال","اليونان"],
    "المصارعين": ["أندرتيكر","جون سينا","رومان رينز","ذا روك","ستون كولد","باتيستا","تريبل إتش","راندي أورتن","سي إم بانك","شون مايكلز","غولدبيرغ","إيدج","ري ميستيريو","بروك ليسنر","كودي رودز","كين","براي وايت","درو ماكنتاير","إيه جاي ستايلز","سيث رولينز","كيفن أوينز","فين بالور","بوكر تي"],
    "لاعبو كرة القدم": ["ليونيل ميسي","كريستيانو رونالدو","نيمار","محمد صلاح","كيليان مبابي","زين الدين زيدان","رونالدينيو","رونالدو نازاريو","لوكا مودريتش","إيرلينغ هالاند","جود بيلينغهام","سالم الدوسري","يونس محمود","علي عدنان","أندريس إنييستا","تشافي","كريم بنزيما","سيرجيو راموس","روبرت ليفاندوفسكي","كيفن دي بروين","هاري كين","رياض محرز","أشرف حكيمي","سون هيونغ مين"],
    "شخصيات الألعاب": ["كراتوس","ماريو","سونيك","لارا كروفت","ماستر شيف","سبايدرمان","آرثر مورغان","جون مارستون","ناثان دريك","ليون كينيدي","جيرالت","إيزيـو أوديتوري","سكوربيون","رايدن","سوليد سنيك","كراش بانديكوت","باك مان","سيفيرووث","آشلي غراهام","ألوي","سبيكتر","ليتل ماك","دوم سلاير"],
    "الأفلام": ["جوكر","دارث فيدر","جاك سبارو","باتمان","شيرلوك هولمز","هاري بوتر","إنديانا جونز","فورست غامب","روكي بالبوا","جون ويك","سبايدرمان","آيرون مان","ثور","كابتن أمريكا","شريك","وودي","إلسا","نيمو","مستر بين","رامبو","تيرميناتور","كينغ كونغ","غودزيلا","هالك"],
    "الأنمي": ["ناروتو","غوكو","لوفي","زورو","إيرين","ليفاي","إيتاتشي","ساسكي","كاكاشي","غوجو ساتورو","تانجيرو","نيزوكو","لايت ياغامي","إل","إدوارد إلريك","كيلوا","غون","سايتاما","ميكاسا","ريوك","إينوسكي","زينيتسو","روك لي","مادارا","بروك"],
    "السيارات": ["لامبورغيني","فيراري","تويوتا","مرسيدس","جيب رانجلر","نيسان جي تي آر","BMW","أودي","بورشه","رولز رويس","فورد موستانغ","شيفروليه كامارو","تسلا","هوندا","لكزس","ماكلارين","هيونداي","كيا","فولكس فاغن","دودج تشارجر","سوبارو","مازدا","فولفو","بنتلي"],
    "الأكلات": ["دولمة","برياني","بيتزا","كبسة","تشريب","سوشي","برغر","مسكوف","كبة","باجة","منسف","تبولة","فلافل","شاورما","بقلاوة","كليجة","تشريب لحم","مقلوبة","قوزي","قيمة","كباب","فطائر","معكرونة","آيس كريم"],
    "الطيور": ["صقر","نسر","بومة","ببغاء","غراب","حمامة","طاووس","نعامة","بطّة","دجاجة","هدهد","كناري","لقلق","فلامنغو","نورس","عقاب","عصفور","ديك","إوزة","بجعة","نقّار الخشب","سنونو","كوكاتو","كيوي"],
    "كائنات البحر": ["قرش","حوت أزرق","أخطبوط","حبار","فرس البحر","نجم البحر","قنديل البحر","سلطعون","روبيان","فقمة","أوركا","سمكة المهرج","مانتا","ثعبان البحر","محار","خيار البحر","دلفين","سردين","تونة","سمكة أبو سيف","كركند","قنفذ البحر","سمكة قرش المطرقة","الحوت الأحدب"],
    "الأبطال الخارقون": ["سوبرمان","باتمان","سبايدرمان","آيرون مان","ثور","هالك","ووندر وومن","فلاش","أكوامان","بلاك بانثر","دكتور سترينج","ديدبول","وولفرين","كابتن أمريكا","ثانوس","لوكي","كابتن مارفل","آنت مان","هوك آي","بلاك ويدو","فينوم","غرين لانترن","شازام","ريد هود"],
    "المهن": ["طبيب","مهندس","طيّار","شرطي","إطفائي","معلّم","طباخ","مزارع","مصور","محقق","ممرض","ميكانيكي","لاعب كرة","مذيع","نجّار","صياد","خبّاز","كهربائي","سبّاك","محامي","قاضٍ","سائق","حلاق","مبرمج"],
    "المعالم": ["برج إيفل","الأهرامات","برج خليفة","سور الصين العظيم","تمثال الحرية","تاج محل","الكولوسيوم","البتراء","زقورة أور","ساعة بيغ بن","ماتشو بيتشو","أبو الهول","برج بيزا","الكعبة","شلالات نياگرا","دار الأوبرا","تمثال المسيح الفادي","قصر الحمراء","مسجد قرطبة","أيا صوفيا","جبل إيفرست","معبد أنغكور وات","جزيرة الفصح","قصر فرساي"],
    "الفواكه": ["تفاح","موز","برتقال","رمان","مانجو","عنب","بطيخ","فراولة","أناناس","كيوي","خوخ","مشمش","تين","تمر","كمثرى","كرز","ليمون","جوافة","بابايا","شمام","توت","أفوكادو","برقوق","جوز الهند"],
    "الآلات الموسيقية": ["عود","گيتار","بيانو","كمان","ناي","طبلة","قانون","ساكسفون","أكورديون","مزمار","تشيلو","ترومبيت","دف","قيثارة","هارمونيكا","بزق","ربابة","كونترباص","فلوت","كلارينيت","ترومبون","بوق","سنطور","غيتار باس"],
    "الرياضات": ["كرة القدم","كرة السلة","التنس","الملاكمة","المصارعة","السباحة","الجمباز","كرة الطائرة","الكريكيت","الفورمولا 1","رفع الأثقال","المبارزة","الرماية","ركوب الدراجات","الجودو","التايكواندو","كرة اليد","كرة الريشة","البيسبول","الغولف","التزلج","الرجبي","الاسكواش","تنس الطاولة"],
    "شخصيات تاريخية": ["صلاح الدين الأيوبي","ابن سينا","الخوارزمي","كليوباترا","الإسكندر الأكبر","نابليون","ليوناردو دا فينشي","أينشتاين","غاليليو","ابن بطوطة","هانيبال","جوليوس قيصر","ماري كوري","نيلسون مانديلا","تشرشل","توت عنخ آمون","أرسطو","أفلاطون","ابن خلدون","عمر الخيام","ماركو بولو","فنسنت فان غوخ","مارتن لوثر كينغ","غاندي"]
  });

  const entityAliases = Object.freeze({
    "الحيوانات": { "ذئب رمادي": "ذئب", "أرنب أوروبي": "أرنب" },
    "الطيور": { "بطّة": "بطّة" },
    "السيارات": { "بي ام دبليو": "BMW", "بي إم دبليو": "BMW" },
    "شخصيات الألعاب": { "ماستر تشيف": "ماستر شيف", "ايزيو اوديتوري": "إيزيـو أوديتوري" },
    "الأنمي": { "ال دي": "إل" }
  });

  const set = values => new Set(values);
  const all = values => set(values);

  const additionalFacts = {
    wrestlers: {
      originKnown: all(["جون سينا","رومان رينز","ذا روك","سيث رولينز","كودي رودز","كيفن أوينز","فين بالور","درو ماكنتاير"]),
      usa: all(["جون سينا","رومان رينز","ذا روك","سيث رولينز","كودي رودز"]),
      canada: all(["كيفن أوينز"]),
      ireland: all(["فين بالور"]),
      scotland: all(["درو ماكنتاير"])
    },
    footballers: {
      originKnown: all(["ليونيل ميسي","كريستيانو رونالدو","نيمار","محمد صلاح","كيليان مبابي","زين الدين زيدان","رونالدينيو","رونالدو نازاريو","لوكا مودريتش","إيرلينغ هالاند","جود بيلينغهام","سالم الدوسري","يونس محمود","علي عدنان","أندريس إنييستا","تشافي","كريم بنزيما","سيرجيو راموس","روبرت ليفاندوفسكي","كيفن دي بروين","هاري كين","رياض محرز","أشرف حكيمي","سون هيونغ مين"]),
      argentina: all(["ليونيل ميسي"]),
      portugal: all(["كريستيانو رونالدو"]),
      brazil: all(["نيمار","رونالدينيو","رونالدو نازاريو"]),
      egypt: all(["محمد صلاح"]),
      france: all(["كيليان مبابي","زين الدين زيدان","كريم بنزيما"]),
      croatia: all(["لوكا مودريتش"]),
      norway: all(["إيرلينغ هالاند"]),
      england: all(["جود بيلينغهام","هاري كين"]),
      saudi: all(["سالم الدوسري"]),
      iraq: all(["يونس محمود","علي عدنان"]),
      spain: all(["أندريس إنييستا","تشافي","سيرجيو راموس"]),
      poland: all(["روبرت ليفاندوفسكي"]),
      belgium: all(["كيفن دي بروين"]),
      algeria: all(["رياض محرز"]),
      morocco: all(["أشرف حكيمي"]),
      southKorea: all(["سون هيونغ مين"])
    },
    cars: {
      originKnown: all(["لامبورغيني","فيراري","تويوتا","مرسيدس","جيب رانجلر","نيسان جي تي آر","BMW","أودي","بورشه","رولز رويس","فورد موستانغ","شيفروليه كامارو","تسلا","هوندا","لكزس","ماكلارين","هيونداي","كيا","فولكس فاغن","دودج تشارجر","سوبارو","مازدا","فولفو","بنتلي"]),
      japanese: all(["تويوتا","نيسان جي تي آر","هوندا","لكزس","سوبارو","مازدا"]),
      german: all(["مرسيدس","BMW","أودي","بورشه","فولكس فاغن"]),
      italian: all(["لامبورغيني","فيراري"]),
      american: all(["جيب رانجلر","فورد موستانغ","شيفروليه كامارو","تسلا","دودج تشارجر"]),
      british: all(["رولز رويس","ماكلارين","بنتلي"]),
      southKorean: all(["هيونداي","كيا"]),
      swedish: all(["فولفو"])
    },
    gameCharacters: {
      franchiseKnown: all(["كراتوس","ماريو","سونيك","لارا كروفت","ماستر شيف","سبايدرمان","آرثر مورغان","جون مارستون","ناثان دريك","ليون كينيدي","جيرالت","إيزيـو أوديتوري","سكوربيون","رايدن","سوليد سنيك","كراش بانديكوت","باك مان","سيفيرووث","آشلي غراهام","ألوي","ليتل ماك","دوم سلاير"]),
      godOfWar: all(["كراتوس"]),
      mario: all(["ماريو"]),
      sonic: all(["سونيك"]),
      tombRaider: all(["لارا كروفت"]),
      halo: all(["ماستر شيف"]),
      marvel: all(["سبايدرمان"]),
      redDead: all(["آرثر مورغان","جون مارستون"]),
      uncharted: all(["ناثان دريك"]),
      residentEvil: all(["ليون كينيدي","آشلي غراهام"]),
      witcher: all(["جيرالت"]),
      assassinsCreed: all(["إيزيـو أوديتوري"]),
      mortalKombat: all(["سكوربيون","رايدن"]),
      metalGear: all(["سوليد سنيك"]),
      crash: all(["كراش بانديكوت"]),
      pacman: all(["باك مان"]),
      finalFantasy: all(["سيفيرووث"]),
      horizon: all(["ألوي"]),
      doom: all(["دوم سلاير"]),
      punchOut: all(["ليتل ماك"])
    },
    filmCharacters: {
      franchiseKnown: all(["جوكر","دارث فيدر","جاك سبارو","باتمان","شيرلوك هولمز","هاري بوتر","إنديانا جونز","فورست غامب","روكي بالبوا","جون ويك","سبايدرمان","آيرون مان","ثور","كابتن أمريكا","شريك","وودي","إلسا","نيمو","مستر بين","رامبو","تيرميناتور","كينغ كونغ","غودزيلا","هالك"]),
      dc: all(["جوكر","باتمان"]),
      starWars: all(["دارث فيدر"]),
      pirates: all(["جاك سبارو"]),
      sherlock: all(["شيرلوك هولمز"]),
      harryPotter: all(["هاري بوتر"]),
      indianaJones: all(["إنديانا جونز"]),
      forrestGump: all(["فورست غامب"]),
      rocky: all(["روكي بالبوا"]),
      johnWick: all(["جون ويك"]),
      marvel: all(["سبايدرمان","آيرون مان","ثور","كابتن أمريكا","هالك"]),
      shrek: all(["شريك"]),
      toyStory: all(["وودي"]),
      frozen: all(["إلسا"]),
      findingNemo: all(["نيمو"]),
      mrBean: all(["مستر بين"]),
      rambo: all(["رامبو"]),
      terminator: all(["تيرميناتور"]),
      kingKong: all(["كينغ كونغ"]),
      godzilla: all(["غودزيلا"])
    },
    animeCharacters: {
      franchiseKnown: all(["ناروتو","غوكو","لوفي","زورو","إيرين","ليفاي","إيتاتشي","ساسكي","كاكاشي","غوجو ساتورو","تانجيرو","نيزوكو","لايت ياغامي","إل","إدوارد إلريك","كيلوا","غون","سايتاما","ميكاسا","ريوك","إينوسكي","زينيتسو","روك لي","مادارا","بروك"]),
      naruto: all(["ناروتو","إيتاتشي","ساسكي","كاكاشي","روك لي","مادارا"]),
      dragonBall: all(["غوكو"]),
      onePiece: all(["لوفي","زورو","بروك"]),
      attackOnTitan: all(["إيرين","ليفاي","ميكاسا"]),
      demonSlayer: all(["تانجيرو","نيزوكو","إينوسكي","زينيتسو"]),
      deathNote: all(["لايت ياغامي","إل","ريوك"]),
      fullmetalAlchemist: all(["إدوارد إلريك"]),
      hunterXHunter: all(["كيلوا","غون"]),
      onePunchMan: all(["سايتاما"]),
      jujutsuKaisen: all(["غوجو ساتورو"])
    },
    superheroes: {
      universeKnown: all(["سوبرمان","باتمان","سبايدرمان","آيرون مان","ثور","هالك","ووندر وومن","فلاش","أكوامان","بلاك بانثر","دكتور سترينج","ديدبول","وولفرين","كابتن أمريكا","ثانوس","لوكي","كابتن مارفل","آنت مان","هوك آي","بلاك ويدو","فينوم","غرين لانترن","شازام","ريد هود"]),
      marvel: all(["سبايدرمان","آيرون مان","ثور","هالك","بلاك بانثر","دكتور سترينج","ديدبول","وولفرين","كابتن أمريكا","ثانوس","لوكي","كابتن مارفل","آنت مان","هوك آي","بلاك ويدو","فينوم"]),
      dc: all(["سوبرمان","باتمان","ووندر وومن","فلاش","أكوامان","غرين لانترن","شازام","ريد هود"])
    },
    professions: {
      fieldKnown: all(["طبيب","مهندس","طيّار","شرطي","إطفائي","معلّم","طباخ","مزارع","مصور","محقق","ممرض","ميكانيكي","لاعب كرة","مذيع","نجّار","صياد","خبّاز","كهربائي","سبّاك","محامي","قاضٍ","سائق","حلاق","مبرمج"]),
      medical: all(["طبيب","ممرض"]),
      engineering: all(["مهندس"]),
      publicSafety: all(["شرطي","إطفائي","محقق"]),
      education: all(["معلّم"]),
      food: all(["طباخ","خبّاز"]),
      agriculture: all(["مزارع","صياد"]),
      media: all(["مصور","مذيع"]),
      legal: all(["محامي","قاضٍ"]),
      transport: all(["طيّار","سائق"]),
      trades: all(["ميكانيكي","نجّار","كهربائي","سبّاك"]),
      technology: all(["مبرمج"]),
      sports: all(["لاعب كرة"]),
      personalCare: all(["حلاق"])
    },
    landmarks: {
      known: all(["برج إيفل","الأهرامات","برج خليفة","سور الصين العظيم","تمثال الحرية","تاج محل","الكولوسيوم","البتراء","زقورة أور","ساعة بيغ بن","ماتشو بيتشو","أبو الهول","برج بيزا","الكعبة","شلالات نياگرا","تمثال المسيح الفادي","قصر الحمراء","مسجد قرطبة","أيا صوفيا","جبل إيفرست","معبد أنغكور وات","جزيرة الفصح","قصر فرساي"]),
      spain: all(["قصر الحمراء","مسجد قرطبة"]),
      canada: all(["شلالات نياگرا"]),
      turkey: all(["أيا صوفيا"]),
      nepal: all(["جبل إيفرست"]),
      chile: all(["جزيرة الفصح"])
    },
    historical: {
      fieldKnown: all(["صلاح الدين الأيوبي","ابن سينا","الخوارزمي","كليوباترا","الإسكندر الأكبر","نابليون","ليوناردو دا فينشي","أينشتاين","غاليليو","ابن بطوطة","هانيبال","جوليوس قيصر","ماري كوري","نيلسون مانديلا","تشرشل","توت عنخ آمون","أرسطو","أفلاطون","ابن خلدون","عمر الخيام","ماركو بولو","فنسنت فان غوخ","مارتن لوثر كينغ","غاندي"]),
      scientist: all(["ابن سينا","الخوارزمي","أينشتاين","غاليليو","ماري كوري"]),
      philosopher: all(["ابن سينا","أرسطو","أفلاطون","ابن خلدون","عمر الخيام"]),
      ruler: all(["كليوباترا","الإسكندر الأكبر","نابليون","جوليوس قيصر","توت عنخ آمون"]),
      explorer: all(["ابن بطوطة","ماركو بولو"]),
      artist: all(["ليوناردو دا فينشي","فنسنت فان غوخ"]),
      militaryLeader: all(["صلاح الدين الأيوبي","الإسكندر الأكبر","نابليون","هانيبال","جوليوس قيصر"]),
      civilRightsLeader: all(["نيلسون مانديلا","مارتن لوثر كينغ","غاندي"]),
      politicalLeader: all(["نيلسون مانديلا","تشرشل","غاندي"])
    }
  };

  const factIntents = {};
  const intentPatterns = [];
  function addIntent(name, phrases, categoryEntries) {
    factIntents[name] = Object.freeze(categoryEntries);
    intentPatterns.push([name, phrases]);
  }

  const originPatterns = {
    originIraq: ["من العراق","عراقي","عراقية","موطنه العراق"],
    originArgentina: ["من الأرجنتين","أرجنتيني","أرجنتينية"],
    originPortugal: ["من البرتغال","برتغالي","برتغالية"],
    originBrazil: ["من البرازيل","برازيلي","برازيلية"],
    originEgypt: ["من مصر","مصري","مصرية"],
    originFrance: ["من فرنسا","فرنسي","فرنسية"],
    originCroatia: ["من كرواتيا","كرواتي","كرواتية"],
    originNorway: ["من النرويج","نرويجي","نرويجية"],
    originEngland: ["من إنجلترا","من انجلترا","إنجليزي","انجليزي","إنجليزية","انجليزية"],
    originSaudi: ["من السعودية","سعودي","سعودية"],
    originSpain: ["من إسبانيا","من اسبانيا","إسباني","اسباني","إسبانية","اسبانية"],
    originPoland: ["من بولندا","بولندي","بولندية"],
    originBelgium: ["من بلجيكا","بلجيكي","بلجيكية"],
    originAlgeria: ["من الجزائر","جزائري","جزائرية"],
    originMorocco: ["من المغرب","مغربي","مغربية"],
    originSouthKorea: ["من كوريا الجنوبية","كوري جنوبي","كورية جنوبية"],
    originUSA: ["من أمريكا","من امريكا","أمريكي","امريكي","أمريكية","امريكية","من الولايات المتحدة"],
    originCanada: ["من كندا","كندي","كندية"],
    originIreland: ["من أيرلندا","من ايرلندا","أيرلندي","ايرلندي","أيرلندية","ايرلندية"],
    originScotland: ["من اسكتلندا","اسكتلندي","اسكتلندية"],
    originJapan: ["من اليابان","ياباني","يابانية"],
    originGermany: ["من ألمانيا","من المانيا","ألماني","الماني","ألمانية","المانية"],
    originItaly: ["من إيطاليا","من ايطاليا","إيطالي","ايطالي","إيطالية","ايطالية"],
    originUK: ["من بريطانيا","بريطاني","بريطانية","من المملكة المتحدة"],
    originSweden: ["من السويد","سويدي","سويدية"]
  };

  const originGroups = {
    originIraq: ["لاعبو كرة القدم"],
    originArgentina: ["لاعبو كرة القدم"],
    originPortugal: ["لاعبو كرة القدم"],
    originBrazil: ["لاعبو كرة القدم"],
    originEgypt: ["لاعبو كرة القدم"],
    originFrance: ["لاعبو كرة القدم"],
    originCroatia: ["لاعبو كرة القدم"],
    originNorway: ["لاعبو كرة القدم"],
    originEngland: ["لاعبو كرة القدم"],
    originSaudi: ["لاعبو كرة القدم"],
    originSpain: ["لاعبو كرة القدم"],
    originPoland: ["لاعبو كرة القدم"],
    originBelgium: ["لاعبو كرة القدم"],
    originAlgeria: ["لاعبو كرة القدم"],
    originMorocco: ["لاعبو كرة القدم"],
    originSouthKorea: ["لاعبو كرة القدم","السيارات"],
    originUSA: ["المصارعين","السيارات"],
    originCanada: ["المصارعين"],
    originIreland: ["المصارعين"],
    originScotland: ["المصارعين"],
    originJapan: ["السيارات"],
    originGermany: ["السيارات"],
    originItaly: ["السيارات"],
    originUK: ["السيارات"],
    originSweden: ["السيارات"]
  };

  const originKeys = {
    originIraq:"iraq", originArgentina:"argentina", originPortugal:"portugal",
    originBrazil:"brazil", originEgypt:"egypt", originFrance:"france",
    originCroatia:"croatia", originNorway:"norway", originEngland:"england",
    originSaudi:"saudi", originSpain:"spain", originPoland:"poland",
    originBelgium:"belgium", originAlgeria:"algeria", originMorocco:"morocco",
    originSouthKorea:"southKorea", originUSA:"usa", originCanada:"canada",
    originIreland:"ireland", originScotland:"scotland", originJapan:"japanese",
    originGermany:"german", originItaly:"italian", originUK:"british",
    originSweden:"swedish"
  };

  for (const [intent, phrases] of Object.entries(originPatterns)) {
    const entries = {};
    for (const category of originGroups[intent] || []) {
      const group = category === "لاعبو كرة القدم" ? "footballers" : category === "المصارعين" ? "wrestlers" : "cars";
      entries[category] = { group, key: originKeys[intent], knownKey: "originKnown", label: "بلد المنشأ أو الجنسية" };
    }
    addIntent(intent, phrases, entries);
  }

  const franchiseDefinitions = [
    ["gameGodOfWar", ["من لعبة god of war","god of war","كاد اوف وار","كود اوف وار"], "شخصيات الألعاب", "gameCharacters", "godOfWar"],
    ["gameMario", ["من لعبة ماريو","ماريو"], "شخصيات الألعاب", "gameCharacters", "mario"],
    ["gameSonic", ["من لعبة سونيك","سونيك"], "شخصيات الألعاب", "gameCharacters", "sonic"],
    ["gameTombRaider", ["تومب رايدر","tomb raider"], "شخصيات الألعاب", "gameCharacters", "tombRaider"],
    ["gameHalo", ["هالو","halo","ماستر شيف"], "شخصيات الألعاب", "gameCharacters", "halo"],
    ["gameRedDead", ["ريد ديد","red dead","ريد ديد ريدمبشن"], "شخصيات الألعاب", "gameCharacters", "redDead"],
    ["gameUncharted", ["انشارتد","uncharted"], "شخصيات الألعاب", "gameCharacters", "uncharted"],
    ["gameResidentEvil", ["ريزدنت ايفل","رزدنت ايفل","resident evil"], "شخصيات الألعاب", "gameCharacters", "residentEvil"],
    ["gameWitcher", ["ويتشر","the witcher"], "شخصيات الألعاب", "gameCharacters", "witcher"],
    ["gameAssassinsCreed", ["اساسنز كريد","اساسينز كريد","assassins creed"], "شخصيات الألعاب", "gameCharacters", "assassinsCreed"],
    ["gameMortalKombat", ["مورتال كومبات","mortal kombat"], "شخصيات الألعاب", "gameCharacters", "mortalKombat"],
    ["gameMetalGear", ["ميتل غير","ميتال غير","metal gear"], "شخصيات الألعاب", "gameCharacters", "metalGear"],
    ["gameCrash", ["كراش بانديكوت","crash bandicoot"], "شخصيات الألعاب", "gameCharacters", "crash"],
    ["gamePacman", ["باك مان","باكمان","pac man","pac-man"], "شخصيات الألعاب", "gameCharacters", "pacman"],
    ["gameFinalFantasy", ["فاينل فانتسي","final fantasy"], "شخصيات الألعاب", "gameCharacters", "finalFantasy"],
    ["gameHorizon", ["هورايزن","horizon"], "شخصيات الألعاب", "gameCharacters", "horizon"],
    ["gameDoom", ["دووم","doom"], "شخصيات الألعاب", "gameCharacters", "doom"],
    ["gamePunchOut", ["بانش اوت","punch out"], "شخصيات الألعاب", "gameCharacters", "punchOut"],
    ["filmStarWars", ["ستار وورز","حرب النجوم","star wars"], "الأفلام", "filmCharacters", "starWars"],
    ["filmPirates", ["قراصنة الكاريبي","pirates of the caribbean"], "الأفلام", "filmCharacters", "pirates"],
    ["filmSherlock", ["شيرلوك هولمز","شيرلوك","sherlock holmes"], "الأفلام", "filmCharacters", "sherlock"],
    ["filmHarryPotter", ["هاري بوتر","harry potter"], "الأفلام", "filmCharacters", "harryPotter"],
    ["filmIndianaJones", ["انديانا جونز","indiana jones"], "الأفلام", "filmCharacters", "indianaJones"],
    ["filmForrestGump", ["فورست غامب","forrest gump"], "الأفلام", "filmCharacters", "forrestGump"],
    ["filmRocky", ["روكي بالبوا","روكي","rocky"], "الأفلام", "filmCharacters", "rocky"],
    ["filmJohnWick", ["جون ويك","john wick"], "الأفلام", "filmCharacters", "johnWick"],
    ["filmShrek", ["شريك","shrek"], "الأفلام", "filmCharacters", "shrek"],
    ["filmToyStory", ["توي ستوري","قصة لعبة","toy story"], "الأفلام", "filmCharacters", "toyStory"],
    ["filmFrozen", ["فروزن","ملكة الثلج","frozen"], "الأفلام", "filmCharacters", "frozen"],
    ["filmFindingNemo", ["البحث عن نيمو","finding nemo"], "الأفلام", "filmCharacters", "findingNemo"],
    ["filmMrBean", ["مستر بين","mr bean"], "الأفلام", "filmCharacters", "mrBean"],
    ["filmRambo", ["رامبو","rambo"], "الأفلام", "filmCharacters", "rambo"],
    ["filmTerminator", ["ترميناتور","المدمر","terminator"], "الأفلام", "filmCharacters", "terminator"],
    ["filmKingKong", ["كينغ كونغ","king kong"], "الأفلام", "filmCharacters", "kingKong"],
    ["filmGodzilla", ["غودزيلا","جودزيلا","godzilla"], "الأفلام", "filmCharacters", "godzilla"],
    ["animeNaruto", ["ناروتو","naruto"], "الأنمي", "animeCharacters", "naruto"],
    ["animeDragonBall", ["دراغون بول","دراجون بول","dragon ball"], "الأنمي", "animeCharacters", "dragonBall"],
    ["animeOnePiece", ["ون بيس","one piece"], "الأنمي", "animeCharacters", "onePiece"],
    ["animeAttackOnTitan", ["هجوم العمالقة","اتاك اون تايتن","attack on titan"], "الأنمي", "animeCharacters", "attackOnTitan"],
    ["animeDemonSlayer", ["قاتل الشياطين","كيميتسو نو يايبا","demon slayer"], "الأنمي", "animeCharacters", "demonSlayer"],
    ["animeDeathNote", ["ديث نوت","death note"], "الأنمي", "animeCharacters", "deathNote"],
    ["animeFullmetal", ["الخيميائي الفولاذي","فول ميتال","fullmetal alchemist"], "الأنمي", "animeCharacters", "fullmetalAlchemist"],
    ["animeHunter", ["هنتر اكس هنتر","هانتر اكس هانتر","hunter x hunter"], "الأنمي", "animeCharacters", "hunterXHunter"],
    ["animeOnePunch", ["ون بنش مان","one punch man"], "الأنمي", "animeCharacters", "onePunchMan"],
    ["animeJujutsu", ["جوجوتسو كايسن","jujutsu kaisen"], "الأنمي", "animeCharacters", "jujutsuKaisen"]
  ];
  for (const [intent, phrases, category, group, key] of franchiseDefinitions) {
    const knownKey = group === "gameCharacters" ? "franchiseKnown" : group === "filmCharacters" ? "franchiseKnown" : "franchiseKnown";
    addIntent(intent, phrases, { [category]: { group, key, knownKey, label: category } });
  }

  addIntent("marvel", ["من مارفل","عالم مارفل","مارفل","marvel"], {
    "الأبطال الخارقون": { group:"superheroes", key:"marvel", knownKey:"universeKnown", label:"الأبطال الخارقون" },
    "الأفلام": { group:"filmCharacters", key:"marvel", knownKey:"franchiseKnown", label:"شخصيات الأفلام" },
    "شخصيات الألعاب": { group:"gameCharacters", key:"marvel", knownKey:"franchiseKnown", label:"شخصيات الألعاب" }
  });
  addIntent("dc", ["من دي سي","عالم دي سي","دي سي","dc","dc comics"], {
    "الأبطال الخارقون": { group:"superheroes", key:"dc", knownKey:"universeKnown", label:"الأبطال الخارقون" },
    "الأفلام": { group:"filmCharacters", key:"dc", knownKey:"franchiseKnown", label:"شخصيات الأفلام" }
  });

  const professionDefinitions = [
    ["professionMedical", ["من المهن الطبية","مهنة طبية","بالمجال الطبي","يعالج المرضى"], "medical"],
    ["professionEngineering", ["من الهندسة","مجال هندسي","بالهندسة"], "engineering"],
    ["professionPublicSafety", ["بالأمن","السلامة العامة","يحمي الناس","الشرطة والإطفاء"], "publicSafety"],
    ["professionEducation", ["بالتعليم","بالتدريس","يدرّس","يعلم الطلاب"], "education"],
    ["professionFood", ["بالطبخ","تحضير الطعام","بالمطبخ","مهنة غذائية"], "food"],
    ["professionAgriculture", ["بالزراعة","بالمزرعة","صيد السمك","يعمل بالزراعة"], "agriculture"],
    ["professionMedia", ["بالإعلام","بالتصوير","يقدم الأخبار","مجال إعلامي"], "media"],
    ["professionLegal", ["بالقانون","بالمحاكم","مهنة قانونية","قضائي"], "legal"],
    ["professionTransport", ["بالنقل","يقود الطائرات","يقود المركبات","مجال النقل"], "transport"],
    ["professionTrades", ["حرفة يدوية","أعمال الصيانة","الصيانة والإصلاح","حرفي"], "trades"],
    ["professionTechnology", ["بالبرمجة","تقنية المعلومات","تطوير البرمجيات","مجال التقنية"], "technology"],
    ["professionSports", ["رياضي محترف","مهنة رياضية","يلعب كرة القدم كمهنة"], "sports"],
    ["professionPersonalCare", ["العناية الشخصية","حلاقة الشعر","يشتغل بالحلاقة"], "personalCare"]
  ];
  for (const [intent, phrases, key] of professionDefinitions) {
    addIntent(intent, phrases, { "المهن": { group:"professions", key, knownKey:"fieldKnown", label:"مجالات المهن" } });
  }

  const historyDefinitions = [
    ["historicalScientist", ["عالم","عالمة","من العلماء","عالم في العلوم"], "scientist"],
    ["historicalPhilosopher", ["فيلسوف","فيلسوفة","من الفلاسفة"], "philosopher"],
    ["historicalRuler", ["حاكم","ملكة","ملك","فرعون","من الحكام"], "ruler"],
    ["historicalExplorer", ["مستكشف","رحالة","من الرحالة"], "explorer"],
    ["historicalArtist", ["فنان","رسام","من الفنانين","يرسم اللوحات"], "artist"],
    ["historicalMilitary", ["قائد عسكري","قائد جيش","من القادة العسكريين"], "militaryLeader"],
    ["historicalCivilRights", ["حقوق مدنية","حقوق الإنسان","قائد حقوق مدنية","ناشط حقوقي"], "civilRightsLeader"],
    ["historicalPolitical", ["سياسي","رئيس وزراء","قائد سياسي","زعيم سياسي"], "politicalLeader"]
  ];
  for (const [intent, phrases, key] of historyDefinitions) {
    addIntent(intent, phrases, { "شخصيات تاريخية": { group:"historical", key, knownKey:"fieldKnown", label:"مجالات الشخصيات التاريخية" } });
  }


  addIntent("landmarkSpain", ["في إسبانيا","بإسبانيا","في اسبانيا","باسبانيا"], {
    "المعالم": { group:"landmarks", key:"spain", knownKey:"known", label:"موقع المعالم" }
  });
  addIntent("landmarkCanada", ["في كندا","بكندا","كندي الموقع"], {
    "المعالم": { group:"landmarks", key:"canada", knownKey:"known", label:"موقع المعالم" }
  });
  addIntent("landmarkTurkey", ["في تركيا","بتركيا","تركي الموقع"], {
    "المعالم": { group:"landmarks", key:"turkey", knownKey:"known", label:"موقع المعالم" }
  });
  addIntent("landmarkNepal", ["في نيبال","بنيبال"], {
    "المعالم": { group:"landmarks", key:"nepal", knownKey:"known", label:"موقع المعالم" }
  });
  addIntent("landmarkChile", ["في تشيلي","بتشيلي"], {
    "المعالم": { group:"landmarks", key:"chile", knownKey:"known", label:"موقع المعالم" }
  });

  const factSources = Object.freeze({
    countries: "https://unstats.un.org/unsd/methodology/m49/",
    landmarks: "https://whc.unesco.org/",
    fruits: "https://www.fao.org/4/y2515e/y2515e04.htm",
    instruments: "https://assets.cambridge.org/97811070/25165/frontmatter/9781107025165_frontmatter.pdf",
    wrestlers: "https://www.wwe.com/superstars/",
    footballers: "https://www.fifa.com/",
    superheroesMarvel: "https://www.marvel.com/characters/",
    superheroesDC: "https://www.dc.com/characters",
    gameCharacters: "https://www.playstation.com/en-us/games/god-of-war/",
    ezio: "https://www.ubisoft.com/en-US/game/assassins-creed/the-ezio-collection",
    residentEvil: "https://game.capcom.com/residentevil/",
    anime: "https://www.netflix.com/tudum/",
    professions: "https://www.onetonline.org/",
    historical: "https://www.britannica.com/biography/"
  });

  const api = Object.freeze({
    categoryItems,
    entityAliases,
    additionalFacts,
    factIntents,
    intentPatterns,
    factSources
  });

  globalThis.SuwadWhoKnowledge = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();