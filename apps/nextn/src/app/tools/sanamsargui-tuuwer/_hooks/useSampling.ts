"use client";

import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import type { DesignType, SamplingResult, GroupResult } from "../_lib/sampling";
import {
  getZ,
  calcSampleSize,
  calcStratifiedSampleSize,
  normalizeFilterValue,
  sampleWithReplacement,
  sampleWithoutReplacement,
  LARGE_EXPORT_ROW_THRESHOLD,
  buildCsvContent,
  logExportFailure,
} from "../_lib/sampling";

export function useSampling() {
  const [design, setDesign] = useState<DesignType>("srswr");
  const [confidence, setConfidence] = useState(0.95);
  const [margin, setMargin] = useState(5.0);
  const [stdDev, setStdDev] = useState(0.5);
  const [exportFilename, setExportFilename] = useState("sample_result.xlsx");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // SRSWR / SRSWOR
  const [isDragging, setIsDragging] = useState(false);
  const [fileData, setFileData] = useState<unknown[][] | null>(null);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [filterCol, setFilterCol] = useState<string>("");
  const [useColumnFilter, setUseColumnFilter] = useState(false);
  const [selectedFilterValue, setSelectedFilterValue] = useState<string>("all");
  const [coverAllValues, setCoverAllValues] = useState(false);
  const [preferSaveDialog, setPreferSaveDialog] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stratified
  const [totalVars, setTotalVars] = useState(100);
  const [numGroups, setNumGroups] = useState(2);
  const [groupSizes, setGroupSizes] = useState<number[]>([50, 50]);

  // Result
  const [result, setResult] = useState<SamplingResult | null>(null);

  const isStratified = design === "prop" || design === "nonprop";

  // Compute unique values from selected filter column
  const availableFilterValues: string[] = (() => {
    if (!useColumnFilter || !fileData || !filterCol) return [];
    const idx = fileHeaders.indexOf(filterCol);
    if (idx < 0) return [];
    const values = new Set<string>();
    for (const row of fileData) {
      values.add(normalizeFilterValue((row as unknown[])[idx]));
    }
    return Array.from(values).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
    );
  })();

  // ── File handling ────────────────────────────────────────────────────────
  const processFile = useCallback((file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setFileError("Зөвхөн Excel (.xlsx, .xls) файл оруулна уу");
      return;
    }
    setFileError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
      if (rows.length < 2) {
        setFileError("Файлд хангалттай мэдээлэл байхгүй");
        return;
      }
      const hdrs = (rows[0] as unknown[]).map((h) => String(h ?? ""));
      setFileHeaders(hdrs);
      setFileData(rows.slice(1) as unknown[][]);
      setFileName(file.name);
      setResult(null);
      setFilterCol("");
      setUseColumnFilter(false);
      setSelectedFilterValue("all");
      setCoverAllValues(false);
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleNumGroupsChange = (val: number) => {
    const n = Math.max(2, val);
    setNumGroups(n);
    setGroupSizes((prev) => {
      const next = [...prev];
      while (next.length < n) next.push(50);
      return next.slice(0, n);
    });
  };

  // ── Preview computed n ───────────────────────────────────────────────────
  const computedN = (() => {
    const Z = getZ(confidence);
    if (isStratified) return calcStratifiedSampleSize(totalVars, Z, margin);

    const baseData = fileData ?? [];
    const colIdx = filterCol ? fileHeaders.indexOf(filterCol) : -1;
    const filteredLen =
      !useColumnFilter || selectedFilterValue === "all" || colIdx < 0
        ? baseData.length
        : baseData.filter(
            (row) =>
              normalizeFilterValue((row as unknown[])[colIdx]) ===
              selectedFilterValue,
          ).length;

    if (!filteredLen) return null;
    let n = calcSampleSize(filteredLen, Z, margin, stdDev);

    if (
      useColumnFilter &&
      coverAllValues &&
      selectedFilterValue === "all" &&
      colIdx >= 0
    ) {
      n = Math.max(n, availableFilterValues.length);
    }

    return n;
  })();

  // ── Calculate ────────────────────────────────────────────────────────────
  const handleCalculate = () => {
    const Z = getZ(confidence);

    if (isStratified) {
      const N = totalVars;
      let sampleSize = calcStratifiedSampleSize(N, Z, margin);
      const groups: GroupResult[] = [];

      if (design === "prop") {
        const totalGroupSize = groupSizes.reduce((a, b) => a + b, 0);
        for (let i = 0; i < numGroups; i++) {
          const ni = Math.round(sampleSize * (groupSizes[i] / totalGroupSize));
          groups.push({
            label: `Бүлэг ${i + 1}`,
            indices: sampleWithoutReplacement(N, ni),
            size: groupSizes[i],
            rows: [],
          });
        }
      } else {
        if (sampleSize % numGroups !== 0)
          sampleSize += numGroups - (sampleSize % numGroups);
        const ni = Math.floor(sampleSize / numGroups);
        for (let i = 0; i < numGroups; i++) {
          groups.push({
            label: `Бүлэг ${i + 1}`,
            indices: sampleWithoutReplacement(N, ni),
            rows: [],
          });
        }
      }
      setResult({
        n: sampleSize,
        N,
        Z,
        design,
        confidence,
        margin,
        stdDev,
        headers: [],
        groups: groups.map((g) => ({ ...g, rows: [] })),
      });
    } else {
      const baseData = fileData ?? [];
      const colIdx = filterCol ? fileHeaders.indexOf(filterCol) : -1;

      const scopedData = baseData
        .map((row, idx) => ({ row, sourceIndex: idx + 1 }))
        .filter(({ row }) => {
          if (!useColumnFilter || selectedFilterValue === "all" || colIdx < 0) {
            return true;
          }
          return (
            normalizeFilterValue((row as unknown[])[colIdx]) ===
            selectedFilterValue
          );
        });

      const N = scopedData.length;
      if (!N) return;

      let n = calcSampleSize(N, Z, margin, stdDev);
      const sampledEntries: Array<{ sourceIndex: number; row: unknown[] }> = [];

      if (
        useColumnFilter &&
        coverAllValues &&
        selectedFilterValue === "all" &&
        colIdx >= 0
      ) {
        const valueMap = new Map<
          string,
          Array<{ sourceIndex: number; row: unknown[] }>
        >();
        for (const entry of scopedData) {
          const key = normalizeFilterValue((entry.row as unknown[])[colIdx]);
          const arr = valueMap.get(key);
          if (arr) arr.push(entry);
          else valueMap.set(key, [entry]);
        }

        const allValues = Array.from(valueMap.keys());
        n = Math.max(n, allValues.length);

        for (const v of allValues) {
          const arr = valueMap.get(v) ?? [];
          if (!arr.length) continue;
          const pick = arr[Math.floor(Math.random() * arr.length)];
          sampledEntries.push(pick);
        }
      }

      const remaining = Math.max(0, n - sampledEntries.length);
      if (remaining > 0) {
        if (design === "srswr") {
          for (let i = 0; i < remaining; i++) {
            const pick =
              scopedData[Math.floor(Math.random() * scopedData.length)];
            sampledEntries.push(pick);
          }
        } else {
          const used = new Set(sampledEntries.map((e) => e.sourceIndex));
          const available = scopedData.filter((e) => !used.has(e.sourceIndex));
          const picks = sampleWithoutReplacement(available.length, remaining);
          for (const p of picks) {
            sampledEntries.push(available[p - 1]);
          }
        }
      }

      const indices = sampledEntries.map((e) => e.sourceIndex);
      const rows = sampledEntries.map((e) => e.row ?? []);

      let groupLabel = "Түүвэр";
      if (useColumnFilter && filterCol && selectedFilterValue !== "all") {
        groupLabel = `Түүвэр ${filterCol}=${selectedFilterValue}`;
      } else if (
        useColumnFilter &&
        filterCol &&
        selectedFilterValue === "all"
      ) {
        groupLabel = `Түүвэр (${filterCol} бүх утга)`;
      }

      setResult({
        n: sampledEntries.length,
        N,
        Z,
        design,
        confidence,
        margin,
        stdDev,
        headers: fileHeaders,
        groups: [
          {
            label: groupLabel,
            indices,
            rows,
          },
        ],
      });
    }
  };

  // ── Export ───────────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (!result) return;
    setExportError(null);
    setExporting(true);

    console.info("[SanamsarguiTuuwer][Export] Download started", {
      design,
      groupCount: result.groups.length,
      sampleSize: result.n,
      requestedFilename: exportFilename || "sample_result.xlsx",
      useSaveDialog: preferSaveDialog,
    });

    const saveBlob = async (
      blob: Blob,
      filename: string,
      mime: string,
      origin: "xlsx" | "csv",
    ) => {
      const pickerWindow = window as Window & {
        showSaveFilePicker?: (options?: {
          suggestedName?: string;
          types?: Array<{
            description: string;
            accept: Record<string, string[]>;
          }>;
        }) => Promise<{
          createWritable: () => Promise<{
            write: (data: Blob) => Promise<void>;
            close: () => Promise<void>;
          }>;
        }>;
      };

      if (
        preferSaveDialog &&
        typeof pickerWindow.showSaveFilePicker === "function"
      ) {
        try {
          const handle = await pickerWindow.showSaveFilePicker({
            suggestedName: filename,
            types: [
              {
                description: origin === "xlsx" ? "Excel file" : "CSV file",
                accept: { [mime]: [origin === "xlsx" ? ".xlsx" : ".csv"] },
              },
            ],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          console.info("[SanamsarguiTuuwer][Export] Saved via File Picker", {
            filename,
            size: blob.size,
            origin,
          });
          return;
        } catch (pickerErr) {
          if (
            pickerErr &&
            typeof pickerErr === "object" &&
            "name" in pickerErr &&
            (pickerErr as { name?: string }).name === "AbortError"
          ) {
            logExportFailure(
              "User cancelled File Picker save dialog",
              pickerErr,
              {
                origin,
              },
            );
            return;
          }
          logExportFailure(
            "File Picker failed, falling back to browser download",
            pickerErr,
            { origin },
          );
        }
      }

      const nav = window.navigator as Navigator & {
        msSaveOrOpenBlob?: (blob: Blob, defaultName?: string) => boolean;
      };
      if (typeof nav.msSaveOrOpenBlob === "function") {
        nav.msSaveOrOpenBlob(blob, filename);
        console.info("[SanamsarguiTuuwer][Export] Saved via msSaveOrOpenBlob", {
          filename,
          size: blob.size,
          origin,
        });
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();

      console.info(
        "[SanamsarguiTuuwer][Export] Browser download link triggered",
        {
          filename,
          size: blob.size,
          origin,
          note: "If no save prompt appears, browser download/security settings may be blocking automatic downloads.",
        },
      );

      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    };

    try {
      const totalRows = result.groups.reduce(
        (sum, g) => sum + g.indices.length,
        0,
      );
      if (totalRows >= LARGE_EXPORT_ROW_THRESHOLD) {
        logExportFailure("Large export detected; switching to CSV", undefined, {
          totalRows,
          threshold: LARGE_EXPORT_ROW_THRESHOLD,
        });

        const csvContent = buildCsvContent(result, isStratified);
        const csvBlob = new Blob(["\uFEFF", csvContent], {
          type: "text/csv;charset=utf-8",
        });
        const csvFilename = (exportFilename || "sample_result")
          .replace(/\.xlsx$/i, "")
          .concat(".csv");
        await saveBlob(csvBlob, csvFilename, "text/csv", "csv");
        return;
      }

      const res = await fetch("/api/export-sample", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          result,
          isStratified,
          filename: exportFilename || "sample_result.xlsx",
        }),
      });
      if (!res.ok) {
        logExportFailure("API request failed", undefined, {
          status: res.status,
          statusText: res.statusText,
        });
        throw new Error(`Export failed (${res.status})`);
      }

      const blob = await res.blob();
      if (!blob.size) {
        logExportFailure("Empty file received from server");
        throw new Error("Exported file is empty");
      }

      const safeFilename = (exportFilename || "sample_result.xlsx").endsWith(
        ".xlsx",
      )
        ? exportFilename || "sample_result.xlsx"
        : `${exportFilename || "sample_result"}.xlsx`;
      await saveBlob(
        blob,
        safeFilename,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "xlsx",
      );
    } catch (err) {
      logExportFailure("Unhandled export exception", err, {
        useSaveDialog: preferSaveDialog,
      });
      const message =
        err instanceof Error
          ? err.message
          : "Excel татах үед алдаа гарлаа. Дахин оролдоно уу.";
      setExportError(message);
    } finally {
      setExporting(false);
    }
  };

  return {
    // config
    design,
    setDesign,
    confidence,
    setConfidence,
    margin,
    setMargin,
    stdDev,
    setStdDev,
    exportFilename,
    setExportFilename,
    exporting,
    exportError,
    preferSaveDialog,
    setPreferSaveDialog,
    // file
    isDragging,
    setIsDragging,
    fileData,
    fileHeaders,
    fileName,
    fileError,
    filterCol,
    setFilterCol,
    useColumnFilter,
    setUseColumnFilter,
    selectedFilterValue,
    setSelectedFilterValue,
    coverAllValues,
    setCoverAllValues,
    fileInputRef,
    processFile,
    handleDrop,
    // stratified
    totalVars,
    setTotalVars,
    numGroups,
    handleNumGroupsChange,
    groupSizes,
    setGroupSizes,
    // result
    result,
    setResult,
    isStratified,
    availableFilterValues,
    computedN,
    // actions
    handleCalculate,
    handleExport,
  };
}
