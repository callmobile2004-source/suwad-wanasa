const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
// Regression cases intentionally use the same Iraqi-Arabic phrasing seen in the game.
// Unknown or ambiguous properties are asserted separately from supported facts.
const ai = require("../who-ai-engine.js");

const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const categoryBlock = app.match(/const categories=\{([\s\S]*?)\};\s*const modes=/);
assert.ok(categoryBlock, "The current game category registry must be discoverable");
const appCategories = [...categoryBlock[1].matchAll(/"([^"]+)":\[/g)].map(match => match[1]).sort();
assert.deepEqual(ai.getCategories().slice().sort(), appCategories,
  "Every category offered by the game must have a matching Oras knowledge profile");

const appCategoryData = JSON.parse("{"+categoryBlock[1]+"}");
for (const [category, items] of Object.entries(appCategoryData)) {
  assert.equal(new Set(items).size, items.length,
    category + " must not contain repeated secret options");
  assert.deepEqual(ai.getItems(category), items,
    category + " knowledge catalog must exactly match the live game option pool");
}
const guideTerms = {
  "الحيوانات":"الحيوان",
  "الطيور":"الطائر",
  "كائنات البحر":"الكائن البحري",
  "الدول":"الدولة",
  "المصارعين":"المصارع",
  "لاعبو كرة القدم":"لاعب كرة القدم",
  "شخصيات الألعاب":"شخصية اللعبة",
  "الأفلام":"شخصية الفيلم",
  "الأنمي":"شخصية الأنمي",
  "السيارات":"السيارة",
  "الأكلات":"الأكلة",
  "الأبطال الخارقون":"البطل الخارق",
  "المهن":"المهنة",
  "المعالم":"المعلم",
  "الفواكه":"الفاكهة",
  "الآلات الموسيقية":"الآلة",
  "الرياضات":"الرياضة",
  "شخصيات تاريخية":"الشخصية التاريخية"
};
for (const [category, expectedTerm] of Object.entries(guideTerms)) {
  const guide = ai.getQuestionGuide(category);
  assert.ok(guide && typeof guide.placeholder === "string" && guide.placeholder.includes(expectedTerm),
    category + " must have a category-correct question placeholder");
}
const practiceSource = fs.readFileSync(path.join(__dirname, "..", "game-ai-practice.js"), "utf8");
const whoStart = practiceSource.indexOf("const WHO_CATEGORIES = ");
const whoOpen = practiceSource.indexOf("{", whoStart);
const whoClose = practiceSource.indexOf("};", whoOpen);
assert.ok(whoStart >= 0 && whoOpen > whoStart && whoClose > whoOpen, "The local Who practice category pool must be discoverable");
const practiceCategories = JSON.parse(practiceSource.slice(whoOpen, whoClose + 1).trim());
assert.deepEqual(practiceCategories, appCategoryData,
  "Local Who practice must use the exact same categories and secret options as the main game");

const categoryChecks = [
  ["الحيوانات", "قطة", "هل انت حيوان؟"],
  ["الطيور", "صقر", "هل انت طير؟"],
  ["كائنات البحر", "دلفين", "هل انت كائن بحري؟"],
  ["الدول", "العراق", "هل انت دولة؟"],
  ["المصارعين", "أندرتيكر", "هل انت مصارع؟"],
  ["لاعبو كرة القدم", "ليونيل ميسي", "هل انت لاعب كرة قدم؟"],
  ["شخصيات الألعاب", "كراتوس", "هل انت شخصية لعبة؟"],
  ["الأفلام", "باتمان", "هل انت شخصية فيلم؟"],
  ["الأنمي", "ناروتو", "هل انت شخصية انمي؟"],
  ["السيارات", "تويوتا", "هل انت سيارة؟"],
  ["الأكلات", "دولمة", "هل انت أكلة؟"],
  ["الأبطال الخارقون", "سوبرمان", "هل انت بطل خارق؟"],
  ["المهن", "طبيب", "هل انت مهنة؟"],
  ["المعالم", "البتراء", "هل انت معلم سياحي؟"],
  ["الفواكه", "برتقال", "هل انت فاكهة؟"],
  ["الآلات الموسيقية", "عود", "هل انت آلة موسيقية؟"],
  ["الرياضات", "كرة القدم", "هل انت رياضة؟"],
  ["شخصيات تاريخية", "ابن سينا", "هل انت شخصية تاريخية؟"]
];
for (const [category, secret, question] of categoryChecks) {
  const result = ai.answer(category, secret, question);
  assert.equal(result.known, true, category + " category identity is understood");
  assert.equal(result.answer, "نعم", category + " category identity is correct");
}

const cases = [
  ["الحيوانات","قطة","هل الحيوان صغير الحجم؟","نعم، الحجم صغير."],
  ["الحيوانات","قطة","حجمه كلش صغير؟","نعم، الحجم صغير."],
  ["الحيوانات","قطة","هل الحيوان كبير؟","لا، الحجم صغير."],
  ["الحيوانات","أسد","هل الحيوان كبير الحجم؟","نعم، الحجم كبير."],
  ["الحيوانات","فهد","هل الحيوان متوسط الحجم؟","نعم، الحجم متوسط."],
  ["الحيوانات","دلفين","هل يعيش بالبحر؟","نعم"],
  ["الحيوانات","دلفين","هل هو من الثدييات؟","نعم"],
  ["الحيوانات","تمساح","هل هو من الزواحف؟","نعم"],
  ["الحيوانات","بطريق","هل يگدر يطير؟","لا"],
  ["الحيوانات","خفاش","هل يگدر يطير؟","نعم"],
  ["الحيوانات","قطة","هل هي من الطيور؟","لا"],
  ["الطيور","كيوي","هل يطير؟","لا"],
  ["الطيور","صقر","هل يطير؟","نعم"],
  ["الدول","العراق","هل هي دولة عربية؟","نعم"],
  ["الدول","العراق","هل تقع في آسيا؟","نعم"],
  ["الدول","فرنسا","هل تقع في أوروبا؟","نعم"],
  ["الدول","البرازيل","هل تقع في أمريكا الجنوبية؟","نعم"],
  ["السيارات","تسلا","هل السيارة كهربائية؟","نعم"],
  ["الأكلات","دولمة","هل هي أكلة عراقية؟","نعم"],
  ["الأكلات","بيتزا","هل هي أكلة عراقية؟","لا"],
  ["الأكلات","بقلاوة","هل هي من الحلويات؟","نعم"],
  ["الفواكه","برتقال","هل هي من الحمضيات؟","نعم"],
  ["الفواكه","فراولة","هل لونها أحمر؟","نعم"],
  ["الفواكه","موز","هل هي فاكهة استوائية؟","نعم"],
  ["كائنات البحر","حوت أزرق","هل هو من الثدييات؟","نعم"],
  ["كائنات البحر","تونة","هل هي من الأسماك؟","نعم"],
  ["كائنات البحر","أخطبوط","هل هو من اللافقاريات؟","نعم"],
  ["الآلات الموسيقية","عود","هل هو آلة وترية؟","نعم"],
  ["الآلات الموسيقية","ناي","هل هو آلة نفخ؟","نعم"],
  ["الآلات الموسيقية","بيانو","هل هو من آلات لوحة المفاتيح؟","نعم"],
  ["الرياضات","كرة القدم","هل هي رياضة جماعية؟","نعم"],
  ["الرياضات","التنس","هل هي رياضة فردية؟","نعم"],
  ["الرياضات","السباحة","هل هي رياضة مائية؟","نعم"],
  ["الحيوانات","دلفين","هل أعيش بالبحر؟","نعم"],
  ["الدول","العراق","هل أنا دولة عربية؟","نعم"],
  ["الحيوانات","أسد","هل أعيش بالبحر؟","لا"],
  ["الحيوانات","أسد","هل أستطيع الطيران؟","لا"],
  ["الحيوانات","ذئب رمادي","هل الحيوان صغير؟","لا، الحجم متوسط."],
  ["الحيوانات","ذئب رمادي","هل الحيوان كبير؟","لا، الحجم متوسط."],
  ["الحيوانات","قطة","هل الحيوان صغير؟","نعم، الحجم صغير."],
  ["المعالم","البتراء","هل تقع في الأردن؟","نعم"],
  ["المعالم","برج إيفل","هل يقع في فرنسا؟","نعم"]
];
for (const [category, secret, question, expected] of cases) {
  const result = ai.answer(category, secret, question);
  assert.equal(result.answer, expected, category + " / " + secret + " / " + question);
  assert.equal(result.known, true, "A curated fact must be marked known");
}

assert.equal(ai.answer("الحيوانات","كلب","هل الحيوان صغير؟").known, false,
  "A generic dog breed must not be assigned a size without a defined breed");
const unknown = ai.answer("الحيوانات", "كلب", "هل عنده قوة خارقة؟");
assert.equal(unknown.known, false, "Unsupported properties must abstain");
assert.equal(unknown.answer, ai.unknown, "Unsupported properties must not invent yes/no");
assert.equal(ai.answer("السيارات","تويوتا","هل السيارة كهربائية؟").known, false,
  "Do not assume a whole manufacturer is exclusively electric");
const fictionalPerson = ai.answer("الأفلام", "باتمان", "هل أنت شخص حقيقي؟");
assert.equal(fictionalPerson.known, false, "Fictional characters are not asserted to be real people");
const nonHuman = ai.answer("الحيوانات", "قطة", "هل أنت إنسان؟");
assert.equal(nonHuman.answer, "لا", "Known animal categories are not people");
assert.equal(ai.answer("الحيوانات", "دلفين", "هل أنت كائن بحري؟").answer, "نعم",
  "Marine animal entity membership must override the broader animal category");
assert.equal(ai.answer("الحيوانات", "قطة", "هل أنت كائن بحري؟").answer, "لا",
  "Known terrestrial mammal must not be classified as marine");
assert.equal(ai.answer("الدول", "العراق", "هل انت دوله؟").answer, "نعم",
  "Arabic spelling normalization must preserve category matching");
assert.equal(ai.normalize("گُل؟ ٤٠"), "كل 40", "Iraqi letter and Arabic digit normalization");
assert.equal(ai.answer("غير موجودة", "شيء", "هل انت؟").known, false,
  "Unknown category must abstain safely");


const negativeCases = [
  ["الحيوانات","قطة","هل الحيوان لا يطير؟","نعم"],
  ["الحيوانات","قطة","هل الحيوان ما يطير؟","نعم"],
  ["الحيوانات","قطة","هل الحيوان مو يطير؟","نعم"],
  ["الحيوانات","قطة","هل الحيوان ما يگدر يطير؟","نعم"],
  ["الحيوانات","بطريق","هل الحيوان لا يطير؟","نعم"],
  ["الحيوانات","خفاش","هل الحيوان لا يطير؟","لا"],
  ["الطيور","نعامة","هل الطير ما يطير؟","نعم"],
  ["الطيور","صقر","هل الطير ما يطير؟","لا"],
  ["الحيوانات","أسد","هل الحيوان ما يعيش بالبحر؟","نعم"],
  ["الحيوانات","دلفين","هل الحيوان ما يعيش بالبحر؟","لا"],
  ["الحيوانات","قطة","هل الحيوان مو من الطيور؟","نعم"],
  ["الحيوانات","قطة","هل الحيوان مو صغير؟","لا، الحجم صغير."],
  ["الحيوانات","ذئب رمادي","هل الحيوان مو صغير؟","نعم، الحجم متوسط."],
  ["الحيوانات","قطة","هل الحيوان لا يزال يطير؟","لا"]
];
for (const [category, secret, question, expected] of negativeCases) {
  const result = ai.answer(category, secret, question);
  assert.equal(result.answer, expected, "Negation: " + category + " / " + secret + " / " + question);
  assert.equal(result.known, true, "A single clear negation must preserve a known fact");
}
const ambiguousNegation = ai.answer("الحيوانات","قطة","هل الحيوان ما لا يطير؟");
assert.equal(ambiguousNegation.known, false, "Double negation must abstain instead of guessing");
assert.equal(ai.answer("الدول","العراق","هل أنت طائر؟").answer,"لا",
  "Category identity must answer consistently outside the animal category");
assert.equal(ai.answer("كائنات البحر","دلفين","هل أنت كائن بحري؟").answer,"نعم",
  "Marine category identity must remain positive");

const questionGuides = ai.getCategories().map(category => [category, ai.getQuestionGuide(category)]);
assert.equal(questionGuides.length, appCategories.length, "Every category has a dedicated question guide");
for (const [category, guide] of questionGuides) {
  assert.ok(guide.placeholder.startsWith("اسأل عن ") || guide.placeholder.startsWith("اكتب سؤالاً"),
    "Every category has a meaningful category-specific placeholder: " + category);
  if (guide.example) {
    assert.ok(guide.example.endsWith("؟"),
      "Every provided example is a complete question: " + category);
  } else {
    assert.ok(guide.placeholder.includes("معلومة محددة") && guide.placeholder.includes("غير مؤكدة"),
      "Categories without curated facts must not invent example questions: " + category);
  }
  assert.ok(!guide.placeholder.includes("أعيش بالبحر"),
    "No category inherits the old marine placeholder: " + category);
}
assert.equal(ai.getQuestionGuide("المصارعين").example, "هل هو من أيرلندا؟",
  "Wrestlers now have a sourced, category-relevant example question");
assert.equal(ai.getQuestionGuide("الدول").example, "هل تقع في آسيا؟",
  "Countries receive a geography example");
const wrestlerMarineQuestion = ai.answer("المصارعين", "أندرتيكر", "هل أعيش بالبحر؟");
assert.equal(wrestlerMarineQuestion.known, false, "Marine habitat is not treated as a wrestler fact");
assert.equal(wrestlerMarineQuestion.reason, "category-mismatch", "Cross-category questions get a clear mismatch reason");
assert.match(wrestlerMarineQuestion.answer, /المصارعين/);
assert.match(wrestlerMarineQuestion.answer, /كائنات البحر والحيوانات/);
assert.equal(ai.answer("الحيوانات", "دلفين", "هل أعيش بالبحر؟").answer, "نعم",
  "A valid marine question remains supported for an animal");
assert.equal(ai.answer("الدول", "العراق", "هل أنت طائر؟").answer, "لا",
  "General category identity questions can still eliminate an incompatible category");
assert.equal(ai.answer("الدول", "العراق", "هل أعيش بالبحر؟").reason, "category-mismatch",
  "Animal habitat questions are rejected in the countries category");
assert.equal(ai.answer("المصارعين", "أندرتيكر", "هل هو شخص حقيقي؟").answer, "نعم",
  "Category-relevant wrestler questions remain supported");

console.log("PASS: Oras knowledge engine covers all " + appCategories.length +
  " game categories, Iraqi Arabic question variants, curated facts and safe abstention.");

assert.equal(ai.getQuestionGuide("السيارات").example, "هل هي كهربائية؟", "Car example must be a supported property");
assert.equal(ai.getQuestionGuide("الأكلات").example, "هل هي حلوى؟", "Food example must be a supported property");
assert.equal(ai.getQuestionGuide("المصارعين").example, "هل هو من أيرلندا؟", "Wrestler example must be a supported fact");

assert.equal(ai.getQuestionGuide("السيارات").example, "هل هي كهربائية؟", "Car example must be a supported property");
assert.equal(ai.getQuestionGuide("الأكلات").example, "هل هي حلوى؟", "Food example must be a supported property");


// The fact catalog is intentionally explicit: every category item is validated before
// answering, and every supported property has a question path exercised below.
const factQueries = {
  "الحيوانات": {
    small:["هل الحيوان صغير الحجم؟","نعم، الحجم صغير."],
    medium:["هل الحيوان متوسط الحجم؟","نعم، الحجم متوسط."],
    large:["هل الحيوان كبير الحجم؟","نعم، الحجم كبير."],
    marine:["هل يعيش بالبحر؟","نعم"],
    mammal:["هل هو من الثدييات؟","نعم"],
    reptile:["هل هو من الزواحف؟","نعم"],
    bird:["هل هو من الطيور؟","نعم"],
    predator:["هل هو مفترس؟","نعم"],
    domestic:["هل هو أليف؟","نعم"]
  },
  "الطيور": {
    flightless:["هل يطير؟","لا"],
    flightCapable:["هل يطير؟","نعم"],
    waterBird:["هل هو طائر مائي؟","نعم"]
  },
  "الدول": {
    arab:["هل هي دولة عربية؟","نعم"],
    asia:["هل تقع في آسيا؟","نعم"],
    europe:["هل تقع في أوروبا؟","نعم"],
    africa:["هل تقع في أفريقيا؟","نعم"],
    southAmerica:["هل تقع في أمريكا الجنوبية؟","نعم"],
    northAmerica:["هل تقع في أمريكا الشمالية؟","نعم"],
    oceania:["هل تقع في أوقيانوسيا؟","نعم"]
  },
  "السيارات": {
    electric:["هل السيارة كهربائية؟","نعم"],
    japanese:["هل هي يابانية؟","نعم"],
    german:["هل هي ألمانية؟","نعم"],
    italian:["هل هي إيطالية؟","نعم"],
    american:["هل هي أمريكية؟","نعم"],
    british:["هل هي بريطانية؟","نعم"],
    southKorean:["هل هي كورية جنوبية؟","نعم"],
    swedish:["هل هي سويدية؟","نعم"]
  },
  "الأكلات": {
    iraqi:["هل هي أكلة عراقية؟","نعم"],
    sweet:["هل هي حلوى؟","نعم"]
  },
  "الفواكه": {
    citrus:["هل هي من الحمضيات؟","نعم"],
    red:["هل لونها أحمر؟","نعم"],
    tropical:["هل هي فاكهة استوائية؟","نعم"]
  },
  "كائنات البحر": {
    mammal:["هل هو من الثدييات؟","نعم"],
    fish:["هل هو من الأسماك؟","نعم"],
    invertebrate:["هل هو من اللافقاريات؟","نعم"]
  },
  "الآلات الموسيقية": {
    string:["هل هو آلة وترية؟","نعم"],
    wind:["هل هو آلة نفخ؟","نعم"],
    percussion:["هل هو آلة إيقاعية؟","نعم"],
    keyboard:["هل هو من آلات لوحة المفاتيح؟","نعم"]
  },
  "الرياضات": {
    team:["هل هي رياضة جماعية؟","نعم"],
    individual:["هل هي رياضة فردية؟","نعم"],
    water:["هل هي رياضة مائية؟","نعم"],
    combat:["هل هي رياضة قتالية؟","نعم"]
  },
  "المعالم": {
    france:["هل يقع في فرنسا؟","نعم"],
    egypt:["هل يقع في مصر؟","نعم"],
    uae:["هل يقع في الإمارات؟","نعم"],
    china:["هل يقع في الصين؟","نعم"],
    india:["هل يقع في الهند؟","نعم"],
    italy:["هل يقع في إيطاليا؟","نعم"],
    jordan:["هل يقع في الأردن؟","نعم"],
    iraq:["هل يقع في العراق؟","نعم"],
    uk:["هل يقع في بريطانيا؟","نعم"],
    peru:["هل يقع في بيرو؟","نعم"],
    usa:["هل يقع في أمريكا؟","نعم"],
    saudi:["هل يقع في السعودية؟","نعم"],
    brazil:["هل يقع في البرازيل؟","نعم"],
    cambodia:["هل يقع في كمبوديا؟","نعم"],
    spain:["هل هو في إسبانيا؟","نعم"],
    canada:["هل هو في كندا؟","نعم"],
    turkey:["هل هو في تركيا؟","نعم"],
    nepal:["هل هو في نيبال؟","نعم"],
    chile:["هل هو في تشيلي؟","نعم"]
  }
};

const metadataFactKeys = new Set([
  "known","marineNo","originKnown","franchiseKnown","universeKnown","fieldKnown"
]);
for (const category of ai.getCategories()) {
  const items = ai.getItems(category);
  const itemSet = new Set(items.map(ai.normalize));
  assert.ok(items.length > 0, category + " must have selectable secrets");
  assert.equal(items.length, new Set(items.map(ai.normalize)).size,
    category + " must not contain normalization-colliding secrets");
  const facts = ai.getFacts(category);
  for (const [factKey, values] of Object.entries(facts)) {
    for (const value of values) {
      const probe = ai.answer(category, value, "سؤال غير مدعوم عمداً");
      assert.notEqual(probe.reason, "unknown-entity",
        category + "/" + factKey + "/" + value + " must resolve to a selectable catalog item");
      assert.ok(itemSet.has(ai.normalize(value)) || probe.reason !== "unknown-entity",
        category + "/" + factKey + " fact values must remain in the category catalog");
    }
  }
  for (const [factKey, [question, expected]] of Object.entries(factQueries[category] || {})) {
    const values = facts[factKey];
    assert.ok(Array.isArray(values) && values.length > 0,
      category + "/" + factKey + " must contain curated facts");
    for (const secret of values) {
      const result = ai.answer(category, secret, question);
      assert.equal(result.answer, expected,
        "Every " + category + "/" + factKey + " fact must answer consistently: " + secret);
      assert.equal(result.known, true,
        "Every " + category + "/" + factKey + " fact must be explicitly known");
    }
  }
}

// Exercise every newly-added fact intent using a real member and, where the dataset is
// declared complete, a real non-member. This catches both false positives and false negatives.
const intentPatterns = new Map(ai.getIntentPatterns());
const factIntents = ai.getFactIntents();
for (const [intent, categoryEntries] of Object.entries(factIntents)) {
  const phrases = intentPatterns.get(intent);
  assert.ok(Array.isArray(phrases) && phrases.length > 0, intent + " needs question phrases");
  for (const [category, definition] of Object.entries(categoryEntries)) {
    const facts = ai.getFacts(category);
    const members = facts[definition.key] || [];
    if (!members.length) {
      assert.equal(intent, "landmarkAustralia",
        intent + " may have an empty positive set only when ambiguity is intentional");
      const ambiguous = ai.answer(category, "دار الأوبرا", "هل يقع في أستراليا؟");
      assert.equal(ambiguous.known, false, "Ambiguous opera-house entry must abstain");
      assert.equal(ambiguous.answer, ai.unknown, "Ambiguous landmark must not receive a guessed country");
      continue;
    }
    const question = "هل هو " + phrases[0] + "؟";
    for (const member of members) {
      const result = ai.answer(category, member, question);
      assert.equal(result.answer, "نعم", intent + " positive fact: " + category + "/" + member);
      assert.equal(result.known, true, intent + " must mark a supported fact as known");
    }
    if (definition.knownKey) {
      const knownItems = facts[definition.knownKey] || [];
      const nonMember = knownItems.find(item => !members.some(member => ai.normalize(member) === ai.normalize(item)));
      if (nonMember) {
        const result = ai.answer(category, nonMember, question);
        assert.equal(result.answer, "لا", intent + " negative fact: " + category + "/" + nonMember);
        assert.equal(result.known, true, intent + " must prove negatives only inside its completeness set");
      }
    }
  }
}

// Category and property consistency: exhaustive partitions must not overlap or leave gaps.
function assertPartition(category, keys, knownKey, label) {
  const facts = ai.getFacts(category);
  const known = new Set((facts[knownKey] || ai.getItems(category)).map(ai.normalize));
  const owners = new Map();
  for (const key of keys) {
    for (const item of facts[key] || []) {
      const normalized = ai.normalize(item);
      owners.set(normalized, (owners.get(normalized) || 0) + 1);
    }
  }
  for (const item of known) assert.equal(owners.get(item) || 0, 1, label + " must classify " + item + " exactly once");
  for (const item of owners.keys()) assert.ok(known.has(item), label + " must not classify an unregistered item: " + item);
}
assertPartition("الدول", ["asia","europe","africa","southAmerica","northAmerica","oceania"], "undefined", "UN M49 continent partition");
assertPartition("كائنات البحر", ["mammal","fish","invertebrate"], "undefined", "marine taxonomy partition");
assertPartition("الآلات الموسيقية", ["string","wind","percussion","keyboard"], "undefined", "instrument-family partition");
assertPartition("الرياضات", ["team","individual"], "undefined", "team/individual sport partition");
assertPartition("السيارات", ["japanese","german","italian","american","british","southKorean","swedish"], "originKnown", "car manufacturer origin partition");
assertPartition("لاعبو كرة القدم", ["argentina","portugal","brazil","egypt","france","croatia","norway","england","saudi","iraq","spain","poland","belgium","algeria","morocco","southKorea"], "originKnown", "footballer nationality partition");
assertPartition("شخصيات الألعاب", ["godOfWar","mario","sonic","tombRaider","halo","marvel","redDead","uncharted","residentEvil","witcher","assassinsCreed","mortalKombat","metalGear","crash","pacman","finalFantasy","horizon","doom","punchOut"], "franchiseKnown", "game franchise partition");
assertPartition("الأفلام", ["dc","starWars","pirates","sherlock","harryPotter","indianaJones","forrestGump","rocky","johnWick","marvel","shrek","toyStory","frozen","findingNemo","mrBean","rambo","terminator","kingKong","godzilla"], "franchiseKnown", "film franchise partition");
assertPartition("الأنمي", ["naruto","dragonBall","onePiece","attackOnTitan","demonSlayer","deathNote","fullmetalAlchemist","hunterXHunter","onePunchMan","jujutsuKaisen"], "franchiseKnown", "anime series partition");
assertPartition("الأبطال الخارقون", ["marvel","dc"], "universeKnown", "Marvel/DC universe partition");
assertPartition("المهن", ["medical","engineering","publicSafety","education","food","agriculture","media","legal","transport","trades","technology","sports","personalCare"], "fieldKnown", "profession-field partition");

const animalFacts = ai.getFacts("الحيوانات");
const sizeGroups = ["small","medium","large"].map(key => new Set((animalFacts[key] || []).map(ai.normalize)));
for (let a = 0; a < sizeGroups.length; a++) for (let b = a + 1; b < sizeGroups.length; b++) {
  for (const item of sizeGroups[a]) assert.ok(!sizeGroups[b].has(item), "Animal size groups must not contradict: " + item);
}
const birdFacts = ai.getFacts("الطيور");
for (const item of birdFacts.flightless) assert.ok(!birdFacts.flightCapable.some(value => ai.normalize(value) === ai.normalize(item)), "A bird cannot be both flightless and flight-capable");
const landmarkFacts = ai.getFacts("المعالم");
assert.ok(landmarkFacts.usa.some(x => ai.normalize(x) === ai.normalize("شلالات نياگرا")) &&
  landmarkFacts.canada.some(x => ai.normalize(x) === ai.normalize("شلالات نياگرا")),
  "Niagara Falls is intentionally shared by Canada and the United States");
assert.ok(landmarkFacts.nepal.some(x => ai.normalize(x) === ai.normalize("جبل إيفرست")) &&
  landmarkFacts.china.some(x => ai.normalize(x) === ai.normalize("جبل إيفرست")),
  "Mount Everest is intentionally shared by Nepal and China");

const dialectCases = [
  ["لاعبو كرة القدم","يونس محمود","هو عراقي؟","نعم"],
  ["لاعبو كرة القدم","يونس محمود","هوه من العراق؟","نعم"],
  ["المصارعين","فين بالور","هو أيرلندي؟","نعم"],
  ["المصارعين","درو ماكنتاير","هل هو اسكتلندي؟","نعم"],
  ["السيارات","تويوتا","يابانية؟","نعم"],
  ["السيارات","فولفو","ألمانية؟","لا"],
  ["السيارات","فولفو","سويدية؟","نعم"],
  ["السيارات","ماكلارين","هل هي بريطانية؟","نعم"],
  ["السيارات","ماكلارين","هل هي إيطالية؟","لا"],
  ["شخصيات الألعاب","كراتوس","هل هو من لعبة God of War؟","نعم"],
  ["شخصيات الألعاب","كراتوس","هل هو من لعبة كاد اوف وار؟","نعم"],
  ["الأفلام","باتمان","هل هو من عالم دي سي؟","نعم"],
  ["الأفلام","جوكر","هل هو من مارفل؟","لا"],
  ["الأنمي","غوكو","هل هو من دراغون بول؟","نعم"],
  ["الأبطال الخارقون","سوبرمان","هل هو من عالم مارفل؟","لا"],
  ["المهن","طبيب","هل هي من المهن الطبية؟","نعم"],
  ["المهن","نجّار","هل هي من المهن الطبية؟","لا"],
  ["شخصيات تاريخية","أينشتاين","هل هو عالم؟","نعم"],
  ["شخصيات تاريخية","كليوباترا","هل هي عالمة؟","لا"],
  ["شخصيات تاريخية","ابن بطوطة","هل هو رحالة؟","نعم"],
  ["المعالم","شلالات نياگرا","هل يقع في كندا؟","نعم"],
  ["المعالم","شلالات نياگرا","هل يقع في أمريكا؟","نعم"],
  ["المعالم","جبل إيفرست","هل هو في نيبال؟","نعم"],
  ["المعالم","جبل إيفرست","هل هو في الصين؟","نعم"],
  ["المعالم","قصر الحمراء","هل هو في إسبانيا؟","نعم"],
  ["المعالم","أيا صوفيا","هل هو في تركيا؟","نعم"],
  ["المعالم","جزيرة الفصح","هل هي في تشيلي؟","نعم"]
];
for (const [category, secret, question, expected] of dialectCases) {
  const result = ai.answer(category, secret, question);
  assert.equal(result.answer, expected, "Iraqi/Arabic/English variant: " + category + "/" + secret + "/" + question);
  assert.equal(result.known, true, "A normalized supported variant must be known");
}
assert.equal(ai.answer("السيارات","BMW","هل هي مو ألمانية؟").answer,"لا",
  "Negative polarity must invert a known car-origin fact");
assert.equal(ai.answer("السيارات","فولفو","هل هي مو ألمانية؟").answer,"نعم",
  "Negative polarity must preserve a known non-member");
assert.equal(ai.answer("لاعبو كرة القدم","يونس محمود","هل هو مو عراقي؟").answer,"لا",
  "Iraqi negation must invert a known nationality fact");
assert.equal(ai.answer("انمي","غوكو","هل هو من دراغون بول؟").answer,"نعم",
  "Category aliases must resolve to the canonical category");
assert.equal(ai.answer("شخصيات العاب","كراتوس","هل هو من لعبة God of War؟").answer,"نعم",
  "Category spelling variants must resolve consistently");
assert.equal(ai.normalize("  گُل؟ ٤٠\u200B"),"كل 40",
  "Normalization removes Iraqi letters, Arabic digits, punctuation and zero-width characters");
assert.equal(ai.normalize("إِنْجِلْتَرَا"),"انجلترا",
  "Normalization removes Arabic diacritics and normalizes alef forms");

const unknownSecret = ai.answer("المصارعين","مصارع غير موجود","هل أنت مصارع؟");
assert.equal(unknownSecret.known,false,"A secret outside the selectable pool must not receive category-based yes/no");
assert.equal(unknownSecret.reason,"unknown-entity","Unknown secrets are rejected before fact lookup");
assert.equal(unknownSecret.answer,ai.unknown,"Unknown secret must abstain");
assert.equal(ai.answer("المصارعين","أندرتيكر","هل يتحدث اليابانية؟").answer,ai.unknown,
  "Unsupported biography details must abstain rather than invent a binary answer");
assert.equal(ai.answer("شخصيات الألعاب","سبيكتر","هل هو من لعبة God of War؟").known,false,
  "An unclassified game character must abstain on unsupported franchise data");
assert.equal(ai.answer("المعالم","دار الأوبرا","هل يقع في أستراليا؟").answer,ai.unknown,
  "The generic opera-house label must not be assumed to mean the Sydney Opera House");

const appQuestionLimits = [...app.matchAll(/\{easy:10,medium:8,hard:6,expert:4\}/g)];
assert.ok(appQuestionLimits.length >= 2,"Main Who game must retain all four question limits");
assert.ok(app.includes("whoQuestionsAsked=0"),"A new main-game round must reset its question counter");
assert.equal([...app.matchAll(/whoQuestionsAsked\+\+/g)].length,2,
  "The main game must keep exactly one counter increment for each of its two input paths");
for (const match of app.matchAll(/whoQuestionsAsked\+\+/g)) {
  const prefix = app.slice(Math.max(0,match.index-260),match.index);
  assert.ok(prefix.includes("whoQuestionsAsked>=limit"),
    "Both main-game input paths must check the limit before consuming a question");
}
assert.ok(practiceSource.includes("s.askLimit=[10,8,6,4][difficultyRank(s)]"),
  "Local AI practice must retain 10/8/6/4 questions by difficulty");
assert.ok(practiceSource.includes("s.log.length>=s.askLimit"),
  "Local AI practice must block questions after the selected limit");
assert.ok(practiceSource.includes("window.__SUWAD_WHO_ANSWER=game===\"who\"?answerCurrentWho:null"),
  "Assistant callback must remain bound only to the active Who practice session");
assert.ok(practiceSource.includes("s.log.push({q,a:result.answer})"),
  "Every accepted practice question must be logged once");
assert.ok(ai.getFactSources().countries.includes("unstats.un.org") &&
  ai.getFactSources().superheroesMarvel.includes("marvel.com") &&
  ai.getFactSources().superheroesDC.includes("dc.com") &&
  ai.getFactSources().wrestlers.includes("wwe.com") &&
  ai.getFactSources().historical.includes("britannica.com"),
  "Knowledge sources must remain discoverable for review");

console.log("PASS: all " + appCategories.length + " category catalogs, curated fact members, question intents, contradiction partitions, Iraqi variants, safe abstention and unchanged question budgets.");
