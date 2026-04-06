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
      "llama3",
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
    // /api/embed — works with nomic-embed-text and llama3 (Ollama 0.1.26+)
    const response = await fetch(`${this.baseUrl}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.modelName, input: text }),
    });

    if (!response.ok) {
      throw new Error(
        `Ollama embedding алдаа: ${response.status} — ${this.modelName} модел суулгасан эсэхийг шалгана уу`,
      );
    }

    const data = await response.json();
    // /api/embed returns { embeddings: [[...]] }
    const embedding = data.embeddings?.[0] ?? data.embedding;
    if (!embedding || !Array.isArray(embedding)) {
      throw new Error("Ollama embedding хариу буруу форматтай байна");
    }

    this.dimension = embedding.length;
    return embedding as number[];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const concurrency = 2;
    const results: number[][] = new Array(texts.length);
    for (let i = 0; i < texts.length; i += concurrency) {
      const batch = texts.slice(i, i + concurrency);
      const batchResults = await Promise.all(batch.map((t) => this.embed(t)));
      batchResults.forEach((emb, j) => {
        results[i + j] = emb;
      });
      this.logger.log(`Embedding: ${Math.min(i + concurrency, texts.length)}/${texts.length} chunk`);
      // CPU-г амраах — халахаас сэргийлнэ
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return results;
  }

  getDimension(): number {
    return this.dimension;
  }

  isReady(): boolean {
    return this.ready;
  }
}
