import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { ClickHouseService, nowCH } from "../clickhouse/clickhouse.service";
import { CreateMedlegDto } from "./dto/medleg.dto";
import { randomUUID } from "crypto";

@Injectable()
export class MedlegService {
  constructor(private clickhouse: ClickHouseService) {}

  async create(createMedlegDto: CreateMedlegDto, authorId: string) {
    const id = randomUUID();
    const now = nowCH();

    let imageData = "";
    let imageMime = "";
    if (createMedlegDto.imageUrl?.startsWith("data:")) {
      // [M-6] Server-side MIME whitelist — reject SVG (XSS via embedded <script>)
      // and any non-raster format.
      const matches = createMedlegDto.imageUrl.match(
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

    await this.clickhouse.insert("medleg", [
      {
        id,
        title: createMedlegDto.title,
        content: createMedlegDto.content ?? "",
        category: createMedlegDto.category || "Аудит",
        imageUrl: imageData,
        imageMime,
        authorId,
        isPublished: 1,
        views: 0,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    return { id, message: "Мэдлэг амжилттай үүслээ" };
  }

  async findAll(published = true, limit = 100, offset = 0) {
    const filter = published ? "WHERE isPublished = 1" : "";
    const items = await this.clickhouse.query<any>(
      `SELECT n.id, n.title, n.content, n.category,
              notEmpty(n.imageUrl) AS hasImage,
              n.authorId, n.isPublished, n.views, n.createdAt, n.updatedAt,
              u.name as authorName
       FROM medleg AS n
       LEFT JOIN users u ON n.authorId = u.id
       ${filter}
       ORDER BY n.views DESC, n.createdAt DESC
       LIMIT {limit:UInt32} OFFSET {offset:UInt32}`,
      { limit, offset },
    );

    return items.map((n) => ({
      ...n,
      imageUrl: Number(n.hasImage) ? `/medleg/${n.id}/image` : "",
    }));
  }

  async findOne(id: string, userId?: string) {
    const items = await this.clickhouse.query<any>(
      `SELECT n.id, n.title, n.content, n.category,
              notEmpty(n.imageUrl) AS hasImage,
              n.authorId, n.isPublished, n.views, n.createdAt, n.updatedAt,
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

    // Only increment view count once per user per article
    if (userId) {
      const alreadyViewed = await this.clickhouse
        .query<{ cnt: string }>(
          `SELECT count() as cnt FROM medleg_views
           WHERE newsId = {newsId:String} AND userId = {userId:String}`,
          { newsId: id, userId },
        )
        .catch(() => [{ cnt: "1" }]); // on error, assume already viewed

      if (Number(alreadyViewed?.[0]?.cnt ?? 0) === 0) {
        this.clickhouse
          .insert("medleg_views", [{ newsId: id, userId, viewedAt: nowCH() }])
          .catch(() => {});
        this.clickhouse
          .exec(
            "ALTER TABLE medleg UPDATE views = views + 1 WHERE id = {id:String}",
            { id },
          )
          .catch(() => {});
      }
    }

    const n = items[0];
    return {
      ...n,
      imageUrl: Number(n.hasImage) ? `/medleg/${n.id}/image` : "",
    };
  }

  async removeByOwner(id: string, userId: string) {
    const existing = await this.clickhouse.query<any>(
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

  async getMedlegImage(
    id: string,
  ): Promise<{ buffer: Buffer; mimeType: string } | null> {
    // Дотоод мэдлэг — нийтлэгдсэн нийтлэлийн зургийг бүх нэвтэрсэн ажилтан харна.
    const rows = await this.clickhouse.query<any>(
      `SELECT imageUrl, imageMime FROM medleg
       WHERE id = {id:String} AND isPublished = 1 LIMIT 1`,
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
              count() AS medlegCount,
              sum(n.views) AS totalViews
       FROM medleg AS n
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
      medlegCount: Number(r.medlegCount),
      totalViews: Number(r.totalViews),
    }));
  }

  async getReactions(newsId: string, userId: string) {
    const rows = await this.clickhouse.query<any>(
      `SELECT emoji, count() as cnt FROM medleg_reactions FINAL
       WHERE newsId = {newsId:String}
       GROUP BY emoji`,
      { newsId },
    );
    const myRow = await this.clickhouse.query<any>(
      `SELECT emoji FROM medleg_reactions FINAL
       WHERE newsId = {newsId:String} AND userId = {userId:String}
       LIMIT 1`,
      { newsId, userId },
    );
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.emoji] = Number(r.cnt);
    return { counts, myReaction: myRow[0]?.emoji ?? null };
  }

  async react(newsId: string, userId: string, emoji: string) {
    const ALLOWED = ["👍", "❤️", "😮", "💡", "🔥"];
    if (!ALLOWED.includes(emoji))
      throw new BadRequestException("Invalid emoji");
    await this.clickhouse.insert("medleg_reactions", [
      { newsId, userId, emoji, createdAt: nowCH() },
    ]);
    return { ok: true };
  }

  async removeReaction(newsId: string, userId: string) {
    await this.clickhouse.exec(
      `ALTER TABLE medleg_reactions DELETE WHERE newsId = {newsId:String} AND userId = {userId:String}`,
      { newsId, userId },
    );
    return { ok: true };
  }

  async getComments(newsId: string) {
    return this.clickhouse.query<any>(
      `SELECT id, newsId, authorId, authorName, content, createdAt
       FROM medleg_comments
       WHERE newsId = {newsId:String}
       ORDER BY createdAt ASC`,
      { newsId },
    );
  }

  async addComment(
    newsId: string,
    authorId: string,
    authorName: string,
    content: string,
  ) {
    if (!content?.trim())
      throw new BadRequestException("Comment cannot be empty");
    if (content.length > 1000)
      throw new BadRequestException("Comment too long");
    const id = randomUUID();
    await this.clickhouse.insert("medleg_comments", [
      {
        id,
        newsId,
        authorId,
        authorName,
        content: content.trim(),
        createdAt: nowCH(),
      },
    ]);
    return { id, ok: true };
  }

  async deleteComment(commentId: string, userId: string) {
    const rows = await this.clickhouse.query<any>(
      `SELECT id, authorId FROM medleg_comments WHERE id = {id:String} LIMIT 1`,
      { id: commentId },
    );
    if (!rows || rows.length === 0)
      throw new NotFoundException("Comment not found");
    if (rows[0].authorId !== userId)
      throw new BadRequestException("Not your comment");
    await this.clickhouse.exec(
      `ALTER TABLE medleg_comments DELETE WHERE id = {id:String}`,
      { id: commentId },
    );
    return { ok: true };
  }
}
