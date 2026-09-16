"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLanguage, type TranslationKey } from "@/contexts/LanguageContext";
import {
  getApiErrorMessage,
  networkAnalysisApi,
  type NetXdrItem,
  type NetXdrStatus,
} from "@/lib/api";
import { toolFieldClass, toolLabelClass } from "@/components/shared/tool-ui";
import { cn } from "@/lib/utils";
import {
  RiskBadge,
  XDR_STATUS_LABEL,
  XDR_STATUS_ORDER,
  XdrStatusBadge,
} from "../_components/net-ui";

const ADJUSTMENT_LABEL: Record<string, TranslationKey> = {
  privileged: "netAdjPrivileged",
  completed: "netAdjCompleted",
  response_action: "netAdjResponse",
  unknown_action: "netAdjUnknown",
  repeated_device: "netAdjRepeated",
};

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm text-foreground">{value || "—"}</p>
    </div>
  );
}

/**
 * XDR мэдэгдлийн дэлгэрэнгүй — эрсдэлийн шалтгаан, төлөв/хариуцагч засах.
 * Жагсаалтын мөр бүрэн өгөгдөлтэй тул дахин татах шаардлагагүй.
 */
export function XdrDialog({
  item,
  onClose,
  onSaved,
}: {
  item: NetXdrItem | null;
  onClose: () => void;
  onSaved: (
    patch: Pick<
      NetXdrItem,
      "notificationId" | "status" | "note" | "assignedTo"
    >,
  ) => void;
}) {
  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto rounded-2xl">
        {/* key — өөр мэдэгдэл нээхэд маягтын төлөв шинээр эхэлнэ */}
        {item && (
          <XdrDialogBody
            key={item.notificationId}
            item={item}
            onClose={onClose}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function XdrDialogBody({
  item,
  onClose,
  onSaved,
}: {
  item: NetXdrItem;
  onClose: () => void;
  onSaved: (
    patch: Pick<
      NetXdrItem,
      "notificationId" | "status" | "note" | "assignedTo"
    >,
  ) => void;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [status, setStatus] = useState<NetXdrStatus>(item.status);
  const [note, setNote] = useState(item.note);
  const [assignedTo, setAssignedTo] = useState(item.assignedTo);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await networkAnalysisApi.updateXdrStatus(item.notificationId, {
        status,
        note,
        assignedTo,
      });
      onSaved({
        notificationId: item.notificationId,
        status,
        note,
        assignedTo,
      });
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
          <span>{item.category}</span>
          <RiskBadge level={item.riskLevel} t={t} />
          <XdrStatusBadge status={item.status} t={t} />
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4 rounded-xl border border-border p-4 sm:grid-cols-3">
          <Meta label={t("netColTime")} value={item.detectedAt} />
          <Meta label={t("netColDevice")} value={item.device} />
          <Meta label={t("netColUser")} value={item.userName} />
          <Meta label="Keyword" value={item.actionKeyword} />
          <Meta label="Alert ID" value={item.alertId} />
          <Meta label="Source" value={item.detectionSource} />
        </div>

        <div>
          <p className={toolLabelClass}>{t("netDetailWhy")}</p>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              Base: {item.baseRisk}
            </span>
            {item.adjustments.map((a) => (
              <span
                key={a}
                className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400"
              >
                +1 · {ADJUSTMENT_LABEL[a] ? t(ADJUSTMENT_LABEL[a]) : a}
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className={toolLabelClass}>{t("netDetailRawText")}</p>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-muted/40 p-3 text-xs text-foreground">
            {item.rawText || t("netDetailEmpty")}
          </pre>
          {/^https:\/\//i.test(item.investigationUrl) && (
            <a
              href={item.investigationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t("netDetailOpenInDefender")}
            </a>
          )}
        </div>

        <div className="space-y-4 rounded-xl border border-border p-4">
          <div className="flex flex-wrap gap-1.5">
            {XDR_STATUS_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                aria-pressed={status === s}
                className={cn(
                  "h-8 rounded-full px-3.5 text-xs font-semibold transition-colors",
                  status === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {t(XDR_STATUS_LABEL[s])}
              </button>
            ))}
          </div>
          <div>
            <label className={toolLabelClass}>{t("netDetailAssignedTo")}</label>
            <Input
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              maxLength={255}
              className={toolFieldClass}
            />
          </div>
          <div>
            <label className={toolLabelClass}>{t("netDetailNote")}</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              rows={3}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {item.reviewedByName
                ? `${t("netDetailReviewedBy")}: ${item.reviewedByName} · ${item.reviewedAt}`
                : ""}
            </p>
            <Button onClick={save} disabled={saving} size="sm">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("netDetailSave")}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
