// ── Chess page constants & helpers ───────────────────────────────────────────
import { Chess } from "chess.js";

export const PIECE_UNICODE: Record<string, string> = {
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

export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

export const RESULT_REASON: Record<string, string> = {
  checkmate: "Мат",
  stalemate: "Тал",
  resignation: "Буулт өгсөн",
  draw_agreement: "Тэнцэл тохиролцсон",
  insufficient_material: "Материал хүрэлцэхгүй",
  fifty_move: "50 нүүдлийн дүрэм",
  threefold_repetition: "Гурван давталт",
  timeout: "Цаг дууссан",
};

export function formatTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export const TITLES = [
  {
    label: "Лорд",
    ratio: 1,
    color: "text-amber-400",
    bg: "bg-amber-500/15 border-amber-500/30",
    icon: "👑",
  },
  {
    label: "Жанжин",
    ratio: 0.5,
    color: "text-orange-400",
    bg: "bg-orange-500/15 border-orange-500/30",
    icon: "✨",
  },
  {
    label: "Хурандаа",
    ratio: 0.25,
    color: "text-blue-400",
    bg: "bg-blue-500/15 border-blue-500/30",
    icon: "🏛️",
  },
  {
    label: "Ахлагч",
    ratio: 0.1,
    color: "text-emerald-400",
    bg: "bg-emerald-500/15 border-emerald-500/30",
    icon: "🏅",
  },
  {
    label: "Дайчин",
    ratio: 0,
    color: "text-slate-400",
    bg: "bg-slate-700/40 border-slate-600/30",
    icon: "⚔️",
  },
] as const;

export function getTitle(wins: number, maxWins: number) {
  if (maxWins === 0) return TITLES[TITLES.length - 1];
  const ratio = wins / maxWins;
  return TITLES.find((t) => ratio >= t.ratio) ?? TITLES[TITLES.length - 1];
}

export function parseMoves(json: string): string[] {
  try {
    const r = JSON.parse(json);
    return Array.isArray(r) ? r : [];
  } catch {
    return [];
  }
}

export function buildChess(moves: string[]): Chess {
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
