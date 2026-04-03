import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { DocumentService } from "./document.service";

@Controller("rag-chat/documents")
@UseGuards(JwtAuthGuard)
export class DocumentController {
  constructor(private documentService: DocumentService) {}

  @Post("upload")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 50 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = [".pdf", ".docx", ".txt", ".md"];
        const ext = file.originalname.toLowerCase().replace(/.*(\.[^.]+)$/, "$1");
        if (allowed.includes(ext)) {
          cb(null, true);
        } else {
          cb(new Error("Зөвхөн PDF, DOCX, TXT, MD файл дэмжигдэнэ."), false);
        }
      },
    }),
  )
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new HttpException("Файл илгээнэ үү.", HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.documentService.processFile(file);
    } catch (err) {
      throw new HttpException(
        (err as Error).message || "Файл боловсруулахад алдаа гарлаа.",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  getDocuments() {
    return this.documentService.getDocumentList();
  }

  @Delete(":source")
  async deleteDocument(@Param("source") source: string) {
    try {
      const removed = await this.documentService.deleteDocument(source);
      return { removed, source };
    } catch (err) {
      throw new HttpException(
        (err as Error).message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post("scan-training")
  async scanTraining() {
    try {
      return await this.documentService.scanTrainingData();
    } catch (err) {
      throw new HttpException(
        (err as Error).message || "Сургалтын дата уншихад алдаа гарлаа.",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
