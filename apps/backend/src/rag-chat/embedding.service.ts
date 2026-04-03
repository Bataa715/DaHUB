import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingService.name);
  private pipeline: any;
  private modelName: string;
  private ready = false;

  constructor(private configService: ConfigService) {
    this.modelName = this.configService.get<string>(
      "EMBEDDING_MODEL",
      "Xenova/multilingual-e5-small",
    );
  }

  async onModuleInit() {
    try {
      this.logger.log(`Embedding модел ачааллаж байна: ${this.modelName}`);
      const { pipeline } = await import("@xenova/transformers");
      this.pipeline = await pipeline("feature-extraction", this.modelName);
      this.ready = true;
      this.logger.log("Embedding модел амжилттай ачааллав");
    } catch (error: any) {
      this.logger.error(
        "Embedding модел ачааллахад алдаа гарлаа",
        error.message,
      );
    }
  }

  private ensureReady(): void {
    if (!this.ready) {
      throw new Error("Embedding модел бэлэн болоогүй байна. Түр хүлээнэ үү.");
    }
  }

  async embed(text: string): Promise<number[]> {
    this.ensureReady();
    const result = await this.pipeline(text, {
      pooling: "mean",
      normalize: true,
    });
    return Array.from(result.data);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    this.ensureReady();
    const embeddings: number[][] = [];
    for (const text of texts) {
      embeddings.push(await this.embed(text));
    }
    return embeddings;
  }

  getDimension(): number {
    return 384;
  }
}
