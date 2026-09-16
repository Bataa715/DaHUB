"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LayoutDashboard, Newspaper } from "lucide-react";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import { TOOL_CONTAINER } from "@/components/shared/tool-ui";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAllowedTools } from "@/hooks/use-allowed-tools";
import { negativeNewsApi, type NegativeNewsBatch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { UploadPanel } from "./_UploadPanel";
import { BatchHistory } from "./_BatchHistory";

/**
 * Сөрөг мэдээ — бүртгэл оруулах хэрэгсэл. Үр дүн нь Дашбоард хэсгийн
 * "Сөрөг мэдээний дашбоард"-д харагдана.
 */
export default function NegativeNewsToolPage() {
  const { t } = useLanguage();
  const { canAccess } = useAllowedTools();
  const [batches, setBatches] = useState<NegativeNewsBatch[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  // Түүхийг ачаална — setState зөвхөн promise callback дотор
  useEffect(() => {
    let cancelled = false;
    negativeNewsApi
      .listBatches()
      .then((rows) => {
        if (!cancelled) setBatches(rows);
      })
      .catch(() => {
        if (!cancelled) setBatches([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  const refresh = useCallback(() => {
    setLoading(true);
    setVersion((v) => v + 1);
  }, []);

  return (
    <div className="min-h-full bg-background text-foreground">
      <ToolPageHeader
        icon={<Newspaper className="h-4 w-4 text-rose-400" />}
        title={t("nnToolTitle")}
        rightContent={
          canAccess(["negative_news_dashboard"]) ? (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <Link href="/tools/negative-news/dashboard">
                <LayoutDashboard className="h-3.5 w-3.5" />
                {t("nnOpenDashboard")}
              </Link>
            </Button>
          ) : null
        }
      />
      <div className={cn(TOOL_CONTAINER, "space-y-5 py-6")}>
        <UploadPanel onImported={refresh} />
        <BatchHistory batches={batches} loading={loading} onChanged={refresh} />
      </div>
    </div>
  );
}
