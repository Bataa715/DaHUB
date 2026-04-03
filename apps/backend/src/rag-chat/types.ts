export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    source: string;
    page?: number;
    chunkIndex: number;
    documentName: string;
  };
}

export interface SearchResult {
  chunk: DocumentChunk;
  score: number;
}

export interface ChatResponse {
  answer: string;
  sources: {
    documentName: string;
    content: string;
    score: number;
  }[];
}
