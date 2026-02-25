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
import { v4 as uuidv4 } from "uuid";

interface UserPayload {
  id: string;
  name: string;
  departmentId?: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  allowedTools: string[];
}

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

    const id = existing.length > 0 ? existing[0].id : uuidv4();
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
    return {
      ...row,
      plannedTasks: this.safeJson(row.plannedTasksJson, []),
      dynamicSections: this.safeJson(row.dynamicSectionsJson, []),
      teamActivities: this.safeJson(row.teamActivitiesJson, []),
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
    const id = uuidv4();
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
    const quarterNames = ["I", "II", "III", "IV"];
    const qName = quarterNames[(quarter - 1) % 4];

    const children: any[] = [];

    // Title
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 200 },
        children: [
          new TextRun({
            text: `${report.userName ?? ""} ${year} ОНЫ ${qName}-Р УЛИРЛЫН АЖЛЫН ТАЙЛАН`,
            bold: true,
            size: 22,
            font: "Times New Roman",
          }),
        ],
      }),
    );

    // Section 1: Planned work table
    if (report.plannedTasks?.length > 0) {
      children.push(
        this.sectionHeading(
          `1. Аудитын үйл ажиллагаанд шаардлагатай өгөгдөл боловсруулалтын ажил`,
        ),
      );
      children.push(this.buildPlannedTable(report.plannedTasks));
      children.push(new Paragraph({ text: "", spacing: { after: 160 } }));
    }

    // Dynamic sections
    for (const sec of report.dynamicSections ?? []) {
      children.push(this.sectionHeading(`${sec.order}. ${sec.title}`));
      const lines = (sec.content ?? "").split("\n");
      for (const line of lines) {
        children.push(this.bodyPara(line || " "));
      }
      children.push(new Paragraph({ text: "", spacing: { after: 100 } }));
    }

    const nextNum = (report.dynamicSections?.length ?? 0) + 2;

    // Бусад ажлууд
    children.push(this.sectionHeading(`${nextNum}. Бусад ажлууд`));
    const otherLines = (report.otherWork ?? "").split("\n");
    for (const line of otherLines) {
      children.push(this.bodyPara(line || " "));
    }
    children.push(new Paragraph({ text: "", spacing: { after: 100 } }));

    // Хамт олны ажил
    children.push(this.sectionHeading(`${nextNum + 1}. Хамт олны ажил`));
    for (const act of report.teamActivities ?? []) {
      children.push(
        new Paragraph({
          spacing: { before: 60, after: 60, line: 276 },
          indent: { left: 360 },
          children: [
            new TextRun({
              text: `- ${act.name}${act.date ? ` – ${act.date}` : ""}`,
              size: 22,
              font: "Times New Roman",
            }),
          ],
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
              // Top 1.59cm, Bottom 2.22cm, Left 2.54cm, Right 1.9cm (in TWIPs: 1cm≈567)
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
}
