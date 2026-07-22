"use client";

import { useEffect, useState, useCallback } from "react";
import { tailanApi } from "@/lib/api";
import { DocxBlobViewer } from "../mine/_components/DocxBlobViewer";
import {
  Loader2,
  User,
  X,
  Eye,
  CheckCircle2,
  Clock,
  MinusCircle,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import { useLanguage } from "@/contexts/LanguageContext";

const QUARTER_NAMES = ["I", "II", "III", "IV"];

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

export default function DeptViewPage() {
  const { t, language } = useLanguage();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3));

  const [members, setMembers] = useState<MemberOverview[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberOverview | null>(
    null,
  );
  const [memberBlob, setMemberBlob] = useState<Blob | null>(null);
  const [reportMissing, setReportMissing] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
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
    setDrawerOpen(true);
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

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedMember(null);
    setMemberBlob(null);
    setReportMissing(false);
  };

  const submittedCount = members.filter((m) => m.status === "submitted").length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-violet-600/8 blur-[120px]" />
        <div className="absolute -bottom-24 -right-24 w-[420px] h-[420px] rounded-full bg-purple-600/8 blur-[100px]" />
      </div>

      {/* Drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          onClick={closeDrawer}
        />
      )}

      {/* Slide-in drawer */}
      <div
        className={`fixed top-0 right-0 h-full z-50 bg-card border-l border-border/30 shadow-2xl
          flex flex-col transition-transform duration-300
          ${drawerOpen ? "translate-x-0" : "translate-x-full"}
          w-full sm:w-[85vw] lg:w-[78vw] xl:w-[72vw]`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/30 bg-card flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
              <Eye className="h-4 w-4 text-violet-300" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] text-muted-foreground leading-none mb-0.5">
                {t("tailan_viewReportTitle")}
              </p>
              <p className="text-[15px] font-semibold text-foreground truncate leading-tight">
                {selectedMember?.userName ?? "…"}
              </p>
            </div>
          </div>
          <button
            onClick={closeDrawer}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground/70 hover:text-foreground hover:bg-foreground/10 transition-colors flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Drawer body */}
        <div className="flex-1 overflow-y-auto">
          {reportLoading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-violet-400" />
              <span className="text-muted-foreground text-sm">
                {t("tailan_reportLoading")}
              </span>
            </div>
          ) : memberBlob && !reportMissing ? (
            <DocxBlobViewer blob={memberBlob} />
          ) : (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <MinusCircle className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-muted-foreground text-sm text-center px-6">
                {selectedMember?.userName} {t("tailan_noReportSubmitted")}
              </p>
            </div>
          )}
        </div>
      </div>

      <ToolPageHeader
        href="/tools/tailan"
        icon={
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
            <Eye className="w-3.5 h-3.5 text-foreground" />
          </div>
        }
        title={t("tailan_membersView")}
        subtitle={t("tailan_membersViewDesc")}
      />

      {/* ─── Main content ──────────────────────────────────────────────────── */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        {/* Year / Quarter selectors */}
        <div className="flex items-center gap-3 mb-8 flex-wrap">
          {/* Year */}
          <div className="relative">
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="appearance-none bg-foreground/5 border border-border/30 rounded-xl
                text-foreground text-sm font-medium px-4 py-2.5 pr-8 cursor-pointer
                hover:bg-foreground/8 focus:outline-none focus:ring-2 focus:ring-violet-500/40
                transition-colors"
            >
              {[
                now.getFullYear() - 1,
                now.getFullYear(),
                now.getFullYear() + 1,
              ].map((y) => (
                <option key={y} value={y} className="bg-muted">
                  {language === "en" ? y : `${y} он`}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          </div>

          {/* Quarter */}
          <div className="flex rounded-xl overflow-hidden border border-border/30">
            {QUARTER_NAMES.map((q, i) => (
              <button
                key={q}
                onClick={() => setQuarter(i + 1)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors
                  ${
                    quarter === i + 1
                      ? "bg-violet-600 text-foreground"
                      : "bg-muted/40 text-muted-foreground hover:bg-foreground/8 hover:text-foreground"
                  }`}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Summary badge */}
          {!membersLoading && members.length > 0 && (
            <span className="ml-auto text-xs bg-violet-500/15 text-violet-300 border border-violet-500/25 rounded-full px-3 py-1.5">
              {submittedCount} / {members.length}{" "}
              {t("tailan_submitted").toLowerCase()}
            </span>
          )}
        </div>

        {/* Members grid */}
        {membersLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin text-violet-400" />
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <MinusCircle className="h-10 w-10 text-muted-foreground/60" />
            <p className="text-muted-foreground/70 text-sm">
              {t("tailan_noReportsThisQuarter")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {members.map((member) => {
              const isSubmitted = member.status === "submitted";
              return (
                <button
                  key={member.userId}
                  onClick={() => openMemberReport(member)}
                  className={`group relative flex flex-col gap-3 rounded-2xl p-5 text-left
                    bg-muted/30 hover:bg-foreground/6
                    border transition-all duration-200 cursor-pointer overflow-hidden
                    ${
                      isSubmitted
                        ? "border-border hover:border-violet-500/40 hover:shadow-[0_0_24px_rgba(139,92,246,0.10)]"
                        : "border-border/30 hover:border-amber-500/30"
                    }`}
                >
                  {/* Hover stripe */}
                  <div
                    className={`absolute left-0 inset-y-0 w-[3px] rounded-l-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200
                      bg-gradient-to-b ${isSubmitted ? "from-violet-400 to-purple-500" : "from-amber-400 to-orange-500"}`}
                  />

                  {/* Top row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-10 h-10 rounded-xl bg-muted/50 border border-border/30 flex items-center justify-center flex-shrink-0">
                      <User
                        className="h-4.5 w-4.5 text-muted-foreground"
                        style={{ width: "1.125rem", height: "1.125rem" }}
                      />
                    </div>

                    {isSubmitted ? (
                      <span className="flex items-center gap-1 text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 rounded-full px-2 py-0.5">
                        <CheckCircle2
                          style={{ width: "0.625rem", height: "0.625rem" }}
                        />
                        {t("tailan_submitted")}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/20 rounded-full px-2 py-0.5">
                        <Clock
                          style={{ width: "0.625rem", height: "0.625rem" }}
                        />
                        {t("tailan_draft")}
                      </span>
                    )}
                  </div>

                  {/* Name */}
                  <div>
                    <p className="text-[14px] font-semibold text-foreground leading-snug mb-1">
                      {member.userName}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70">
                      {isSubmitted
                        ? `${t("tailan_submittedAtLabel")} ${fmtDate(member.submittedAt)}`
                        : `${t("tailan_updatedAtLabel")} ${fmtDate(member.updatedAt)}`}
                    </p>
                  </div>

                  {/* View hint */}
                  {isSubmitted && (
                    <div className="flex items-center gap-1 text-[11px] text-violet-400/70 group-hover:text-violet-300 transition-colors">
                      <Eye style={{ width: "0.75rem", height: "0.75rem" }} />
                      {t("tailan_viewReportHint")}
                      <ChevronRight
                        style={{ width: "0.75rem", height: "0.75rem" }}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
