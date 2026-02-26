import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { ClickHouseService, nowCH } from "../clickhouse/clickhouse.service";
import { SendInviteDto, MakeMoveDto, FinishGameDto } from "./dto/chess.dto";
import { randomUUID } from "crypto";

export interface ChessInvitation {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  status: string;
  createdAt: string;
}

export interface ChessGame {
  id: string;
  whiteUserId: string;
  whiteUserName: string;
  blackUserId: string;
  blackUserName: string;
  moves: string; // JSON string array
  status: string; // active | white_won | black_won | draw
  resultReason: string;
  whiteTimeMs: number; // remaining ms
  blackTimeMs: number; // remaining ms
  lastMoveAt: string;
  createdAt: string;
}

@Injectable()
export class ChessService {
  constructor(private clickhouse: ClickHouseService) {
    this.ensureTablesExist();
  }

  private async ensureTablesExist() {
    try {
      await this.clickhouse.exec(`
        CREATE TABLE IF NOT EXISTS chess_invitations (
          id String,
          fromUserId String,
          fromUserName String,
          toUserId String,
          toUserName String,
          status String DEFAULT 'pending',
          seq UInt64,
          createdAt DateTime DEFAULT now()
        ) ENGINE = MergeTree() ORDER BY (id, seq)
      `);
      await this.clickhouse.exec(`
        CREATE TABLE IF NOT EXISTS chess_games (
          id String,
          whiteUserId String,
          whiteUserName String,
          blackUserId String,
          blackUserName String,
          moves String DEFAULT '[]',
          status String DEFAULT 'active',
          resultReason String DEFAULT '',
          whiteTimeMs UInt32 DEFAULT 600000,
          blackTimeMs UInt32 DEFAULT 600000,
          lastMoveAt String DEFAULT '',
          seq UInt64,
          createdAt DateTime DEFAULT now()
        ) ENGINE = MergeTree() ORDER BY (id, seq)
      `);
      // Migrate existing tables
      await this.clickhouse
        .exec(
          `ALTER TABLE chess_games ADD COLUMN IF NOT EXISTS whiteTimeMs UInt32 DEFAULT 600000`,
        )
        .catch(() => {});
      await this.clickhouse
        .exec(
          `ALTER TABLE chess_games ADD COLUMN IF NOT EXISTS blackTimeMs UInt32 DEFAULT 600000`,
        )
        .catch(() => {});
      await this.clickhouse
        .exec(
          `ALTER TABLE chess_games ADD COLUMN IF NOT EXISTS lastMoveAt String DEFAULT ''`,
        )
        .catch(() => {});
    } catch (e) {
      console.error("Failed to ensure chess tables:", e);
    }
  }

  // ── Invitations ──────────────────────────────────────────────────────────

  async getMyInvitations(userId: string) {
    const rows = await this.clickhouse.query<ChessInvitation>(
      `SELECT *
       FROM (
         SELECT
           id,
           any(fromUserId)      AS fromUserId,
           any(fromUserName)    AS fromUserName,
           any(toUserId)        AS toUserId,
           any(toUserName)      AS toUserName,
           argMax(status, seq)  AS status,
           min(createdAt)       AS createdAt
         FROM chess_invitations
         GROUP BY id
       )
       WHERE (fromUserId = {userId:String} OR toUserId = {userId:String})
         AND status = 'pending'
       ORDER BY createdAt DESC`,
      { userId },
    );
    return rows || [];
  }

  async sendInvite(
    fromUserId: string,
    fromUserName: string,
    dto: SendInviteDto,
  ) {
    if (fromUserId === dto.toUserId) {
      throw new BadRequestException("Өөрөөрөө тоглох боломжгүй");
    }
    // Check for existing pending invite between these two users
    const existing = await this.clickhouse.query<{ id: string }>(
      `SELECT id
       FROM chess_invitations
       WHERE (fromUserId = {a:String} AND toUserId = {b:String})
          OR (fromUserId = {b:String} AND toUserId = {a:String})
       GROUP BY id
       HAVING argMax(status, seq) = 'pending'
       LIMIT 1`,
      { a: fromUserId, b: dto.toUserId },
    );
    if (existing && existing.length > 0) {
      throw new BadRequestException("Аль хэдийн хүлээгдэж буй урилга байна");
    }

    const id = randomUUID();
    const seq = Date.now();
    const now = nowCH();
    await this.clickhouse.insert("chess_invitations", [
      {
        id,
        fromUserId,
        fromUserName,
        toUserId: dto.toUserId,
        toUserName: dto.toUserName,
        status: "pending",
        seq,
        createdAt: now,
      },
    ]);
    return { id, message: "Урилга амжилттай илгээгдлээ" };
  }

  async acceptInvite(inviteId: string, userId: string) {
    const rows = await this.clickhouse.query<ChessInvitation>(
      `SELECT
         id,
         any(fromUserId)   AS fromUserId,
         any(fromUserName) AS fromUserName,
         any(toUserId)     AS toUserId,
         any(toUserName)   AS toUserName,
         argMax(status, seq) AS status,
         min(createdAt)    AS createdAt
       FROM chess_invitations
       WHERE id = {id:String}
       GROUP BY id`,
      { id: inviteId },
    );
    if (!rows || rows.length === 0)
      throw new NotFoundException("Урилга олдсонгүй");
    const invite = rows[0];
    if (invite.toUserId !== userId)
      throw new BadRequestException("Зөвшөөрөх эрхгүй");
    if (invite.status !== "pending")
      throw new BadRequestException("Урилга аль хэдийн боловсруулагдсан байна");

    const seq = Date.now();
    const now = nowCH();

    // Mark as accepted
    await this.clickhouse.insert("chess_invitations", [
      {
        id: invite.id,
        fromUserId: invite.fromUserId,
        fromUserName: invite.fromUserName,
        toUserId: invite.toUserId,
        toUserName: invite.toUserName,
        status: "accepted",
        seq,
        createdAt: invite.createdAt,
      },
    ]);

    // Create game with random color assignment
    const gameId = randomUUID();
    const whiteIsFrom = Math.random() < 0.5;
    await this.clickhouse.insert("chess_games", [
      {
        id: gameId,
        whiteUserId: whiteIsFrom ? invite.fromUserId : invite.toUserId,
        whiteUserName: whiteIsFrom ? invite.fromUserName : invite.toUserName,
        blackUserId: whiteIsFrom ? invite.toUserId : invite.fromUserId,
        blackUserName: whiteIsFrom ? invite.toUserName : invite.fromUserName,
        moves: "[]",
        status: "active",
        resultReason: "",
        whiteTimeMs: 600000,
        blackTimeMs: 600000,
        lastMoveAt: now,
        seq: seq + 1,
        createdAt: now,
      },
    ]);

    return { gameId, message: "Тоглоом эхэллээ" };
  }

  async declineInvite(inviteId: string, userId: string) {
    const rows = await this.clickhouse.query<ChessInvitation>(
      `SELECT
         id,
         any(fromUserId)   AS fromUserId,
         any(fromUserName) AS fromUserName,
         any(toUserId)     AS toUserId,
         any(toUserName)   AS toUserName,
         argMax(status, seq) AS status,
         min(createdAt)    AS createdAt
       FROM chess_invitations
       WHERE id = {id:String}
       GROUP BY id`,
      { id: inviteId },
    );
    if (!rows || rows.length === 0)
      throw new NotFoundException("Урилга олдсонгүй");
    const invite = rows[0];
    if (invite.toUserId !== userId && invite.fromUserId !== userId)
      throw new BadRequestException("Эрхгүй");

    const seq = Date.now();
    await this.clickhouse.insert("chess_invitations", [
      {
        id: invite.id,
        fromUserId: invite.fromUserId,
        fromUserName: invite.fromUserName,
        toUserId: invite.toUserId,
        toUserName: invite.toUserName,
        status: "declined",
        seq,
        createdAt: invite.createdAt,
      },
    ]);
    return { message: "Урилга татгалзагдлаа" };
  }

  // ── Games ─────────────────────────────────────────────────────────────────

  private async getGameState(gameId: string): Promise<ChessGame> {
    const rows = await this.clickhouse.query<ChessGame>(
      `SELECT
         id,
         any(whiteUserId)          AS whiteUserId,
         any(whiteUserName)        AS whiteUserName,
         any(blackUserId)          AS blackUserId,
         any(blackUserName)        AS blackUserName,
         argMax(moves, seq)        AS moves,
         argMax(status, seq)       AS status,
         argMax(resultReason, seq) AS resultReason,
         argMax(whiteTimeMs, seq)  AS whiteTimeMs,
         argMax(blackTimeMs, seq)  AS blackTimeMs,
         argMax(lastMoveAt, seq)   AS lastMoveAt,
         min(createdAt)            AS createdAt
       FROM chess_games
       WHERE id = {id:String}
       GROUP BY id`,
      { id: gameId },
    );
    if (!rows || rows.length === 0)
      throw new NotFoundException("Тоглоом олдсонгүй");
    return rows[0];
  }

  async getGame(gameId: string) {
    return this.getGameState(gameId);
  }

  async getMyGames(userId: string) {
    const rows = await this.clickhouse.query<ChessGame>(
      `SELECT *
       FROM (
         SELECT
           id,
           any(whiteUserId)          AS whiteUserId,
           any(whiteUserName)        AS whiteUserName,
           any(blackUserId)          AS blackUserId,
           any(blackUserName)        AS blackUserName,
           argMax(moves, seq)        AS moves,
           argMax(status, seq)       AS status,
           argMax(resultReason, seq) AS resultReason,
           argMax(whiteTimeMs, seq)  AS whiteTimeMs,
           argMax(blackTimeMs, seq)  AS blackTimeMs,
           min(createdAt)            AS createdAt
         FROM chess_games
         GROUP BY id
       )
       WHERE (whiteUserId = {userId:String} OR blackUserId = {userId:String})
         AND status = 'active'
       ORDER BY createdAt DESC
       LIMIT 20`,
      { userId },
    );
    return rows || [];
  }

  async makeMove(gameId: string, userId: string, dto: MakeMoveDto) {
    const game = await this.getGameState(gameId);
    if (game.status !== "active")
      throw new BadRequestException("Тоглоом дууссан байна");

    const moves: string[] = JSON.parse(game.moves || "[]");
    const isWhiteTurn = moves.length % 2 === 0;
    if (isWhiteTurn && userId !== game.whiteUserId)
      throw new BadRequestException("Энэ таны ээлж биш");
    if (!isWhiteTurn && userId !== game.blackUserId)
      throw new BadRequestException("Энэ таны ээлж биш");

    // Deduct elapsed time from the player who just moved
    const nowDate = new Date();
    const nowStr = nowDate.toISOString().slice(0, 19).replace("T", " ");
    const prevAt =
      game.lastMoveAt && game.lastMoveAt !== ""
        ? game.lastMoveAt
        : game.createdAt;
    const prevDate = new Date(prevAt.replace(" ", "T") + "+00:00");
    const elapsedMs = Math.min(nowDate.getTime() - prevDate.getTime(), 120000);
    let whiteTimeMs =
      typeof game.whiteTimeMs === "number" ? game.whiteTimeMs : 600000;
    let blackTimeMs =
      typeof game.blackTimeMs === "number" ? game.blackTimeMs : 600000;
    if (isWhiteTurn) {
      whiteTimeMs = Math.max(0, whiteTimeMs - elapsedMs);
    } else {
      blackTimeMs = Math.max(0, blackTimeMs - elapsedMs);
    }
    const timedOutStatus =
      whiteTimeMs <= 0 ? "black_won" : blackTimeMs <= 0 ? "white_won" : null;

    moves.push(dto.move);
    const seq = Date.now();
    await this.clickhouse.insert("chess_games", [
      {
        id: game.id,
        whiteUserId: game.whiteUserId,
        whiteUserName: game.whiteUserName,
        blackUserId: game.blackUserId,
        blackUserName: game.blackUserName,
        moves: JSON.stringify(moves),
        status: timedOutStatus ?? game.status,
        resultReason: timedOutStatus ? "timeout" : game.resultReason,
        whiteTimeMs,
        blackTimeMs,
        lastMoveAt: nowStr,
        seq,
        createdAt: game.createdAt,
      },
    ]);
    return { success: true, moveCount: moves.length };
  }

  async finishGame(gameId: string, userId: string, dto: FinishGameDto) {
    const game = await this.getGameState(gameId);
    if (game.status !== "active")
      throw new BadRequestException("Тоглоом аль хэдийн дуусчхсан байна");
    if (userId !== game.whiteUserId && userId !== game.blackUserId)
      throw new BadRequestException("Эрхгүй");

    const seq = Date.now();
    await this.clickhouse.insert("chess_games", [
      {
        id: game.id,
        whiteUserId: game.whiteUserId,
        whiteUserName: game.whiteUserName,
        blackUserId: game.blackUserId,
        blackUserName: game.blackUserName,
        moves: game.moves,
        status: dto.status,
        resultReason: dto.resultReason,
        whiteTimeMs: game.whiteTimeMs ?? 600000,
        blackTimeMs: game.blackTimeMs ?? 600000,
        lastMoveAt: game.lastMoveAt ?? game.createdAt,
        seq,
        createdAt: game.createdAt,
      },
    ]);
    return { message: "Тоглоом дуусгагдлаа" };
  }

  async getHistory(userId: string) {
    const games = await this.clickhouse.query<any>(
      `SELECT *
       FROM (
         SELECT
           id,
           any(whiteUserId)          AS whiteUserId,
           any(whiteUserName)        AS whiteUserName,
           any(blackUserId)          AS blackUserId,
           any(blackUserName)        AS blackUserName,
           argMax(status, seq)       AS status,
           argMax(resultReason, seq) AS resultReason,
           min(createdAt)            AS createdAt
         FROM chess_games
         GROUP BY id
       )
       WHERE (whiteUserId = {userId:String} OR blackUserId = {userId:String})
         AND status != 'active'
       ORDER BY createdAt DESC
       LIMIT 30`,
      { userId },
    );
    let wins = 0,
      losses = 0,
      draws = 0;
    for (const g of games) {
      if (g.status === "draw") draws++;
      else if (
        (g.status === "white_won" && g.whiteUserId === userId) ||
        (g.status === "black_won" && g.blackUserId === userId)
      )
        wins++;
      else losses++;
    }
    return {
      games: games.map((g: any) => ({
        id: g.id,
        opponent: g.whiteUserId === userId ? g.blackUserName : g.whiteUserName,
        result:
          g.status === "draw"
            ? "draw"
            : (g.status === "white_won" && g.whiteUserId === userId) ||
                (g.status === "black_won" && g.blackUserId === userId)
              ? "win"
              : "loss",
        resultReason: g.resultReason,
        createdAt: g.createdAt,
      })),
      wins,
      losses,
      draws,
      total: games.length,
    };
  }

  async getRankings() {
    const games = await this.clickhouse.query<any>(
      `SELECT *
       FROM (
         SELECT
           id,
           any(whiteUserId)    AS whiteUserId,
           any(whiteUserName)  AS whiteUserName,
           any(blackUserId)    AS blackUserId,
           any(blackUserName)  AS blackUserName,
           argMax(status, seq) AS status
         FROM chess_games
         GROUP BY id
       )
       WHERE status IN ('white_won', 'black_won', 'draw')`,
    );
    const stats: Record<
      string,
      { id: string; name: string; wins: number; losses: number; draws: number }
    > = {};
    const ensure = (id: string, name: string) => {
      if (!stats[id]) stats[id] = { id, name, wins: 0, losses: 0, draws: 0 };
    };
    for (const g of games) {
      ensure(g.whiteUserId, g.whiteUserName);
      ensure(g.blackUserId, g.blackUserName);
      if (g.status === "white_won") {
        stats[g.whiteUserId].wins++;
        stats[g.blackUserId].losses++;
      } else if (g.status === "black_won") {
        stats[g.blackUserId].wins++;
        stats[g.whiteUserId].losses++;
      } else {
        stats[g.whiteUserId].draws++;
        stats[g.blackUserId].draws++;
      }
    }
    return Object.values(stats).sort(
      (a, b) => b.wins - a.wins || a.losses - b.losses,
    );
  }
}

