import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export const EXPENSE_VERIFICATION_STATUSES = [
  "normal",
  "questionable",
  "attention",
] as const;
export type ExpenseVerificationStatus =
  (typeof EXPENSE_VERIFICATION_STATUSES)[number];

export class RelatedPartyTransactionsDto {
  @IsArray()
  @ArrayMinSize(2, { message: "Хамгийн багадаа 2 CIF/FORACID шаардлагатай" })
  @ArrayMaxSize(200, {
    message: "Хамгийн ихдээ 200 CIF/FORACID зэрэг шалгах боломжтой",
  })
  @IsString({ each: true })
  customerIds: string[];

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}

// ─── Зардлын хяналт ─────────────────────────────────────────────────────────
export class ExpenseOverviewDto {
  @IsDateString({}, { message: "Эхлэх огноо буруу байна" })
  startDate: string;

  @IsDateString({}, { message: "Дуусах огноо буруу байна" })
  endDate: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: "Доод дүн тоо байх ёстой" })
  @Min(0, { message: "Доод дүн 0-ээс бага байж болохгүй" })
  @Max(1_000_000_000_000, { message: "Доод дүн хэт өндөр байна" })
  minAmount?: number;
}

export class ExpensePaymentRequestsDto {
  @IsString()
  @IsNotEmpty({ message: "Харилцагчийн код заавал шаардлагатай" })
  @MaxLength(64, { message: "Харилцагчийн код хэт урт байна" })
  customerCode: string;

  @IsDateString({}, { message: "Эхлэх огноо буруу байна" })
  startDate: string;

  @IsDateString({}, { message: "Дуусах огноо буруу байна" })
  endDate: string;
}

export class ExpenseAttachmentsDto {
  @IsString()
  @IsNotEmpty({ message: "Invoice ID заавал шаардлагатай" })
  @MaxLength(128, { message: "Invoice ID хэт урт байна" })
  invoiceId: string;
}

export class ExpenseBudgetChangesDto {
  @IsString()
  @IsNotEmpty({ message: "Баримтын дугаар заавал шаардлагатай" })
  @MaxLength(64, { message: "Баримтын дугаар хэт урт байна" })
  bookNumber: string;
}

export class ExpenseVerificationDto {
  @IsString()
  @IsNotEmpty({ message: "Баримтын дугаар заавал шаардлагатай" })
  @MaxLength(64, { message: "Баримтын дугаар хэт урт байна" })
  bookNumber: string;

  @IsOptional()
  @IsString({ message: "Тайлбар текст байх ёстой" })
  @MaxLength(4000, { message: "Тайлбар хэт урт байна" })
  comment?: string;

  @IsOptional()
  @IsString({ message: "Төрөл текст байх ёстой" })
  @MaxLength(120, { message: "Төрлийн нэр хэт урт байна" })
  verificationType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: "Гэрээний нийт дүн тоо байх ёстой" })
  @Min(0, { message: "Гэрээний нийт дүн 0-ээс бага байж болохгүй" })
  @Max(1_000_000_000_000, { message: "Гэрээний нийт дүн хэт өндөр байна" })
  contractTotalAmount?: number;

  @IsOptional()
  @IsDateString({}, { message: "Гэрээний огноо буруу байна" })
  contractDate?: string;

  @IsOptional()
  @IsString({ message: "Гэрээний дугаар текст байх ёстой" })
  @MaxLength(64, { message: "Гэрээний дугаар хэт урт байна" })
  contractNumber?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: "Үлдэгдэл төлбөр тоо байх ёстой" })
  @Min(0, { message: "Үлдэгдэл төлбөр 0-ээс бага байж болохгүй" })
  @Max(1_000_000_000_000, { message: "Үлдэгдэл төлбөр хэт өндөр байна" })
  remainingAmount?: number;

  @IsOptional()
  @IsIn(EXPENSE_VERIFICATION_STATUSES, {
    message: "Статус буруу байна",
  })
  status?: ExpenseVerificationStatus;
}

export class ExpenseTotalDto {
  @IsDateString({}, { message: "Эхлэх огноо буруу байна" })
  startDate: string;

  @IsDateString({}, { message: "Дуусах огноо буруу байна" })
  endDate: string;
}

export class CreateVerificationTypeDto {
  @IsString()
  @IsNotEmpty({ message: "Төрлийн нэр заавал шаардлагатай" })
  @MaxLength(120, { message: "Төрлийн нэр хэт урт байна" })
  name: string;
}

export class UpdateVerificationTypeDto {
  @IsOptional()
  @IsString({ message: "Төрлийн нэр текст байх ёстой" })
  @MaxLength(120, { message: "Төрлийн нэр хэт урт байна" })
  name?: string;

  @IsOptional()
  @IsBoolean({ message: "Идэвхтэй эсэх утга буруу байна" })
  isActive?: boolean;
}

/**
 * Зайны аудитын анхдагч тохиргоо (зөвхөн супер админ).
 * Хэсэгчилсэн шинэчлэлт — заагаагүй талбар хэвээр үлдэнэ.
 */
export class UpdateZainiiAuditSettingsDto {
  @IsOptional()
  @IsNumber({}, { message: "Доод дүн тоо байх ёстой" })
  @Min(0, { message: "Доод дүн сөрөг байж болохгүй" })
  @Max(1_000_000_000_000, { message: "Доод дүн хэт их байна" })
  defaultMinAmount?: number;

  @IsOptional()
  @IsNumber({}, { message: "Хугацаа тоо байх ёстой" })
  @Min(1, { message: "Хугацаа дор хаяж 1 хоног байх ёстой" })
  @Max(3650, { message: "Хугацаа хэт урт байна (дээд тал нь 3650 хоног)" })
  defaultDaysBack?: number;
}

// ─── Зардлын хяналтын Word тайлан ───────────────────────────────────────────
export class GenerateExpenseReportDto {
  @IsDateString({}, { message: "Эхлэх огноо буруу байна" })
  startDate: string;

  @IsDateString({}, { message: "Дуусах огноо буруу байна" })
  endDate: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: "Доод дүн тоо байх ёстой" })
  @Min(0, { message: "Доод дүн 0-ээс бага байж болохгүй" })
  @Max(1_000_000_000_000, { message: "Доод дүн хэт өндөр байна" })
  minAmount?: number;

  @IsString()
  @IsNotEmpty({ message: "Тайлангийн дугаар заавал шаардлагатай" })
  @MaxLength(64, { message: "Тайлангийн дугаар хэт урт байна" })
  reportNumber: string;

  @IsOptional()
  @IsString({ message: "Дүгнэлт текст байх ёстой" })
  @MaxLength(4000, { message: "Дүгнэлт хэт урт байна" })
  conclusionText?: string;
}

// ─── Хамааралтай / Холбоотой харилцагчийн шалгалт ──────────────────────────
export class ExpenseRelationsDto {
  @IsArray()
  @ArrayMinSize(1, { message: "Хамгийн багадаа 1 харилцагчийн код шаардлагатай" })
  @ArrayMaxSize(1000, {
    message: "Хамгийн ихдээ 1000 харилцагчийн код зэрэг шалгах боломжтой",
  })
  @IsString({ each: true })
  customerCodes: string[];
}
