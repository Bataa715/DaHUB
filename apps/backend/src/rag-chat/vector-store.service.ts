import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { EmbeddingService } from "./embedding.service";
import { DocumentChunk, SearchResult } from "./types";
import { ClickHouseService } from "../clickhouse/clickhouse.service";

interface ChunkRow {
  id: string;
  content: string;
  source: string;
  chunk_index: number;
  document_name: string;
  page: number;
  embedding: number[];
}

@Injectable()
export class VectorStoreService implements OnModuleInit {
  private readonly logger = new Logger(VectorStoreService.name);

  private cachedChunks: DocumentChunk[] = [];
  private cachedEmbeddings: number[][] = [];

  constructor(
    private embeddingService: EmbeddingService,
    private clickhouse: ClickHouseService,
  ) {}

  async onModuleInit() {
    await this.loadCache();
    this.logger.log(
      `ClickHouse vector store ачааллав. Нийт ${this.cachedChunks.length} chunk бүртгэлтэй.`,
    );
  }

  async addChunks(chunks: DocumentChunk[]): Promise<void> {
    const texts = chunks.map((c) => c.content);
    const newEmbeddings = await this.embeddingService.embedBatch(texts);

    const rows = chunks.map((chunk, i) => ({
      id: chunk.id,
      content: chunk.content,
      source: chunk.metadata.source,
      chunk_index: chunk.metadata.chunkIndex,
      document_name: chunk.metadata.documentName,
      page: chunk.metadata.page ?? 0,
      embedding: newEmbeddings[i],
    }));

    await this.clickhouse.insert("rag_chunks", rows);

    this.cachedChunks.push(...chunks);
    this.cachedEmbeddings.push(...newEmbeddings);
    this.logger.log(
      `${chunks.length} chunk нэмэгдлээ. Нийт: ${this.cachedChunks.length}`,
    );
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
    const countRows = await this.clickhouse.query<{ cnt: string }>(
      "SELECT count() as cnt FROM rag_chunks WHERE source = {source:String}",
      { source },
    );
    const count = parseInt(countRows[0]?.cnt ?? "0", 10);

    if (count > 0) {
      await this.clickhouse.exec(
        "ALTER TABLE rag_chunks DELETE WHERE source = {source:String}",
        { source },
      );
      await this.loadCache();
    }

    return count;
  }

  getDocumentList(): { source: string; chunksCount: number }[] {
    const map = new Map<string, number>();
    for (const chunk of this.cachedChunks) {
      map.set(chunk.metadata.source, (map.get(chunk.metadata.source) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([source, chunksCount]) => ({
      source,
      chunksCount,
    }));
  }

  getTotalChunks(): number {
    return this.cachedChunks.length;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0,
      nA = 0,
      nB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      nA += a[i] * a[i];
      nB += b[i] * b[i];
    }
    const denom = Math.sqrt(nA) * Math.sqrt(nB);
    return denom === 0 ? 0 : dot / denom;
  }

  private async loadCache(): Promise<void> {
    const rows = await this.clickhouse.query<ChunkRow>(
      "SELECT id, content, source, chunk_index, document_name, page, embedding FROM rag_chunks ORDER BY source, chunk_index",
    );
    this.cachedChunks = rows.map((r) => ({
      id: r.id,
      content: r.content,
      metadata: {
        source: r.source,
        chunkIndex: Number(r.chunk_index),
        documentName: r.document_name,
        page: r.page ? Number(r.page) : undefined,
      },
    }));
    this.cachedEmbeddings = rows.map((r) =>
      Array.isArray(r.embedding)
        ? (r.embedding as number[])
        : (JSON.parse(r.embedding as unknown as string) as number[]),
    );
  }
}
