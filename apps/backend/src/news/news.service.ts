import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { ClickHouseService, nowCH } from "../clickhouse/clickhouse.service";
import { CreateNewsDto, UpdateNewsDto } from "./dto/news.dto";
import { randomUUID } from "crypto";

@Injectable()
export class NewsService {
  constructor(private clickhouse: ClickHouseService) {}

  async create(createNewsDto: CreateNewsDto, authorId: string) {
    const id = randomUUID();
    const now = nowCH();

    let imageData = "";
    let imageMime = "";
    if (createNewsDto.imageUrl?.startsWith("data:")) {
      // [M-6] Server-side MIME whitelist — reject SVG (XSS via embedded <script>)
      // and any non-raster format.
      const matches = createNewsDto.imageUrl.match(
        /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/,
      );
      if (!matches) {
        throw new BadRequestException(
          "Зөвхөн jpeg|png|webp|gif форматын зураг хүлээн авна",
        );
      }
      imageMime = matches[1];
      imageData = matches[2];
      // ~5MB limit on raw base64 payload
      if (imageData.length > 7_000_000) {
        throw new BadRequestException(
          "Зургийн хэмжээ хэт их байна (дээд тал 5MB)",
        );
      }
    }

    await this.clickhouse.insert("news", [
      {
        id,
        title: createNewsDto.title,
        content: createNewsDto.content,
        category: createNewsDto.category || "Ерөнхий",
        imageUrl: imageData,
        imageMime,
        authorId,
        isPublished: 1,
        views: 0,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    return { id, message: "Мэдээ амжилттай үүслээ" };
  }

  async findAll(published = true, limit = 100, offset = 0) {
    const filter = published ? "WHERE isPublished = 1" : "";
    const news = await this.clickhouse.query<any>(
      `SELECT n.id, n.title, n.content, n.category,
              notEmpty(n.imageUrl) AS hasImage,
              n.authorId, n.isPublished, n.views, n.createdAt, n.updatedAt,
              u.name as authorName
       FROM news AS n
       LEFT JOIN users u ON n.authorId = u.id
       ${filter}
       ORDER BY n.createdAt DESC
       LIMIT {limit:UInt32} OFFSET {offset:UInt32}`,
      { limit, offset },
    );

    return news.map((n) => ({
      ...n,
      imageUrl: Number(n.hasImage) ? `/news/${n.id}/image` : "",
    }));
  }

  async findOne(id: string) {
    const news = await this.clickhouse.query<any>(
      `SELECT n.id, n.title, n.content, n.category,
              notEmpty(n.imageUrl) AS hasImage,
              n.authorId, n.isPublished, n.views, n.createdAt, n.updatedAt,
              u.name as authorName
       FROM news AS n
       LEFT JOIN users u ON n.authorId = u.id
       WHERE n.id = {id:String} AND n.isPublished = 1
       LIMIT 1`,
      { id },
    );

    if (!news || news.length === 0) {
      throw new NotFoundException("Мэдээ олдсонгүй");
    }

    // Increment view count (fire-and-forget – don't block the response)
    this.clickhouse
      .exec(
        "ALTER TABLE news UPDATE views = views + 1 WHERE id = {id:String}",
        { id },
      )
      .catch(() => {
        /* non-critical */
      });

    const n = news[0];
    return { ...n, imageUrl: Number(n.hasImage) ? `/news/${n.id}/image` : "" };
  }

  // [N-4] requesterId + isAdmin required — only the author or an admin may edit a news item
  async update(
    id: string,
    updateNewsDto: UpdateNewsDto,
    requesterId: string,
    isAdmin: boolean,
  ) {
    const existing = await this.clickhouse.query<any>(
      `SELECT id, authorId FROM news WHERE id = {id:String} LIMIT 1`,
      { id },
    );

    if (!existing || existing.length === 0) {
      throw new NotFoundException("Мэдээ олдсонгүй");
    }

    // [N-4] Ownership check
    if (!isAdmin && existing[0].authorId !== requesterId) {
      throw new ForbiddenException("Зөвхөн нийтлэлийн зохиогч эсвэл админ засварлах боломжтой");
    }

    // Image update: base64 data is too large for ClickHouse HTTP bound params.
    // Base64 chars are [A-Za-z0-9+/=] only — safe to embed directly in SQL.
    if (updateNewsDto.imageUrl !== undefined) {
      if (updateNewsDto.imageUrl.startsWith("data:")) {
        // Guard against huge payloads before running regex (ReDoS / memory protection)
        if (updateNewsDto.imageUrl.length > 5_000_000) {
          throw new BadRequestException(
            "Зурагны хэмжээ хэт их байна (дээд тал нь 5MB)",
          );
        }
        const matches = updateNewsDto.imageUrl.match(
          /^data:([^;]{1,100});base64,([A-Za-z0-9+/=]+)$/,
        );
        if (matches) {
          const imageData = matches[2];
          const imageMime = matches[1];
          // H-5: Strict MIME whitelist — reject text/html, image/svg+xml, etc.
          // A permissive regex like /^[a-zA-Z0-9.+/-]+$/ still allows dangerous types.
          const ALLOWED_IMAGE_MIMES = [
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",
          ];
          if (!ALLOWED_IMAGE_MIMES.includes(imageMime)) {
            // [N-5] Reject disallowed MIME types explicitly instead of silently ignoring
            throw new BadRequestException(
              "Зөвшөөрөгдөөгүй зургийн формат. Зөвхөн JPEG, PNG, GIF, WebP зөвшөөрнө.",
            );
          }
          if (/^[A-Za-z0-9+/=]+$/.test(imageData)) {
            await this.clickhouse.exec(
              `ALTER TABLE news UPDATE imageUrl = {imageUrl:String}, imageMime = {imageMime:String} WHERE id = {id:String}`,
              { imageUrl: imageData, imageMime, id },
            );
          }
        }
      } else {
        // Clear image
        await this.clickhouse.exec(
          `ALTER TABLE news UPDATE imageUrl = '', imageMime = '' WHERE id = {id:String}`,
          { id },
        );
      }
    }

    // Non-image field updates — small values, safe as bound params
    const updates: string[] = [];
    const params: Record<string, any> = { id };

    if (updateNewsDto.title) {
      updates.push("title = {title:String}");
      params.title = updateNewsDto.title;
    }
    if (updateNewsDto.content) {
      updates.push("content = {content:String}");
      params.content = updateNewsDto.content;
    }
    if (updateNewsDto.category) {
      updates.push("category = {category:String}");
      params.category = updateNewsDto.category;
    }
    if (updateNewsDto.isPublished !== undefined) {
      updates.push("isPublished = {isPublished:UInt8}");
      params.isPublished = updateNewsDto.isPublished ? 1 : 0;
    }

    updates.push("updatedAt = {updatedAt:String}");
    params.updatedAt = nowCH();

    await this.clickhouse.exec(
      `ALTER TABLE news UPDATE ${updates.join(", ")} WHERE id = {id:String}`,
      params,
    );

    return { message: "Мэдээ амжилттай шинэчлэгдлээ" };
  }

  async remove(id: string) {
    const existing = await this.clickhouse.query<any>(
      `SELECT id FROM news WHERE id = {id:String} LIMIT 1`,
      { id },
    );

    if (!existing || existing.length === 0) {
      throw new NotFoundException("Мэдээ олдсонгүй");
    }

    await this.clickhouse.exec(
      "ALTER TABLE news DELETE WHERE id = {id:String}",
      { id },
    );

    return { message: "Мэдээ амжилттай устгагдлаа" };
  }

  async removeByOwner(id: string, userId: string) {
    const existing = await this.clickhouse.query<any>(
      `SELECT id, authorId FROM news WHERE id = {id:String} LIMIT 1`,
      { id },
    );

    if (!existing || existing.length === 0) {
      throw new NotFoundException("Мэдээ олдсонгүй");
    }

    if (existing[0].authorId !== userId) {
      throw new BadRequestException("Зөвхөн өөрийн мэдээг устгах боломжтой");
    }

    await this.clickhouse.exec(
      "ALTER TABLE news DELETE WHERE id = {id:String}",
      { id },
    );

    return { message: "Мэдээ амжилттай устгагдлаа" };
  }

  async togglePublish(id: string) {
    const news = await this.clickhouse.query<any>(
      `SELECT isPublished FROM news WHERE id = {id:String} LIMIT 1`,
      { id },
    );

    if (!news || news.length === 0) {
      throw new NotFoundException("Мэдээ олдсонгүй");
    }

    const newStatus = news[0].isPublished ? 0 : 1;
    await this.clickhouse.exec(
      "ALTER TABLE news UPDATE isPublished = {isPublished:UInt8} WHERE id = {id:String}",
      { id, isPublished: newStatus },
    );

    return { message: newStatus ? "Мэдээ нийтлэгдлээ" : "Мэдээ нуугдлаа" };
  }

  async getByCategory(category: string, limit = 100, offset = 0) {
    const news = await this.clickhouse.query<any>(
      `SELECT n.id, n.title, n.content, n.category,
              notEmpty(n.imageUrl) AS hasImage,
              n.authorId, n.isPublished, n.views, n.createdAt, n.updatedAt,
              u.name as authorName
       FROM news AS n
       LEFT JOIN users u ON n.authorId = u.id
       WHERE n.category = {category:String} AND n.isPublished = 1
       ORDER BY n.createdAt DESC
       LIMIT {limit:UInt32} OFFSET {offset:UInt32}`,
      { category, limit: Math.min(limit, 200), offset },
    );

    return news.map((n) => ({
      ...n,
      imageUrl: Number(n.hasImage) ? `/news/${n.id}/image` : "",
    }));
  }

  async getNewsImage(
    id: string,
  ): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const rows = await this.clickhouse.query<any>(
      `SELECT imageUrl, imageMime FROM news WHERE id = {id:String} LIMIT 1`,
      { id },
    );
    if (!rows || rows.length === 0 || !rows[0].imageUrl) return null;
    // H-5: Enforce MIME whitelist on serve — a previously stored unsafe MIME
    // must not be served even if it passed an earlier (weaker) validation.
    const ALLOWED_IMAGE_MIMES = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    const storedMime = rows[0].imageMime;
    const mimeType = ALLOWED_IMAGE_MIMES.includes(storedMime)
      ? storedMime
      : "image/jpeg";
    const buffer = Buffer.from(rows[0].imageUrl, "base64");
    return { buffer, mimeType };
  }

  async getTopPublishers() {
    const rows = await this.clickhouse.query<any>(
      `SELECT n.authorId,
              u.name AS authorName,
              count() AS newsCount,
              sum(n.views) AS totalViews
       FROM news AS n
       LEFT JOIN users u ON n.authorId = u.id
       WHERE n.isPublished = 1
       GROUP BY n.authorId, u.name
       ORDER BY totalViews DESC
       LIMIT 50`,
      {},
    );
    return rows.map((r: any, i: number) => ({
      rank: i + 1,
      authorId: r.authorId,
      authorName: r.authorName || "Unknown",
      newsCount: Number(r.newsCount),
      totalViews: Number(r.totalViews),
    }));
  }
}
