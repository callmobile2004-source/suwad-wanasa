import { GAME_POLICIES, buildGameHelpInstruction, normalizeGameMode } from "./game-policy.ts";

const expected = ["who","number","liar","yesno","most","snakes","domino","tavla","colors","quiz","wheel"];
Deno.test("all game assistant keys have a dedicated Oras policy", () => {
  const actual = Object.keys(GAME_POLICIES).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected.slice().sort())) {
    throw new Error("Game policy coverage mismatch: " + actual.join(","));
  }
});
Deno.test("each game policy builds safe practice and online instructions", () => {
  for (const key of expected) {
    const practice = buildGameHelpInstruction(key, key, "practice");
    const online = buildGameHelpInstruction(key, key, "online");
    if (!practice.includes("النمط تدريب") || !online.includes("النمط أونلاين")) {
      throw new Error("Mode context missing for " + key);
    }
    if (!practice.includes("لا تكشف") || !online.includes("لا تكشف")) {
      throw new Error("Secrecy guard missing for " + key);
    }
  }
});
Deno.test("unknown mode defaults safely to practice", () => {
  if (normalizeGameMode("unexpected") !== "practice") throw new Error("Unsafe mode fallback");
  if (normalizeGameMode("online") !== "online") throw new Error("Online mode not recognized");
});
Deno.test("unknown game has no generated policy", () => {
  let threw = false;
  try { buildGameHelpInstruction("unknown", "unknown", "practice"); } catch { threw = true; }
  if (!threw) throw new Error("Unknown game must not receive a generic policy");
});
