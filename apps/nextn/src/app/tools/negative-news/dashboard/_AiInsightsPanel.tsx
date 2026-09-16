"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ToolEmpty,
  ToolPanel,
  ToolPanelBody,
  ToolPanelHeader,
  toolFieldClass,
  toolLabelClass,
} from "@/components/shared/tool-ui";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getApiErrorMessage,
  negativeNewsApi,
  type NegativeNewsAiResult,
  type NegativeNewsDashboardRequest,
} from "@/lib/api";
import { cn } from "@/lib/utils";

/** Эх хуудасны "Санал болгох аргууд" — дарахад даалгаварт бичигдэнэ */
const SUGGESTIONS = [
  "хоорондоо хамгийн ойролцоо утгатай буюу ерөнхий утга давхардсан 5 мэдээг ялгаж өгөөч",
  "хамгийн их утга давхцаж буй 5 өөр мэдээг харуулаарай",
];

/**
 * Together AI шинжилгээ — өмнөх систем шиг Голомт банкны (банк сонгосон бол
 * тэр банкны) мэдээний агуулгыг даалгаврын хамт илгээнэ. Зөвхөн товч дарахад
 * дуудагдана (зардал, мэдээлэл гадагш гаргахыг хяналттай байлгана).
 */
export function AiInsightsPanel({
  filters,
}: {
  /** Дашбоардад батлагдсан шүүлтүүр — ижил мэдээн дээр шинжилнэ */
  filters: NegativeNewsDashboardRequest;
}) {
  const { t } = useLanguage();
  const [instruction, setInstruction] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NegativeNewsAiResult | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await negativeNewsApi.aiInsights({
        ...filters,
        bank: filters.bank || undefined,
        channel: filters.channel || undefined,
        category: filters.category || undefined,
        search: filters.search?.trim() || undefined,
        instruction: instruction.trim() || undefined,
      });
      setResult(res);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <ToolPanel>
      <ToolPanelHeader
        icon={Sparkles}
        title={t("nnAiTitle")}
        description={`${filters.bank || t("nnStatGolomt")} — ${t("nnAiHint")}`}
      />
      <ToolPanelBody className="space-y-4">
        <div>
          <label className={toolLabelClass}>{t("nnAiInstruction")}</label>
          <div className="flex flex-wrap gap-2">
            <Input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder={t("nnAiInstructionPlaceholder")}
              maxLength={500}
              className={cn(toolFieldClass, "min-w-[240px] flex-1")}
            />
            <Button onClick={run} disabled={running} size="sm" className="h-9">
              {running ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {running ? t("nnAiRunning") : t("nnAiRun")}
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setInstruction(s)}
                className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            {error}
          </p>
        )}

        {result ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {t("nnAiSent")}: {result.newsCount}
              {result.candidateCount > result.newsCount
                ? ` / ${result.candidateCount}`
                : ""}{" "}
              · {result.model}
            </p>
            {result.lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("nnAiNoAnswer")}
              </p>
            ) : (
              <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {result.lines.map((line, i) => (
                  <li key={i} className="px-4 py-2.5 text-sm text-foreground">
                    {line}
                  </li>
                ))}
              </ol>
            )}
          </div>
        ) : (
          !error && <ToolEmpty title={t("nnAiEmpty")} className="py-8" />
        )}
      </ToolPanelBody>
    </ToolPanel>
  );
}
