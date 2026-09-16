import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { SQL_COMMANDS, SYSTEM_TYPES } from "../db-changes.logic";

export class DbChangeRowDto {
  @Matches(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, {
    message: "TIMESTAMP YYYY-MM-DD HH:MM:SS хэлбэртэй байх ёстой",
  })
  actionTime: string;

  @IsString()
  @MaxLength(255, { message: "USERNAME хэт урт байна" })
  username: string;

  @IsString()
  @MaxLength(255, { message: "MACHINE хэт урт байна" })
  machine: string;

  @IsString()
  @MaxLength(255, { message: "ACTION хэт урт байна" })
  action: string;

  @IsString()
  @MaxLength(255, { message: "OWNER хэт урт байна" })
  owner: string;

  @IsString()
  @MaxLength(255, { message: "OBJECT_NAME хэт урт байна" })
  objectName: string;

  @IsString()
  @MaxLength(255, { message: "DOMAIN хэт урт байна" })
  domain: string;

  @IsString()
  @MaxLength(50_000, { message: "SQL_TEXT хэт урт байна" })
  sqlText: string;

  @IsString()
  @MaxLength(2000, { message: "Тайлбар хэт урт байна" })
  sourceDescription: string;

  @IsString()
  @MaxLength(255, { message: "Jira хэт урт байна" })
  jira: string;
}

/**
 * Excel-ийг браузерт задлаад мөрүүдийг хэсэгчлэн илгээнэ (body 1MB хязгаартай).
 * Эхний хэсэг `batchId`-гүй — backend шинэ багц үүсгэж буцаана.
 */
export class ImportDbChangesDto {
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
  @Type(() => DbChangeRowDto)
  rows: DbChangeRowDto[];
}

export class DbChangesRangeDto {
  @IsDateString({}, { message: "Эхлэх огноо буруу байна" })
  startDate: string;

  @IsDateString({}, { message: "Дуусах огноо буруу байна" })
  endDate: string;

  @IsOptional()
  @IsIn(SYSTEM_TYPES, { message: "Системийн төрөл буруу байна" })
  systemType?: string;
}

export class DbChangesRecordsDto extends DbChangesRangeDto {
  @IsOptional()
  @IsIn(SQL_COMMANDS, { message: "Командын төрөл буруу байна" })
  sqlCommand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: "Хайлтын үг хэт урт байна" })
  search?: string;

  @IsOptional()
  @IsBoolean()
  flaggedOnly?: boolean;
}

/** Аудиторын дүгнэлт — сэжигтэй гэж тэмдэглэх, тайлбар бичих */
export class ReviewDbChangeDto {
  @IsBoolean({ message: "Тэмдэглэгээ буруу байна" })
  flagged: boolean;

  @IsString()
  @MaxLength(2000, { message: "Тайлбар хэт урт байна" })
  note: string;
}
