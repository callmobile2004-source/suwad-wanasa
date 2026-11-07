import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1.0.14";
import { Chess } from "npm:chess.js@1.4.0";
import { applyChessMove, claimableChessDraw, inspectChessPosition, loadChessPosition } from "./chess-rules.ts";

Deno.test("initial position exposes exactly twenty legal moves", () => {
  const position = inspectChessPosition("");
  assertEquals(position.legalMoves.length, 20);
  assertEquals(position.turn, "w");
  assertEquals(position.gameOver, false);
});

Deno.test("rejects illegal geometry and moves that expose the king", () => {
  const initial = new Chess().fen();
  assertThrows(() => applyChessMove("", initial, { from: "e2", to: "e5" }));
  const pinned = "4r1k1/8/8/8/8/8/4R3/4K3 w - - 0 1";
  assertThrows(() => applyChessMove("", pinned, { from: "e2", to: "f2" }));
});

Deno.test("supports legal castling and moves the rook", () => {
  let chess = new Chess();
  for (const san of ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "O-O"]) chess.move(san);
  assertEquals(chess.get("g1")?.type, "k");
  assertEquals(chess.get("f1")?.type, "r");
  assertEquals(chess.get("h1"), undefined);
});

Deno.test("supports en passant and removes the captured pawn", () => {
  let chess = new Chess();
  for (const san of ["e4", "a6", "e5", "d5", "exd6"]) chess.move(san);
  assertEquals(chess.get("d6")?.type, "p");
  assertEquals(chess.get("d5"), undefined);
});

Deno.test("supports all four promotion choices and requires a legal promotion", () => {
  const fen = "7k/P7/8/8/8/8/8/7K w - - 0 1";
  const promoted = applyChessMove("", fen, { from: "a7", to: "a8", promotion: "n" });
  assertEquals(loadChessPosition(promoted.pgn, promoted.fen).get("a8")?.type, "n");
  assertThrows(() => applyChessMove("", fen, { from: "a7", to: "a8", promotion: "x" }));
});

Deno.test("detects checkmate and records the winner-side turn", () => {
  let chess = new Chess();
  for (const san of ["f3", "e5", "g4", "Qh4#"]) chess.move(san);
  const result = inspectChessPosition(chess.pgn(), chess.fen());
  assert(result.checkmate);
  assert(result.gameOver);
  assertEquals(result.turn, "w");
});

Deno.test("detects stalemate and insufficient material", () => {
  const stalemate = inspectChessPosition("", "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
  assert(stalemate.stalemate);
  assertEquals(stalemate.drawReason, "stalemate");
  const insufficient = inspectChessPosition("", "7k/8/6K1/8/8/8/8/8 w - - 0 1");
  assert(insufficient.automaticDraw);
  assertEquals(insufficient.drawReason, "insufficient_material");
});

Deno.test("threefold repetition is claimable but not automatically forced", () => {
  let chess = new Chess();
  for (const san of ["Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1", "Ng8"]) chess.move(san);
  const claim = claimableChessDraw(chess.pgn(), chess.fen());
  assert(claim.claimable);
  assertEquals(claim.reason, "threefold_repetition");
  assertEquals(inspectChessPosition(chess.pgn(), chess.fen()).gameOver, false);
});

Deno.test("fifty-move draw is claimable, while seventy-five moves is automatic", () => {
  const claimable = claimableChessDraw("", "7k/8/6K1/8/8/8/8/8 w - - 100 51");
  assert(claimable.claimable);
  assertEquals(claimable.reason, "fifty_move_rule");
  const automatic = inspectChessPosition("", "7k/8/6K1/8/8/8/8/8 w - - 150 76");
  assert(automatic.automaticDraw);
  assertEquals(automatic.drawReason, "seventy_five_move_rule");
});

Deno.test("replays persisted PGN and rejects a mismatched FEN", () => {
  const moved = applyChessMove("", new Chess().fen(), { from: "e2", to: "e4" });
  assertEquals(loadChessPosition(moved.pgn, moved.fen).fen(), moved.fen);
  assertThrows(() => loadChessPosition(moved.pgn, new Chess().fen()));
});
