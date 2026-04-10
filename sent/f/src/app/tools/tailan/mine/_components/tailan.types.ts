// ─── Types ───────────────────────────────────────────────────────────────────
export interface RowInlineImage {
  id: string;
  dataUrl: string;
  width: number; // percentage 10–100
  height?: number; // pixels, undefined = auto
}

export interface PlannedTask {
  _id: string;
  order: number;
  title: string;
  completion: number;
  startDate: string;
  endDate: string;
  description: string;
  images: RowInlineImage[];
}

export interface DynSection {
  _id: string;
  order: number;
  title: string;
  content: string;
}

export interface TeamActivity {
  _id: string;
  name: string;
  date: string;
}

export interface Section2Task {
  _id: string;
  order: number;
  title: string;
  result: string;
  period: string;
  completion: string;
  images: RowInlineImage[];
}

export interface Section3AutoTask {
  _id: string;
  order: number;
  title: string;
  value: string;
  rating: string;
}

export interface Section3Dashboard {
  _id: string;
  order: number;
  dashboard: string;
  value: string;
  rating: string;
}

// I.2 Шинээр хөгжүүлсэн Дашбоард хөгжүүлэлтийн чанар, үр дүн
export interface Section1Dashboard {
  _id: string;
  order: number;
  title: string; // Төлөвлөгөөт ажил
  completion: string; // Ажлын гүйцэтгэл e.g. "100%"
  period: string; // Хийгдсэн хугацаа
  summary: string; // Гүйцэтгэл /товч/
  images: RowInlineImage[];
}

export interface Section4Training {
  _id: string;
  order: number;
  training: string;
  organizer: string;
  type: string;
  date: string;
  format: string;
  hours: string;
  meetsAuditGoal: string;
  sharedKnowledge: string;
}

export interface Section5Task {
  _id: string;
  order: number;
  taskType: string;
  completedWork: string;
}

export interface Section6Activity {
  _id: string;
  order: number;
  date: string;
  activity: string;
  initiative: string;
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
