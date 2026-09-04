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

// ─── Expense monitoring (Зардлын хяналт) ────────────────────────────────────
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
