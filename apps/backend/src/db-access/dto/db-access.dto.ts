import {
  IsString,
  IsArray,
  IsDateString,
  IsOptional,
  IsNotEmpty,
  ArrayMinSize,
  ArrayMaxSize,
  MaxLength,
  IsIn,
} from "class-validator";

export class CreateAccessRequestDto {
  // M-9: Strict per-item validators prevent injection of oversized or
  // unexpected values (e.g. 'DROP TABLE') through the tables array.
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  tables: string[]; // ["FINACLE.accounts", "ERP.users"]

  @IsArray()
  @IsOptional()
  columns?: string[]; // empty = all columns

  // M-9: Only SELECT is permitted — reject INSERT, UPDATE, DELETE, DROP, etc.
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(['SELECT'], { each: true })
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
