import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { ClickHouseService, nowCH } from "../clickhouse/clickhouse.service";
import { CreateNewsDto } from "./dto/news.dto";
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
        category: createNewsDto.category || "Аудит",
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
       ORDER BY n.views DESC, n.createdAt DESC
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

  async getReactions(newsId: string, userId: string) {
    const rows = await this.clickhouse.query<any>(
      `SELECT emoji, count() as cnt FROM news_reactions
       WHERE newsId = {newsId:String}
       GROUP BY emoji`,
      { newsId },
    );
    const myRow = await this.clickhouse.query<any>(
      `SELECT emoji FROM news_reactions
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
    await this.clickhouse.insert("news_reactions", [
      { newsId, userId, emoji, createdAt: nowCH() },
    ]);
    return { ok: true };
  }

  async removeReaction(newsId: string, userId: string) {
    await this.clickhouse.exec(
      `ALTER TABLE news_reactions DELETE WHERE newsId = {newsId:String} AND userId = {userId:String}`,
      { newsId, userId },
    );
    return { ok: true };
  }

  async getComments(newsId: string) {
    return this.clickhouse.query<any>(
      `SELECT id, newsId, authorId, authorName, content, createdAt
       FROM news_comments
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
    await this.clickhouse.insert("news_comments", [
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
      `SELECT id, authorId FROM news_comments WHERE id = {id:String} LIMIT 1`,
      { id: commentId },
    );
    if (!rows || rows.length === 0)
      throw new NotFoundException("Comment not found");
    if (rows[0].authorId !== userId)
      throw new BadRequestException("Not your comment");
    await this.clickhouse.exec(
      `ALTER TABLE news_comments DELETE WHERE id = {id:String}`,
      { id: commentId },
    );
    return { ok: true };
  }
}
