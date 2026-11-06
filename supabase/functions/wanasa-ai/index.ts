import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const ORIGIN = "https://callmobile2004-source.github.io";
const MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-3.5-flash-lite";
const CORS = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
  "Cache-Control": "no-store",
};

const GAME_NAMES: Record<string, string> = {
  who: "خمن منو آني",
  number: "تخمين الرقم",
  liar: "برا السالفة",
  yesno: "ممنوع إي ولا",
  most: "منو الأكثر",
  snakes: "حية ودرج",
  domino: "دومينوا",
  tavla: "طاولي",
  colors: "كروت الألوان",
  quiz: "تحدي الأسئلة",
  wheel: "دولاب الوناسة",
};

function response(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: CORS });
}

function fail(message: string, status: number) {
  return response({ error: message }, status);
}

function readDefaultKey(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const key = (parsed as Record<string, unknown>).default;
      return typeof key === "string" && key ? key : null;
    }
  } catch { return null; }
  return null;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (origin && origin !== ORIGIN) return fail("مصدر الطلب غير مسموح.", 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return fail("طريقة الطلب غير مدعومة.", 405);

  const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "");
  const token = bearer?.[1]?.trim();
  if (!token || token.length > 8192) return fail("سجّل الدخول أولاً.", 401);

  const url = Deno.env.get("SUPABASE_URL");
  const publishable = readDefaultKey(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")) ?? Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!url || !publishable || !service) return fail("إعداد خدمة المساعد غير مكتمل على الخادم.", 503);
  if (!geminiKey) return fail("مفتاح Gemini غير مضاف إلى أسرار Supabase بعد.", 503);

  const userClient = createClient(url, publishable, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data: auth, error: authError } = await userClient.auth.getUser(token);
  if (authError || !auth.user) return fail("جلسة الدخول غير صالحة.", 401);
  const userId = auth.user.id;

  let input: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (!raw || raw.length > 6000) return fail("حجم الطلب غير صالح.", 413);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fail("صيغة الطلب غير صالحة.", 400);
    input = parsed as Record<string, unknown>;
  } catch { return fail("تعذّر قراءة الطلب.", 400); }

  const mode = input.mode === "game_help" ? "game_help" : input.mode === "public_chat" ? "public_chat" : "";
  if (!mode) return fail("نوع طلب المساعد غير معروف.", 400);

  const admin = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  // Conservative per-user quotas to protect the shared free-tier allowance.
  const { data: recent, error: recentError } = await admin
    .from("ai_request_usage")
    .select("id,created_at")
    .eq("user_id", userId)
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
  if (recentError) return fail("تعذّر التحقق من حد استخدام المساعد.", 503);
  if ((recent ?? []).length >= 12) return fail("وصلت للحد المؤقت للمساعد. جرّب بعد ساعة.", 429);

  let prompt = "";
  let messageId: string | null = null;
  let gameName = "";

  if (mode === "public_chat") {
    messageId = typeof input.messageId === "string" ? input.messageId : null;
    if (!messageId || !/^[0-9a-f-]{36}$/i.test(messageId)) return fail("معرّف الرسالة غير صالح.", 400);
    const { data: message, error } = await admin
      .from("public_messages")
      .select("id,sender_id,body")
      .eq("id", messageId)
      .maybeSingle();
    if (error || !message || message.sender_id !== userId) return fail("الرسالة غير متاحة لهذا الحساب.", 404);
    if (!/@مساعد_الوناسة|@مساعد|@wanasaai/i.test(message.body)) return fail("مناداة المساعد غير موجودة في الرسالة.", 400);
    prompt = message.body.replace(/@مساعد_الوناسة|@مساعد|@wanasaai/gi, "").trim();
    if (!prompt) prompt = "عرّف بنفسك وقل للاعبين شلون تگدر تساعدهم.";
    if ([...prompt].length > 700) return fail("اختصر سؤالك إلى ٧٠٠ حرف.", 400);
  } else {
    const gameKey = typeof input.gameKey === "string" ? input.gameKey : "";
    const question = typeof input.question === "string" ? input.question.trim() : "";
    if (!GAME_NAMES[gameKey]) return fail("اللعبة المطلوبة غير مدعومة.", 400);
    if (!question || [...question].length > 700) return fail("اكتب سؤالاً من حرف واحد إلى ٧٠٠ حرف.", 400);
    gameName = GAME_NAMES[gameKey];
    prompt = question;
  }

  const { error: usageError } = await admin.from("ai_request_usage").insert({
    user_id: userId,
    request_kind: mode,
  });
  if (usageError) return fail("تعذّر تسجيل استخدام المساعد.", 503);

  const systemInstruction = mode === "public_chat"
    ? "أنت مساعد سَـوَاد وناسة داخل دردشة جماعية عراقية. أجب باللهجة العراقية المفهومة، باختصار وود واحترام. ساعد في الأسئلة والألعاب والاقتراحات، ولا تزعج النقاش. لا تكشف بيانات خاصة، ولا تدّع معرفة شيء غير موجود. إذا كان السؤال خارج السياق، أجب بأدب. اجعل الرد أقل من 700 حرف."
    : `أنت مساعد ألعاب سَـوَاد وناسة. اللعبة الحالية: ${gameName}. اشرح القواعد، اقترح أفكاراً أو أسئلة، وساعد اللاعبين باللهجة العراقية. لا تكشف الأدوار السرية أو الإجابات المخفية أو أسرار حالة اللعبة، ولا تتخذ قرارات نيابة عن محرك اللعبة. اجعل الرد أقل من 700 حرف.`;

  try {
    const gemini = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.65, maxOutputTokens: 450 },
        }),
      },
    );
    const result = await gemini.json().catch(() => ({}));
    if (!gemini.ok) {
      console.error("[wanasa-ai] Gemini request failed", { status: gemini.status });
      return fail(gemini.status === 429 ? "المساعد مشغول حالياً بسبب حد الاستخدام المجاني. جرّب لاحقاً." : "تعذّر الحصول على رد من المساعد حالياً.", gemini.status === 429 ? 429 : 502);
    }
    const answer = result?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => typeof part.text === "string" ? part.text : "")
      .join("")
      .trim();
    if (!answer) return fail("المساعد ما رجّع إجابة واضحة. جرّب صياغة السؤال مرة ثانية.", 502);

    if (mode === "public_chat" && messageId) {
      const { error: saveError } = await admin.from("public_chat_ai_replies").upsert({
        message_id: messageId,
        response: answer.slice(0, 3000),
        model: MODEL,
      }, { onConflict: "message_id" });
      if (saveError) {
        console.error("[wanasa-ai] reply persistence failed", { code: saveError.code ?? "unknown" });
        return fail("وصل رد المساعد لكن تعذّر حفظه في الشات.", 502);
      }
    }
    return response({ answer, mode, model: MODEL });
  } catch (error) {
    console.error("[wanasa-ai] request failed", error instanceof Error ? error.message : "unknown");
    return fail("تعذّر الاتصال بخدمة الذكاء الاصطناعي.", 502);
  }
});
