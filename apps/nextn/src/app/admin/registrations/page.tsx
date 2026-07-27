"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { registrationRequestsApi, getApiErrorMessage } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import AdminPageHeader from "@/components/shared/AdminPageHeader";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  KeyRound,
} from "lucide-react";
import { useLanguage, TranslationKey } from "@/contexts/LanguageContext";

interface RegistrationRequest {
  id: string;
  userId: string;
  name: string;
  department: string;
  position: string;
  status: "pending" | "approved" | "rejected";
  reviewedByName: string | null;
  reviewNote: string | null;
  requestedAt: string;
  reviewedAt: string | null;
}

type StatusFilter = "pending" | "approved" | "rejected" | "all";

const TABS: { key: StatusFilter; labelKey: TranslationKey }[] = [
  { key: "pending", labelKey: "admRegPendingTab" },
  { key: "approved", labelKey: "admRegApprovedTab" },
  { key: "rejected", labelKey: "dbManageStatusRejected" },
  { key: "all", labelKey: "admRegAllTab" },
];

export default function RegistrationRequestsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Reject dialog
  const [rejectTarget, setRejectTarget] = useState<RegistrationRequest | null>(
    null,
  );
  const [rejectNote, setRejectNote] = useState("");

  // Approve result dialog (shows the one-time claim code to relay)
  const [approvedResult, setApprovedResult] = useState<{
    userId: string;
    name: string;
    claimToken: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const loadRequests = useCallback(async () => {
    try {
      const data = await registrationRequestsApi.list(
        filter === "all" ? undefined : filter,
      );
      setRequests(data || []);
    } catch (e: unknown) {
      toast({
        title: t("error"),
        description: getApiErrorMessage(e),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [filter, toast, t]);

  useEffect(() => {
    setIsLoading(true);
    loadRequests();
  }, [loadRequests]);

  const handleApprove = async (req: RegistrationRequest) => {
    setBusyId(req.id);
    try {
      const result = await registrationRequestsApi.review(req.id, "approve");
      setApprovedResult({
        userId: result.userId,
        name: result.name,
        claimToken: result.claimToken,
      });
      toast({
        title: t("admRegApprovedToastTitle"),
        description: `${req.name} (${req.userId}) ${t("admRegUserCreatedSuffix")}`,
      });
      loadRequests();
    } catch (e: unknown) {
      toast({
        title: t("error"),
        description: getApiErrorMessage(e),
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setBusyId(rejectTarget.id);
    try {
      await registrationRequestsApi.review(
        rejectTarget.id,
        "reject",
        rejectNote.trim() || undefined,
      );
      toast({
        title: t("admRegRejectedToastTitle"),
        description: `${rejectTarget.name} (${rejectTarget.userId}) ${t("admRegRequestRejectedSuffix")}`,
      });
      setRejectTarget(null);
      setRejectNote("");
      loadRequests();
    } catch (e: unknown) {
      toast({
        title: t("error"),
        description: getApiErrorMessage(e),
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleCopy = async () => {
    if (!approvedResult) return;
    try {
      await navigator.clipboard.writeText(approvedResult.claimToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be unavailable — user can still select+copy manually */
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user?.isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <AdminPageHeader
        title={t("admRegPageTitle")}
        rightContent={
          <span className="text-muted-foreground/60 text-xs">
            {requests.length} {t("admRegRequestUnit")}
          </span>
        }
      />

      <div className="max-w-[1000px] mx-auto px-4 py-6">
        {/* Filter tabs */}
        <div className="flex gap-1 mb-5 border-b border-border">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                filter === tab.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        {requests.length === 0 ? (
          <p className="text-muted-foreground/40 text-sm text-center py-20">
            {t("admRegNotFound")}
          </p>
        ) : (
          <div className="grid gap-2">
            {requests.map((req) => (
              <div
                key={req.id}
                className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {req.name}
                    </p>
                    <code className="text-xs font-mono text-muted-foreground">
                      {req.userId}
                    </code>
                  </div>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">
                    {req.department} · {req.position}
                  </p>
                  {req.status !== "pending" && (
                    <p className="text-[11px] text-muted-foreground/50 mt-1">
                      {req.status === "approved"
                        ? t("admRegApprovedByLabel")
                        : t("dbManageStatusRejected")}
                      : {req.reviewedByName || "—"}
                      {req.reviewNote ? ` · ${req.reviewNote}` : ""}
                    </p>
                  )}
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {req.status === "pending" && (
                    <span className="flex items-center gap-1 text-xs text-amber-500">
                      <Clock className="w-3.5 h-3.5" />
                      {t("admRegPendingTab")}
                    </span>
                  )}
                  {req.status === "approved" && (
                    <span className="flex items-center gap-1 text-xs text-emerald-500">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {t("admRegApprovedTab")}
                    </span>
                  )}
                  {req.status === "rejected" && (
                    <span className="flex items-center gap-1 text-xs text-red-400">
                      <XCircle className="w-3.5 h-3.5" />
                      {t("dbManageStatusRejected")}
                    </span>
                  )}

                  {req.status === "pending" && (
                    <>
                      <button
                        onClick={() => handleApprove(req)}
                        disabled={busyId === req.id}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 disabled:opacity-40 transition-colors"
                      >
                        {busyId === req.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          t("dbManageApprove")
                        )}
                      </button>
                      <button
                        onClick={() => setRejectTarget(req)}
                        disabled={busyId === req.id}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-40 transition-colors"
                      >
                        {t("dbManageReject")}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reject dialog */}
      <Dialog
        open={!!rejectTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
            setRejectNote("");
          }
        }}
      >
        <DialogContent className="bg-background border-border text-foreground max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("admRegRejectDialogTitle")}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              <span className="text-foreground font-medium">
                {rejectTarget?.name}
              </span>{" "}
              ({rejectTarget?.userId})
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-muted-foreground text-xs mb-1.5 block">
              {t("admRegReasonOptionalLabel")}
            </Label>
            <Textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder={t("admRegRejectReasonPlaceholder")}
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground/50"
            />
          </div>
          <DialogFooter className="gap-2">
            <button
              onClick={() => {
                setRejectTarget(null);
                setRejectNote("");
              }}
              disabled={busyId === rejectTarget?.id}
              className="flex-1 py-2 text-sm text-muted-foreground border border-border rounded-xl hover:bg-muted transition-colors"
            >
              {t("cancel")}
            </button>
            <button
              onClick={handleReject}
              disabled={busyId === rejectTarget?.id}
              className="flex-1 py-2 text-sm font-semibold bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-2"
            >
              {busyId === rejectTarget?.id && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              {t("dbManageReject")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve result dialog — one-time claim code, shown only now */}
      <Dialog
        open={!!approvedResult}
        onOpenChange={(open) => !open && setApprovedResult(null)}
      >
        <DialogContent className="bg-background border-border text-foreground max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-emerald-500" />
              {t("admRegClaimCodeTitle")}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              <span className="text-foreground font-medium">
                {approvedResult?.name}
              </span>{" "}
              ({approvedResult?.userId}) — {t("admRegClaimCodeDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-xl border border-border">
              <code className="text-sm font-mono text-foreground flex-1 break-all select-all">
                {approvedResult?.claimToken}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                title={t("admRegCopyBtnTooltip")}
                aria-label={t("admRegCopyCodeAriaLabel")}
                className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setApprovedResult(null)}
              className="w-full py-2 text-sm font-semibold bg-foreground text-background rounded-xl"
            >
              {t("loginGotItBtn")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
