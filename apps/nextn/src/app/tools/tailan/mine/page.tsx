"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { tailanApi } from "@/lib/api";
import {
  Plus,
  Trash2,
  Download,
  Send,
  Save,
  ChevronLeft,
  Loader2,
  Check,
  Upload,
  X,
  ImageIcon,
} from "lucide-react";
import Link from "next/link";
import {
  uid,
  getCurrentYear,
  getCurrentQuarter,
} from "./_components/tailan.types";
import type {
  PlannedTask,
  DynSection,
  Section2Task,
  Section3AutoTask,
  Section3Dashboard,
  Section4Training,
  Section5Task,
  Section6Activity,
  TailanImage,
} from "./_components/tailan.types";
import { RichToolbar } from "./_components/RichEditor";
import { WordPreview, ROMAN_NUMS } from "./_components/WordPreview";

// â”€â”€â”€ Shared style helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const inputCls =
  "w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition";
const labelCls = "block text-xs font-medium text-slate-400 mb-1";

// â”€â”€â”€ Main Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function TailanMinePage() {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [year, setYear] = useState(getCurrentYear);
  const [quarter, setQuarter] = useState(getCurrentQuarter);
  const [plannedTasks, setPlannedTasks] = useState<PlannedTask[]>([
    {
      _id: uid(),
      order: 1,
      title: "",
      completion: 100,
      startDate: "",
      endDate: "",
      description: "",
    },
  ]);
  const [dynamicSections, setDynamicSections] = useState<DynSection[]>([
    { _id: uid(), order: 2, title: "ÐÐ¶Ð»Ñ‹Ð½ Ð°Ð³ÑƒÑƒÐ»Ð³Ð°", content: "" },
  ]);
  const [section2Tasks, setSection2Tasks] = useState<Section2Task[]>([
    { _id: uid(), order: 1, title: "", result: "", period: "", completion: "" },
  ]);
  const [section3AutoTasks, setSection3AutoTasks] = useState<
    Section3AutoTask[]
  >([{ _id: uid(), order: 1, title: "", value: "", rating: "" }]);
  const [section3Dashboards, setSection3Dashboards] = useState<
    Section3Dashboard[]
  >([{ _id: uid(), order: 1, dashboard: "", value: "", rating: "" }]);
  const [section4Trainings, setSection4Trainings] = useState<
    Section4Training[]
  >([
    {
      _id: uid(),
      order: 1,
      training: "",
      organizer: "",
      type: "",
      date: "",
      format: "",
      hours: "",
      meetsAuditGoal: "",
      sharedKnowledge: "",
    },
  ]);
  const [section4KnowledgeText, setSection4KnowledgeText] = useState("");
  const [section5Tasks, setSection5Tasks] = useState<Section5Task[]>([
    { _id: uid(), order: 1, taskType: "", completedWork: "" },
  ]);
  const [section6Activities, setSection6Activities] = useState<
    Section6Activity[]
  >([{ _id: uid(), order: 1, date: "", activity: "", initiative: "" }]);
  const [section7Text, setSection7Text] = useState("");

  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [cyrillicName, setCyrillicName] = useState<string>("");

  // Images
  const [images, setImages] = useState<TailanImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const imgFileRef = useRef<HTMLInputElement>(null);

  // Load existing report
  useEffect(() => {
    tailanApi
      .getMyReport(year, quarter)
      .then((r) => {
        if (!r) return;
        if (r.plannedTasks?.length)
          setPlannedTasks(
            r.plannedTasks.map((t: any) => ({ ...t, _id: uid() })),
          );
        if (r.dynamicSections?.length)
          setDynamicSections(
            r.dynamicSections.map((s: any) => ({ ...s, _id: uid() })),
          );
        if (r.section2Tasks?.length)
          setSection2Tasks(
            r.section2Tasks.map((t: any) => ({ ...t, _id: uid() })),
          );
        if (r.section3AutoTasks?.length)
          setSection3AutoTasks(
            r.section3AutoTasks.map((t: any) => ({ ...t, _id: uid() })),
          );
        if (r.section3Dashboards?.length)
          setSection3Dashboards(
            r.section3Dashboards.map((t: any) => ({ ...t, _id: uid() })),
          );
        if (r.section4Trainings?.length)
          setSection4Trainings(
            r.section4Trainings.map((t: any) => ({ ...t, _id: uid() })),
          );
        if (r.section4KnowledgeText)
          setSection4KnowledgeText(r.section4KnowledgeText);
        if (r.section5Tasks?.length)
          setSection5Tasks(
            r.section5Tasks.map((t: any) => ({ ...t, _id: uid() })),
          );
        if (r.section6Activities?.length)
          setSection6Activities(
            r.section6Activities.map((t: any) => ({ ...t, _id: uid() })),
          );
        if (r.section7Text) setSection7Text(r.section7Text);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
    loadImages();
  }, [year, quarter]);

  // Revoke blob URLs on unmount
  useEffect(() => {
    return () => {
      setImages((prev) => {
        prev.forEach((img) => {
          if (img.blobUrl) URL.revokeObjectURL(img.blobUrl);
        });
        return prev;
      });
    };
  }, []);

  const loadImages = async () => {
    try {
      const list = await tailanApi.getImages(year, quarter);
      const withUrls: TailanImage[] = await Promise.all(
        list.map(async (img) => {
          try {
            const blobUrl = await tailanApi.fetchImageDataUrl(img.id);
            return { ...img, blobUrl };
          } catch {
            return img;
          }
        }),
      );
      setImages(withUrls);
    } catch {}
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const saved = await tailanApi.uploadImage(year, quarter, file);
      const blobUrl = URL.createObjectURL(file);
      setImages((prev) => [
        ...prev,
        {
          id: saved.id,
          filename: file.name,
          mimeType: file.type,
          uploadedAt: new Date().toISOString(),
          blobUrl,
        },
      ]);
    } catch {
    } finally {
      setUploading(false);
      if (imgFileRef.current) imgFileRef.current.value = "";
    }
  };

  const handleDeleteImage = async (id: string) => {
    try {
      await tailanApi.deleteImage(id);
      setImages((prev) => {
        const img = prev.find((i) => i.id === id);
        if (img?.blobUrl) URL.revokeObjectURL(img.blobUrl);
        return prev.filter((i) => i.id !== id);
      });
    } catch {}
  };

  const toDto = () => ({
    year,
    quarter,
    plannedTasks: plannedTasks.map(({ _id, ...t }) => t),
    dynamicSections: dynamicSections.map(({ _id, ...s }) => s),
    section2Tasks: section2Tasks.map(({ _id, ...t }) => t),
    section3AutoTasks: section3AutoTasks.map(({ _id, ...t }) => t),
    section3Dashboards: section3Dashboards.map(({ _id, ...t }) => t),
    section4Trainings: section4Trainings.map(({ _id, ...t }) => t),
    section4KnowledgeText,
    section5Tasks: section5Tasks.map(({ _id, ...t }) => t),
    section6Activities: section6Activities.map(({ _id, ...t }) => t),
    section7Text,
    otherWork: "",
    teamActivities: [],
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await tailanApi.saveDraft({ ...toDto(), status: "draft" });
      setSavedMsg("Ð¥Ð°Ð´Ð³Ð°Ð»Ð»Ð°Ð° âœ“");
      setTimeout(() => setSavedMsg(""), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!confirm("Ð¢Ð°Ð¹Ð»Ð°Ð½Ð³ Ñ…ÑÐ»Ñ‚ÑÐ¸Ð¹Ð½ Ð°Ñ…Ð»Ð°Ð³Ñ‡ Ñ€ÑƒÑƒ Ð¸Ð»Ð³ÑÑÑ… Ò¯Ò¯?")) return;
    setSubmitting(true);
    try {
      await tailanApi.saveDraft({ ...toDto(), status: "submitted" });
      await tailanApi.submitReport(year, quarter);
      setSavedMsg("Ð˜Ð»Ð³ÑÑÐ³Ð´Ð»ÑÑ âœ“");
      setTimeout(() => setSavedMsg(""), 3000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await tailanApi.downloadMyWord(
        year,
        quarter,
        cyrillicName.trim() || undefined,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Ð¢Ð°Ð¹Ð»Ð°Ð½-${cyrillicName.trim() || (user?.name ?? "mine")}-${year}-Q${quarter}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  // â”€â”€â”€ Planned tasks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const addTask = () =>
    setPlannedTasks((prev) => [
      ...prev,
      {
        _id: uid(),
        order: prev.length + 1,
        title: "",
        completion: 100,
        startDate: "",
        endDate: "",
        description: "",
      },
    ]);

  const removeTask = (id: string) =>
    setPlannedTasks((prev) =>
      prev.filter((t) => t._id !== id).map((t, i) => ({ ...t, order: i + 1 })),
    );

  const updateTask = (id: string, field: keyof PlannedTask, value: any) =>
    setPlannedTasks((prev) =>
      prev.map((t) => (t._id === id ? { ...t, [field]: value } : t)),
    );

  // â”€â”€â”€ Section 2 tasks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const addSection2Task = () =>
    setSection2Tasks((prev) => [
      ...prev,
      {
        _id: uid(),
        order: prev.length + 1,
        title: "",
        result: "",
        period: "",
        completion: "",
      },
    ]);
  const removeSection2Task = (id: string) =>
    setSection2Tasks((prev) =>
      prev.filter((t) => t._id !== id).map((t, i) => ({ ...t, order: i + 1 })),
    );
  const updateSection2Task = (
    id: string,
    field: keyof Section2Task,
    value: any,
  ) =>
    setSection2Tasks((prev) =>
      prev.map((t) => (t._id === id ? { ...t, [field]: value } : t)),
    );

  // â”€â”€â”€ Section 3 auto tasks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const addSection3AutoTask = () =>
    setSection3AutoTasks((prev) => [
      ...prev,
      { _id: uid(), order: prev.length + 1, title: "", value: "", rating: "" },
    ]);
  const removeSection3AutoTask = (id: string) =>
    setSection3AutoTasks((prev) =>
      prev.filter((t) => t._id !== id).map((t, i) => ({ ...t, order: i + 1 })),
    );
  const updateSection3AutoTask = (
    id: string,
    field: keyof Section3AutoTask,
    value: any,
  ) =>
    setSection3AutoTasks((prev) =>
      prev.map((t) => (t._id === id ? { ...t, [field]: value } : t)),
    );

  // â”€â”€â”€ Section 3 dashboards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const addSection3Dashboard = () =>
    setSection3Dashboards((prev) => [
      ...prev,
      {
        _id: uid(),
        order: prev.length + 1,
        dashboard: "",
        value: "",
        rating: "",
      },
    ]);
  const removeSection3Dashboard = (id: string) =>
    setSection3Dashboards((prev) =>
      prev.filter((t) => t._id !== id).map((t, i) => ({ ...t, order: i + 1 })),
    );
  const updateSection3Dashboard = (
    id: string,
    field: keyof Section3Dashboard,
    value: any,
  ) =>
    setSection3Dashboards((prev) =>
      prev.map((t) => (t._id === id ? { ...t, [field]: value } : t)),
    );

  // â”€â”€â”€ Section 4 trainings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const addSection4Training = () =>
    setSection4Trainings((prev) => [
      ...prev,
      {
        _id: uid(),
        order: prev.length + 1,
        training: "",
        organizer: "",
        type: "",
        date: "",
        format: "",
        hours: "",
        meetsAuditGoal: "",
        sharedKnowledge: "",
      },
    ]);
  const removeSection4Training = (id: string) =>
    setSection4Trainings((prev) =>
      prev.filter((t) => t._id !== id).map((t, i) => ({ ...t, order: i + 1 })),
    );
  const updateSection4Training = (
    id: string,
    field: keyof Section4Training,
    value: any,
  ) =>
    setSection4Trainings((prev) =>
      prev.map((t) => (t._id === id ? { ...t, [field]: value } : t)),
    );

  // â”€â”€â”€ Section 5 tasks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const addSection5Task = () =>
    setSection5Tasks((prev) => [
      ...prev,
      { _id: uid(), order: prev.length + 1, taskType: "", completedWork: "" },
    ]);
  const removeSection5Task = (id: string) =>
    setSection5Tasks((prev) =>
      prev.filter((t) => t._id !== id).map((t, i) => ({ ...t, order: i + 1 })),
    );
  const updateSection5Task = (
    id: string,
    field: keyof Section5Task,
    value: any,
  ) =>
    setSection5Tasks((prev) =>
      prev.map((t) => (t._id === id ? { ...t, [field]: value } : t)),
    );

  // â”€â”€â”€ Section 6 activities â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const addSection6Activity = () =>
    setSection6Activities((prev) => [
      ...prev,
      {
        _id: uid(),
        order: prev.length + 1,
        date: "",
        activity: "",
        initiative: "",
      },
    ]);
  const removeSection6Activity = (id: string) =>
    setSection6Activities((prev) =>
      prev.filter((t) => t._id !== id).map((t, i) => ({ ...t, order: i + 1 })),
    );
  const updateSection6Activity = (
    id: string,
    field: keyof Section6Activity,
    value: any,
  ) =>
    setSection6Activities((prev) =>
      prev.map((t) => (t._id === id ? { ...t, [field]: value } : t)),
    );

  // â”€â”€â”€ Dynamic sections â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const addSection = () =>
    setDynamicSections((prev) => [
      ...prev,
      { _id: uid(), order: prev.length + 2, title: "Ð¨Ð¸Ð½Ñ Ñ…ÑÑÑÐ³", content: "" },
    ]);

  const removeSection = (id: string) =>
    setDynamicSections((prev) =>
      prev.filter((s) => s._id !== id).map((s, i) => ({ ...s, order: i + 2 })),
    );

  const updateSection = (id: string, field: keyof DynSection, value: any) =>
    setDynamicSections((prev) =>
      prev.map((s) => (s._id === id ? { ...s, [field]: value } : s)),
    );

  const inputCls =
    "w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition";
  const labelCls = "block text-xs font-medium text-slate-400 mb-1";

  return (
    <div className="flex h-screen overflow-hidden bg-slate-900">
      {/* â”€â”€â”€ LEFT: Editor â”€â”€â”€ */}
      <div className="flex flex-col w-1/2 border-r border-slate-700/50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur flex-shrink-0">
          <div className="flex items-center gap-2">
            <Link
              href="/tools/tailan"
              className="text-slate-400 hover:text-white transition"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <span className="font-semibold text-white text-sm">
              Ó¨Ó©Ñ€Ð¸Ð¹Ð½ Ñ‚Ð°Ð¹Ð»Ð°Ð½
            </span>
          </div>

          <div className="flex items-center gap-2">
            {savedMsg && (
              <span className="text-emerald-400 text-xs flex items-center gap-1">
                <Check className="h-3 w-3" /> {savedMsg}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium transition disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Ð¥Ð°Ð´Ð³Ð°Ð»Ð°Ñ…
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition disabled:opacity-50"
            >
              {downloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Word Ñ‚Ð°Ñ‚Ð°Ñ…
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Ð˜Ð»Ð³ÑÑÑ…
            </button>
          </div>
        </div>

        {/* Scrollable form */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Year & Quarter & Name */}
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[120px]">
              <label className={labelCls}>ÐÑÑ€ (ÐºÐ¸Ñ€Ð¸Ð»Ð»Ð¸Ñ†ÑÑÑ€)</label>
              <input
                value={cyrillicName}
                onChange={(e) => setCyrillicName(e.target.value)}
                placeholder="Ð–ÑˆÑÑ Ð¾Ð²Ð¾Ð³Ñ‚Ð¾Ð¹Ð³Ð¾Ð¾ Ð±Ð¸Ñ‡Ð½Ñ"
                className={inputCls}
              />
            </div>
            <div className="flex-1 min-w-[100px]">
              <label className={labelCls}>ÐžÐ½</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className={inputCls}
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className={labelCls}>Ð£Ð»Ð¸Ñ€Ð°Ð»</label>
              <select
                value={quarter}
                onChange={(e) => setQuarter(Number(e.target.value))}
                className={inputCls}
              >
                {[1, 2, 3, 4].map((q) => (
                  <option key={q} value={q}>
                    {q}-Ñ€ ÑƒÐ»Ð¸Ñ€Ð°Ð»
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 1: Planned tasks */}
          <section className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">
                1. ÐÑƒÐ´Ð¸Ñ‚Ñ‹Ð½ Ò¯Ð¹Ð» Ð°Ð¶Ð¸Ð»Ð»Ð°Ð³Ð°Ð°Ð½Ð´ ÑˆÐ°Ð°Ñ€Ð´Ð»Ð°Ð³Ð°Ñ‚Ð°Ð¹ Ó©Ð³Ó©Ð³Ð´Ó©Ð» Ð±Ð¾Ð»Ð¾Ð²ÑÑ€ÑƒÑƒÐ»Ð°Ð»Ñ‚Ñ‹Ð½
                Ð°Ð¶Ð¸Ð»
              </h3>
              <button
                onClick={addTask}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
              >
                <Plus className="h-3.5 w-3.5" /> ÐœÓ©Ñ€ Ð½ÑÐ¼ÑÑ…
              </button>
            </div>

            <div className="space-y-3">
              {plannedTasks.map((t, idx) => (
                <div
                  key={t._id}
                  className="bg-slate-700/30 rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">
                      #{t.order}
                    </span>
                    <button
                      onClick={() => removeTask(t._id)}
                      className="text-red-400/70 hover:text-red-400 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <label className={labelCls}>ÐÐ¶Ð»Ñ‹Ð½ Ð½ÑÑ€</label>
                      <input
                        value={t.title}
                        onChange={(e) =>
                          updateTask(t._id, "title", e.target.value)
                        }
                        placeholder="ÐÐ¶Ð»Ñ‹Ð½ Ð½ÑÑ€..."
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Ð“Ò¯Ð¹Ñ†ÑÑ‚Ð³ÑÐ» %</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={t.completion}
                        onChange={(e) =>
                          updateTask(
                            t._id,
                            "completion",
                            Number(e.target.value),
                          )
                        }
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Ð­Ñ…Ð»ÑÑ… Ð¾Ð³Ð½Ð¾Ð¾</label>
                      <input
                        value={t.startDate}
                        onChange={(e) =>
                          updateTask(t._id, "startDate", e.target.value)
                        }
                        placeholder="2025.10.01"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Ð”ÑƒÑƒÑÐ°Ñ… Ð¾Ð³Ð½Ð¾Ð¾</label>
                      <input
                        value={t.endDate}
                        onChange={(e) =>
                          updateTask(t._id, "endDate", e.target.value)
                        }
                        placeholder="2025.12.31"
                        className={inputCls}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>Ð“Ò¯Ð¹Ñ†ÑÑ‚Ð³ÑÐ» /Ñ‚Ð¾Ð²Ñ‡/</label>
                      <textarea
                        value={t.description}
                        onChange={(e) =>
                          updateTask(t._id, "description", e.target.value)
                        }
                        placeholder="Ð“Ò¯Ð¹Ñ†ÑÑ‚Ð³ÑÐ»Ð¸Ð¹Ð½ Ñ‚Ð¾Ð²Ñ‡ Ñ‚Ð°Ð¹Ð»Ð±Ð°Ñ€..."
                        rows={2}
                        className={inputCls + " resize-none"}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section II: Ó¨Ð³Ó©Ð³Ð´Ó©Ð» Ð±Ð¾Ð»Ð¾Ð²ÑÑ€ÑƒÑƒÐ»Ð°Ñ… Ð°Ð¶Ð¸Ð» */}
          <section className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">
                II. ÐÑƒÐ´Ð¸Ñ‚Ñ‹Ð½ Ò¯Ð¹Ð» Ð°Ð¶Ð¸Ð»Ð»Ð°Ð³Ð°Ð°Ð½Ð´ ÑˆÐ°Ð°Ñ€Ð´Ð»Ð°Ð³Ð°Ñ‚Ð°Ð¹ Ó©Ð³Ó©Ð³Ð´Ó©Ð» Ð±Ð¾Ð»Ð¾Ð²ÑÑ€ÑƒÑƒÐ»Ð°Ñ…
                Ð°Ð¶Ð¸Ð»
              </h3>
              <button
                onClick={addSection2Task}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
              >
                <Plus className="h-3.5 w-3.5" /> ÐœÓ©Ñ€ Ð½ÑÐ¼ÑÑ…
              </button>
            </div>
            <div className="space-y-2">
              {section2Tasks.map((t) => (
                <div
                  key={t._id}
                  className="bg-slate-700/30 rounded-lg p-2 space-y-1.5"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500 w-5 shrink-0 text-center">
                      {t.order}
                    </span>
                    <input
                      value={t.title}
                      onChange={(e) =>
                        updateSection2Task(t._id, "title", e.target.value)
                      }
                      placeholder="Ð¢Ó©Ð»Ó©Ð²Ð»Ó©Ð³Ó©Ó©Ñ‚ Ð°Ð¶Ð»Ñ‹Ð½ Ð½ÑÑ€..."
                      className={inputCls + " flex-1"}
                    />
                    <button
                      onClick={() => removeSection2Task(t._id)}
                      className="text-red-400/70 hover:text-red-400 transition shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 pl-6">
                    <input
                      value={t.result}
                      onChange={(e) =>
                        updateSection2Task(t._id, "result", e.target.value)
                      }
                      placeholder="ÐÐ¶Ð»Ñ‹Ð½ Ð³Ò¯Ð¹Ñ†ÑÑ‚Ð³ÑÐ»..."
                      className={inputCls}
                    />
                    <input
                      value={t.period}
                      onChange={(e) =>
                        updateSection2Task(t._id, "period", e.target.value)
                      }
                      placeholder="Ð¥Ð¸Ð¹Ð³Ð´ÑÑÐ½ Ñ…ÑƒÐ³Ð°Ñ†Ð°Ð°..."
                      className={inputCls}
                    />
                    <input
                      value={t.completion}
                      onChange={(e) =>
                        updateSection2Task(t._id, "completion", e.target.value)
                      }
                      placeholder="Ð“Ò¯Ð¹Ñ†ÑÑ‚Ð³ÑÐ»..."
                      className={inputCls}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section III: Ð¢Ð¾Ð³Ñ‚Ð¼Ð¾Ð» Ñ…Ð¸Ð¹Ð³Ð´Ð´ÑÐ³ Ð°Ð¶Ð»ÑƒÑƒÐ´ */}
          <section className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4">
            <h3 className="text-sm font-semibold text-white mb-3">
              III. Ð¢Ð¾Ð³Ñ‚Ð¼Ð¾Ð» Ñ…Ð¸Ð¹Ð³Ð´Ð´ÑÐ³ Ð°Ð¶Ð»ÑƒÑƒÐ´
            </h3>

            {/* III.1 â€“ ÐÐ²Ñ‚Ð¾Ð¼Ð°Ñ‚Ð¶ÑƒÑƒÐ»Ð°Ð»Ñ‚ */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-slate-300">
                  III.1 Ó¨Ð³Ó©Ð³Ð´Ó©Ð» Ð±Ð¾Ð»Ð¾Ð²ÑÑ€ÑƒÑƒÐ»Ð°Ð»Ñ‚ Ð°Ð²Ñ‚Ð¾Ð¼Ð°Ñ‚Ð¶ÑƒÑƒÐ»Ð°Ð»Ñ‚Ñ‹Ð³ Ñ†Ð°Ð³ Ñ…ÑƒÐ³Ð°Ñ†Ð°Ð°Ð½Ð´ Ð½ÑŒ
                  Ð³Ò¯Ð¹Ñ†ÑÑ‚Ð³ÑÑÑÐ½ Ð±Ð°Ð¹Ð´Ð°Ð»
                </p>
                <button
                  onClick={addSection3AutoTask}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" /> ÐœÓ©Ñ€
                </button>
              </div>
              <div className="space-y-2">
                {section3AutoTasks.map((t) => (
                  <div
                    key={t._id}
                    className="bg-slate-700/30 rounded-lg p-2 space-y-1.5"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-500 w-5 shrink-0 text-center">
                        {t.order}
                      </span>
                      <input
                        value={t.title}
                        onChange={(e) =>
                          updateSection3AutoTask(t._id, "title", e.target.value)
                        }
                        placeholder="Ð¢Ð¾Ð³Ñ‚Ð¼Ð¾Ð» Ñ…Ð¸Ð¹Ð³Ð´Ð´ÑÐ³ Ð°Ð²Ñ‚Ð¾Ð¼Ð°Ñ‚Ð¶ÑƒÑƒÐ»Ð°Ð»Ñ‚..."
                        className={inputCls + " flex-1"}
                      />
                      <button
                        onClick={() => removeSection3AutoTask(t._id)}
                        className="text-red-400/70 hover:text-red-400 transition shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 pl-6">
                      <input
                        value={t.value}
                        onChange={(e) =>
                          updateSection3AutoTask(t._id, "value", e.target.value)
                        }
                        placeholder="ÐÑ‡ Ñ…Ð¾Ð»Ð±Ð¾Ð³Ð´Ð¾Ð»/Ñ…ÑÑ€ÑÐ³Ð»ÑÑ..."
                        className={inputCls}
                      />
                      <input
                        value={t.rating}
                        onChange={(e) =>
                          updateSection3AutoTask(
                            t._id,
                            "rating",
                            e.target.value,
                          )
                        }
                        placeholder="Ð¥ÑÑ€ÑÐ³Ð»ÑÐ³Ñ‡Ð¸Ð¹Ð½ Ò¯Ð½ÑÐ»Ð³ÑÑ..."
                        className={inputCls}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* III.2 â€“ Dashboard */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-slate-300">
                  III.2 Ð”Ð°ÑˆÐ±Ð¾Ð°Ñ€Ð´Ñ‹Ð½ Ñ…ÑÐ²Ð¸Ð¹Ð½ Ð°Ð¶Ð¸Ð»Ð»Ð°Ð³Ð°Ð°Ð³ Ñ…Ð°Ð½Ð³Ð°Ð¶ Ð°Ð¶Ð¸Ð»Ð»Ð°ÑÐ°Ð½ Ð±Ð°Ð¹Ð´Ð°Ð»
                </p>
                <button
                  onClick={addSection3Dashboard}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" /> ÐœÓ©Ñ€
                </button>
              </div>
              <div className="space-y-2">
                {section3Dashboards.map((t) => (
                  <div
                    key={t._id}
                    className="bg-slate-700/30 rounded-lg p-2 space-y-1.5"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-500 w-5 shrink-0 text-center">
                        {t.order}
                      </span>
                      <input
                        value={t.dashboard}
                        onChange={(e) =>
                          updateSection3Dashboard(
                            t._id,
                            "dashboard",
                            e.target.value,
                          )
                        }
                        placeholder="Dashboard Ð½ÑÑ€..."
                        className={inputCls + " flex-1"}
                      />
                      <button
                        onClick={() => removeSection3Dashboard(t._id)}
                        className="text-red-400/70 hover:text-red-400 transition shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 pl-6">
                      <input
                        value={t.value}
                        onChange={(e) =>
                          updateSection3Dashboard(
                            t._id,
                            "value",
                            e.target.value,
                          )
                        }
                        placeholder="ÐÑ‡ Ñ…Ð¾Ð»Ð±Ð¾Ð³Ð´Ð¾Ð»/Ñ…ÑÑ€ÑÐ³Ð»ÑÑ..."
                        className={inputCls}
                      />
                      <input
                        value={t.rating}
                        onChange={(e) =>
                          updateSection3Dashboard(
                            t._id,
                            "rating",
                            e.target.value,
                          )
                        }
                        placeholder="Ð¥ÑÑ€ÑÐ³Ð»ÑÐ³Ñ‡ Ð½ÑÐ³Ð¶Ð¸Ð¹Ð½ Ò¯Ð½ÑÐ»Ð³ÑÑ..."
                        className={inputCls}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Dynamic sections */}
          <section className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">
                Ð¢Ð¾Ð¼ Ñ…ÑÑÐ³Ò¯Ò¯Ð´ (VIII, IX, â€¦)
              </h3>
              <button
                onClick={addSection}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
              >
                <Plus className="h-3.5 w-3.5" /> Ð¢Ð¾Ð¼ Ñ…ÑÑÑÐ³ Ð½ÑÐ¼ÑÑ…
              </button>
            </div>
            <div className="space-y-3">
              {dynamicSections.map((sec, idx) => (
                <div
                  key={sec._id}
                  className="bg-slate-700/30 rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium w-8 shrink-0">
                      {ROMAN_NUMS[idx + 7] ?? `${idx + 8}`}.
                    </span>
                    <input
                      value={sec.title}
                      onChange={(e) =>
                        updateSection(sec._id, "title", e.target.value)
                      }
                      className={inputCls + " flex-1"}
                      placeholder="Ð¥ÑÑÐ³Ð¸Ð¹Ð½ Ð³Ð°Ñ€Ñ‡Ð¸Ð³..."
                    />
                    <button
                      onClick={() => removeSection(sec._id)}
                      className="text-red-400/70 hover:text-red-400 transition flex-shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <RichToolbar
                    value={sec.content}
                    onChange={(v) => updateSection(sec._id, "content", v)}
                    rows={4}
                    placeholder="Ð¥ÑÑÐ³Ð¸Ð¹Ð½ Ð°Ð³ÑƒÑƒÐ»Ð³Ð°..."
                    className={inputCls + " resize-y"}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Section IV: Ð¥Ð°Ð¼Ñ€Ð°Ð³Ð´ÑÐ°Ð½ ÑÑƒÑ€Ð³Ð°Ð»Ñ‚ */}
          <section className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">
                IV. Ð¥Ð°Ð¼Ñ€Ð°Ð³Ð´ÑÐ°Ð½ ÑÑƒÑ€Ð³Ð°Ð»Ñ‚
              </h3>
              <button
                onClick={addSection4Training}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
              >
                <Plus className="h-3.5 w-3.5" /> ÐœÓ©Ñ€ Ð½ÑÐ¼ÑÑ…
              </button>
            </div>
            <div className="space-y-2">
              {section4Trainings.map((t) => (
                <div
                  key={t._id}
                  className="bg-slate-700/30 rounded-lg p-2 space-y-1.5"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500 w-5 shrink-0 text-center">
                      {t.order}
                    </span>
                    <input
                      value={t.training}
                      onChange={(e) =>
                        updateSection4Training(
                          t._id,
                          "training",
                          e.target.value,
                        )
                      }
                      placeholder="Ð¡ÑƒÑ€Ð³Ð°Ð»Ñ‚Ñ‹Ð½ Ð½ÑÑ€..."
                      className={inputCls + " flex-1"}
                    />
                    <button
                      onClick={() => removeSection4Training(t._id)}
                      className="text-red-400/70 hover:text-red-400 transition shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 pl-6">
                    <input
                      value={t.organizer}
                      onChange={(e) =>
                        updateSection4Training(
                          t._id,
                          "organizer",
                          e.target.value,
                        )
                      }
                      placeholder="Ð—Ð¾Ñ…Ð¸Ð¾Ð½ Ð±Ð°Ð¹Ð³ÑƒÑƒÐ»Ð°Ð³Ñ‡"
                      className={inputCls}
                    />
                    <input
                      value={t.type}
                      onChange={(e) =>
                        updateSection4Training(t._id, "type", e.target.value)
                      }
                      placeholder="ÐžÐ½Ð»Ð°Ð¹Ð½ / Ð¢Ð°Ð½Ñ…Ð¸Ð¼"
                      className={inputCls}
                    />
                    <input
                      value={t.date}
                      onChange={(e) =>
                        updateSection4Training(t._id, "date", e.target.value)
                      }
                      placeholder="Ð¥ÑÐ·ÑÑ (Ð¾Ð³Ð½Ð¾Ð¾)"
                      className={inputCls}
                    />
                    <input
                      value={t.format}
                      onChange={(e) =>
                        updateSection4Training(t._id, "format", e.target.value)
                      }
                      placeholder="Ð¡ÑƒÑ€Ð³Ð°Ð»Ñ‚Ñ‹Ð½ Ñ…ÑÐ»Ð±ÑÑ€"
                      className={inputCls}
                    />
                    <input
                      value={t.hours}
                      onChange={(e) =>
                        updateSection4Training(t._id, "hours", e.target.value)
                      }
                      placeholder="Ð¦Ð°Ð³"
                      className={inputCls}
                    />
                    <input
                      value={t.meetsAuditGoal}
                      onChange={(e) =>
                        updateSection4Training(
                          t._id,
                          "meetsAuditGoal",
                          e.target.value,
                        )
                      }
                      placeholder="ÐÐ¸Ð¹Ñ†ÑÑÐ½ / ÐÐ¸Ð¹Ñ†ÑÑÐ³Ò¯Ð¹"
                      className={inputCls}
                    />
                    <input
                      value={t.sharedKnowledge}
                      onChange={(e) =>
                        updateSection4Training(
                          t._id,
                          "sharedKnowledge",
                          e.target.value,
                        )
                      }
                      placeholder="Ð¥ÑƒÐ²Ð°Ð°Ð»Ñ†ÑÐ°Ð½ / Ð¥ÑƒÐ²Ð°Ð°Ð»Ñ†Ð°Ð°Ð³Ò¯Ð¹"
                      className={inputCls + " col-span-2"}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <p className="text-xs font-medium text-slate-300 mb-1">
                IV.1 Ð¡ÑƒÑ€Ð³Ð°Ð»Ñ‚Ð°Ð°Ñ Ð¾Ð»Ð¶ Ð°Ð²ÑÐ°Ð½ Ð¼ÑÐ´Ð»ÑÐ³ÑÑ Ð°ÑˆÐ¸Ð³Ð»Ð°Ð¶ Ð±ÑƒÐ¹ Ð±Ð°Ð¹Ð´Ð°Ð»
              </p>
              <RichToolbar
                value={section4KnowledgeText}
                onChange={setSection4KnowledgeText}
                rows={3}
                placeholder="ÐœÑÐ´Ð»ÑÐ³ÑÑ Ð°ÑˆÐ¸Ð³Ð»Ð°Ð¶ Ð±ÑƒÐ¹ Ð±Ð°Ð¹Ð´Ð»Ð°Ð° Ñ‚Ð°Ð¹Ð»Ð±Ð°Ñ€Ð»Ð°Ð½Ð° ÑƒÑƒ..."
                className={inputCls + " resize-y"}
              />
            </div>
          </section>

          {/* Section V: Ò®Ò¯Ñ€ÑÐ³ Ð´Ð°Ð°Ð»Ð³Ð°Ð²Ð°Ñ€Ñ‹Ð½ Ð±Ð¸ÐµÐ»ÑÐ»Ñ‚ */}
          <section className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">
                V. Ò®Ò¯Ñ€ÑÐ³ Ð´Ð°Ð°Ð»Ð³Ð°Ð²Ð°Ñ€Ñ‹Ð½ Ð±Ð¸ÐµÐ»ÑÐ»Ñ‚
              </h3>
              <button
                onClick={addSection5Task}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
              >
                <Plus className="h-3.5 w-3.5" /> ÐœÓ©Ñ€ Ð½ÑÐ¼ÑÑ…
              </button>
            </div>
            <div className="space-y-2">
              {section5Tasks.map((t) => (
                <div
                  key={t._id}
                  className="bg-slate-700/30 rounded-lg p-2 space-y-1.5"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500 w-5 shrink-0 text-center">
                      {t.order}
                    </span>
                    <input
                      value={t.taskType}
                      onChange={(e) =>
                        updateSection5Task(t._id, "taskType", e.target.value)
                      }
                      placeholder="ÐÐ¶Ð»Ñ‹Ð½ Ñ‚Ó©Ñ€Ó©Ð»..."
                      className={inputCls + " flex-1"}
                    />
                    <button
                      onClick={() => removeSection5Task(t._id)}
                      className="text-red-400/70 hover:text-red-400 transition shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="pl-6">
                    <textarea
                      value={t.completedWork}
                      onChange={(e) =>
                        updateSection5Task(
                          t._id,
                          "completedWork",
                          e.target.value,
                        )
                      }
                      placeholder="Ð¥Ð¸Ð¹Ð³Ð´ÑÑÐ½ Ð°Ð¶Ð¸Ð»..."
                      rows={2}
                      className={inputCls + " resize-none"}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section VI: Ð¥Ð°Ð¼Ñ‚ Ð¾Ð»Ð½Ñ‹ Ð°Ð¶Ð¸Ð» */}
          <section className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">
                VI. Ð¥Ð°Ð¼Ñ‚ Ð¾Ð»Ð½Ñ‹ Ð°Ð¶Ð¸Ð»
              </h3>
              <button
                onClick={addSection6Activity}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
              >
                <Plus className="h-3.5 w-3.5" /> ÐœÓ©Ñ€ Ð½ÑÐ¼ÑÑ…
              </button>
            </div>
            <div className="space-y-2">
              {section6Activities.map((t) => (
                <div
                  key={t._id}
                  className="bg-slate-700/30 rounded-lg p-2 space-y-1.5"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500 w-5 shrink-0 text-center">
                      {t.order}
                    </span>
                    <input
                      value={t.activity}
                      onChange={(e) =>
                        updateSection6Activity(
                          t._id,
                          "activity",
                          e.target.value,
                        )
                      }
                      placeholder="Ð¥Ð°Ð¼Ñ‚ Ð¾Ð»Ð½Ñ‹ Ð°Ð¶Ð¸Ð»..."
                      className={inputCls + " flex-1"}
                    />
                    <button
                      onClick={() => removeSection6Activity(t._id)}
                      className="text-red-400/70 hover:text-red-400 transition shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 pl-6">
                    <input
                      value={t.date}
                      onChange={(e) =>
                        updateSection6Activity(t._id, "date", e.target.value)
                      }
                      placeholder="ÐžÐ³Ð½Ð¾Ð¾"
                      className={inputCls}
                    />
                    <input
                      value={t.initiative}
                      onChange={(e) =>
                        updateSection6Activity(
                          t._id,
                          "initiative",
                          e.target.value,
                        )
                      }
                      placeholder="Ð¡Ð°Ð½Ð°Ð°Ñ‡Ð¸Ð»Ð³Ð°"
                      className={inputCls}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section VII: Ð¨Ð¸Ð½Ñ ÑÐ°Ð½Ð°Ð» ÑÐ°Ð½Ð°Ð°Ñ‡Ð¸Ð»Ð³Ð° */}
          <section className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4">
            <h3 className="text-sm font-semibold text-white mb-3">
              VII. Ð¨Ð¸Ð½Ñ ÑÐ°Ð½Ð°Ð» ÑÐ°Ð½Ð°Ð°Ñ‡Ð¸Ð»Ð³Ð°
            </h3>
            <RichToolbar
              value={section7Text}
              onChange={setSection7Text}
              rows={4}
              placeholder="Ð¡Ð°Ð½Ð°Ð» ÑÐ°Ð½Ð°Ð°Ñ‡Ð¸Ð»Ð³Ð°Ð° ÑÐ½Ð´ Ð±Ð¸Ñ‡Ð½Ñ Ò¯Ò¯..."
              className={inputCls + " resize-y"}
            />
          </section>

          {/* Ð—ÑƒÑ€Ð°Ð³Ð½ÑƒÑƒÐ´aa */}
          <section className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-slate-400" />
                Ð—ÑƒÑ€Ð°Ð³Ð½ÑƒÑƒÐ´aa
              </h3>
              <button
                onClick={() => imgFileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 transition"
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                Ð—ÑƒÑ€Ð°Ð³ Ð½ÑÐ¼ÑÑ…
              </button>
              <input
                ref={imgFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
            </div>
            {images.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">
                Ð—ÑƒÑ€Ð°Ð³ Ð±Ð°Ð¹Ñ…Ð³Ò¯Ð¹ Ð±Ð°Ð¹Ð½Ð°
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className="relative group rounded-lg overflow-hidden bg-slate-700/40 aspect-square"
                  >
                    {img.blobUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img.blobUrl}
                        alt={img.filename}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-slate-600" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <button
                        onClick={() => handleDeleteImage(img.id)}
                        className="p-1.5 rounded-full bg-red-500/80 hover:bg-red-500 text-white transition"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="absolute bottom-0 inset-x-0 bg-black/60 text-[10px] text-white truncate px-1.5 py-0.5">
                      {img.filename}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* â”€â”€â”€ RIGHT: Live Word Preview â”€â”€â”€ */}
      <div className="flex flex-col w-1/2 bg-slate-600 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-500/50 text-xs font-medium text-slate-300 flex items-center gap-2 flex-shrink-0 bg-slate-700/50">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Realtime preview â€” Word Ð±Ð°Ñ€Ð¸Ð¼Ñ‚
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
          <WordPreview
            userName={mounted ? cyrillicName.trim() || (user?.name ?? "") : ""}
            userPosition={user?.position}
            userDepartment={user?.department}
            year={year}
            quarter={quarter}
            plannedTasks={plannedTasks}
            section2Tasks={section2Tasks}
            section3AutoTasks={section3AutoTasks}
            section3Dashboards={section3Dashboards}
            dynamicSections={dynamicSections}
            section4Trainings={section4Trainings}
            section4KnowledgeText={section4KnowledgeText}
            section5Tasks={section5Tasks}
            section6Activities={section6Activities}
            section7Text={section7Text}
            images={images}
          />
        </div>
      </div>
    </div>
  );
}
