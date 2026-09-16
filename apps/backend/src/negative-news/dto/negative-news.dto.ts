import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";

export class NegativeNewsRowDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Огноо YYYY-MM-DD хэлбэртэй байх ёстой",
  })
  newsDate: string;

  @IsString()
  @MaxLength(100, { message: "Мэдээллийн суваг хэт урт байна" })
  channel: string;

  @IsString()
  @MaxLength(100, { message: "Банкны нэр хэт урт байна" })
  bank: string;

  @IsString()
  @MaxLength(200, { message: "Ангилал хэт урт байна" })
  category: string;

  @IsString()
  @MaxLength(5000, { message: "Мэдээллийн агуулга хэт урт байна" })
  content: string;
}

/**
 * Excel-ийг браузерт задлаад мөрүүдийг хэсэгчлэн илгээнэ (body 1MB хязгаартай).
 * Эхний хэсэг `batchId`-гүй — backend шинэ багц үүсгэж буцаана; дараагийн
 * хэсгүүд тэр `batchId`-г дамжуулна.
 */
export class ImportNegativeNewsDto {
  @IsOptional()
  @IsUUID("4", { message: "Багцын дугаар буруу байна" })
  batchId?: string;

  @IsString()
  @MaxLength(255, { message: "Файлын нэр хэт урт байна" })
  fileName: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: "Хуудасны нэр хэт урт байна" })
  sheetName?: string;

  @IsArray()
  @ArrayMinSize(1, { message: "Мөр хоосон байна" })
  @ArrayMaxSize(1000, { message: "Нэг удаад хамгийн ихдээ 1000 мөр" })
  @ValidateNested({ each: true })
  @Type(() => NegativeNewsRowDto)
  rows: NegativeNewsRowDto[];
}

export class NegativeNewsDashboardDto {
  @IsDateString({}, { message: "Эхлэх огноо буруу байна" })
  startDate: string;

  @IsDateString({}, { message: "Дуусах огноо буруу байна" })
  endDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  bank?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  channel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: "Хайлтын үг хэт урт байна" })
  search?: string;
}
