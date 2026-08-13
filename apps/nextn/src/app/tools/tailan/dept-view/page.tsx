"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { tailanApi } from "@/lib/api";
import { DocxBlobViewer } from "../mine/_components/DocxBlobViewer";
import {
  Loader2,
  User,
  Eye,
  CheckCircle2,
  Clock,
  MinusCircle,
  ArrowLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface MemberOverview {
  id: string;
  userId: string;
  userName: string;
  status: "draft" | "submitted";
  updatedAt: string;
  submittedAt: string;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "–";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

const metaSelectCls =
  "bg-muted border border-border rounded-lg px-2.5 py-1 text-xs text-foreground focus:outline-none";

export default function DeptViewPage() {
  const { t, language } = useLanguage();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3));

  const [members, setMembers] = useState<MemberOverview[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [selectedMember, setSelectedMember] = useState<MemberOverview | null>(
    null,
  );
  const [memberBlob, setMemberBlob] = useState<Blob | null>(null);
  const [reportMissing, setReportMissing] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    setSelectedMember(null);
    setMemberBlob(null);
    setReportMissing(false);
    try {
      const data = await tailanApi.getDeptOverview(year, quarter);
      setMembers(data ?? []);
    } catch {
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, [year, quarter]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const openMemberReport = async (member: MemberOverview) => {
    setSelectedMember(member);
    setMemberBlob(null);
    setReportMissing(false);
    setReportLoading(true);
    try {
      const blob = await tailanApi.viewDeptMemberWord(
        member.userId,
        year,
        quarter,
      );
      setMemberBlob(blob);
    } catch {
      setReportMissing(true);
    } finally {
      setReportLoading(false);
    }
  };

  const submittedCount = members.filter((m) => m.status === "submitted").length;
  const draftCount = members.length - submittedCount;
  const qName = ["I", "II", "III", "IV"][quarter - 1] ?? String(quarter);

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-background via-card to-background overflow-hidden">
      {/* Top bar — same chrome as department / mine */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 bg-card/60 backdrop-blur-sm shrink-0">
        <Link
          href="/tools/tailan"
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("back")}
        </Link>
        <span className="text-muted-foreground/60">/</span>
        <span className="text-foreground/90 text-sm font-medium">
          {t("tailan_membersView")}
        </span>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted/70 text-foreground/80 border border-border/50">
          {language === "en"
            ? `Q${quarter} ${year}`
            : `${year} оны ${qName} улирал`}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className={metaSelectCls}
          >
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(
              (y) => (
                <option key={y} value={y}>
                  {language === "en" ? y : `${y} он`}
                </option>
              ),
            )}
          </select>
          <select
            value={quarter}
            onChange={(e) => setQuarter(Number(e.target.value))}
            className={metaSelectCls}
          >
            {[1, 2, 3, 4].map((q) => (
              <option key={q} value={q}>
                {language === "en" ? `Q${q}` : `${q}-р улирал`}
              </option>
            ))}
          </select>

          {!membersLoading && members.length > 0 && (
            <span className="text-[10px] text-muted-foreground/80 whitespace-nowrap border border-border/40 rounded-lg px-2 py-1 bg-muted/40">
              <span className="text-emerald-400 font-semibold">
                {submittedCount}
              </span>
              <span className="mx-1 text-muted-foreground/40">/</span>
              {members.length} {t("tailan_submitted").toLowerCase()}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Members sidebar */}
        <div
          className={`shrink-0 border-r border-border/50 bg-card/50 flex flex-col overflow-hidden transition-all duration-200 ${
            sidebarOpen ? "w-72" : "w-11"
          }`}
        >
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="flex items-center justify-center h-9 w-full border-b border-border/50 text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors shrink-0"
            title={
              sidebarOpen
                ? t("tailan_collapseSidebar")
                : t("tailan_expandSidebar")
            }
          >
            {sidebarOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </button>

          {sidebarOpen && (
            <div className="px-3 py-2.5 border-b border-border/40 shrink-0">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground/90">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                {t("tailan_membersView")}
              </div>
              {!membersLoading && members.length > 0 && (
                <div className="mt-2 flex gap-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                    {submittedCount} {t("tailan_submitted")}
                  </span>
                  {draftCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/20">
                      {draftCount} {t("tailan_draft")}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
            {membersLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : members.length === 0 ? (
              sidebarOpen && (
                <div className="px-2 py-8 text-center text-muted-foreground/50 text-[11px]">
                  {t("tailan_noReportsThisQuarter")}
                </div>
              )
            ) : (
              members.map((member) => {
                const isSubmitted = member.status === "submitted";
                const active = selectedMember?.userId === member.userId;
                return (
                  <button
                    key={member.userId}
                    onClick={() => openMemberReport(member)}
                    title={!sidebarOpen ? member.userName : undefined}
                    className={`flex items-start gap-2.5 w-full text-left px-2.5 py-2.5 rounded-xl transition-all duration-150 text-xs ${
                      active
                        ? isSubmitted
                          ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-200"
                          : "bg-amber-500/20 border border-amber-500/40 text-amber-200"
                        : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground/90 border border-transparent"
                    }`}
                  >
                    <div
                      className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                        active
                          ? isSubmitted
                            ? "bg-emerald-500/20 border-emerald-500/30"
                            : "bg-amber-500/20 border-amber-500/30"
                          : "bg-muted/50 border-border/40"
                      }`}
                    >
                      <User
                        className={`h-3.5 w-3.5 ${
                          active
                            ? isSubmitted
                              ? "text-emerald-400"
                              : "text-amber-400"
                            : "text-muted-foreground/70"
                        }`}
                      />
                    </div>
                    {sidebarOpen && (
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold leading-tight truncate">
                            {member.userName}
                          </span>
                          {isSubmitted ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                          ) : (
                            <Clock className="h-3 w-3 text-amber-400/80 shrink-0" />
                          )}
                        </div>
                        <div className="text-[10px] opacity-70 mt-0.5 truncate">
                          {isSubmitted
                            ? `${t("tailan_submittedAtLabel")} ${fmtDate(member.submittedAt)}`
                            : `${t("tailan_updatedAtLabel")} ${fmtDate(member.updatedAt)}`}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Preview pane */}
        <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
          {!selectedMember ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-[#d8d8d8]/30">
              <div className="w-12 h-12 rounded-2xl bg-muted/60 border border-border/40 flex items-center justify-center">
                <Eye className="h-5 w-5 text-muted-foreground/60" />
              </div>
              <p className="text-sm text-muted-foreground/70">
                {t("tailan_viewReportHint")}
              </p>
              <p className="text-[11px] text-muted-foreground/50 max-w-xs text-center px-4">
                {t("tailan_membersViewDesc")}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-4 py-2 border-b border-border/40 bg-card/40 shrink-0">
                <div className="w-7 h-7 rounded-lg bg-muted/60 border border-border/40 flex items-center justify-center">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground leading-none mb-0.5">
                    {t("tailan_viewReportTitle")}
                  </p>
                  <p className="text-sm font-semibold text-foreground truncate">
                    {selectedMember.userName}
                  </p>
                </div>
                {selectedMember.status === "submitted" ? (
                  <span className="flex items-center gap-1 text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 rounded-full px-2 py-0.5">
                    <CheckCircle2 className="h-3 w-3" />
                    {t("tailan_submitted")}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/20 rounded-full px-2 py-0.5">
                    <Clock className="h-3 w-3" />
                    {t("tailan_draft")}
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0 overflow-hidden">
                {reportLoading ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 bg-[#d8d8d8]">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="text-muted-foreground text-sm">
                      {t("tailan_reportLoading")}
                    </span>
                  </div>
                ) : memberBlob && !reportMissing ? (
                  <DocxBlobViewer blob={memberBlob} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-3 bg-[#d8d8d8]/40">
                    <MinusCircle className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-muted-foreground text-sm text-center px-6">
                      {selectedMember.userName} {t("tailan_noReportSubmitted")}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
