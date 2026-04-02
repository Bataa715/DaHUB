import { motion } from "framer-motion";
import { Loader2, ChevronLeft, Flag } from "lucide-react";
import type { Chess } from "chess.js";
import type { Square } from "chess.js";
import type { GameInfo } from "./chess.types";
import {
  PIECE_UNICODE,
  FILES,
  RESULT_REASON,
  formatTime,
  parseMoves,
} from "./chess.utils";

interface GameViewProps {
  myId: string;
  myName: string;
  game: GameInfo | null;
  chess: Chess;
  myColor: "w" | "b";
  selectedSq: string | null;
  legalSqs: string[];
  lastMove: { from: string; to: string } | null;
  submitting: boolean;
  resigning: boolean;
  whiteMs: number;
  blackMs: number;
  handleSquareClick: (sq: string) => void;
  resign: () => void;
  backToLobby: () => void;
}

export default function GameView(props: GameViewProps) {
  const {
    myId,
    myName,
    game,
    chess,
    myColor,
    selectedSq,
    legalSqs,
    lastMove,
    submitting,
    resigning,
    whiteMs,
    blackMs,
    handleSquareClick,
    resign,
    backToLobby,
  } = props;

  // -- Board render ----------------------------------------------------------
  const renderBoard = () => {
    const ranks =
      myColor === "w" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
    const files = myColor === "w" ? FILES : [...FILES].reverse();

    return (
      <div
        className="grid grid-cols-8 grid-rows-8 rounded-xl overflow-hidden border-2 border-amber-900/50 shadow-2xl shadow-black/50 w-full max-w-[400px] aspect-square mx-auto"
        style={{ userSelect: "none" }}
      >
        {ranks.map((rank) =>
          files.map((file) => {
            const sq = `${file}${rank}`;
            const piece = chess.get(sq as Square) as {
              type: string;
              color: string;
            } | null;
            const fileIdx = files.indexOf(file);
            const isLight = (fileIdx + rank) % 2 === 0;
            const isSelected = sq === selectedSq;
            const isLegal = legalSqs.includes(sq);
            const isLastFrom = lastMove?.from === sq;
            const isLastTo = lastMove?.to === sq;
            const isKingInCheck =
              chess.inCheck() &&
              piece?.type === "k" &&
              piece?.color === chess.turn();

            let bg = isLight ? "#F0D9B5" : "#B58863";
            if (isSelected) bg = "#7FC97F";
            else if (isLastFrom || isLastTo)
              bg = isLight ? "#CDD96E" : "#AAA823";
            if (isKingInCheck) bg = "#E04040";

            return (
              <div
                key={sq}
                onClick={() => handleSquareClick(sq)}
                className="relative flex items-center justify-center cursor-pointer transition-colors duration-75"
                style={{ background: bg }}
              >
                {file === files[0] && (
                  <span
                    className="absolute top-0.5 left-0.5 text-[min(1.6vw,8px)] font-bold leading-none pointer-events-none select-none"
                    style={{ color: isLight ? "#B58863" : "#F0D9B5" }}
                  >
                    {rank}
                  </span>
                )}
                {rank === ranks[ranks.length - 1] && (
                  <span
                    className="absolute bottom-0.5 right-0.5 text-[min(1.6vw,8px)] font-bold leading-none pointer-events-none select-none"
                    style={{ color: isLight ? "#B58863" : "#F0D9B5" }}
                  >
                    {file}
                  </span>
                )}

                {isLegal && !piece && (
                  <div
                    className="w-[32%] h-[32%] rounded-full pointer-events-none"
                    style={{ background: "rgba(0,0,0,0.2)" }}
                  />
                )}
                {isLegal && piece && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ boxShadow: "inset 0 0 0 4px rgba(0,0,0,0.3)" }}
                  />
                )}

                {piece && (
                  <span
                    className="text-[min(5.5vw,26px)] leading-none pointer-events-none select-none"
                    style={{
                      filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.8))",
                      color: piece.color === "w" ? "#FFFFFF" : "#1a1a1a",
                    }}
                  >
                    {PIECE_UNICODE[`${piece.color}${piece.type}`] ?? ""}
                  </span>
                )}
              </div>
            );
          }),
        )}
      </div>
    );
  };

  // -- Game status banner ----------------------------------------------------
  const renderBanner = () => {
    if (!game) return null;
    const isMyTurn =
      game.status === "active" &&
      ((chess.turn() === "w" && myColor === "w") ||
        (chess.turn() === "b" && myColor === "b"));

    const oppName = myColor === "w" ? game.blackUserName : game.whiteUserName;
    const myLabel = myColor === "w" ? "Цагаан" : "Хар";
    const oppLabel = myColor === "w" ? "Хар" : "Цагаан";

    if (game.status !== "active") {
      const isWin =
        (game.status === "white_won" && myColor === "w") ||
        (game.status === "black_won" && myColor === "b");
      const isDraw = game.status === "draw";
      return (
        <div
          className={`rounded-xl px-4 py-3 text-center text-sm font-semibold ${
            isDraw
              ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
              : isWin
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
          }`}
        >
          {isDraw
            ? `Тэнцсэн — ${RESULT_REASON[game.resultReason] ?? game.resultReason}`
            : isWin
              ? `Та ялалт байгуулав! (${RESULT_REASON[game.resultReason] ?? game.resultReason})`
              : `${RESULT_REASON[game.resultReason] ?? game.resultReason}`}
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-slate-400">
          <span className="text-white font-medium">
            {myLabel}: {myName}
          </span>
          <span className="mx-2 text-slate-600">vs</span>
          <span>
            {oppLabel}: {oppName}
          </span>
        </p>
        <div
          className={`px-3 py-1 rounded-lg text-xs font-semibold ${
            isMyTurn
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : "bg-slate-700/60 text-slate-400"
          }`}
        >
          {submitting ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Нүүд хийж байна...
            </span>
          ) : isMyTurn ? (
            "Таны ээлж"
          ) : (
            "Хүлээж байна..."
          )}
        </div>
      </div>
    );
  };

  // -- Move history ----------------------------------------------------------
  const renderMoveHistory = () => {
    const moves = parseMoves(game?.moves ?? "[]");
    if (!moves.length)
      return (
        <p className="text-slate-500 text-xs italic text-center py-4">
          Нүүд алга
        </p>
      );
    const pairs: [string, string | undefined][] = [];
    for (let i = 0; i < moves.length; i += 2) {
      pairs.push([moves[i], moves[i + 1]]);
    }
    return (
      <div className="space-y-0.5 max-h-56 overflow-y-auto pr-1 text-xs font-mono">
        {pairs.map(([w, b], i) => (
          <div
            key={i}
            className="flex gap-1 hover:bg-slate-700/30 rounded px-1"
          >
            <span className="text-slate-600 w-7 text-right shrink-0">
              {i + 1}.
            </span>
            <span className="text-slate-200 flex-1">{w}</span>
            <span className="text-slate-400 flex-1">{b ?? ""}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <motion.div
      key="game"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
    >
      {!game ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          {/* Board section */}
          <div className="space-y-4">
            {renderBanner()}
            {renderBoard()}
            <div className="flex justify-end gap-3">
              {game.status === "active" && (
                <button
                  onClick={resign}
                  disabled={resigning}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/20 text-rose-400 text-sm font-medium transition-all disabled:opacity-50"
                >
                  {resigning ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Flag className="w-4 h-4" />
                  )}
                  Тоглоом дуусгах
                </button>
              )}
              {game.status !== "active" && (
                <button
                  onClick={backToLobby}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/20 text-amber-400 text-sm font-medium transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Лоббид буцах
                </button>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Player cards */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 space-y-2">
              {[
                {
                  userId: game.blackUserId,
                  name: game.blackUserName,
                  color: "b",
                  label: "Хар",
                  symbol: "♚",
                },
                {
                  userId: game.whiteUserId,
                  name: game.whiteUserName,
                  color: "w",
                  label: "Цагаан",
                  symbol: "♔",
                },
              ].map(({ userId, name, color, label, symbol }) => {
                const isActiveTurn =
                  game.status === "active" && chess.turn() === color;
                const isMe = userId === myId;
                return (
                  <div
                    key={userId}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                      isActiveTurn
                        ? "bg-amber-500/10 border border-amber-500/20"
                        : "bg-slate-900/40 border border-slate-700/30"
                    }`}
                  >
                    <span
                      className="text-xl leading-none"
                      style={{
                        color: color === "w" ? "#fff" : "#1a1a1a",
                        textShadow:
                          color === "b"
                            ? "0 0 4px rgba(255,255,255,0.4)"
                            : "0 0 4px rgba(0,0,0,0.8)",
                        filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))",
                      }}
                    >
                      {symbol}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {name}
                        {isMe && (
                          <span className="ml-1.5 text-xs text-amber-400/70">
                            (би)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">{label}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {game.status === "active" && (
                        <span
                          className={`text-sm font-mono font-bold tabular-nums ${
                            (color === "w" ? whiteMs : blackMs) < 30000
                              ? "text-rose-400 animate-pulse"
                              : (color === "w" ? whiteMs : blackMs) < 60000
                                ? "text-amber-400"
                                : "text-slate-300"
                          }`}
                        >
                          {formatTime(color === "w" ? whiteMs : blackMs)}
                        </span>
                      )}
                      {isActiveTurn && (
                        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Check warning */}
            {chess.inCheck() && game.status === "active" && (
              <div className="rounded-xl px-3 py-2.5 bg-rose-500/15 border border-rose-500/30 text-rose-400 text-sm font-semibold text-center animate-pulse">
                Шах байна!
              </div>
            )}

            {/* Move history */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 space-y-2">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Нүүдлийн түүх
              </h3>
              {renderMoveHistory()}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
