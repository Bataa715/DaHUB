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

  @IsString()
  @IsOptional()
  filters?: string;

  /** Staging table: INSERT INTO this table, export from it, then TRUNCATE (e.g. BRANCH.AUDIT_S1_FINAL) */
  @IsString()
  @IsOptional()
  stagingTable?: string;

  /** Full INSERT INTO ... SELECT ... SQL for staging mode. Leave empty for normal SQL mode. */
  @IsString()
  @IsOptional()
  stagingInsertSql?: string;
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

  @IsString()
  @IsOptional()
  filters?: string;

  @IsString()
  @IsOptional()
  stagingTable?: string;

  @IsString()
  @IsOptional()
  stagingInsertSql?: string;
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

  @IsOptional()
  filters?: Record<string, string>;
}
