import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  IsObject,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class UpsertManualIndicatorDto {
  @IsString()
  @MaxLength(200)
  branchId: string;

  @IsString()
  @MaxLength(200)
  indicatorId: string;

  @IsNumber()
  value: number;
}

export class SetHoldDto {
  @IsString()
  @MaxLength(200)
  indicatorId: string;

  @IsString()
  @MaxLength(50)
  period: string;

  @IsBoolean()
  isHeld: boolean;
}

export class LockDateBodyDto {
  @IsString()
  @MaxLength(50)
  date: string;
}

export class UpsertJudgementDto {
  @IsString()
  @MaxLength(200)
  branchId: string;

  @IsString()
  @MaxLength(500)
  branchName: string;

  @IsString()
  @MaxLength(50)
  fetchedDate: string;

  @IsNumber()
  score: number;

  @IsString()
  @IsOptional()
  @MaxLength(8000)
  comment?: string;
}

export class SaveHistoryFromRiskbranchDto {
  @IsString()
  @MaxLength(50)
  fetchedDate: string;

  @IsString()
  @MaxLength(500)
  name: string;

  @IsArray()
  @IsOptional()
  rows?: unknown[];

  @IsObject()
  @IsOptional()
  manualMap?: Record<string, Record<string, number>>;

  @IsObject()
  @IsOptional()
  judgementComments?: Record<string, string>;
}

export class BranchScoreItemDto {
  @IsString()
  branchId: string;

  @IsString()
  branchName: string;

  @IsString()
  solid: string;

  @IsString()
  rating: string;

  @IsString()
  region: string;

  @IsNumber()
  @IsOptional()
  s1: number | null;

  @IsNumber()
  @IsOptional()
  s2: number | null;

  @IsNumber()
  @IsOptional()
  s3: number | null;

  @IsNumber()
  s4: number;

  @IsNumber()
  j: number;

  @IsNumber()
  @IsOptional()
  total: number | null;

  @IsString()
  level: string;
}

export class UpsertBranchScoresDto {
  @IsString()
  @MaxLength(50)
  fetchDate: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BranchScoreItemDto)
  scores: BranchScoreItemDto[];
}
