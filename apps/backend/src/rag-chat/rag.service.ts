import { Injectable, Logger } from "@nestjs/common";
import { OllamaService } from "./ollama.service";
import { VectorStoreService } from "./vector-store.service";
import { ChatResponse, SearchResult } from "./types";

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private ollamaService: OllamaService,
    private vectorStoreService: VectorStoreService,
  ) {}

  async query(
    question: string,
    conversationHistory?: string[],
  ): Promise<ChatResponse> {
    const sanitized = this.sanitizeInput(question);
    const results = await this.vectorStoreService.search(sanitized, 5);
    const prompt = this.buildPrompt(sanitized, results, conversationHistory);
    const answer = await this.ollamaService.generate(prompt);
    return {
      answer,
      sources: results.map((r) => ({
        content: r.chunk.content.substring(0, 200) + "...",
        documentName: r.chunk.metadata.documentName,
        score: Math.round(r.score * 100) / 100,
      })),
    };
  }

  async queryStream(
    question: string,
    onToken: (token: string) => void,
    conversationHistory?: string[],
  ): Promise<{ sources: ChatResponse["sources"] }> {
    const sanitized = this.sanitizeInput(question);
    const results = await this.vectorStoreService.search(sanitized, 5);
    const prompt = this.buildPrompt(sanitized, results, conversationHistory);
    await this.ollamaService.generateStream(prompt, onToken);
    return {
      sources: results.map((r) => ({
        content: r.chunk.content.substring(0, 200) + "...",
        documentName: r.chunk.metadata.documentName,
        score: Math.round(r.score * 100) / 100,
      })),
    };
  }

  private buildPrompt(
    question: string,
    results: SearchResult[],
    conversationHistory?: string[],
  ): string {
    let prompt = `Та мэдлэгийн сантай AI туслах юм. Зөвхөн доорх контекст дээр үндэслэн хариулна уу.
Хэрэв контекстоос хариулт олдохгүй бол "Уучлаарай, энэ асуултын хариултыг мэдлэгийн сангаас олж чадсангүй." гэж хариулна уу.
Хариултаа тодорхой, товч, монгол хэл дээр бичнэ үү.

`;
    if (conversationHistory?.length) {
      prompt += `Өмнөх яриа:\n${conversationHistory.slice(-6).join("\n")}\n\n`;
    }

    if (results.length > 0) {
      prompt += "Холбогдох мэдээлэл:\n";
      results.forEach((r, i) => {
        prompt += `[${i + 1}] (${r.chunk.metadata.documentName}, score: ${r.score.toFixed(2)})\n${r.chunk.content}\n\n`;
      });
    } else {
      prompt += "Холбогдох мэдээлэл олдсонгүй.\n\n";
    }

    prompt += `Асуулт: ${question}\n\nХариулт:`;
    return prompt;
  }

  private sanitizeInput(input: string): string {
    return input
      .replace(/<[^>]*>/g, "")
      .replace(/[^\p{L}\p{N}\s.,?!:;()\-'"]/gu, "")
      .trim()
      .substring(0, 2000);
  }
}
