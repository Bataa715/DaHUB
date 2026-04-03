import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EmbeddingService } from "./embedding.service";
import { DocumentChunk, SearchResult } from "./types";
import { existsSync, mkdirSync } from "fs";
import * as path from "path";
import Database from "better-sqlite3";

@Injectable()
export class VectorStoreService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VectorStoreService.name);
  private storePath: string;
  private db: Database.Database;

  private cachedChunks: DocumentChunk[] = [];
  private cachedEmbeddings: number[][] = [];

  constructor(
    private configService: ConfigService,
    private embeddingService: EmbeddingService,
  ) {
    this.storePath = this.configService.get<string>(
      "VECTOR_STORE_PATH",
      "./data/vector_store",
    );
  }

  async onModuleInit() {
    if (!existsSync(this.storePath)) {
      mkdirSync(this.storePath, { recursive: true });
    }

    const dbPath = path.join(this.storePath, "vector_store.db");
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        source TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        document_name TEXT NOT NULL,
        page INTEGER,
        embedding TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source);
    `);

    this.loadCache();
    this.logger.log(
      `SQLite vector store ачааллав. Нийт ${this.cachedChunks.length} chunk бүртгэлтэй.`,
    );
  }

  onModuleDestroy() {
    if (this.db) this.db.close();
  }

  async addChunks(chunks: DocumentChunk[]): Promise<void> {
    const texts = chunks.map((c) => c.content);
    const newEmbeddings = await this.embeddingService.embedBatch(texts);

    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO chunks (id, content, source, chunk_index, document_name, page, embedding)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction(
      (items: { chunk: DocumentChunk; embedding: number[] }[]) => {
        for (const { chunk, embedding } of items) {
          insert.run(
            chunk.id,
            chunk.content,
            chunk.metadata.source,
            chunk.metadata.chunkIndex,
            chunk.metadata.documentName,
            chunk.metadata.page ?? null,
            JSON.stringify(embedding),
          );
        }
      },
    );

    insertMany(chunks.map((chunk, i) => ({ chunk, embedding: newEmbeddings[i] })));

    this.cachedChunks.push(...chunks);
    this.cachedEmbeddings.push(...newEmbeddings);
    this.logger.log(`${chunks.length} chunk нэмэгдлээ. Нийт: ${this.cachedChunks.length}`);
  }

  async search(query: string, topK = 5): Promise<SearchResult[]> {
    if (this.cachedChunks.length === 0) return [];

    const queryEmbedding = await this.embeddingService.embed(query);
    const scores = this.cachedEmbeddings.map((emb) =>
      this.cosineSimilarity(queryEmbedding, emb),
    );

    return scores
      .map((score, i) => ({ score, index: i }))
      .sort((a, b) => b.score - a.score)
      .filter(({ score }) => score > 0.3)
      .slice(0, topK)
      .map(({ score, index }) => ({ chunk: this.cachedChunks[index], score }));
  }

  async removeBySource(source: string): Promise<number> {
    const result = this.db.prepare("DELETE FROM chunks WHERE source = ?").run(source);
    this.loadCache();
    return result.changes;
  }

  getDocumentList(): { source: string; chunksCount: number }[] {
    const rows = this.db
      .prepare("SELECT source, COUNT(*) as cnt FROM chunks GROUP BY source")
      .all() as { source: string; cnt: number }[];
    return rows.map((r) => ({ source: r.source, chunksCount: r.cnt }));
  }

  getTotalChunks(): number {
    return (this.db.prepare("SELECT COUNT(*) as cnt FROM chunks").get() as { cnt: number }).cnt;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, nA = 0, nB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      nA += a[i] * a[i];
      nB += b[i] * b[i];
    }
    const denom = Math.sqrt(nA) * Math.sqrt(nB);
    return denom === 0 ? 0 : dot / denom;
  }

  private loadCache(): void {
    const rows = this.db
      .prepare("SELECT id, content, source, chunk_index, document_name, page, embedding FROM chunks")
      .all() as {
        id: string; content: string; source: string; chunk_index: number;
        document_name: string; page: number | null; embedding: string;
      }[];
    this.cachedChunks = rows.map((r) => ({
      id: r.id,
      content: r.content,
      metadata: { source: r.source, chunkIndex: r.chunk_index, documentName: r.document_name, page: r.page ?? undefined },
    }));
    this.cachedEmbeddings = rows.map((r) => JSON.parse(r.embedding));
  }
}
