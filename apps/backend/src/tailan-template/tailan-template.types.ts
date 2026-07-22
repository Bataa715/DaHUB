// ─── Shared section/template schema ────────────────────────────────────────────
// Mirrored on the frontend at apps/nextn/src/app/tools/tailan/_lib/template.types.ts.
// Any change here must be mirrored there.

export type TailanSectionType = "richtext" | "taskList" | "table";

export type TailanTemplateScope = "employee" | "department";

export interface TailanTableColumnDef {
  key: string;
  label: string;
  width?: number; // percent, columns in a row should sum to ~100
  align?: "left" | "center" | "right";
  richtext?: boolean; // parse simple markdown-ish content (tables/line breaks)
  numeric?: boolean; // treat value as number for average calc
}

export interface TailanTaskListConfig {
  showCompletion?: boolean;
  showPeriod?: boolean;
  showDescription?: boolean;
  showImages?: boolean;
  showAverage?: boolean;
  titleLabel?: string;
  completionLabel?: string;
  periodLabel?: string;
  descriptionLabel?: string;
}

export interface TailanTableConfig {
  columns: TailanTableColumnDef[];
  averageColumnKey?: string; // if set, render an "average" row for this column
  showImages?: boolean;
}

export interface TailanSectionDef {
  key: string; // stable id, e.g. "s1", "dyn_<uuid>"
  titleMn: string;
  titleEn?: string;
  subtitleMn?: string;
  headingLevel: "main" | "sub"; // main = numbered (next roman numeral); sub = bold subheading only
  type: TailanSectionType;
  order: number;
  orientation?: "portrait" | "landscape";
  defaultHidden?: boolean;
  taskList?: TailanTaskListConfig;
  table?: TailanTableConfig;
}

export interface TailanTemplate {
  id: string;
  departmentId: string; // "default" = global fallback template
  scope: TailanTemplateScope;
  name: string;
  sections: TailanSectionDef[];
  isActive: 0 | 1;
  updatedBy: string;
  seq: number;
  updatedAt: string;
}

export const DEFAULT_DEPARTMENT_ID = "default";
