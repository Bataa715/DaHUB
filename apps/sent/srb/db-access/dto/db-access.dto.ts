import {
  IsString,
  IsArray,
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
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  columns?: string[]; // empty = all columns

  // M-9: Only SELECT is permitted — reject INSERT, UPDATE, DELETE, DROP, etc.
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(["SELECT"], { each: true })
  accessTypes: string[]; // ["SELECT"]

  @IsString()
  @IsNotEmpty()
  validUntil: string; // ISO datetime string

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  reason?: string;
}

export class ReviewRequestDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(["approve", "reject"])
  action: "approve" | "reject";

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  reviewNote?: string;
}

export class RevokeGrantDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}
