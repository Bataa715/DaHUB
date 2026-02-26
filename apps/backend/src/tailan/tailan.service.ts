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
  AlignmentType,
  WidthType,
  BorderStyle,
  Packer,
  ShadingType,
  HeadingLevel,
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
    "Зайны аудит чанарын баталгаажуулалтын хэлтэс": "ЗАГЧБХ",
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
          section3AutoTasks: dto.section3AutoTasks ?? [],
          section3Dashboards: dto.section3Dashboards ?? [],
          section4Trainings: dto.section4Trainings ?? [],
          section4KnowledgeText: dto.section4KnowledgeText ?? "",
          section5Tasks: dto.section5Tasks ?? [],
          section6Activities: dto.section6Activities ?? [],
          section7Text: dto.section7Text ?? "",
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

  // ─── Parse stored report ────────────────────────────────────────────────────
  private parseReport(row: any) {
    const extra = this.safeJson(row.extraDataJson, {});
    return {
      ...row,
      plannedTasks: this.safeJson(row.plannedTasksJson, []),
      dynamicSections: this.safeJson(row.dynamicSectionsJson, []),
      teamActivities: this.safeJson(row.teamActivitiesJson, []),
      section2Tasks: extra.section2Tasks ?? [],
      section3AutoTasks: extra.section3AutoTasks ?? [],
      section3Dashboards: extra.section3Dashboards ?? [],
      section4Trainings: extra.section4Trainings ?? [],
      section4KnowledgeText: extra.section4KnowledgeText ?? "",
      section5Tasks: extra.section5Tasks ?? [],
      section6Activities: extra.section6Activities ?? [],
      section7Text: extra.section7Text ?? "",
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
    return this.buildDeptDocxFromData(data);
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

    // ── Fixed section I: Data analysis support ───────────────────────────────
    children.push(
      this.bigSectionHeading(
        "I. ӨГӨГДӨЛ ШИНЖИЛГЭЭГЭЭР АУДИТЫН ҮЙЛ АЖИЛЛАГААГ ДЭМЖСЭН БАЙДАЛ",
      ),
    );

    // I.1 – зураг / текст (plannedTasks as numbered list with data-analysis entries)
    children.push(
      this.subSectionHeading(
        "I.1 Data шинжилгээний үр дүнгээр аудитын үйл ажиллагааг дэмжсэн байдал",
      ),
    );

    const analysisItems = (report.plannedTasks ?? []).filter((t: any) =>
      t.title?.trim(),
    );
    if (analysisItems.length === 0) {
      children.push(this.bodyPara(" "));
    } else {
      analysisItems.forEach((t: any, idx: number) => {
        // Numbered entry
        children.push(
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 80, after: 60, line: 276 },
            indent: { left: 360, hanging: 360 },
            children: [
              new TextRun({
                text: `${idx + 1}. `,
                bold: true,
                size: 22,
                font: "Times New Roman",
              }),
              new TextRun({
                text: t.title ?? "",
                size: 22,
                font: "Times New Roman",
              }),
            ],
          }),
        );
        if (t.description?.trim()) {
          children.push(this.bodyPara(t.description));
        }
      });
    }
    children.push(new Paragraph({ text: "", spacing: { after: 120 } }));

    // I.2 – Dashboard хүснэгт
    children.push(
      this.subSectionHeading(
        "I.2 Шинээр хөгжүүлсэн dashboard хөгжүүлэлтийн чанар, үр дүн",
      ),
    );

    // Build dashboard table from plannedTasks
    // Columns: №, Төлөвлөгөөт ажил, Ажлын гүйцэтгэл, Хийгдсэн хугацаа, Гүйцэтгэл
    const dashColWidths = [5, 30, 20, 20, 25];
    const dashHeaders = [
      "№",
      "Төлөвлөгөөт ажил",
      "Ажлын гүйцэтгэл",
      "Хийгдсэн хугацаа",
      "Гүйцэтгэл",
    ];
    const dashHeaderRow = new TableRow({
      tableHeader: true,
      children: dashHeaders.map(
        (lbl, i) =>
          new TableCell({
            width: { size: dashColWidths[i], type: WidthType.PERCENTAGE },
            borders: this.border("888888"),
            shading: { type: ShadingType.SOLID, color: "1F3864" },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: lbl,
                    bold: true,
                    color: "FFFFFF",
                    size: 22,
                    font: "Times New Roman",
                  }),
                ],
              }),
            ],
          }),
      ),
    });

    const allTasks: any[] = report.plannedTasks ?? [];
    const dashDataRows =
      allTasks.length > 0
        ? allTasks.map(
            (t: any, idx: number) =>
              new TableRow({
                children: [
                  this.tc(`${idx + 1}`, dashColWidths[0], true),
                  this.tc(t.title ?? "", dashColWidths[1]),
                  this.tc(`${t.completion ?? 0}%`, dashColWidths[2], true),
                  this.tc(
                    `${t.startDate ?? ""}${t.startDate && t.endDate ? " – " : ""}${t.endDate ?? ""}`,
                    dashColWidths[3],
                    true,
                  ),
                  this.tc(t.description ?? "", dashColWidths[4]),
                ],
              }),
          )
        : [
            new TableRow({
              children: dashColWidths.map((w) => this.tc(" ", w, true)),
            }),
          ];

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [dashHeaderRow, ...dashDataRows],
      }),
    );
    children.push(new Paragraph({ text: "", spacing: { after: 200 } }));

    // ── Fixed Section II: Өгөгдөл боловсруулах ажил ─────────────────────────
    children.push(
      this.bigSectionHeading(
        "II. АУДИТЫН ҮЙЛ АЖИЛЛАГААНД ШААРДЛАГАТАЙ ӨГӨГДӨЛ БОЛОВСРУУЛАХ АЖИЛ",
      ),
    );
    const s2Tasks: any[] = report.section2Tasks ?? [];
    const s2Headers = [
      "№",
      "Төлөвлөгөөт ажлууд",
      "Ажлын гүйцэтгэл",
      "Хийгдсэн хугацаа",
      "Гүйцэтгэл",
    ];
    const s2Widths = [5, 30, 20, 20, 25];
    const s2Rows: string[][] = s2Tasks.map((t, i) => [
      `${i + 1}`,
      t.title ?? "",
      t.result ?? "",
      t.period ?? "",
      t.completion ?? "",
    ]);
    children.push(this.buildDashedTable(s2Headers, s2Widths, s2Rows));
    children.push(new Paragraph({ text: "", spacing: { after: 200 } }));

    // ── Fixed Section III: Тогтмол хийгддэг ажлууд ──────────────────────────
    children.push(this.bigSectionHeading("III. ТОГТМОЛ ХИЙГДДЭГ АЖЛУУД"));

    // III.1 – Автоматжуулалт
    children.push(
      this.subSectionHeading(
        "III.1 Өгөгдөл боловсруулалт автоматжуулалтыг цаг хугацаанд нь гүйцэтгэсэн байдал",
      ),
    );
    const s3AutoTasks: any[] = report.section3AutoTasks ?? [];
    const s3aHeaders = [
      "№",
      "Тогтмол хийгддэг өгөгдөл боловсруулалт/автоматжуулалт",
      "Өгөгдөл боловсруулалтын ажлын ач холбогдол/хэрэглээ",
      "Хэрэглэгчийн нэгжийн өгсөн үнэлгээ",
    ];
    const s3aWidths = [5, 40, 35, 20];
    const s3aRows: string[][] = s3AutoTasks.map((t, i) => [
      `${i + 1}`,
      t.title ?? "",
      t.value ?? "",
      t.rating ?? "",
    ]);
    children.push(this.buildDashedTable(s3aHeaders, s3aWidths, s3aRows));
    children.push(new Paragraph({ text: "", spacing: { after: 160 } }));

    // III.2 – Dashboard
    children.push(
      this.subSectionHeading(
        "III.2 Дашбоардын хэвийн ажиллагааг хангаж ажилласан байдал",
      ),
    );
    const s3Dashboards: any[] = report.section3Dashboards ?? [];
    const s3dHeaders = [
      "№",
      "Dashboard",
      "Дашбоардын ач холбогдол/хэрэглээ",
      "Хэрэглэгч нэгжийн өгсөн үнэлгээ",
    ];
    const s3dWidths = [5, 35, 40, 20];
    const s3dRows: string[][] = s3Dashboards.map((t, i) => [
      `${i + 1}`,
      t.dashboard ?? "",
      t.value ?? "",
      t.rating ?? "",
    ]);
    children.push(this.buildDashedTable(s3dHeaders, s3dWidths, s3dRows));
    children.push(new Paragraph({ text: "", spacing: { after: 200 } }));

    // ── Fixed Section IV: Хамрагдсан сургалт ────────────────────────────────
    children.push(this.bigSectionHeading("IV. ХАМРАГДСАН СУРГАЛТ"));
    const s4Trainings: any[] = report.section4Trainings ?? [];
    const s4Headers = [
      "№",
      "Хамрагдсан сургалт",
      "Зохион байгуулагч",
      "Сургалтын төрөл (Онлайн/Танхим)",
      "Хэзээ",
      "Сургалтын хэлбэр",
      "Цаг",
      "Аудитын зорилго зорилтод нийцэж буй эсэх",
      "Мэдлэгээ хуваалцсан эсэх",
    ];
    const s4Widths = [4, 16, 12, 10, 8, 10, 5, 18, 17];
    const s4Rows: string[][] = s4Trainings.map((t, i) => [
      `${i + 1}`,
      t.training ?? "",
      t.organizer ?? "",
      t.type ?? "",
      t.date ?? "",
      t.format ?? "",
      t.hours ?? "",
      t.meetsAuditGoal ?? "",
      t.sharedKnowledge ?? "",
    ]);
    children.push(this.buildDashedTable(s4Headers, s4Widths, s4Rows));
    children.push(new Paragraph({ text: "", spacing: { after: 140 } }));

    // IV sub-section: Мэдлэгээ ашиглаж буй байдал
    children.push(
      this.subSectionHeading(
        "IV.1 Сургалтаас олж авсан мэдлэгээ ашиглаж буй байдал",
      ),
    );
    const knowledgeLines = (report.section4KnowledgeText ?? "").split("\n");
    for (const line of knowledgeLines) {
      children.push(this.bodyPara(line || " "));
    }
    children.push(new Paragraph({ text: "", spacing: { after: 200 } }));

    // ── Fixed Section V: Үүрэг даалгаварын биелэлт ───────────────────────────
    children.push(this.bigSectionHeading("V. ҮҮРЭГ ДААЛГАВАРЫН БИЕЛЭЛТ"));
    const s5Tasks: any[] = report.section5Tasks ?? [];
    const s5Headers = ["№", "Ажлын төрөл", "Хийгдсэн ажил"];
    const s5Widths = [5, 30, 65];
    const s5Rows: string[][] = s5Tasks.map((t, i) => [
      `${i + 1}`,
      t.taskType ?? "",
      t.completedWork ?? "",
    ]);
    children.push(this.buildDashedTable(s5Headers, s5Widths, s5Rows));
    children.push(new Paragraph({ text: "", spacing: { after: 200 } }));

    // ── Fixed Section VI: Хамт олны ажил ──────────────────────────────────────
    children.push(this.bigSectionHeading("VI. ХАМТ ОЛНЫ АЖИЛ"));
    const s6Activities: any[] = report.section6Activities ?? [];
    const s6Headers = ["№", "Огноо", "Хамт олны ажил", "Санаачилга"];
    const s6Widths = [5, 15, 50, 30];
    const s6Rows: string[][] = s6Activities.map((t, i) => [
      `${i + 1}`,
      t.date ?? "",
      t.activity ?? "",
      t.initiative ?? "",
    ]);
    children.push(this.buildDashedTable(s6Headers, s6Widths, s6Rows));
    children.push(new Paragraph({ text: "", spacing: { after: 200 } }));

    // ── Fixed Section VII: Шинэ санал санаачилга ──────────────────────────────
    children.push(this.bigSectionHeading("VII. ШИНЭ САНАЛ САНААЧИЛГА"));
    const s7Lines = (report.section7Text ?? "").split("\n");
    for (const line of s7Lines) {
      children.push(this.bodyPara(line || " "));
    }
    children.push(new Paragraph({ text: "", spacing: { after: 200 } }));

    // ── Dynamic big sections (VIII, IX, …) ───────────────────────────────────
    const dynamicSecs: any[] = report.dynamicSections ?? [];
    dynamicSecs.forEach((sec: any, idx: number) => {
      const romNum = ROMAN_NUMS[idx + 7] ?? `${idx + 8}`;
      const secTitleUpper = (sec.title ?? "").toUpperCase();
      children.push(this.bigSectionHeading(`${romNum}. ${secTitleUpper}`));
      const lines = (sec.content ?? "").split("\n");
      for (const line of lines) {
        children.push(this.bodyPara(line || " "));
      }
      children.push(new Paragraph({ text: "", spacing: { after: 120 } }));
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

  // ─── Build dept .docx from structured merged data ──────────────────────────
  private async buildDeptDocxFromData(data: {
    year: number;
    quarter: number;
    tasks: any[];
    sections: any[];
    otherEntries: any[];
    activities: any[];
  }): Promise<Buffer> {
    const quarterNames = ["I", "II", "III", "IV"];
    const qName = quarterNames[(data.quarter - 1) % 4];
    const children: any[] = [];

    // ── Title ───────────────────────────────────────────────────────────────
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 300 },
        children: [
          new TextRun({
            text: `ХЭЛТСИЙН НЭГТГЭЛ: ${data.year} ОНЫ ${qName}-Р УЛИРЛЫН АЖЛЫН ТАЙЛАН`,
            bold: true,
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
              shading: { type: ShadingType.SOLID, color: "1F3864" },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: lbl,
                      bold: true,
                      color: "FFFFFF",
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
      children.push(this.sectionHeading(`${secNum}. ${sec.title}`));
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
      children.push(this.sectionHeading(`${secNum}. Бусад ажлууд`));
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
      children.push(this.sectionHeading(`${secNum}. Хамт олны ажил`));
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
              shading: { type: ShadingType.SOLID, color: "1F3864" },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: label,
                      bold: true,
                      color: "FFFFFF",
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
      children.push(this.sectionHeading(`${sectionNum}. ${sec.title}`));

      const hRow = new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            borders: this.border("888888"),
            shading: { type: ShadingType.SOLID, color: "1F3864" },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "Нэр",
                    bold: true,
                    color: "FFFFFF",
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
            shading: { type: ShadingType.SOLID, color: "1F3864" },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Агуулга",
                    bold: true,
                    color: "FFFFFF",
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
      children.push(this.sectionHeading(`${sectionNum}. Бусад ажлууд`));
      const hRow = new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            borders: this.border("888888"),
            shading: { type: ShadingType.SOLID, color: "1F3864" },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "Нэр",
                    bold: true,
                    color: "FFFFFF",
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
            shading: { type: ShadingType.SOLID, color: "1F3864" },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Агуулга",
                    bold: true,
                    color: "FFFFFF",
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
      children.push(this.sectionHeading(`${sectionNum}. Хамт олны ажил`));
      const hRow = new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            borders: this.border("888888"),
            shading: { type: ShadingType.SOLID, color: "1F3864" },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "Нэр",
                    bold: true,
                    color: "FFFFFF",
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
            shading: { type: ShadingType.SOLID, color: "1F3864" },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Үйл ажиллагаа",
                    bold: true,
                    color: "FFFFFF",
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
            shading: { type: ShadingType.SOLID, color: "1F3864" },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "Огноо",
                    bold: true,
                    color: "FFFFFF",
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

  private sectionHeading(text: string) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 280, after: 120 },
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
            shading: { type: ShadingType.SOLID, color: "1F3864" },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: label,
                    bold: true,
                    color: "FFFFFF",
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
   * headers: label array, colWidths: % widths, dataRows: string[][] matrix
   */
  private buildDashedTable(
    headers: string[],
    colWidths: number[],
    dataRows: string[][],
  ) {
    const blueFill = { type: ShadingType.SOLID, color: "1F3864" };
    const headerRow = new TableRow({
      tableHeader: true,
      children: headers.map(
        (lbl, i) =>
          new TableCell({
            width: { size: colWidths[i], type: WidthType.PERCENTAGE },
            shading: blueFill,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 40 },
                children: [
                  new TextRun({
                    text: lbl,
                    bold: true,
                    color: "FFFFFF",
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
                  this.tcNoB(cell, colWidths[ci], ci === 0),
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
      rows: [headerRow, ...rows],
    });
  }
}
