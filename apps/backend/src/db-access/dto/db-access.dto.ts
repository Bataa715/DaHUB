import {
  IsString,
  IsArray,
  IsDateString,
  IsOptional,
  IsNotEmpty,
  ArrayMinSize,
} from "class-validator";

export class CreateAccessRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  tables: string[]; // ["FINACLE.accounts", "ERP.users"]

  @IsArray()
  @IsOptional()
  columns?: string[]; // empty = all columns

  @IsArray()
  @ArrayMinSize(1)
  accessTypes: string[]; // ["SELECT"]

  @IsString()
  @IsNotEmpty()
  validUntil: string; // ISO datetime string

  @IsString()
  @IsOptional()
  reason?: string;
}

export class ReviewRequestDto {
  @IsString()
  @IsNotEmpty()
  action: "approve" | "reject";

  @IsString()
  @IsOptional()
  reviewNote?: string;
}

export class RevokeGrantDto {
  @IsString()
  @IsOptional()
  reason?: string;
}
