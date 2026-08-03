import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { safeParseTools } from "../../common/utils/user-utils";

/**
 * Shared across TailanReportsService / TailanImagesService / TailanDocxService
 * (and the controller) so permission logic isn't duplicated or drifted between
 * the split-out services. Pure function — no DB/state — safe to import anywhere.
 */
export function isTailanDeptHead(user: AuthenticatedUser): boolean {
  return (
    !!user.isAdmin ||
    !!user.isSuperAdmin ||
    safeParseTools(user.allowedTools).includes("tailan_dept_head")
  );
}
