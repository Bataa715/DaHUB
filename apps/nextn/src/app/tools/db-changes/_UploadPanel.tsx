"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ToolPanel,
  ToolPanelBody,
  ToolPanelHeader,
  toolLabelClass,
  toolTableClass,
  toolTdClass,
  toolTheadClass,
  toolThClass,
} from "@/components/shared/tool-ui";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { dbChangesApi, getApiErrorMessage } from "@/lib/api";
import { chunkRows } from "@/lib/chunk-rows";
import { cn } from "@/lib/utils";
import { selectClass } from "./_lib/db-ui";
import {
  REQUIRED_COLUMNS,
  parseDbWorkbook,
  type ParsedDbSheet,
} from "./_lib/parse-db-excel";

type Totals = { inserted: number; duplicates: number; skipped: number };

/** Excel сонгох → хуудас сонгох → урьдчилан харах → хэсэгчлэн оруулах. */
export function UploadPanel({ onImported }: { onImported: () => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<ParsedDbSheet[]>([]);
  const [sheetName, setSheetName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);

  const sheet = sheets.find((s) => s.name === sheetName);
  const importing = progress !== null && progress.done < progress.total;

  const readFile = async (file: File) => {
    if (!/\.xlsx$/i.test(file.name)) {
      setParseError(t("nnParseError"));
      return;
    }
    setParsing(true);
    setParseError(null);
    setTotals(null);
    setProgress(null);
    try {
      const parsed = await parseDbWorkbook(await file.arrayBuffer());
      setFileName(file.name);
      setSheets(parsed);
      // Бүх багана олдсон, хамгийн олон мөртэй хуудсыг анхдагч болгоно
      const best = [...parsed]
        .filter((s) => s.missing.length === 0)
        .sort((a, b) => b.rows.length - a.rows.length)[0];
      setSheetName(best?.name ?? parsed[0]?.name ?? "");
    } catch {
      setParseError(t("nnParseError"));
      setSheets([]);
    } finally {
      setParsing(false);
    }
  };

  const runImport = async () => {
    if (!sheet || sheet.rows.length === 0) return;
    const chunks = chunkRows(sheet.rows);
    setTotals(null);
    setProgress({ done: 0, total: chunks.length });
    const sum: Totals = { inserted: 0, duplicates: 0, skipped: 0 };
    let batchId: string | undefined;
    try {
      for (const [i, rows] of chunks.entries()) {
        const res = await dbChangesApi.importRows({
          batchId,
          fileName,
          sheetName: sheet.name,
          rows,
        });
        batchId = res.batchId;
        sum.inserted += res.inserted;
        sum.duplicates += res.duplicates;
        sum.skipped += res.skipped;
        setProgress({ done: i + 1, total: chunks.length });
      }
      sum.skipped += sheet.invalid;
      setTotals(sum);
      toast({ title: t("nnImportDone") });
      onImported();
    } catch (e) {
      setProgress(null);
      toast({ title: getApiErrorMessage(e), variant: "destructive" });
      // Хэсэгчлэн орсон мөр түүхэнд харагдана — хэрэгтэй бол багцыг устгана
      if (batchId) onImported();
    }
  };

  return (
    <ToolPanel>
      <ToolPanelHeader
        icon={Upload}
        title={t("nnUploadTitle")}
        description={`${t("nnRequiredColumns")}: ${Object.values(REQUIRED_COLUMNS).join(", ")}`}
      />
      <ToolPanelBody className="space-y-5">
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) =>
            (e.key === "Enter" || e.key === " ") && inputRef.current?.click()
          }
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void readFile(file);
          }}
          className={cn(
            "flex min-h-[7rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center transition-colors",
            dragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/40 hover:bg-muted/40",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void readFile(file);
              e.target.value = "";
            }}
          />
          {parsing ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : fileName ? (
            <>
              <FileSpreadsheet className="h-6 w-6 text-emerald-500" />
              <p className="text-sm font-semibold text-foreground">
                {fileName}
              </p>
            </>
          ) : (
            <>
              <Upload className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">
                {t("nnDropHint")}
              </p>
              <p className="text-xs text-muted-foreground">XLSX</p>
            </>
          )}
        </div>

        {parseError && (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            {parseError}
          </p>
        )}

        {sheets.length > 0 && (
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className={toolLabelClass}>{t("nnSheet")}</label>
              <select
                value={sheetName}
                onChange={(e) => {
                  setSheetName(e.target.value);
                  setTotals(null);
                  setProgress(null);
                }}
                disabled={importing}
                className={selectClass}
              >
                {sheets.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            {sheet && sheet.missing.length === 0 && (
              <div className="flex gap-6 text-sm">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">
                    {t("nnValidRows")}
                  </p>
                  <p className="text-lg font-bold tabular-nums">
                    {sheet.rows.length.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">
                    {t("dbcInvalidRows")}
                  </p>
                  <p className="text-lg font-bold tabular-nums">
                    {sheet.invalid.toLocaleString()}
                  </p>
                </div>
              </div>
            )}
            <Button
              onClick={runImport}
              disabled={
                !sheet ||
                sheet.missing.length > 0 ||
                sheet.rows.length === 0 ||
                importing
              }
              className="ml-auto h-9"
              size="sm"
            >
              {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {importing
                ? `${t("nnImporting")} ${progress!.done}/${progress!.total}`
                : t("nnImport")}
            </Button>
          </div>
        )}

        {sheet && sheet.missing.length > 0 && (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-600 dark:text-amber-400">
            {t("nnMissingColumns")}: {sheet.missing.join(", ")}
          </p>
        )}

        {progress && (
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{
                width: `${(progress.done / Math.max(1, progress.total)) * 100}%`,
              }}
            />
          </div>
        )}

        {totals && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
            <span className="flex items-center gap-2 font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              {t("nnImportDone")}
            </span>
            <span>
              {t("nnInserted")}:{" "}
              <strong className="tabular-nums">{totals.inserted}</strong>
            </span>
            <span>
              {t("nnDuplicates")}:{" "}
              <strong className="tabular-nums">{totals.duplicates}</strong>
            </span>
            <span>
              {t("nnSkipped")}:{" "}
              <strong className="tabular-nums">{totals.skipped}</strong>
            </span>
          </div>
        )}

        {sheet && sheet.rows.length > 0 && !totals && (
          <div>
            <p className={toolLabelClass}>{t("nnPreview")}</p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className={toolTableClass}>
                <thead className={toolTheadClass}>
                  <tr>
                    <th className={toolThClass}>{t("dbcColTime")}</th>
                    <th className={toolThClass}>{t("dbcColUser")}</th>
                    <th className={toolThClass}>{t("dbcColAction")}</th>
                    <th className={toolThClass}>{t("dbcColOwner")}</th>
                    <th className={toolThClass}>{t("dbcColObject")}</th>
                    <th className={toolThClass}>SQL</th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.rows.slice(0, 8).map((r, i) => (
                    <tr key={i}>
                      <td
                        className={cn(
                          toolTdClass,
                          "whitespace-nowrap tabular-nums",
                        )}
                      >
                        {r.actionTime}
                      </td>
                      <td className={cn(toolTdClass, "whitespace-nowrap")}>
                        {r.username}
                      </td>
                      <td className={cn(toolTdClass, "whitespace-nowrap")}>
                        {r.action}
                      </td>
                      <td className={cn(toolTdClass, "whitespace-nowrap")}>
                        {r.owner}
                      </td>
                      <td className={cn(toolTdClass, "whitespace-nowrap")}>
                        {r.objectName}
                      </td>
                      <td className={cn(toolTdClass, "max-w-[420px]")}>
                        <span className="line-clamp-2 font-mono text-xs">
                          {r.sqlText}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </ToolPanelBody>
    </ToolPanel>
  );
}
