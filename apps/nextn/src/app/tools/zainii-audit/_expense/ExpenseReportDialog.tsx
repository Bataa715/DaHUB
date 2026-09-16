"use client";

import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";

/** Гүйлгээний анализын Word тайлан — дугаар, дүгнэлт оруулж татах. */
export function ExpenseReportDialog({
  reportDialogOpen,
  setReportDialogOpen,
  downloadingReport,
  reportNumber,
  setReportNumber,
  reportConclusion,
  setReportConclusion,
  downloadReport,
}: {
  reportDialogOpen: boolean;
  setReportDialogOpen: (open: boolean) => void;
  downloadingReport: boolean;
  reportNumber: string;
  setReportNumber: (value: string) => void;
  reportConclusion: string;
  setReportConclusion: (value: string) => void;
  downloadReport: () => Promise<void>;
}) {
  const { t } = useLanguage();
  return (
    <Dialog
      open={reportDialogOpen}
      onOpenChange={(open) => {
        if (!downloadingReport) setReportDialogOpen(open);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-600" />
            {t("zaExpReportDialogTitle")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              {t("zaExpReportNumberLabel")}
            </label>
            <Input
              value={reportNumber}
              onChange={(e) => setReportNumber(e.target.value)}
              disabled={downloadingReport}
              placeholder={t("zaExpReportNumberPlaceholder")}
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              {t("zaExpConclusionLabel")}
            </label>
            <Textarea
              value={reportConclusion}
              onChange={(e) => setReportConclusion(e.target.value)}
              rows={10}
              disabled={downloadingReport}
              placeholder={t("zaExpConclusionPlaceholder")}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setReportDialogOpen(false)}
            disabled={downloadingReport}
          >
            {t("cancel")}
          </Button>
          <Button
            onClick={() => void downloadReport()}
            disabled={downloadingReport}
          >
            {downloadingReport && (
              <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
            )}
            {t("zaExpReportDownloadBtn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
