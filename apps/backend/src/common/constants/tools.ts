/**
 * Whitelist of valid user tool names.
 * Used in both UsersController and UsersService to prevent granting
 * fake/invented tools. [B-8]
 * Add new tools here — the change automatically propagates to both places.
 */
export const VALID_TOOLS = [
  "tailan",
  "tailan_dept_head",
  "db_access_requester",
  "db_access_granter",
  "pivot",
  "sanamsargui-tuuwer",
  "excel_report",
  "data_doc",
  "alert_box",
  "python_api_tools",
  "reports",
  "risk_assessment",
  "risk_assessment_report",
  // ── Зайны аудит ────────────────────────────────────────────────────────
  // Дэд хэрэгсэл тус бүрд тусдаа эрх — хоёуланг нь олгож болно.
  //   zainii_audit_rpt     → Харилцсан гүйлгээ
  //   zainii_audit_expense → Зардлын хяналт
  //
  // ⚠️ Хуучин нэгдсэн `monitoring_box` эрхийг БҮРМӨСӨН хассан. Тэр эрхтэй
  // байсан хэрэглэгчдэд дээрх хоёрын аль хэрэгтэйг нь дахин олгоно
  // (/admin/tools эсвэл /admin/zainii-audit).
  "zainii_audit_rpt",
  "zainii_audit_expense",
] as const;

/** O(1) lookup — use this for runtime `.has()` checks */
export const VALID_TOOLS_SET = new Set<string>(VALID_TOOLS);
