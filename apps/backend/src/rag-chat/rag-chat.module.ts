import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MulterModule } from "@nestjs/platform-express";
import { EmbeddingService } from "./embedding.service";
import { OllamaService } from "./ollama.service";
import { VectorStoreService } from "./vector-store.service";
import { DocumentService } from "./document.service";
import { RagService } from "./rag.service";
import { ChatController } from "./chat.controller";
import { DocumentController } from "./document.controller";

@Module({
  imports: [ConfigModule, MulterModule.register({ storage: undefined })],
  controllers: [ChatController, DocumentController],
  providers: [
    EmbeddingService,
    OllamaService,
    VectorStoreService,
    DocumentService,
    RagService,
  ],
  exports: [RagService, VectorStoreService],
})
export class RagChatModule {}
