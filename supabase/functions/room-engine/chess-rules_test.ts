import {
  CHESS_START_FEN,
  applyChessMove,
  inspectChessPosition,
} from "./chess-rules.ts";

Deno.test("authoritative chess start position has twenty legal moves", () => {
  const position = inspectChessPosition("");
  if (position.fen !== CHESS_START_FEN) throw new Error("Unexpected initial FEN");
  if (position.legalMoves.length !== 20) throw new Error("Expected 20 legal opening moves");
  if (position.turn !== "w") throw new Error("White must move first");
});

Deno.test("authoritative chess move advances turn and records SAN", () => {
  const next = applyChessMove("", CHESS_START_FEN, { from: "e2", to: "e4" });
  if (next.turn !== "b" || next.lastMove.san !== "e4" || !next.pgn.includes("1. e4")) {
    throw new Error("e2-e4 was not recorded correctly");
  }
  if (!next.fen.includes(" b ")) throw new Error("FEN did not advance to black");
});

Deno.test("authoritative chess engine rejects illegal moves", () => {
  let rejected = false;
  try {
    applyChessMove("", CHESS_START_FEN, { from: "e2", to: "e5" });
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error("Illegal move was accepted");
});

Deno.test("authoritative chess engine supports castling", () => {
  const fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
  const next = applyChessMove("", fen, { from: "e1", to: "g1" });
  if (next.lastMove.san !== "O-O") throw new Error("King-side castling failed");
});

Deno.test("authoritative chess engine requires and applies promotion", () => {
  const fen = "7k/P7/8/8/8/8/8/7K w - - 0 1";
  let rejected = false;
  try {
    applyChessMove("", fen, { from: "a7", to: "a8" });
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error("Promotion without a piece choice was accepted");
  const promoted = applyChessMove("", fen, { from: "a7", to: "a8", promotion: "q" });
  if (!promoted.fen.startsWith("Q6k/")) throw new Error("Queen promotion failed");
});

Deno.test("authoritative chess engine detects checkmate and stalemate", () => {
  let pgn = "";
  let fen = CHESS_START_FEN;
  for (const move of [
    { from: "f2", to: "f3" },
    { from: "e7", to: "e5" },
    { from: "g2", to: "g4" },
    { from: "d8", to: "h4" },
  ]) {
    const next = applyChessMove(pgn, fen, move);
    pgn = next.pgn;
    fen = next.fen;
  }
  if (!inspectChessPosition(pgn, fen).checkmate) throw new Error("Fool's Mate was not detected");
  const stalemate = inspectChessPosition("", "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
  if (!stalemate.stalemate || !stalemate.gameOver) throw new Error("Stalemate was not detected");
});

Deno.test("authoritative chess engine exposes fifty-move draw claims", () => {
  const position = inspectChessPosition("", "4k3/8/8/8/8/8/8/R3K2R w KQ - 100 1");
  if (!position.canClaimDraw) throw new Error("Fifty-move claim should be available");
});
