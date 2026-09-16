"use client";

import { useState } from "react";
import { History, Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ToolEmpty,
  ToolPanel,
  ToolPanelHeader,
  ToolTableWrap,
  toolTableClass,
  toolTdClass,
  toolTheadClass,
  toolThClass,
} from "@/components/shared/tool-ui";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getApiErrorMessage,
  negativeNewsApi,
  type NegativeNewsBatch,
} from "@/lib/api";
import { cn } from "@/lib/utils";

/** Оруулсан багцуудын түүх — алдаатай файлыг бүхэлд нь буцааж болно. */
export function BatchHistory({
  batches,
  loading,
  onChanged,
}: {
  batches: NegativeNewsBatch[] | null;
  loading: boolean;
  onChanged: () => void;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [pending, setPending] = useState<NegativeNewsBatch | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!pending) return;
    setDeleting(true);
    try {
      await negativeNewsApi.deleteBatch(pending.batchId);
      toast({ title: t("nnDeleted") });
      onChanged();
    } catch (e) {
      toast({ title: getApiErrorMessage(e), variant: "destructive" });
    } finally {
      setDeleting(false);
      setPending(null);
    }
  };

  return (
    <ToolPanel>
      <ToolPanelHeader icon={History} title={t("nnHistoryTitle")} />
      {loading && !batches ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !batches || batches.length === 0 ? (
        <ToolEmpty icon={History} title={t("nnHistoryEmpty")} />
      ) : (
        <ToolTableWrap className="rounded-none border-0">
          <table className={toolTableClass}>
            <thead className={toolTheadClass}>
              <tr>
                <th className={toolThClass}>{t("nnColFile")}</th>
                <th className={toolThClass}>{t("nnColPeriod")}</th>
                <th className={cn(toolThClass, "text-right")}>
                  {t("nnInserted")}
                </th>
                <th className={cn(toolThClass, "text-right")}>
                  {t("nnDuplicates")}
                </th>
                <th className={cn(toolThClass, "text-right")}>
                  {t("nnSkipped")}
                </th>
                <th className={toolThClass}>{t("nnColUploadedBy")}</th>
                <th className={toolThClass} />
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.batchId}>
                  <td className={toolTdClass}>
                    <span className="font-semibold">{b.fileName}</span>
                    {b.sheetName && (
                      <span className="block text-xs text-muted-foreground">
                        {b.sheetName}
                      </span>
                    )}
                  </td>
                  <td
                    className={cn(
                      toolTdClass,
                      "whitespace-nowrap tabular-nums",
                    )}
                  >
                    {b.newRows + b.duplicateRows > 0
                      ? `${b.minDate} — ${b.maxDate}`
                      : "—"}
                  </td>
                  <td
                    className={cn(
                      toolTdClass,
                      "text-right font-semibold tabular-nums",
                    )}
                  >
                    {b.newRows}
                  </td>
                  <td className={cn(toolTdClass, "text-right tabular-nums")}>
                    {b.duplicateRows}
                  </td>
                  <td className={cn(toolTdClass, "text-right tabular-nums")}>
                    {b.skippedRows}
                  </td>
                  <td className={cn(toolTdClass, "whitespace-nowrap")}>
                    {b.uploadedByName}
                    <span className="block text-xs tabular-nums text-muted-foreground">
                      {b.createdAt}
                    </span>
                  </td>
                  <td className={cn(toolTdClass, "text-right")}>
                    <button
                      type="button"
                      onClick={() => setPending(b)}
                      aria-label={t("nnDeleteBatch")}
                      title={t("nnDeleteBatch")}
                      className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ToolTableWrap>
      )}

      <AlertDialog
        open={!!pending}
        onOpenChange={(open) => !open && !deleting && setPending(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("nnDeleteBatch")}</AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.fileName} — {t("nnDeleteConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("nnDeleteBatch")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ToolPanel>
  );
}
