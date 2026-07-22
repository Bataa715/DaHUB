import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
} from "class-validator";

export class TailanTableColumnDto {
  @IsString()
  key: string;

  @IsString()
  label: string;

  @IsNumber()
  @IsOptional()
  width?: number;

  @IsIn(["left", "center", "right"])
  @IsOptional()
  align?: "left" | "center" | "right";

  @IsBoolean()
  @IsOptional()
  richtext?: boolean;

  @IsBoolean()
  @IsOptional()
  numeric?: boolean;
}

export class TailanSectionDefDto {
  @IsString()
  key: string;

  @IsString()
  titleMn: string;

  @IsString()
  @IsOptional()
  titleEn?: string;

  @IsString()
  @IsOptional()
  subtitleMn?: string;

  @IsIn(["main", "sub"])
  headingLevel: "main" | "sub";

  @IsIn(["richtext", "taskList", "table"])
  type: "richtext" | "taskList" | "table";

  @IsNumber()
  order: number;

  @IsIn(["portrait", "landscape"])
  @IsOptional()
  orientation?: "portrait" | "landscape";

  @IsBoolean()
  @IsOptional()
  defaultHidden?: boolean;

  @IsOptional()
  taskList?: {
    showCompletion?: boolean;
    showPeriod?: boolean;
    showDescription?: boolean;
    showImages?: boolean;
    showAverage?: boolean;
    titleLabel?: string;
    completionLabel?: string;
    periodLabel?: string;
    descriptionLabel?: string;
  };

  @IsOptional()
  table?: {
    columns: TailanTableColumnDto[];
    averageColumnKey?: string;
    showImages?: boolean;
  };
}

export class UpsertTailanTemplateDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  departmentId: string;

  @IsIn(["employee", "department"])
  scope: "employee" | "department";

  @IsString()
  name: string;

  @IsArray()
  sections: TailanSectionDefDto[];
}
