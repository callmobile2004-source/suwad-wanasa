import { buildGameHelpInstruction, normalizeGameMode } from "./game-policy.ts";
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
  wheel: "دولاب التحدي",
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
  const allowedOrigins = new Set([ORIGIN, "https://suwad-wanasa.pages.dev"]);
  const corsOrigin = origin && allowedOrigins.has(origin) ? origin : ORIGIN;
  const requestResponse = (body: Record<string, unknown>, status = 200) =>
    Response.json(body, { status, headers: { ...CORS, "Access-Control-Allow-Origin": corsOrigin } });
  const requestFail = (message: string, status: number) => requestResponse({ error: message }, status);
  if (origin && !allowedOrigins.has(origin)) return requestFail("مصدر الطلب غير مسموح.", 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...CORS, "Access-Control-Allow-Origin": corsOrigin } });
  if (req.method !== "POST") return requestFail("طريقة الطلب غير مدعومة.", 405);

  const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "");
  const token = bearer?.[1]?.trim();
  if (!token || token.length > 8192) return requestFail("سجّل الدخول أولاً.", 401);

  const url = Deno.env.get("SUPABASE_URL");
  const publishable = readDefaultKey(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")) ?? Deno.env.get("SUPABASE_ANON_KEY");
  const service = readDefaultKey(Deno.env.get("SUPABASE_SECRET_KEYS")) ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  const missingEnvironment: string[] = [];
  if (!url) missingEnvironment.push("SUPABASE_URL");
  if (!publishable) missingEnvironment.push("SUPABASE_PUBLISHABLE_KEYS أو SUPABASE_ANON_KEY");
  if (!service) missingEnvironment.push("SUPABASE_SECRET_KEYS أو SUPABASE_SERVICE_ROLE_KEY");
  if (!geminiKey) missingEnvironment.push("GEMINI_API_KEY");
  if (missingEnvironment.length) {
    console.error("[wanasa-ai] environment configuration incomplete", { missing: missingEnvironment });
    return requestFail("إعدادات المساعد غير مكتملة: " + missingEnvironment.join("، "), 503);
  }
  console.info("[wanasa-ai] environment readiness confirmed", { supabaseUrl: true, publishableKey: true, secretKey: true, geminiKey: true });

  const userClient = createClient(url, publishable, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data: auth, error: authError } = await userClient.auth.getUser(token);
  if (authError || !auth.user) return requestFail("جلسة الدخول غير صالحة.", 401);
  const userId = auth.user.id;

  let input: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (!raw || raw.length > 6000) return requestFail("حجم الطلب غير صالح.", 413);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return requestFail("صيغة الطلب غير صالحة.", 400);
    input = parsed as Record<string, unknown>;
  } catch { return requestFail("تعذّر قراءة الطلب.", 400); }

  const mode = input.mode === "game_help" ? "game_help" : input.mode === "public_chat" ? "public_chat" : input.mode === "private_chat" ? "private_chat" : input.mode === "commentator" ? "commentator" : "";
  if (!mode) return requestFail("نوع طلب المساعد غير معروف.", 400);

  const admin = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const action = typeof input.action === "string" ? input.action : "send";
  if (mode === "private_chat" && action === "history") {
    const { data: history, error: historyError } = await admin
      .from("private_ai_messages")
      .select("id,role,body,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(40);
    if (historyError) return requestFail("تعذّر تحميل محادثة التجارب الخاصة.", 503);
    return requestResponse({ mode, messages: (history ?? []).reverse() });
  }
  if (mode === "private_chat" && action !== "send") return requestFail("نوع عملية المحادثة غير معروف.", 400);

  // Conservative per-user quotas to protect the shared free-tier allowance.
  const { data: recent, error: recentError } = await admin
    .from("ai_request_usage")
    .select("id,created_at")
    .eq("user_id", userId)
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
  if (recentError) return requestFail("تعذّر التحقق من حد استخدام المساعد.", 503);
  if ((recent ?? []).length >= 12) return requestFail("وصلت للحد المؤقت للمساعد. جرّب بعد ساعة.", 429);

  let prompt = "";
  let messageId: string | null = null;
  let gameName = "";
  let gameHelpSystemInstruction = "";

  let conversationContents: { role: string; parts: { text: string }[] }[] | null = null;
  if (mode === "public_chat") {
    messageId = typeof input.messageId === "string" ? input.messageId : null;
    if (!messageId || !/^[0-9a-f-]{36}$/i.test(messageId)) return requestFail("معرّف الرسالة غير صالح.", 400);
    const { data: message, error } = await admin
      .from("public_messages")
      .select("id,sender_id,body")
      .eq("id", messageId)
      .maybeSingle();
    if (error || !message || message.sender_id !== userId) return requestFail("الرسالة غير متاحة لهذا الحساب.", 404);
    if (!/@مساعد_الوناسة|@مساعد|@wanasaai/i.test(message.body)) return requestFail("مناداة المساعد غير موجودة في الرسالة.", 400);
    prompt = message.body.replace(/@مساعد_الوناسة|@مساعد|@wanasaai/gi, "").trim();
    if (!prompt) prompt = "عرّف بنفسك وقل للاعبين شلون تگدر تساعدهم.";
    if ([...prompt].length > 700) return requestFail("اختصر سؤالك إلى ٧٠٠ حرف.", 400);
  } else if (mode === "commentator") {
    const roomId = typeof input.roomId === "string" ? input.roomId : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(roomId)) return requestFail("معرّف الغرفة غير صالح.", 400);
    const [{ data: membership }, { data: room }, { data: feature }] = await Promise.all([
      admin.from("game_room_players").select("user_id").eq("room_id", roomId).eq("user_id", userId).maybeSingle(),
      admin.from("game_rooms").select("game_key,status").eq("id", roomId).maybeSingle(),
      admin.from("game_room_features").select("commentator_enabled,commentator_humor_enabled,commentator_muted").eq("room_id", roomId).maybeSingle(),
    ]);
    if (!membership || !room || room.status !== "playing") return requestFail("التعليق متاح للاعبين داخل جولة جارية فقط.", 403);
    if (!feature || !feature.commentator_enabled || feature.commentator_muted) return requestResponse({ answer: "", mode, muted: true });
    const { data: recentEvents } = await admin.from("game_room_action_events")
      .select("action").eq("room_id", roomId).order("created_at", { ascending: false }).limit(5);
    const labels: Record<string, string> = {
      "submit": "لاعب أرسل إجابته", "advance-vote": "انتقلت اللعبة إلى التصويت",
      "next-round": "بدأت جولة جديدة", "roll": "لاعب رمى النرد",
      "move-piece": "لاعب حرّك قطعة", "play-domino": "لاعب لعب قطعة دومينو",
      "draw-domino": "لاعب سحب قطعة", "play-color": "لاعب لعب كارت ألوان",
      "draw-color": "لاعب سحب كارت", "pass-color": "انتقل الدور للاعب التالي",
      "wheel-spin": "بدأ دوران دولاب التحدي", "finish-game": "انتهت اللعبة",
    };
    const eventSummary = (recentEvents ?? []).map((event: { action: string }) => labels[event.action]).filter(Boolean).slice(0, 3);
    if (!eventSummary.length) return requestResponse({ answer: "ها شباب، بعدنا بالبداية… ورّونا الحماس!", mode });
    gameName = GAME_NAMES[room.game_key] ?? "اللعبة الحالية";
    prompt = `علّق بجملة واحدة قصيرة باللهجة العراقية على أحداث لعبة ${gameName}: ${eventSummary.join("، ")}. لا تذكر أسماء أو نقاط غير موجودة ولا تخترع نتيجة.`;
    prompt += feature.commentator_humor_enabled
      ? " خلي التعليق خفيف الظل ومضحك بدون تجريح أو إحراج لأي لاعب."
      : " خلي التعليق رياضي ومحايد وبدون مزاح.";
  } else if (mode === "game_help") {
    const gameKey = typeof input.gameKey === "string" ? input.gameKey : "";
    const question = typeof input.question === "string" ? input.question.trim() : "";
    const instantGames = new Set(["snakes", "domino", "tavla", "colors", "wheel"]);
    if (!GAME_NAMES[gameKey]) return requestFail("اللعبة المطلوبة غير مدعومة.", 400);
    if ((!question && !instantGames.has(gameKey)) || [...question].length > 700) return requestFail("اكتب طلباً من حرف واحد إلى ٧٠٠ حرف.", 400);
    gameName = GAME_NAMES[gameKey];
    gameHelpSystemInstruction = buildGameHelpInstruction(gameKey, gameName, normalizeGameMode(input.gameMode));
    prompt = question || `اشرح باللهجة العراقية شلون أبدأ لعبة ${gameName} فوراً، ووضح ترتيب اللعب والدور والقواعد الأساسية والنصائح العملية. لا تقترح أسئلة أو ألغاز؛ هاي لعبة فورية. خليك رفيق لعب تفاعلي، وإذا أرسلتلك وضع الجولة أو حركتي جاوبني بالخطوة المناسبة، من دون ما تدّعي أنك تحرك القطع أو تدير محرك اللعبة.`;
  } else {
    const text = typeof input.message === "string" ? input.message.trim() : "";
    if (!text || [...text].length > 1000) return requestFail("اكتب رسالة من حرف واحد إلى ١٠٠٠ حرف.", 400);
    const { error: userSaveError } = await admin.from("private_ai_messages").insert({ user_id: userId, role: "user", body: text });
    if (userSaveError) return requestFail("تعذّر حفظ رسالتك في غرفة التجارب الخاصة.", 503);
    const { data: history, error: historyError } = await admin.from("private_ai_messages")
      .select("role,body").eq("user_id", userId).order("created_at", { ascending: false }).limit(16);
    if (historyError) return requestFail("تعذّر تجهيز سياق محادثة التجارب.", 503);
    conversationContents = (history ?? []).reverse().map((item: { role: string; body: string }) => ({
      role: item.role === "assistant" ? "model" : "user", parts: [{ text: item.body }],
    }));
    prompt = text;
  }

  const { error: usageError } = await admin.from("ai_request_usage").insert({
    user_id: userId,
    request_kind: mode,
  });
  if (usageError) return usageError.message?.includes("AI_RATE_LIMIT") ? fail("وصلت للحد المؤقت للمساعد. جرّب بعد ساعة.", 429) : fail("تعذّر تسجيل استخدام المساعد.", 503);

  const systemInstruction = mode === "commentator"
    ? "أنت أوراس المعلّق في سَـوَاد وناسة. اكتب تعليقاً عراقياً قصيراً جداً من جملة واحدة، على أحداث مؤكدة فقط. لا تكشف أسرار اللاعبين أو المهمات أو الإجابات المخفية، ولا تخترع أسماء أو نقاطاً أو فائزين. تجنب الإساءة والتنمر."
    : mode === "public_chat"
    ? "أنت مساعد سَـوَاد وناسة داخل دردشة جماعية عراقية. أجب باللهجة العراقية المفهومة، باختصار وود واحترام. ساعد في الأسئلة والألعاب والاقتراحات، ولا تزعج النقاش. لا تكشف بيانات خاصة، ولا تدّع معرفة شيء غير موجود. إذا كان السؤال خارج السياق، أجب بأدب. اجعل الرد أقل من 700 حرف."
    : mode === "private_chat"
      ? "أنت رفيق المستخدم الخاص في غرفة التجارب في سَـوَاد وناسة. هذه محادثة خاصة بصاحب الحساب وحده. تكلم باللهجة العراقية الودودة والطبيعية، ساعده في اختبار التحديثات والألعاب، تذكّر سياق الرسائل السابقة المرفقة، ولا تنشر أو تدّعي نشر أي شيء في الدردشة العامة. لا تكشف أسرار محركات الألعاب. اجعل الرد أقل من 1000 حرف."
: gameHelpSystemInstruction;

  try {
    const gemini = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: conversationContents ?? [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.65, maxOutputTokens: 450 },
        }),
      },
    );
    const result = await gemini.json().catch(() => ({}));
    if (!gemini.ok) {
      console.error("[wanasa-ai] Gemini request failed", { status: gemini.status });
      return requestFail(gemini.status === 429 ? "المساعد مشغول حالياً بسبب حد الاستخدام المجاني. جرّب لاحقاً." : "تعذّر الحصول على رد من المساعد حالياً.", gemini.status === 429 ? 429 : 502);
    }
    const answer = result?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => typeof part.text === "string" ? part.text : "")
      .join("")
      .trim();
    if (!answer) return requestFail("المساعد ما رجّع إجابة واضحة. جرّب صياغة السؤال مرة ثانية.", 502);

    if (mode === "private_chat") {
      const { error: saveError } = await admin.from("private_ai_messages").insert({ user_id: userId, role: "assistant", body: answer.slice(0, 3000) });
      if (saveError) return requestFail("وصل رد المساعد لكن تعذّر حفظه في محادثة التجارب.", 502);
    }
    if (mode === "public_chat" && messageId) {
      const { error: saveError } = await admin.from("public_chat_ai_replies").upsert({
        message_id: messageId,
        response: answer.slice(0, 3000),
        model: MODEL,
      }, { onConflict: "message_id" });
      if (saveError) {
        console.error("[wanasa-ai] reply persistence failed", { code: saveError.code ?? "unknown" });
        return requestFail("وصل رد المساعد لكن تعذّر حفظه في الشات.", 502);
      }
    }
    return requestResponse({ answer, mode, model: MODEL });
  } catch (error) {
    console.error("[wanasa-ai] request failed", error instanceof Error ? error.message : "unknown");
    return requestFail("تعذّر الاتصال بخدمة الذكاء الاصطناعي.", 502);
  }
});
