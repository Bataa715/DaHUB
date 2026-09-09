"use client";

import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Зайны аудитын дэд хэрэгслийн эрх.
 *
 * Дэд хэрэгсэл тус бүр өөрийн эрхтэй — хоёуланг нь олгож болно.
 *
 * ⚠️ Энэ нь зөвхөн UI-г цэгцлэх зорилготой. Жинхэнэ хамгаалалт нь backend
 * дээрх `@RequireTools(...)` — эндхийг тойрч API руу шууд хандсан ч 403 өгнө.
 */
export const ZA_TOOL_RPT = "zainii_audit_rpt";
export const ZA_TOOL_EXPENSE = "zainii_audit_expense";

export interface ZainiiAuditAccess {
  canRelatedParty: boolean;
  canExpense: boolean;
  /** Хоёулангийнх нь эрхгүй — хуудсыг нээх ёсгүй хэрэглэгч */
  hasNone: boolean;
  /** Яг нэг л дэд хэрэгсэлтэй — буцах товч/картын жагсаалт илүүц болно */
  hasOnlyOne: boolean;
}

export function useZainiiAuditAccess(): ZainiiAuditAccess {
  const { user } = useAuth();

  return useMemo(() => {
    const tools = user?.allowedTools ?? [];
    // Админ/супер админд бүх хэрэгсэл нээлттэй (ToolGuard-тай ижил дүрэм)
    const isAdmin = !!user?.isAdmin || !!user?.isSuperAdmin;

    const canRelatedParty = isAdmin || tools.includes(ZA_TOOL_RPT);
    const canExpense = isAdmin || tools.includes(ZA_TOOL_EXPENSE);
    const count = Number(canRelatedParty) + Number(canExpense);

    return {
      canRelatedParty,
      canExpense,
      hasNone: count === 0,
      hasOnlyOne: count === 1,
    };
  }, [user]);
}
