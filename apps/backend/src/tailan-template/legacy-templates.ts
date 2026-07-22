import { TailanSectionDef, TailanTemplateScope } from "./tailan-template.types";

// ─── Legacy employee template ──────────────────────────────────────────────────
// Reproduces (in the new generic schema) the section structure that used to be
// hardcoded across tailan.service.ts / WordPreview.tsx / mine/page.tsx. This is
// seeded once as the "default" employee template so existing reports keep
// working without any data migration (extraDataJson/plannedTasksJson map onto
// these section keys — see TailanService.legacyRowToSectionsData()).
export const LEGACY_EMPLOYEE_SECTIONS: TailanSectionDef[] = [
  {
    key: "s1",
    titleMn: "Дата анализын үр дүнгээр аудитын үйл ажиллагааг дэмжсэн байдал",
    headingLevel: "main",
    type: "taskList",
    order: 10,
    taskList: {
      showDescription: true,
      showImages: true,
      titleLabel: "Төлөвлөгөөт ажил",
      descriptionLabel: "Гүйцэтгэл",
    },
  },
  {
    key: "s12",
    titleMn: "Шинээр хөгжүүлсэн Дашбоард хөгжүүлэлтийн чанар, үр дүн",
    headingLevel: "sub",
    type: "taskList",
    order: 20,
    taskList: {
      showCompletion: true,
      showPeriod: true,
      showDescription: true,
      showImages: true,
      showAverage: true,
      titleLabel: "Төлөвлөгөөт ажил",
      completionLabel: "Ажлын гүйцэтгэл",
      periodLabel: "Хийгдсэн хугацаа",
      descriptionLabel: "Гүйцэтгэл /товч/",
    },
  },
  {
    key: "s2",
    titleMn:
      "Аудитын үйл ажиллагаанд шаардлагатай өгөгдөл боловсруулалтын ажил",
    headingLevel: "main",
    type: "taskList",
    order: 30,
    taskList: {
      showCompletion: true,
      showPeriod: true,
      showDescription: true,
      showImages: true,
      titleLabel: "Төлөвлөгөөт ажлууд (Дууссан ажлууд)",
      completionLabel: "Ажлын гүйцэтгэл",
      periodLabel: "Хийгдсэн хугацаа",
      descriptionLabel: "Гүйцэтгэл /товч/",
    },
  },
  {
    key: "s3",
    titleMn: "Тогтмол хийгддэг ажлууд",
    headingLevel: "main",
    type: "table",
    order: 40,
    table: {
      columns: [
        {
          key: "title",
          label: "Тогтмол хийгддэг өгөгдөл боловсруулалт",
          width: 40,
        },
        {
          key: "value",
          label: "Өгөгдөл боловсруулалтын ажлын ач холбогдол,хэрэглээ",
          width: 35,
        },
        {
          key: "rating",
          label: "Хэрэглэгчийн нэгжийн өгсөн үнэлгээ",
          width: 20,
          numeric: true,
        },
      ],
      averageColumnKey: "rating",
    },
  },
  {
    key: "s32",
    titleMn: "Дашбоардын хэвийн ажиллагааг хангаж ажилласан байдал",
    headingLevel: "sub",
    type: "table",
    order: 50,
    table: {
      columns: [
        { key: "dashboard", label: "Дашбоард", width: 35 },
        { key: "value", label: "Дашбоардын ач холбогдол,хэрэглээ", width: 40 },
        {
          key: "rating",
          label: "Хэрэглэгч нэгжийн өгсөн үнэлгээ",
          width: 20,
          numeric: true,
        },
      ],
      averageColumnKey: "rating",
    },
  },
  {
    key: "s4",
    titleMn: "Хамрагдсан сургалт",
    headingLevel: "main",
    type: "table",
    order: 60,
    orientation: "landscape",
    table: {
      columns: [
        { key: "training", label: "Хамрагдсан сургалт", width: 22 },
        { key: "organizer", label: "Зохион байгуулагч", width: 12 },
        { key: "type", label: "Сургалтын төрөл", width: 10 },
        { key: "date", label: "Хэзээ", width: 9 },
        { key: "format", label: "Сургалтын хэлбэр", width: 9 },
        { key: "hours", label: "Цаг", width: 7 },
        {
          key: "meetsAuditGoal",
          label: "Аудитын зорилгод нийцсэн эсэх",
          width: 8,
        },
        { key: "sharedKnowledge", label: "Мэдлэгээ хуваалцсан эсэх", width: 8 },
      ],
    },
  },
  {
    key: "s41",
    titleMn: "Сургалтаас олж авсан мэдлэгээ ашиглаж буй байдал",
    headingLevel: "sub",
    type: "richtext",
    order: 70,
  },
  {
    key: "s5",
    titleMn: "Үүрэг даалгаварын биелэлт",
    headingLevel: "main",
    type: "table",
    order: 80,
    table: {
      columns: [
        { key: "taskType", label: "Ажлын төрөл", width: 35 },
        {
          key: "completedWork",
          label: "Хийгдсэн ажил",
          width: 60,
          richtext: true,
        },
      ],
    },
  },
  {
    key: "s6",
    titleMn: "Хамт олны ажил",
    headingLevel: "main",
    type: "table",
    order: 90,
    table: {
      columns: [
        { key: "date", label: "Огноо", width: 20 },
        { key: "activity", label: "Хамт олны ажил", width: 50 },
        { key: "initiative", label: "Санаачилга", width: 25 },
      ],
    },
  },
  {
    key: "s7",
    titleMn: "Шинэ санал санаачилга",
    headingLevel: "main",
    type: "richtext",
    order: 100,
  },
];

// ─── Legacy department (BSC/ТҮЗ) template ──────────────────────────────────────
// Approximates the previous SECTION_DEFS (department/_types.ts) as a generic
// template — free-form text per section (achievements/issues) plus a scoring
// table, so department heads keep a working template out of the box while
// admins can fully customize per-department going forward.
export const LEGACY_DEPARTMENT_SECTIONS: TailanSectionDef[] = [
  {
    key: "s1",
    titleMn: "ТУЗ болон аудитын хорооны төлөв байдал",
    headingLevel: "main",
    type: "richtext",
    order: 10,
  },
  {
    key: "s2",
    titleMn: "Харилцагчийн төлөв байдал",
    headingLevel: "main",
    type: "richtext",
    order: 20,
  },
  {
    key: "s3",
    titleMn: "Дотоод үйл ажиллагааны төлөв байдал",
    headingLevel: "main",
    type: "richtext",
    order: 30,
  },
  {
    key: "s4",
    titleMn: "Сургалт хөгжлийн төлөв байдал",
    headingLevel: "main",
    type: "richtext",
    order: 40,
  },
  {
    key: "kpi",
    titleMn: "Ажлын гүйцэтгэлийн нэгтгэл хүснэгт",
    headingLevel: "main",
    type: "table",
    order: 50,
    table: {
      columns: [
        { key: "indicator", label: "Үзүүлэлт", width: 50 },
        { key: "plan", label: "Төлөвлөгөө", width: 15, numeric: true },
        { key: "actual", label: "Гүйцэтгэл", width: 15, numeric: true },
        { key: "note", label: "Тайлбар", width: 20 },
      ],
    },
  },
];

export function legacySectionsFor(
  scope: TailanTemplateScope,
): TailanSectionDef[] {
  return scope === "department"
    ? LEGACY_DEPARTMENT_SECTIONS
    : LEGACY_EMPLOYEE_SECTIONS;
}
