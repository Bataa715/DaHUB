import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsInt,
  IsNotEmpty,
} from "class-validator";

export class CreateDashboardDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  tableName!: string;

  @IsString()
  @IsOptional()
  fromClause?: string;

  @IsString()
  @IsNotEmpty()
  cifColumn!: string;

  @IsString()
  @IsOptional()
  dateColumn?: string | null;

  @IsString()
  @IsOptional()
  amountColumn?: string | null;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}

export class ReplaceDashboardDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  tableName?: string;

  @IsString()
  @IsOptional()
  fromClause?: string | null;

  @IsString()
  @IsOptional()
  cifColumn?: string;

  @IsString()
  @IsOptional()
  dateColumn?: string | null;

  @IsString()
  @IsOptional()
  amountColumn?: string | null;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}

export class SetEnabledDto {
  @IsBoolean()
  enabled!: boolean;
}

export class CreateChainDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  sourceLabel?: string;

  @IsString()
  @IsOptional()
  targetLabel?: string;

  @IsArray()
  @IsInt({ each: true })
  sourceIds!: number[];

  @IsArray()
  @IsInt({ each: true })
  targetIds!: number[];

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}

export class ReplaceChainDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  sourceLabel?: string;

  @IsString()
  @IsOptional()
  targetLabel?: string;

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  sourceIds?: number[];

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  targetIds?: number[];

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
