"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { tailanApi } from "@/lib/api";
import { WordPreview } from "../mine/_components/WordPreview";
import type {
  PlannedTask,
  DynSection,
  Section2Task,
  Section3AutoTask,
  Section3Dashboard,
  Section1Dashboard,
  Section4Training,
  Section5Task,
  Section6Activity,
  TailanImage,
} from "../mine/_components/tailan.types";
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
import Link from "next/link";
import ToolPageHeader from "@/components/shared/ToolPageHeader";

const QUARTER_NAMES = ["I", "II", "III", "IV"];

interface MemberOverview {
  id: string;
  userId: string;
  userName: string;
  status: "draft" | "submitted";
  updatedAt: string;
  submittedAt: string;
}

interface MemberReport {
  userId: string;
  userName: string;
  year: number;
  quarter: number;
  plannedTasks: PlannedTask[];
  dynamicSections: DynSection[];
  section2Tasks: Section2Task[];
  section1Dashboards: Section1Dashboard[];
  section3AutoTasks: Section3AutoTask[];
  section3Dashboards: Section3Dashboard[];
  section4Trainings: Section4Training[];
  section4KnowledgeText: string;
  section5Tasks: Section5Task[];
  section6Activities: Section6Activity[];
  section7Text: string;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "–";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export default function DeptViewPage() {
  const router = useRouter();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3));

  const [members, setMembers] = useState<MemberOverview[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberOverview | null>(
    null,
  );
  const [memberReport, setMemberReport] = useState<MemberReport | null>(null);
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
    setMemberReport(null);
    setDrawerOpen(true);
    setReportLoading(true);
    try {
      const data = await tailanApi.getDeptMemberReport(
        member.userId,
        year,
        quarter,
      );
      setMemberReport(data ?? null);
    } catch {
      setMemberReport(null);
    } finally {
      setReportLoading(false);
    }
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedMember(null);
    setMemberReport(null);
  };

  const submittedCount = members.filter((m) => m.status === "submitted").length;

  return (
    <div className="min-h-screen bg-[#080d14] text-white">
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
        className={`fixed top-0 right-0 h-full z-50 bg-[#0d1219] border-l border-white/10 shadow-2xl
          flex flex-col transition-transform duration-300
          ${drawerOpen ? "translate-x-0" : "translate-x-full"}
          w-full sm:w-[85vw] lg:w-[78vw] xl:w-[72vw]`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#0d1219] flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
              <Eye className="h-4 w-4 text-violet-300" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] text-slate-400 leading-none mb-0.5">
                Тайлан харах
              </p>
              <p className="text-[15px] font-semibold text-white truncate leading-tight">
                {selectedMember?.userName ?? "…"}
              </p>
            </div>
          </div>
          <button
            onClick={closeDrawer}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Drawer body */}
        <div className="flex-1 overflow-y-auto">
          {reportLoading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-violet-400" />
              <span className="text-slate-400 text-sm">
                Тайлан ачааллаж байна…
              </span>
            </div>
          ) : memberReport ? (
            <WordPreview
              userName={memberReport.userName}
              year={memberReport.year}
              quarter={memberReport.quarter}
              plannedTasks={memberReport.plannedTasks}
              section2Tasks={memberReport.section2Tasks}
              section3AutoTasks={memberReport.section3AutoTasks}
              section3Dashboards={memberReport.section3Dashboards}
              section1Dashboards={memberReport.section1Dashboards}
              dynamicSections={memberReport.dynamicSections}
              section4Trainings={memberReport.section4Trainings}
              section4KnowledgeText={memberReport.section4KnowledgeText}
              section5Tasks={memberReport.section5Tasks}
              section6Activities={memberReport.section6Activities}
              section7Text={memberReport.section7Text}
              images={[] as TailanImage[]}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <MinusCircle className="h-8 w-8 text-slate-600" />
              <p className="text-slate-400 text-sm text-center px-6">
                {selectedMember?.userName} энэ улиралд тайлан илгээгээгүй байна.
              </p>
            </div>
          )}
        </div>
      </div>

      <ToolPageHeader
        href="/tools/tailan"
        icon={
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
            <Eye className="w-3.5 h-3.5 text-white" />
          </div>
        }
        title="Гишүүдийн тайлан харах"
        subtitle="Хэлтсийн гишүүдийн илгээсэн улирлын тайлануудыг харах"
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
              className="appearance-none bg-white/[0.05] border border-white/10 rounded-xl
                text-white text-sm font-medium px-4 py-2.5 pr-8 cursor-pointer
                hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-violet-500/40
                transition-colors"
            >
              {[
                now.getFullYear() - 1,
                now.getFullYear(),
                now.getFullYear() + 1,
              ].map((y) => (
                <option key={y} value={y} className="bg-[#1a2130]">
                  {y} он
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          </div>

          {/* Quarter */}
          <div className="flex rounded-xl overflow-hidden border border-white/10">
            {QUARTER_NAMES.map((q, i) => (
              <button
                key={q}
                onClick={() => setQuarter(i + 1)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors
                  ${
                    quarter === i + 1
                      ? "bg-violet-600 text-white"
                      : "bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-white"
                  }`}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Summary badge */}
          {!membersLoading && members.length > 0 && (
            <span className="ml-auto text-xs bg-violet-500/15 text-violet-300 border border-violet-500/25 rounded-full px-3 py-1.5">
              {submittedCount} / {members.length} илгээсэн
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
            <MinusCircle className="h-10 w-10 text-slate-700" />
            <p className="text-slate-500 text-sm">
              Энэ улиралд бүртгэсэн тайлан байхгүй
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
                    bg-white/[0.03] hover:bg-white/[0.06]
                    border transition-all duration-200 cursor-pointer overflow-hidden
                    ${
                      isSubmitted
                        ? "border-white/[0.07] hover:border-violet-500/40 hover:shadow-[0_0_24px_rgba(139,92,246,0.10)]"
                        : "border-white/[0.05] hover:border-amber-500/30"
                    }`}
                >
                  {/* Hover stripe */}
                  <div
                    className={`absolute left-0 inset-y-0 w-[3px] rounded-l-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200
                      bg-gradient-to-b ${isSubmitted ? "from-violet-400 to-purple-500" : "from-amber-400 to-orange-500"}`}
                  />

                  {/* Top row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-10 h-10 rounded-xl bg-slate-700/50 border border-white/10 flex items-center justify-center flex-shrink-0">
                      <User
                        className="h-4.5 w-4.5 text-slate-400"
                        style={{ width: "1.125rem", height: "1.125rem" }}
                      />
                    </div>

                    {isSubmitted ? (
                      <span className="flex items-center gap-1 text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 rounded-full px-2 py-0.5">
                        <CheckCircle2
                          style={{ width: "0.625rem", height: "0.625rem" }}
                        />
                        Илгээсэн
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/20 rounded-full px-2 py-0.5">
                        <Clock
                          style={{ width: "0.625rem", height: "0.625rem" }}
                        />
                        Ноорог
                      </span>
                    )}
                  </div>

                  {/* Name */}
                  <div>
                    <p className="text-[14px] font-semibold text-white leading-snug mb-1">
                      {member.userName}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {isSubmitted
                        ? `Илгээсэн: ${fmtDate(member.submittedAt)}`
                        : `Шинэчилсэн: ${fmtDate(member.updatedAt)}`}
                    </p>
                  </div>

                  {/* View hint */}
                  {isSubmitted && (
                    <div className="flex items-center gap-1 text-[11px] text-violet-400/70 group-hover:text-violet-300 transition-colors">
                      <Eye style={{ width: "0.75rem", height: "0.75rem" }} />
                      Тайлан харах
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
