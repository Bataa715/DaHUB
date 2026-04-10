"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { authApi, chessApi } from "@/lib/api";
import { Chess } from "chess.js";
import type { Square, Move } from "chess.js";
import type {
  Invitation,
  GameInfo,
  UserResult,
  RankEntry,
  HistoryGame,
} from "../_components/chess.types";
import { parseMoves, buildChess } from "../_components/chess.utils";

export function useChessGame(myId: string, myName: string) {
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
  const [myStats, setMyStats] = useState<{
    wins: number;
    losses: number;
    draws: number;
    total: number;
    games: HistoryGame[];
  } | null>(null);
  const [rankings, setRankings] = useState<RankEntry[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);

  // -- helpers ---------------------------------------------------------------
  const showError = useCallback((msg: string) => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setErrorMsg(msg);
    errorTimerRef.current = setTimeout(() => setErrorMsg(null), 3000);
  }, []);

  // -- Lobby polling ---------------------------------------------------------
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

  // -- Game polling ----------------------------------------------------------
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

  useEffect(() => {
    if (game) setMyColor(game.whiteUserId === myId ? "w" : "b");
  }, [game, myId]);

  useEffect(() => {
    if (!game) return;
    setWhiteMs(
      typeof game.whiteTimeMs === "number" ? game.whiteTimeMs : 600000,
    );
    setBlackMs(
      typeof game.blackTimeMs === "number" ? game.blackTimeMs : 600000,
    );
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
            chessApi
              .finishGame(game.id, "black_won", "timeout")
              .catch(() => {});
          }
          return next;
        });
      } else {
        setBlackMs((prev) => {
          const next = Math.max(0, prev - 1000);
          if (next <= 0 && !finishedRef.current) {
            finishedRef.current = true;
            chessApi
              .finishGame(game.id, "white_won", "timeout")
              .catch(() => {});
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
        setMyStats(
          hist as {
            wins: number;
            losses: number;
            draws: number;
            total: number;
            games: HistoryGame[];
          },
        );
        setRankings(ranks);
      })
      .catch(() => {})
      .finally(() => setLoadingStats(false));
  }, [view, myId]);

  // -- User search -----------------------------------------------------------
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
      if (
        searchBoxRef.current &&
        !searchBoxRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // -- Invite actions --------------------------------------------------------
  const sendInvite = async (toUserId: string, toUserName: string) => {
    setSendingTo(toUserId);
    try {
      await chessApi.sendInvite(toUserId, toUserName);
      setSearchQuery("");
      setSearchResults([]);
      setShowDropdown(false);
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
      fetchLobby();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Алдаа гарлаа";
      showError(msg);
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
      showError(msg);
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

  // -- Navigation ------------------------------------------------------------
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

  // -- Board interaction -----------------------------------------------------
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
        if (selectedSq === sq) {
          setSelectedSq(null);
          setLegalSqs([]);
          return;
        }
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
                ?.data?.message ?? "Нүүд хийхэд алдаа гарлаа";
            showError(msg);
          } finally {
            setSubmitting(false);
          }
          setSelectedSq(null);
          setLegalSqs([]);
          return;
        }
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
    [chess, game, legalSqs, myColor, selectedSq, submitting, showError],
  );

  // -- Resign ----------------------------------------------------------------
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

  // Derived lobby data
  const incoming = invitations.filter((i) => i.toUserId === myId);
  const outgoing = invitations.filter((i) => i.fromUserId === myId);

  return {
    // view
    view,
    gameId,
    // lobby
    searchQuery,
    searchResults,
    searching,
    sendingTo,
    incoming,
    outgoing,
    activeGames,
    acceptingId,
    decliningId,
    showDropdown,
    setShowDropdown,
    searchBoxRef,
    myStats,
    rankings,
    loadingStats,
    // game
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
    showResignModal,
    setShowResignModal,
    errorMsg,
    // actions
    handleSearch,
    sendInvite,
    acceptInvite,
    declineInvite,
    openGame,
    backToLobby,
    handleSquareClick,
    resign,
    confirmResign,
    fetchGame,
  };
}
