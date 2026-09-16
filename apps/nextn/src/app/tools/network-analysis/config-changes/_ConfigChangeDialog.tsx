"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getApiErrorMessage,
  networkAnalysisApi,
  type NetConfigChangeDetail,
  type NetReviewStatus,
} from "@/lib/api";
import { toolLabelClass } from "@/components/shared/tool-ui";
import { cn } from "@/lib/utils";
import {
  REVIEW_LABEL,
  REVIEW_ORDER,
  ReviewBadge,
  RiskBadge,
} from "../_components/net-ui";

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm text-foreground">{value || "—"}</p>
    </div>
  );
}

function ValueBlock({
  title,
  value,
  empty,
}: {
  title: string;
  value: string;
  empty: string;
}) {
  return (
    <div className="min-w-0">
      <p className={toolLabelClass}>{title}</p>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-border bg-muted/40 p-3 font-mono text-xs text-foreground">
        {value || empty}
      </pre>
    </div>
  );
}

/** Нэг өөрчлөлтийн дэлгэрэнгүй — өмнөх/дараах утга, аудиторын хяналт. */
export function ConfigChangeDialog({
  seqno,
  onClose,
  onSaved,
}: {
  seqno: string | null;
  onClose: () => void;
  onSaved: (
    seqno: string,
    patch: { reviewStatus: NetReviewStatus; description: string },
  ) => void;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [detail, setDetail] = useState<NetConfigChangeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<NetReviewStatus>("pending");
  const [description, setDescription] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!seqno) return;
    let cancelled = false;
    networkAnalysisApi
      .getConfigChange(seqno)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        setStatus(d.reviewStatus);
        setDescription(d.description);
        setComment(d.comment);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(getApiErrorMessage(e));
      });
    return () => {
      cancelled = true;
      setDetail(null);
    };
  }, [seqno]);

  const save = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      await networkAnalysisApi.reviewConfigChange(detail.seqno, {
        reviewStatus: status,
        description,
        comment,
      });
      onSaved(detail.seqno, { reviewStatus: status, description });
      toast({ title: t("netDetailSaved") });
      onClose();
    } catch (e) {
      toast({ title: getApiErrorMessage(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!seqno} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
            <span className="font-mono">#{seqno}</span>
            {detail && <RiskBadge level={detail.riskLevel} t={t} />}
            {detail && <ReviewBadge status={detail.reviewStatus} t={t} />}
          </DialogTitle>
        </DialogHeader>

        {error ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            {error}
          </p>
        ) : !detail ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 rounded-xl border border-border p-4 sm:grid-cols-4">
              <Meta label={t("netColTime")} value={detail.receiveTime} />
              <Meta label={t("netColDevice")} value={detail.deviceName} />
              <Meta label={t("netColAdmin")} value={detail.adminUsername} />
              <Meta label="IP" value={detail.adminSourceIp} />
              <Meta label={t("netColCmd")} value={detail.cmd} />
              <Meta label={t("netDetailResult")} value={detail.result} />
              <Meta
                label={t("netDetailClient")}
                value={detail.adminClientType}
              />
              <Meta
                label={t("netDetailRule")}
                value={detail.riskRule ?? t("netDetailNoRule")}
              />
            </div>

            <div>
              <p className={toolLabelClass}>{t("netColPath")}</p>
              <p className="break-all rounded-xl border border-border bg-muted/40 p-3 font-mono text-xs text-foreground">
                {detail.path || "—"}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ValueBlock
                title={t("netDetailBefore")}
                value={detail.before}
                empty={t("netDetailEmpty")}
              />
              <ValueBlock
                title={t("netDetailAfter")}
                value={detail.after}
                empty={t("netDetailEmpty")}
              />
            </div>

            <div className="space-y-4 rounded-xl border border-border p-4">
              <div className="flex flex-wrap gap-1.5">
                {REVIEW_ORDER.map((s) => (
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
                    {t(REVIEW_LABEL[s])}
                  </button>
                ))}
              </div>
              <div>
                <label className={toolLabelClass}>
                  {t("netDetailDescription")}
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={4000}
                  rows={3}
                />
              </div>
              <div>
                <label className={toolLabelClass}>
                  {t("netDetailComment")}
                </label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={2000}
                  rows={2}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {detail.reviewedByName
                    ? `${t("netDetailReviewedBy")}: ${detail.reviewedByName} · ${detail.reviewedAt}`
                    : ""}
                </p>
                <Button onClick={save} disabled={saving} size="sm">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("netDetailSave")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
