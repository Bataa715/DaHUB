"use client";

/**
 * PyCodeWorkbench — админы Python код бичих "kernel" маягийн editor.
 *  - Мөрийн дугаар, Tab/Shift+Tab, Enter auto-indent
 *  - «Шалгах» — syntax + аюулгүй байдлын шалгалт (ажиллуулахгүйгээр),
 *    алдааны мөрийг gutter дээр улайлгана
 *  - «Тест» — хадгалаагүй кодыг шууд ажиллуулж эхний 50 мөрийг харуулна
 */

import { useRef, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Play,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { pythonToolApi, getApiErrorMessage, FilterDef } from "@/lib/api";

// ── Editor ────────────────────────────────────────────────────────────────────

export function CodeEditor({
  value,
  onChange,
  minHeight = 300,
  placeholder,
  errorLine,
}: {
  value: string;
  onChange: (v: string) => void;
  minHeight?: number;
  placeholder?: string;
  /** Улайлгаж тэмдэглэх мөрийн дугаар (1-с эхэлнэ) */
  errorLine?: number | null;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const lnRef = useRef<HTMLDivElement>(null);
  const lines = value ? value.split("\n") : [""];

  const syncScroll = () => {
    if (taRef.current && lnRef.current)
      lnRef.current.scrollTop = taRef.current.scrollTop;
  };

  const setValueWithCursor = (next: string, cursor: number) => {
    onChange(next);
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (ta) ta.selectionStart = ta.selectionEnd = cursor;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = taRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const epos = ta.selectionEnd;

    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      setValueWithCursor(
        value.substring(0, s) + "    " + value.substring(epos),
        s + 4,
      );
      return;
    }

    if (e.key === "Tab" && e.shiftKey) {
      // Мөрийн эхний 4 хүртэлх зайг арилгана (dedent)
      e.preventDefault();
      const lineStart = value.lastIndexOf("\n", s - 1) + 1;
      const lineText = value.slice(lineStart);
      const spaces = Math.min(4, lineText.match(/^ */)?.[0].length ?? 0);
      if (spaces > 0) {
        setValueWithCursor(
          value.substring(0, lineStart) + value.substring(lineStart + spaces),
          Math.max(lineStart, s - spaces),
        );
      }
      return;
    }

    if (e.key === "Enter") {
      // Auto-indent: өмнөх мөрийн indentation-г хадгална, ':'-ээр төгссөн бол +4
      e.preventDefault();
      const lineStart = value.lastIndexOf("\n", s - 1) + 1;
      const currentLine = value.slice(lineStart, s);
      const baseIndent = currentLine.match(/^ */)?.[0] ?? "";
      const extra = currentLine.trimEnd().endsWith(":") ? "    " : "";
      const insert = "\n" + baseIndent + extra;
      setValueWithCursor(
        value.substring(0, s) + insert + value.substring(epos),
        s + insert.length,
      );
    }
  };

  return (
    <div className="relative flex overflow-hidden rounded-xl border border-border bg-background font-mono text-xs leading-5">
      <div
        ref={lnRef}
        className="select-none overflow-hidden border-r border-border bg-[#161b22] px-3 py-3 text-right text-muted-foreground/40"
        style={{ minWidth: "3rem" }}
        aria-hidden
      >
        {lines.map((_, i) => (
          <div
            key={i}
            className={`leading-5 ${
              errorLine === i + 1 ? "text-red-400 font-bold bg-red-500/15" : ""
            }`}
          >
            {i + 1}
          </div>
        ))}
      </div>
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        spellCheck={false}
        className="flex-1 resize-none bg-transparent py-3 pl-3 pr-3 text-foreground outline-none placeholder:text-muted-foreground/30"
        style={{ minHeight, lineHeight: "1.25rem", tabSize: 4 }}
      />
    </div>
  );
}

// ── Workbench (editor + validate + test-run) ─────────────────────────────────

type ValidateState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; warning?: string | null }
  | { kind: "error"; message: string; line?: number | null };

type PreviewState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; columns: string[]; rows: unknown[][]; totalCount: number }
  | { kind: "error"; message: string };

export function PyCodeWorkbench({
  value,
  onChange,
  connectionType,
  connectionConfig,
  dateMode,
  filtersJson,
  minHeight = 320,
}: {
  value: string;
  onChange: (v: string) => void;
  connectionType?: string;
  connectionConfig?: string;
  dateMode?: "none" | "single" | "range";
  /** Tool-д тохируулсан FilterDef[]-ийн JSON string — тест ажиллуулахад
   * жинхэнэ filter утга дамжуулах боломж олгоно (жиш: олон CIF дугаар). */
  filtersJson?: string;
  minHeight?: number;
}) {
  const [validation, setValidation] = useState<ValidateState>({ kind: "idle" });
  const [preview, setPreview] = useState<PreviewState>({ kind: "idle" });
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [testFilters, setTestFilters] = useState<Record<string, string>>({});
  const [showTestFilters, setShowTestFilters] = useState(false);

  const parsedTestFilterDefs: FilterDef[] = (() => {
    try {
      return JSON.parse(filtersJson || "[]") as FilterDef[];
    } catch {
      return [];
    }
  })();

  const runValidate = async () => {
    setValidation({ kind: "loading" });
    try {
      const res = await pythonToolApi.adminValidateCode(value);
      if (res.ok) setValidation({ kind: "ok", warning: res.warning });
      else
        setValidation({
          kind: "error",
          message: res.error ?? "Тодорхойгүй алдаа",
          line: res.line,
        });
    } catch (e) {
      setValidation({ kind: "error", message: getApiErrorMessage(e) });
    }
  };

  const runPreview = async () => {
    setPreview({ kind: "loading" });
    setValidation({ kind: "idle" });
    try {
      // "list" төрлийн filter-үүдийн raw (мөр/,-аар зааглагдсан) утгыг
      // Python талд ирэх ",".join хэлбэрт нормалчлав.
      const normalizedFilters: Record<string, string> = {};
      for (const f of parsedTestFilterDefs) {
        const raw = testFilters[f.key];
        if (raw === undefined) continue;
        normalizedFilters[f.key] =
          f.type === "list"
            ? Array.from(
                new Set(
                  raw
                    .split(/[\n,]/)
                    .map((v) => v.trim())
                    .filter(Boolean),
                ),
              ).join(",")
            : raw;
      }
      const res = await pythonToolApi.adminPreviewCode({
        code: value,
        connectionType,
        connectionConfig,
        startDate: dateMode === "none" ? undefined : startDate,
        endDate: dateMode === "range" ? endDate : undefined,
        filters: normalizedFilters,
      });
      setPreview({ kind: "ok", ...res });
    } catch (e) {
      setPreview({ kind: "error", message: getApiErrorMessage(e) });
    }
  };

  const errorLine =
    validation.kind === "error" ? (validation.line ?? null) : null;

  return (
    <div className="space-y-2">
      <CodeEditor
        value={value}
        onChange={(v) => {
          onChange(v);
          if (validation.kind !== "idle") setValidation({ kind: "idle" });
        }}
        minHeight={minHeight}
        errorLine={errorLine}
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={runValidate}
          disabled={validation.kind === "loading" || !value.trim()}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 transition-colors disabled:opacity-40"
        >
          {validation.kind === "loading" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5" />
          )}
          Шалгах
        </button>

        {dateMode !== "none" && (
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-7 text-xs rounded-lg bg-foreground/5 border border-border/40 text-foreground/80 px-2"
            />
            {dateMode === "range" && (
              <>
                <span className="text-muted-foreground/40 text-xs">→</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-7 text-xs rounded-lg bg-foreground/5 border border-border/40 text-foreground/80 px-2"
                />
              </>
            )}
          </div>
        )}

        {parsedTestFilterDefs.length > 0 && (
          <button
            type="button"
            onClick={() => setShowTestFilters((p) => !p)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-colors"
          >
            Тест утга ({parsedTestFilterDefs.length})
          </button>
        )}

        <button
          type="button"
          onClick={runPreview}
          disabled={preview.kind === "loading" || !value.trim()}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-40"
        >
          {preview.kind === "loading" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          Тест (эхний 50 мөр)
        </button>

        {/* Validate үр дүн */}
        {validation.kind === "ok" && (
          <span className="flex items-center gap-1 text-[11px] text-emerald-500">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Код зөв
            {validation.warning && (
              <span className="text-amber-500 ml-1">
                — {validation.warning}
              </span>
            )}
          </span>
        )}
        {validation.kind === "error" && (
          <span className="flex items-center gap-1 text-[11px] text-red-400">
            <XCircle className="w-3.5 h-3.5" />
            {validation.line ? `Мөр ${validation.line}: ` : ""}
            {validation.message}
          </span>
        )}
      </div>

      {showTestFilters && parsedTestFilterDefs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-3">
          {parsedTestFilterDefs.map((f) => (
            <div key={f.key} className="space-y-1">
              <label className="text-[10px] text-muted-foreground/70">
                {f.label || f.key}{" "}
                {f.type === "list" && (
                  <span className="text-violet-400">(олон утга)</span>
                )}
              </label>
              {f.type === "list" ? (
                <textarea
                  value={testFilters[f.key] ?? ""}
                  onChange={(e) =>
                    setTestFilters((p) => ({ ...p, [f.key]: e.target.value }))
                  }
                  rows={2}
                  placeholder={
                    f.placeholder ?? "R001295678\nR000657058, R001000436"
                  }
                  className="w-full text-[11px] font-mono rounded-lg bg-background border border-border/40 px-2 py-1.5 text-foreground/80 resize-y"
                />
              ) : (
                <input
                  value={testFilters[f.key] ?? ""}
                  onChange={(e) =>
                    setTestFilters((p) => ({ ...p, [f.key]: e.target.value }))
                  }
                  placeholder={f.placeholder ?? ""}
                  className="w-full h-7 text-[11px] rounded-lg bg-background border border-border/40 px-2 text-foreground/80"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Test-run үр дүн */}
      {preview.kind === "error" && (
        <div className="flex items-start gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
          <span className="text-[11px] text-red-400 whitespace-pre-wrap break-all">
            {preview.message}
          </span>
        </div>
      )}
      {preview.kind === "ok" && (
        <div className="rounded-xl border border-border/40 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-foreground/[0.03] border-b border-border/30">
            <span className="text-[11px] text-muted-foreground/70">
              Тест үр дүн — {preview.rows.length} мөр харуулав (нийт{" "}
              {preview.totalCount.toLocaleString()})
            </span>
            <button
              type="button"
              onClick={() => setPreview({ kind: "idle" })}
              className="text-[11px] text-muted-foreground/50 hover:text-foreground"
            >
              Хаах
            </button>
          </div>
          <div className="overflow-auto max-h-64">
            <table className="w-full text-[11px] font-mono">
              <thead className="sticky top-0 bg-background">
                <tr>
                  {preview.columns.map((c) => (
                    <th
                      key={c}
                      className="text-left px-2 py-1 border-b border-border/30 text-muted-foreground/70 whitespace-nowrap"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={i} className="odd:bg-foreground/[0.02]">
                    {row.map((cell, j) => (
                      <td
                        key={j}
                        className="px-2 py-1 border-b border-border/20 whitespace-nowrap max-w-[240px] truncate"
                        title={cell == null ? "" : String(cell)}
                      >
                        {cell == null ? "—" : String(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
