import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { ClickHouseService } from "../clickhouse/clickhouse.service";
import { AuditLogService } from "../audit/audit-log.service";
import { SaveTailanDto } from "./dto/tailan.dto";
import { TailanTemplateService } from "../tailan-template/tailan-template.service";
import { TailanTemplate } from "../tailan-template/tailan-template.types";
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
  constructor(
    private readonly clickhouse: ClickHouseService,
    private readonly auditLog: AuditLogService,
    private readonly tailanTemplates: TailanTemplateService,
  ) {}

  private auditMutation(
    userId: string,
    action: string,
    resourceId?: string,
    metadata?: Record<string, unknown>,
  ): void {
    void this.auditLog.log({
      userId,
      action,
      resource: "tailan",
      resourceId: resourceId ?? "",
      method: action,
      status: "success",
      metadata,
    });
  }

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
      `SELECT id FROM tailan_reports FINAL
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
        // Legacy per-field columns are left at defaults for new saves — all
        // section data now lives in sectionsDataJson (template-driven).
        plannedTasksJson: "[]",
        dynamicSectionsJson: JSON.stringify(dto.dynamicSections ?? []),
        otherWork: "",
        teamActivitiesJson: "[]",
        extraDataJson: JSON.stringify({
          hiddenSections: dto.hiddenSections ?? [],
        }),
        sectionsDataJson: JSON.stringify(dto.sections ?? {}),
        submittedAt: dto.status === "submitted" ? now : "1970-01-01 00:00:00",
        updatedAt: now,
        createdAt:
          existing.length > 0 ? (existing[0]["createdAt"] ?? now) : now,
      },
    ]);

    if (dto.status === "submitted") {
      this.auditMutation(user.id, "tailan_submit", id, {
        year: dto.year,
        quarter: dto.quarter,
      });
    }

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

    this.auditMutation(userId, "tailan_submit", String(report.id), {
      year,
      quarter,
    });

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

  // ─── Dept head: render a member's saved report as .docx ───────────────────
  async generateMemberWord(
    user: UserPayload,
    targetUserId: string,
    year: number,
    quarter: number,
  ): Promise<Buffer> {
    if (!this.isDeptHead(user)) throw new ForbiddenException("Эрх хүрэхгүй");

    const rows = await this.clickhouse.query<any>(
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
    if (rows.length === 0) throw new NotFoundException("Тайлан олдсонгүй");
    const report = this.parseReport(rows[0]);

    let position = "";
    let departmentName = "";
    try {
      const userRows = await this.clickhouse.query<any>(
        `SELECT u.position, d.name as departmentName
         FROM users u LEFT JOIN departments d ON u.departmentId = d.id
         WHERE u.id = {uid:String} LIMIT 1`,
        { uid: targetUserId },
      );
      if (userRows.length > 0) {
        position = userRows[0].position ?? "";
        departmentName = userRows[0].departmentName ?? "";
      }
    } catch {}

    const template = await this.tailanTemplates.getActive(
      user.departmentId,
      "employee",
    );
    return this.renderDocx(template, report.sectionsData, {
      userName: report.userName,
      userPosition: position,
      userDepartment: departmentName,
      year,
      quarter,
      hiddenSections: report.hiddenSections,
      dynamicSections: report.dynamicSections,
    });
  }

  // ─── Parse stored report ────────────────────────────────────────────────────
  private parseReport(row: any) {
    const extra = this.safeJson(row.extraDataJson, {});
    return {
      ...row,
      dynamicSections: this.safeJson(row.dynamicSectionsJson, []),
      hiddenSections: extra.hiddenSections ?? [],
      sectionsData: this.legacyRowToSectionsData(row, extra),
    };
  }

  /** Reads the generic sectionsData blob for a report row, falling back to
   * reconstructing it from the pre-refactor per-field JSON columns for rows
   * saved before the Tailan dynamic template migration (no DB backfill needed). */
  private legacyRowToSectionsData(
    row: any,
    extra: Record<string, any>,
  ): Record<string, unknown> {
    if (row.sectionsDataJson) {
      const parsed = this.safeJson(row.sectionsDataJson, null);
      if (parsed && typeof parsed === "object") return parsed;
    }
    const plannedTasks = this.safeJson(row.plannedTasksJson, []);
    const toPeriod = (t: any) =>
      t?.startDate || t?.endDate
        ? `${t?.startDate ?? ""} – ${t?.endDate ?? ""}`
        : "";
    return {
      s1: (plannedTasks ?? []).map((t: any) => ({
        _id: t._id,
        order: t.order,
        title: t.title,
        completion: t.completion,
        period: toPeriod(t),
        description: t.description,
        images: t.images ?? [],
      })),
      s12: extra.section1Dashboards ?? [],
      s2: (extra.section2Tasks ?? []).map((t: any) => ({
        _id: t._id,
        order: t.order,
        title: t.title,
        completion: t.result,
        period: t.period,
        description: t.completion,
        images: t.images ?? [],
      })),
      s3: extra.section3AutoTasks ?? [],
      s32: extra.section3Dashboards ?? [],
      s4: extra.section4Trainings ?? [],
      s41: extra.section4KnowledgeText ?? "",
      s5: extra.section5Tasks ?? [],
      s6: extra.section6Activities ?? [],
      s7: extra.section7Text ?? "",
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
    // [SAFETY] DROP COLUMN dataBase64 cleanup хассан — энэ функц image
    // upload/унших болгонд дуудагддаг тул local/prod ижил DB-д эрсдэлтэй.
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
    this.auditMutation(userId, "tailan_image_upload", id, { year, quarter });
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

  // ─── Get image raw data ────────────────────────────────────────────────────
  async getImageData(id: string, user: UserPayload) {
    await this.ensureImagesTable();
    const rows = await this.clickhouse.query<any>(
      `SELECT userId, departmentId, mimeType, imageData FROM tailan_images WHERE id = {id:String} LIMIT 1`,
      { id },
    );
    if (!rows.length) throw new NotFoundException("Зураг олдсонгүй");

    const img = rows[0];
    const isOwner = String(img.userId) === user.id;
    const isDeptHeadAccess =
      this.isDeptHead(user) &&
      String(img.departmentId ?? "") === String(user.departmentId ?? "");
    const isAdmin = user.isAdmin || user.isSuperAdmin;

    if (!isOwner && !isDeptHeadAccess && !isAdmin) {
      throw new ForbiddenException("Эрх хүрэхгүй");
    }

    return {
      mimeType: img.mimeType,
      buffer: Buffer.from(img.imageData, "hex"),
    };
  }

  // ─── Delete image ──────────────────────────────────────────────────────────
  async deleteImage(id: string, userId: string) {
    await this.ensureImagesTable();
    await this.clickhouse.exec(
      `ALTER TABLE tailan_images DELETE WHERE id = {id:String} AND userId = {userId:String}`,
      { id, userId },
    );
    this.auditMutation(userId, "tailan_image_delete", id);
    return { message: "Устгагдлаа" };
  }

  // ─── Generate .docx for personal report (template-driven) ─────────────────
  async generateWord(
    userId: string,
    year: number,
    quarter: number,
    displayName?: string,
  ): Promise<Buffer> {
    const rows = await this.clickhouse.query<any>(
      `SELECT * FROM tailan_reports FINAL
       WHERE userId = {userId:String} AND year = {year:UInt16} AND quarter = {quarter:UInt8}
       ORDER BY updatedAt DESC LIMIT 1`,
      { userId, year, quarter },
    );

    if (rows.length === 0) throw new NotFoundException("Тайлан олдсонгүй");
    const report = this.parseReport(rows[0]);

    let position = "";
    let departmentName = "";
    let departmentId = "";
    try {
      const userRows = await this.clickhouse.query<any>(
        `SELECT u.position, u.departmentId, d.name as departmentName
         FROM users u LEFT JOIN departments d ON u.departmentId = d.id
         WHERE u.id = {uid:String} LIMIT 1`,
        { uid: userId },
      );
      if (userRows.length > 0) {
        position = userRows[0].position ?? "";
        departmentName = userRows[0].departmentName ?? "";
        departmentId = userRows[0].departmentId ?? "";
      }
    } catch {}

    const template = await this.tailanTemplates.getActive(
      departmentId,
      "employee",
    );
    return this.renderDocx(template, report.sectionsData, {
      userName: displayName || report.userName,
      userPosition: position,
      userDepartment: departmentName,
      year,
      quarter,
      hiddenSections: report.hiddenSections,
      dynamicSections: report.dynamicSections,
    });
  }

  // ─── Live "real docx" preview from unsaved editor state ───────────────────
  async previewWord(user: UserPayload, dto: SaveTailanDto): Promise<Buffer> {
    let position = "";
    let departmentName = "";
    try {
      const userRows = await this.clickhouse.query<any>(
        `SELECT u.position, d.name as departmentName
         FROM users u LEFT JOIN departments d ON u.departmentId = d.id
         WHERE u.id = {uid:String} LIMIT 1`,
        { uid: user.id },
      );
      if (userRows.length > 0) {
        position = userRows[0].position ?? "";
        departmentName = userRows[0].departmentName ?? "";
      }
    } catch {}

    const template = await this.tailanTemplates.getActive(
      user.departmentId,
      "employee",
    );
    return this.renderDocx(template, dto.sections ?? {}, {
      userName: user.name,
      userPosition: position,
      userDepartment: departmentName,
      year: dto.year,
      quarter: dto.quarter,
      hiddenSections: dto.hiddenSections,
      dynamicSections: dto.dynamicSections,
    });
  }

  // ─── Generate Word from editor-submitted merged data (dept BSC) ───────────
  async generateDeptWordFromData(body: any): Promise<Buffer> {
    return this.buildDeptDocxFromData(body);
  }

  // ─── Generic template-driven docx renderer ─────────────────────────────────
  // Replaces the previous ~750-line hardcoded buildDocx(): section titles,
  // columns, orientation and numbering are all driven by the active
  // TailanTemplate, so employee/department reports and admin-defined custom
  // templates all flow through the same 3 renderers (richtext/taskList/table).
  async renderDocx(
    template: TailanTemplate,
    sectionsData: Record<string, unknown>,
    meta: {
      userName: string;
      userPosition?: string;
      userDepartment?: string;
      year: number;
      quarter: number;
      hiddenSections?: string[];
      dynamicSections?: { order: number; title: string; content?: string }[];
    },
  ): Promise<Buffer> {
    const hidden = new Set<string>(meta.hiddenSections ?? []);
    const sortedSections = [...template.sections].sort(
      (a, b) => a.order - b.order,
    );
    const visibleMain = sortedSections.filter(
      (s) => s.headingLevel === "main" && !hidden.has(s.key),
    );
    const romanByKey = new Map<string, string>();
    visibleMain.forEach((s, i) =>
      romanByKey.set(s.key, ROMAN_NUMS[i] ?? `${i + 1}`),
    );

    const tblCounter = { n: 1 };
    const imgCounter = { n: 1 };

    type Chunk = { orientation: "portrait" | "landscape"; children: any[] };
    const chunks: Chunk[] = [];
    const pushChildren = (
      orientation: "portrait" | "landscape",
      nodes: any[],
    ) => {
      const last = chunks[chunks.length - 1];
      if (last && last.orientation === orientation)
        last.children.push(...nodes);
      else chunks.push({ orientation, children: [...nodes] });
    };

    // ── Cover title ────────────────────────────────────────────────────────
    const qName = ROMAN_NUMS[(meta.quarter - 1) % 4] ?? "I";
    const deptCode = deptAbbrev(meta.userDepartment ?? "");
    const positionUpper = (meta.userPosition ?? "").toUpperCase();
    const nameUpper = (meta.userName ?? "").toUpperCase();
    const titleText = `${deptCode ? `${deptCode}-НЫ ` : ""}${positionUpper}${positionUpper && nameUpper ? " " : ""}${nameUpper} ${meta.year} ОНЫ ${qName}-Р УЛИРЛЫН АЖЛЫН ТАЙЛАН`;
    pushChildren("portrait", [
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
    ]);

    // ── Sections, in template order ──────────────────────────────────────────
    for (const sec of sortedSections) {
      if (hidden.has(sec.key)) continue;
      const orientation = sec.orientation ?? "portrait";
      const heading =
        sec.headingLevel === "main"
          ? this.bigSectionHeading(`${romanByKey.get(sec.key)}. ${sec.titleMn}`)
          : this.subSectionHeading(`${sec.titleMn}:`);
      const nodes: any[] = [heading];
      if (sec.subtitleMn) nodes.push(this.subSectionHeading(sec.subtitleMn));

      const data = sectionsData?.[sec.key];
      if (sec.type === "richtext") {
        nodes.push(...this.renderRichTextSection(data as string));
      } else if (sec.type === "taskList") {
        nodes.push(
          ...this.renderTaskListSection(
            data as any[],
            sec.taskList ?? {},
            tblCounter,
            imgCounter,
          ),
        );
      } else if (sec.type === "table") {
        nodes.push(
          ...this.renderTableSection(
            data as any[],
            sec.table ?? { columns: [] },
            tblCounter,
          ),
        );
      }
      pushChildren(orientation, nodes);
    }

    // ── Dynamic (ad-hoc, user-added) sections — always appended, portrait ────
    const dynamicSecs = meta.dynamicSections ?? [];
    let dynIdx = visibleMain.length;
    dynamicSecs.forEach((sec, idx) => {
      if (hidden.has(`dyn_${idx}`)) return;
      const romNum = ROMAN_NUMS[dynIdx] ?? `${dynIdx + 1}`;
      dynIdx++;
      const nodes: any[] = [
        this.bigSectionHeading(`${romNum}. ${sec.title ?? ""}`),
      ];
      nodes.push(...this.renderRichTextSection(sec.content ?? ""));
      pushChildren("portrait", nodes);
    });

    const docSections = chunks.map((chunk, i) => ({
      properties: {
        type: i === 0 ? undefined : SectionType.NEXT_PAGE,
        page:
          chunk.orientation === "landscape"
            ? {
                size: {
                  width: 16838,
                  height: 11906,
                  orientation: PageOrientation.LANDSCAPE,
                },
                margin: { top: 902, bottom: 902, left: 1077, right: 1077 },
              }
            : {
                size: {
                  width: 11906,
                  height: 16838,
                  orientation: PageOrientation.PORTRAIT,
                },
                margin: { top: 902, bottom: 1259, left: 1440, right: 1077 },
              },
      },
      children: chunk.children,
    }));

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: "Times New Roman", size: 22 },
            paragraph: { spacing: { line: 276 } },
          },
        },
      },
      sections: docSections,
    });

    return Buffer.from(await Packer.toBuffer(doc));
  }

  // ── Section-type renderers ──────────────────────────────────────────────

  private renderRichTextSection(text?: string): Paragraph[] {
    const lines = (text ?? "").split("\n");
    const paras = lines.map((line) => this.bodyPara(line || " "));
    paras.push(new Paragraph({ text: "", spacing: { after: 200 } }));
    return paras;
  }

  private formatPeriod(period?: string): string {
    if (!period) return "";
    const [s, e] = period.split(" \u2013 ");
    const fmt = (d?: string) => (d ? d.replace(/-/g, ".") : "");
    if (!s && !e) return "";
    if (!e) return fmt(s);
    return `${fmt(s)}-${fmt(e)}`;
  }

  private tableCaption(counter: { n: number }) {
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 40, after: 160 },
      children: [
        new TextRun({
          text: `Хүснэгт ${counter.n++}.`,
          italics: true,
          size: 18,
          font: "Times New Roman",
        }),
      ],
    });
  }

  private renderTaskListSection(
    rows: any[] | undefined,
    config: {
      showCompletion?: boolean;
      showPeriod?: boolean;
      showDescription?: boolean;
      showImages?: boolean;
      titleLabel?: string;
      completionLabel?: string;
      periodLabel?: string;
      descriptionLabel?: string;
    },
    tblCounter: { n: number },
    imgCounter: { n: number },
  ): any[] {
    const list = Array.isArray(rows) ? rows : [];
    const headers = ["№", config.titleLabel || "Ажил"];
    const widths = [5, 35];
    if (config.showCompletion) {
      headers.push(config.completionLabel || "Гүйцэтгэл");
      widths.push(15);
    }
    if (config.showPeriod) {
      headers.push(config.periodLabel || "Хугацаа");
      widths.push(15);
    }
    if (config.showDescription) {
      headers.push(config.descriptionLabel || "Тайлбар");
      widths.push(100 - widths.reduce((a, b) => a + b, 0));
    }
    const dataRows: string[][] = list.map((t: any, i: number) => {
      const row = [`${i + 1}`, t?.title ?? ""];
      if (config.showCompletion) {
        row.push(
          t?.completion !== undefined && t?.completion !== ""
            ? `${t.completion}%`
            : "",
        );
      }
      if (config.showPeriod) row.push(this.formatPeriod(t?.period));
      if (config.showDescription) row.push(t?.description ?? "");
      return row;
    });
    const nodes: any[] = [
      this.buildDashedTable(headers, widths, dataRows, [], [0]),
    ];
    nodes.push(this.tableCaption(tblCounter));
    if (config.showImages !== false) {
      for (const t of list) {
        for (const img of t?.images ?? []) {
          nodes.push(
            ...this.inlineImageParas(
              img?.dataUrl,
              img?.width ?? 60,
              imgCounter,
              img?.height,
            ),
          );
        }
      }
    }
    nodes.push(new Paragraph({ text: "", spacing: { after: 120 } }));
    return nodes;
  }

  private renderTableSection(
    rows: any[] | undefined,
    config: {
      columns: {
        key: string;
        label: string;
        width?: number;
        numeric?: boolean;
      }[];
      averageColumnKey?: string;
    },
    tblCounter: { n: number },
  ): any[] {
    const list = Array.isArray(rows) ? rows : [];
    const cols = config.columns ?? [];
    const headers = ["№", ...cols.map((c) => c.label)];
    const numWidth = 5;
    const restWidth = 100 - numWidth;
    const widths = [
      numWidth,
      ...cols.map(
        (c) => c.width ?? Math.round(restWidth / Math.max(cols.length, 1)),
      ),
    ];
    const centerCols = [
      0,
      ...cols.map((c, i) => (c.numeric ? i + 1 : -1)).filter((i) => i >= 0),
    ];
    const dataRows: string[][] = list.map((row: any, i: number) => [
      `${i + 1}`,
      ...cols.map((c) =>
        row?.[c.key] !== undefined && row?.[c.key] !== null
          ? String(row[c.key])
          : "",
      ),
    ]);

    const extraRows: TableRow[] = [];
    if (config.averageColumnKey) {
      const colIdx = cols.findIndex((c) => c.key === config.averageColumnKey);
      if (colIdx >= 0) {
        const nums = list
          .map((r: any) =>
            parseFloat(String(r?.[config.averageColumnKey!] ?? "")),
          )
          .filter((n: number) => !isNaN(n));
        const avgText = nums.length
          ? `${Math.round(nums.reduce((a: number, b: number) => a + b, 0) / nums.length)}%`
          : "";
        const leadingSpan = colIdx + 1; // № + columns before the average column
        const trailingSpan = cols.length - colIdx - 1;
        const cells: TableCell[] = [
          new TableCell({
            columnSpan: leadingSpan,
            width: {
              size: widths.slice(0, leadingSpan).reduce((a, b) => a + b, 0),
              type: WidthType.PERCENTAGE,
            },
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
          this.tcNoB(avgText, widths[colIdx + 1], true),
        ];
        if (trailingSpan > 0) {
          cells.push(
            new TableCell({
              columnSpan: trailingSpan,
              width: {
                size: widths.slice(colIdx + 2).reduce((a, b) => a + b, 0),
                type: WidthType.PERCENTAGE,
              },
              margins: { top: 40, bottom: 40, left: 80, right: 80 },
              children: [
                new Paragraph({ children: [new TextRun({ text: "" })] }),
              ],
            }),
          );
        }
        extraRows.push(new TableRow({ children: cells }));
      }
    }

    const nodes: any[] = [
      this.buildDashedTable(headers, widths, dataRows, extraRows, centerCols),
    ];
    nodes.push(this.tableCaption(tblCounter));
    nodes.push(new Paragraph({ text: "", spacing: { after: 120 } }));
    return nodes;
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
