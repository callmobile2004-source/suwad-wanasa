import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_CHARS = 4096;
const ALLOWED_ORIGIN = "https://callmobile2004-source.github.io";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Access-Control-Expose-Headers": "content-range, x-supabase-api-version",
  "Vary": "Origin",
  "Cache-Control": "no-store",
};

const NUMBER_ACTIONS = new Set(["start-number", "guess-number", "restart-number"]);
const TABLE_FLIP_ACTIONS = new Set(["claim-table-flip-challenge", "confirm-table-flip-challenge"]);
const V3_ACTIONS = new Set([
  "snapshot", "upgrade", "start", "finish-game",
  "roll", "select-piece", "move-piece",
  "play-domino", "draw-domino", "pass-domino",
  "play-color", "draw-color", "pass-color",
  "submit", "advance-vote", "next-round",
  "wheel-enter", "wheel-spin", "wheel-finish", "wheel-back", "wheel-again", "wheel-select",
]);

function secureSecret(): number {
  const limit = Math.floor(0x100000000 / 100) * 100;
  const sample = new Uint32Array(1);
  do { crypto.getRandomValues(sample); } while (sample[0] >= limit);
  return (sample[0] % 100) + 1;
}

function respond(body: Record<string, unknown>, status: number): Response {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

function responseError(message: string, status: number, code?: string): Response {
  return respond({ error: message, ...(code ? { code } : {}) }, status);
}

function mapDatabaseError(code?: string): { status: number; message: string } {
  switch (code) {
    case "40001": return { status: 409, message: "تغيّرت حالة الغرفة؛ حدّث اللعبة وحاول مرة أخرى." };
    case "42501": return { status: 403, message: "ما عندك صلاحية لتنفيذ هذه الحركة." };
    case "22023": return { status: 400, message: "بيانات الحركة غير صالحة." };
    case "23505": return { status: 409, message: "هذه الإجابة أو الحركة أُرسلت مسبقاً." };
    case "P0001": return { status: 429, message: "تمهّل قليلاً قبل المحاولة التالية." };
    case "55000": return { status: 409, message: "حالة اللعبة لا تسمح بهذه الحركة حالياً." };
    default: return { status: 500, message: "تعذّر تنفيذ الحركة على الخادم. حاول مرة أخرى." };
  }
}

function readDefaultKey(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const key = (parsed as Record<string, unknown>).default;
      return typeof key === "string" && key.length > 0 ? key : null;
    }
  } catch { return null; }
  return null;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (origin && origin !== ALLOWED_ORIGIN) return responseError("مصدر الطلب غير مسموح.", 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return responseError("طريقة الطلب غير مدعومة.", 405);

  const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "");
  const accessToken = bearer?.[1]?.trim();
  if (!accessToken || accessToken.length > 8192) {
    return responseError("جلسة اللاعب غير موجودة. سجّل الدخول من جديد.", 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = readDefaultKey(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")) ?? Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    console.error("[room-engine] required Supabase environment is unavailable");
    return responseError("إعداد محرك اللعبة غير مكتمل على الخادم.", 503);
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

  const action = typeof payload.action === "string" ? payload.action : "";
  const roomId = payload.roomId;
  const expectedUpdatedAt = payload.expectedUpdatedAt;
  if (!NUMBER_ACTIONS.has(action) && !V3_ACTIONS.has(action) && !TABLE_FLIP_ACTIONS.has(action)) {
    return responseError("الأمر المطلوب غير معروف.", 400);
  }
  if (typeof roomId !== "string" || !UUID_PATTERN.test(roomId)) {
    return responseError("معرّف الغرفة غير صالح.", 400);
  }
  if (action !== "snapshot" &&
      (typeof expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(expectedUpdatedAt)))) {
    return responseError("إصدار حالة الغرفة غير صالح.", 400);
  }

  // Verify the real session with Supabase Auth. This supports existing HS256 sessions.
  const userClient = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(accessToken);
  if (authError || !authData.user || !UUID_PATTERN.test(authData.user.id)) {
    return responseError("جلسة اللاعب غير صالحة أو انتهت. سجّل الدخول من جديد.", 401);
  }
  const actorId = authData.user.id;

  // Service role is held only in Supabase's Edge Function environment.
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  if (TABLE_FLIP_ACTIONS.has(action)) {
    const { data, error } = await admin.rpc("engine_resolve_table_flip_challenge", {
      p_room_id: roomId,
      p_actor_id: actorId,
      p_action: action,
      p_expected_updated_at: expectedUpdatedAt,
    });
    if (error) {
      const mapped = mapDatabaseError(error.code);
      console.error("[room-engine] table flip challenge rejected", { action, code: error.code ?? "unknown" });
      return responseError(mapped.message, mapped.status, error.code);
    }
    const room = Array.isArray(data) ? data[0] : data;
    if (!room || typeof room !== "object" || !("id" in room)) {
      return responseError("استلمنا استجابة غير مكتملة من تحدّي قلب الطاولة.", 502);
    }
    return respond({ room }, 200);
  }

  if (action === "snapshot") {
    const { data, error } = await admin.rpc("engine_v3_get_snapshot", {
      p_room_id: roomId,
      p_actor_id: actorId,
    });
    if (error) {
      const mapped = mapDatabaseError(error.code);
      console.error("[room-engine] snapshot rejected", { code: error.code ?? "unknown" });
      return responseError(mapped.message, mapped.status, error.code);
    }
    if (!data || typeof data !== "object" || !("room" in data)) {
      return responseError("تعذّر استرجاع حالة الغرفة الخاصة بهذا اللاعب.", 502);
    }
    return respond({
      room: (data as Record<string, unknown>).room as unknown,
      privateState: (data as Record<string, unknown>).privateState ?? {},
    }, 200);
  }

  if (NUMBER_ACTIONS.has(action)) {
    let rpcName: "engine_v2_start_number_game" | "engine_v2_guess_number" | "engine_v2_restart_number_game";
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
      const guess = payload.guess;
      if (typeof guess !== "number" || !Number.isInteger(guess) || guess < 1 || guess > 100) {
        return responseError("أدخل رقماً صحيحاً من ١ إلى ١٠٠.", 400);
      }
      rpcName = "engine_v2_guess_number";
      rpcArgs.p_guess = guess;
    }

    const { data, error } = await admin.rpc(rpcName, rpcArgs);
    if (error) {
      const mapped = mapDatabaseError(error.code);
      console.error("[room-engine] number engine rejected", { action, code: error.code ?? "unknown" });
      return responseError(mapped.message, mapped.status, error.code);
    }
    const room = Array.isArray(data) ? data[0] : data;
    if (!room || typeof room !== "object" || !("id" in room)) {
      return responseError("استلمنا استجابة غير مكتملة من محرك اللعبة.", 502);
    }
    return respond({ room }, 200);
  }

  let actionPayload: Record<string, unknown> = {};
  if (payload.payload !== undefined) {
    if (payload.payload === null || typeof payload.payload !== "object" || Array.isArray(payload.payload)) {
      return responseError("بيانات الحركة غير صالحة.", 400);
    }
    actionPayload = payload.payload as Record<string, unknown>;
  }

  if (action === "finish-game") {
    const { data, error } = await admin.rpc("engine_v3_finish_social_game", {
      p_room_id: roomId,
      p_actor_id: actorId,
      p_expected_updated_at: expectedUpdatedAt,
    });
    if (error) {
      const mapped = mapDatabaseError(error.code);
      console.error("[room-engine] social game finish rejected", { code: error.code ?? "unknown" });
      return responseError(mapped.message, mapped.status, error.code);
    }
    const room = Array.isArray(data) ? data[0] : data;
    if (!room || typeof room !== "object" || !("id" in room)) {
      return responseError("استلمنا استجابة غير مكتملة من محرك الغرفة.", 502);
    }
    return respond({ room }, 200);
  }

  const { data, error } = await admin.rpc("engine_v3_apply_action", {
    p_room_id: roomId,
    p_actor_id: actorId,
    p_action: action,
    p_payload: actionPayload,
    p_expected_updated_at: expectedUpdatedAt,
  });
  if (error) {
    const mapped = mapDatabaseError(error.code);
    console.error("[room-engine] v3 action rejected", { action, code: error.code ?? "unknown" });
    return responseError(mapped.message, mapped.status, error.code);
  }

  const room = Array.isArray(data) ? data[0] : data;
  if (!room || typeof room !== "object" || !("id" in room)) {
    return responseError("استلمنا استجابة غير مكتملة من محرك اللعبة.", 502);
  }
  return respond({ room }, 200);
});
