"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { reportApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Plus,
  Trash2,
  Download,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Building,
  Calendar,
  User,
  Target,
  AlertTriangle,
  CheckCircle,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { DEPARTMENTS } from "@/lib/constants";

interface Finding {
  id: string;
  title: string;
  description: string;
  riskLevel: "Өндөр" | "Дунд" | "Бага";
  recommendation: string;
}

const AUDIT_TYPES = [
  "Санхүүгийн аудит",
  "Дотоод хяналтын аудит",
  "Нийцлийн аудит",
  "Үйл ажиллагааны аудит",
  "Мэдээллийн технологийн аудит",
  "Эрсдлийн аудит",
  "Тусгай зориулалтын аудит",
];

const RISK_LABELS: Record<string, { label: string; color: string }> = {
  Өндөр: {
    label: "Өндөр",
    color: "bg-red-500/20 text-red-400 border-red-500/30",
  },
  Дунд: {
    label: "Дунд",
    color: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  },
  Бага: {
    label: "Бага",
    color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  },
};

const STEPS = [
  { id: 1, label: "Ерөнхий мэдээлэл", icon: Building },
  { id: 2, label: "Зорилго & Хүрээ", icon: Target },
  { id: 3, label: "Олдворууд", icon: AlertTriangle },
  { id: 4, label: "Дүгнэлт", icon: CheckCircle },
];

export default function ReportPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);

  // Form state
  const [form, setForm] = useState({
    auditTitle: "",
    auditType: "",
    department: "",
    auditStartDate: "",
    auditEndDate: "",
    reportDate: new Date().toISOString().split("T")[0],
    auditorNames: user?.name || "",
    supervisorName: "",
    referenceNumber: "",
    objective: "",
    scope: "",
    methodology: "",
    conclusion: "",
  });

  const [findings, setFindings] = useState<Finding[]>([]);

  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const addFinding = () => {
    setFindings((f) => [
      ...f,
      {
        id: Date.now().toString(),
        title: "",
        description: "",
        riskLevel: "Дунд",
        recommendation: "",
      },
    ]);
  };

  const removeFinding = (id: string) =>
    setFindings((f) => f.filter((x) => x.id !== id));

  const updateFinding = (id: string, key: keyof Finding, value: string) =>
    setFindings((f) =>
      f.map((x) => (x.id === id ? { ...x, [key]: value } : x)),
    );

  const canProceed = () => {
    if (step === 1)
      return (
        form.auditTitle &&
        form.auditType &&
        form.department &&
        form.auditStartDate &&
        form.auditEndDate &&
        form.auditorNames
      );
    if (step === 2) return form.objective && form.scope;
    if (step === 3) return true;
    return form.conclusion;
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const payload = {
        ...form,
        findings: findings.map((f, i) => ({
          number: String(i + 1),
          title: f.title,
          description: f.description,
          riskLevel: f.riskLevel,
          recommendation: f.recommendation,
        })),
      };

      const blob = await reportApi.generate(payload);

      // Blob-оос file download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Аудитын-тайлан-${form.department}-${form.reportDate}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast({ title: "Амжилттай", description: "Тайлан татагдлаа (.docx)" });
    } catch (error) {
      console.error(error);
      toast({
        title: "Алдаа",
        description: "Тайлан үүсгэхэд алдаа гарлаа",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 container mx-auto py-8 px-4 max-w-3xl">
        {/* Back */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Link href="/tools">
            <Button
              variant="ghost"
              className="text-slate-400 hover:text-white hover:bg-slate-800/50 mb-6"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Буцах
            </Button>
          </Link>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border border-blue-500/30 mb-4">
            <FileText className="w-7 h-7 text-blue-400" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Аудитын тайлан үүсгэх
            </h1>
          </div>
          <p className="text-slate-400 text-sm">
            Мэдээлэл системд хадгалагдахгүй — тайлан Word (.docx) файлаар гарна
          </p>
        </motion.div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = step === s.id;
            const isDone = step > s.id;
            return (
              <div key={s.id} className="flex items-center gap-2">
                <button
                  onClick={() => isDone && setStep(s.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-blue-500/20 border border-blue-500/50 text-blue-300"
                      : isDone
                        ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 cursor-pointer hover:bg-emerald-500/20"
                        : "bg-slate-800/50 border border-slate-700 text-slate-500 cursor-default"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{s.label}</span>
                  <span className="sm:hidden">{s.id}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div
                    className={`w-4 h-px ${step > s.id ? "bg-emerald-500/50" : "bg-slate-700"}`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Form card */}
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm"
        >
          {/* ── STEP 1: Ерөнхий мэдээлэл ── */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-white font-semibold text-lg">
                Ерөнхий мэдээлэл
              </h2>

              <div className="space-y-2">
                <Label className="text-slate-300">Аудитын нэр *</Label>
                <Input
                  value={form.auditTitle}
                  onChange={(e) => set("auditTitle", e.target.value)}
                  placeholder="Жишээ: 2025 оны санхүүгийн аудит"
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Аудитын төрөл *</Label>
                  <Select
                    value={form.auditType}
                    onValueChange={(v) => set("auditType", v)}
                  >
                    <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                      <SelectValue placeholder="Сонгох..." />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {AUDIT_TYPES.map((t) => (
                        <SelectItem
                          key={t}
                          value={t}
                          className="text-slate-300 focus:bg-slate-700 focus:text-white"
                        >
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Аудит хийсэн нэгж *</Label>
                  <Select
                    value={form.department}
                    onValueChange={(v) => set("department", v)}
                  >
                    <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                      <SelectValue placeholder="Сонгох..." />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {DEPARTMENTS.map((d) => (
                        <SelectItem
                          key={d}
                          value={d}
                          className="text-slate-300 focus:bg-slate-700 focus:text-white"
                        >
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Эхлэх огноо *</Label>
                  <Input
                    type="date"
                    value={form.auditStartDate}
                    onChange={(e) => set("auditStartDate", e.target.value)}
                    className="bg-slate-700/50 border-slate-600 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Дуусах огноо *</Label>
                  <Input
                    type="date"
                    value={form.auditEndDate}
                    onChange={(e) => set("auditEndDate", e.target.value)}
                    className="bg-slate-700/50 border-slate-600 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Аудиторын нэр *</Label>
                  <Input
                    value={form.auditorNames}
                    onChange={(e) => set("auditorNames", e.target.value)}
                    placeholder="Овог Нэр"
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">
                    Удирдагч (заавал биш)
                  </Label>
                  <Input
                    value={form.supervisorName}
                    onChange={(e) => set("supervisorName", e.target.value)}
                    placeholder="Овог Нэр"
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Тайлангийн огноо</Label>
                  <Input
                    type="date"
                    value={form.reportDate}
                    onChange={(e) => set("reportDate", e.target.value)}
                    className="bg-slate-700/50 border-slate-600 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">
                    Тайлангийн дугаар (заавал биш)
                  </Label>
                  <Input
                    value={form.referenceNumber}
                    onChange={(e) => set("referenceNumber", e.target.value)}
                    placeholder="DAG-2025-001"
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Зорилго & Хүрээ ── */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-white font-semibold text-lg">
                Зорилго & Хамрах хүрээ
              </h2>

              <div className="space-y-2">
                <Label className="text-slate-300">Аудитын зорилго *</Label>
                <Textarea
                  value={form.objective}
                  onChange={(e) => set("objective", e.target.value)}
                  rows={4}
                  placeholder="Энэхүү аудитын зорилго нь..."
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Хамрах хүрээ *</Label>
                <Textarea
                  value={form.scope}
                  onChange={(e) => set("scope", e.target.value)}
                  rows={4}
                  placeholder="Аудит дараах хугацаа, нэгж, үйл ажиллагааг хамарна..."
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">
                  Аудитын арга зүй (заавал биш)
                </Label>
                <Textarea
                  value={form.methodology}
                  onChange={(e) => set("methodology", e.target.value)}
                  rows={3}
                  placeholder="Баримт бичиг шалгалт, ярилцлага, бие даасан дахин тооцоолол..."
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 resize-none"
                />
              </div>
            </div>
          )}

          {/* ── STEP 3: Олдворууд ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-white font-semibold text-lg">
                  Аудитын олдворууд
                </h2>
                <Button
                  onClick={addFinding}
                  size="sm"
                  className="bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:bg-blue-500/30"
                >
                  <Plus className="w-4 h-4 mr-1" /> Нэмэх
                </Button>
              </div>

              {findings.length === 0 && (
                <div className="text-center py-10 text-slate-500">
                  <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">
                    Олдвор байхгүй бол тайланд "Зөрчил илрээгүй" гэж бичигдэнэ
                  </p>
                  <Button
                    onClick={addFinding}
                    variant="outline"
                    size="sm"
                    className="mt-4 border-slate-600 text-slate-400 hover:bg-slate-700"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Олдвор нэмэх
                  </Button>
                </div>
              )}

              <AnimatePresence>
                {findings.map((f, i) => (
                  <motion.div
                    key={f.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-slate-700/30 border border-slate-600/50 rounded-xl p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-blue-400 font-semibold text-sm">
                        Олдвор #{i + 1}
                      </span>
                      <button
                        onClick={() => removeFinding(f.id)}
                        className="text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2 space-y-1">
                        <Label className="text-slate-400 text-xs">Гарчиг</Label>
                        <Input
                          value={f.title}
                          onChange={(e) =>
                            updateFinding(f.id, "title", e.target.value)
                          }
                          placeholder="Олдворын гарчиг"
                          className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-slate-400 text-xs">
                          Эрсдлийн түвшин
                        </Label>
                        <Select
                          value={f.riskLevel}
                          onValueChange={(v) =>
                            updateFinding(f.id, "riskLevel", v)
                          }
                        >
                          <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700">
                            {(["Өндөр", "Дунд", "Бага"] as const).map((r) => (
                              <SelectItem
                                key={r}
                                value={r}
                                className="text-slate-300 focus:bg-slate-700"
                              >
                                <Badge
                                  className={`text-xs ${RISK_LABELS[r].color} border`}
                                >
                                  {r}
                                </Badge>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-slate-400 text-xs">Тайлбар</Label>
                      <Textarea
                        value={f.description}
                        onChange={(e) =>
                          updateFinding(f.id, "description", e.target.value)
                        }
                        rows={2}
                        placeholder="Олдворын дэлгэрэнгүй тайлбар..."
                        className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 resize-none text-sm"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-slate-400 text-xs">Зөвлөмж</Label>
                      <Textarea
                        value={f.recommendation}
                        onChange={(e) =>
                          updateFinding(f.id, "recommendation", e.target.value)
                        }
                        rows={2}
                        placeholder="Засах арга хэмжээний зөвлөмж..."
                        className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 resize-none text-sm"
                      />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* ── STEP 4: Дүгнэлт ── */}
          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-white font-semibold text-lg">Дүгнэлт</h2>

              <div className="space-y-2">
                <Label className="text-slate-300">Дүгнэлт *</Label>
                <Textarea
                  value={form.conclusion}
                  onChange={(e) => set("conclusion", e.target.value)}
                  rows={8}
                  placeholder="Аудитын дүгнэлт, санал зөвлөмж..."
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 resize-none"
                />
              </div>

              {/* Summary */}
              <div className="bg-slate-700/30 border border-slate-600/50 rounded-xl p-4 space-y-2 text-sm">
                <p className="text-slate-400 font-medium text-xs uppercase tracking-wider mb-3">
                  Тайлангийн хураангуй
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                  <span className="text-slate-500">Аудит:</span>
                  <span className="text-white">{form.auditTitle || "—"}</span>
                  <span className="text-slate-500">Хэлтэс:</span>
                  <span className="text-white">{form.department || "—"}</span>
                  <span className="text-slate-500">Хугацаа:</span>
                  <span className="text-white">
                    {form.auditStartDate && form.auditEndDate
                      ? `${form.auditStartDate} — ${form.auditEndDate}`
                      : "—"}
                  </span>
                  <span className="text-slate-500">Олдворын тоо:</span>
                  <span className="text-white">{findings.length} олдвор</span>
                  {findings.filter((f) => f.riskLevel === "Өндөр").length >
                    0 && (
                    <>
                      <span className="text-slate-500">Өндөр эрсдэл:</span>
                      <span className="text-red-400 font-medium">
                        {findings.filter((f) => f.riskLevel === "Өндөр").length}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-700/50">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 1}
              className="text-slate-400 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Өмнөх
            </Button>

            {step < 4 ? (
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canProceed()}
                className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:opacity-90 text-white"
              >
                Дараах <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleGenerate}
                disabled={!canProceed() || isGenerating}
                className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:opacity-90 text-white px-6"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Үүсгэж байна...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Word (.docx) татах
                  </>
                )}
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
