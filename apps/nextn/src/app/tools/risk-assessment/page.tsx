"use client";

import { useRouter } from "next/navigation";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { ShieldAlert, ClipboardList, Table as TableIcon, ChevronRight } from "lucide-react";

export default function RiskAssessmentPage() {
  const { user } = useAuth();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-rose-500/[0.02] text-foreground flex flex-col">
      <ToolPageHeader
        href="/tools"
        icon={<ShieldAlert className="w-4 h-4 text-rose-500" />}
        title="Эрсдэлийн үнэлгээ"
        subtitle="RISKASSESSMENT.BranchRiskass — салбарын үнэлгээ"
      />
      <div className="container mx-auto px-4 py-10 flex-1 max-w-[900px]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Card 1: Эрсдэлийн үнэлгээ */}
          <button
            onClick={() => router.push("/tools/risk-assessment/report")}
            className="group rounded-2xl border border-border bg-card shadow-sm hover:shadow-md hover:border-rose-500/40 transition-all text-left p-6 flex flex-col gap-4"
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <ClipboardList className="w-6 h-6 text-rose-500" />
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground/40 group-hover:text-rose-500 group-hover:translate-x-0.5 transition-all" />
            </div>
            <div>
              <div className="text-base font-semibold text-foreground mb-1">Эрсдэлийн үнэлгээ</div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                Салбаруудын нэгдсэн эрсдэлийн оноо, гарын үнэлэмж, хүснэгтэн харагдац, тайлангийн хадгалалт
              </div>
            </div>
            <span className="mt-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
              Нээх <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </button>

          {/* Card 2: Үнэлгээний дэлгэрэнгүй */}
          <button
            onClick={() => router.push("/tools/risk-assessment/detail")}
            className="group rounded-2xl border border-border bg-card shadow-sm hover:shadow-md hover:border-blue-500/40 transition-all text-left p-6 flex flex-col gap-4"
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <TableIcon className="w-6 h-6 text-blue-500" />
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground/40 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
            </div>
            <div>
              <div className="text-base font-semibold text-foreground mb-1">Үнэлгээний дэлгэрэнгүй</div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                Oracle-аас татсан бүх үзүүлэлтийн мөрүүд, Score бүлгийн шүүлтүүр, хайлт, CSV экспорт
              </div>
            </div>
            <span className="mt-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
              Нээх <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </button>
        </div>

        <p className="text-center text-muted-foreground text-xs py-10">
          {user?.name && <><span>{user.name}</span>{" · "}</>}
          {(user as any)?.department ?? ""}
        </p>
      </div>
    </div>
  );
}
