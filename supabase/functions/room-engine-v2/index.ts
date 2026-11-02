import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function validUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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

  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).length > 4096) {
    return reply(413, { error: "Request too large." });
  }

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
  if (action !== "start_number" && action !== "guess_number") {
    return reply(400, { error: "Unsupported engine action." });
  }
  if (!validUuid(body.room_id) || typeof body.expected_updated_at !== "string" ||
      !Number.isFinite(Date.parse(body.expected_updated_at))) {
    return reply(400, { error: "Invalid room or room version." });
  }

  if (action === "guess_number" &&
      (!Number.isInteger(body.guess) || Number(body.guess) < 1 || Number(body.guess) > 100)) {
    return reply(400, { error: "Enter an integer from 1 to 100." });
  }

  const engineClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const rpc = action === "start_number"
    ? await engineClient.rpc("engine_v2_start_number_game", {
      p_room_id: body.room_id,
      p_actor_id: authData.user.id,
      p_secret: secureNumber(),
      p_expected_updated_at: body.expected_updated_at,
    })
    : await engineClient.rpc("engine_v2_guess_number", {
      p_room_id: body.room_id,
      p_actor_id: authData.user.id,
      p_guess: body.guess,
      p_expected_updated_at: body.expected_updated_at,
    });

  if (rpc.error) {
    const code = rpc.error.code || "";
    const status = code === "42501" ? 403 : code === "40001" ? 409 :
      code === "22023" ? 400 : 422;
    return reply(status, { error: rpc.error.message, code });
  }
  return reply(200, { room: rpc.data });
});
