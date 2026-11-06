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
const practiceSource = fs.readFileSync(path.join(__dirname, "..", "game-ai-practice.js"), "utf8");
const practiceBlock = practiceSource.match(/const WHO_CATEGORIES = (\\{[\\s\\S]*?\\n\\});/);
assert.ok(practiceBlock, "The local Who practice category pool must be discoverable");
const practiceCategories = JSON.parse(practiceBlock[1]);
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
console.log("PASS: Oras knowledge engine covers all " + appCategories.length +
  " game categories, Iraqi Arabic question variants, curated facts and safe abstention.");
