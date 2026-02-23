import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
} from "class-validator";
import { Type } from "class-transformer";

export class FindingDto {
  @IsString()
  number: string;

  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsString()
  @IsEnum(["Өндөр", "Дунд", "Бага"])
  riskLevel: "Өндөр" | "Дунд" | "Бага";

  @IsString()
  recommendation: string;
}

export class GenerateReportDto {
  @IsString()
  auditTitle: string;

  @IsString()
  auditType: string;

  @IsString()
  department: string;

  @IsString()
  auditStartDate: string;

  @IsString()
  auditEndDate: string;

  @IsString()
  reportDate: string;

  @IsString()
  auditorNames: string;

  @IsString()
  @IsOptional()
  supervisorName?: string;

  @IsString()
  objective: string;

  @IsString()
  scope: string;

  @IsString()
  @IsOptional()
  methodology?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FindingDto)
  findings: FindingDto[];

  @IsString()
  conclusion: string;

  @IsString()
  @IsOptional()
  referenceNumber?: string;
}
