"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { authApi, chessApi } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { Chess } from "chess.js";
import type { Square, Move } from "chess.js";
import {
  Crown,
  Search,
  Send,
  Check,
  X,
  Loader2,
  ChevronLeft,
  Flag,
  Swords,
  Clock,
  Trophy,
  TrendingUp,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Invitation {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  status: string;
  createdAt: string;
}

interface GameInfo {
  id: string;
  whiteUserId: string;
  whiteUserName: string;
  blackUserId: string;
  blackUserName: string;
  moves: string;
  status: string;
  resultReason: string;
  whiteTimeMs?: number;
  blackTimeMs?: number;
  createdAt: string;
}

interface UserResult {
  id: string;
  userId?: string;
  name: string;
  position?: string;
}

interface RankEntry {
  id: string;
  name: string;
  wins: number;
  losses: number;
  draws: number;
}

interface HistoryGame {
  id: string;
  opponent: string;
  result: "win" | "loss" | "draw";
  resultReason: string;
  createdAt: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PIECE_UNICODE: Record<string, string> = {
  wp: "♙",
  wn: "♘",
  wb: "♗",
  wr: "♖",
  wq: "♕",
  wk: "♔",
  bp: "♟",
  bn: "♞",
  bb: "♝",
  br: "♜",
  bq: "♛",
  bk: "♚",
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

const RESULT_REASON: Record<string, string> = {
  checkmate: "Мат",
  stalemate: "Тал",
  resignation: "Буулт өгсөн",
  draw_agreement: "Тэнцэл тохиролцсон",
  insufficient_material: "Материал хүрэлцэхгүй",
  fifty_move: "50 нүүдлийн дүрэм",
  threefold_repetition: "Гурван давталт",
  timeout: "Цаг дууссан",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

const TITLES = [
  { label: "Лорд",     ratio: 1,    color: "text-amber-400",   bg: "bg-amber-500/15 border-amber-500/30",    icon: "👑" },
  { label: "Жанжин",   ratio: 0.5,  color: "text-orange-400",  bg: "bg-orange-500/15 border-orange-500/30",  icon: "✨" },
  { label: "Хурандаа", ratio: 0.25, color: "text-blue-400",    bg: "bg-blue-500/15 border-blue-500/30",      icon: "🏛️" },
  { label: "Ахлагч",   ratio: 0.1,  color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30",icon: "🏅" },
  { label: "Дайчин",   ratio: 0,    color: "text-slate-400",   bg: "bg-slate-700/40 border-slate-600/30",    icon: "⚔️" },
] as const;

function getTitle(wins: number, maxWins: number) {
  if (maxWins === 0) return TITLES[TITLES.length - 1];
  const ratio = wins / maxWins;
  return TITLES.find((t) => ratio >= t.ratio) ?? TITLES[TITLES.length - 1];
}
function parseMoves(json: string): string[] {
  try {
    const r = JSON.parse(json);
    return Array.isArray(r) ? r : [];
  } catch {
    return [];
  }
}

function buildChess(moves: string[]): Chess {
  const c = new Chess();
  for (const m of moves) {
    try {
      c.move(m);
    } catch {
      break;
    }
  }
  return c;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ChessPage() {
  const { user } = useAuth();
  const myId = user?.id ?? "";
  const myName = user?.name ?? "";

  // View
  const [view, setView] = useState<"lobby" | "game">("lobby");
  const [gameId, setGameId] = useState<string | null>(null);

  // Lobby
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [activeGames, setActiveGames] = useState<GameInfo[]>([]);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);

  // Game
  const [game, setGame] = useState<GameInfo | null>(null);
  const [chess, setChessState] = useState<Chess>(() => new Chess());
  const [myColor, setMyColor] = useState<"w" | "b">("w");
  const [selectedSq, setSelectedSq] = useState<string | null>(null);
  const [legalSqs, setLegalSqs] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resigning, setResigning] = useState(false);
  const [whiteMs, setWhiteMs] = useState(600000);
  const [blackMs, setBlackMs] = useState(600000);

  const lobbyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishedRef = useRef(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const localTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showResignModal, setShowResignModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [myStats, setMyStats] = useState<{ wins: number; losses: number; draws: number; total: number; games: HistoryGame[] } | null>(null);
  const [rankings, setRankings] = useState<RankEntry[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);

  // ── Lobby polling ─────────────────────────────────────────────────────────
  const fetchLobby = useCallback(async () => {
    try {
      const [invs, games] = await Promise.all([
        chessApi.getInvitations(),
        chessApi.getMyGames(),
      ]);
      setInvitations(invs);
      setActiveGames(games);
    } catch {}
  }, []);

  useEffect(() => {
    if (view !== "lobby") return;
    fetchLobby();
    lobbyTimerRef.current = setInterval(fetchLobby, 4000);
    return () => {
      if (lobbyTimerRef.current) clearInterval(lobbyTimerRef.current);
    };
  }, [view, fetchLobby]);

  // ── Game polling ──────────────────────────────────────────────────────────
  const applyGame = useCallback((g: GameInfo) => {
    setGame(g);
    const moves = parseMoves(g.moves);
    const c = buildChess(moves);
    setChessState(c);
    const hist = c.history({ verbose: true }) as Move[];
    if (hist.length) {
      const last = hist[hist.length - 1];
      setLastMove({ from: last.from, to: last.to });
    } else {
      setLastMove(null);
    }
    // Auto-finish if the chess engine says game over and game is still active
    if (g.status === "active" && c.isGameOver() && !finishedRef.current) {
      finishedRef.current = true;
      let status = "draw";
      let reason = "stalemate";
      if (c.isCheckmate()) {
        status = c.turn() === "w" ? "black_won" : "white_won";
        reason = "checkmate";
      } else if (c.isStalemate()) {
        status = "draw";
        reason = "stalemate";
      } else if (c.isInsufficientMaterial()) {
        status = "draw";
        reason = "insufficient_material";
      } else if (c.isThreefoldRepetition()) {
        status = "draw";
        reason = "threefold_repetition";
      } else {
        status = "draw";
        reason = "fifty_move";
      }
      chessApi.finishGame(g.id, status, reason).catch(() => {});
    }
  }, []);

  const fetchGame = useCallback(
    async (id: string) => {
      try {
        const g = await chessApi.getGame(id);
        applyGame(g);
      } catch {}
    },
    [applyGame],
  );

  useEffect(() => {
    if (view !== "game" || !gameId) return;
    finishedRef.current = false;
    fetchGame(gameId);
    gameTimerRef.current = setInterval(() => fetchGame(gameId), 2000);
    return () => {
      if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    };
  }, [view, gameId, fetchGame]);

  // Update my color when game loads
  useEffect(() => {
    if (game) setMyColor(game.whiteUserId === myId ? "w" : "b");
  }, [game, myId]);

  // Sync timer state from server game data
  useEffect(() => {
    if (!game) return;
    setWhiteMs(typeof game.whiteTimeMs === "number" ? game.whiteTimeMs : 600000);
    setBlackMs(typeof game.blackTimeMs === "number" ? game.blackTimeMs : 600000);
  }, [game?.whiteTimeMs, game?.blackTimeMs]);

  // Local 1-second countdown for active game
  useEffect(() => {
    if (!game || game.status !== "active") {
      if (localTimerRef.current) clearInterval(localTimerRef.current);
      return;
    }
    if (localTimerRef.current) clearInterval(localTimerRef.current);
    const turnIsWhite = chess.turn() === "w";
    localTimerRef.current = setInterval(() => {
      if (turnIsWhite) {
        setWhiteMs((prev) => {
          const next = Math.max(0, prev - 1000);
          if (next <= 0 && !finishedRef.current) {
            finishedRef.current = true;
            chessApi.finishGame(game.id, "black_won", "timeout").catch(() => {});
          }
          return next;
        });
      } else {
        setBlackMs((prev) => {
          const next = Math.max(0, prev - 1000);
          if (next <= 0 && !finishedRef.current) {
            finishedRef.current = true;
            chessApi.finishGame(game.id, "white_won", "timeout").catch(() => {});
          }
          return next;
        });
      }
    }, 1000);
    return () => {
      if (localTimerRef.current) clearInterval(localTimerRef.current);
    };
  }, [game?.id, game?.status, chess]);

  // Load stats & rankings when entering lobby
  useEffect(() => {
    if (view !== "lobby" || !myId) return;
    setLoadingStats(true);
    Promise.all([chessApi.getHistory(), chessApi.getRankings()])
      .then(([hist, ranks]) => {
        setMyStats(hist as { wins: number; losses: number; draws: number; total: number; games: HistoryGame[] });
        setRankings(ranks);
      })
      .catch(() => {})
      .finally(() => setLoadingStats(false));
  }, [view, myId]);

  // ── User search ───────────────────────────────────────────────────────────
  const handleSearch = useCallback(
    (q: string) => {
      setSearchQuery(q);
      if (!q.trim()) {
        setSearchResults([]);
        setShowDropdown(false);
        return;
      }
      setShowDropdown(true);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(async () => {
        setSearching(true);
        try {
          const res = await authApi.searchUsers(q);
          const list: UserResult[] = Array.isArray(res?.users)
            ? res.users
            : Array.isArray(res)
              ? (res as UserResult[])
              : [];
          setSearchResults(list.filter((u) => u.id !== myId));
          setShowDropdown(true);
        } catch {
          setSearchResults([]);
        } finally {
          setSearching(false);
        }
      }, 300);
    },
    [myId],
  );

  // Close dropdown on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // ── Invite actions ────────────────────────────────────────────────────────
  const sendInvite = async (toUserId: string, toUserName: string) => {
    setSendingTo(toUserId);
    try {
      await chessApi.sendInvite(toUserId, toUserName);
      setSearchQuery("");
      setSearchResults([]);
      setShowDropdown(false);
      // Optimistically show outgoing invite immediately
      const optimistic: Invitation = {
        id: `opt-${Date.now()}`,
        fromUserId: myId,
        fromUserName: myName,
        toUserId,
        toUserName,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      setInvitations((prev) => [...prev, optimistic]);
      fetchLobby(); // sync real state in background
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Алдаа гарлаа";
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      setErrorMsg(msg);
      errorTimerRef.current = setTimeout(() => setErrorMsg(null), 3000);
    } finally {
      setSendingTo(null);
    }
  };

  const acceptInvite = async (inv: Invitation) => {
    setAcceptingId(inv.id);
    try {
      const { gameId: gId } = await chessApi.acceptInvite(inv.id);
      openGame(gId);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Алдаа гарлаа";
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      setErrorMsg(msg);
      errorTimerRef.current = setTimeout(() => setErrorMsg(null), 3000);
    } finally {
      setAcceptingId(null);
    }
  };

  const declineInvite = async (id: string) => {
    setDecliningId(id);
    try {
      await chessApi.declineInvite(id);
      await fetchLobby();
    } catch {
    } finally {
      setDecliningId(null);
    }
  };

  // ── Navigation ────────────────────────────────────────────────────────────
  const openGame = (id: string) => {
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    setGameId(id);
    setSelectedSq(null);
    setLegalSqs([]);
    setLastMove(null);
    setGame(null);
    setChessState(new Chess());
    setView("game");
  };

  const backToLobby = () => {
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    setView("lobby");
    setGameId(null);
    setGame(null);
    setChessState(new Chess());
    setSelectedSq(null);
    setLegalSqs([]);
  };

  // ── Board interaction ─────────────────────────────────────────────────────
  const handleSquareClick = useCallback(
    async (sq: string) => {
      if (!game || game.status !== "active" || submitting) return;
      const isMyTurn =
        (chess.turn() === "w" && myColor === "w") ||
        (chess.turn() === "b" && myColor === "b");
      if (!isMyTurn) return;

      const piece = chess.get(sq as Square) as {
        type: string;
        color: string;
      } | null;

      if (selectedSq) {
        // Deselect same square
        if (selectedSq === sq) {
          setSelectedSq(null);
          setLegalSqs([]);
          return;
        }
        // Make move on legal destination
        if (legalSqs.includes(sq)) {
          setSubmitting(true);
          try {
            const srcPiece = chess.get(selectedSq as Square) as {
              type: string;
              color: string;
            } | null;
            const moveObj: { from: Square; to: Square; promotion?: string } = {
              from: selectedSq as Square,
              to: sq as Square,
            };
            if (
              srcPiece?.type === "p" &&
              ((myColor === "w" && sq[1] === "8") ||
                (myColor === "b" && sq[1] === "1"))
            ) {
              moveObj.promotion = "q";
            }
            const result = chess.move(moveObj);
            if (result) {
              await chessApi.makeMove(game.id, result.san);
              setChessState(new Chess(chess.fen()));
              setLastMove({ from: result.from, to: result.to });
            }
          } catch (e: unknown) {
            const msg =
              (e as { response?: { data?: { message?: string } } })?.response
                ?.data?.message ?? "Нүүд буруу байна";
            if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
            setErrorMsg(msg);
            errorTimerRef.current = setTimeout(() => setErrorMsg(null), 3000);
          } finally {
            setSubmitting(false);
          }
          setSelectedSq(null);
          setLegalSqs([]);
          return;
        }
        // Reselect own piece
        if (piece && piece.color === chess.turn()) {
          setSelectedSq(sq);
          setLegalSqs(
            (
              chess.moves({ square: sq as Square, verbose: true }) as Move[]
            ).map((m) => m.to),
          );
          return;
        }
        setSelectedSq(null);
        setLegalSqs([]);
      } else {
        if (piece && piece.color === chess.turn()) {
          setSelectedSq(sq);
          setLegalSqs(
            (
              chess.moves({ square: sq as Square, verbose: true }) as Move[]
            ).map((m) => m.to),
          );
        }
      }
    },
    [chess, game, legalSqs, myColor, selectedSq, submitting],
  );

  // ── Resign ────────────────────────────────────────────────────────────────
  const resign = () => {
    if (!game || game.status !== "active") return;
    setShowResignModal(true);
  };

  const confirmResign = async () => {
    if (!game) return;
    setShowResignModal(false);
    setResigning(true);
    try {
      const status = myColor === "w" ? "black_won" : "white_won";
      await chessApi.finishGame(game.id, status, "resignation");
      await fetchGame(game.id);
    } catch {
    } finally {
      setResigning(false);
    }
  };

  // ── Board render ──────────────────────────────────────────────────────────
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
                {/* Rank label — left edge */}
                {file === files[0] && (
                  <span
                    className="absolute top-0.5 left-0.5 text-[min(1.6vw,8px)] font-bold leading-none pointer-events-none select-none"
                    style={{ color: isLight ? "#B58863" : "#F0D9B5" }}
                  >
                    {rank}
                  </span>
                )}
                {/* File label — bottom edge */}
                {rank === ranks[ranks.length - 1] && (
                  <span
                    className="absolute bottom-0.5 right-0.5 text-[min(1.6vw,8px)] font-bold leading-none pointer-events-none select-none"
                    style={{ color: isLight ? "#B58863" : "#F0D9B5" }}
                  >
                    {file}
                  </span>
                )}

                {/* Legal move indicator */}
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

                {/* Piece */}
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

  // ── Game status banner ────────────────────────────────────────────────────
  const renderBanner = () => {
    if (!game) return null;
    const moves = parseMoves(game.moves);
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
            ? `Тэнцэл — ${RESULT_REASON[game.resultReason] ?? game.resultReason}`
            : isWin
              ? `🎉 Та хожлоо! (${RESULT_REASON[game.resultReason] ?? game.resultReason})`
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
              <Loader2 className="w-3 h-3 animate-spin" /> Нүүж байна...
            </span>
          ) : isMyTurn ? (
            "Таны ээлж"
          ) : (
            "Харидсан..."
          )}
        </div>
      </div>
    );
  };

  // ── Move history ──────────────────────────────────────────────────────────
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

  // ── Derived lobby data ────────────────────────────────────────────────────
  const incoming = invitations.filter((i) => i.toUserId === myId);
  const outgoing = invitations.filter((i) => i.fromUserId === myId);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen bg-[#0f1117] text-white overflow-hidden">
      {/* Resign confirmation modal */}
      <AnimatePresence>
        {showResignModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 12 }}
              transition={{ duration: 0.18 }}
              className="bg-slate-800 border border-slate-700/60 rounded-2xl p-6 max-w-xs w-full mx-4 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 flex items-center justify-center">
                  <Flag className="w-4 h-4 text-rose-400" />
                </div>
                <h3 className="text-white font-semibold">Буулт өгөх үү?</h3>
              </div>
              <p className="text-slate-400 text-sm mb-5">
                Тэнцэл хүссэн бол өрсөлдөгчтэйгөө тохиролцоорой.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowResignModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-700/60 hover:bg-slate-600/60 text-slate-300 text-sm transition-all"
                >
                  Цуцлах
                </button>
                <button
                  onClick={confirmResign}
                  disabled={resigning}
                  className="flex-1 py-2.5 rounded-xl bg-rose-500/80 hover:bg-rose-500 text-white text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {resigning && <Loader2 className="w-4 h-4 animate-spin" />}
                  Буулт өгөх
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error toast */}
      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-rose-500/90 backdrop-blur-sm text-white text-sm rounded-xl shadow-2xl font-medium whitespace-nowrap"
          >
            {errorMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-16 left-1/2 -translate-x-1/2 w-[700px] h-[300px] rounded-full bg-amber-500/5 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-10">
        {/* Page header */}
        <div className="flex items-center gap-4 mb-8">
          {view === "game" && (
            <button
              onClick={backToLobby}
              className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 text-slate-400 hover:text-white transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Оюуны спорт</h1>
              <p className="text-xs text-slate-400">
                {view === "lobby"
                  ? "Шатар — урилга илгээж тоглоом эхлүүл"
                  : `Тоглоом · ${gameId?.slice(0, 8) ?? ""}…`}
              </p>
            </div>
          </div>
        </div>

        {/* ── LOBBY ──────────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {view === "lobby" && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              {/* Search & Invite */}
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <Search className="w-4 h-4 text-amber-400" />
                  Өрсөлдөгч хайх
                </h2>
                <div className="relative" ref={searchBoxRef}>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      autoComplete="off"
                      onChange={(e) => handleSearch(e.target.value)}
                      onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                      placeholder="Нэр эсвэл ID-аар хайх..."
                      className="w-full h-11 bg-slate-800/60 border border-slate-700 rounded-xl pl-4 pr-11 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/20 transition-all"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {searching ? (
                        <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
                      ) : searchQuery ? (
                        <Search className="w-4 h-4 text-slate-500" />
                      ) : null}
                    </div>
                  </div>

                  {/* Suggestions dropdown — same style as login page */}
                  <AnimatePresence>
                    {showDropdown && searchResults.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-50 w-full mt-2 bg-slate-800/95 backdrop-blur-xl border border-amber-500/20 rounded-2xl shadow-2xl overflow-hidden"
                      >
                        <div className="max-h-56 overflow-y-auto divide-y divide-slate-700/50">
                          {searchResults.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => sendInvite(u.id, u.name)}
                              disabled={sendingTo === u.id}
                              className="w-full px-4 py-3 text-left hover:bg-amber-500/10 transition-colors flex items-center gap-3 disabled:opacity-60"
                            >
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                                {u.name.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">
                                  {u.name}
                                </p>
                                {u.position && (
                                  <p className="text-xs text-slate-400 truncate mt-0.5">
                                    {u.position}
                                  </p>
                                )}
                              </div>
                              <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-medium">
                                {sendingTo === u.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Send className="w-3 h-3" />
                                )}
                                Урих
                              </div>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Invitations */}
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <Swords className="w-4 h-4 text-amber-400" />
                  Урилгууд
                  {incoming.length > 0 && (
                    <span className="ml-auto px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-400 text-xs font-bold">
                      +{incoming.length}
                    </span>
                  )}
                </h2>

                {incoming.length === 0 && outgoing.length === 0 ? (
                  <p className="text-slate-500 text-xs text-center py-6">
                    Одоогоор урилга байхгүй
                  </p>
                ) : (
                  <div className="space-y-2">
                    {incoming.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20"
                      >
                        <div>
                          <p className="text-sm font-medium text-white">
                            {inv.fromUserName}
                          </p>
                          <p className="text-xs text-rose-400">
                            Таныг тоглоомд урьж байна
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => acceptInvite(inv)}
                            disabled={!!acceptingId}
                            className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 transition-all disabled:opacity-50"
                            title="Зөвшөөрөх"
                          >
                            {acceptingId === inv.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => declineInvite(inv.id)}
                            disabled={decliningId === inv.id}
                            className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 transition-all disabled:opacity-50"
                            title="Татгалзах"
                          >
                            {decliningId === inv.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <X className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                    {outgoing.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-900/50 border border-slate-700/30"
                      >
                        <div>
                          <p className="text-sm text-slate-300">
                            {inv.toUserName}
                          </p>
                          <p className="text-xs text-amber-400/70 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Хариу хүлээж байна...
                          </p>
                        </div>
                        <button
                          onClick={() => declineInvite(inv.id)}
                          disabled={decliningId === inv.id}
                          className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-600/60 text-slate-400 transition-all shrink-0"
                          title="Цуцлах"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Active games */}
              {activeGames.filter((g) => g.status === "active").length > 0 && (
                <div className="md:col-span-2 bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 space-y-3">
                  <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    <Swords className="w-4 h-4 text-emerald-400" />
                    Явж байгаа тоглоомууд
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {activeGames.filter((g) => g.status === "active").map((g) => {
                      const amWhite = g.whiteUserId === myId;
                      const moves = parseMoves(g.moves);
                      const opp = amWhite ? g.blackUserName : g.whiteUserName;
                      const isMyTurn =
                        (moves.length % 2 === 0 && amWhite) ||
                        (moves.length % 2 !== 0 && !amWhite);
                      return (
                        <button
                          key={g.id}
                          onClick={() => openGame(g.id)}
                          className="flex items-center justify-between px-4 py-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/18 border border-emerald-500/20 transition-all text-left w-full"
                        >
                          <div>
                            <p className="text-sm font-medium text-white">
                              vs {opp}
                            </p>
                            <p className="text-xs text-slate-500">
                              {moves.length} нүүд · {amWhite ? "Цагаан" : "Хар"}
                            </p>
                          </div>
                          {isMyTurn && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/25 text-emerald-400 text-xs font-semibold shrink-0">
                              Ээлж
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Stats & Rankings ── */}
              {(() => {
                const maxWins = rankings.length > 0 ? rankings[0].wins : 0;
                const myRankIdx = rankings.findIndex((r) => r.id === myId);
                const myRankEntry = myRankIdx >= 0 ? rankings[myRankIdx] : null;
                const myTitle = getTitle(myRankEntry?.wins ?? myStats?.wins ?? 0, maxWins);
                return (
                  <>
                    {/* My stats card */}
                    {myStats && (
                      <div className="md:col-span-2 bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 space-y-4">
                        <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-amber-400" />
                          Миний тоглоомын мэдээлэл
                        </h2>
                        {/* Title badge */}
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-semibold ${myTitle.bg} ${myTitle.color}`}>
                          <span>{myTitle.icon}</span>
                          <span>{myTitle.label}</span>
                          {myRankIdx >= 0 && (
                            <span className="text-xs opacity-60">#{myRankIdx + 1} эрэмбэ</span>
                          )}
                        </div>
                        {/* W / D / L counters */}
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl py-3">
                            <p className="text-xl font-bold text-emerald-400">{myStats.wins}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">Хожсон</p>
                          </div>
                          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl py-3">
                            <p className="text-xl font-bold text-yellow-400">{myStats.draws}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">Тэнцэл</p>
                          </div>
                          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl py-3">
                            <p className="text-xl font-bold text-rose-400">{myStats.losses}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">Хожигдсон</p>
                          </div>
                        </div>
                        {/* Recent games list */}
                        {myStats.games.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-xs text-slate-500 font-medium">Сүүлийн тоглоомууд</p>
                            <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                              {myStats.games.slice(0, 8).map((g) => (
                                <div key={g.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900/50">
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                                    g.result === "win" ? "bg-emerald-400" : g.result === "draw" ? "bg-yellow-400" : "bg-rose-400"
                                  }`} />
                                  <span className="text-xs text-slate-300 flex-1 truncate">vs {g.opponent}</span>
                                  <span className={`text-[10px] font-medium shrink-0 ${
                                    g.result === "win" ? "text-emerald-400" : g.result === "draw" ? "text-yellow-400" : "text-rose-400"
                                  }`}>
                                    {RESULT_REASON[g.resultReason] ?? g.resultReason}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {loadingStats && !myStats && (
                      <div className="md:col-span-2 bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 flex items-center justify-center h-32">
                        <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                      </div>
                    )}

                    {/* Rankings table */}
                    {rankings.length > 0 && (
                      <div className="md:col-span-2 bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 space-y-3">
                        <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-amber-400" />
                          Рейтинг
                        </h2>
                        <div className="space-y-1.5">
                          {rankings.slice(0, 15).map((r, i) => {
                            const t = getTitle(r.wins, maxWins);
                            const isMe = r.id === myId;
                            return (
                              <div
                                key={r.id}
                                className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${
                                  isMe
                                    ? "bg-amber-500/10 border border-amber-500/20"
                                    : "bg-slate-900/40"
                                }`}
                              >
                                <span className={`w-6 text-xs font-bold text-center shrink-0 ${
                                  i === 0 ? "text-amber-400" : i === 1 ? "text-slate-300" : i === 2 ? "text-orange-400" : "text-slate-600"
                                }`}>
                                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                                </span>
                                <span className="text-sm shrink-0">{t.icon}</span>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium truncate ${isMe ? "text-amber-300" : "text-white"}`}>
                                    {r.name}{isMe && <span className="ml-1 text-xs text-amber-400/60">(Та)</span>}
                                  </p>
                                  <p className={`text-[10px] font-medium ${t.color}`}>{t.label}</p>
                                </div>
                                <div className="flex gap-2 text-xs shrink-0">
                                  <span className="text-emerald-400 font-semibold">{r.wins}Х</span>
                                  <span className="text-slate-600">/</span>
                                  <span className="text-rose-400">{r.losses}Т</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </motion.div>
          )}

          {/* ── GAME ─────────────────────────────────────────────────────── */}
          {view === "game" && (
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
                    {/* Controls */}
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
                          Буулт өгөх
                        </button>
                      )}
                      {game.status !== "active" && (
                        <button
                          onClick={backToLobby}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/20 text-amber-400 text-sm font-medium transition-all"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Лобби руу буцах
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
                                filter:
                                  "drop-shadow(0 1px 3px rgba(0,0,0,0.6))",
                              }}
                            >
                              {symbol}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate">
                                {name}
                                {isMe && (
                                  <span className="ml-1.5 text-xs text-amber-400/70">
                                    (Та)
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
                        ⚠️ Шах!
                      </div>
                    )}

                    {/* Move history */}
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 space-y-2">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Нүүдлийн жагсаалт
                      </h3>
                      {renderMoveHistory()}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
