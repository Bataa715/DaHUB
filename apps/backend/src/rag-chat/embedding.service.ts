import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingService.name);
  private baseUrl: string;
  private modelName: string;
  private dimension = 768;
  private ready = false;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      "OLLAMA_BASE_URL",
      "http://localhost:11434",
    );
    this.modelName = this.configService.get<string>(
      "EMBEDDING_MODEL",
      "nomic-embed-text",
    );
  }

  async onModuleInit() {
    try {
      this.logger.log(`Embedding модел шалгаж байна: ${this.modelName}`);
      // Warm-up call to verify model is available
      await this.embed("test");
      this.ready = true;
      this.logger.log("Embedding модел бэлэн болов");
    } catch (error: any) {
      this.logger.warn(
        `Embedding модел бэлэн болоогүй — RAG хайлт ажиллахгүй: ${error.message}`,
      );
    }
  }

  async embed(text: string): Promise<number[]> {
    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.modelName, prompt: text }),
    });

    if (!response.ok) {
      throw new Error(
        `Ollama embedding алдаа: ${response.status} — ${this.modelName} модел суулгасан эсэхийг шалгана уу`,
      );
    }

    const data = await response.json();
    if (!data.embedding || !Array.isArray(data.embedding)) {
      throw new Error("Ollama embedding хариу буруу форматтай байна");
    }

    this.dimension = data.embedding.length;
    return data.embedding as number[];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    for (const text of texts) {
      embeddings.push(await this.embed(text));
    }
    return embeddings;
  }

  getDimension(): number {
    return this.dimension;
  }

  isReady(): boolean {
    return this.ready;
  }
}
