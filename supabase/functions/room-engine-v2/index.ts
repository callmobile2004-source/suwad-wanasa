import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://callmobile2004-source.github.io",
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function validUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function secureShuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = secureIndex(index + 1);
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

async function createDominoDeal(
  engineClient: ReturnType<typeof createClient>,
  roomId: string,
): Promise<{
  deal: Record<string, number[][]>;
  boneyard: number[][];
  startingPlayer: string;
}> {
  const rosterResult = await engineClient
    .from("game_room_players")
    .select("user_id")
    .eq("room_id", roomId)
    .order("seat");
  if (rosterResult.error) throw new Error("تعذّر قراءة قائمة لاعبي الدومينو.");
  const roster = (rosterResult.data || [])
    .map((player: { user_id: string }) => player.user_id)
    .filter((id: string) => validUuid(id));
  if (roster.length < 2 || roster.length > 4 || new Set(roster).size !== roster.length) {
    throw new Error("الدومينو تحتاج من لاعبين إلى أربعة لاعبين مختلفين.");
  }

  const deck: number[][] = [];
  for (let first = 0; first <= 6; first++) {
    for (let second = first; second <= 6; second++) {
      deck.push([first, second]);
    }
  }
  const shuffled = secureShuffle(deck);
  const handSize = roster.length === 2 ? 7 : 5;
  const deal: Record<string, number[][]> = Object.fromEntries(
    roster.map((playerId: string) => [playerId, []]),
  );

  for (let round = 0; round < handSize; round++) {
    for (const playerId of roster) {
      const tile = shuffled.pop();
      if (!tile) throw new Error("تعذّر إكمال توزيع قطع الدومينو.");
      deal[playerId].push(tile);
    }
  }

  const starter = roster.find((playerId: string) =>
    deal[playerId].some((tile: number[]) => tile[0] === 6 && tile[1] === 6)
  );
  if (!starter) throw new Error("لم يتم العثور على حامل الدبل ستة في التوزيع.");
  return {
    deal,
    boneyard: shuffled,
    startingPlayer: starter,
  };
}

function secureNumber(): number {
  const bytes = new Uint8Array(1);
  let value = 255;
  while (value >= 200) {
    crypto.getRandomValues(bytes);
    value = bytes[0];
  }
  return (value % 100) + 1;
}

function secureIndex(max: number): number {
  if (!Number.isInteger(max) || max < 1 || max > 0xffffffff) {
    throw new Error("Invalid random selection range.");
  }
  const range = 0x100000000;
  const limit = Math.floor(range / max) * max;
  const bytes = new Uint32Array(1);
  let value = limit;
  while (value >= limit) {
    crypto.getRandomValues(bytes);
    value = bytes[0];
  }
  return value % max;
}

const LIAR_WORDS = [
  { category: "أكلات", words: ["برياني","دولمة","كباب","مسگوف","تشريب","تمن وقيمة","باجة","قوزي","كبة","فلافل"] },
  { category: "حيوانات", words: ["نمر","زرافة","بطريق","سلحفاة","غزال","قرد","فيل","حصان","تمساح","جمل"] },
  { category: "أماكن", words: ["مستشفى","مطار","مكتبة","ملعب","بحر","مدرسة","سوق","جامعة","محطة قطار","متحف"] },
  { category: "أدوات", words: ["مظلة","مقص","مطرقة","مفتاح","مصباح","مرآة","ساعة","حقيبة","مروحة","ميزان"] },
  { category: "مشروبات", words: ["شاي","قهوة","عصير رمان","لبن","ليمونادة","سحلب","كاكاو","ماء"] },
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed." });

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return reply(503, { error: "Game engine is not configured." });

  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return reply(401, { error: "Authentication required." });

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return reply(401, { error: "Invalid session." });

  const contentType = (req.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return reply(415, { error: "Content-Type must be application/json." });
  }
  const declaredLength = Number(req.headers.get("Content-Length"));
  if (Number.isFinite(declaredLength) && declaredLength > 4096) {
    return reply(413, { error: "Request too large." });
  }
  const reader = req.body?.getReader();
  if (!reader) return reply(400, { error: "Request body is required." });
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > 4096) {
        try { await reader.cancel(); } catch { /* request is already rejected */ }
        return reply(413, { error: "Request too large." });
      }
      chunks.push(value);
    }
  } catch {
    return reply(400, { error: "Unable to read request body." });
  }
  const bodyBytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bodyBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const rawBody = new TextDecoder().decode(bodyBytes);

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return reply(400, { error: "Invalid JSON body." });
  }
  if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
    return reply(400, { error: "JSON body must be an object." });
  }
  const body = parsedBody as Record<string, unknown>;

  const action = body.action;
  if (!["start_number","restart_number","guess_number","start_most","vote_most","next_most","restart_most","start_quiz","answer_quiz","next_quiz","restart_quiz","start_yesno","answer_yesno","next_yesno","restart_yesno","start_liar","restart_liar","get_liar_card","submit_liar_hint","vote_liar","start_snakes","roll_snakes","restart_snakes","start_domino","restart_domino","get_domino_hand","play_domino","draw_domino","pass_domino"].includes(String(action))) {
    return reply(400, { error: "Unsupported engine action." });
  }
  if (!validUuid(body.room_id)) {
    return reply(400, { error: "Invalid room." });
  }
  if (action !== "get_liar_card" && action !== "get_domino_hand" &&
      (typeof body.expected_updated_at !== "string" ||
       !Number.isFinite(Date.parse(body.expected_updated_at)))) {
    return reply(400, { error: "Invalid room version." });
  }
  if ((action === "vote_most" || action === "vote_liar") && !validUuid(body.vote_target)) {
    return reply(400, { error: "Invalid vote target." });
  }
  if (action === "play_domino" &&
      (!Number.isInteger(body.tile_a) || !Number.isInteger(body.tile_b) ||
       Number(body.tile_a) < 0 || Number(body.tile_a) > 6 ||
       Number(body.tile_b) < 0 || Number(body.tile_b) > 6 ||
       Number(body.tile_a) > Number(body.tile_b) ||
       !["left", "right", "auto"].includes(String(body.side)))) {
    return reply(400, { error: "بيانات قطعة الدومينو أو جهة اللعب غير صالحة." });
  }
  const liarHint = typeof body.hint === "string" ? body.hint.trim() : "";
  if (action === "submit_liar_hint" && (liarHint.length < 1 || liarHint.length > 100)) {
    return reply(400, { error: "أدخل تلميحاً من حرف إلى ١٠٠ حرف." });
  }
  const quizAnswer = typeof body.answer === "string" ? body.answer.trim() : "";
  if (action === "answer_quiz" &&
      (quizAnswer.length < 1 || quizAnswer.length > 120)) {
    return reply(400, { error: "Enter an answer between 1 and 120 characters." });
  }
  if (action === "answer_yesno" && typeof body.answer_yesno !== "boolean") {
    return reply(400, { error: "Choose yes or no." });
  }

  if (action === "guess_number" &&
      (!Number.isInteger(body.guess) || Number(body.guess) < 1 || Number(body.guess) > 100)) {
    return reply(400, { error: "Enter an integer from 1 to 100." });
  }

  const guess = action === "guess_number" ? body.guess as number : undefined;
  const engineClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let liarSetup: { secretWord: string; category: string; outsiderId: string } | null = null;
  if (action === "start_liar" || action === "restart_liar") {
    const rosterResult = await engineClient
      .from("game_room_players")
      .select("user_id")
      .eq("room_id", body.room_id)
      .order("seat");
    if (rosterResult.error) {
      return reply(422, { error: "تعذّر قراءة قائمة لاعبي الغرفة." });
    }
    const roster = (rosterResult.data || [])
      .map((player: { user_id: string }) => player.user_id)
      .filter((id: string) => validUuid(id));
    if (roster.length < 3 || roster.length > 16) {
      return reply(400, { error: "برا السالفة تحتاج من ٣ إلى ١٦ لاعباً." });
    }
    const pack = LIAR_WORDS[secureIndex(LIAR_WORDS.length)];
    liarSetup = {
      category: pack.category,
      secretWord: pack.words[secureIndex(pack.words.length)],
      outsiderId: roster[secureIndex(roster.length)],
    };
  }

  let dominoDeal: {
    deal: Record<string, number[][]>;
    boneyard: number[][];
    startingPlayer: string;
  } | null = null;
  if (action === "start_domino" || action === "restart_domino") {
    try {
      dominoDeal = await createDominoDeal(engineClient, body.room_id);
    } catch (error) {
      return reply(400, {
        error: String(error instanceof Error ? error.message : "تعذّر توزيع قطع الدومينو."),
      });
    }
  }

  const rpc = action === "start_domino"
    ? await engineClient.rpc("engine_v2_start_domino_game", {
      p_room_id: body.room_id, p_actor_id: authData.user.id,
      p_deal: dominoDeal!.deal, p_boneyard: dominoDeal!.boneyard,
      p_starting_player: dominoDeal!.startingPlayer,
      p_expected_updated_at: body.expected_updated_at, p_is_restart: false,
    })
    : action === "restart_domino"
    ? await engineClient.rpc("engine_v2_restart_domino_game", {
      p_room_id: body.room_id, p_actor_id: authData.user.id,
      p_deal: dominoDeal!.deal, p_boneyard: dominoDeal!.boneyard,
      p_starting_player: dominoDeal!.startingPlayer,
      p_expected_updated_at: body.expected_updated_at,
    })
    : action === "get_domino_hand"
    ? await engineClient.rpc("engine_v2_get_domino_hand", {
      p_room_id: body.room_id, p_actor_id: authData.user.id,
    })
    : action === "play_domino"
    ? await engineClient.rpc("engine_v2_play_domino", {
      p_room_id: body.room_id, p_actor_id: authData.user.id,
      p_tile_a: body.tile_a, p_tile_b: body.tile_b, p_side: body.side,
      p_expected_updated_at: body.expected_updated_at,
    })
    : action === "draw_domino"
    ? await engineClient.rpc("engine_v2_draw_domino", {
      p_room_id: body.room_id, p_actor_id: authData.user.id,
      p_expected_updated_at: body.expected_updated_at,
    })
    : action === "pass_domino"
    ? await engineClient.rpc("engine_v2_pass_domino", {
      p_room_id: body.room_id, p_actor_id: authData.user.id,
      p_expected_updated_at: body.expected_updated_at,
    })
    : action === "start_snakes"
    ? await engineClient.rpc("engine_v2_start_snakes_game", {
      p_room_id: body.room_id, p_actor_id: authData.user.id,
      p_expected_updated_at: body.expected_updated_at,
    })
    : action === "roll_snakes"
    ? await engineClient.rpc("engine_v2_roll_snakes", {
      p_room_id: body.room_id, p_actor_id: authData.user.id,
      p_dice: secureIndex(6) + 1, p_expected_updated_at: body.expected_updated_at,
    })
    : action === "restart_snakes"
    ? await engineClient.rpc("engine_v2_restart_snakes_game", {
      p_room_id: body.room_id, p_actor_id: authData.user.id,
      p_expected_updated_at: body.expected_updated_at,
    })
    : action === "start_liar"
    ? await engineClient.rpc("engine_v2_start_liar_game", {
      p_room_id: body.room_id, p_actor_id: authData.user.id,
      p_secret_word: liarSetup!.secretWord, p_category: liarSetup!.category,
      p_outsider_id: liarSetup!.outsiderId, p_expected_updated_at: body.expected_updated_at,
    })
    : action === "restart_liar"
    ? await engineClient.rpc("engine_v2_restart_liar_game", {
      p_room_id: body.room_id, p_actor_id: authData.user.id,
      p_secret_word: liarSetup!.secretWord, p_category: liarSetup!.category,
      p_outsider_id: liarSetup!.outsiderId, p_expected_updated_at: body.expected_updated_at,
    })
    : action === "get_liar_card"
    ? await engineClient.rpc("engine_v2_get_liar_card", {
      p_room_id: body.room_id, p_actor_id: authData.user.id,
    })
    : action === "submit_liar_hint"
    ? await engineClient.rpc("engine_v2_submit_liar_hint", {
      p_room_id: body.room_id, p_actor_id: authData.user.id,
      p_hint: liarHint, p_expected_updated_at: body.expected_updated_at,
    })
    : action === "vote_liar"
    ? await engineClient.rpc("engine_v2_vote_liar", {
      p_room_id: body.room_id, p_actor_id: authData.user.id,
      p_vote_target: body.vote_target, p_expected_updated_at: body.expected_updated_at,
    })
    : action === "start_number"
    ? await engineClient.rpc("engine_v2_start_number_game", {
      p_room_id: body.room_id, p_actor_id: authData.user.id,
      p_secret: secureNumber(), p_expected_updated_at: body.expected_updated_at,
    })
    : action === "restart_number"
    ? await engineClient.rpc("engine_v2_restart_number_game", {
      p_room_id: body.room_id, p_actor_id: authData.user.id,
      p_secret: secureNumber(), p_expected_updated_at: body.expected_updated_at,
    })
    : action === "guess_number"
    ? await engineClient.rpc("engine_v2_guess_number", {
      p_room_id: body.room_id, p_actor_id: authData.user.id,
      p_guess: guess, p_expected_updated_at: body.expected_updated_at,
    })
    : action === "start_most"
    ? await engineClient.rpc("engine_v2_start_most_game", {
      p_room_id: body.room_id, p_actor_id: authData.user.id,
      p_expected_updated_at: body.expected_updated_at,
    })
    : action === "vote_most"
    ? await engineClient.rpc("engine_v2_vote_most", {
      p_room_id: body.room_id, p_actor_id: authData.user.id,
      p_vote_target: body.vote_target, p_expected_updated_at: body.expected_updated_at,
    })
    : action === "next_most"
    ? await engineClient.rpc("engine_v2_next_most_question", {
      p_room_id: body.room_id, p_actor_id: authData.user.id,
      p_expected_updated_at: body.expected_updated_at,
    })
    : action === "restart_most"
    ? await engineClient.rpc("engine_v2_restart_most_game", {
      p_room_id: body.room_id, p_actor_id: authData.user.id,
      p_expected_updated_at: body.expected_updated_at,
    })
    : action === "start_quiz"
    ? await engineClient.rpc("engine_v2_start_quiz_game", {
      p_room_id: body.room_id, p_actor_id: authData.user.id,
      p_expected_updated_at: body.expected_updated_at,
    })
    : action === "answer_quiz"
    ? await engineClient.rpc("engine_v2_answer_quiz", {
      p_room_id: body.room_id, p_actor_id: authData.user.id,
      p_answer: quizAnswer, p_expected_updated_at: body.expected_updated_at,
    })
    : action === "next_quiz"
    ? await engineClient.rpc("engine_v2_next_quiz_question", {
      p_room_id: body.room_id, p_actor_id: authData.user.id,
      p_expected_updated_at: body.expected_updated_at,
    })
    : action === "restart_quiz"
    ? await engineClient.rpc("engine_v2_restart_quiz_game", {
      p_room_id: body.room_id, p_actor_id: authData.user.id,
      p_expected_updated_at: body.expected_updated_at,
    })
    : action === "start_yesno"
    ? await engineClient.rpc("engine_v2_start_yesno_game", {
      p_room_id: body.room_id, p_actor_id: authData.user.id,
      p_expected_updated_at: body.expected_updated_at,
    })
    : action === "answer_yesno"
    ? await engineClient.rpc("engine_v2_answer_yesno_game", {
      p_room_id: body.room_id, p_actor_id: authData.user.id,
      p_answer: body.answer_yesno, p_expected_updated_at: body.expected_updated_at,
    })
    : action === "next_yesno"
    ? await engineClient.rpc("engine_v2_next_yesno_question", {
      p_room_id: body.room_id, p_actor_id: authData.user.id,
      p_expected_updated_at: body.expected_updated_at,
    })
    : await engineClient.rpc("engine_v2_restart_yesno_game", {
      p_room_id: body.room_id, p_actor_id: authData.user.id,
      p_expected_updated_at: body.expected_updated_at,
    });

  if (rpc.error) {
    const code = rpc.error.code || "";
    const status = code === "42501" ? 403 : code === "40001" ? 409 :
      code === "22023" ? 400 : 422;
    const message = code === "42501"
      ? "ما عندك صلاحية لتنفيذ هذه الحركة."
      : code === "40001"
      ? "تغيّرت حالة الغرفة؛ حدّثها وحاول مرة ثانية."
      : code === "22023"
      ? "البيانات المرسلة غير صالحة."
      : "تعذّر تنفيذ الحركة حالياً. حاول مرة ثانية.";
    return reply(status, { error: message });
  }
  if (action === "get_liar_card" || action === "get_domino_hand") return reply(200, { card: rpc.data });
  return reply(200, { room: rpc.data });
});
