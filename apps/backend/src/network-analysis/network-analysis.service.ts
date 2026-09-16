import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { ClickHouseService, nowCH } from "../clickhouse/clickhouse.service";
import {
  ConfigChangeReviewDto,
  ConfigChangesQueryDto,
  ReviewStatus,
  XdrQueryDto,
  XdrStatusDto,
} from "./dto/network-analysis.dto";
import {
  analyzeConfigRisk,
  classifyXdr,
  normalizeXdrStatus,
  parseDetailXml,
  RiskLevel,
  XdrStatus,
} from "./network-risk";

/** Нэг хүсэлтээр уншигдах дээд мөр — хүнд scan-аас хамгаална */
const MAX_SCAN_ROWS = 20_000;
/** Жагсаалтад буцаах дээд мөр (статистик нь бүх уншсан мөрөөр тооцогдоно) */
const MAX_LIST_ROWS = 1_000;
const MAX_RANGE_DAYS = 366;
const DT = "%Y-%m-%d %H:%i:%S";

type User = { userId: string; name: string };

interface ConfigChangeRow {
  seqno: string;
  deviceName: string;
  receiveTime: string;
  cmd: string;
  result: string;
  path: string;
  detailXml: string;
  beforeValue: string;
  afterValue: string;
  adminUsername: string;
  adminSourceIp: string;
  adminClientType: string;
  reviewStatus: string;
  description: string;
  comment: string;
  reviewedByName: string;
  reviewedAt: string;
}

interface XdrRow {
  notificationId: string;
  detectedAt: string;
  rawText: string;
  device: string;
  userName: string;
  sourceStatus: string;
  alertId: string;
  detectionSource: string;
  investigationUrl: string;
  deviceCount: string | number;
  reviewStatus: string;
  note: string;
  assignedTo: string;
  reviewedByName: string;
  reviewedAt: string;
}

const countBy = <T>(items: T[], key: (item: T) => string) =>
  items.reduce<Record<string, number>>((acc, item) => {
    const k = key(item) || "—";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

/**
 * Сүлжээний шинжилгээ — Palo Alto тохиргооны өөрчлөлт ба Defender XDR мэдэгдэл.
 *
 * Өгөгдлийн эзэмшил (хоёр төрлийн хүснэгт):
 *  - `net_config_changes`, `net_xdr_notifications` — гадны ETL/RPA дүүргэнэ.
 *    Апп зөвхөн уншина; ETL мөрийг дахин ачаалахад аудиторын засвар алдагдахгүй.
 *  - `net_config_change_reviews`, `net_xdr_reviews` — аудиторын тайлбар/төлөв.
 *    Зөвхөн апп бичнэ.
 * Эрсдэлийг хадгалахгүй, уншихдаа `network-risk.ts`-ээр тооцно — дүрэм
 * өөрчлөгдвөл бүх түүх шууд шинэ дүрмээр харагдана (дахин үнэлэх ажил хэрэггүй).
 */
@Injectable()
export class NetworkAnalysisService implements OnModuleInit {
  private readonly logger = new Logger(NetworkAnalysisService.name);

  constructor(private readonly clickhouse: ClickHouseService) {}

  async onModuleInit() {
    await this.ensureTables();
  }

  private async ensureTables() {
    const ddl = [
      // ETL дүүргэнэ — seqno нь Palo Alto логийн давтагдашгүй дугаар
      `CREATE TABLE IF NOT EXISTS net_config_changes (
        seqno           UInt64,
        deviceName      String,
        receiveTime     DateTime,
        timeGenerated   DateTime,
        configVer       Nullable(Int32),
        cmd             LowCardinality(String),
        path            String,
        result          LowCardinality(String),
        detailXml       String,
        beforeValue     String DEFAULT '',
        afterValue      String DEFAULT '',
        adminUsername   String DEFAULT '',
        adminSourceIp   String DEFAULT '',
        adminClientType String DEFAULT '',
        dgHierLevel1    Nullable(Int32),
        dgHierLevel2    Nullable(Int32),
        dgHierLevel3    Nullable(Int32),
        dgHierLevel4    Nullable(Int32),
        loadedAt        DateTime DEFAULT now()
      ) ENGINE = ReplacingMergeTree(loadedAt)
        ORDER BY seqno`,
      // ETL дүүргэнэ — notificationId нь Defender-ийн support id (давтагдвал шинэчилнэ)
      `CREATE TABLE IF NOT EXISTS net_xdr_notifications (
        notificationId   String,
        detectedAt       DateTime,
        rawText          String,
        device           String DEFAULT '',
        userName         String DEFAULT '',
        sourceStatus     String DEFAULT '',
        alertId          String DEFAULT '',
        detectionSource  String DEFAULT '',
        investigationUrl String DEFAULT '',
        loadedAt         DateTime DEFAULT now()
      ) ENGINE = ReplacingMergeTree(loadedAt)
        ORDER BY notificationId`,
      `CREATE TABLE IF NOT EXISTS net_config_change_reviews (
        seqno         UInt64,
        reviewStatus  LowCardinality(String),
        description   String,
        comment       String,
        updatedBy     String,
        updatedByName String,
        updatedAt     DateTime
      ) ENGINE = ReplacingMergeTree(updatedAt)
        ORDER BY seqno`,
      `CREATE TABLE IF NOT EXISTS net_xdr_reviews (
        notificationId String,
        status         LowCardinality(String),
        note           String,
        assignedTo     String,
        updatedBy      String,
        updatedByName  String,
        updatedAt      DateTime
      ) ENGINE = ReplacingMergeTree(updatedAt)
        ORDER BY notificationId`,
    ];
    for (const sql of ddl) {
      try {
        await this.clickhouse.exec(sql);
      } catch (e) {
        this.logger.error(
          `Сүлжээний шинжилгээний хүснэгт үүсгэхэд алдаа: ${String(e)}`,
        );
      }
    }
  }

  /** Огнооны хязгаарыг шалгаад ClickHouse DateTime хэлбэрт хөрвүүлнэ. */
  private toRange(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start.getTime() > end.getTime()) {
      throw new BadRequestException("Эхлэх огноо дуусах огнооноос хойш байна");
    }
    if ((end.getTime() - start.getTime()) / 86_400_000 > MAX_RANGE_DAYS) {
      throw new BadRequestException(
        `Хугацааны хязгаар ${MAX_RANGE_DAYS} хоногоос хэтрэхгүй байх ёстой`,
      );
    }
    return {
      start: `${startDate.slice(0, 10)} 00:00:00`,
      end: `${endDate.slice(0, 10)} 23:59:59`,
    };
  }

  private static seqnoParam(seqno: string) {
    if (!/^\d{1,20}$/.test(seqno))
      throw new BadRequestException("Seqno буруу байна");
    return seqno;
  }

  // ─── Palo Alto тохиргооны өөрчлөлт ───────────────────────────────────────

  private toConfigItem(r: ConfigChangeRow) {
    const parsed =
      r.beforeValue || r.afterValue
        ? { before: r.beforeValue, after: r.afterValue }
        : parseDetailXml(r.detailXml);
    const risk = analyzeConfigRisk({
      path: r.path,
      cmd: r.cmd,
      detail: r.detailXml,
      beforeValue: parsed.before,
      afterValue: parsed.after,
    });
    return {
      seqno: String(r.seqno),
      deviceName: r.deviceName,
      receiveTime: r.receiveTime,
      cmd: r.cmd,
      result: r.result,
      path: r.path,
      adminUsername: r.adminUsername,
      adminSourceIp: r.adminSourceIp,
      adminClientType: r.adminClientType,
      riskLevel: risk.level,
      riskScore: risk.score,
      riskRule: risk.rule,
      // Хяналтын мөр байхгүй бол LEFT JOIN хоосон мөр буцаана → хүлээгдэж буй
      reviewStatus: (r.reviewStatus || "pending") as ReviewStatus,
      description: r.description ?? "",
      comment: r.comment ?? "",
      reviewedByName: r.reviewedByName || null,
      reviewedAt: r.reviewedByName ? r.reviewedAt : null,
      before: parsed.before,
      after: parsed.after,
    };
  }

  private configSelect(where: string) {
    return `
      SELECT
        toString(c.seqno) AS seqno,
        c.deviceName AS deviceName,
        formatDateTime(c.receiveTime, '${DT}') AS receiveTime,
        c.cmd AS cmd,
        c.result AS result,
        c.path AS path,
        c.detailXml AS detailXml,
        c.beforeValue AS beforeValue,
        c.afterValue AS afterValue,
        c.adminUsername AS adminUsername,
        c.adminSourceIp AS adminSourceIp,
        c.adminClientType AS adminClientType,
        r.reviewStatus AS reviewStatus,
        r.description AS description,
        r.comment AS comment,
        r.updatedByName AS reviewedByName,
        formatDateTime(r.updatedAt, '${DT}') AS reviewedAt
      FROM net_config_changes AS c FINAL
      LEFT JOIN (SELECT * FROM net_config_change_reviews FINAL) AS r
        ON r.seqno = c.seqno
      WHERE ${where}`;
  }

  async listConfigChanges(dto: ConfigChangesQueryDto) {
    const { start, end } = this.toRange(dto.startDate, dto.endDate);
    const search = (dto.search ?? "").trim();

    const rows = await this.clickhouse.query<ConfigChangeRow>(
      `${this.configSelect(`
        c.receiveTime BETWEEN {start:DateTime} AND {end:DateTime}
        AND ({search:String} = ''
          OR positionCaseInsensitiveUTF8(
               concat(c.deviceName, ' ', c.path, ' ', c.adminUsername, ' ', c.adminSourceIp),
               {search:String}) > 0)`)}
      ORDER BY c.receiveTime DESC
      LIMIT {limit:UInt32}`,
      { start, end, search, limit: MAX_SCAN_ROWS + 1 },
    );

    const truncated = rows.length > MAX_SCAN_ROWS;
    const all = rows.slice(0, MAX_SCAN_ROWS).map((r) => this.toConfigItem(r));

    const byAdmin = new Map<string, { changes: number; highRisk: number }>();
    for (const item of all) {
      if (!item.adminUsername) continue;
      const cur = byAdmin.get(item.adminUsername) ?? {
        changes: 0,
        highRisk: 0,
      };
      cur.changes += 1;
      if (item.riskLevel === "Critical" || item.riskLevel === "High")
        cur.highRisk += 1;
      byAdmin.set(item.adminUsername, cur);
    }

    const stats = {
      total: all.length,
      devices: new Set(all.map((i) => i.deviceName).filter(Boolean)).size,
      admins: byAdmin.size,
      highRisk: all.filter(
        (i) => i.riskLevel === "Critical" || i.riskLevel === "High",
      ).length,
      pendingReview: all.filter((i) => i.reviewStatus === "pending").length,
      byRisk: countBy(all, (i) => i.riskLevel),
      byCmd: countBy(all, (i) => i.cmd),
      byReview: countBy(all, (i) => i.reviewStatus),
      topAdmins: [...byAdmin.entries()]
        .map(([username, v]) => ({ username, ...v }))
        .sort((a, b) => b.highRisk - a.highRisk || b.changes - a.changes)
        .slice(0, 10),
    };

    const filtered = all.filter(
      (i) =>
        (!dto.riskLevel || i.riskLevel === dto.riskLevel) &&
        (!dto.reviewStatus || i.reviewStatus === dto.reviewStatus),
    );

    return {
      // Жагсаалтад өмнөх/дараах утгыг явуулахгүй — дэлгэрэнгүйд л татна
      items: filtered
        .slice(0, MAX_LIST_ROWS)
        .map(({ before: _b, after: _a, ...rest }) => rest),
      matched: filtered.length,
      stats,
      truncated,
    };
  }

  async getConfigChange(seqno: string) {
    const rows = await this.clickhouse.query<ConfigChangeRow>(
      `${this.configSelect("c.seqno = {seqno:UInt64}")} LIMIT 1`,
      { seqno: NetworkAnalysisService.seqnoParam(seqno) },
    );
    if (!rows[0]) throw new NotFoundException("Өөрчлөлт олдсонгүй");
    return this.toConfigItem(rows[0]);
  }

  async reviewConfigChange(
    seqno: string,
    dto: ConfigChangeReviewDto,
    user: User,
  ) {
    if (
      dto.reviewStatus === undefined &&
      dto.description === undefined &&
      dto.comment === undefined
    ) {
      throw new BadRequestException(
        "Төлөв, тайлбар, сэтгэгдлийн аль нэгийг дамжуулна уу",
      );
    }
    const param = NetworkAnalysisService.seqnoParam(seqno);
    const exists = await this.clickhouse.query<{ c: string }>(
      `SELECT count() AS c FROM net_config_changes WHERE seqno = {seqno:UInt64}`,
      { seqno: param },
    );
    if (!Number(exists[0]?.c))
      throw new NotFoundException("Өөрчлөлт олдсонгүй");

    const current = (
      await this.clickhouse.query<{
        reviewStatus: string;
        description: string;
        comment: string;
      }>(
        `SELECT reviewStatus, description, comment
         FROM net_config_change_reviews FINAL WHERE seqno = {seqno:UInt64} LIMIT 1`,
        { seqno: param },
      )
    )[0];

    // ReplacingMergeTree — мөрийг бүтнээр нь бичнэ (хэсэгчилсэн insert хориотой)
    const row = {
      seqno: param,
      reviewStatus: dto.reviewStatus ?? current?.reviewStatus ?? "pending",
      description: dto.description ?? current?.description ?? "",
      comment: dto.comment ?? current?.comment ?? "",
      updatedBy: user.userId,
      updatedByName: user.name,
      updatedAt: nowCH(),
    };
    await this.clickhouse.insert("net_config_change_reviews", [row]);
    return row;
  }

  // ─── Microsoft Defender XDR ──────────────────────────────────────────────

  private toXdrItem(r: XdrRow) {
    const classification = classifyXdr({
      text: r.rawText,
      sourceStatus: r.sourceStatus,
      deviceRepeated: Number(r.deviceCount) >= 2,
    });
    return {
      notificationId: r.notificationId,
      detectedAt: r.detectedAt,
      rawText: r.rawText,
      device: r.device,
      userName: r.userName,
      alertId: r.alertId,
      detectionSource: r.detectionSource,
      investigationUrl: r.investigationUrl,
      ...classification,
      // Аудитор төлөв өөрчлөөгүй бол мэдэгдэл дэх анхны төлөв
      status: (r.reviewStatus ||
        normalizeXdrStatus(r.sourceStatus)) as XdrStatus,
      note: r.note ?? "",
      assignedTo: r.assignedTo ?? "",
      reviewedByName: r.reviewedByName || null,
      reviewedAt: r.reviewedByName ? r.reviewedAt : null,
    };
  }

  async listXdr(dto: XdrQueryDto) {
    const { start, end } = this.toRange(dto.startDate, dto.endDate);

    const rows = await this.clickhouse.query<XdrRow>(
      `SELECT
         n.notificationId AS notificationId,
         formatDateTime(n.detectedAt, '${DT}') AS detectedAt,
         n.rawText AS rawText,
         n.device AS device,
         n.userName AS userName,
         n.sourceStatus AS sourceStatus,
         n.alertId AS alertId,
         n.detectionSource AS detectionSource,
         n.investigationUrl AS investigationUrl,
         d.deviceCount AS deviceCount,
         r.status AS reviewStatus,
         r.note AS note,
         r.assignedTo AS assignedTo,
         r.updatedByName AS reviewedByName,
         formatDateTime(r.updatedAt, '${DT}') AS reviewedAt
       FROM net_xdr_notifications AS n FINAL
       -- Төхөөрөмж давтагдсан эсэхийг бүх түүхээр тооцно (зөвхөн сонгосон хугацаагаар биш)
       LEFT JOIN (
         SELECT device, count() AS deviceCount
         FROM net_xdr_notifications FINAL
         WHERE device != ''
         GROUP BY device
       ) AS d ON d.device = n.device
       LEFT JOIN (SELECT * FROM net_xdr_reviews FINAL) AS r
         ON r.notificationId = n.notificationId
       WHERE n.detectedAt BETWEEN {start:DateTime} AND {end:DateTime}
       ORDER BY n.detectedAt DESC
       LIMIT {limit:UInt32}`,
      { start, end, limit: MAX_SCAN_ROWS + 1 },
    );

    const truncated = rows.length > MAX_SCAN_ROWS;
    const all = rows.slice(0, MAX_SCAN_ROWS).map((r) => this.toXdrItem(r));
    const open = (s: XdrStatus) =>
      s === "New" || s === "In Progress" || s === "Escalated";

    const stats = {
      total: all.length,
      highRisk: all.filter(
        (i) => i.riskLevel === "Critical" || i.riskLevel === "High",
      ).length,
      openReview: all.filter((i) => i.requiresReview && open(i.status)).length,
      privileged: all.filter((i) => i.privilegedAction).length,
      devices: new Set(all.map((i) => i.device).filter(Boolean)).size,
      byRisk: countBy(all, (i) => i.riskLevel),
      byStatus: countBy(all, (i) => i.status),
      byCategory: countBy(all, (i) => i.category),
    };

    const filtered = all.filter(
      (i) =>
        (!dto.riskLevel || i.riskLevel === (dto.riskLevel as RiskLevel)) &&
        (!dto.status || i.status === dto.status),
    );

    return {
      items: filtered.slice(0, MAX_LIST_ROWS),
      matched: filtered.length,
      stats,
      truncated,
    };
  }

  async updateXdrStatus(notificationId: string, dto: XdrStatusDto, user: User) {
    if (!notificationId || notificationId.length > 200) {
      throw new BadRequestException("Мэдэгдлийн дугаар буруу байна");
    }
    const exists = await this.clickhouse.query<{ c: string }>(
      `SELECT count() AS c FROM net_xdr_notifications WHERE notificationId = {id:String}`,
      { id: notificationId },
    );
    if (!Number(exists[0]?.c))
      throw new NotFoundException("Мэдэгдэл олдсонгүй");

    const current = (
      await this.clickhouse.query<{ note: string; assignedTo: string }>(
        `SELECT note, assignedTo FROM net_xdr_reviews FINAL
         WHERE notificationId = {id:String} LIMIT 1`,
        { id: notificationId },
      )
    )[0];

    const row = {
      notificationId,
      status: dto.status,
      note: dto.note ?? current?.note ?? "",
      assignedTo: dto.assignedTo ?? current?.assignedTo ?? "",
      updatedBy: user.userId,
      updatedByName: user.name,
      updatedAt: nowCH(),
    };
    await this.clickhouse.insert("net_xdr_reviews", [row]);
    return row;
  }
}
