import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Send,
  Check,
  X,
  Loader2,
  Clock,
  Swords,
  Trophy,
  TrendingUp,
} from "lucide-react";
import type {
  Invitation,
  GameInfo,
  RankEntry,
  HistoryGame,
} from "./chess.types";
import { RESULT_REASON, getTitle, parseMoves } from "./chess.utils";

interface LobbyViewProps {
  myId: string;
  // search
  searchQuery: string;
  searchResults: { id: string; name: string; position?: string }[];
  searching: boolean;
  sendingTo: string | null;
  showDropdown: boolean;
  setShowDropdown: (v: boolean) => void;
  searchBoxRef: React.RefObject<HTMLDivElement | null>;
  handleSearch: (q: string) => void;
  sendInvite: (toUserId: string, toUserName: string) => void;
  // invitations
  incoming: Invitation[];
  outgoing: Invitation[];
  acceptingId: string | null;
  decliningId: string | null;
  acceptInvite: (inv: Invitation) => void;
  declineInvite: (id: string) => void;
  // active games
  activeGames: GameInfo[];
  openGame: (id: string) => void;
  // stats
  myStats: {
    wins: number;
    losses: number;
    draws: number;
    total: number;
    games: HistoryGame[];
  } | null;
  rankings: RankEntry[];
  loadingStats: boolean;
}

export default function LobbyView(props: LobbyViewProps) {
  const {
    myId,
    searchQuery,
    searchResults,
    searching,
    sendingTo,
    showDropdown,
    setShowDropdown,
    searchBoxRef,
    handleSearch,
    sendInvite,
    incoming,
    outgoing,
    acceptingId,
    decliningId,
    acceptInvite,
    declineInvite,
    activeGames,
    openGame,
    myStats,
    rankings,
    loadingStats,
  } = props;

  const maxWins = rankings.length > 0 ? rankings[0].wins : 0;
  const myRankIdx = rankings.findIndex((r) => r.id === myId);
  const myRankEntry = myRankIdx >= 0 ? rankings[myRankIdx] : null;
  const myTitle = getTitle(myRankEntry?.wins ?? myStats?.wins ?? 0, maxWins);

  return (
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
          Хэрэглэгч хайх
        </h2>
        <div className="relative" ref={searchBoxRef}>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              autoComplete="off"
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
              placeholder="Нэр эсвэл ID-ээр хайх..."
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
          Урилга
          {incoming.length > 0 && (
            <span className="ml-auto px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-400 text-xs font-bold">
              +{incoming.length}
            </span>
          )}
        </h2>

        {incoming.length === 0 && outgoing.length === 0 ? (
          <p className="text-slate-500 text-xs text-center py-6">
            Урилга одоогоор байхгүй
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
                  <p className="text-sm text-slate-300">{inv.toUserName}</p>
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
            Идэвхтэй тоглоомууд
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeGames
              .filter((g) => g.status === "active")
              .map((g) => {
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
                      <p className="text-sm font-medium text-white">vs {opp}</p>
                      <p className="text-xs text-slate-500">
                        {moves.length} нүүд • {amWhite ? "Цагаан" : "Хар"}
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

      {/* My stats card */}
      {myStats && (
        <div className="md:col-span-2 bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            Миний тоглоомын статистик
          </h2>
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-semibold ${myTitle.bg} ${myTitle.color}`}
          >
            <span>{myTitle.icon}</span>
            <span>{myTitle.label}</span>
            {myRankIdx >= 0 && (
              <span className="text-xs opacity-60">
                #{myRankIdx + 1} байранд
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl py-3">
              <p className="text-xl font-bold text-emerald-400">
                {myStats.wins}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Ялалт</p>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl py-3">
              <p className="text-xl font-bold text-yellow-400">
                {myStats.draws}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Тэнцсэн</p>
            </div>
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl py-3">
              <p className="text-xl font-bold text-rose-400">
                {myStats.losses}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Хожигдсон</p>
            </div>
          </div>
          {myStats.games.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-slate-500 font-medium">
                Сүүлийн тоглоомууд
              </p>
              <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                {myStats.games.slice(0, 8).map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900/50"
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        g.result === "win"
                          ? "bg-emerald-400"
                          : g.result === "draw"
                            ? "bg-yellow-400"
                            : "bg-rose-400"
                      }`}
                    />
                    <span className="text-xs text-slate-300 flex-1 truncate">
                      vs {g.opponent}
                    </span>
                    <span
                      className={`text-[10px] font-medium shrink-0 ${
                        g.result === "win"
                          ? "text-emerald-400"
                          : g.result === "draw"
                            ? "text-yellow-400"
                            : "text-rose-400"
                      }`}
                    >
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
            Байрлал
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
                  <span
                    className={`w-6 text-xs font-bold text-center shrink-0 ${
                      i === 0
                        ? "text-amber-400"
                        : i === 1
                          ? "text-slate-300"
                          : i === 2
                            ? "text-orange-400"
                            : "text-slate-600"
                    }`}
                  >
                    {i === 0
                      ? "🥇"
                      : i === 1
                        ? "🥈"
                        : i === 2
                          ? "🥉"
                          : `${i + 1}`}
                  </span>
                  <span className="text-sm shrink-0">{t.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${isMe ? "text-amber-300" : "text-white"}`}
                    >
                      {r.name}
                      {isMe && (
                        <span className="ml-1 text-xs text-amber-400/60">
                          (би)
                        </span>
                      )}
                    </p>
                    <p className={`text-[10px] font-medium ${t.color}`}>
                      {t.label}
                    </p>
                  </div>
                  <div className="flex gap-2 text-xs shrink-0">
                    <span className="text-emerald-400 font-semibold">
                      {r.wins}я
                    </span>
                    <span className="text-slate-600">/</span>
                    <span className="text-rose-400">{r.losses}х</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}
