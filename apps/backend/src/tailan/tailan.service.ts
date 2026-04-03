import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { ClickHouseService } from "../clickhouse/clickhouse.service";
import { SaveTailanDto } from "./dto/tailan.dto";
import {
  Document,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  ImageRun,
  AlignmentType,
  WidthType,
  BorderStyle,
  Packer,
  ShadingType,
  HeadingLevel,
  PageOrientation,
  SectionType,
} from "docx";
import { randomUUID } from "crypto";

interface UserPayload {
  id: string;
  name: string;
  position?: string;
  department?: string;
  departmentId?: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  allowedTools: string[];
}

/** Returns e.g. "ДАА", "ЕАХ", "ЗАГЧБХ", "МТАХ" from the dept name */
function deptAbbrev(deptName: string): string {
  const MAP: Record<string, string> = {
    "Дата анализын алба": "ДАА",
    "Дата Анализын Алба": "ДАА",
    "Ерөнхий аудитын хэлтэс": "ЕАХ",
    "Зайны аудит чанарын баталгаажуулалтын хэлтэс": "ЗАЧБХ",
    "Мэдээллийн технологийн аудитын хэлтэс": "МТАХ",
    Удирдлага: "ДАГ",
  };
  if (MAP[deptName]) return MAP[deptName];
  // fallback: first Mongolian Cyrillic letter of each word, upper-cased
  return (deptName || "")
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

/** Returns the genitive (possessive) form of a department name in Mongolian */
function deptGenitive(name: string): string {
  const MAP: Record<string, string> = {
    "Дата анализын алба": "ДАТА АНАЛИЗЫН АЛБАНЫ",
    "Дата Анализын Алба": "ДАТА АНАЛИЗЫН АЛБАНЫ",
    "Ерөнхий аудитын хэлтэс": "ЕРӨНХИЙ АУДИТЫН ХЭЛТСИЙН",
    "Зайны аудит чанарын баталгаажуулалтын хэлтэс":
      "ЗАЙНЫ АУДИТ ЧАНАРЫН БАТАЛГААЖУУЛАЛТЫН ХЭЛТСИЙН",
    "Мэдээллийн технологийн аудитын хэлтэс":
      "МЭДЭЭЛЛИЙН ТЕХНОЛОГИЙН АУДИТЫН ХЭЛТСИЙН",
    Удирдлага: "УДИРДЛАГЫН",
  };
  if (MAP[name]) return MAP[name];
  // Fallback: uppercase + ЫН
  return `${(name || "").toUpperCase()}ЫН`;
}

const ROMAN_NUMS = [
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
];

@Injectable()
export class TailanService {
  private readonly logger = new Logger(TailanService.name);

  constructor(private readonly clickhouse: ClickHouseService) {}

  isDeptHead(user: UserPayload): boolean {
    return (
      user.isAdmin ||
      user.isSuperAdmin ||
      user.allowedTools.includes("tailan_dept_head")
    );
  }

  // ─── Save / upsert draft ───────────────────────────────────────────────────
  async saveDraft(user: UserPayload, dto: SaveTailanDto) {
    const existing = await this.clickhouse.query<{ id: string }>(
      `SELECT id FROM tailan_reports
       WHERE userId = {userId:String} AND year = {year:UInt16} AND quarter = {quarter:UInt8}
       ORDER BY updatedAt DESC LIMIT 1`,
      { userId: user.id, year: dto.year, quarter: dto.quarter },
    );

    const id = existing.length > 0 ? existing[0].id : randomUUID();
    const now = new Date().toISOString().replace("T", " ").substring(0, 19);

    await this.clickhouse.insert("tailan_reports", [
      {
        id,
        userId: user.id,
        userName: user.name,
        departmentId: user.departmentId ?? "",
        year: dto.year,
        quarter: dto.quarter,
        status: dto.status ?? "draft",
        plannedTasksJson: JSON.stringify(dto.plannedTasks ?? []),
        dynamicSectionsJson: JSON.stringify(dto.dynamicSections ?? []),
        otherWork: dto.otherWork ?? "",
        teamActivitiesJson: JSON.stringify(dto.teamActivities ?? []),
        extraDataJson: JSON.stringify({
          section2Tasks: dto.section2Tasks ?? [],
          section1Dashboards: dto.section1Dashboards ?? [],
          section3AutoTasks: dto.section3AutoTasks ?? [],
          section3Dashboards: dto.section3Dashboards ?? [],
          section4Trainings: dto.section4Trainings ?? [],
          section4KnowledgeText: dto.section4KnowledgeText ?? "",
          section5Tasks: dto.section5Tasks ?? [],
          section6Activities: dto.section6Activities ?? [],
          section7Text: dto.section7Text ?? "",
          hiddenSections: dto.hiddenSections ?? [],
        }),
        submittedAt: dto.status === "submitted" ? now : "1970-01-01 00:00:00",
        updatedAt: now,
        createdAt:
          existing.length > 0 ? (existing[0]["createdAt"] ?? now) : now,
      },
    ]);

    return { id, message: "Амжилттай хадгаллаа" };
  }

  // ─── Get my report ─────────────────────────────────────────────────────────
  async getMyReport(userId: string, year: number, quarter: number) {
    const rows = await this.clickhouse.query(
      `SELECT * FROM tailan_reports FINAL
       WHERE userId = {userId:String} AND year = {year:UInt16} AND quarter = {quarter:UInt8}
       ORDER BY updatedAt DESC LIMIT 1`,
      { userId, year, quarter },
    );

    if (rows.length === 0) return null;
    return this.parseReport(rows[0]);
  }

  // ─── Department BSC (ТҮЗ) report save ─────────────────────────────────────
  async saveDeptBsc(
    user: UserPayload,
    year: number,
    quarter: number,
    sections: Record<string, unknown>,
  ) {
    const deptId = user.departmentId || user.id;
    const now = new Date().toISOString().replace("T", " ").substring(0, 19);
    await this.clickhouse.insert("dept_bsc_reports", [
      {
        departmentId: deptId,
        year,
        quarter,
        sectionsJson: JSON.stringify(sections),
        savedBy: user.id,
        savedByName: user.name,
        updatedAt: now,
      },
    ]);
    return { ok: true, message: "Амжилттай хадгаллаа" };
  }

  // ─── Department BSC (ТҮЗ) report load ─────────────────────────────────────
  async getDeptBsc(user: UserPayload, year: number, quarter: number) {
    const deptId = user.departmentId || user.id;
    const rows = await this.clickhouse.query<{
      sectionsJson: string;
      savedByName: string;
      updatedAt: string;
    }>(
      `SELECT sectionsJson, savedByName, updatedAt FROM dept_bsc_reports FINAL
       WHERE departmentId = {deptId:String} AND year = {year:UInt16} AND quarter = {quarter:UInt8}
       ORDER BY updatedAt DESC LIMIT 1`,
      { deptId, year, quarter },
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      sections: JSON.parse(row.sectionsJson || "{}"),
      savedByName: row.savedByName,
      updatedAt: row.updatedAt,
    };
  }

  // ─── Get all my reports ─────────────────────────────────────────────────────
  async getMyReports(userId: string) {
    const rows = await this.clickhouse.query(
      `SELECT id, year, quarter, status, updatedAt, submittedAt FROM tailan_reports FINAL
       WHERE userId = {userId:String}
       ORDER BY year DESC, quarter DESC`,
      { userId },
    );
    return rows;
  }

  // ─── Submit report ──────────────────────────────────────────────────────────
  async submitReport(userId: string, year: number, quarter: number) {
    const rows = await this.clickhouse.query(
      `SELECT * FROM tailan_reports FINAL
       WHERE userId = {userId:String} AND year = {year:UInt16} AND quarter = {quarter:UInt8}
       ORDER BY updatedAt DESC LIMIT 1`,
      { userId, year, quarter },
    );
    if (rows.length === 0) throw new NotFoundException("Тайлан олдсонгүй");

    const report = rows[0];
    const now = new Date().toISOString().replace("T", " ").substring(0, 19);

    await this.clickhouse.insert("tailan_reports", [
      { ...report, status: "submitted", submittedAt: now, updatedAt: now },
    ]);

    return { message: "Тайлан илгээгдлээ" };
  }

  // ─── Get dept submitted reports ─────────────────────────────────────────────
  async getDeptReports(user: UserPayload, year: number, quarter: number) {
    if (!this.isDeptHead(user)) throw new ForbiddenException("Эрх хүрэхгүй");

    const rows = await this.clickhouse.query(
      `SELECT * FROM tailan_reports FINAL
       WHERE departmentId = {deptId:String}
         AND year = {year:UInt16}
         AND quarter = {quarter:UInt8}
         AND status = 'submitted'
       ORDER BY userName ASC`,
      { deptId: user.departmentId ?? "", year, quarter },
    );

    return rows.map((r) => this.parseReport(r));
  }

  // ─── Get all dept reports for dept head's own ─────────────────────────────
  async getAllDeptReports(user: UserPayload, year: number, quarter: number) {
    if (!this.isDeptHead(user)) throw new ForbiddenException("Эрх хүрэхгүй");

    const rows = await this.clickhouse.query(
      `SELECT id, userId, userName, status, updatedAt, submittedAt
       FROM tailan_reports FINAL
       WHERE departmentId = {deptId:String}
         AND year = {year:UInt16}
         AND quarter = {quarter:UInt8}
       ORDER BY userName ASC`,
      { deptId: user.departmentId ?? "", year, quarter },
    );

    return rows;
  }

  // ─── Dept head: get one member's full report ──────────────────────────────
  async getDeptMemberReport(
    user: UserPayload,
    targetUserId: string,
    year: number,
    quarter: number,
  ) {
    if (!this.isDeptHead(user)) throw new ForbiddenException("Эрх хүрэхгүй");

    const rows = await this.clickhouse.query(
      `SELECT * FROM tailan_reports FINAL
       WHERE userId = {userId:String}
         AND year = {year:UInt16}
         AND quarter = {quarter:UInt8}
         AND departmentId = {deptId:String}
       ORDER BY updatedAt DESC
       LIMIT 1`,
      {
        userId: targetUserId,
        year,
        quarter,
        deptId: user.departmentId ?? "",
      },
    );

    if (rows.length === 0) return null;
    return this.parseReport(rows[0]);
  }

  // ─── Parse stored report ────────────────────────────────────────────────────
  private parseReport(row: any) {
    const extra = this.safeJson(row.extraDataJson, {});
    return {
      ...row,
      plannedTasks: this.safeJson(row.plannedTasksJson, []),
      dynamicSections: this.safeJson(row.dynamicSectionsJson, []),
      teamActivities: this.safeJson(row.teamActivitiesJson, []),
      section2Tasks: extra.section2Tasks ?? [],
      section1Dashboards: extra.section1Dashboards ?? [],
      section3AutoTasks: extra.section3AutoTasks ?? [],
      section3Dashboards: extra.section3Dashboards ?? [],
      section4Trainings: extra.section4Trainings ?? [],
      section4KnowledgeText: extra.section4KnowledgeText ?? "",
      section5Tasks: extra.section5Tasks ?? [],
      section6Activities: extra.section6Activities ?? [],
      section7Text: extra.section7Text ?? "",
      hiddenSections: extra.hiddenSections ?? [],
    };
  }

  private safeJson(str: string, fallback: any) {
    try {
      return JSON.parse(str);
    } catch {
      return fallback;
    }
  }

  // ─── Images table bootstrap (call once on module init) ─────────────────────
  async ensureImagesTable() {
    await this.clickhouse.exec(`
      CREATE TABLE IF NOT EXISTS tailan_images (
        id String,
        userId String,
        departmentId String DEFAULT '',
        year UInt16,
        quarter UInt8,
        filename String,
        mimeType String,
        imageData String DEFAULT '',
        uploadedAt DateTime DEFAULT now()
      ) ENGINE = MergeTree() ORDER BY (userId, year, quarter, id)
    `);
    // migrate: add imageData column if table was created with old dataBase64 schema
    try {
      await this.clickhouse.exec(
        `ALTER TABLE tailan_images ADD COLUMN IF NOT EXISTS imageData String DEFAULT ''`,
      );
    } catch {}
  }

  // ─── Save image ────────────────────────────────────────────────────────────
  async saveImage(
    userId: string,
    departmentId: string,
    year: number,
    quarter: number,
    filename: string,
    mimeType: string,
    buffer: Buffer,
  ) {
    await this.ensureImagesTable();
    const id = randomUUID();
    const now = new Date().toISOString().replace("T", " ").substring(0, 19);
    const imageData = buffer.toString("hex");
    await this.clickhouse.insert("tailan_images", [
      {
        id,
        userId,
        departmentId,
        year,
        quarter,
        filename,
        mimeType,
        imageData,
        uploadedAt: now,
      },
    ]);
    return { id, filename, mimeType };
  }

  // ─── Get image list (metadata only) ───────────────────────────────────────
  async getImages(userId: string, year: number, quarter: number) {
    await this.ensureImagesTable();
    return this.clickhouse.query<any>(
      `SELECT id, filename, mimeType, uploadedAt FROM tailan_images
       WHERE userId = {userId:String} AND year = {year:UInt16} AND quarter = {quarter:UInt8}
       ORDER BY uploadedAt ASC`,
      { userId, year, quarter },
    );
  }

  // ─── Get dept image list ───────────────────────────────────────────────────
  async getDeptImages(departmentId: string, year: number, quarter: number) {
    await this.ensureImagesTable();
    return this.clickhouse.query<any>(
      `SELECT id, userId, filename, mimeType, uploadedAt FROM tailan_images
       WHERE departmentId = {departmentId:String} AND year = {year:UInt16} AND quarter = {quarter:UInt8}
       ORDER BY uploadedAt ASC`,
      { departmentId, year, quarter },
    );
  }

  // ─── Get image raw data ────────────────────────────────────────────────────
  async getImageData(id: string, userId: string) {
    await this.ensureImagesTable();
    const rows = await this.clickhouse.query<any>(
      `SELECT mimeType, imageData FROM tailan_images WHERE id = {id:String} LIMIT 1`,
      { id },
    );
    if (!rows.length) throw new NotFoundException("Зураг олдсонгүй");
    return {
      mimeType: rows[0].mimeType,
      buffer: Buffer.from(rows[0].imageData, "hex"),
    };
  }

  // ─── Delete image ──────────────────────────────────────────────────────────
  async deleteImage(id: string, userId: string) {
    await this.ensureImagesTable();
    await this.clickhouse.exec(
      `ALTER TABLE tailan_images DELETE WHERE id = {id:String} AND userId = {userId:String}`,
      { id, userId },
    );
    return { message: "Устгагдлаа" };
  }

  // ─── Generate Word for personal report ─────────────────────────────────────
  async generateWord(
    userId: string,
    year: number,
    quarter: number,
    displayName?: string,
  ): Promise<Buffer> {
    const rows = await this.clickhouse.query(
      `SELECT * FROM tailan_reports FINAL
       WHERE userId = {userId:String} AND year = {year:UInt16} AND quarter = {quarter:UInt8}
       ORDER BY updatedAt DESC LIMIT 1`,
      { userId, year, quarter },
    );

    if (rows.length === 0) throw new NotFoundException("Тайлан олдсонгүй");
    const report = this.parseReport(rows[0]);
    if (displayName) report.userName = displayName;

    // Fetch user position + department name for the title
    try {
      const userRows = await this.clickhouse.query<any>(
        `SELECT u.position, d.name as departmentName
         FROM users u LEFT JOIN departments d ON u.departmentId = d.id
         WHERE u.id = {uid:String} LIMIT 1`,
        { uid: userId },
      );
      if (userRows.length > 0) {
        report.position = userRows[0].position ?? "";
        report.departmentName = userRows[0].departmentName ?? "";
      }
    } catch {}

    return this.buildDocx(report, year, quarter);
  }

  // ─── Generate Word for dept merged report ──────────────────────────────────
  async generateDeptWord(
    user: UserPayload,
    year: number,
    quarter: number,
  ): Promise<Buffer> {
    if (!this.isDeptHead(user)) throw new ForbiddenException("Эрх хүрэхгүй");
    const reports = await this.getDeptReports(user, year, quarter);
    const data = this.reportsToMergedData(reports, year, quarter);
    return this.buildDeptDocxFromData({
      ...data,
      departmentName: user.department ?? "",
    });
  }

  // ─── Generate Word from editor-submitted merged data ───────────────────────
  async generateDeptWordFromData(body: any): Promise<Buffer> {
    return this.buildDeptDocxFromData(body);
  }

  /** Convert raw report array → editor-state shape */
  private reportsToMergedData(reports: any[], year: number, quarter: number) {
    // Tasks – flat list with memberName
    const tasks = reports.flatMap((r) =>
      (r.plannedTasks ?? []).map((t: any, i: number) => ({
        memberName: r.userName,
        order: i + 1,
        title: t.title ?? "",
        completion: t.completion ?? 0,
        startDate: t.startDate ?? "",
        endDate: t.endDate ?? "",
        description: t.description ?? "",
        images: t.images ?? [],
      })),
    );

    // Sections – group by title, entries per person
    const secMap = new Map<
      string,
      { title: string; entries: { memberName: string; content: string }[] }
    >();
    for (const r of reports) {
      for (const sec of r.dynamicSections ?? []) {
        if (!secMap.has(sec.title))
          secMap.set(sec.title, { title: sec.title, entries: [] });
        secMap
          .get(sec.title)!
          .entries.push({ memberName: r.userName, content: sec.content ?? "" });
      }
    }
    const sections = Array.from(secMap.values());

    // Other work – per person
    const otherEntries = reports
      .filter((r) => r.otherWork?.trim())
      .map((r) => ({ memberName: r.userName, content: r.otherWork }));

    // Activities – flat list with memberName
    const activities = reports.flatMap((r) =>
      (r.teamActivities ?? []).map((a: any) => ({
        memberName: r.userName,
        name: a.name ?? "",
        date: a.date ?? "",
      })),
    );

    return { year, quarter, tasks, sections, otherEntries, activities };
  }

  // ─── Build .docx buffer ─────────────────────────────────────────────────────
  private async buildDocx(
    report: any,
    year: number,
    quarter: number,
  ): Promise<Buffer> {
    const qName = ROMAN_NUMS[(quarter - 1) % 4] ?? "I";

    // ── Title construction ──────────────────────────────────────────────────
    // Format: ДАА-НЫ ДАТА АНАЛИСТ Б.БАТМЯГМАР 2025 ОНЫ IV-Р УЛИРЛЫН АЖЛЫН ТАЙЛАН
    const deptCode = deptAbbrev(report.departmentName ?? "");
    const positionUpper = (report.position ?? "").toUpperCase();
    const nameUpper = (report.userName ?? "").toUpperCase();
    const titleText = `${deptCode ? `${deptCode}-НЫ ` : ""}${positionUpper}${positionUpper && nameUpper ? " " : ""}${nameUpper} ${year} ОНЫ ${qName}-Р УЛИРЛЫН АЖЛЫН ТАЙЛАН`;

    const children: any[] = [];

    // ── Hidden sections + dynamic Roman numbering ───────────────────────────
    const hidden = new Set<string>(report.hiddenSections ?? []);
    const FIXED_KEYS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7"] as const;
    const secRoman: Record<string, string> = {};
    let _romIdx = 0;
    for (const key of FIXED_KEYS) {
      if (!hidden.has(key)) {
        secRoman[key] = ROMAN_NUMS[_romIdx++];
      }
    }
    const dynRomStart = _romIdx;
    let tblCounter = 1;

    // ── Cover title ─────────────────────────────────────────────────────────
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 320 },
        children: [
          new TextRun({
            text: titleText,
            bold: true,
            size: 22,
            font: "Times New Roman",
            allCaps: true,
          }),
        ],
      }),
    );

    const imgCounter = { n: 1 };

    const fmtPeriodDoc = (period: string): string => {
      const [s, e] = (period ?? "").split(" \u2013 ");
      const fmt = (d?: string) => (d ? d.replace(/-/g, ".") : "");
      if (!s && !e) return "";
      if (!e) return fmt(s);
      return `${fmt(s)}-${fmt(e)}`;
    };

    // ── Fixed section I: Data analysis support ───────────────────────────────
    if (!hidden.has("s1")) {
      children.push(
        this.bigSectionHeading(
          `${secRoman.s1}. Дата анализын үр дүнгээр аудитын үйл ажиллагааг дэмжсэн байдал`,
        ),
      );

      // I.1 – numbered planned tasks (bold title)
      const analysisItems = (report.plannedTasks ?? []).filter((t: any) =>
        t.title?.trim(),
      );
      if (analysisItems.length === 0) {
        children.push(this.bodyPara(" "));
      } else {
        analysisItems.forEach((t: any, idx: number) => {
          children.push(
            new Paragraph({
              alignment: AlignmentType.JUSTIFIED,
              spacing: { before: 80, after: 60, line: 276 },
              indent: { left: 360, hanging: 360 },
              children: [
                new TextRun({
                  text: `${idx + 1}. ${t.title ?? ""}`,
                  bold: true,
                  size: 22,
                  font: "Times New Roman",
                }),
              ],
            }),
          );
          if (t.description?.trim()) {
            children.push(this.bodyPara(t.description));
          }
          for (const img of t.images ?? []) {
            children.push(
              ...this.inlineImageParas(
                img.dataUrl,
                img.width ?? 80,
                imgCounter,
                img.height,
              ),
            );
          }
        });
      }
      children.push(new Paragraph({ text: "", spacing: { after: 120 } }));

      // I.2 – Dashboard table from section1Dashboards
      if (!hidden.has("s12")) {
        children.push(
          this.subSectionHeading(
            "Шинээр хөгжүүлсэн Дашбоард хөгжүүлэлтийн чанар, үр дүн:",
          ),
        );

        const dashColWidths = [5, 30, 15, 20, 30];
        const dashHeaders = [
          "№",
          "Төлөвлөгөөт ажил",
          "Ажлын гүйцэтгэл",
          "Хийгдсэн хугацаа",
          "Гүйцэтгэл /товч/",
        ];
        const dashHeaderRow = new TableRow({
          tableHeader: true,
          children: dashHeaders.map(
            (lbl, i) =>
              new TableCell({
                width: { size: dashColWidths[i], type: WidthType.PERCENTAGE },
                borders: this.border("888888"),
                shading: { type: ShadingType.SOLID, color: "FFFFFF" },
                margins: { top: 40, bottom: 40, left: 80, right: 80 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: lbl,
                        bold: true,
                        color: "000000",
                        size: 22,
                        font: "Times New Roman",
                      }),
                    ],
                  }),
                ],
              }),
          ),
        });

        const s1Dashboards: any[] = report.section1Dashboards ?? [];
        const dashDataRows =
          s1Dashboards.length > 0
            ? s1Dashboards.map(
                (t: any, idx: number) =>
                  new TableRow({
                    children: [
                      this.tc(`${idx + 1}`, dashColWidths[0], true),
                      this.tc(t.title ?? "", dashColWidths[1]),
                      this.tc(
                        t.completion !== undefined && t.completion !== ""
                          ? `${t.completion}%`
                          : "",
                        dashColWidths[2],
                        true,
                      ),
                      this.tc(
                        fmtPeriodDoc(t.period ?? ""),
                        dashColWidths[3],
                        true,
                      ),
                      this.tc(t.summary ?? "", dashColWidths[4]),
                    ],
                  }),
              )
            : [
                new TableRow({
                  children: dashColWidths.map((w) => this.tc(" ", w, true)),
                }),
              ];

        // Дундаж гүйцэтгэл row
        const dashNums = s1Dashboards
          .map((t: any) => parseFloat(t.completion))
          .filter((n: number) => !isNaN(n));
        const dashAvg =
          dashNums.length > 0
            ? Math.round(
                dashNums.reduce((a: number, b: number) => a + b, 0) /
                  dashNums.length,
              )
            : null;
        const avgRow = new TableRow({
          children: [
            new TableCell({
              columnSpan: 2,
              width: { size: 35, type: WidthType.PERCENTAGE },
              borders: this.border("888888"),
              margins: { top: 40, bottom: 40, left: 80, right: 80 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: "Дундаж гүйцэтгэл",
                      bold: true,
                      size: 22,
                      font: "Times New Roman",
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 15, type: WidthType.PERCENTAGE },
              borders: this.border("888888"),
              margins: { top: 40, bottom: 40, left: 80, right: 80 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: dashAvg !== null ? `${dashAvg}%` : "",
                      bold: true,
                      size: 22,
                      font: "Times New Roman",
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              borders: this.border("888888"),
              margins: { top: 40, bottom: 40, left: 80, right: 80 },
              children: [new Paragraph({ text: " " })],
            }),
            new TableCell({
              width: { size: 30, type: WidthType.PERCENTAGE },
              borders: this.border("888888"),
              margins: { top: 40, bottom: 40, left: 80, right: 80 },
              children: [new Paragraph({ text: " " })],
            }),
          ],
        });

        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [dashHeaderRow, ...dashDataRows, avgRow],
          }),
        );
        // Images from section1Dashboards rows
        for (const t of s1Dashboards) {
          for (const img of t.images ?? []) {
            children.push(
              ...this.inlineImageParas(
                img.dataUrl,
                img.width ?? 80,
                imgCounter,
                img.height,
              ),
            );
          }
        }
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 40, after: 160 },
            children: [
              new TextRun({
                text: `Хүснэгт ${tblCounter++}.`,
                italics: true,
                size: 18,
                font: "Times New Roman",
              }),
            ],
          }),
        );
      } // end s12
    } // end s1

    // ── Fixed Section II: Өгөгдөл боловсруулах ажил ─────────────────────────
    if (!hidden.has("s2")) {
      children.push(
        this.bigSectionHeading(
          `${secRoman.s2}. Аудитын үйл ажиллагаанд шаардлагатай өгөгдөл боловсруулалтын ажил`,
        ),
      );
      const s2Tasks: any[] = report.section2Tasks ?? [];
      const s2Headers = [
        "№",
        "Төлөвлөгөөт ажлууд\n(Дууссан ажлууд)",
        "Ажлын гүйцэтгэл",
        "Хийгдсэн хугацаа",
        "Гүйцэтгэл /товч/",
      ];
      const s2Widths = [5, 30, 20, 20, 25];
      const s2Rows: string[][] = s2Tasks.map((t, i) => [
        `${i + 1}`,
        t.title ?? "",
        t.result !== undefined && t.result !== "" ? `${t.result}%` : "",
        fmtPeriodDoc(t.period ?? ""),
        t.completion ?? "",
      ]);
      children.push(
        this.buildDashedTable(s2Headers, s2Widths, s2Rows, [], [0, 2, 3]),
      );
      // Images from section2Tasks rows
      for (const t of s2Tasks) {
        for (const img of t.images ?? []) {
          children.push(
            ...this.inlineImageParas(
              img.dataUrl,
              img.width ?? 80,
              imgCounter,
              img.height,
            ),
          );
        }
      }
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 40, after: 160 },
          children: [
            new TextRun({
              text: `Хүснэгт ${tblCounter++}.`,
              italics: true,
              size: 18,
              font: "Times New Roman",
            }),
          ],
        }),
      );
    } // end s2

    // ── Fixed Section III: Тогтмол хийгддэг ажлууд ──────────────────────────
    if (!hidden.has("s3")) {
      children.push(
        this.bigSectionHeading(`${secRoman.s3}. Тогтмол хийгддэг ажлууд`),
      );

      // III.1 – Автоматжуулалт
      children.push(
        this.subSectionHeading(
          "Өгөгдөл боловсруулалт автоматжуулалтыг цаг хугацаанд нь гүйцэтгэсэн байдал:",
        ),
      );
      const s3AutoTasks: any[] = report.section3AutoTasks ?? [];
      const s3aHeaders = [
        "№",
        "Тогтмол хийгддэг өгөгдөл боловсруулалт",
        "Өгөгдөл боловсруулалтын ажлын ач холбогдол,хэрэглээ",
        "Хэрэглэгчийн нэгжийн өгсөн үнэлгээ",
      ];
      const s3aWidths = [5, 40, 35, 20];
      const s3aRows: string[][] = s3AutoTasks.map((t, i) => [
        `${i + 1}`,
        t.title ?? "",
        t.value ?? "",
        t.rating ?? "",
      ]);
      const s3aAvgNums = s3AutoTasks
        .map((t: any) => parseFloat(t.rating))
        .filter((n: number) => !isNaN(n));
      const s3aAvg =
        s3aAvgNums.length > 0
          ? Math.round(
              s3aAvgNums.reduce((a: number, b: number) => a + b, 0) /
                s3aAvgNums.length,
            )
          : null;
      const s3aAvgRow = new TableRow({
        children: [
          new TableCell({
            columnSpan: 3,
            width: { size: 80, type: WidthType.PERCENTAGE },
            margins: { top: 40, bottom: 40, left: 80, right: 80 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "Дундаж үнэлгээ",
                    bold: true,
                    size: 22,
                    font: "Times New Roman",
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            margins: { top: 40, bottom: 40, left: 80, right: 80 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: s3aAvg !== null ? `${s3aAvg}%` : "",
                    bold: true,
                    size: 22,
                    font: "Times New Roman",
                  }),
                ],
              }),
            ],
          }),
        ],
      });
      children.push(
        this.buildDashedTable(
          s3aHeaders,
          s3aWidths,
          s3aRows,
          [s3aAvgRow],
          [0, 3],
        ),
      );
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 40, after: 100 },
          children: [
            new TextRun({
              text: `Хүснэгт ${tblCounter++}.`,
              italics: true,
              size: 18,
              font: "Times New Roman",
            }),
          ],
        }),
      );

      // III.2 – Dashboard
      if (!hidden.has("s32")) {
        children.push(
          this.subSectionHeading(
            "Дашбоардын хэвийн ажиллагааг хангаж ажилласан байдал:",
          ),
        );
        const s3Dashboards: any[] = report.section3Dashboards ?? [];
        const s3dHeaders = [
          "№",
          "Дашбоард",
          "Дашбоардын ач холбогдол,хэрэглээ",
          "Хэрэглэгч нэгжийн өгсөн үнэлгээ",
        ];
        const s3dWidths = [5, 35, 40, 20];
        const s3dRows: string[][] = s3Dashboards.map((t, i) => [
          `${i + 1}`,
          t.dashboard ?? "",
          t.value ?? "",
          t.rating ?? "",
        ]);
        const s3dAvgNums = s3Dashboards
          .map((t: any) => parseFloat(t.rating))
          .filter((n: number) => !isNaN(n));
        const s3dAvg =
          s3dAvgNums.length > 0
            ? Math.round(
                s3dAvgNums.reduce((a: number, b: number) => a + b, 0) /
                  s3dAvgNums.length,
              )
            : null;
        const s3dAvgRow = new TableRow({
          children: [
            new TableCell({
              columnSpan: 3,
              width: { size: 80, type: WidthType.PERCENTAGE },
              margins: { top: 40, bottom: 40, left: 80, right: 80 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: "Дундаж үнэлгээ",
                      bold: true,
                      size: 22,
                      font: "Times New Roman",
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              margins: { top: 40, bottom: 40, left: 80, right: 80 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: s3dAvg !== null ? `${s3dAvg}%` : "",
                      bold: true,
                      size: 22,
                      font: "Times New Roman",
                    }),
                  ],
                }),
              ],
            }),
          ],
        });
        children.push(
          this.buildDashedTable(
            s3dHeaders,
            s3dWidths,
            s3dRows,
            [s3dAvgRow],
            [0, 3],
          ),
        );
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 40, after: 160 },
            children: [
              new TextRun({
                text: `Хүснэгт ${tblCounter++}.`,
                italics: true,
                size: 18,
                font: "Times New Roman",
              }),
            ],
          }),
        );
      } // end s32
    } // end s3

    // ── Fixed Section IV: Хамрагдсан сургалт (landscape section) ────────────
    const s4Children: any[] = [];
    if (!hidden.has("s4")) {
      s4Children.push(
        this.bigSectionHeading(`${secRoman.s4}. Хамрагдсан сургалт`),
      );
      const s4Trainings: any[] = report.section4Trainings ?? [];
      const s4Headers = [
        "№",
        "Хамрагдсан сургалт",
        "Зохион байгуулагч",
        "Сургалтын төрөл",
        "Хэзээ",
        "Сургалтын хэлбэр",
        "Цаг",
        "Аудитын зорилгод нийцсэн эсэх",
        "Мэдлэгээ хуваалцсан эсэх",
      ];
      const s4Widths = [5, 22, 13, 11, 9, 9, 6, 13, 12];
      const s4Rows: string[][] = s4Trainings.map((t, i) => [
        `${i + 1}`,
        t.training ?? "",
        t.organizer ?? "",
        t.type ?? "",
        t.date ? t.date.replace(/-/g, ".") : "",
        t.format ?? "",
        t.hours ? `${t.hours} цаг` : "",
        t.meetsAuditGoal ?? "",
        t.sharedKnowledge ?? "",
      ]);
      s4Children.push(
        this.buildDashedTable(
          s4Headers,
          s4Widths,
          s4Rows,
          [],
          [0, 4, 5, 6, 7, 8],
        ),
      );
      s4Children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 40, after: 100 },
          children: [
            new TextRun({
              text: `Хүснэгт ${tblCounter++}.`,
              italics: true,
              size: 18,
              font: "Times New Roman",
            }),
          ],
        }),
      );

      // IV sub-section: Мэдлэгээ ашиглаж буй байдал
      s4Children.push(
        this.subSectionHeading(
          "Сургалтаас олж авсан мэдлэгээ ашиглаж буй байдал:",
        ),
      );
      const knowledgeLines = (report.section4KnowledgeText ?? "").split("\n");
      for (const line of knowledgeLines) {
        s4Children.push(this.bodyPara(line || " "));
      }
      s4Children.push(new Paragraph({ text: "", spacing: { after: 200 } }));
    } // end s4

    // ── Sections V onwards (portrait) ─────────────────────────────────────────
    const postChildren: any[] = [];

    // ── Fixed Section V: Үүрэг даалгаварын биелэлт ───────────────────────────
    if (!hidden.has("s5")) {
      postChildren.push(
        this.bigSectionHeading(`${secRoman.s5}. Үүрэг даалгаварын биелэлт`),
      );
      const s5Tasks: any[] = report.section5Tasks ?? [];
      const s5Headers = ["№", "Ажлын төрөл", "Хийгдсэн ажил"];
      const s5Widths = [5, 35, 60];
      const s5Rows: string[][] = s5Tasks.map((t, i) => [
        `${i + 1}`,
        t.taskType ?? "",
        t.completedWork ?? "",
      ]);
      postChildren.push(
        this.buildDashedTable(s5Headers, s5Widths, s5Rows, [], [0]),
      );
      postChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 40, after: 160 },
          children: [
            new TextRun({
              text: `Хүснэгт ${tblCounter++}.`,
              italics: true,
              size: 18,
              font: "Times New Roman",
            }),
          ],
        }),
      );
    } // end s5

    // ── Fixed Section VI: Хамт олны ажил ──────────────────────────────────────
    if (!hidden.has("s6")) {
      postChildren.push(
        this.bigSectionHeading(`${secRoman.s6}. Хамт олны ажил`),
      );
      const s6Activities: any[] = report.section6Activities ?? [];
      const s6Headers = ["№", "Огноо", "Хамт олны ажил", "Санаачилга"];
      const s6Widths = [5, 20, 50, 25];
      const s6Rows: string[][] = s6Activities.map((t, i) => [
        `${i + 1}`,
        t.date ? t.date.replace(/-/g, ".") : "",
        t.activity ?? "",
        t.initiative ?? "",
      ]);
      postChildren.push(
        this.buildDashedTable(s6Headers, s6Widths, s6Rows, [], [0, 1]),
      );
      postChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 40, after: 160 },
          children: [
            new TextRun({
              text: `Хүснэгт ${tblCounter++}.`,
              italics: true,
              size: 18,
              font: "Times New Roman",
            }),
          ],
        }),
      );
    }

    // ── Fixed Section VII: Шинэ санал санаачилга ──────────────────────────────
    if (!hidden.has("s7")) {
      postChildren.push(
        this.bigSectionHeading(`${secRoman.s7}. Шинэ санал санаачилга`),
      );
      const s7Lines = (report.section7Text ?? "").split("\n");
      for (const line of s7Lines) {
        postChildren.push(this.bodyPara(line || " "));
      }
      postChildren.push(new Paragraph({ text: "", spacing: { after: 200 } }));
    }

    // ── Dynamic big sections (VIII, IX, …) ───────────────────────────────────
    const dynamicSecs: any[] = report.dynamicSections ?? [];
    let _dynVisibleIdx = 0;
    dynamicSecs.forEach((sec: any, idx: number) => {
      if (hidden.has(`dyn_${idx}`)) return;
      const romIdx = dynRomStart + _dynVisibleIdx;
      _dynVisibleIdx++;
      const romNum = ROMAN_NUMS[romIdx] ?? `${romIdx + 1}`;
      const secTitle = sec.title ?? "";
      postChildren.push(this.bigSectionHeading(`${romNum}. ${secTitle}`));
      const lines = (sec.content ?? "").split("\n");
      for (const line of lines) {
        postChildren.push(this.bodyPara(line || " "));
      }
      postChildren.push(new Paragraph({ text: "", spacing: { after: 120 } }));
    });

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: "Times New Roman", size: 22 },
            paragraph: { spacing: { line: 276 } },
          },
        },
      },
      sections: [
        {
          // Portrait: sections I – III
          properties: {
            page: {
              margin: { top: 902, bottom: 1259, left: 1440, right: 1077 },
            },
          },
          children,
        },
        {
          // Landscape: section IV (9-column training table)
          properties: {
            type: SectionType.NEXT_PAGE,
            page: {
              size: {
                width: 16838,
                height: 11906,
                orientation: PageOrientation.LANDSCAPE,
              },
              margin: { top: 902, bottom: 902, left: 1077, right: 1077 },
            },
          },
          children: s4Children,
        },
        {
          // Portrait: sections V onwards
          properties: {
            type: SectionType.NEXT_PAGE,
            page: {
              size: {
                width: 11906,
                height: 16838,
                orientation: PageOrientation.PORTRAIT,
              },
              margin: { top: 902, bottom: 1259, left: 1440, right: 1077 },
            },
          },
          children: postChildren,
        },
      ],
    });

    return Buffer.from(await Packer.toBuffer(doc));
  }

  // ─── Build dept .docx from structured merged data ──────────────────────────
  private async buildDeptDocxFromData(data: {
    year: number;
    quarter: number;
    tasks: any[];
    sections: any[];
    otherEntries: any[];
    activities: any[];
    departmentName?: string;
    rawSections?: Record<string, unknown>;
  }): Promise<Buffer> {
    const quarterNames = ["I", "II", "III", "IV"];
    const qName = quarterNames[(data.quarter - 1) % 4];
    const children: any[] = [];

    // ── Title ───────────────────────────────────────────────────────────────
    const deptPrefix = data.departmentName
      ? deptGenitive(data.departmentName)
      : "ХЭЛТСИЙН НЭГТГЭЛ";
    const titleText = `${deptPrefix} ${data.year} ОНЫ ${qName} УЛИРЛЫН БҮХ-НЫ ТАЙЛАН, ҮНЭЛГЭЭ`;

    // Format date: e.g. "2026 оны 01 сарын 07-ны өдөр"
    const now = new Date();
    const yy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const dateText = `${yy} оны ${mm} сарын ${dd}-ны өдөр`;

    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 80 },
        children: [
          new TextRun({
            text: titleText,
            bold: true,
            size: 24,
            font: "Times New Roman",
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 0, after: 300 },
        children: [
          new TextRun({
            text: dateText,
            size: 22,
            font: "Times New Roman",
          }),
        ],
      }),
    );

    // ── 1. Planned tasks table (Нэр column) ──────────────────────────────────
    if (data.tasks.length > 0) {
      children.push(this.sectionHeading("1. Ажлын гүйцэтгэлийн хүснэгт"));
      const cols = {
        num: 4,
        name: 12,
        title: 23,
        pct: 9,
        start: 11,
        end: 11,
        desc: 30,
      };
      const hLabels = [
        "№",
        "Нэр",
        "Төлөвлөгөөт ажил",
        "Гүйц %",
        "Эхлэх",
        "Дуусах",
        "Гүйцэтгэл /товч/",
      ];
      const hWidths = Object.values(cols);

      const headerRow = new TableRow({
        tableHeader: true,
        children: hLabels.map(
          (lbl, i) =>
            new TableCell({
              width: { size: hWidths[i], type: WidthType.PERCENTAGE },
              borders: this.border("888888"),
              shading: { type: ShadingType.SOLID, color: "FFFFFF" },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: lbl,
                      bold: true,
                      color: "000000",
                      size: 22,
                      font: "Times New Roman",
                    }),
                  ],
                }),
              ],
            }),
        ),
      });

      const dataRows = data.tasks.map(
        (t, idx) =>
          new TableRow({
            children: [
              this.tc(`${idx + 1}`, hWidths[0], true),
              this.tc(t.memberName ?? "", hWidths[1]),
              this.tc(t.title ?? "", hWidths[2]),
              this.tc(`${t.completion ?? 0}%`, hWidths[3], true),
              this.tc(t.startDate ?? "", hWidths[4], true),
              this.tc(t.endDate ?? "", hWidths[5], true),
              this.tc(t.description ?? "", hWidths[6]),
            ],
          }),
      );
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [headerRow, ...dataRows],
        }),
      );
      children.push(new Paragraph({ text: "", spacing: { after: 200 } }));
    }

    // ── Dynamic sections — formatted text by person ───────────────────────────
    let secNum = 2;
    for (const sec of data.sections ?? []) {
      children.push(this.sectionHeading(`${secNum}. ${sec.title}`, true));
      for (const entry of sec.entries ?? []) {
        // Person name sub-label
        children.push(
          new Paragraph({
            spacing: { before: 120, after: 40 },
            children: [
              new TextRun({
                text: entry.memberName ?? "",
                bold: true,
                size: 22,
                font: "Times New Roman",
                color: "000000",
              }),
            ],
          }),
        );
        for (const line of (entry.content ?? "").split("\n")) {
          children.push(this.bodyPara(line || " "));
        }
      }
      children.push(new Paragraph({ text: "", spacing: { after: 160 } }));
      secNum++;
    }

    // ── Бусад ажлууд — formatted text by person ───────────────────────────────
    const validOther = (data.otherEntries ?? []).filter((e: any) =>
      e.content?.trim(),
    );
    if (validOther.length > 0) {
      children.push(this.sectionHeading(`${secNum}. Бусад ажлууд`, true));
      for (const e of validOther) {
        children.push(
          new Paragraph({
            spacing: { before: 120, after: 40 },
            children: [
              new TextRun({
                text: e.memberName ?? "",
                bold: true,
                size: 22,
                font: "Times New Roman",
                color: "000000",
              }),
            ],
          }),
        );
        for (const line of (e.content ?? "").split("\n")) {
          children.push(this.bodyPara(line || " "));
        }
      }
      children.push(new Paragraph({ text: "", spacing: { after: 160 } }));
      secNum++;
    }

    // ── Хамт олны ажил — per-person bullet list ───────────────────────────────
    if ((data.activities ?? []).length > 0) {
      children.push(this.sectionHeading(`${secNum}. Хамт олны ажил`, true));
      for (const a of data.activities) {
        children.push(
          new Paragraph({
            spacing: { before: 60, after: 60, line: 276 },
            indent: { left: 360 },
            children: [
              new TextRun({
                text: `${a.memberName ?? ""}: `,
                bold: true,
                size: 22,
                font: "Times New Roman",
              }),
              new TextRun({
                text: `${a.name ?? ""}${a.date ? ` – ${a.date}` : ""}`,
                size: 22,
                font: "Times New Roman",
              }),
            ],
          }),
        );
      }
    }

    // ── Embedded images (single DOCX file; no side folders) ────────────────
    const imgCounter = { n: 1 };
    const collected: Array<{
      dataUrl: string;
      width?: number;
      height?: number;
    }> = [];
    const seen = new Set<string>();

    const pushIfImage = (val: any) => {
      if (!val || typeof val !== "object") return;
      const dataUrl = val.dataUrl;
      if (typeof dataUrl !== "string") return;
      if (!dataUrl.startsWith("data:image/")) return;
      const key = `${dataUrl.slice(0, 80)}|${val.width ?? ""}|${val.height ?? ""}`;
      if (seen.has(key)) return;
      seen.add(key);
      collected.push({
        dataUrl,
        width:
          typeof val.width === "number" && !isNaN(val.width)
            ? val.width
            : undefined,
        height:
          typeof val.height === "number" && !isNaN(val.height)
            ? val.height
            : undefined,
      });
    };

    const walk = (node: any) => {
      if (!node) return;
      if (Array.isArray(node)) {
        for (const x of node) walk(x);
        return;
      }
      if (typeof node !== "object") return;

      pushIfImage(node);
      for (const v of Object.values(node)) {
        if (v && (typeof v === "object" || Array.isArray(v))) walk(v);
      }
    };

    // From merged tasks (used by /tailan/dept/:year/:quarter/word)
    walk(data.tasks ?? []);
    // From raw sections payload (used by /tailan/dept/generate-word)
    walk(data.rawSections ?? null);

    if (collected.length > 0) {
      children.push(
        this.sectionHeading(`${secNum + 1}. Тайлангийн зураг`, true),
      );
      for (const img of collected) {
        children.push(
          ...this.inlineImageParas(
            img.dataUrl,
            img.width ?? 80,
            imgCounter,
            img.height,
          ),
        );
      }
    }

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: "Times New Roman", size: 22 },
            paragraph: { spacing: { line: 276 } },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              margin: { top: 900, bottom: 1259, left: 1440, right: 1077 },
            },
          },
          children,
        },
      ],
    });
    return Buffer.from(await Packer.toBuffer(doc));
  }

  private async buildDeptDocx(
    reports: any[],
    year: number,
    quarter: number,
    departmentId: string,
  ): Promise<Buffer> {
    const quarterNames = ["I", "II", "III", "IV"];
    const qName = quarterNames[(quarter - 1) % 4];
    const children: any[] = [];

    // ── Title ────────────────────────────────────────────────────────────────
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 300 },
        children: [
          new TextRun({
            text: `ХЭЛТСИЙН НЭГТГЭЛ: ${year} ОНЫ ${qName}-Р УЛИРЛЫН АЖЛЫН ТАЙЛАН`,
            bold: true,
            size: 22,
            font: "Times New Roman",
          }),
        ],
      }),
    );

    // ── Section 1: Planned tasks — all people in one table ──────────────────
    const allPlanned = reports.flatMap((r) =>
      (r.plannedTasks ?? []).map((t: any) => ({ ...t, _name: r.userName })),
    );

    if (allPlanned.length > 0) {
      children.push(this.sectionHeading("1. Ажлын гүйцэтгэлийн хүснэгт"));

      const headerLabels = [
        "№",
        "Нэр",
        "Төлөвлөгөөт ажил",
        "Гүйцэтгэл %",
        "Эхлэх огноо",
        "Дуусах огноо",
        "Гүйцэтгэл /товч/",
      ];
      const colWidths = [4, 12, 24, 9, 11, 11, 29];

      const headerRow = new TableRow({
        tableHeader: true,
        children: headerLabels.map(
          (label, i) =>
            new TableCell({
              width: { size: colWidths[i], type: WidthType.PERCENTAGE },
              borders: this.border("888888"),
              shading: { type: ShadingType.SOLID, color: "FFFFFF" },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: label,
                      bold: true,
                      color: "000000",
                      size: 22,
                      font: "Times New Roman",
                    }),
                  ],
                }),
              ],
            }),
        ),
      });

      let rowIdx = 1;
      const dataRows = allPlanned.map(
        (t) =>
          new TableRow({
            children: [
              this.tc(`${rowIdx++}`, colWidths[0], true),
              this.tc(t._name, colWidths[1]),
              this.tc(t.title ?? "", colWidths[2]),
              this.tc(`${t.completion ?? 0}%`, colWidths[3], true),
              this.tc(t.startDate ?? "", colWidths[4], true),
              this.tc(t.endDate ?? "", colWidths[5], true),
              this.tc(t.description ?? "", colWidths[6]),
            ],
          }),
      );

      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [headerRow, ...dataRows],
        }),
      );
      children.push(new Paragraph({ text: "", spacing: { after: 160 } }));
    }

    // ── Dynamic sections — collect all unique titles, one table each ─────────
    // Build map: sectionTitle → [{name, order, content}]
    const dynMap = new Map<
      string,
      {
        order: number;
        title: string;
        entries: { name: string; content: string }[];
      }
    >();
    for (const r of reports) {
      for (const sec of r.dynamicSections ?? []) {
        if (!dynMap.has(sec.title)) {
          dynMap.set(sec.title, {
            order: sec.order,
            title: sec.title,
            entries: [],
          });
        }
        dynMap
          .get(sec.title)!
          .entries.push({ name: r.userName, content: sec.content ?? "" });
      }
    }

    let sectionNum = 2;
    for (const sec of dynMap.values()) {
      children.push(this.sectionHeading(`${sectionNum}. ${sec.title}`, true));

      const hRow = new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            borders: this.border("888888"),
            shading: { type: ShadingType.SOLID, color: "FFFFFF" },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "Нэр",
                    bold: true,
                    color: "000000",
                    size: 22,
                    font: "Times New Roman",
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 80, type: WidthType.PERCENTAGE },
            borders: this.border("888888"),
            shading: { type: ShadingType.SOLID, color: "FFFFFF" },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Агуулга",
                    bold: true,
                    color: "000000",
                    size: 22,
                    font: "Times New Roman",
                  }),
                ],
              }),
            ],
          }),
        ],
      });

      const dRows = sec.entries.map((e) => {
        const contentParas = e.content.split("\n").map(
          (line) =>
            new Paragraph({
              spacing: { before: 40, after: 40 },
              children: [
                new TextRun({
                  text: line || " ",
                  size: 22,
                  font: "Times New Roman",
                }),
              ],
            }),
        );
        return new TableRow({
          children: [
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              borders: this.border(),
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: e.name,
                      size: 22,
                      font: "Times New Roman",
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 80, type: WidthType.PERCENTAGE },
              borders: this.border(),
              children: contentParas,
            }),
          ],
        });
      });

      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [hRow, ...dRows],
        }),
      );
      children.push(new Paragraph({ text: "", spacing: { after: 160 } }));
      sectionNum++;
    }

    // ── Бусад ажлууд — one table ─────────────────────────────────────────────
    const otherRows = reports.filter((r) => r.otherWork?.trim());
    if (otherRows.length > 0) {
      children.push(this.sectionHeading(`${sectionNum}. Бусад ажлууд`, true));
      const hRow = new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            borders: this.border("888888"),
            shading: { type: ShadingType.SOLID, color: "FFFFFF" },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "Нэр",
                    bold: true,
                    color: "000000",
                    size: 22,
                    font: "Times New Roman",
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 80, type: WidthType.PERCENTAGE },
            borders: this.border("888888"),
            shading: { type: ShadingType.SOLID, color: "FFFFFF" },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Агуулга",
                    bold: true,
                    color: "000000",
                    size: 22,
                    font: "Times New Roman",
                  }),
                ],
              }),
            ],
          }),
        ],
      });
      const dRows = otherRows.map(
        (r) =>
          new TableRow({
            children: [
              new TableCell({
                width: { size: 20, type: WidthType.PERCENTAGE },
                borders: this.border(),
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: r.userName,
                        size: 22,
                        font: "Times New Roman",
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 80, type: WidthType.PERCENTAGE },
                borders: this.border(),
                children: [
                  new Paragraph({
                    spacing: { before: 40, after: 40 },
                    children: [
                      new TextRun({
                        text: r.otherWork,
                        size: 22,
                        font: "Times New Roman",
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
      );
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [hRow, ...dRows],
        }),
      );
      children.push(new Paragraph({ text: "", spacing: { after: 160 } }));
      sectionNum++;
    }

    // ── Хамт олны ажил — one table ───────────────────────────────────────────
    const allActivities = reports.flatMap((r) =>
      (r.teamActivities ?? []).map((a: any) => ({ ...a, _name: r.userName })),
    );
    if (allActivities.length > 0) {
      children.push(this.sectionHeading(`${sectionNum}. Хамт олны ажил`, true));
      const hRow = new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            borders: this.border("888888"),
            shading: { type: ShadingType.SOLID, color: "FFFFFF" },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "Нэр",
                    bold: true,
                    color: "000000",
                    size: 22,
                    font: "Times New Roman",
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 55, type: WidthType.PERCENTAGE },
            borders: this.border("888888"),
            shading: { type: ShadingType.SOLID, color: "FFFFFF" },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Үйл ажиллагаа",
                    bold: true,
                    color: "000000",
                    size: 22,
                    font: "Times New Roman",
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            borders: this.border("888888"),
            shading: { type: ShadingType.SOLID, color: "FFFFFF" },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "Огноо",
                    bold: true,
                    color: "000000",
                    size: 22,
                    font: "Times New Roman",
                  }),
                ],
              }),
            ],
          }),
        ],
      });
      const dRows = allActivities.map(
        (a) =>
          new TableRow({
            children: [
              new TableCell({
                width: { size: 20, type: WidthType.PERCENTAGE },
                borders: this.border(),
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: a._name,
                        size: 22,
                        font: "Times New Roman",
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 55, type: WidthType.PERCENTAGE },
                borders: this.border(),
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: a.name ?? "",
                        size: 22,
                        font: "Times New Roman",
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 25, type: WidthType.PERCENTAGE },
                borders: this.border(),
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: a.date ?? "",
                        size: 22,
                        font: "Times New Roman",
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
      );
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [hRow, ...dRows],
        }),
      );
    }

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: "Times New Roman", size: 22 },
            paragraph: { spacing: { line: 276 } },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              margin: { top: 902, bottom: 1259, left: 1440, right: 1077 },
            },
          },
          children,
        },
      ],
    });

    return Buffer.from(await Packer.toBuffer(doc));
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────
  private border(color = "CCCCCC") {
    return {
      top: { style: BorderStyle.SINGLE, size: 1, color },
      bottom: { style: BorderStyle.SINGLE, size: 1, color },
      left: { style: BorderStyle.SINGLE, size: 1, color },
      right: { style: BorderStyle.SINGLE, size: 1, color },
    };
  }

  /** Big section heading: Roman numeral prefix, bold, ALL CAPS, 11pt */
  private bigSectionHeading(text: string) {
    return new Paragraph({
      spacing: { before: 340, after: 140 },
      children: [
        new TextRun({
          text: text.toUpperCase(),
          bold: true,
          size: 22,
          font: "Times New Roman",
          allCaps: true,
        }),
      ],
    });
  }

  /** Sub-section heading: e.g. I.1 … bold, normal case */
  private subSectionHeading(text: string) {
    return new Paragraph({
      spacing: { before: 200, after: 100 },
      children: [
        new TextRun({
          text,
          bold: true,
          size: 22,
          font: "Times New Roman",
        }),
      ],
    });
  }

  private sectionHeading(text: string, pageBreakBefore = false) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 280, after: 120 },
      pageBreakBefore,
      children: [
        new TextRun({
          text,
          bold: true,
          size: 22,
          font: "Times New Roman",
        }),
      ],
    });
  }

  private bodyPara(text: string) {
    return new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { before: 0, after: 100, line: 276 },
      children: [new TextRun({ text, size: 22, font: "Times New Roman" })],
    });
  }

  private buildPlannedTable(tasks: any[]) {
    const headerLabels = [
      "№",
      "Төлөвлөгөөт ажил",
      "Гүйцэтгэл %",
      "Эхлэх огноо",
      "Дуусах огноо",
      "Гүйцэтгэл /товч/",
    ];
    const colWidths = [5, 25, 10, 12, 12, 36];

    const headerRow = new TableRow({
      tableHeader: true,
      children: headerLabels.map(
        (label, i) =>
          new TableCell({
            width: { size: colWidths[i], type: WidthType.PERCENTAGE },
            borders: this.border("888888"),
            shading: { type: ShadingType.SOLID, color: "FFFFFF" },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: label,
                    bold: true,
                    color: "000000",
                    size: 22,
                    font: "Times New Roman",
                  }),
                ],
              }),
            ],
          }),
      ),
    });

    const dataRows = tasks.map(
      (task) =>
        new TableRow({
          children: [
            this.tc(`${task.order}`, 5, true),
            this.tc(task.title ?? "", 25),
            this.tc(`${task.completion ?? 0}%`, 10, true),
            this.tc(task.startDate ?? "", 12, true),
            this.tc(task.endDate ?? "", 12, true),
            this.tc(task.description ?? "", 36),
          ],
        }),
    );

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...dataRows],
    });
  }

  private tc(text: string, widthPct: number, center = false) {
    return new TableCell({
      width: { size: widthPct, type: WidthType.PERCENTAGE },
      borders: this.border(),
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
      children: [
        new Paragraph({
          alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: { before: 40, after: 40 },
          children: [new TextRun({ text, size: 22, font: "Times New Roman" })],
        }),
      ],
    });
  }

  /** Cell with no explicit borders — inherits from the parent Table-level borders */
  private tcNoB(
    text: string,
    widthPct: number,
    center = false,
    shading?: { type: any; color: string; fill?: string },
  ) {
    const cell: any = {
      width: { size: widthPct, type: WidthType.PERCENTAGE },
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
      children: [
        new Paragraph({
          alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: { before: 40, after: 40 },
          children: [new TextRun({ text, size: 22, font: "Times New Roman" })],
        }),
      ],
    };
    if (shading) cell.shading = shading;
    return new TableCell(cell);
  }

  /** Table outer border: solid; inner (insideH/insideV): dashed */
  private dashedInnerBorders() {
    return {
      top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      insideH: { style: BorderStyle.DASHED, size: 2, color: "444444" },
      insideV: { style: BorderStyle.DASHED, size: 2, color: "444444" },
    };
  }

  /**
   * Build a table with solid outer border + dashed inner borders.
   * headers: label array, colWidths: % widths, dataRows: string[][] matrix,
   * centerCols: column indices to center in data rows (defaults to [0])
   */
  private buildDashedTable(
    headers: string[],
    colWidths: number[],
    dataRows: string[][],
    extraRows: TableRow[] = [],
    centerCols?: number[],
  ) {
    const centerSet = new Set(centerCols ?? [0]);
    const headerRow = new TableRow({
      tableHeader: true,
      children: headers.map(
        (lbl, i) =>
          new TableCell({
            width: { size: colWidths[i], type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: "FFFFFF" },
            margins: { top: 40, bottom: 40, left: 80, right: 80 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 40 },
                children: [
                  new TextRun({
                    text: lbl,
                    bold: true,
                    color: "000000",
                    size: 22,
                    font: "Times New Roman",
                  }),
                ],
              }),
            ],
          }),
      ),
    });
    const rows =
      dataRows.length > 0
        ? dataRows.map(
            (row) =>
              new TableRow({
                children: row.map((cell, ci) =>
                  this.tcNoB(cell, colWidths[ci], centerSet.has(ci)),
                ),
              }),
          )
        : [
            new TableRow({
              children: colWidths.map((w) => this.tcNoB(" ", w, true)),
            }),
          ];
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: this.dashedInnerBorders() as any,
      rows: [headerRow, ...rows, ...extraRows],
    });
  }

  /** Convert a base64 dataUrl image into centered Paragraph(s) with caption. */
  private inlineImageParas(
    dataUrl: string,
    widthPct: number,
    counter: { n: number },
    heightPx?: number,
  ): Paragraph[] {
    try {
      const match = dataUrl?.match(/^data:([^;]+);base64,(.+)$/s);
      if (!match) return [];
      const mimeType = match[1];
      const buffer = Buffer.from(match[2], "base64");

      // Determine docx image type
      type ImgType = "png" | "jpg" | "gif" | "bmp";
      let type: ImgType = "png";
      if (mimeType.includes("jpeg") || mimeType.includes("jpg")) type = "jpg";
      else if (mimeType.includes("gif")) type = "gif";
      else if (mimeType.includes("bmp")) type = "bmp";

      // Printable line width on A4: 210mm - 25.4mm left - 19mm right = 165.6mm
      // Preview renders A4 at 834px wide → 834 × (165.6/210) ≈ 658px usable
      const maxWidthPx = 658;
      const targetW = Math.round((maxWidthPx * Math.min(widthPct, 100)) / 100);

      // Parse native dimensions for correct aspect ratio
      let nativeW = 0;
      let nativeH = 0;
      if (type === "png" && buffer.length >= 24) {
        nativeW = buffer.readUInt32BE(16);
        nativeH = buffer.readUInt32BE(20);
      } else if (type === "jpg") {
        let i = 2;
        while (i < buffer.length - 9) {
          if (buffer[i] === 0xff) {
            const marker = buffer[i + 1];
            if (marker >= 0xc0 && marker <= 0xc3) {
              nativeH = buffer.readUInt16BE(i + 5);
              nativeW = buffer.readUInt16BE(i + 7);
              break;
            }
            if (i + 3 < buffer.length) i += 2 + buffer.readUInt16BE(i + 2);
            else break;
          } else {
            i++;
          }
        }
      }

      const targetH =
        heightPx && heightPx > 0
          ? heightPx
          : nativeW > 0 && nativeH > 0
            ? Math.round(targetW * (nativeH / nativeW))
            : Math.round(targetW * 0.625); // fallback ~16:10 ratio

      const captionN = counter.n++;
      return [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 60, after: 20 },
          children: [
            new ImageRun({
              data: buffer,
              transformation: { width: targetW, height: targetH },
              type,
            } as any),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 80 },
          children: [
            new TextRun({
              text: `Зураг ${captionN}.`,
              italics: true,
              size: 18,
              font: "Times New Roman",
            }),
          ],
        }),
      ];
    } catch {
      return [];
    }
  }
}
