// ─── Types ───────────────────────────────────────────────────────────────────
// Legacy per-section row types (PlannedTask, Section1Dashboard, Section2Task, …)
// were removed by the Tailan dynamic template refactor — section rows are now
// generic (see useTailanGenericReport.GenericRow) and driven by the active
// TailanTemplate rather than fixed TypeScript shapes per section.
export interface RowInlineImage {
  id: string;
  dataUrl: string;
  width: number; // percentage 10–100
  height?: number; // pixels, undefined = auto
}

export interface DynSection {
  _id: string;
  order: number;
  title: string;
  content: string;
}

export interface TailanImage {
  id: string;
  filename: string;
  mimeType: string;
  uploadedAt: string;
  blobUrl?: string;
}

// ─── Utilities ────────────────────────────────────────────────────────────────
export const uid = () => Math.random().toString(36).slice(2);
export const getCurrentYear = () => new Date().getFullYear();
export const getCurrentQuarter = () =>
  Math.ceil((new Date().getMonth() + 1) / 3);
