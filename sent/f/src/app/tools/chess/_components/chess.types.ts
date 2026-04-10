// ── Chess page types ──────────────────────────────────────────────────────────

export interface Invitation {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  status: string;
  createdAt: string;
}

export interface GameInfo {
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

export interface UserResult {
  id: string;
  userId?: string;
  name: string;
  position?: string;
}

export interface RankEntry {
  id: string;
  name: string;
  wins: number;
  losses: number;
  draws: number;
}

export interface HistoryGame {
  id: string;
  opponent: string;
  result: "win" | "loss" | "draw";
  resultReason: string;
  createdAt: string;
}
