import { IsString, IsIn, IsOptional, IsNotEmpty } from "class-validator";

export class CreateReportTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  pythonCode: string;

  @IsIn(["none", "single", "range"])
  dateMode: "none" | "single" | "range";

  @IsString()
  @IsOptional()
  color?: string;
}

export class UpdateReportTemplateDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  pythonCode?: string;

  @IsIn(["none", "single", "range"])
  @IsOptional()
  dateMode?: "none" | "single" | "range";

  @IsString()
  @IsOptional()
  color?: string;
}

export class RunReportDto {
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;
}
