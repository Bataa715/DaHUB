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
  "weekly_report_audit",
  "weekly_report_daa",
  "weekly_report_director",
] as const;

export type ValidTool = (typeof VALID_TOOLS)[number];

/** O(1) lookup — use this for runtime `.has()` checks */
export const VALID_TOOLS_SET = new Set<string>(VALID_TOOLS);
