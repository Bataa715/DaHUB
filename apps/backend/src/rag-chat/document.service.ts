import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EmbeddingService } from "./embedding.service";
import { VectorStoreService } from "./vector-store.service";
import { DocumentChunk } from "./types";
import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);
  private uploadDir: string;
  private trainingDir: string;

  constructor(
    private configService: ConfigService,
    private embeddingService: EmbeddingService,
    private vectorStoreService: VectorStoreService,
  ) {
    this.uploadDir = this.configService.get<string>(
      "RAG_UPLOAD_DIR",
      "./data/rag_uploads",
    );
    this.trainingDir = this.configService.get<string>(
      "RAG_TRAINING_DIR",
      "./data/training-data",
    );
    for (const dir of [this.uploadDir, this.trainingDir]) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
  }

  async processFile(file: Express.Multer.File): Promise<{ chunksCount: number; documentName: string }> {
    const ext = path.extname(file.originalname).toLowerCase();
    const savePath = path.join(this.uploadDir, file.originalname);
    fs.writeFileSync(savePath, file.buffer);

    let text: string;
    switch (ext) {
      case ".pdf":
        text = await this.extractPdf(file.buffer);
        break;
      case ".docx":
        text = await this.extractDocx(file.buffer);
        break;
      case ".txt":
      case ".md":
        text = file.buffer.toString("utf-8");
        break;
      default:
        throw new Error(`Дэмжигдэхгүй файлын төрөл: ${ext}`);
    }

    if (!text.trim()) {
      throw new Error("Файлаас текст олдсонгүй.");
    }

    const chunks = this.splitIntoChunks(text, file.originalname, savePath);
    await this.vectorStoreService.addChunks(chunks);

    this.logger.log(`${file.originalname}: ${chunks.length} chunk боловсрууллаа.`);
    return { chunksCount: chunks.length, documentName: file.originalname };
  }

  async deleteDocument(source: string): Promise<number> {
    const normalized = path.normalize(source);
    if (normalized.includes("..") || path.isAbsolute(normalized)) {
      throw new Error("Зөвшөөрөгдөөгүй файлын зам.");
    }
    const removed = await this.vectorStoreService.removeBySource(source);
    const filePath = path.join(this.uploadDir, path.basename(source));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return removed;
  }

  getDocumentList() {
    return this.vectorStoreService.getDocumentList();
  }

  async scanTrainingData(): Promise<{ processed: string[]; errors: string[] }> {
    const processed: string[] = [];
    const errors: string[] = [];

    if (!fs.existsSync(this.trainingDir)) return { processed, errors };

    const files = fs.readdirSync(this.trainingDir);
    const supported = [".pdf", ".docx", ".txt", ".md"];

    for (const fileName of files) {
      const ext = path.extname(fileName).toLowerCase();
      if (!supported.includes(ext)) continue;

      try {
        const filePath = path.join(this.trainingDir, fileName);
        const buffer = fs.readFileSync(filePath);
        const fakeFile = {
          originalname: fileName,
          buffer,
        } as Express.Multer.File;
        await this.processFile(fakeFile);
        processed.push(fileName);
      } catch (err) {
        errors.push(`${fileName}: ${(err as Error).message}`);
      }
    }

    return { processed, errors };
  }

  private splitIntoChunks(
    text: string,
    documentName: string,
    source: string,
    chunkSize = 500,
    overlap = 50,
  ): DocumentChunk[] {
    const words = text.split(/\s+/).filter(Boolean);
    const chunks: DocumentChunk[] = [];

    for (let i = 0; i < words.length; i += chunkSize - overlap) {
      const slice = words.slice(i, i + chunkSize);
      if (slice.length < 20) break;
      chunks.push({
        id: uuidv4(),
        content: slice.join(" "),
        metadata: {
          source,
          chunkIndex: chunks.length,
          documentName,
        },
      });
    }

    return chunks;
  }

  private async extractPdf(buffer: Buffer): Promise<string> {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = new Uint8Array(buffer);
    const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((item: any) => item.str).join(" "));
    }
    return pages.join("\n\n");
  }

  private async extractDocx(buffer: Buffer): Promise<string> {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
}
