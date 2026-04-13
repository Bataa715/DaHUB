"use client";
import { useState, useEffect } from "react";
import { abFetchDashboards } from "../_lib/api";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import { LayoutDashboard, Loader2 } from "lucide-react";

interface Dashboard {
  id: number;
  name: string;
  tableName: string;
  cifColumn: string;
  dateColumn: string | null;
  amountColumn: string | null;
  enabled: boolean;
}

export default function DashboardsPage() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    abFetchDashboards()
      .then(setDashboards)
      .catch((e) => setError(e?.message || "Алдаа гарлаа"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <ToolPageHeader
        href="/tools"
        icon={<LayoutDashboard size={16} className="text-violet-400" />}
        title="Dashboards"
        subtitle={`Oracle хяналтын ${dashboards.length} dashboard`}
      />

      <div className="px-6">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-golomt-400" />
            <span className="text-[12px] text-txt-dim ml-3">
              Уншиж байна...
            </span>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-[12px] text-red-400">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="bg-surface-card rounded-xl border border-surface-border overflow-hidden divide-y divide-surface-border/50">
            {dashboards.map((d) => (
              <div
                key={d.id}
                className="flex items-start gap-4 px-4 py-3 hover:bg-surface-hover transition-colors"
              >
                <span className="flex-shrink-0 inline-flex items-center justify-center w-11 h-6 mt-0.5 rounded-md bg-golomt-500/10 border border-golomt-500/20 text-golomt-400 font-bold text-[11px]">
                  DB{d.id}
                </span>
                <span className="text-[12px] text-txt font-medium leading-relaxed">
                  {d.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
