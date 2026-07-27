import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsEnum,
  IsObject,
  ValidateNested,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";

export class DynamicSectionDto {
  @IsNumber()
  order: number;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  content?: string;
}

// ─── Generic, template-driven report save/preview payload ─────────────────────
// Replaces the old per-section (plannedTasks/section2Tasks/…) fields — section
// data is now a free-form map keyed by the active TailanTemplate's section
// keys (see apps/backend/src/tailan-template). Shape per section `type`:
//   richtext -> string
//   taskList -> Array<{ _id, order, title, completion?, period?, description?, images? }>
//   table    -> Array<{ _id, order, [columnKey]: string }>
export class SaveTailanDto {
  @IsNumber()
  year: number;

  @IsNumber()
  @Min(1)
  @Max(4)
  quarter: number;

  @IsObject()
  sections: Record<string, unknown>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DynamicSectionDto)
  @IsOptional()
  dynamicSections?: DynamicSectionDto[];

  @IsArray()
  @IsOptional()
  hiddenSections?: string[]; // e.g. ["s2", "s4", "dyn_0"]

  @IsEnum(["draft", "submitted"])
  @IsOptional()
  status?: "draft" | "submitted";
}

// Same shape as SaveTailanDto but never persisted — used for the live "real
// docx" preview while editing (Phase 1-3 of the Tailan dynamic template plan).
export class PreviewTailanDto extends SaveTailanDto {}

// [H-9] Top-level shape validation for the dept-head "merged data → Word" export.
// The nested arrays feed a docx-builder that tolerates loosely-shaped items
// (many optional fields rendered defensively), so we validate structure
// (types + array-ness) here rather than every leaf field.
export class GenerateDeptWordFromDataDto {
  @IsNumber()
  @Type(() => Number)
  year: number;

  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(4)
  quarter: number;

  @IsArray()
  tasks: unknown[];

  @IsArray()
  sections: unknown[];

  @IsArray()
  otherEntries: unknown[];

  @IsArray()
  activities: unknown[];

  @IsString()
  @IsOptional()
  departmentName?: string;

  @IsOptional()
  rawSections?: Record<string, unknown>;
}
