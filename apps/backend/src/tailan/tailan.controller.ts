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
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
import { TailanService } from "./tailan.service";
import { SaveTailanDto } from "./dto/tailan.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("tailan")
@UseGuards(JwtAuthGuard)
export class TailanController {
  constructor(private readonly tailanService: TailanService) {}

  // ─── Save / update draft ───────────────────────────────────────────────────
  @Post("save")
  async save(@Req() req: any, @Body() dto: SaveTailanDto) {
    return this.tailanService.saveDraft(req.user, dto);
  }

  // ─── Submit report to department head ─────────────────────────────────────
  @Post("submit")
  async submit(
    @Req() req: any,
    @Body("year", ParseIntPipe) year: number,
    @Body("quarter", ParseIntPipe) quarter: number,
  ) {
    return this.tailanService.submitReport(req.user.id, year, quarter);
  }

  // ─── Get my reports list ───────────────────────────────────────────────────
  @Get("my")
  async getMyReports(@Req() req: any) {
    return this.tailanService.getMyReports(req.user.id);
  }

  // ─── Get specific report (mine) ────────────────────────────────────────────
  @Get("my/:year/:quarter")
  async getMyReport(
    @Req() req: any,
    @Param("year", ParseIntPipe) year: number,
    @Param("quarter", ParseIntPipe) quarter: number,
  ) {
    return this.tailanService.getMyReport(req.user.id, year, quarter);
  }

  // ─── Download Word for my report ───────────────────────────────────────────
  @Get("my/:year/:quarter/word")
  async downloadMyWord(
    @Req() req: any,
    @Param("year", ParseIntPipe) year: number,
    @Param("quarter", ParseIntPipe) quarter: number,
    @Query("name") displayName: string | undefined,
    @Res() res: Response,
  ) {
    const buffer = await this.tailanService.generateWord(
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

  // ─── Dept head: get all submitted reports for period ──────────────────────
  @Get("dept/:year/:quarter")
  async getDeptReports(
    @Req() req: any,
    @Param("year", ParseIntPipe) year: number,
    @Param("quarter", ParseIntPipe) quarter: number,
  ) {
    return this.tailanService.getDeptReports(req.user, year, quarter);
  }

  // ─── Dept head: get status overview (all, not just submitted) ─────────────
  @Get("dept/:year/:quarter/overview")
  async getDeptOverview(
    @Req() req: any,
    @Param("year", ParseIntPipe) year: number,
    @Param("quarter", ParseIntPipe) quarter: number,
  ) {
    return this.tailanService.getAllDeptReports(req.user, year, quarter);
  }

  // ─── Dept head: download merged Word ──────────────────────────────────────
  @Get("dept/:year/:quarter/word")
  async downloadDeptWord(
    @Req() req: any,
    @Param("year", ParseIntPipe) year: number,
    @Param("quarter", ParseIntPipe) quarter: number,
    @Res() res: Response,
  ) {
    const buffer = await this.tailanService.generateDeptWord(
      req.user,
      year,
      quarter,
    );
    const filename = encodeURIComponent(
      `Хэлтсийн-тайлан-${year}-Q${quarter}.docx`,
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

  // ─── Dept head: generate Word from edited merged data ────────────────────
  @Post("dept/generate-word")
  async generateDeptWordFromData(
    @Req() req: any,
    @Body() body: any,
    @Res() res: Response,
  ) {
    if (!this.tailanService.isDeptHead(req.user)) {
      res.status(403).json({ message: "Эрх хүрэхгүй" });
      return;
    }
    const buffer = await this.tailanService.generateDeptWordFromData(body);
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
  async getRole(@Req() req: any) {
    return { isDeptHead: this.tailanService.isDeptHead(req.user) };
  }

  // ─── Images ───────────────────────────────────────────────────────────────

  /** POST /tailan/images  — upload image as multipart/form-data */
  @Post("images")
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor("file"))
  async saveImage(
    @Req() req: any,
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
    return this.tailanService.saveImage(
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
    @Req() req: any,
    @Param("year", ParseIntPipe) year: number,
    @Param("quarter", ParseIntPipe) quarter: number,
  ) {
    return this.tailanService.getImages(req.user.id, year, quarter);
  }

  /** GET /tailan/images/dept/:year/:quarter  — dept image list */
  @Get("images/dept/:year/:quarter")
  async getDeptImages(
    @Req() req: any,
    @Param("year", ParseIntPipe) year: number,
    @Param("quarter", ParseIntPipe) quarter: number,
  ) {
    return this.tailanService.getDeptImages(
      req.user.departmentId ?? "",
      year,
      quarter,
    );
  }

  /** GET /tailan/images/:id/data  — serve raw image */
  @Get("images/:id/data")
  async getImageData(
    @Req() req: any,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const { mimeType, buffer } = await this.tailanService.getImageData(
      id,
      req.user.id,
    );
    (res as any).set({
      "Content-Type": mimeType,
      "Cache-Control": "private, max-age=3600",
    });
    (res as any).end(buffer);
  }

  /** DELETE /tailan/images/:id */
  @Delete("images/:id")
  async deleteImage(@Req() req: any, @Param("id") id: string) {
    return this.tailanService.deleteImage(id, req.user.id);
  }
}
