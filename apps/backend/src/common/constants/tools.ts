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
  //   `python_api_tools` → Python тайлангийн систем бүхэлдээ устгагдсан
  //                        (`reports` эрх нь одоо "Салбарын аудит" хэрэгслийг нээнэ)
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
  // ── DAG news ───────────────────────────────────────────────────────────
  // Уншихад эрх шаардлагагүй — зөвхөн үүсгэхэд:
  //   medleg_write → Мэдлэг хуваалцах (нийтлэл нийтлэх)
  //   quiz_write   → Quiz үүсгэх
  "medleg_write",
  "quiz_write",
  // ── Сүлжээний шинжилгээ (дашбоард) ───────────────────────────────────────
  //   net_config_changes → Palo Alto тохиргооны өөрчлөлт
  //   net_xdr            → Microsoft Defender XDR мэдэгдэл
  "net_config_changes",
  "net_xdr",
  // ── Сөрөг мэдээ ──────────────────────────────────────────────────────────
  //   negative_news_upload    → Excel-ээр бүртгэл оруулах (Хэрэгсэл)
  //   negative_news_dashboard → Шинжилгээний дашбоард
  "negative_news_upload",
  "negative_news_dashboard",
  // ── Өгөгдлийн сангийн өөрчлөлт (Oracle audit trail) ──────────────────────
  //   db_changes_upload    → Excel оруулах, бичлэг хянаж тэмдэглэх (Хэрэгсэл)
  //   db_changes_dashboard → Шинжилгээний дашбоард
  "db_changes_upload",
  "db_changes_dashboard",
] as const;

/** O(1) lookup — use this for runtime `.has()` checks */
export const VALID_TOOLS_SET = new Set<string>(VALID_TOOLS);
