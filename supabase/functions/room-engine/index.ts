import { withSupabase } from "npm:@supabase/server@1.9.2";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_CHARS = 4096;

type EngineAction = "start-number" | "guess-number" | "restart-number";

function secureSecret(): number {
  const limit = Math.floor(0x100000000 / 100) * 100;
  const sample = new Uint32Array(1);
  do {
    crypto.getRandomValues(sample);
  } while (sample[0] >= limit);
  return (sample[0] % 100) + 1;
}

function responseError(message: string, status: number, code?: string): Response {
  return Response.json({ error: message, ...(code ? { code } : {}) }, { status });
}

function mapDatabaseError(code?: string): { status: number; message: string } {
  switch (code) {
    case "40001": return { status: 409, message: "تغيّرت حالة الغرفة؛ حدّث اللعبة وحاول مرة أخرى." };
    case "42501": return { status: 403, message: "ما عندك صلاحية لتنفيذ هذه الحركة." };
    case "22023": return { status: 400, message: "بيانات الحركة غير صالحة." };
    case "P0001": return { status: 429, message: "تمهّل قليلاً قبل التخمين التالي." };
    case "55000": return { status: 409, message: "حالة اللعبة لا تسمح بهذه الحركة." };
    default: return { status: 500, message: "تعذّر تنفيذ الحركة على الخادم. حاول مرة أخرى." };
  }
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return responseError("طريقة الطلب غير مدعومة.", 405);

    const actorId = ctx.userClaims?.id;
    if (typeof actorId !== "string" || !UUID_PATTERN.test(actorId)) {
      return responseError("جلسة اللاعب غير صالحة. سجّل الدخول من جديد.", 401);
    }

    const contentLength = Number(req.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_CHARS) {
      return responseError("حجم الطلب أكبر من المسموح.", 413);
    }

    let payload: Record<string, unknown>;
    try {
      const raw = await req.text();
      if (raw.length === 0 || raw.length > MAX_BODY_CHARS) return responseError("حجم الطلب غير صالح.", 413);
      const parsed: unknown = JSON.parse(raw);
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        return responseError("صيغة الطلب غير صالحة.", 400);
      }
      payload = parsed as Record<string, unknown>;
    } catch {
      return responseError("تعذّر قراءة بيانات الطلب.", 400);
    }

    const action = payload.action as EngineAction;
    const roomId = payload.roomId;
    const expectedUpdatedAt = payload.expectedUpdatedAt;
    if (!["start-number", "guess-number", "restart-number"].includes(action)) {
      return responseError("الأمر المطلوب غير معروف.", 400);
    }
    if (typeof roomId !== "string" || !UUID_PATTERN.test(roomId)) {
      return responseError("معرّف الغرفة غير صالح.", 400);
    }
    if (typeof expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(expectedUpdatedAt))) {
      return responseError("إصدار حالة الغرفة غير صالح.", 400);
    }

    let rpcName:
      | "engine_v2_start_number_game"
      | "engine_v2_guess_number"
      | "engine_v2_restart_number_game";
    const rpcArgs: Record<string, unknown> = {
      p_room_id: roomId,
      p_actor_id: actorId,
      p_expected_updated_at: expectedUpdatedAt,
    };

    if (action === "start-number") {
      rpcName = "engine_v2_start_number_game";
      rpcArgs.p_secret = secureSecret();
    } else if (action === "restart-number") {
      rpcName = "engine_v2_restart_number_game";
      rpcArgs.p_secret = secureSecret();
    } else {
      rpcName = "engine_v2_guess_number";
      const guess = payload.guess;
      if (typeof guess !== "number" || !Number.isInteger(guess) || guess < 1 || guess > 100) {
        return responseError("أدخل رقماً صحيحاً من ١ إلى ١٠٠.", 400);
      }
      rpcArgs.p_guess = guess;
    }

    const { data, error } = await ctx.supabaseAdmin.rpc(rpcName, rpcArgs);
    if (error) {
      const mapped = mapDatabaseError(error.code);
      console.error("[room-engine] database operation rejected", { action, code: error.code ?? "unknown" });
      return responseError(mapped.message, mapped.status, error.code);
    }

    const room = Array.isArray(data) ? data[0] : data;
    if (!room || typeof room !== "object" || !("id" in room)) {
      return responseError("استلمنا استجابة غير مكتملة من محرك اللعبة.", 502);
    }
    return Response.json({ room }, { status: 200 });
  }),
};
