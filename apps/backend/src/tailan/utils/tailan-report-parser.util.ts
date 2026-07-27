/**
 * Shared between TailanReportsService (reads its own rows) and TailanDocxService
 * (reads a report row before rendering it to .docx) so the parsing logic for a
 * stored tailan_reports row lives in exactly one place.
 */

function safeJson(str: string, fallback: any) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/** Reads the generic sectionsData blob for a report row, falling back to
 * reconstructing it from the pre-refactor per-field JSON columns for rows
 * saved before the Tailan dynamic template migration (no DB backfill needed). */
function legacyRowToSectionsData(
  row: any,
  extra: Record<string, any>,
): Record<string, unknown> {
  if (row.sectionsDataJson) {
    const parsed = safeJson(row.sectionsDataJson, null);
    if (parsed && typeof parsed === "object") return parsed;
  }
  const plannedTasks = safeJson(row.plannedTasksJson, []);
  const toPeriod = (t: any) =>
    t?.startDate || t?.endDate
      ? `${t?.startDate ?? ""} – ${t?.endDate ?? ""}`
      : "";
  return {
    s1: (plannedTasks ?? []).map((t: any) => ({
      _id: t._id,
      order: t.order,
      title: t.title,
      completion: t.completion,
      period: toPeriod(t),
      description: t.description,
      images: t.images ?? [],
    })),
    s12: extra.section1Dashboards ?? [],
    s2: (extra.section2Tasks ?? []).map((t: any) => ({
      _id: t._id,
      order: t.order,
      title: t.title,
      completion: t.result,
      period: t.period,
      description: t.completion,
      images: t.images ?? [],
    })),
    s3: extra.section3AutoTasks ?? [],
    s32: extra.section3Dashboards ?? [],
    s4: extra.section4Trainings ?? [],
    s41: extra.section4KnowledgeText ?? "",
    s5: extra.section5Tasks ?? [],
    s6: extra.section6Activities ?? [],
    s7: extra.section7Text ?? "",
  };
}

/** Parse a stored tailan_reports row into the shape consumed by the API/renderer. */
export function parseReport(row: any) {
  const extra = safeJson(row.extraDataJson, {});
  return {
    ...row,
    dynamicSections: safeJson(row.dynamicSectionsJson, []),
    hiddenSections: extra.hiddenSections ?? [],
    sectionsData: legacyRowToSectionsData(row, extra),
  };
}
