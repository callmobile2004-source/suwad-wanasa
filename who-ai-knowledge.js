(() => {
  "use strict";

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
      .replace(/[ڤ]/g, "ف")
      .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
      .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
      .replace(/[؟?!.،,:؛()[\]{}"'`“”«»…؛\-–—/\\]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleLowerCase("ar");
  }

  function groupMap(groups) {
    const result = Object.create(null);
    for (const [value, names] of Object.entries(groups)) {
      for (const name of names) result[name] = value;
    }
    return result;
  }

  function boolMap(names, value = true) {
    return Object.fromEntries(names.map(name => [name, value]));
  }

  const SOURCES = Object.freeze({
    "الحيوانات": [{ label: "Smithsonian National Zoo", url: "https://nationalzoo.si.edu/animals" }],
    "الطيور": [{ label: "Smithsonian National Zoo", url: "https://nationalzoo.si.edu/animals" }],
    "كائنات البحر": [{ label: "NOAA Fisheries", url: "https://www.fisheries.noaa.gov/" }],
    "الدول": [{ label: "United Nations Statistics Division M49", url: "https://unstats.un.org/unsd/methodology/m49/" }],
    "المصارعين": [{ label: "WWE Superstar profiles", url: "https://www.wwe.com/superstars" }],
    "لاعبو كرة القدم": [{ label: "FIFA", url: "https://www.fifa.com/" }, { label: "Official club and national-team profiles", url: "https://www.fifa.com/players" }],
    "شخصيات الألعاب": [
      { label: "PlayStation game and character pages", url: "https://www.playstation.com/" },
      { label: "Nintendo character portal", url: "https://mario.nintendo.com/characters/" },
      { label: "Halo Waypoint", url: "https://www.halowaypoint.com/" },
      { label: "CAPCOM Resident Evil Portal", url: "https://game.capcom.com/residentevil/" }
    ],
    "الأفلام": [{ label: "Marvel official characters", url: "https://www.marvel.com/characters" }, { label: "Official DC characters", url: "https://www.dc.com/characters" }],
    "الأنمي": [{ label: "Official publishers and series portals", url: "https://www.shueisha.co.jp/" }],
    "السيارات": [{ label: "Official vehicle manufacturer websites", url: "https://www.toyota.com/" }],
    "الأكلات": [{ label: "FAO", url: "https://www.fao.org/" }, { label: "Official national tourism and cultural references", url: "https://www.unwto.org/" }],
    "الأبطال الخارقون": [{ label: "Marvel official characters", url: "https://www.marvel.com/characters" }, { label: "Official DC characters", url: "https://www.dc.com/characters" }],
    "المهن": [{ label: "U.S. Bureau of Labor Statistics Occupational Outlook Handbook", url: "https://www.bls.gov/ooh/" }],
    "المعالم": [{ label: "UNESCO World Heritage Centre", url: "https://whc.unesco.org/en/list/" }],
    "الفواكه": [{ label: "FAO", url: "https://www.fao.org/" }, { label: "USDA FoodData Central", url: "https://fdc.nal.usda.gov/" }],
    "الآلات الموسيقية": [{ label: "Cambridge Guide to Orchestration", url: "https://www.cambridge.org/" }],
    "الرياضات": [{ label: "International Olympic Committee", url: "https://olympics.com/ioc" }],
    "شخصيات تاريخية": [{ label: "Encyclopaedia Britannica biographies", url: "https://www.britannica.com/biographies" }]
  });

  const wrestlerNames = [
    "أندرتيكر","جون سينا","رومان رينز","ذا روك","ستون كولد","باتيستا","تريبل إتش","راندي أورتن",
    "سي إم بانك","شون مايكلز","غولدبيرغ","إيدج","ري ميستيريو","بروك ليسنر","كودي رودز","كين",
    "براي وايت","درو ماكنتاير","إيه جاي ستايلز","سيث رولينز","كيفن أوينز","فين بالور","بوكر تي"
  ];
  const footballers = [
    "ليونيل ميسي","كريستيانو رونالدو","نيمار","محمد صلاح","كيليان مبابي","زين الدين زيدان","رونالدينيو",
    "رونالدو نازاريو","لوكا مودريتش","إيرلينغ هالاند","جود بيلينغهام","سالم الدوسري","يونس محمود",
    "علي عدنان","أندريس إنييستا","تشافي","كريم بنزيما","سيرجيو راموس","روبرت ليفاندوفسكي",
    "كيفن دي بروين","هاري كين","رياض محرز","أشرف حكيمي","سون هيونغ مين"
  ];

  const DATA = {
    "المصارعين": {
      facts: {
        birthCountry: groupMap({
          "الولايات المتحدة": ["أندرتيكر","جون سينا","رومان رينز","ذا روك","ستون كولد","باتيستا","تريبل إتش","راندي أورتن","سي إم بانك","شون مايكلز","غولدبيرغ","ري ميستيريو","بروك ليسنر","كودي رودز","كين","براي وايت","إيه جاي ستايلز","سيث رولينز","بوكر تي"],
          "كندا": ["إيدج","كيفن أوينز"],
          "اسكتلندا": ["درو ماكنتاير"],
          "أيرلندا": ["فين بالور"]
        }),
        wwe: boolMap(wrestlerNames)
      }
    },
    "لاعبو كرة القدم": {
      facts: {
        nationality: groupMap({
          "الأرجنتين": ["ليونيل ميسي"],
          "البرتغال": ["كريستيانو رونالدو"],
          "البرازيل": ["نيمار","رونالدينيو","رونالدو نازاريو"],
          "مصر": ["محمد صلاح"],
          "فرنسا": ["كيليان مبابي","زين الدين زيدان","كريم بنزيما"],
          "كرواتيا": ["لوكا مودريتش"],
          "النرويج": ["إيرلينغ هالاند"],
          "إنجلترا": ["جود بيلينغهام","هاري كين"],
          "السعودية": ["سالم الدوسري"],
          "العراق": ["يونس محمود","علي عدنان"],
          "إسبانيا": ["أندريس إنييستا","تشافي","سيرجيو راموس"],
          "بولندا": ["روبرت ليفاندوفسكي"],
          "بلجيكا": ["كيفن دي بروين"],
          "الجزائر": ["رياض محرز"],
          "المغرب": ["أشرف حكيمي"],
          "كوريا الجنوبية": ["سون هيونغ مين"]
        }),
        position: groupMap({
          "مهاجم": ["ليونيل ميسي","كريستيانو رونالدو","نيمار","محمد صلاح","كيليان مبابي","رونالدينيو","رونالدو نازاريو","إيرلينغ هالاند","سالم الدوسري","يونس محمود","كريم بنزيما","روبرت ليفاندوفسكي","هاري كين","رياض محرز","سون هيونغ مين"],
          "لاعب وسط": ["زين الدين زيدان","لوكا مودريتش","جود بيلينغهام","أندريس إنييستا","تشافي","كيفن دي بروين"],
          "مدافع": ["علي عدنان","سيرجيو راموس","أشرف حكيمي"]
        })
      }
    },
    "شخصيات الألعاب": {
      facts: {
        series: {
          "كراتوس": "God of War",
          "ماريو": "Super Mario",
          "سونيك": "Sonic the Hedgehog",
          "لارا كروفت": "Tomb Raider",
          "ماستر شيف": "Halo",
          "سبايدرمان": "Marvel's Spider-Man",
          "آرثر مورغان": "Red Dead Redemption",
          "جون مارستون": "Red Dead Redemption",
          "ناثان دريك": "Uncharted",
          "ليون كينيدي": "Resident Evil",
          "جيرالت": "The Witcher",
          "إيزيـو أوديتوري": "Assassin's Creed",
          "سكوربيون": "Mortal Kombat",
          "سوليد سنيك": "Metal Gear",
          "كراش بانديكوت": "Crash Bandicoot",
          "باك مان": "Pac-Man",
          "سيفيرووث": "Final Fantasy VII",
          "آشلي غراهام": "Resident Evil 4",
          "ألوي": "Horizon",
          "ليتل ماك": "Punch-Out!!",
          "دوم سلاير": "Doom"
        },
        publisher: {
          "كراتوس": "Sony Interactive Entertainment",
          "ماريو": "Nintendo",
          "سونيك": "SEGA",
          "لارا كروفت": "متعدد الناشرين",
          "ماستر شيف": "Xbox Game Studios",
          "سبايدرمان": "Sony Interactive Entertainment",
          "آرثر مورغان": "Rockstar Games",
          "جون مارستون": "Rockstar Games",
          "ناثان دريك": "Sony Interactive Entertainment",
          "ليون كينيدي": "CAPCOM",
          "جيرالت": "CD Projekt",
          "إيزيـو أوديتوري": "Ubisoft",
          "سكوربيون": "Warner Bros. Games",
          "سوليد سنيك": "Konami",
          "كراش بانديكوت": "Activision",
          "باك مان": "Bandai Namco",
          "سيفيرووث": "Square Enix",
          "آشلي غراهام": "CAPCOM",
          "ألوي": "Sony Interactive Entertainment",
          "ليتل ماك": "Nintendo",
          "دوم سلاير": "Bethesda Softworks"
        }
      }
    },
    "الأفلام": {
      facts: {
        franchise: {
          "جوكر": "DC",
          "دارث فيدر": "Star Wars",
          "جاك سبارو": "Pirates of the Caribbean",
          "باتمان": "DC",
          "شيرلوك هولمز": "Sherlock Holmes",
          "هاري بوتر": "Harry Potter",
          "إنديانا جونز": "Indiana Jones",
          "فورست غامب": "Forrest Gump",
          "روكي بالبوا": "Rocky",
          "جون ويك": "John Wick",
          "سبايدرمان": "Marvel",
          "آيرون مان": "Marvel",
          "ثور": "Marvel",
          "كابتن أمريكا": "Marvel",
          "شريك": "Shrek",
          "وودي": "Toy Story",
          "إلسا": "Frozen",
          "نيمو": "Finding Nemo",
          "مستر بين": "Mr. Bean",
          "رامبو": "Rambo",
          "تيرميناتور": "The Terminator",
          "كينغ كونغ": "King Kong",
          "غودزيلا": "Godzilla",
          "هالك": "Marvel"
        },
        publisher: {
          "جوكر": "DC",
          "دارث فيدر": "Lucasfilm",
          "باتمان": "DC",
          "سبايدرمان": "Marvel",
          "آيرون مان": "Marvel",
          "ثور": "Marvel",
          "كابتن أمريكا": "Marvel",
          "هالك": "Marvel"
        }
      }
    },
    "الأنمي": {
      facts: {
        series: {
          "ناروتو": "Naruto",
          "غوكو": "Dragon Ball",
          "لوفي": "One Piece",
          "زورو": "One Piece",
          "إيرين": "Attack on Titan",
          "ليفاي": "Attack on Titan",
          "إيتاتشي": "Naruto",
          "ساسكي": "Naruto",
          "كاكاشي": "Naruto",
          "غوجو ساتورو": "Jujutsu Kaisen",
          "تانجيرو": "Demon Slayer",
          "نيزوكو": "Demon Slayer",
          "لايت ياغامي": "Death Note",
          "إل": "Death Note",
          "إدوارد إلريك": "Fullmetal Alchemist",
          "كيلوا": "Hunter x Hunter",
          "غون": "Hunter x Hunter",
          "سايتاما": "One-Punch Man",
          "ميكاسا": "Attack on Titan",
          "ريوك": "Death Note",
          "إينوسكي": "Demon Slayer",
          "زينيتسو": "Demon Slayer",
          "روك لي": "Naruto",
          "مادارا": "Naruto",
          "بروك": "One Piece"
        }
      }
    },
    "الأبطال الخارقون": {
      facts: {
        publisher: groupMap({
          "DC": ["سوبرمان","باتمان","ووندر وومن","فلاش","أكوامان","غرين لانترن","شازام","ريد هود"],
          "Marvel": ["سبايدرمان","آيرون مان","ثور","هالك","بلاك بانثر","دكتور سترينج","ديدبول","وولفرين","كابتن أمريكا","ثانوس","لوكي","كابتن مارفل","آنت مان","هوك آي","بلاك ويدو","فينوم"]
        })
      }
    },
    "المهن": {
      facts: {
        field: groupMap({
          "الصحة": ["طبيب","ممرض"],
          "الهندسة والتقنيات": ["مهندس","ميكانيكي","كهربائي","سبّاك","مبرمج"],
          "النقل والطيران": ["طيّار","سائق"],
          "السلامة والحماية": ["شرطي","إطفائي","محقق"],
          "التعليم": ["معلّم"],
          "الطعام والضيافة": ["طباخ","خبّاز"],
          "الزراعة والصيد": ["مزارع","صياد"],
          "الإعلام والفنون": ["مصور","مذيع"],
          "الرياضة": ["لاعب كرة"],
          "القانون والقضاء": ["محامي","قاضٍ"],
          "الحرف والبناء": ["نجّار","حلاق"]
        })
      }
    },
    "المعالم": {
      facts: {
        locationCountry: {
          "برج إيفل": ["فرنسا"],
          "الأهرامات": ["مصر"],
          "برج خليفة": ["الإمارات"],
          "سور الصين العظيم": ["الصين"],
          "تمثال الحرية": ["الولايات المتحدة"],
          "تاج محل": ["الهند"],
          "الكولوسيوم": ["إيطاليا"],
          "البتراء": ["الأردن"],
          "زقورة أور": ["العراق"],
          "ساعة بيغ بن": ["المملكة المتحدة"],
          "ماتشو بيتشو": ["بيرو"],
          "أبو الهول": ["مصر"],
          "برج بيزا": ["إيطاليا"],
          "الكعبة": ["السعودية"],
          "شلالات نياگرا": ["الولايات المتحدة","كندا"],
          "تمثال المسيح الفادي": ["البرازيل"],
          "قصر الحمراء": ["إسبانيا"],
          "مسجد قرطبة": ["إسبانيا"],
          "أيا صوفيا": ["تركيا"],
          "جبل إيفرست": ["نيبال","الصين"],
          "معبد أنغكور وات": ["كمبوديا"],
          "جزيرة الفصح": ["تشيلي"],
          "قصر فرساي": ["فرنسا"]
        }
      }
    },
    "السيارات": {
      facts: {
        manufacturerCountry: groupMap({
          "إيطاليا": ["لامبورغيني","فيراري"],
          "اليابان": ["تويوتا","نيسان جي تي آر","هوندا","لكزس","سوبارو","مازدا"],
          "ألمانيا": ["مرسيدس","BMW","أودي","بورشه","فولكس فاغن"],
          "المملكة المتحدة": ["رولز رويس","ماكلارين","بنتلي"],
          "الولايات المتحدة": ["جيب رانجلر","فورد موستانغ","شيفروليه كامارو","تسلا","دودج تشارجر"],
          "كوريا الجنوبية": ["هيونداي","كيا"],
          "السويد": ["فولفو"]
        })
      }
    },
    "الأكلات": {
      facts: {
        originRegion: {
          "بيتزا": "إيطاليا",
          "معكرونة": "إيطاليا",
          "سوشي": "اليابان",
          "برياني": "جنوب آسيا",
          "كبسة": "شبه الجزيرة العربية",
          "مسكوف": "العراق",
          "باجة": "العراق",
          "كليجة": "العراق",
          "تشريب": "العراق",
          "تشريب لحم": "العراق",
          "قوزي": "العراق",
          "قيمة": "العراق",
          "منسف": "الأردن",
          "تبولة": "بلاد الشام",
          "شاورما": "بلاد الشام",
          "فطائر": "بلاد الشام",
          "كباب": "غرب آسيا",
          "مقلوبة": "بلاد الشام"
        },
        originCountry: groupMap({
          "العراق": ["مسكوف","باجة","كليجة","تشريب","تشريب لحم","قوزي","قيمة"],
          "إيطاليا": ["بيتزا","معكرونة"],
          "اليابان": ["سوشي"],
          "الأردن": ["منسف"]
        })
      }
    },
    "شخصيات تاريخية": {
      facts: {
        birthCountry: groupMap({
          "العراق": ["صلاح الدين الأيوبي"],
          "أوزبكستان الحالية": ["ابن سينا"],
          "مصر": ["كليوباترا","توت عنخ آمون"],
          "اليونان": ["الإسكندر الأكبر","أرسطو","أفلاطون"],
          "فرنسا": ["نابليون"],
          "إيطاليا": ["ليوناردو دا فينشي","غاليليو","جوليوس قيصر","ماركو بولو"],
          "ألمانيا": ["أينشتاين"],
          "المغرب": ["ابن بطوطة"],
          "تونس": ["هانيبال","ابن خلدون"],
          "بولندا": ["ماري كوري"],
          "جنوب أفريقيا": ["نيلسون مانديلا"],
          "المملكة المتحدة": ["تشرشل"],
          "إيران الحالية": ["عمر الخيام"],
          "هولندا": ["فنسنت فان غوخ"],
          "الولايات المتحدة": ["مارتن لوثر كينغ"],
          "الهند": ["غاندي"]
        }),
        occupation: {
          "صلاح الدين الأيوبي": "قائد عسكري وسلطان",
          "ابن سينا": "طبيب وفيلسوف",
          "الخوارزمي": "عالم رياضيات وفلك",
          "كليوباترا": "ملكة مصر",
          "الإسكندر الأكبر": "ملك وقائد عسكري",
          "نابليون": "إمبراطور وقائد عسكري",
          "ليوناردو دا فينشي": "رسام ومهندس ومخترع",
          "أينشتاين": "عالم فيزياء نظرية",
          "غاليليو": "عالم فلك وفيزياء",
          "ابن بطوطة": "رحالة وقاض",
          "هانيبال": "قائد عسكري قرطاجي",
          "جوليوس قيصر": "قائد عسكري وسياسي روماني",
          "ماري كوري": "عالمة فيزياء وكيمياء",
          "نيلسون مانديلا": "مناضل ضد الفصل العنصري ورئيس جنوب أفريقيا",
          "تشرشل": "سياسي ورئيس وزراء بريطاني",
          "توت عنخ آمون": "فرعون مصر",
          "أرسطو": "فيلسوف",
          "أفلاطون": "فيلسوف",
          "ابن خلدون": "مؤرخ ومفكر اجتماعي",
          "عمر الخيام": "عالم رياضيات وفلك وشاعر",
          "ماركو بولو": "تاجر ورحالة",
          "فنسنت فان غوخ": "رسام",
          "مارتن لوثر كينغ": "قائد حقوق مدنية وواعظ",
          "غاندي": "محام وقائد استقلال هندي"
        },
        occupationGroup: groupMap({
          "عالم": ["ابن سينا","الخوارزمي","أينشتاين","غاليليو","ماري كوري","عمر الخيام"],
          "فيلسوف": ["ابن سينا","أرسطو","أفلاطون"],
          "قائد عسكري": ["صلاح الدين الأيوبي","الإسكندر الأكبر","نابليون","هانيبال","جوليوس قيصر"],
          "حاكم": ["كليوباترا","الإسكندر الأكبر","نابليون","توت عنخ آمون","صلاح الدين الأيوبي"],
          "فنان": ["ليوناردو دا فينشي","فنسنت فان غوخ"],
          "رحالة": ["ابن بطوطة","ماركو بولو"],
          "سياسي": ["جوليوس قيصر","نيلسون مانديلا","تشرشل","مارتن لوثر كينغ","غاندي"]
        })
      }
    }
  };

  const ALIASES = {
    "المصارعين": {
      "undertaker": "أندرتيكر", "the undertaker": "أندرتيكر", "john cena": "جون سينا",
      "roman reigns": "رومان رينز", "the rock": "ذا روك", "stone cold": "ستون كولد",
      "steve austin": "ستون كولد", "cm punk": "سي إم بانك", "edge": "إيدج",
      "rey mysterio": "ري ميستيريو", "brock lesnar": "بروك ليسنر", "bray wyatt": "براي وايت",
      "aj styles": "إيه جاي ستايلز", "seth rollins": "سيث رولينز", "kevin owens": "كيفن أوينز",
      "finn balor": "فين بالور", "booker t": "بوكر تي"
    },
    "لاعبو كرة القدم": {
      "lionel messi": "ليونيل ميسي", "cristiano ronaldo": "كريستيانو رونالدو",
      "neymar": "نيمار", "mohamed salah": "محمد صلاح", "kylian mbappe": "كيليان مبابي",
      "zinedine zidane": "زين الدين زيدان", "ronaldinho": "رونالدينيو",
      "ronaldo nazario": "رونالدو نازاريو", "luka modric": "لوكا مودريتش",
      "erling haaland": "إيرلينغ هالاند", "jude bellingham": "جود بيلينغهام"
    },
    "شخصيات الألعاب": {
      "kratos": "كراتوس", "mario": "ماريو", "sonic": "سونيك", "lara croft": "لارا كروفت",
      "master chief": "ماستر شيف", "spider-man": "سبايدرمان", "spiderman": "سبايدرمان",
      "arthur morgan": "آرثر مورغان", "john marston": "جون مارستون", "nathan drake": "ناثان دريك",
      "leon kennedy": "ليون كينيدي", "geralt": "جيرالت", "ezio auditore": "إيزيـو أوديتوري",
      "solid snake": "سوليد سنيك", "crash bandicoot": "كراش بانديكوت", "pac-man": "باك مان",
      "sephiroth": "سيفيرووث", "aloy": "ألوي", "little mac": "ليتل ماك", "doom slayer": "دوم سلاير"
    },
    "الأفلام": {
      "joker": "جوكر", "darth vader": "دارث فيدر", "jack sparrow": "جاك سبارو",
      "batman": "باتمان", "sherlock holmes": "شيرلوك هولمز", "harry potter": "هاري بوتر",
      "indiana jones": "إنديانا جونز", "forrest gump": "فورست غامب", "john wick": "جون ويك",
      "spider-man": "سبايدرمان", "iron man": "آيرون مان", "captain america": "كابتن أمريكا",
      "mr bean": "مستر بين", "godzilla": "غودزيلا"
    },
    "الأنمي": {
      "naruto": "ناروتو", "goku": "غوكو", "luffy": "لوفي", "zoro": "زورو",
      "eren": "إيرين", "levi": "ليفاي", "itachi": "إيتاتشي", "sasuke": "ساسكي",
      "kakashi": "كاكاشي", "gojo satoru": "غوجو ساتورو", "tanjiro": "تانجيرو",
      "nezuko": "نيزوكو", "light yagami": "لايت ياغامي", "ryuk": "ريوك",
      "saitama": "سايتاما", "mikasa": "ميكاسا", "madara": "مادارا"
    },
    "السيارات": {
      "bmw": "BMW", "rolls royce": "رولز رويس", "volkswagen": "فولكس فاغن",
      "mercedes-benz": "مرسيدس", "chevrolet camaro": "شيفروليه كامارو"
    }
  };

  const COUNTRY_TERMS = [
    ["الولايات المتحدة", ["الولايات المتحدة","امريكا","امريكي","امريكية","امريكيه","الامريكي"]],
    ["كندا", ["كندا","كندي","كندية"]],
    ["المملكة المتحدة", ["المملكة المتحدة","بريطانيا","بريطاني","بريطانية","انجلترا","انجليزي"]],
    ["اسكتلندا", ["اسكتلندا","اسكتلندي","اسكتلندية"]],
    ["أيرلندا", ["ايرلندا","ايرلندي","ايرلندية"]],
    ["الأرجنتين", ["الارجنتين","ارجنتيني","ارجنتينية"]],
    ["البرتغال", ["البرتغال","برتغالي","برتغالية"]],
    ["البرازيل", ["البرازيل","برازيلي","برازيلية"]],
    ["مصر", ["مصر","مصري","مصرية"]],
    ["فرنسا", ["فرنسا","فرنسي","فرنسية"]],
    ["كرواتيا", ["كرواتيا","كرواتي","كرواتية"]],
    ["النرويج", ["النرويج","نرويجي","نرويجية"]],
    ["إنجلترا", ["انجلترا","انجليزي","انجليزية"]],
    ["السعودية", ["السعودية","سعودي","سعودية"]],
    ["العراق", ["العراق","عراقي","عراقية"]],
    ["إسبانيا", ["اسبانيا","اسباني","اسبانية"]],
    ["بولندا", ["بولندا","بولندي","بولندية"]],
    ["بلجيكا", ["بلجيكا","بلجيكي","بلجيكية"]],
    ["الجزائر", ["الجزائر","جزائري","جزائرية"]],
    ["المغرب", ["المغرب","مغربي","مغربية"]],
    ["كوريا الجنوبية", ["كوريا الجنوبية","كوري جنوبي","كورية جنوبية"]],
    ["إيطاليا", ["ايطاليا","ايطالي","ايطالية"]],
    ["ألمانيا", ["المانيا","الماني","المانية"]],
    ["اليابان", ["اليابان","ياباني","يابانية"]],
    ["تركيا", ["تركيا","تركي","تركية"]],
    ["الصين", ["الصين","صيني","صينية"]],
    ["الهند", ["الهند","هندي","هندية"]],
    ["روسيا", ["روسيا","روسي","روسية"]],
    ["جنوب أفريقيا", ["جنوب افريقيا","جنوب افريقي"]],
    ["الإمارات", ["الامارات","اماراتي","اماراتية"]],
    ["الأردن", ["الاردن","اردني","اردنية"]],
    ["بيرو", ["بيرو","بيروفي","بيروفية"]],
    ["كمبوديا", ["كمبوديا","كمبودي","كمبودية"]],
    ["تشيلي", ["تشيلي","تشيلي","تشيليّة"]],
    ["نيبال", ["نيبال","نيبالي","نيبالية"]],
    ["السويد", ["السويد","سويدي","سويدية"]],
    ["أوزبكستان", ["اوزبكستان","اوزبكي","اوزبكية"]],
    ["إيران", ["ايران","ايراني","ايرانية"]],
    ["هولندا", ["هولندا","هولندي","هولندية"]],
    ["اليونان", ["اليونان","يوناني","يونانية"]]
  ];

  const SERIES_ALIASES = {
    "God of War": ["god of war","جود اوف وور","جود اوف وار"],
    "Super Mario": ["super mario","سوبر ماريو"],
    "Sonic the Hedgehog": ["sonic the hedgehog","سونيك"],
    "Tomb Raider": ["tomb raider","تومب رايدر"],
    "Halo": ["halo","هالو"],
    "Marvel's Spider-Man": ["marvel spider man","سبايدرمان"],
    "Red Dead Redemption": ["red dead redemption","ريد ديد"],
    "Uncharted": ["uncharted","انشارتد"],
    "Resident Evil": ["resident evil","ريزدنت ايفل"],
    "The Witcher": ["the witcher","ويتشر"],
    "Assassin's Creed": ["assassins creed","اساسنز كريد"],
    "Mortal Kombat": ["mortal kombat","مورتال كومبات"],
    "Metal Gear": ["metal gear","ميتل غير"],
    "Crash Bandicoot": ["crash bandicoot","كراش"],
    "Pac-Man": ["pac man","باك مان"],
    "Final Fantasy VII": ["final fantasy","فاينل فانتسي"],
    "Horizon": ["horizon","هورايزن"],
    "Punch-Out!!": ["punch out","بانش اوت"],
    "Doom": ["doom","دووم"],
    "Naruto": ["naruto","ناروتو"],
    "Dragon Ball": ["dragon ball","دراغون بول"],
    "One Piece": ["one piece","ون بيس"],
    "Attack on Titan": ["attack on titan","هجوم العمالقة"],
    "Jujutsu Kaisen": ["jujutsu kaisen","جوجوتسو كايسن"],
    "Demon Slayer": ["demon slayer","قاتل الشياطين"],
    "Death Note": ["death note","مذكرة الموت"],
    "Fullmetal Alchemist": ["fullmetal alchemist","الخيميائي المعدني"],
    "Hunter x Hunter": ["hunter x hunter","هنتر"],
    "One-Punch Man": ["one punch man","ون بنش مان"]
  };

  const PUBLISHER_TERMS = [
    ["Marvel", ["مارفل","marvel"]],
    ["DC", ["دي سي","dc","دي سي كوميكس"]],
    ["Nintendo", ["نينتندو","nintendo"]],
    ["SEGA", ["سيغا","سيجا","sega"]],
    ["Xbox Game Studios", ["اكس بوكس","xbox"]],
    ["Sony Interactive Entertainment", ["بلايستيشن","بلاي ستيشن","playstation","سوني"]],
    ["CAPCOM", ["كابكوم","capcom"]],
    ["Ubisoft", ["يوبيسوفت","ubisoft"]],
    ["Rockstar Games", ["روكستار","rockstar"]],
    ["Konami", ["كونامي","konami"]],
    ["Square Enix", ["سكوير انكس","square enix"]],
    ["Bandai Namco", ["بانداي نامكو","bandai namco"]],
    ["Bethesda Softworks", ["بيثيسدا","bethesda"]]
  ];

  const POSITION_TERMS = [
    ["مهاجم", ["مهاجم","جناح","راس حربه","راس الحربة","مركز الهجوم"]],
    ["لاعب وسط", ["لاعب وسط","وسط الملعب","وسط"]],
    ["مدافع", ["مدافع","قلب دفاع","ظهير","خط الدفاع"]],
    ["حارس مرمى", ["حارس مرمى","حارس"]]
  ];

  const FIELD_TERMS = [
    ["الصحة", ["طب","طبي","صحي","تمريض","مستشفى"]],
    ["الهندسة والتقنيات", ["هندسة","هندسي","تقني","صيانة","ميكانيك","كهرباء","سباكة","برمجة","حاسوب"]],
    ["النقل والطيران", ["نقل","طيران","طيار","سياقة","سائق"]],
    ["السلامة والحماية", ["شرطة","شرطي","اطفاء","حماية","امن","تحقيق"]],
    ["التعليم", ["تعليم","مدرسة","تدريس","معلم"]],
    ["الطعام والضيافة", ["طبخ","مطبخ","مطاعم","خبز","مخبز"]],
    ["الزراعة والصيد", ["زراعة","مزرعة","صيد","اسماك"]],
    ["الإعلام والفنون", ["اعلام","تصوير","مصور","مذيع","صحافة"]],
    ["الرياضة", ["رياضة","ملعب","لاعب"]],
    ["القانون والقضاء", ["قانون","محاماة","قضاء","محكمة"]],
    ["الحرف والبناء", ["بناء","نجارة","نجار","حلاقة","حلاق"]]
  ];

  const OCCUPATION_TERMS = [
    ["عالم", ["عالم","علماء","فيزيائي","كيميائي","رياضياتي","عالم رياضيات"]],
    ["فيلسوف", ["فيلسوف","فلسفة"]],
    ["قائد عسكري", ["قائد عسكري","جنرال","قائد جيش"]],
    ["حاكم", ["ملك","حاكم","فرعون","امبراطور","سلطان"]],
    ["فنان", ["فنان","رسام","فن تشكيلي"]],
    ["رحالة", ["رحالة","مستكشف"]],
    ["سياسي", ["سياسي","رئيس وزراء","زعيم سياسي"]]
  ];

  const NEGATIONS = new Set(["لا","ما","مو","مش","ليس","ليست","مب"]);
  const NEGATION_BRIDGES = new Set(["يزال","تزال","من","هو","هي","انه","انها"]);

  function findEntry(category, secret) {
    const categoryData = DATA[category];
    if (!categoryData) return null;
    const key = normalize(secret);
    for (const [name, facts] of Object.entries(categoryData.facts)) {
      for (const entity of Object.keys(facts)) {
        if (normalize(entity) === key) return { entity, facts: facts[entity] };
      }
    }
    const aliasMap = ALIASES[category] || {};
    const alias = aliasMap[key] || aliasMap[String(secret ?? "").trim().toLowerCase()];
    if (alias) {
      for (const facts of Object.values(categoryData.facts)) {
        if (facts[alias]) return { entity: alias, facts: Object.fromEntries(Object.entries(categoryData.facts).filter(([,map]) => map[alias]).map(([field,map]) => [field,map[alias]])) };
      }
    }
    const combined = {};
    for (const [field, map] of Object.entries(categoryData.facts)) {
      for (const [name, value] of Object.entries(map)) {
        if (normalize(name) === key) combined[field] = value;
      }
    }
    return Object.keys(combined).length ? { entity: secret, facts: combined } : null;
  }

  function hasAny(q, terms) {
    return terms.some(term => q.includes(normalize(term)));
  }

  function negated(q, term) {
    const at = q.indexOf(normalize(term));
    if (at < 0) return false;
    const words = q.slice(0, at).trim().split(" ").filter(Boolean).slice(-5);
    if (words.includes("يزال") || words.includes("تزال")) return false;
    const count = words.filter(word => NEGATIONS.has(word)).length;
    return count > 1 ? null : count === 1;
  }

  function countryValue(facts) {
    return facts.nationality || facts.birthCountry || facts.locationCountry || facts.manufacturerCountry || facts.originCountry || null;
  }

  function countryMatches(actual, expected) {
    const values = Array.isArray(actual) ? actual : [actual];
    return values.some(value => {
      const a = normalize(value), e = normalize(expected);
      if (a === e) return true;
      if (a === normalize("اسكتلندا") && e === normalize("المملكة المتحدة")) return true;
      if (a === normalize("إنجلترا") && e === normalize("المملكة المتحدة")) return true;
      return false;
    });
  }

  function formatFact(value) {
    return Array.isArray(value) ? value.join(" و") : String(value);
  }

  function result(value, intent, q, anchor) {
    if (typeof value !== "boolean") return { answer: formatFact(value), known: true, source: "local-curated-facts", intent };
    const polarity = negated(q, anchor);
    if (polarity === null) return { known: false, source: "abstain", reason: "ambiguous-negation", intent };
    return { answer: (polarity ? !value : value) ? "نعم" : "لا", known: true, source: "local-curated-facts", intent };
  }

  function answer(category, secret, question) {
    const entry = findEntry(category, secret);
    if (!entry) return null;
    const q = normalize(question);
    if (!q) return null;
    const f = entry.facts;

    const generic = [
      ["nationality", ["شنو جنسيته","شنو جنسيتها","شنو جنسيته اللاعب","من اي جنسية","ما جنسيته"]],
      ["birthCountry", ["من اي بلد انولد","وين انولد","وين مولود","وين مولوده","بلد ولادته"]],
      ["locationCountry", ["وين يقع","وين تقع","وين موجود","وين مكانه","وين مكانها","في اي بلد يقع","في اي بلد تقع"]],
      ["manufacturerCountry", ["من اي بلد الشركة","من اي دولة الشركة","بلد الشركة","الشركة منين","منشأ الشركة"]],
      ["originCountry", ["من اي بلد اصلها","من اي دولة اصلها","اصلها من اي بلد"]],
      ["series", ["من اي لعبة","من اي لعبه","شنو اسم اللعبة","شنو اسم اللعبه","بأي لعبة","باي لعبه","من اي انمي","شنو الانمي","من اي مسلسل انمي"]],
      ["franchise", ["من اي فيلم","شنو سلسلة الافلام","من اي سلسلة افلام","بأي فيلم","باي فيلم","شنو اسم الفيلم"]],
      ["publisher", ["مارفل لو دي سي","من اي شركة قصص مصورة","تابع لمن","من اي عالم قصص"]],
      ["position", ["شنو مركزه","شنو مركز اللاعب","يلعب باي مركز","مركزه شنو"]],
      ["field", ["شنو مجال المهنة","شنو مجال المهنه","شنو مجال العمل","بأي مجال يشتغل","مجالها شنو"]],
      ["occupation", ["شنو كان يشتغل","شنو مهنته","شنو عمله","شنو تخصصه","شنو وظيفته"]],
      ["originRegion", ["شنو اصل الاكلة","شنو اصلها","منين اصلها","من اي مطبخ","من وين اصلها"]]
    ];
    for (const [field, phrases] of generic) {
      if (f[field] !== undefined && hasAny(q, phrases)) {
        return { answer: formatFact(f[field]), known: true, source: "local-curated-facts", intent: field };
      }
    }

    if (f.wwe !== undefined && hasAny(q, ["wwe","مصارعة wwe","اتحاد wwe","المصارعة العالمية"])) {
      return result(f.wwe, "wwe", q, hasAny(q, ["wwe"]) ? "wwe" : "مصارعة wwe");
    }

    const country = COUNTRY_TERMS.find(([name, terms]) => terms.some(term => q.includes(normalize(term))));
    if (country && countryValue(f)) {
      const [name, terms] = country;
      const anchor = terms.find(term => q.includes(normalize(term))) || name;
      return result(countryMatches(countryValue(f), name), "country:" + name, q, anchor);
    }

    const seriesValues = [f.series, f.franchise].filter(Boolean);
    if (seriesValues.length) {
      for (const [canonical, aliases] of Object.entries(SERIES_ALIASES)) {
        const term = aliases.find(alias => q.includes(normalize(alias)));
        if (term) {
          const matches = seriesValues.some(value => normalize(value) === normalize(canonical));
          return result(matches, "series:" + canonical, q, term);
        }
      }
      for (const value of seriesValues) {
        if (q.includes(normalize(value))) return result(true, "series:" + value, q, value);
      }
    }

    if (f.publisher) {
      for (const [publisher, terms] of PUBLISHER_TERMS) {
        const term = terms.find(item => q.includes(normalize(item)));
        if (term) return result(normalize(f.publisher) === normalize(publisher), "publisher:" + publisher, q, term);
      }
    }

    if (f.position) {
      for (const [position, terms] of POSITION_TERMS) {
        const term = terms.find(item => q.includes(normalize(item)));
        if (term) return result(normalize(f.position) === normalize(position), "position:" + position, q, term);
      }
    }

    if (f.field) {
      for (const [field, terms] of FIELD_TERMS) {
        const term = terms.find(item => q.includes(normalize(item)));
        if (term) return result(normalize(f.field) === normalize(field), "field:" + field, q, term);
      }
    }

    if (f.occupationGroup) {
      for (const [occupation, terms] of OCCUPATION_TERMS) {
        const term = terms.find(item => q.includes(normalize(item)));
        if (term) return result(normalize(f.occupationGroup) === normalize(occupation), "occupation:" + occupation, q, term);
      }
    }

    if (f.originRegion && hasAny(q, ["عراقي","عراقية","من العراق","بالشام","شامي","ياباني","يابانية","ايطالي","ايطالية","اردني","اردنية"])) {
      const term = ["عراقي","عراقية","من العراق","بالشام","شامي","ياباني","يابانية","ايطالي","ايطالية","اردني","اردنية"].find(item => q.includes(normalize(item)));
      const expected = term && ({
        "عراقي":"العراق","عراقية":"العراق","من العراق":"العراق",
        "بالشام":"بلاد الشام","شامي":"بلاد الشام",
        "ياباني":"اليابان","يابانية":"اليابان",
        "ايطالي":"إيطاليا","ايطالية":"إيطاليا",
        "اردني":"الأردن","اردنية":"الأردن"
      })[term];
      if (expected) return result(normalize(f.originRegion).includes(normalize(expected)), "origin:" + expected, q, term);
    }

    return null;
  }

  function getCoverage() {
    return Object.fromEntries(Object.entries(SOURCES).map(([category, sources]) => {
      const facts = DATA[category]?.facts || {};
      const entities = new Set(Object.values(facts).flatMap(map => Object.keys(map)));
      return [category, {
        sourceCount: sources.length,
        entityCount: entities.size,
        factCount: Object.values(facts).reduce((total, map) => total + Object.keys(map).length, 0),
        factFields: Object.keys(facts)
      }];
    }));
  }

  const api = Object.freeze({
    answer,
    normalize,
    getSources: () => SOURCES,
    getCoverage,
    getRecords: category => DATA[category]?.facts || {},
    getCategories: () => Object.keys(SOURCES)
  });

  globalThis.SuwadWhoKnowledge = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();