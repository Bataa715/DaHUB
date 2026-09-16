import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { XDR_STATUSES } from "../network-risk";

export const RISK_LEVEL_FILTERS = [
  "Critical",
  "High",
  "Medium",
  "Low",
] as const;
export const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

// ─── Palo Alto тохиргооны өөрчлөлт ─────────────────────────────────────────
export class ConfigChangesQueryDto {
  @IsDateString({}, { message: "Эхлэх огноо буруу байна" })
  startDate: string;

  @IsDateString({}, { message: "Дуусах огноо буруу байна" })
  endDate: string;

  @IsOptional()
  @IsIn(RISK_LEVEL_FILTERS, { message: "Эрсдэлийн түвшин буруу байна" })
  riskLevel?: (typeof RISK_LEVEL_FILTERS)[number];

  @IsOptional()
  @IsIn(REVIEW_STATUSES, { message: "Хяналтын төлөв буруу байна" })
  reviewStatus?: ReviewStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: "Хайлтын үг хэт урт байна" })
  search?: string;
}

export class ConfigChangeReviewDto {
  @IsOptional()
  @IsIn(REVIEW_STATUSES, { message: "Хяналтын төлөв буруу байна" })
  reviewStatus?: ReviewStatus;

  @IsOptional()
  @IsString()
  @MaxLength(4000, { message: "Тайлбар хэт урт байна" })
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: "Сэтгэгдэл хэт урт байна" })
  comment?: string;
}

// ─── Microsoft Defender XDR ────────────────────────────────────────────────
export class XdrQueryDto {
  @IsDateString({}, { message: "Эхлэх огноо буруу байна" })
  startDate: string;

  @IsDateString({}, { message: "Дуусах огноо буруу байна" })
  endDate: string;

  @IsOptional()
  @IsIn(RISK_LEVEL_FILTERS, { message: "Эрсдэлийн түвшин буруу байна" })
  riskLevel?: (typeof RISK_LEVEL_FILTERS)[number];

  @IsOptional()
  @IsIn(XDR_STATUSES, { message: "Төлөв буруу байна" })
  status?: (typeof XDR_STATUSES)[number];
}

export class XdrStatusDto {
  @IsIn(XDR_STATUSES, { message: "Төлөв буруу байна" })
  status: (typeof XDR_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: "Тэмдэглэл хэт урт байна" })
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: "Хариуцагчийн нэр хэт урт байна" })
  assignedTo?: string;
}
