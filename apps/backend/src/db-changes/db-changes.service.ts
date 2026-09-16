import { createHash, randomUUID } from "crypto";
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { ClickHouseService, nowCH } from "../clickhouse/clickhouse.service";
import {
  DbChangesRangeDto,
  DbChangesRecordsDto,
  ImportDbChangesDto,
  ReviewDbChangeDto,
} from "./dto/db-changes.dto";
import {
  dbChangeRowKey,
  isValidDateTime,
  normalizeDbChangeRow,
  sqlCommandOf,
  systemTypeOf,
} from "./db-changes.logic";

const MAX_LIST_ROWS = 500;
const MAX_RANGE_DAYS = 366;

type User = { userId: string; name: string };

export interface DbChangeBatchRow {
  batchId: string;
  fileName: string;
  sheetName: string;
  rowCount: number | string;
  newRows: number | string;
  duplicateRows: number | string;
  skippedRows: number | string;
  minTime: string;
  maxTime: string;
  uploadedBy: string;
  uploadedByName: string;
  createdAt: string;
}

export interface DbChangeRecord {
  rowHash: string;
  actionTime: string;
  username: string;
  machine: string;
  action: string;
  owner: string;
  systemType: string;
  sqlCommand: string;
  objectName: string;
  domain: string;
  sqlText: string;
  sourceDescription: string;
  jira: string;
  flagged: number | string;
  note: string;
  reviewedByName: string;
  reviewedAt: string;
}

type Grouped = { name: string; count: string };

const hashRow = (key: string) => createHash("sha256").update(key).digest("hex");

const toCounts = (rows: Grouped[]) =>
  rows.map((r) => ({ name: r.name || "—", count: Number(r.count) }));

/**
 * Үндсэн системүүдийн өгөгдлийн сангийн өөрчлөлт (Oracle audit trail).
 *
 * Өмнө нь Django + MSSQL дээр Excel оруулж, 14 хоногийн тайлан гаргадаг байв.
 * Одоо: Хэрэгсэл — Excel оруулах, бичлэг бүрийг хянаж сэжигтэй гэж тэмдэглэх;
 * Дашбоард — системийн төрөл, командын төрөл, домэйн, тэмдэглэсэн бичлэгүүд.
 * Системийн төрөл, SQL командыг оруулах үед нэг удаа тооцож хадгална.
 */
@Injectable()
export class DbChangesService implements OnModuleInit {
  private readonly logger = new Logger(DbChangesService.name);

  constructor(private readonly clickhouse: ClickHouseService) {}

  async onModuleInit() {
    const ddl = [
      `CREATE TABLE IF NOT EXISTS db_change_actions (
        rowHash           String,
        actionTime        DateTime,
        username          String,
        machine           String,
        action            LowCardinality(String),
        owner             LowCardinality(String),
        systemType        LowCardinality(String),
        sqlCommand        LowCardinality(String),
        objectName        String,
        domain            String,
        sqlText           String,
        sourceDescription String,
        jira              String,
        batchId           String,
        uploadedBy        String,
        uploadedByName    String,
        uploadedAt        DateTime
      ) ENGINE = ReplacingMergeTree(uploadedAt)
        ORDER BY rowHash`,
      `CREATE TABLE IF NOT EXISTS db_change_reviews (
        rowHash       String,
        flagged       UInt8,
        note          String,
        updatedBy     String,
        updatedByName String,
        updatedAt     DateTime
      ) ENGINE = ReplacingMergeTree(updatedAt)
        ORDER BY rowHash`,
      `CREATE TABLE IF NOT EXISTS db_change_batches (
        batchId        String,
        fileName       String,
        sheetName      String,
        rowCount       UInt32,
        newRows        UInt32,
        duplicateRows  UInt32,
        skippedRows    UInt32,
        minTime        DateTime,
        maxTime        DateTime,
        uploadedBy     String,
        uploadedByName String,
        createdAt      DateTime,
        updatedAt      DateTime
      ) ENGINE = ReplacingMergeTree(updatedAt)
        ORDER BY batchId`,
    ];
    for (const sql of ddl) {
      try {
        await this.clickhouse.exec(sql);
      } catch (e) {
        this.logger.error(
          `Өгөгдлийн сангийн өөрчлөлтийн хүснэгт үүсгэхэд алдаа: ${String(e)}`,
        );
      }
    }
  }

  // ─── Бүртгэл оруулах ─────────────────────────────────────────────────────

  private async getBatch(
    batchId: string,
  ): Promise<DbChangeBatchRow | undefined> {
    const rows = await this.clickhouse.query<DbChangeBatchRow>(
      `SELECT batchId, fileName, sheetName, rowCount, newRows, duplicateRows, skippedRows,
              minTime, maxTime, uploadedBy, uploadedByName, createdAt
       FROM db_change_batches FINAL
       WHERE batchId = {batchId:String}
       LIMIT 1`,
      { batchId },
    );
    return rows[0];
  }

  async importRows(dto: ImportDbChangesDto, user: User) {
    const existingBatch = dto.batchId
      ? await this.getBatch(dto.batchId)
      : undefined;
    if (dto.batchId && !existingBatch)
      throw new NotFoundException("Багц олдсонгүй");
    const batchId = dto.batchId ?? randomUUID();
    const now = nowCH();

    // Эх систем шиг USERNAME / ACTION-гүй мөрийг алгасна
    let skipped = 0;
    const unique = new Map<string, ReturnType<typeof normalizeDbChangeRow>>();
    for (const raw of dto.rows) {
      const row = normalizeDbChangeRow(raw);
      if (!isValidDateTime(row.actionTime) || !row.username || !row.action) {
        skipped++;
        continue;
      }
      unique.set(hashRow(dbChangeRowKey(row)), row);
    }

    const hashes = [...unique.keys()];
    const existing = hashes.length
      ? await this.clickhouse.query<{ rowHash: string }>(
          `SELECT DISTINCT rowHash FROM db_change_actions WHERE rowHash IN {hashes:Array(String)}`,
          { hashes },
        )
      : [];
    const existingSet = new Set(existing.map((r) => r.rowHash));

    const fresh = hashes
      .filter((h) => !existingSet.has(h))
      .map((h) => {
        const row = unique.get(h)!;
        return {
          rowHash: h,
          ...row,
          systemType: systemTypeOf(row.owner),
          sqlCommand: sqlCommandOf(row.sqlText),
          batchId,
          uploadedBy: user.userId,
          uploadedByName: user.name,
          uploadedAt: now,
        };
      });

    if (fresh.length) await this.clickhouse.insert("db_change_actions", fresh);

    // Багцын нэгтгэл — хэсэг бүрээр хуримтлуулна (ReplacingMergeTree: бүтэн мөр)
    const times = [...unique.values()].map((r) => r.actionTime).sort();
    const hasPrev = existingBatch && Number(existingBatch.rowCount) > 0;
    const minTime =
      [hasPrev ? existingBatch.minTime : null, times[0]]
        .filter(Boolean)
        .sort()[0] ?? "1970-01-01 00:00:00";
    const maxTime =
      [hasPrev ? existingBatch.maxTime : null, times[times.length - 1]]
        .filter(Boolean)
        .sort()
        .pop() ?? "1970-01-01 00:00:00";

    await this.clickhouse.insert("db_change_batches", [
      {
        batchId,
        fileName: dto.fileName,
        sheetName: dto.sheetName ?? "",
        rowCount: Number(existingBatch?.rowCount ?? 0) + dto.rows.length,
        newRows: Number(existingBatch?.newRows ?? 0) + fresh.length,
        duplicateRows:
          Number(existingBatch?.duplicateRows ?? 0) +
          (dto.rows.length - skipped - fresh.length),
        skippedRows: Number(existingBatch?.skippedRows ?? 0) + skipped,
        minTime,
        maxTime,
        uploadedBy: existingBatch?.uploadedBy ?? user.userId,
        uploadedByName: existingBatch?.uploadedByName ?? user.name,
        createdAt: existingBatch?.createdAt ?? now,
        updatedAt: now,
      },
    ]);

    return {
      batchId,
      received: dto.rows.length,
      inserted: fresh.length,
      duplicates: dto.rows.length - skipped - fresh.length,
      skipped,
    };
  }

  async listBatches() {
    const rows = await this.clickhouse.query<DbChangeBatchRow>(
      `SELECT batchId, fileName, sheetName, rowCount, newRows, duplicateRows, skippedRows,
              minTime, maxTime, uploadedBy, uploadedByName, createdAt
       FROM db_change_batches FINAL
       ORDER BY createdAt DESC
       LIMIT 50`,
    );
    return rows.map((r) => ({
      ...r,
      rowCount: Number(r.rowCount),
      newRows: Number(r.newRows),
      duplicateRows: Number(r.duplicateRows),
      skippedRows: Number(r.skippedRows),
    }));
  }

  /** Алдаатай оруулсан багцыг бүхэлд нь (дүгнэлтийн хамт) буцаана. */
  async deleteBatch(batchId: string) {
    if (!/^[0-9a-f-]{36}$/i.test(batchId))
      throw new BadRequestException("Багцын дугаар буруу байна");
    const batch = await this.getBatch(batchId);
    if (!batch) throw new NotFoundException("Багц олдсонгүй");

    const counted = await this.clickhouse.query<{ c: string }>(
      `SELECT count() AS c FROM db_change_actions FINAL WHERE batchId = {batchId:String}`,
      { batchId },
    );
    await this.clickhouse.exec(
      `ALTER TABLE db_change_reviews DELETE
       WHERE rowHash IN (SELECT rowHash FROM db_change_actions WHERE batchId = {batchId:String})
       SETTINGS mutations_sync = 1`,
      { batchId },
    );
    await this.clickhouse.exec(
      `ALTER TABLE db_change_actions DELETE WHERE batchId = {batchId:String} SETTINGS mutations_sync = 1`,
      { batchId },
    );
    await this.clickhouse.exec(
      `ALTER TABLE db_change_batches DELETE WHERE batchId = {batchId:String} SETTINGS mutations_sync = 1`,
      { batchId },
    );
    return { batchId, deletedRows: Number(counted[0]?.c ?? 0) };
  }

  // ─── Хяналт (бичлэг бүрээр) ──────────────────────────────────────────────

  /** Хугацаа + системийн шүүлтүүрийн WHERE — зөвхөн параметртэй, тогтмол хэсгүүд */
  private rangeFilter(dto: DbChangesRangeDto) {
    const start = dto.startDate.slice(0, 10);
    const end = dto.endDate.slice(0, 10);
    const startMs = Date.parse(`${start}T00:00:00Z`);
    const endMs = Date.parse(`${end}T00:00:00Z`);
    if (startMs > endMs)
      throw new BadRequestException("Эхлэх огноо дуусах огнооноос хойш байна");
    if ((endMs - startMs) / 86_400_000 > MAX_RANGE_DAYS) {
      throw new BadRequestException(
        `Хугацааны хязгаар ${MAX_RANGE_DAYS} хоногоос хэтрэхгүй байх ёстой`,
      );
    }
    const where = [`toDate(a.actionTime) BETWEEN {start:Date} AND {end:Date}`];
    const params: Record<string, unknown> = { start, end };
    if (dto.systemType) {
      where.push(`a.systemType = {systemType:String}`);
      params.systemType = dto.systemType;
    }
    return { where, params, start, end, startMs, endMs };
  }

  async records(dto: DbChangesRecordsDto) {
    const { where, params } = this.rangeFilter(dto);
    // Хэрэглэгчийн сонголтын жагсаалт — зөвхөн хугацаа/системээр (бусад шүүлтүүрээс үл хамаарна)
    const baseWhere = where.join(" AND ");
    const baseParams = { ...params };
    if (dto.sqlCommand) {
      where.push(`a.sqlCommand = {sqlCommand:String}`);
      params.sqlCommand = dto.sqlCommand;
    }
    if (dto.username?.trim()) {
      where.push(`a.username = {username:String}`);
      params.username = dto.username.trim().toUpperCase();
    }
    const search = dto.search?.trim();
    if (search) {
      where.push(
        `(positionCaseInsensitiveUTF8(a.sqlText, {search:String}) > 0
          OR positionCaseInsensitiveUTF8(a.objectName, {search:String}) > 0
          OR positionCaseInsensitiveUTF8(a.jira, {search:String}) > 0)`,
      );
      params.search = search;
    }
    if (dto.flaggedOnly) where.push(`r.flagged = 1`);

    const rows = await this.clickhouse.query<DbChangeRecord>(
      `SELECT a.rowHash AS rowHash, a.actionTime AS actionTime, a.username AS username,
              a.machine AS machine, a.action AS action, a.owner AS owner,
              a.systemType AS systemType, a.sqlCommand AS sqlCommand,
              a.objectName AS objectName, a.domain AS domain, a.sqlText AS sqlText,
              a.sourceDescription AS sourceDescription, a.jira AS jira,
              r.flagged AS flagged, r.note AS note,
              r.updatedByName AS reviewedByName, r.updatedAt AS reviewedAt
       FROM db_change_actions AS a FINAL
       LEFT JOIN (SELECT * FROM db_change_reviews FINAL) AS r ON r.rowHash = a.rowHash
       WHERE ${where.join(" AND ")}
       ORDER BY a.actionTime DESC, a.rowHash
       LIMIT {limit:UInt32}`,
      { ...params, limit: MAX_LIST_ROWS + 1 },
    );

    const users = await this.clickhouse.query<{ username: string }>(
      `SELECT DISTINCT username FROM db_change_actions AS a FINAL
       WHERE ${baseWhere}
       ORDER BY username LIMIT 500`,
      baseParams,
    );

    return {
      items: rows.slice(0, MAX_LIST_ROWS).map((r) => ({
        ...r,
        flagged: Number(r.flagged) === 1,
        reviewedAt: r.reviewedByName ? r.reviewedAt : "",
      })),
      truncated: rows.length > MAX_LIST_ROWS,
      usernames: users.map((u) => u.username),
    };
  }

  /** Сэжигтэй гэж тэмдэглэх / тайлбар бичих — бүтэн мөрөөр дахин бичнэ */
  async review(rowHash: string, dto: ReviewDbChangeDto, user: User) {
    if (!/^[0-9a-f]{64}$/.test(rowHash))
      throw new BadRequestException("Бичлэгийн дугаар буруу байна");
    const found = await this.clickhouse.query<{ c: string }>(
      `SELECT count() AS c FROM db_change_actions WHERE rowHash = {rowHash:String}`,
      { rowHash },
    );
    if (Number(found[0]?.c ?? 0) === 0)
      throw new NotFoundException("Бичлэг олдсонгүй");

    const row = {
      rowHash,
      flagged: dto.flagged ? 1 : 0,
      note: dto.note.trim(),
      updatedBy: user.userId,
      updatedByName: user.name,
      updatedAt: nowCH(),
    };
    await this.clickhouse.insert("db_change_reviews", [row]);
    return {
      rowHash,
      flagged: dto.flagged,
      note: row.note,
      reviewedByName: row.updatedByName,
      reviewedAt: row.updatedAt,
    };
  }

  // ─── Дашбоард ────────────────────────────────────────────────────────────

  async dashboard(dto: DbChangesRangeDto) {
    const { where, params, startMs, endMs } = this.rangeFilter(dto);
    const w = where.join(" AND ");
    const from = `FROM db_change_actions AS a FINAL`;
    const flaggedSet = `a.rowHash IN (SELECT rowHash FROM db_change_reviews FINAL WHERE flagged = 1)`;

    const [
      stats,
      bySystem,
      byCommand,
      byAction,
      domainsBySystem,
      topUsers,
      daily,
      flagged,
    ] = await Promise.all([
      this.clickhouse.query<{
        total: string;
        users: string;
        objects: string;
        flagged: string;
        drops: string;
      }>(
        `SELECT count() AS total, uniqExact(a.username) AS users,
                  uniqExact(a.owner, a.objectName) AS objects,
                  countIf(${flaggedSet}) AS flagged,
                  countIf(a.sqlCommand = 'drop') AS drops
           ${from} WHERE ${w}`,
        params,
      ),
      this.clickhouse.query<Grouped>(
        `SELECT a.systemType AS name, count() AS count ${from} WHERE ${w}
           GROUP BY name ORDER BY count DESC`,
        params,
      ),
      this.clickhouse.query<Grouped>(
        `SELECT a.sqlCommand AS name, count() AS count ${from} WHERE ${w}
           GROUP BY name ORDER BY count DESC`,
        params,
      ),
      this.clickhouse.query<{
        systemType: string;
        action: string;
        count: string;
      }>(
        `SELECT a.systemType AS systemType, a.action AS action, count() AS count
           ${from} WHERE ${w}
           GROUP BY systemType, action ORDER BY systemType, count DESC`,
        params,
      ),
      // Эх тайлангийн "системийн төрөл тус бүрийн домэйны тоо"
      this.clickhouse.query<Grouped>(
        `SELECT a.systemType AS name, uniqExact(a.domain) AS count ${from} WHERE ${w}
           GROUP BY name ORDER BY count DESC`,
        params,
      ),
      this.clickhouse.query<Grouped>(
        `SELECT a.username AS name, count() AS count ${from} WHERE ${w}
           GROUP BY name ORDER BY count DESC LIMIT 10`,
        params,
      ),
      this.clickhouse.query<{ date: string; count: string }>(
        `SELECT toString(toDate(a.actionTime)) AS date, count() AS count ${from} WHERE ${w}
           GROUP BY date ORDER BY date`,
        params,
      ),
      this.clickhouse.query<DbChangeRecord>(
        `SELECT a.rowHash AS rowHash, a.actionTime AS actionTime, a.username AS username,
                  a.machine AS machine, a.action AS action, a.owner AS owner,
                  a.systemType AS systemType, a.sqlCommand AS sqlCommand,
                  a.objectName AS objectName, a.domain AS domain, a.sqlText AS sqlText,
                  a.sourceDescription AS sourceDescription, a.jira AS jira,
                  r.flagged AS flagged, r.note AS note,
                  r.updatedByName AS reviewedByName, r.updatedAt AS reviewedAt
           ${from}
           INNER JOIN (SELECT * FROM db_change_reviews FINAL WHERE flagged = 1) AS r
             ON r.rowHash = a.rowHash
           WHERE ${w}
           ORDER BY a.actionTime DESC
           LIMIT 200`,
        params,
      ),
    ]);

    // Бичлэггүй өдрийг 0-ээр бөглөнө (график тасрахгүй)
    const perDay = new Map(daily.map((d) => [d.date, Number(d.count)]));
    const dailyFilled: { date: string; count: number }[] = [];
    for (let t = startMs; t <= endMs; t += 86_400_000) {
      const date = new Date(t).toISOString().slice(0, 10);
      dailyFilled.push({ date, count: perDay.get(date) ?? 0 });
    }

    const s = stats[0];
    return {
      stats: {
        total: Number(s?.total ?? 0),
        users: Number(s?.users ?? 0),
        objects: Number(s?.objects ?? 0),
        flagged: Number(s?.flagged ?? 0),
        drops: Number(s?.drops ?? 0),
      },
      bySystem: toCounts(bySystem),
      byCommand: toCounts(byCommand),
      domainsBySystem: toCounts(domainsBySystem),
      topUsers: toCounts(topUsers),
      actionsBySystem: byAction.map((r) => ({
        systemType: r.systemType,
        action: r.action || "—",
        count: Number(r.count),
      })),
      daily: dailyFilled,
      flagged: flagged.map((r) => ({
        ...r,
        flagged: true,
      })),
    };
  }
}
