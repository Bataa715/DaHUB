import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  Req,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
import type { FileFilterCallback } from "multer";
import { TailanReportsService } from "./tailan-reports.service";
import { TailanImagesService } from "./tailan-images.service";
import { TailanDocxService } from "./tailan-docx.service";
import {
  SaveTailanDto,
  PreviewTailanDto,
  GenerateDeptWordFromDataDto,
} from "./dto/tailan.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ToolGuard } from "../auth/guards/tool.guard";
import { RequireTools } from "../auth/guards/require-tools.decorator";
import { AuthenticatedRequest } from "../common/types/authenticated-request";
import { assertRealImage } from "../common/utils/image-signature";

@Controller("tailan")
@UseGuards(JwtAuthGuard, ToolGuard)
@RequireTools("tailan", "tailan_dept_head")
export class TailanController {
  constructor(
    private readonly tailanReports: TailanReportsService,
    private readonly tailanImages: TailanImagesService,
    private readonly tailanDocx: TailanDocxService,
  ) {}

  // ─── Save / update draft ───────────────────────────────────────────────────
  @Post("save")
  async save(@Req() req: AuthenticatedRequest, @Body() dto: SaveTailanDto) {
    return this.tailanReports.saveDraft(req.user, dto);
  }

  // ─── Department BSC (ТҮЗ) report save ─────────────────────────────────────
  @Post("dept-bsc")
  async saveDeptBsc(
    @Req() req: AuthenticatedRequest,
    @Body("year", ParseIntPipe) year: number,
    @Body("quarter", ParseIntPipe) quarter: number,
    @Body("sections") sections: Record<string, unknown>,
  ) {
    return this.tailanReports.saveDeptBsc(req.user, year, quarter, sections);
  }

  // ─── Department BSC (ТҮЗ) report load ─────────────────────────────────────
  @Get("dept-bsc/:year/:quarter")
  async getDeptBsc(
    @Req() req: AuthenticatedRequest,
    @Param("year", ParseIntPipe) year: number,
    @Param("quarter", ParseIntPipe) quarter: number,
  ) {
    return this.tailanReports.getDeptBsc(req.user, year, quarter);
  }

  // ─── Submit report to department head ─────────────────────────────────────
  @Post("submit")
  async submit(
    @Req() req: AuthenticatedRequest,
    @Body("year", ParseIntPipe) year: number,
    @Body("quarter", ParseIntPipe) quarter: number,
  ) {
    return this.tailanReports.submitReport(req.user.id, year, quarter);
  }

  // ─── Get specific report (mine) ────────────────────────────────────────────
  @Get("my/:year/:quarter")
  async getMyReport(
    @Req() req: AuthenticatedRequest,
    @Param("year", ParseIntPipe) year: number,
    @Param("quarter", ParseIntPipe) quarter: number,
  ) {
    return this.tailanReports.getMyReport(req.user.id, year, quarter);
  }

  // ─── Download Word for my report ───────────────────────────────────────────
  @Get("my/:year/:quarter/word")
  async downloadMyWord(
    @Req() req: AuthenticatedRequest,
    @Param("year", ParseIntPipe) year: number,
    @Param("quarter", ParseIntPipe) quarter: number,
    @Query("name") displayName: string | undefined,
    @Res() res: Response,
  ) {
    const buffer = await this.tailanDocx.generateWord(
      req.user.id,
      year,
      quarter,
      displayName,
    );
    const nameForFile = displayName || req.user.name;
    const filename = encodeURIComponent(
      `Тайлан-${nameForFile}-${year}-Q${quarter}.docx`,
    );
    res.set({
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
      "Content-Length": buffer.length,
      "Cache-Control": "no-store",
    });
    res.end(buffer);
  }

  // ─── Live "real docx" preview from unsaved editor state ───────────────────
  @Post("preview")
  async previewWord(
    @Req() req: AuthenticatedRequest,
    @Body() dto: PreviewTailanDto,
    @Res() res: Response,
  ) {
    const buffer = await this.tailanDocx.previewWord(req.user, dto);
    res.set({
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Length": buffer.length,
      "Cache-Control": "no-store",
    });
    res.end(buffer);
  }

  // ─── Dept head: get all submitted reports for period ──────────────────────
  @Get("dept/:year/:quarter")
  async getDeptReports(
    @Req() req: AuthenticatedRequest,
    @Param("year", ParseIntPipe) year: number,
    @Param("quarter", ParseIntPipe) quarter: number,
  ) {
    return this.tailanReports.getDeptReports(req.user, year, quarter);
  }

  // ─── Dept head: get status overview (all, not just submitted) ─────────────
  @Get("dept/:year/:quarter/overview")
  async getDeptOverview(
    @Req() req: AuthenticatedRequest,
    @Param("year", ParseIntPipe) year: number,
    @Param("quarter", ParseIntPipe) quarter: number,
  ) {
    return this.tailanReports.getAllDeptReports(req.user, year, quarter);
  }

  // ─── Dept head: view one member's report as real .docx ────────────────────
  @Get("dept/member/:userId/:year/:quarter/word")
  async getDeptMemberWord(
    @Req() req: AuthenticatedRequest,
    @Param("userId") userId: string,
    @Param("year", ParseIntPipe) year: number,
    @Param("quarter", ParseIntPipe) quarter: number,
    @Res() res: Response,
  ) {
    const buffer = await this.tailanDocx.generateMemberWord(
      req.user,
      userId,
      year,
      quarter,
    );
    res.set({
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Length": buffer.length,
      "Cache-Control": "no-store",
    });
    res.end(buffer);
  }

  // ─── Dept head: generate Word from edited merged data ────────────────────
  @Post("dept/generate-word")
  async generateDeptWordFromData(
    @Req() req: AuthenticatedRequest,
    @Body() body: GenerateDeptWordFromDataDto,
    @Res() res: Response,
  ) {
    if (!this.tailanReports.isDeptHead(req.user)) {
      res.status(403).json({ message: "Эрх хүрэхгүй" });
      return;
    }
    const buffer = await this.tailanDocx.generateDeptWordFromData(body);
    const filename = encodeURIComponent(
      `Хэлтсийн-тайлан-${body.year}-Q${body.quarter}.docx`,
    );
    res.set({
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
      "Content-Length": buffer.length,
      "Cache-Control": "no-store",
    });
    res.end(buffer);
  }

  // ─── Check role ────────────────────────────────────────────────────────────
  @Get("role")
  async getRole(@Req() req: AuthenticatedRequest) {
    return { isDeptHead: this.tailanReports.isDeptHead(req.user) };
  }

  // ─── Images ───────────────────────────────────────────────────────────────

  // [H-7] Only real images, capped at 8MB — prevents disk/DB exhaustion and
  // arbitrary file-type uploads (e.g. executables, scripts) via this endpoint.
  private static readonly ALLOWED_IMAGE_MIME = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ]);
  private static readonly MAX_IMAGE_BYTES = 8 * 1024 * 1024;

  /** POST /tailan/images  — upload image as multipart/form-data */
  @Post("images")
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: TailanController.MAX_IMAGE_BYTES },
      fileFilter: (
        _req: unknown,
        file: { mimetype: string },
        cb: FileFilterCallback,
      ) => {
        if (!TailanController.ALLOWED_IMAGE_MIME.has(file.mimetype)) {
          cb(
            new BadRequestException(
              "Зөвхөн зураг (jpg/png/webp/gif) оруулах боломжтой",
            ),
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  async saveImage(
    @Req() req: AuthenticatedRequest,
    @UploadedFile()
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
    @Body("year") year: string,
    @Body("quarter") quarter: string,
  ) {
    if (!file) {
      throw new BadRequestException("Файл заавал шаардлагатай");
    }
    // [AUDIT] fileFilter нь КЛИЕНТИЙН зарласан Content-Type-ыг л шалгадаг —
    // халдагч дурын агуулгыг "image/png" гэж зарлаж болно. Байтын гарын
    // үсгээр агуулгыг өөрийг нь баталгаажуулна.
    assertRealImage(file.buffer, file.mimetype);
    return this.tailanImages.saveImage(
      req.user.id,
      req.user.departmentId ?? "",
      parseInt(year, 10),
      parseInt(quarter, 10),
      file.originalname,
      file.mimetype,
      file.buffer,
    );
  }

  /** GET /tailan/images/my/:year/:quarter  — my image list */
  @Get("images/my/:year/:quarter")
  async getImages(
    @Req() req: AuthenticatedRequest,
    @Param("year", ParseIntPipe) year: number,
    @Param("quarter", ParseIntPipe) quarter: number,
  ) {
    return this.tailanImages.getImages(req.user.id, year, quarter);
  }

  /** GET /tailan/images/:id/data  — serve raw image */
  @Get("images/:id/data")
  async getImageData(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const { mimeType, buffer } = await this.tailanImages.getImageData(
      id,
      req.user,
    );
    (res as any).set({
      "Content-Type": mimeType,
      "Cache-Control": "private, max-age=3600",
    });
    (res as any).end(buffer);
  }

  /** DELETE /tailan/images/:id */
  @Delete("images/:id")
  async deleteImage(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    return this.tailanImages.deleteImage(id, req.user.id);
  }
}
