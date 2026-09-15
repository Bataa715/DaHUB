/**
 * Whitelist of valid user tool names.
 * Used in both UsersController and UsersService to prevent granting
 * fake/invented tools. [B-8]
 * Add new tools here — the change automatically propagates to both places.
 */
export const VALID_TOOLS = [
  "db_access_requester",
  "db_access_granter",
  // ⚠️ Хассан эрхүүд:
  //   `tailan`,
  //   `tailan_dept_head` → Улирлын тайлан хэрэгсэл устгагдсан
  //   `pivot`            → Санамсаргүй түүвэрт нэгтгэгдсэн (`sanamsargui-tuuwer`-ээр нээгдэнэ)
  //   `data_doc`         → Өгөгдлийн толь бичиг устгагдсан
  //   `excel_report`,
  //   `python_api_tools` → хэзээ ч эрх болгож шалгагддаггүй байсан (тайлангийн
  //                        хандалтыг `reports` + excel_report_permissions хүснэгт хянадаг)
  // allowedTools-д үлдсэн хуучин утгыг дараагийн удаа эрх хадгалахад
  // UsersController автоматаар шүүж хаяна.
  "sanamsargui-tuuwer",
  "alert_box",
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
