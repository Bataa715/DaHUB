"use client";

import { Building2, Hammer } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import ToolPageHeader from "@/components/shared/ToolPageHeader";

// Салбарын аудит — одоогоор хоосон. Өгөгдлийг Python runner-аар биш,
// ClickHouse дээрх хүснэгтээс шууд SELECT хийж харуулахаар хөгжүүлнэ.
// Эрхийн id нь "reports" хэвээр — users.allowedTools-д хадгалагдсан DB өгөгдөл.
export default function BranchAuditPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-full bg-background text-foreground">
      <ToolPageHeader
        href="/"
        icon={<Building2 className="w-4 h-4 text-emerald-500" />}
        title={t("toolBranchAuditTitle")}
      />

      <div className="mx-auto w-full min-w-0 max-w-[1600px] px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Hammer className="w-7 h-7 opacity-50" />
          </div>
          <p className="font-semibold text-sm text-foreground">
            {t("branchAuditEmptyTitle")}
          </p>
          <p className="text-xs mt-1">{t("branchAuditEmptyHint")}</p>
        </div>
      </div>
    </div>
  );
}
