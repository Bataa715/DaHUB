"use client";

import { useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toolLabelClass } from "@/components/shared/tool-ui";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  dbChangesApi,
  getApiErrorMessage,
  type DbChangeRecord,
  type DbChangeReviewResult,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { CommandBadge } from "./_lib/db-ui";

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm text-foreground" title={value}>
        {value || "—"}
      </p>
    </div>
  );
}

/**
 * Нэг бичлэгийн дэлгэрэнгүй + аудиторын дүгнэлт. Өмнөх системд тайланд
 * орох 5 мөрийг тайлбартай сонгодог байсан — одоо хэдийг ч тэмдэглэж болно,
 * тэмдэглэсэн бичлэгүүд дашбоардад харагдана.
 */
export function ReviewDialog({
  record,
  onClose,
  onSaved,
}: {
  record: DbChangeRecord | null;
  onClose: () => void;
  onSaved: (result: DbChangeReviewResult) => void;
}) {
  return (
    <Dialog open={!!record} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto rounded-2xl">
        {record && (
          // key: өөр бичлэг нээхэд маягт шинээр эхэлнэ
          <ReviewForm
            key={record.rowHash}
            record={record}
            onClose={onClose}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReviewForm({
  record,
  onClose,
  onSaved,
}: {
  record: DbChangeRecord;
  onClose: () => void;
  onSaved: (result: DbChangeReviewResult) => void;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [flagged, setFlagged] = useState(record.flagged);
  const [note, setNote] = useState(record.note);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await dbChangesApi.review(record.rowHash, { flagged, note });
      onSaved(res);
      toast({ title: t("netDetailSaved") });
      onClose();
    } catch (e) {
      toast({ title: getApiErrorMessage(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
          <CommandBadge command={record.sqlCommand} />
          <span>{record.objectName || record.action}</span>
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4 rounded-xl border border-border p-4 sm:grid-cols-4">
          <Meta label={t("dbcColTime")} value={record.actionTime} />
          <Meta label={t("dbcColUser")} value={record.username} />
          <Meta label={t("dbcColMachine")} value={record.machine} />
          <Meta label={t("dbcColSystem")} value={record.systemType} />
          <Meta label={t("dbcColAction")} value={record.action} />
          <Meta label={t("dbcColOwner")} value={record.owner} />
          <Meta label={t("dbcColObject")} value={record.objectName} />
          <Meta label={t("dbcColDomain")} value={record.domain} />
          {record.jira && <Meta label="Jira" value={record.jira} />}
          {record.sourceDescription && (
            <Meta
              label={t("dbcColSourceNote")}
              value={record.sourceDescription}
            />
          )}
        </div>

        <div>
          <p className={toolLabelClass}>SQL</p>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-border bg-muted/40 p-3 font-mono text-xs text-foreground">
            {record.sqlText || "—"}
          </pre>
        </div>

        <div className="space-y-3 rounded-xl border border-border p-4">
          <button
            type="button"
            onClick={() => setFlagged((v) => !v)}
            aria-pressed={flagged}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition-colors",
              flagged
                ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <Flag className={cn("h-4 w-4", flagged && "fill-current")} />
            {t("dbcFlagSuspicious")}
          </button>
          <div>
            <label className={toolLabelClass}>{t("dbcNote")}</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder={t("dbcNotePlaceholder")}
            />
          </div>
          {record.reviewedByName && (
            <p className="text-xs text-muted-foreground">
              {record.reviewedByName} · {record.reviewedAt}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("save")}
          </Button>
        </div>
      </div>
    </>
  );
}
