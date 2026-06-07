"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import { useLanguage } from "@/contexts/LanguageContext";
import Link from "next/link";
import {
  Search,
  Database,
  Copy,
  Check,
  Pencil,
  Loader2,
  Code2,
} from "lucide-react";
import type { DatabaseSchema } from "@/lib/data-doc-types";
import { getApiErrorMessage } from "@/lib/api";

type FilterMode = "all" | "described" | "undescribed";

const TYPE_COLORS: Record<string, string> = {
  String: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  Float32: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  Float64: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  Date: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  DateTime: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  UInt8: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  UInt16: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  UInt32: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  Int32: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  Int64: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  Decimal: "text-pink-400 bg-pink-500/10 border-pink-500/20",
};

function getTypeColor(type: string): string {
  for (const [key, cls] of Object.entries(TYPE_COLORS)) {
    if (type.includes(key)) return cls;
  }
  return "text-muted-foreground bg-card border-border";
}

export default function DataDocPage() {
  const { t } = useLanguage();
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDb, setSelectedDb] = useState("");
  const [selectedTable, setSelectedTable] = useState("");
  const [colSearch, setColSearch] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [copied, setCopied] = useState<string | null>(null);
  const [editingCol, setEditingCol] = useState<{
    table: string;
    col: string;
    value: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/schema", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data: DatabaseSchema) => {
        setSchema(data);
        if (data.databases.length > 0) setSelectedDb(data.databases[0].name);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setSaveError("Схем ачаалахад алдаа гарлаа. Хуудас шинэчлэнэ үү.");
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  const startEdit = useCallback(
    (tableName: string, colName: string, current: string) => {
      setEditingCol({
        table: tableName,
        col: colName,
        value: current === "—" ? "" : current,
      });
      setSaveError(null);
    },
    [],
  );

  const cancelEdit = useCallback(() => {
    setEditingCol(null);
    setSaveError(null);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingCol || !schema) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/schema", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: editingCol.table,
          column: editingCol.col,
          description: editingCol.value.trim() || "—",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("dataDocSaveError"));
      const db = schema.databases.find((d) =>
        d.tables.some((t) => t.name === editingCol.table),
      );
      const tbl = db?.tables.find((t) => t.name === editingCol.table);
      const col = tbl?.columns.find((c) => c.name === editingCol.col);
      if (col) col.description = editingCol.value.trim() || "";
      setEditingCol(null);
    } catch (err: unknown) {
      setSaveError(
        err instanceof Error ? err.message : getApiErrorMessage(err),
      );
    } finally {
      setSaving(false);
    }
  }, [editingCol, schema]);

  const currentDb = schema?.databases.find((db) => db.name === selectedDb);
  const currentTable = currentDb?.tables.find((t) => t.name === selectedTable);

  const filteredTables = useMemo(() => {
    if (!currentDb) return [];
    return currentDb.tables.filter(
      (t) =>
        !tableSearch ||
        t.name.toLowerCase().includes(tableSearch.toLowerCase()),
    );
  }, [currentDb, tableSearch]);

  const filteredColumns = useMemo(() => {
    if (!currentTable) return [];
    return currentTable.columns.filter((col) => {
      const matchSearch =
        !colSearch ||
        col.name.toLowerCase().includes(colSearch.toLowerCase()) ||
        col.description.toLowerCase().includes(colSearch.toLowerCase()) ||
        col.type.toLowerCase().includes(colSearch.toLowerCase());
      const matchFilter =
        filter === "all" ||
        (filter === "described" && col.description) ||
        (filter === "undescribed" && !col.description);
      return matchSearch && matchFilter;
    });
  }, [currentTable, colSearch, filter]);

  function selectDb(name: string) {
    setSelectedDb(name);
    setSelectedTable("");
    setColSearch("");
    setFilter("all");
  }

  function selectTable(name: string) {
    setSelectedTable(name);
    setColSearch("");
    setFilter("all");
  }

  function copyColName(name: string) {
    navigator.clipboard.writeText(name);
    setCopied(name);
    setTimeout(() => setCopied(null), 1200);
  }

  const describedCount =
    currentTable?.columns.filter((c) => c.description).length ?? 0;
  const totalCount = currentTable?.totalColumns ?? 0;
  const coverage =
    totalCount > 0 ? Math.round((describedCount / totalCount) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <ToolPageHeader
        icon={
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-md">
            <Database className="w-3.5 h-3.5 text-foreground" />
          </div>
        }
        title={t("dataDocDbLabel")}
        subtitle={
          schema
            ? `${schema.totalTables} ${t("dataDocDbLabel")} · ${schema.describedColumns}/${schema.totalColumns} ${t("dataDocColDesc")}`
            : undefined
        }
        rightContent={
          <Link
            href="/tools/data-doc/code"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-card hover:bg-muted border border-border rounded-lg text-foreground/80 transition-colors"
          >
            <Code2 className="w-3.5 h-3.5" />
            {t("dataDocCodeLib")}
          </Link>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Panel 1: Databases */}
        <div className="w-44 shrink-0 bg-card border-r border-border/50 flex flex-col">
          <div className="px-4 py-4 border-b border-border/50">
            <span className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest">
              {t("dataDocDbLabel")}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {schema?.databases.map((db) => {
              const isActive = db.name === selectedDb;
              return (
                <button
                  key={db.name}
                  onClick={() => selectDb(db.name)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-2.5 transition-all ${
                    isActive
                      ? "bg-muted/60 border-r-2"
                      : "hover:bg-muted/30 border-r-2 border-transparent"
                  }`}
                  style={isActive ? { borderRightColor: db.color } : {}}
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      backgroundColor: db.color,
                      boxShadow: isActive ? `0 0 6px ${db.color}80` : "none",
                    }}
                  />
                  <span
                    className={`text-sm font-mono font-semibold truncate ${
                      isActive ? "text-foreground" : "text-muted-foreground/70"
                    }`}
                  >
                    {db.name}
                  </span>
                  <span className="ml-auto text-[11px] text-muted-foreground/50 shrink-0">
                    {db.tables.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Panel 2: Tables */}
        <div className="w-52 shrink-0 border-r border-border/50 flex flex-col bg-card">
          <div className="px-3 py-3 border-b border-border/50 space-y-2">
            <span
              className="text-[11px] font-bold uppercase tracking-widest"
              style={{ color: currentDb?.color || "#64748b" }}
            >
              {selectedDb || t("dataDocSelectDb")}
            </span>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/50" />
              <input
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder={t("dataDocSearchTable") + "…"}
                className="w-full pl-7 pr-3 py-1.5 text-xs bg-muted/60 border border-border/40 rounded-lg text-foreground/80 placeholder-muted-foreground/40 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {filteredTables.map((table) => {
              const isActive = table.name === selectedTable;
              const desc = table.columns.filter((c) => c.description).length;
              const pct =
                table.totalColumns > 0
                  ? Math.round((desc / table.totalColumns) * 100)
                  : 0;
              return (
                <button
                  key={table.name}
                  onClick={() => selectTable(table.name)}
                  className={`w-full text-left px-3 py-2.5 transition-all border-r-2 ${
                    isActive
                      ? "bg-card/70 border-r-cyan-400"
                      : "hover:bg-muted/30 border-r-transparent"
                  }`}
                >
                  <div
                    className={`text-xs font-mono font-semibold truncate mb-1 ${
                      isActive ? "text-cyan-300" : "text-muted-foreground"
                    }`}
                  >
                    {table.name}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-card rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: currentDb?.color || "#06b6d4",
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground/50 shrink-0">
                      {table.totalColumns}
                    </span>
                  </div>
                </button>
              );
            })}
            {filteredTables.length === 0 && (
              <div className="px-4 py-6 text-xs text-muted-foreground/50 text-center">
                {t("dataDocNoTables")}
              </div>
            )}
          </div>
        </div>

        {/* Panel 3: Columns */}
        <div className="flex-1 overflow-hidden flex flex-col min-w-0">
          <div className="flex items-center gap-3 px-5 py-3 border-b border-border/50 bg-card shrink-0">
            {currentTable ? (
              <>
                <div>
                  <span className="font-mono font-bold text-foreground text-sm">
                    {currentTable.name}
                  </span>
                  <span className="text-muted-foreground/70 text-xs ml-2">
                    {currentDb?.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card border border-border/50">
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: currentDb?.color || "#06b6d4" }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {coverage}% · {describedCount}/{totalCount}{" "}
                    {t("dataDocColName")}
                  </span>
                </div>
                <div className="flex-1" />
                <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-1">
                  {(["all", "described", "undescribed"] as FilterMode[]).map(
                    (f) => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                          filter === f
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground/70 hover:text-foreground/80"
                        }`}
                      >
                        {f === "all"
                          ? t("dataDocFiltered")
                          : filter === "described"
                            ? t("dataDocFiltered")
                            : t("dataDocUnfiltered")}
                      </button>
                    ),
                  )}
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/70" />
                  <input
                    value={colSearch}
                    onChange={(e) => setColSearch(e.target.value)}
                    placeholder={t("dataDocSearchCol") + "…"}
                    className="pl-8 pr-3 py-1.5 text-xs bg-card border border-border/50 rounded-lg text-foreground/80 placeholder-muted-foreground/40 focus:outline-none focus:border-cyan-500/50 w-44"
                  />
                </div>
              </>
            ) : (
              <span className="text-sm text-muted-foreground/70">
                {t("dataDocSelectTableHint")}
              </span>
            )}
          </div>

          {currentTable ? (
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-card sticky top-0 z-10 border-b border-border/50">
                    <th className="text-left px-5 py-3 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest w-[260px]">
                      {t("dataDocColName")}
                    </th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest w-[220px]">
                      {t("dataDocColType")}
                    </th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest">
                      {t("dataDocColDesc")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredColumns.map((col, i) => (
                    <tr
                      key={col.name}
                      className={`border-b border-border/30 hover:bg-card/20 group transition-colors ${
                        i % 2 === 1 ? "bg-background/20" : ""
                      }`}
                    >
                      <td className="px-5 py-3 w-[260px]">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-cyan-300 truncate">
                            {col.name}
                          </span>
                          <button
                            onClick={() => copyColName(col.name)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          >
                            {copied === col.name ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3 text-muted-foreground/70 hover:text-foreground/80" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 w-[220px]">
                        <span
                          className={`inline-block px-2 py-0.5 text-[11px] font-mono rounded border ${getTypeColor(
                            col.type,
                          )}`}
                        >
                          {col.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {editingCol?.table === currentTable.name &&
                        editingCol.col === col.name ? (
                          <div className="flex flex-col gap-1.5">
                            <input
                              autoFocus
                              value={editingCol.value}
                              onChange={(e) =>
                                setEditingCol((prev) =>
                                  prev
                                    ? { ...prev, value: e.target.value }
                                    : prev,
                                )
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit();
                                if (e.key === "Escape") cancelEdit();
                              }}
                              className="w-full px-2.5 py-1.5 text-xs bg-card border border-cyan-500/50 rounded-lg text-foreground/90 placeholder-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
                              placeholder={t("dataDocDescPlaceholder") + "…"}
                            />
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={saveEdit}
                                disabled={saving}
                                className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-cyan-600 hover:bg-cyan-500 text-foreground disabled:opacity-50 transition-colors"
                              >
                                {saving ? t("dataDocSaving") : t("back")}
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-muted hover:bg-muted text-foreground/80 transition-colors"
                              >
                                {t("back")}
                              </button>
                              {saveError && (
                                <span className="text-[11px] text-red-400">
                                  {saveError}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group/desc">
                            {col.description ? (
                              <span className="text-foreground/80 text-xs">
                                {col.description}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40 text-xs italic">
                                —
                              </span>
                            )}
                            <button
                              onClick={() =>
                                startEdit(
                                  currentTable.name,
                                  col.name,
                                  col.description || "—",
                                )
                              }
                              className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-auto"
                            >
                              <Pencil className="w-3 h-3 text-muted-foreground/70 hover:text-cyan-400 transition-colors" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredColumns.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-5 py-12 text-center text-muted-foreground/50 text-sm"
                      >
                        {t("dataDocNoTables")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-card/40 flex items-center justify-center mx-auto mb-4">
                  <Database className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-muted-foreground font-medium mb-1">
                  {t("dataDocSelectDb")}
                </h3>
                <p className="text-muted-foreground/50 text-sm">
                  {t("dataDocSelectTableHint")}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
