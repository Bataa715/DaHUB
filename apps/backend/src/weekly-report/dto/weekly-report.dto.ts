import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

/** Бүх хэлтсийн долоо хоногийн тайлангийн гол DTO. sectionsJson нь role-аас
 * хамаараад өөр өөр бүтэцтэй учир тус бүрийн structure-г frontend дээр
 * хариуцана; backend нь шууд JSON болгож хадгална. */
export class SaveWeeklyReportDto {
  @IsInt() @Min(2024) @Max(2100) year!: number;

  /** ISO долоо хоногийн дугаар (1-53). */
  @IsInt() @Min(1) @Max(53) weekNumber!: number;

  /** Долоо хоногийн эхлэх (Monday) огноо: "YYYY-MM-DD". */
  @IsString() weekStart!: string;

  /** Долоо хоногийн дуусах (Sunday) огноо: "YYYY-MM-DD". */
  @IsString() weekEnd!: string;

  /** "audit" | "daa" — frontend-ээс ирнэ, backend дахиж шалгана. */
  @IsString() role!: string;

  /** Role-н дагуух хэсгүүдийн өгөгдөл бүхий объект. */
  @IsObject() sections!: Record<string, unknown>;

  /** "draft" | "submitted" */
  @IsOptional() @IsString() status?: string;
}
