import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  UseGuards,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RagService } from "./rag.service";
import { OllamaService } from "./ollama.service";
import { VectorStoreService } from "./vector-store.service";
import { ChatDto } from "./dto/chat.dto";

@Controller("rag-chat")
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private ragService: RagService,
    private ollamaService: OllamaService,
    private vectorStoreService: VectorStoreService,
  ) {}

  @Post("chat")
  async chat(@Body() dto: ChatDto) {
    try {
      return await this.ragService.query(dto.question, dto.conversationHistory);
    } catch (err) {
      throw new HttpException(
        (err as Error).message || "Хариулт боловсруулахад алдаа гарлаа.",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post("chat/stream")
  async chatStream(@Body() dto: ChatDto, @Res() res: Response) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    try {
      const { sources } = await this.ragService.queryStream(
        dto.question,
        (token: string) => {
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
        },
        dto.conversationHistory,
      );
      res.write(`data: ${JSON.stringify({ done: true, sources })}\n\n`);
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: (err as Error).message })}\n\n`);
    } finally {
      res.end();
    }
  }

  @Get("health")
  async health() {
    const ollamaOk = await this.ollamaService.checkHealth();
    const totalChunks = this.vectorStoreService.getTotalChunks();
    return {
      status: ollamaOk ? "ok" : "ollama_unavailable",
      ollama: ollamaOk,
      totalChunks,
    };
  }
}
