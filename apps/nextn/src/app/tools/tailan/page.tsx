"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { tailanApi } from "@/lib/api";
import {
  FileText,
  Users,
  ChevronRight,
  Loader2,
  ScrollText,
  Eye,
} from "lucide-react";
import ToolPageHeader from "@/components/shared/ToolPageHeader";

const QUARTER_NAMES = ["I", "II", "III", "IV"];

export default function TailanPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [isDeptHead, setIsDeptHead] = useState(false);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const year = now.getFullYear();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  const qLabel = QUARTER_NAMES[quarter - 1];

  useEffect(() => {
    tailanApi
      .getRole()
      .then((r) => setIsDeptHead(r.isDeptHead))
      .catch(() => setIsDeptHead(false))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center bg-[#080d14]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          <span className="text-slate-400 text-sm">Уншиж байна…</span>
        </div>
      </div>
    );

  return (
    <div className="relative min-h-screen bg-[#080d14] overflow-hidden">

      {/* ── Ambient glow orbs ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute -bottom-24 -right-24 w-[420px] h-[420px] rounded-full bg-indigo-600/10 blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-blue-900/20 blur-[80px]" />
        {/* subtle dot grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #94a3b8 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      <ToolPageHeader
        icon={
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
            <ScrollText className="w-3.5 h-3.5 text-white" />
          </div>
        }
        title="Улирлын тайлан"
        subtitle="Улирлын ажлын тайлан бэлтгэх, нэгтгэх систем"
      />

      {/* ── Main content ── */}
      <div className="relative z-10 w-full max-w-md mx-auto px-4 py-16">

        {/* Header */}
        <div className="text-center mb-10">
          {/* icon badge */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/30 to-indigo-600/30 border border-blue-500/25 shadow-[0_0_40px_rgba(59,130,246,0.18)] mb-5">
            <ScrollText className="h-7 w-7 text-blue-300" />
          </div>

          {/* quarter badge */}
          <div className="inline-flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1 mb-4 ml-2">
            <span className="text-blue-300 text-xs font-medium tracking-wide">
              {year} · {qLabel}-р улирал
            </span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
            Улирлын тайлан
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Улирлын ажлын тайлан бэлтгэх, нэгтгэх систем
          </p>
        </div>

        {/* Cards */}
        <div className="flex flex-col gap-3">

          {/* ── Өөрийн тайлан ── */}
          <button
            onClick={() => router.push("/tools/tailan/mine")}
            className="group relative flex items-center gap-4 rounded-2xl p-5 text-left
              bg-white/[0.03] hover:bg-white/[0.06]
              border border-white/[0.07] hover:border-blue-500/40
              shadow-[0_1px_1px_rgba(0,0,0,0.3)]
              hover:shadow-[0_0_28px_rgba(59,130,246,0.12)]
              transition-all duration-250 cursor-pointer overflow-hidden"
          >
            {/* subtle left glow stripe */}
            <div className="absolute left-0 inset-y-0 w-[3px] rounded-l-2xl bg-gradient-to-b from-blue-400 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-250" />

            <div className="flex-shrink-0 w-12 h-12 rounded-xl
              bg-gradient-to-br from-blue-500/20 to-indigo-600/20
              border border-blue-500/20
              flex items-center justify-center
              group-hover:from-blue-500/30 group-hover:to-indigo-600/30
              transition-all duration-200">
              <FileText className="h-5 w-5 text-blue-300" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h2 className="text-[15px] font-semibold text-white leading-tight">
                  Өөрийн тайлан
                </h2>
                <span className="text-[10px] font-medium bg-blue-500/15 text-blue-300 border border-blue-500/20 rounded-full px-2 py-0.5">
                  Хувийн
                </span>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">
                Тайлангаа бэлтгэж хэлтсийн ахлагч руу илгээх
              </p>
            </div>

            <ChevronRight className="flex-shrink-0 h-4 w-4 text-slate-600 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all duration-200" />
          </button>

          {/* ── Хэлтсийн тайлан — dept head only ── */}
          {isDeptHead && (
            <button
              onClick={() => router.push("/tools/tailan/department")}
              className="group relative flex items-center gap-4 rounded-2xl p-5 text-left
                bg-white/[0.03] hover:bg-white/[0.06]
                border border-white/[0.07] hover:border-emerald-500/40
                shadow-[0_1px_1px_rgba(0,0,0,0.3)]
                hover:shadow-[0_0_28px_rgba(16,185,129,0.10)]
                transition-all duration-250 cursor-pointer overflow-hidden"
            >
              <div className="absolute left-0 inset-y-0 w-[3px] rounded-l-2xl bg-gradient-to-b from-emerald-400 to-teal-500 opacity-0 group-hover:opacity-100 transition-opacity duration-250" />

              <div className="flex-shrink-0 w-12 h-12 rounded-xl
                bg-gradient-to-br from-emerald-500/20 to-teal-600/20
                border border-emerald-500/20
                flex items-center justify-center
                group-hover:from-emerald-500/30 group-hover:to-teal-600/30
                transition-all duration-200">
                <Users className="h-5 w-5 text-emerald-300" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h2 className="text-[15px] font-semibold text-white leading-tight">
                    Хэлтсийн тайлан
                  </h2>
                  <span className="text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 rounded-full px-2 py-0.5">
                    Ахлагч
                  </span>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Гишүүдийн тайлануудыг нэгтгэж нэг баримт болгох
                </p>
              </div>

              <ChevronRight className="flex-shrink-0 h-4 w-4 text-slate-600 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all duration-200" />
            </button>
          )}

          {/* ── Гишүүдийн тайлан харах — dept head only ── */}
          {isDeptHead && (
            <button
              onClick={() => router.push("/tools/tailan/dept-view")}
              className="group relative flex items-center gap-4 rounded-2xl p-5 text-left
                bg-white/[0.03] hover:bg-white/[0.06]
                border border-white/[0.07] hover:border-violet-500/40
                shadow-[0_1px_1px_rgba(0,0,0,0.3)]
                hover:shadow-[0_0_28px_rgba(139,92,246,0.10)]
                transition-all duration-250 cursor-pointer overflow-hidden"
            >
              <div className="absolute left-0 inset-y-0 w-[3px] rounded-l-2xl bg-gradient-to-b from-violet-400 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-250" />

              <div className="flex-shrink-0 w-12 h-12 rounded-xl
                bg-gradient-to-br from-violet-500/20 to-purple-600/20
                border border-violet-500/20
                flex items-center justify-center
                group-hover:from-violet-500/30 group-hover:to-purple-600/30
                transition-all duration-200">
                <Eye className="h-5 w-5 text-violet-300" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h2 className="text-[15px] font-semibold text-white leading-tight">
                    Гишүүдийн тайлан харах
                  </h2>
                  <span className="text-[10px] font-medium bg-violet-500/15 text-violet-300 border border-violet-500/20 rounded-full px-2 py-0.5">
                    Харах
                  </span>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Хэлтсийн гишүүдийн илгээсэн тайлануудыг харах
                </p>
              </div>

              <ChevronRight className="flex-shrink-0 h-4 w-4 text-slate-600 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all duration-200" />
            </button>
          )}

        </div>

        {/* Footer note */}
        <p className="text-center text-slate-600 text-xs mt-8">
          {user?.name && (
            <>
              <span className="text-slate-500">{user.name}</span>
              {" · "}
            </>
          )}
          {user?.department ?? ""}
        </p>
      </div>
    </div>
  );
}
