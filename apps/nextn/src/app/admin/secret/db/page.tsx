"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Database,
  Play,
  Table2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Clock,
  BarChart3,
  Shield,
  Terminal,
  RefreshCw,
  Copy,
  Check,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

interface TableInfo {
  database: string;
  name: string;
  engine: string;
  total_rows: number | null;
}

interface QueryResult {
  queryType: "SELECT" | "COMMAND";
  columns?: { name: string; type: string }[];
  data?: Record<string, unknown>[];
  rows?: number;
  statistics?: { elapsed: number; rows_read?: number; bytes_read?: number };
}

const DEFAULT_SQL = "SELECT * FROM audit_db.users LIMIT 20";

export default function AdminDbPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [tables, setTables] = useState<TableInfo[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [sql, setSql] = useState(DEFAULT_SQL);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Guard: superadmin only
  useEffect(() => {
    if (!loading && user) {
      if (!user.isSuperAdmin) {
        router.replace("/admin");
      } else {
        loadTables();
      }
    }
  }, [user, loading, router]);

  const loadTables = async () => {
    setTablesLoading(true);
    try {
      const res = await api.get("/admin-db/tables");
      setTables(res.data);
    } catch {
      /* ignore */
    } finally {
      setTablesLoading(false);
    }
  };

  const runSql = useCallback(
    async (query: string) => {
      if (!query.trim() || isRunning) return;
      setIsRunning(true);
      setError(null);
      setResult(null);
      try {
        const res = await api.post("/admin-db/execute", { sql: query.trim() });
        setResult(res.data);
      } catch (e: unknown) {
        const err = e as { response?: { data?: { message?: string } }; message?: string };
        setError(
          err.response?.data?.message || err.message || "Тодорхойгүй алдаа",
        );
      } finally {
        setIsRunning(false);
      }
    },
    [isRunning],
  );

  const executeQuery = useCallback(() => runSql(sql), [runSql, sql]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      executeQuery();
    }
  };

  const clickTable = (t: TableInfo) => {
    const query = `SELECT *\nFROM ${t.database}.${t.name}\nLIMIT 50`;
    setSql(query);
    setActiveTable(t.name);
    runSql(query);
  };

  const copyResults = async () => {
    if (!result?.data) return;
    const text = JSON.stringify(result.data, null, 2);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
      </div>
    );
  }

  if (!user.isSuperAdmin) return null;

  const rowCount = result?.rows ?? result?.data?.length ?? 0;

  return (
    <div className="flex h-[calc(100vh-0px)] bg-slate-950 text-slate-200 overflow-hidden">
      {/* ── Left: table list ───────────────────────────────────────────────── */}
      <aside className="w-52 shrink-0 border-r border-slate-800 flex flex-col bg-slate-900/40">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800">
          <Database className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex-1 truncate">
            audit_db
          </span>
          <button
            onClick={loadTables}
            disabled={tablesLoading}
            className="text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-40"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${tablesLoading ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-1.5">
          {tables.map((t) => (
            <button
              key={t.name}
              onClick={() => clickTable(t)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                activeTable === t.name
                  ? "bg-amber-500/10 text-amber-300 border-r-2 border-amber-500"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Table2 className="w-3 h-3 shrink-0 opacity-50" />
              <span className="truncate flex-1">{t.name}</span>
              {t.total_rows != null && (
                <span className="text-[10px] text-slate-600 shrink-0">
                  {Number(t.total_rows).toLocaleString()}
                </span>
              )}
            </button>
          ))}
          {!tablesLoading && tables.length === 0 && (
            <p className="text-[11px] text-slate-600 px-4 py-3">
              Хүснэгт олдсонгүй
            </p>
          )}
        </div>
      </aside>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-2.5 border-b border-slate-800 bg-slate-900/30 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-amber-500/20 flex items-center justify-center">
              <Terminal className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <span className="text-sm font-semibold text-white">
              DB Console
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20">
            <Shield className="w-3 h-3 text-red-400" />
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">
              Superadmin only
            </span>
          </div>
          <span className="ml-auto text-[11px] text-slate-600">
            Ctrl + Enter — ажиллуулах
          </span>
        </div>

        {/* SQL editor area */}
        <div className="border-b border-slate-800 bg-slate-900/10 shrink-0">
          <textarea
            ref={textareaRef}
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={7}
            spellCheck={false}
            className="w-full bg-transparent text-slate-100 font-mono text-sm p-4 resize-none outline-none placeholder-slate-700 leading-relaxed"
            placeholder="SELECT * FROM audit_db.users LIMIT 20"
          />
          <div className="flex items-center gap-3 px-4 py-2 border-t border-slate-800/60">
            <button
              onClick={executeQuery}
              disabled={isRunning || !sql.trim()}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-black text-sm font-semibold transition-all"
            >
              {isRunning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4 fill-black" />
              )}
              {isRunning ? "Ажиллаж байна..." : "Ажиллуулах"}
            </button>
            <span className="text-[11px] text-slate-600">
              {sql.trim().length} тэмдэгт
            </span>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            {/* Error */}
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="m-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3"
              >
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <pre className="text-red-300 text-xs font-mono whitespace-pre-wrap break-words">
                  {error}
                </pre>
              </motion.div>
            )}

            {/* COMMAND success */}
            {!error && result?.queryType === "COMMAND" && (
              <motion.div
                key="ok"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="m-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-emerald-300 text-sm font-medium">
                  Амжилттай гүйцэтгэлээ
                </span>
                {result.statistics?.elapsed != null && (
                  <span className="ml-auto text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {(result.statistics.elapsed * 1000).toFixed(1)} ms
                  </span>
                )}
              </motion.div>
            )}

            {/* SELECT results */}
            {!error && result?.queryType === "SELECT" && result.columns && (
              <motion.div
                key="table"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-3"
              >
                {/* Stats bar */}
                <div className="flex items-center gap-4 mb-2.5 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <BarChart3 className="w-3 h-3" />
                    {rowCount} мөр
                  </span>
                  <span>{result.columns.length} багана</span>
                  {result.statistics?.elapsed != null && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {(result.statistics.elapsed * 1000).toFixed(1)} ms
                    </span>
                  )}
                  {result.data && result.data.length > 0 && (
                    <button
                      onClick={copyResults}
                      className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                    >
                      {copied ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      {copied ? "Хуулагдлаа" : "JSON хуулах"}
                    </button>
                  )}
                </div>

                {/* Table */}
                <div className="rounded-xl border border-slate-800 overflow-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-800/80 border-b border-slate-700">
                        <th className="px-3 py-2 text-left text-slate-600 font-mono w-10 select-none">
                          #
                        </th>
                        {result.columns.map((col) => (
                          <th
                            key={col.name}
                            className="px-3 py-2 text-left font-semibold text-slate-300 whitespace-nowrap"
                          >
                            <div className="text-slate-200">{col.name}</div>
                            <div className="text-[10px] font-normal text-slate-500">
                              {col.type}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(result.data ?? []).map((row, i) => (
                        <tr
                          key={i}
                          className="border-b border-slate-800/40 hover:bg-slate-800/25 transition-colors"
                        >
                          <td className="px-3 py-1.5 text-slate-700 font-mono select-none">
                            {i + 1}
                          </td>
                          {result.columns!.map((col) => {
                            const val = row[col.name];
                            return (
                              <td
                                key={col.name}
                                className="px-3 py-1.5 text-slate-300 font-mono whitespace-nowrap max-w-[280px] truncate"
                                title={val != null ? String(val) : "NULL"}
                              >
                                {val == null ? (
                                  <span className="text-slate-700 italic">
                                    NULL
                                  </span>
                                ) : typeof val === "object" ? (
                                  JSON.stringify(val)
                                ) : (
                                  String(val)
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(!result.data || result.data.length === 0) && (
                    <div className="text-center py-10 text-slate-600 text-sm">
                      Үр дүн байхгүй
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Empty state */}
            {!error && !result && !isRunning && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-48 text-slate-700"
              >
                <Terminal className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">SQL бичэж Ctrl+Enter дарна уу</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
