"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileSpreadsheet,
  Download,
  Loader2,
  Calendar,
  CalendarRange,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { excelReportApi, ReportTemplate } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function ExcelReportPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ReportTemplate | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await excelReportApi.getTemplates();
      setTemplates(data);
    } catch {
      toast({
        title: "Алдаа",
        description: "Тайлангийн жагсаалт татахад алдаа гарлаа",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openDialog = (t: ReportTemplate) => {
    setSelected(t);
    setStartDate("");
    setEndDate("");
  };

  const handleDownload = async () => {
    if (!selected) return;

    if (selected.dateMode === "range" && (!startDate || !endDate)) {
      toast({ title: "Огноо оруулна уу", variant: "destructive" });
      return;
    }
    if (selected.dateMode === "single" && !startDate) {
      toast({ title: "Огноо оруулна уу", variant: "destructive" });
      return;
    }

    setRunning(true);
    try {
      const blob = await excelReportApi.runReport(
        selected.id,
        startDate || undefined,
        endDate || startDate || undefined,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `${selected.name}_${date}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Тайлан татагдлаа", description: selected.name });
      setSelected(null);
    } catch (e: any) {
      const msg =
        e?.response?.data instanceof Blob
          ? await e.response.data.text().then((t: string) => {
              try {
                return JSON.parse(t)?.message;
              } catch {
                return t;
              }
            })
          : (e?.response?.data?.message ?? "Тайлан үүсгэхэд алдаа гарлаа");
      toast({ title: "Алдаа", description: msg, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <Link href="/tools">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Excel тайлан</h1>
            <p className="text-sm text-muted-foreground">
              Системийн мэдээллээс Excel тайлан татах
            </p>
          </div>
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <FileSpreadsheet className="mb-4 h-16 w-16 opacity-30" />
          <p className="text-lg">Одоогоор тайлан байхгүй байна</p>
          <p className="text-sm">Удахгүй нэмэгдэнэ</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence>
            {templates.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="group"
              >
                <Card
                  className="cursor-pointer border-border/50 transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10"
                  onClick={() => openDialog(t)}
                >
                  <CardHeader className="pb-2">
                    <div
                      className={`mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${t.color} shadow-md`}
                    >
                      <FileSpreadsheet className="h-6 w-6 text-white" />
                    </div>
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    {t.description && (
                      <CardDescription className="line-clamp-2 text-xs">
                        {t.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {t.dateMode === "range" ? (
                        <>
                          <CalendarRange className="h-3.5 w-3.5" />
                          <span>Хугацааны интервал сонгоно</span>
                        </>
                      ) : t.dateMode === "single" ? (
                        <>
                          <Calendar className="h-3.5 w-3.5" />
                          <span>Огноо сонгоно</span>
                        </>
                      ) : (
                        <>
                          <Download className="h-3.5 w-3.5" />
                          <span>Шууд татах</span>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Download dialog */}
      <AnimatePresence>
        {selected && (
          <Dialog open onOpenChange={(o) => !o && setSelected(null)}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${selected.color}`}
                  >
                    <FileSpreadsheet className="h-4 w-4 text-white" />
                  </div>
                  {selected.name}
                </DialogTitle>
                {selected.description && (
                  <DialogDescription>{selected.description}</DialogDescription>
                )}
              </DialogHeader>

              <div className="space-y-4 py-2">
                {selected.dateMode === "range" && (
                  <>
                    <div className="space-y-1.5">
                      <Label>Эхлэх огноо</Label>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Дуусах огноо</Label>
                      <Input
                        type="date"
                        value={endDate}
                        min={startDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {selected.dateMode === "single" && (
                  <div className="space-y-1.5">
                    <Label>Огноо</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                )}

                {selected.dateMode === "none" && (
                  <p className="text-sm text-muted-foreground">
                    Огноо шаардлагагүй, шууд татна.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setSelected(null)}
                  disabled={running}
                >
                  Болих
                </Button>
                <Button
                  onClick={handleDownload}
                  disabled={running}
                  className="gap-2"
                >
                  {running ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {running ? "Боловсруулж байна..." : "Татах"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  );
}
