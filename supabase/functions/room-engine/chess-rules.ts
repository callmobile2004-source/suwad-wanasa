import { Chess } from "npm:chess.js@1.4.0";

export const CHESS_START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export type ChessMoveInput = {
  from: string;
  to: string;
  promotion?: string;
};

export type ChessPosition = {
  fen: string;
  pgn: string;
  turn: "w" | "b";
  legalMoves: Array<{ from: string; to: string; san: string; flags: string; promotion?: string }>;
  inCheck: boolean;
  canClaimDraw: boolean;
  automaticDraw: boolean;
  gameOver: boolean;
  checkmate: boolean;
  stalemate: boolean;
  drawReason: string | null;
};

function positionKey(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
}

function repetitionCount(chess: Chess): number {
  const replay = new Chess();
  const counts = new Map<string, number>();
  const add = () => {
    const key = positionKey(replay.fen());
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };
  add();
  for (const move of chess.history({ verbose: true })) {
    replay.move({ from: move.from, to: move.to, ...(move.promotion ? { promotion: move.promotion } : {}) });
    add();
  }
  return counts.get(positionKey(chess.fen())) ?? 1;
}

function drawReason(chess: Chess, repetitions: number): string | null {
  if (chess.isStalemate()) return "stalemate";
  if (chess.isInsufficientMaterial()) return "insufficient_material";
  const halfMoves = Number(chess.fen().split(" ")[4] ?? 0);
  if (halfMoves >= 150) return "seventy_five_move_rule";
  if (repetitions >= 5) return "fivefold_repetition";
  return null;
}

export function loadChessPosition(pgn: string, expectedFen?: string): Chess {
  const chess = new Chess();
  if (pgn) chess.loadPgn(pgn);
  if (expectedFen && chess.fen() !== expectedFen) {
    throw new Error("Chess history and board position do not match.");
  }
  return chess;
}

export function inspectChessPosition(pgn: string, expectedFen?: string): ChessPosition {
  const chess = loadChessPosition(pgn, expectedFen);
  const repetitions = repetitionCount(chess);
  const automaticReason = drawReason(chess, repetitions);
  const checkmate = chess.isCheckmate();
  const stalemate = chess.isStalemate();
  const insufficient = chess.isInsufficientMaterial();
  const halfMoves = Number(chess.fen().split(" ")[4] ?? 0);
  const canClaimDraw = !checkmate && !automaticReason && (halfMoves >= 100 || repetitions >= 3);
  const automaticDraw = Boolean(automaticReason);
  const gameOver = checkmate || automaticDraw;
  return {
    fen: chess.fen(),
    pgn: chess.pgn(),
    turn: chess.turn(),
    legalMoves: chess.moves({ verbose: true }).map((move) => ({
      from: move.from,
      to: move.to,
      san: move.san,
      flags: move.flags,
      ...(move.promotion ? { promotion: move.promotion } : {}),
    })),
    inCheck: chess.isCheck(),
    canClaimDraw,
    automaticDraw,
    gameOver,
    checkmate,
    stalemate,
    drawReason: automaticReason ?? (insufficient ? "insufficient_material" : null),
  };
}

export function applyChessMove(
  pgn: string,
  expectedFen: string,
  input: ChessMoveInput,
): ChessPosition & { lastMove: { from: string; to: string; san: string; flags: string; promotion?: string } } {
  if (!/^[a-h][1-8]$/.test(input.from) || !/^[a-h][1-8]$/.test(input.to)) {
    throw new Error("Invalid chess square.");
  }
  const promotion = input.promotion?.toLowerCase();
  if (promotion !== undefined && !["q", "r", "b", "n"].includes(promotion)) {
    throw new Error("Invalid promotion piece.");
  }
  const chess = loadChessPosition(pgn, expectedFen);
  const move = chess.move({
    from: input.from,
    to: input.to,
    ...(promotion ? { promotion } : {}),
  });
  if (!move) throw new Error("Illegal chess move.");
  const position = inspectChessPosition(chess.pgn(), chess.fen());
  return {
    ...position,
    lastMove: {
      from: move.from,
      to: move.to,
      san: move.san,
      flags: move.flags,
      ...(move.promotion ? { promotion: move.promotion } : {}),
    },
  };
}

export function claimableChessDraw(pgn: string, expectedFen: string): { claimable: boolean; reason: string | null } {
  const position = inspectChessPosition(pgn, expectedFen);
  if (!position.canClaimDraw) return { claimable: false, reason: null };
  const chess = loadChessPosition(pgn, expectedFen);
  const halfMoves = Number(chess.fen().split(" ")[4] ?? 0);
  return {
    claimable: true,
    reason: halfMoves >= 100 ? "fifty_move_rule" : "threefold_repetition",
  };
}

export function chessResignationWinner(players: Array<{ user_id: string; seat: number }>, actorId: string): string | null {
  if (players.length !== 2) return null;
  const actor = players.find((player) => player.user_id === actorId);
  if (!actor || (actor.seat !== 0 && actor.seat !== 1)) return null;
  return players.find((player) => player.user_id !== actorId)?.user_id ?? null;
}
