// @ts-ignore Browser-compatible question-bank IIFE; intentionally writes to globalThis.
import "./quiz-question-bank.js";
// @ts-ignore Browser-compatible question-bank IIFE; intentionally writes to globalThis.
import "./quiz-category-banks.js";
// @ts-ignore Browser-compatible question-bank IIFE; intentionally writes to globalThis.
import "./quiz-religion-banks.js";
// @ts-ignore Browser-compatible question-bank IIFE; intentionally writes to globalThis.
import "./quiz-popculture-banks.js";
// @ts-ignore Browser-compatible question-bank IIFE; intentionally writes to globalThis.
import "./quiz-auto-brands-gaming-banks.js";
// @ts-ignore Browser-compatible question-bank IIFE; intentionally writes to globalThis.
import "./quiz-gaming-bank.js";

type Difficulty = "easy" | "medium" | "hard" | "expert";
type Source = { label: string; url: string };
type BankItem = {
  id: string;
  q: string;
  a: string[];
  c: number;
  explanation: string;
  source?: Source;
};
type Bank = {
  easy?: BankItem[];
  medium?: BankItem[];
  hard?: BankItem[];
  expert?: BankItem[];
  categories?: Record<string, Partial<Record<Difficulty, BankItem[]>>>;
};
type PublicQuestion = {
  id: string;
  category: string;
  difficulty: Difficulty;
  question: string;
  options: string[];
};
type PrivateAnswer = {
  questionId: string;
  correctChoice: number;
  explanation: string;
  source: Source | null;
};

const READY_CATEGORIES = new Set([
  "general", "wrestlers", "aqeeda-imami", "aqeeda-sunni", "anime",
  "cars", "brands", "gaming", "math", "medicine",
]);
const LEVELS = new Set<Difficulty>(["easy", "medium", "hard", "expert"]);
const bank = (globalThis as typeof globalThis & { SuwadQuizQuestionBank?: Bank }).SuwadQuizQuestionBank;

function secureIndex(max: number): number {
  if (!Number.isInteger(max) || max < 1) throw new Error("حجم بنك الأسئلة غير صالح.");
  const range = 0x100000000;
  const limit = Math.floor(range / max) * max;
  const sample = new Uint32Array(1);
  do { crypto.getRandomValues(sample); } while (sample[0] >= limit);
  return sample[0] % max;
}

function shuffledOptions(item: BankItem): { options: string[]; correctChoice: number } {
  const values = item.a.map((text, index) => ({ text, correct: index === item.c }));
  for (let i = values.length - 1; i > 0; i--) {
    const j = secureIndex(i + 1);
    [values[i], values[j]] = [values[j], values[i]];
  }
  return {
    options: values.map((value) => value.text),
    correctChoice: values.findIndex((value) => value.correct),
  };
}

export function pickOnlineQuizQuestion(
  category: string,
  difficulty: Difficulty,
  usedIds: string[] = [],
): { question: PublicQuestion; answer: PrivateAnswer } {
  if (!bank) throw new Error("بنك الأسئلة غير محمّل على الخادم.");
  if (!READY_CATEGORIES.has(category)) throw new Error("هذا القسم غير جاهز للعب أونلاين.");
  if (!LEVELS.has(difficulty)) throw new Error("مستوى الصعوبة غير صالح.");

  const pool = category === "general" ? bank[difficulty] : bank.categories?.[category]?.[difficulty];
  if (!Array.isArray(pool) || pool.length < 25) {
    throw new Error("بنك هذا القسم والمستوى لم يجتز فحص العدد المطلوب.");
  }

  const safePool = pool.filter((item) =>
    item && typeof item.id === "string" && item.id.length > 0 &&
    typeof item.q === "string" && item.q.trim().length > 0 &&
    Array.isArray(item.a) && item.a.length === 4 &&
    new Set(item.a.map((value) => String(value).trim().normalize("NFKC").toLowerCase())).size === 4 &&
    Number.isInteger(item.c) && item.c >= 0 && item.c < 4 &&
    typeof item.explanation === "string" && item.explanation.trim().length > 0 &&
    (category === "general" || (
      !!item.source && typeof item.source.label === "string" &&
      item.source.label.trim().length > 0 && typeof item.source.url === "string" &&
      /^https:\/\//.test(item.source.url)
    ))
  );
  if (safePool.length !== pool.length) throw new Error("تعذّر اجتياز فحص سلامة بنك الأسئلة.");
  const used = new Set(usedIds);
  const available = safePool.filter((item) => !used.has(item.id));
  if (!available.length) throw new Error("انتهت الأسئلة غير المستخدمة لهذا القسم والمستوى.");
  const item = available[secureIndex(available.length)];
  const shuffled = shuffledOptions(item);
  return {
    question: {
      id: item.id,
      category,
      difficulty,
      question: item.q,
      options: shuffled.options,
    },
    answer: {
      questionId: item.id,
      correctChoice: shuffled.correctChoice,
      explanation: item.explanation,
      source: item.source ? { label: item.source.label, url: item.source.url } : null,
    },
  };
}
