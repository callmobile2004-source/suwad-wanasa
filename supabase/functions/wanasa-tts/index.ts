import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const ORIGIN = "https://callmobile2004-source.github.io";
const MODEL = "gemini-2.5-flash-preview-tts";
const ALLOWED_ORIGINS = new Set([ORIGIN, "https://suwad-wanasa.pages.dev"]);
const CORS = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
  "Cache-Control": "no-store",
};

const VOICES = {
  tutorial: {
    voice: "Sulafat",
    direction: "صوت دافئ وناعم وواضح، نبرة تعليمية مطمئنة، سرعة معتدلة، مخارج حروف واضحة، من دون مبالغة أو تمثيل.",
  },
  commentator: {
    voice: "Sadachbia",
    direction: "صوت رجولي حيوي ومتحمس، إلقاء عراقي عفوي، إيقاع سريع باعتدال، مرح من دون صراخ أو مبالغة.",
  },
  assistant: {
    voice: "Achird",
    direction: "صوت رجولي ودود وطبيعي، هادئ وواضح، كأنه صديق يشرح لصديقه باللهجة العراقية المفهومة.",
  },
} as const;

function reply(body: Record<string, unknown>, status = 200, origin = ORIGIN) {
  return Response.json(body, {
    status,
    headers: { ...CORS, "Access-Control-Allow-Origin": origin },
  });
}

function pcmToWav(data: Uint8Array, mimeType: string): Uint8Array {
  const rateMatch = /rate=(\d+)/i.exec(mimeType);
  const sampleRate = rateMatch ? Number(rateMatch[1]) : 24000;
  const channels = 1;
  const bitsPerSample = 16;
  const usableLength = data.length - (data.length % 2);
  const wav = new Uint8Array(44 + usableLength);
  const view = new DataView(wav.buffer);
  const write = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) wav[offset + i] = value.charCodeAt(i);
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + usableLength, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bitsPerSample / 8, true);
  view.setUint16(32, channels * bitsPerSample / 8, true);
  view.setUint16(34, bitsPerSample, true);
  write(36, "data");
  view.setUint32(40, usableLength, true);
  wav.set(data.subarray(0, usableLength), 44);
  return wav;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const corsOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : ORIGIN;
  if (origin && !ALLOWED_ORIGINS.has(origin)) return reply({ error: "مصدر الطلب غير مسموح." }, 403, corsOrigin);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...CORS, "Access-Control-Allow-Origin": corsOrigin } });
  if (req.method !== "POST") return reply({ error: "طريقة الطلب غير مدعومة." }, 405, corsOrigin);

  const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "");
  const token = bearer?.[1]?.trim();
  if (!token || token.length > 8192) return reply({ error: "سجّل الدخول أولاً." }, 401, corsOrigin);

  const url = Deno.env.get("SUPABASE_URL");
  const publishable = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  if (!url || !publishable || !geminiKey) {
    console.error("[wanasa-tts] required environment is incomplete");
    return reply({ error: "خدمة الصوت غير مهيّأة بالكامل." }, 503, corsOrigin);
  }

  const client = createClient(url, publishable, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data: auth, error: authError } = await client.auth.getUser(token);
  if (authError || !auth.user) return reply({ error: "جلسة الدخول غير صالحة." }, 401, corsOrigin);

  let input: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (!raw || raw.length > 12000) return reply({ error: "حجم النص غير صالح." }, 413, corsOrigin);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return reply({ error: "صيغة الطلب غير صالحة." }, 400, corsOrigin);
    input = parsed as Record<string, unknown>;
  } catch {
    return reply({ error: "تعذّر قراءة طلب الصوت." }, 400, corsOrigin);
  }

  const kind = typeof input.kind === "string" ? input.kind : "";
  if (!(kind in VOICES)) return reply({ error: "نوع الصوت غير معروف." }, 400, corsOrigin);
  const text = typeof input.text === "string" ? input.text.trim() : "";
  const maxChars = kind === "tutorial" ? 2200 : kind === "assistant" ? 900 : 220;
  if (!text || [...text].length > maxChars) return reply({ error: "النص فارغ أو أطول من الحد المسموح." }, 400, corsOrigin);

  const { data: recent, error: usageReadError } = await client
    .from("ai_request_usage")
    .select("id")
    .eq("user_id", auth.user.id)
    .eq("request_kind", "tts")
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
  if (usageReadError) return reply({ error: "تعذّر التحقق من حد استخدام الصوت." }, 503, corsOrigin);
  if ((recent ?? []).length >= 30) return reply({ error: "وصلت إلى حد الصوت المجاني المؤقت. جرّب بعد ساعة." }, 429, corsOrigin);

  const { error: usageWriteError } = await client.from("ai_request_usage").insert({
    user_id: auth.user.id,
    request_kind: "tts",
  });
  if (usageWriteError) return reply({ error: "تعذّر تسجيل طلب الصوت." }, 503, corsOrigin);

  const profile = VOICES[kind as keyof typeof VOICES];
  const instruction = [
    "اقرأ النص العربي التالي فقط ولا تقرأ تعليمات الأداء.",
    "اللهجة المطلوبة: العربية العراقية الطبيعية والمفهومة، لا تستخدم الفصحى الثقيلة ولا تحوّل النص إلى لهجة أخرى.",
    "Audio direction: " + profile.direction,
    "Pronounce Arabic words clearly. Keep the original meaning and wording. Do not add greetings, explanations, or extra words.",
    "Text to speak:",
    text,
  ].join("\n");

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: instruction }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: profile.voice },
              },
            },
          },
        }),
      },
    );

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("[wanasa-tts] Gemini request failed", { status: response.status, statusText: response.statusText });
      if (response.status === 429) return reply({ error: "خدمة الصوت وصلت حد الاستخدام المجاني حالياً. جرّب لاحقاً." }, 429, corsOrigin);
      return reply({ error: "تعذّر توليد الصوت حالياً. النص يبقى متاحاً للقراءة." }, 502, corsOrigin);
    }

    const parts = result?.candidates?.[0]?.content?.parts ?? [];
    const audioPart = parts.find((part: any) => part?.inlineData?.data && String(part.inlineData.mimeType || "").startsWith("audio/"));
    if (!audioPart) {
      console.error("[wanasa-tts] Gemini response did not contain audio data");
      return reply({ error: "خدمة الصوت لم تُرجع ملفاً صوتياً صالحاً." }, 502, corsOrigin);
    }

    const mimeType = String(audioPart.inlineData.mimeType || "audio/L16;codec=pcm;rate=24000");
    const binary = atob(audioPart.inlineData.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const audio = /wav/i.test(mimeType) ? bytes : pcmToWav(bytes, mimeType);

    return reply({
      audioBase64: toBase64(audio),
      mimeType: "audio/wav",
      voice: profile.voice,
      model: MODEL,
    }, 200, corsOrigin);
  } catch (error) {
    console.error("[wanasa-tts] request failed", error instanceof Error ? error.message : "unknown");
    return reply({ error: "انقطع الاتصال بخدمة الصوت. النص يبقى متاحاً للقراءة." }, 502, corsOrigin);
  }
});
