import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsEnum,
  ValidateNested,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";

export class PlannedTaskDto {
  @IsNumber()
  order: number;

  @IsString()
  title: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  completion: number;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class DynamicSectionDto {
  @IsNumber()
  order: number;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  content?: string;
}

export class TeamActivityDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  date?: string;
}

export class SaveTailanDto {
  @IsNumber()
  year: number;

  @IsNumber()
  @Min(1)
  @Max(4)
  quarter: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlannedTaskDto)
  plannedTasks: PlannedTaskDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DynamicSectionDto)
  dynamicSections: DynamicSectionDto[];

  @IsString()
  @IsOptional()
  otherWork?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeamActivityDto)
  teamActivities: TeamActivityDto[];

  @IsEnum(["draft", "submitted"])
  @IsOptional()
  status?: "draft" | "submitted";
}

export class GetTailanQueryDto {
  @IsNumber()
  @Type(() => Number)
  year: number;

  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(4)
  quarter: number;
}
