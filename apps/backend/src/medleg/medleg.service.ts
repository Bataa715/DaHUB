import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { ClickHouseService, nowCH } from "../clickhouse/clickhouse.service";
import { assertRealImage } from "../common/utils/image-signature";
import { CreateMedlegDto, UpdateMedlegDto } from "./dto/medleg.dto";
import { randomUUID } from "crypto";
import sanitizeHtml from "sanitize-html";
import type { MedlegDbRow } from "../common/types/db-rows";

/** Жагсаалтын мөр — зургийн өгөгдөлгүй (hasImage), зохиогчийн нэртэй */
type MedlegListRow = Omit<MedlegDbRow, "imageUrl" | "imageMime"> & {
  hasImage: number;
  authorName: string | null;
};

// [MED-3] Client-side DOMPurify (knowledge/page.tsx) is not a security
// boundary — anything hitting this API directly (curl, another client,
// a future consumer) bypasses it entirely. Sanitize rich-text HTML on the
// server too, mirroring the client's allowlist, so stored XSS isn't possible
// via this endpoint regardless of caller.
const RICH_TEXT_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "b",
    "i",
    "u",
    "s",
    "strong",
    "em",
    "span",
    "div",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "blockquote",
    "a",
    "img",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "hr",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "width", "height"],
    "*": ["style", "class"],
  },
  allowedSchemes: ["http", "https", "data", "mailto"],
  allowedSchemesByTag: { img: ["http", "https", "data"] },
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
  },
};

function sanitizeRichText(html: string): string {
  return sanitizeHtml(html ?? "", RICH_TEXT_SANITIZE_OPTIONS);
}

@Injectable()
export class MedlegService {
  constructor(private clickhouse: ClickHouseService) {}

  /**
   * data: URI хэлбэрийн зургийг парслаж, MIME whitelist шалгана.
   * create/update хоёуланд ашиглагдана — [M-6] SVG (embedded <script>) болон
   * бусад раастар бус форматыг зөвшөөрөхгүй.
   */
  private parseImageDataUrl(imageUrl: string): {
    imageData: string;
    imageMime: string;
  } {
    const matches = imageUrl.match(
      /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/,
    );
    if (!matches) {
      throw new BadRequestException(
        "Зөвхөн jpeg|png|webp|gif форматын зураг хүлээн авна",
      );
    }
    const imageMime = matches[1];
    const imageData = matches[2];
    // ~5MB limit on raw base64 payload
    if (imageData.length > 7_000_000) {
      throw new BadRequestException(
        "Зургийн хэмжээ хэт их байна (дээд тал 5MB)",
      );
    }
    // [AUDIT] `data:image/...` угтвар нь клиентээс ирдэг тул түүнд итгэхгүй —
    // decode хийж байтын гарын үсгээр бодит төрлийг шалгана.
    assertRealImage(Buffer.from(imageData, "base64"), imageMime);
    return { imageData, imageMime };
  }

  /** Create/update-д ирсэн нэг эсвэл олон data URI-г нормчлоно (хамгийн ихдээ 5). */
  private collectImages(dto: {
    imageUrl?: string;
    imageUrls?: string[];
  }): Array<{ imageData: string; imageMime: string }> {
    const raw = [
      ...(Array.isArray(dto.imageUrls) ? dto.imageUrls : []),
      ...(dto.imageUrl ? [dto.imageUrl] : []),
    ]
      .map((u) => String(u ?? "").trim())
      .filter((u) => u.startsWith("data:"));

    const seen = new Set<string>();
    const out: Array<{ imageData: string; imageMime: string }> = [];
    for (const u of raw) {
      if (seen.has(u)) continue;
      seen.add(u);
      out.push(this.parseImageDataUrl(u));
      if (out.length >= 5) break;
    }
    return out;
  }

  private parseImagesJson(
    raw: unknown,
  ): Array<{ imageData: string; imageMime: string }> {
    if (!raw || typeof raw !== "string" || raw === "[]") return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(
          (x) =>
            x &&
            typeof x.imageData === "string" &&
            typeof x.imageMime === "string" &&
            x.imageData.length > 0,
        )
        .slice(0, 5);
    } catch {
      return [];
    }
  }

  private imagePathsFor(id: string, count: number): string[] {
    if (count <= 0) return [];
    return Array.from({ length: count }, (_, i) =>
      i === 0 ? `/medleg/${id}/image` : `/medleg/${id}/images/${i}`,
    );
  }

  private resolveImageList(row: {
    id: string;
    imageUrl?: string;
    imageMime?: string;
    imagesJson?: string;
    hasImage?: unknown;
  }): { imageUrl: string; imageUrls: string[] } {
    const fromJson = this.parseImagesJson(row.imagesJson);
    let count = fromJson.length;
    if (count === 0 && (row.imageUrl || Number(row.hasImage))) {
      count = 1;
    }
    const paths = this.imagePathsFor(row.id, count);
    return {
      imageUrl: paths[0] ?? "",
      imageUrls: paths,
    };
  }

  async create(createMedlegDto: CreateMedlegDto, authorId: string) {
    const id = randomUUID();
    const now = nowCH();
    const images = this.collectImages(createMedlegDto);
    const first = images[0];

    await this.clickhouse.insert("medleg", [
      {
        id,
        title: createMedlegDto.title,
        content: sanitizeRichText(createMedlegDto.content ?? ""),
        category: createMedlegDto.category || "General knowledge",
        imageUrl: first?.imageData ?? "",
        imageMime: first?.imageMime ?? "",
        imagesJson: JSON.stringify(images),
        authorId,
        isPublished: 1,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    return { id, message: "Мэдлэг амжилттай үүслээ" };
  }

  async findAll(published = true, limit = 100, offset = 0) {
    const filter = published ? "WHERE isPublished = 1" : "";
    const items = await this.clickhouse.query<MedlegListRow>(
      `SELECT n.id, n.title, n.content, n.category,
              notEmpty(n.imageUrl) AS hasImage,
              n.imagesJson,
              n.authorId, n.isPublished, n.createdAt, n.updatedAt,
              u.name as authorName
       FROM medleg AS n
       LEFT JOIN users u ON n.authorId = u.id
       ${filter}
       ORDER BY n.createdAt DESC
       LIMIT {limit:UInt32} OFFSET {offset:UInt32}`,
      { limit, offset },
    );

    return items.map((n) => {
      const { imageUrl, imageUrls } = this.resolveImageList(n);
      return {
        ...n,
        imagesJson: undefined,
        imageUrl,
        imageUrls,
      };
    });
  }

  /** Админ: нийтлэгдсэн/нийтлэгдээгүй бүх мэдлэгийг харна (жагсаалт, удирдлагын зорилготой). */
  async findAllAdmin(limit = 200, offset = 0) {
    const items = await this.clickhouse.query<MedlegListRow>(
      `SELECT n.id, n.title, n.content, n.category,
              notEmpty(n.imageUrl) AS hasImage,
              n.imagesJson,
              n.authorId, n.isPublished, n.createdAt, n.updatedAt,
              u.name as authorName
       FROM medleg AS n
       LEFT JOIN users u ON n.authorId = u.id
       ORDER BY n.createdAt DESC
       LIMIT {limit:UInt32} OFFSET {offset:UInt32}`,
      { limit, offset },
    );

    return items.map((n) => {
      const { imageUrl, imageUrls } = this.resolveImageList(n);
      return {
        ...n,
        isPublished: !!Number(n.isPublished),
        imagesJson: undefined,
        imageUrl,
        imageUrls,
      };
    });
  }

  async findOne(id: string) {
    const items = await this.clickhouse.query<MedlegListRow>(
      `SELECT n.id, n.title, n.content, n.category,
              notEmpty(n.imageUrl) AS hasImage,
              n.imagesJson,
              n.authorId, n.isPublished, n.createdAt, n.updatedAt,
              u.name as authorName
       FROM medleg AS n
       LEFT JOIN users u ON n.authorId = u.id
       WHERE n.id = {id:String} AND n.isPublished = 1
       LIMIT 1`,
      { id },
    );

    if (!items || items.length === 0) {
      throw new NotFoundException("Мэдлэг олдсонгүй");
    }

    const n = items[0];
    const { imageUrl, imageUrls } = this.resolveImageList(n);
    return {
      ...n,
      imagesJson: undefined,
      imageUrl,
      imageUrls,
    };
  }

  async removeByOwner(id: string, userId: string) {
    const existing = await this.clickhouse.query<{ id: string; authorId: string }>(
      `SELECT id, authorId FROM medleg WHERE id = {id:String} LIMIT 1`,
      { id },
    );

    if (!existing || existing.length === 0) {
      throw new NotFoundException("Мэдлэг олдсонгүй");
    }

    if (existing[0].authorId !== userId) {
      throw new BadRequestException("Зөвхөн өөрийн мэдлэгийг устгах боломжтой");
    }

    await this.clickhouse.exec(
      "ALTER TABLE medleg DELETE WHERE id = {id:String}",
      { id },
    );

    return { message: "Мэдлэг амжилттай устгагдлаа" };
  }

  /** Админ: эзэмшигчээс үл хамааран мэдлэгийн нийтлэлийг устгана. */
  async removeAsAdmin(id: string) {
    const existing = await this.clickhouse.query<{ id: string }>(
      `SELECT id FROM medleg WHERE id = {id:String} LIMIT 1`,
      { id },
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException("Мэдлэг олдсонгүй");
    }
    await this.clickhouse.exec(
      "ALTER TABLE medleg DELETE WHERE id = {id:String}",
      { id },
    );
    return { message: "Мэдлэг амжилттай устгагдлаа" };
  }

  /** Админ: мэдлэгийн нийтлэлийг засах (эзэмшигчээс үл хамааран). */
  async update(id: string, dto: UpdateMedlegDto) {
    const existing = await this.clickhouse.query<MedlegDbRow>(
      `SELECT * FROM medleg WHERE id = {id:String} LIMIT 1`,
      { id },
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException("Мэдлэг олдсонгүй");
    }
    const row = existing[0];

    let imageData = row.imageUrl ?? "";
    let imageMime = row.imageMime ?? "";
    let imagesJson = row.imagesJson ?? "[]";

    const hasImageField =
      dto.imageUrls !== undefined || dto.imageUrl !== undefined;
    if (hasImageField) {
      const clearing =
        (Array.isArray(dto.imageUrls) && dto.imageUrls.length === 0) ||
        dto.imageUrl === "";
      if (clearing && !dto.imageUrls?.length && dto.imageUrl === "") {
        imageData = "";
        imageMime = "";
        imagesJson = "[]";
      } else {
        const images = this.collectImages(dto);
        if (images.length > 0) {
          imageData = images[0].imageData;
          imageMime = images[0].imageMime;
          imagesJson = JSON.stringify(images);
        } else if (dto.imageUrl === "") {
          imageData = "";
          imageMime = "";
          imagesJson = "[]";
        }
      }
    }

    const nextRow = {
      id: row.id,
      title: dto.title !== undefined ? dto.title : row.title,
      content:
        dto.content !== undefined ? sanitizeRichText(dto.content) : row.content,
      category: dto.category !== undefined ? dto.category : row.category,
      imageUrl: imageData,
      imageMime,
      imagesJson,
      authorId: row.authorId,
      isPublished:
        dto.isPublished !== undefined
          ? dto.isPublished
            ? 1
            : 0
          : Number(row.isPublished) || 0,
      createdAt: row.createdAt,
      updatedAt: nowCH(),
    };

    await this.clickhouse.replaceRows("medleg", "id = {id:String}", { id }, [
      nextRow,
    ]);

    return { id, message: "Мэдлэг амжилттай шинэчлэгдлээ" };
  }

  async getMedlegImage(
    id: string,
    index = 0,
  ): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const rows = await this.clickhouse.query<Pick<MedlegDbRow, "imageUrl" | "imageMime" | "imagesJson">>(
      `SELECT imageUrl, imageMime, imagesJson FROM medleg
       WHERE id = {id:String} AND isPublished = 1 LIMIT 1`,
      { id },
    );
    if (!rows || rows.length === 0) return null;

    const ALLOWED_IMAGE_MIMES = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];

    const fromJson = this.parseImagesJson(rows[0].imagesJson);
    let imageData = "";
    let imageMime = "image/jpeg";

    if (fromJson.length > 0) {
      const img = fromJson[index];
      if (!img) return null;
      imageData = img.imageData;
      imageMime = img.imageMime;
    } else if (index === 0 && rows[0].imageUrl) {
      imageData = rows[0].imageUrl;
      imageMime = rows[0].imageMime || "image/jpeg";
    } else {
      return null;
    }

    const mimeType = ALLOWED_IMAGE_MIMES.includes(imageMime)
      ? imageMime
      : "image/jpeg";
    const buffer = Buffer.from(imageData, "base64");
    return { buffer, mimeType };
  }
}
