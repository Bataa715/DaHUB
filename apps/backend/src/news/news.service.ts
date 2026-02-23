import { Injectable, NotFoundException } from "@nestjs/common";
import { ClickHouseService } from "../clickhouse/clickhouse.service";
import { CreateNewsDto, UpdateNewsDto } from "./dto/news.dto";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class NewsService {
  constructor(private clickhouse: ClickHouseService) {}

  async create(createNewsDto: CreateNewsDto, authorId: string) {
    const id = uuidv4();
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");

    await this.clickhouse.insert("news", [
      {
        id,
        title: createNewsDto.title,
        content: createNewsDto.content,
        category: createNewsDto.category || "Ерөнхий",
        imageUrl: createNewsDto.imageUrl || "",
        authorId,
        isPublished: 1,
        views: 0,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    return { id, message: "Мэдээ амжилттай үүслээ" };
  }

  async findAll(published = true) {
    const filter = published ? "WHERE isPublished = 1" : "";
    const news = await this.clickhouse.query<any>(
      `SELECT n.*, u.name as authorName
       FROM news n 
       LEFT JOIN users u ON n.authorId = u.id
       ${filter}
       ORDER BY n.createdAt DESC`,
    );

    return news;
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

    return news[0];
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
      updates.push("imageUrl = {imageUrl:String}");
      params.imageUrl = updateNewsDto.imageUrl;
    }
    if (updateNewsDto.isPublished !== undefined) {
      updates.push("isPublished = {isPublished:UInt8}");
      params.isPublished = updateNewsDto.isPublished ? 1 : 0;
    }

    updates.push("updatedAt = {updatedAt:String}");
    params.updatedAt = new Date().toISOString().slice(0, 19).replace("T", " ");

    if (updates.length > 0) {
      await this.clickhouse.exec(
        `ALTER TABLE news UPDATE ${updates.join(", ")} WHERE id = {id:String}`,
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
      "ALTER TABLE news UPDATE isPublished = {isPublished:UInt8} WHERE id = {id:String}",
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

    return news;
  }
}
