"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { dbAccessApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import {
  Database,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Send,
  Calendar,
  Table2,
  Check,
} from "lucide-react";

interface TableInfo {
  database: string;
  table: string;
  full: string;
}


export default function DbAccessRequestPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  // Permission guard
  useEffect(() => {
    if (!user) return;
    const allowed =
      user.isAdmin ||
      user.isSuperAdmin ||
      user.allowedTools?.includes("db_access_requester");
    if (!allowed) router.replace("/tools");
  }, [user, router]);

  // Available tables
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [tablesLoading, setTablesLoading] = useState(true);

  // Form state
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [accessTypes] = useState<string[]>(["SELECT"]);
  const [validUntilDate, setValidUntilDate] = useState("");
  const [validUntilTime, setValidUntilTime] = useState("18:00");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Table search filter
  const [tableFilter, setTableFilter] = useState("");

  // Set default date to today
  useEffect(() => {
    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    setValidUntilDate(nextMonth.toISOString().split("T")[0]);
  }, []);

  const loadTables = useCallback(async () => {
    try {
      setTablesLoading(true);
      const data = await dbAccessApi.getTables();
      setTables(data);
    } catch {
      toast({
        title: "Алдаа",
        description: "Хүснэгтүүд ачаалахад алдаа гарлаа",
        variant: "destructive",
      });
    } finally {
      setTablesLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  const toggleTable = (full: string) => {
    setSelectedTables((prev) =>
      prev.includes(full) ? prev.filter((t) => t !== full) : [...prev, full],
    );
  };

  /** Toggle all tables in a given database group */
  const toggleDb = (dbTables: TableInfo[]) => {
    const allFulls = dbTables.map((t) => t.full);
    const allSelected = allFulls.every((f) => selectedTables.includes(f));
    if (allSelected) {
      setSelectedTables((prev) => prev.filter((t) => !allFulls.includes(t)));
    } else {
      setSelectedTables((prev) => [
        ...prev,
        ...allFulls.filter((f) => !prev.includes(f)),
      ]);
    }
  };

  /** Toggle ALL tables across all databases */
  const toggleAll = () => {
    const allFulls = tables.map((t) => t.full);
    const allSelected = allFulls.every((f) => selectedTables.includes(f));
    setSelectedTables(allSelected ? [] : allFulls);
  };

  const handleSubmit = async () => {
    if (selectedTables.length === 0) {
      toast({
        title: "Сонголт хийнэ үү",
        description: "Хамгийн багадаа нэг хүснэгт сонгоно уу",
        variant: "destructive",
      });
      return;
    }

    if (!validUntilDate) {
      toast({
        title: "Огноо оруулна уу",
        description: "Эрхийн дуусах огноог заавал оруулна уу",
        variant: "destructive",
      });
      return;
    }

    const validUntil = new Date(`${validUntilDate}T${validUntilTime}:00`);
    if (validUntil <= new Date()) {
      toast({
        title: "Буруу огноо",
        description: "Дуусах хугацаа ирээдүйд байх ёстой",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);
      await dbAccessApi.createRequest({
        tables: selectedTables,
        accessTypes,
        validUntil: validUntil.toISOString(),
        reason,
      });

      toast({
        title: "Хүсэлт илгээгдлээ",
        description: `${selectedTables.length} хүснэгтэд эрх хүсэх хүсэлт амжилттай илгээгдлээ`,
      });

      // Reset form
      setSelectedTables([]);
      setReason("");
    } catch (err: any) {
      toast({
        title: "Алдаа",
        description:
          err?.response?.data?.message ?? "Хүсэлт илгээхэд алдаа гарлаа",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Group tables by database
  const grouped = tables
    .filter(
      (t) =>
        !tableFilter ||
        t.full.toLowerCase().includes(tableFilter.toLowerCase()),
    )
    .reduce<Record<string, TableInfo[]>>((acc, t) => {
      (acc[t.database] = acc[t.database] || []).push(t);
      return acc;
    }, {});

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/tools">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <Database className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">ClickHouse Эрх Хүсэх</h1>
              <p className="text-sm text-muted-foreground">
                Хүснэгтэд хандах эрх хүсэх
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Link href="/tools/db-access/my-grants">
              <Button variant="outline" size="sm">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Идэвхтэй эрхүүд
              </Button>
            </Link>
            {(user?.isAdmin ||
              user?.allowedTools?.includes("db_access_granter")) && (
              <Link href="/tools/db-access/manage">
                <Button variant="outline" size="sm">
                  <Table2 className="h-4 w-4 mr-2" />
                  Хүсэлт шийдвэрлэх
                </Button>
              </Link>
            )}
          </div>
        </div>

        <div className="space-y-4">
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold flex items-center gap-2">
                  <Database className="h-4 w-4 text-cyan-400" />
                  Хүснэгт сонгох
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadTables}
                  disabled={tablesLoading}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${tablesLoading ? "animate-spin" : ""}`}
                  />
                </Button>
              </div>

              <Input
                placeholder="Хүснэгт хайх..."
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
                className="bg-background"
              />

              {tablesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Global select-all row */}
                  {!tableFilter && tables.length > 0 && (
                    <button
                      type="button"
                      onClick={toggleAll}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                        tables.every((t) => selectedTables.includes(t.full))
                          ? "border-cyan-500 bg-cyan-500/10 text-cyan-300"
                          : "border-dashed border-border hover:border-cyan-500/50 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${
                          tables.every((t) => selectedTables.includes(t.full))
                            ? "bg-cyan-500 border-cyan-500"
                            : tables.some((t) =>
                                  selectedTables.includes(t.full),
                                )
                              ? "border-cyan-500 bg-cyan-500/30"
                              : "border-border"
                        }`}
                      >
                        {tables.every((t) =>
                          selectedTables.includes(t.full),
                        ) && <Check className="h-2.5 w-2.5 text-black" />}
                        {!tables.every((t) =>
                          selectedTables.includes(t.full),
                        ) &&
                          tables.some((t) =>
                            selectedTables.includes(t.full),
                          ) && (
                            <div className="w-2 h-0.5 bg-cyan-400 rounded" />
                          )}
                      </div>
                      Бүгдийг сонгох ({tables.length} хүснэгт)
                    </button>
                  )}

                  {/* Per-database groups */}
                  <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                    {Object.entries(grouped).map(([db, dbTables]) => {
                      const allDbSelected = dbTables.every((t) =>
                        selectedTables.includes(t.full),
                      );
                      const someDbSelected = dbTables.some((t) =>
                        selectedTables.includes(t.full),
                      );
                      return (
                        <div key={db}>
                          {/* DB header with select-all for this db */}
                          <button
                            type="button"
                            onClick={() => toggleDb(dbTables)}
                            className="flex items-center gap-2 mb-2 px-1 group w-full text-left"
                          >
                            <div
                              className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
                                allDbSelected
                                  ? "bg-cyan-500 border-cyan-500"
                                  : someDbSelected
                                    ? "border-cyan-500 bg-cyan-500/30"
                                    : "border-muted-foreground/40 group-hover:border-cyan-500/60"
                              }`}
                            >
                              {allDbSelected && (
                                <Check className="h-2.5 w-2.5 text-black" />
                              )}
                              {!allDbSelected && someDbSelected && (
                                <div className="w-2 h-0.5 bg-cyan-400 rounded" />
                              )}
                            </div>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider group-hover:text-cyan-400 transition-colors">
                              {db}
                            </p>
                            <span className="text-xs text-muted-foreground/60">
                              ({dbTables.length})
                            </span>
                          </button>

                          {/* Individual table checkboxes */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pl-1">
                            {dbTables.map((t) => {
                              const selected = selectedTables.includes(t.full);
                              return (
                                <button
                                  key={t.full}
                                  type="button"
                                  onClick={() => toggleTable(t.full)}
                                  className={`flex items-center gap-2 text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                                    selected
                                      ? "border-cyan-500 bg-cyan-500/10 text-cyan-300"
                                      : "border-border hover:border-cyan-500/50 hover:bg-cyan-500/5"
                                  }`}
                                >
                                  <div
                                    className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
                                      selected
                                        ? "bg-cyan-500 border-cyan-500"
                                        : "border-muted-foreground/40"
                                    }`}
                                  >
                                    {selected && (
                                      <Check className="h-2.5 w-2.5 text-black" />
                                    )}
                                  </div>
                                  <span className="font-mono truncate text-xs">
                                    {t.table}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    {Object.keys(grouped).length === 0 && (
                      <p className="text-center text-muted-foreground py-4 text-sm">
                        Хүснэгт олдсонгүй
                      </p>
                    )}
                  </div>
                </div>
              )}

              {selectedTables.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-2">
                    Сонгогдсон ({selectedTables.length}):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTables.map((t) => (
                      <Badge
                        key={t}
                        variant="secondary"
                        className="cursor-pointer hover:bg-destructive/20 hover:text-destructive"
                        onClick={() => toggleTable(t)}
                      >
                        {t} ✕
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Date/time + reason */}
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <h2 className="font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-cyan-400" />
                Хугацаа & Шалтгаан
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Дуусах огноо</Label>
                  <Input
                    type="date"
                    value={validUntilDate}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setValidUntilDate(e.target.value)}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Дуусах цаг</Label>
                  <Input
                    type="time"
                    value={validUntilTime}
                    onChange={(e) => setValidUntilTime(e.target.value)}
                    className="bg-background"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Шалтгаан (заавал)</Label>
                <Textarea
                  placeholder="Яагаад энэ эрх хэрэгтэй байгаагаа бичнэ үү..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="bg-background resize-none"
                />
              </div>

              <Button
                className="w-full bg-cyan-600 hover:bg-cyan-500"
                onClick={handleSubmit}
                disabled={submitting || selectedTables.length === 0}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Хүсэлт илгээх
              </Button>
            </div>
        </div>
      </div>
    </div>
  );
}
