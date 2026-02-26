import { Injectable, NotFoundException } from "@nestjs/common";
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
      const matches = createNewsDto.imageUrl.match(
        /^data:([^;]+);base64,(.+)$/,
      );
      if (matches) {
        imageMime = matches[1];
        imageData = matches[2];
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
      `SELECT n.*, u.name as authorName
       FROM news n 
       LEFT JOIN users u ON n.authorId = u.id
       ${filter}
       ORDER BY n.createdAt DESC
       LIMIT {limit:UInt32} OFFSET {offset:UInt32}`,
      { limit, offset },
    );

    return news.map((n) => ({
      ...n,
      imageUrl: n.imageUrl ? `/news/${n.id}/image` : "",
    }));
  }

  async findOne(id: string) {
    const news = await this.clickhouse.query<any>(
      `SELECT n.*, u.name as authorName
       FROM news n 
       LEFT JOIN users u ON n.authorId = u.id
       WHERE n.id = {id:String}
       LIMIT 1`,
      { id },
    );

    if (!news || news.length === 0) {
      throw new NotFoundException("Мэдээ олдсонгүй");
    }

    // Increment view count
    await this.clickhouse.exec(
      "ALTER TABLE news UPDATE views = views + 1 WHERE id = {id:String}",
      { id },
    );

    const n = news[0];
    return { ...n, imageUrl: n.imageUrl ? `/news/${n.id}/image` : "" };
  }

  async update(id: string, updateNewsDto: UpdateNewsDto) {
    const existing = await this.clickhouse.query<any>(
      `SELECT id FROM news WHERE id = {id:String} LIMIT 1`,
      { id },
    );

    if (!existing || existing.length === 0) {
      throw new NotFoundException("Мэдээ олдсонгүй");
    }

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
    if (updateNewsDto.imageUrl !== undefined) {
      if (updateNewsDto.imageUrl.startsWith("data:")) {
        const matches = updateNewsDto.imageUrl.match(
          /^data:([^;]+);base64,(.+)$/,
        );
        if (matches) {
          updates.push("imageUrl = {imageUrl:String}");
          updates.push("imageMime = {imageMime:String}");
          params.imageUrl = matches[2];
          params.imageMime = matches[1];
        }
      } else {
        updates.push("imageUrl = {imageUrl:String}");
        updates.push("imageMime = {imageMime:String}");
        params.imageUrl = "";
        params.imageMime = "";
      }
    }
    if (updateNewsDto.isPublished !== undefined) {
      updates.push("isPublished = {isPublished:UInt8}");
      params.isPublished = updateNewsDto.isPublished ? 1 : 0;
    }

    updates.push("updatedAt = {updatedAt:String}");
    params.updatedAt = nowCH();

    if (updates.length > 0) {
      await this.clickhouse.exec(
        `ALTER TABLE news UPDATE ${updates.join(", ")} WHERE id = {id:String} SETTINGS mutations_sync=1`,
        params,
      );
    }

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
      "ALTER TABLE news UPDATE isPublished = {isPublished:UInt8} WHERE id = {id:String} SETTINGS mutations_sync=1",
      { id, isPublished: newStatus },
    );

    return { message: newStatus ? "Мэдээ нийтлэгдлээ" : "Мэдээ нуугдлаа" };
  }

  async getByCategory(category: string) {
    const news = await this.clickhouse.query<any>(
      `SELECT n.*, u.name as authorName
       FROM news n 
       LEFT JOIN users u ON n.authorId = u.id
       WHERE n.category = {category:String} AND n.isPublished = 1
       ORDER BY n.createdAt DESC`,
      { category },
    );

    return news.map((n) => ({
      ...n,
      imageUrl: n.imageUrl ? `/news/${n.id}/image` : "",
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
    const mimeType = rows[0].imageMime || "image/jpeg";
    const buffer = Buffer.from(rows[0].imageUrl, "base64");
    return { buffer, mimeType };
  }
}
