"use client";

import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Loader2, Flag } from "lucide-react";

import ToolPageHeader from "@/components/shared/ToolPageHeader";
import { useChessGame } from "./_hooks/useChessGame";
import LobbyView from "./_components/LobbyView";
import GameView from "./_components/GameView";

export default function ChessPage() {
  const { user } = useAuth();
  const myId = user?.id ?? "";
  const myName = user?.name ?? "";

  const h = useChessGame(myId, myName);

  return (
    <div className="relative min-h-screen bg-[#0f1117] text-white overflow-hidden">
      {/* Resign confirmation modal */}
      <AnimatePresence>
        {h.showResignModal && (
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
                <h3 className="text-white font-semibold">Тоглоом дуусгах уу</h3>
              </div>
              <p className="text-slate-400 text-sm mb-5">
                Тоглоомыг дуусгавал хожигдсон гэж тооцогдоно.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => h.setShowResignModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-700/60 hover:bg-slate-600/60 text-slate-300 text-sm transition-all"
                >
                  Болих
                </button>
                <button
                  onClick={h.confirmResign}
                  disabled={h.resigning}
                  className="flex-1 py-2.5 rounded-xl bg-rose-500/80 hover:bg-rose-500 text-white text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {h.resigning && <Loader2 className="w-4 h-4 animate-spin" />}
                  Тоглоом дуусгах
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error toast */}
      <AnimatePresence>
        {h.errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-rose-500/90 backdrop-blur-sm text-white text-sm rounded-xl shadow-2xl font-medium whitespace-nowrap"
          >
            {h.errorMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-16 left-1/2 -translate-x-1/2 w-[700px] h-[300px] rounded-full bg-amber-500/5 blur-3xl" />
      </div>

      <ToolPageHeader
        href="/tools"
        onBack={h.view === "game" ? h.backToLobby : undefined}
        icon={
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center shadow-md">
            <Crown className="w-3.5 h-3.5 text-white" />
          </div>
        }
        title="Шатрын тоглоом"
        subtitle={
          h.view === "lobby"
            ? "Найзтайгаа онлайн шатар тоглоорой"
            : `Тоглоом: ${h.gameId?.slice(0, 8) ?? ""}…`
        }
      />

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-10">
        <AnimatePresence mode="wait">
          {h.view === "lobby" && (
            <LobbyView
              myId={myId}
              searchQuery={h.searchQuery}
              searchResults={h.searchResults}
              searching={h.searching}
              sendingTo={h.sendingTo}
              showDropdown={h.showDropdown}
              setShowDropdown={h.setShowDropdown}
              searchBoxRef={h.searchBoxRef}
              handleSearch={h.handleSearch}
              sendInvite={h.sendInvite}
              incoming={h.incoming}
              outgoing={h.outgoing}
              acceptingId={h.acceptingId}
              decliningId={h.decliningId}
              acceptInvite={h.acceptInvite}
              declineInvite={h.declineInvite}
              activeGames={h.activeGames}
              openGame={h.openGame}
              myStats={h.myStats}
              rankings={h.rankings}
              loadingStats={h.loadingStats}
            />
          )}

          {h.view === "game" && (
            <GameView
              myId={myId}
              myName={myName}
              game={h.game}
              chess={h.chess}
              myColor={h.myColor}
              selectedSq={h.selectedSq}
              legalSqs={h.legalSqs}
              lastMove={h.lastMove}
              submitting={h.submitting}
              resigning={h.resigning}
              whiteMs={h.whiteMs}
              blackMs={h.blackMs}
              handleSquareClick={h.handleSquareClick}
              resign={h.resign}
              backToLobby={h.backToLobby}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
