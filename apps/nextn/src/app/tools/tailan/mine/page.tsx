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
  ArrowLeft,
  ChevronLeft,
  ChevronDown,
  Loader2,
  Check,
  Upload,
  X,
  ImageIcon,
  Eye,
  EyeOff,
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
  Section1Dashboard,
  Section2Task,
  Section3AutoTask,
  Section3Dashboard,
  Section4Training,
  Section5Task,
  Section6Activity,
  TailanImage,
} from "./_components/tailan.types";
import { RichToolbar } from "./_components/RichEditor";
import { WordPreview, ROMAN_NUMS, buildWordHtml } from "./_components/WordPreview";

// --- Shared style helpers -----------------------------------------------------
const inputCls =
  "w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition";
const selectCls =
  "w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition";
const labelCls = "block text-xs font-medium text-slate-400 mb-1";

// --- Inline Row Image Upload -------------------------------------------------
interface RowInlineImg {
  id: string;
  dataUrl: string;
  width: number;
  height?: number; // pixels, undefined = auto
}

function RowImageUpload({
  images,
  onChange,
  inputId,
}: {
  images: RowInlineImg[];
  onChange: (imgs: RowInlineImg[]) => void;
  inputId?: string;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    let pending = files.length;
    const newImgs: RowInlineImg[] = [];
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        newImgs.push({
          id: uid(),
          dataUrl: ev.target?.result as string,
          width: 80,
        });
        pending--;
        if (pending === 0) onChange([...images, ...newImgs]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };
  const remove = (id: string) =>
    onChange(images.filter((img) => img.id !== id));
  const setWidth = (id: string, w: number) =>
    onChange(images.map((img) => (img.id === id ? { ...img, width: w } : img)));
  const setHeight = (id: string, h: number | undefined) =>
    onChange(images.map((img) => (img.id === id ? { ...img, height: h } : img)));
  return (
    <div className={inputId ? "mt-1" : "mt-2"}>
      {!inputId && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-400 transition"
        >
          <ImageIcon className="h-3.5 w-3.5" />
          <span>Зураг нэмэх</span>
        </button>
      )}
      <input
        ref={fileRef}
        id={inputId}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFiles}
        suppressHydrationWarning
      />
      {images.length > 0 && (
        <div className="mt-2 space-y-2">
          {images.map((img) => (
            <div
              key={img.id}
              className="bg-slate-900/50 rounded-lg p-2 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {img.width}% өргөн{img.height ? ` · ${img.height}px өндөр` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => remove(img.id)}
                  className="text-red-400/60 hover:text-red-400 transition"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <img
                src={img.dataUrl}
                alt=""
                style={{
                  width: `${img.width}%`,
                  height: img.height ? `${img.height}px` : undefined,
                  objectFit: img.height ? "fill" : undefined,
                }}
                className="rounded max-w-full"
              />
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-600 w-10 shrink-0">Өргөн</span>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={img.width}
                  onChange={(e) => setWidth(img.id, Number(e.target.value))}
                  className="flex-1 accent-blue-500"
                />
                <span className="text-xs text-slate-500 w-9 text-right shrink-0">{img.width}%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-600 w-10 shrink-0">Өндөр</span>
                <input
                  type="number"
                  min={50}
                  max={2000}
                  step={10}
                  placeholder="auto"
                  value={img.height ?? ""}
                  onChange={(e) =>
                    setHeight(img.id, e.target.value === "" ? undefined : Number(e.target.value))
                  }
                  className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-300 placeholder-slate-600"
                />
                <span className="text-xs text-slate-500 w-9 shrink-0">px</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Main Page ---------------------------------------------------------------
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
      images: [],
    },
  ]);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(
    new Set(),
  );
  const toggleTaskExpand = (id: string) =>
    setExpandedTaskIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(),
  );
  const toggleSection = (key: string) =>
    setCollapsedSections((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  const [hiddenSections, setHiddenSections] = useState<Set<string>>(
    new Set(),
  );
  const toggleHideSection = (key: string) =>
    setHiddenSections((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  const [dynamicSections, setDynamicSections] = useState<DynSection[]>([
    { _id: uid(), order: 2, title: "Нэмэлт хэсэг", content: "" },
  ]);
  const [section2Tasks, setSection2Tasks] = useState<Section2Task[]>([
    {
      _id: uid(),
      order: 1,
      title: "",
      result: "",
      period: "",
      completion: "",
      images: [],
    },
  ]);
  const [section3AutoTasks, setSection3AutoTasks] = useState<
    Section3AutoTask[]
  >([{ _id: uid(), order: 1, title: "", value: "", rating: "" }]);
  const [section3Dashboards, setSection3Dashboards] = useState<
    Section3Dashboard[]
  >([{ _id: uid(), order: 1, dashboard: "", value: "", rating: "" }]);
  const [section1Dashboards, setSection1Dashboards] = useState<
    Section1Dashboard[]
  >([
    {
      _id: uid(),
      order: 1,
      title: "",
      completion: "",
      period: "",
      summary: "",
      images: [],
    },
  ]);
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
        if (r.section1Dashboards?.length)
          setSection1Dashboards(
            r.section1Dashboards.map((t: any) => ({ ...t, _id: uid() })),
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
    section1Dashboards: section1Dashboards.map(({ _id, ...t }) => t),
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
      setSavedMsg("Хадгалагдлаа");
      setTimeout(() => setSavedMsg(""), 2500);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Хадгалахад алдаа гарлаа";
      setSavedMsg(`❌ ${msg}`);
      setTimeout(() => setSavedMsg(""), 5000);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!confirm("Тайланг илгээх үү? Буцааж болохгүй.")) return;
    setSubmitting(true);
    try {
      await tailanApi.saveDraft({ ...toDto(), status: "submitted" });
      await tailanApi.submitReport(year, quarter);
      setSavedMsg("Илгээгдлээ");
      setTimeout(() => setSavedMsg(""), 3000);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || "Илгээхэд алдаа гарлаа";
      setSavedMsg(`❌ ${msg}`);
      setTimeout(() => setSavedMsg(""), 5000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = () => {
    setDownloading(true);
    try {
      const html = buildWordHtml({
        userName: cyrillicName.trim() || user?.name || "",
        userPosition: user?.position,
        userDepartment: user?.department,
        year,
        quarter,
        plannedTasks,
        section2Tasks,
        section3AutoTasks,
        section3Dashboards,
        section1Dashboards,
        dynamicSections,
        section4Trainings,
        section4KnowledgeText,
        section5Tasks,
        section6Activities,
        section7Text,
        images,
        hiddenSections,
      });
      const blob = new Blob([html], { type: "application/msword" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `тайлан-${cyrillicName.trim() || user?.name || "mine"}-${year}-Q${quarter}.doc`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  // --- Planned tasks ------------------------------------------------------
  const addTask = () => {
    const newId = uid();
    setPlannedTasks((prev) => [
      ...prev,
      {
        _id: newId,
        order: prev.length + 1,
        title: "",
        completion: 100,
        startDate: "",
        endDate: "",
        description: "",
        images: [],
      },
    ]);
    setExpandedTaskIds((prev) => {
      const n = new Set(prev);
      n.add(newId);
      return n;
    });
  };

  const removeTask = (id: string) => {
    setPlannedTasks((prev) =>
      prev.filter((t) => t._id !== id).map((t, i) => ({ ...t, order: i + 1 })),
    );
    setExpandedTaskIds((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  };

  const updateTask = (id: string, field: keyof PlannedTask, value: any) =>
    setPlannedTasks((prev) =>
      prev.map((t) => (t._id === id ? { ...t, [field]: value } : t)),
    );

  // --- Section 2 tasks ---------------------------------------------------
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
        images: [],
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

  // --- Section 3 auto tasks ----------------------------------------------
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

  // --- Section 1 dashboards (I.2) ----------------------------------------
  const addSection1Dashboard = () =>
    setSection1Dashboards((prev) => [
      ...prev,
      {
        _id: uid(),
        order: prev.length + 1,
        title: "",
        completion: "",
        period: "",
        summary: "",
        images: [],
      },
    ]);
  const removeSection1Dashboard = (id: string) =>
    setSection1Dashboards((prev) =>
      prev.filter((t) => t._id !== id).map((t, i) => ({ ...t, order: i + 1 })),
    );
  const updateSection1Dashboard = (
    id: string,
    field: keyof Section1Dashboard,
    value: any,
  ) =>
    setSection1Dashboards((prev) =>
      prev.map((t) => (t._id === id ? { ...t, [field]: value } : t)),
    );

  // --- Section 3 dashboards ----------------------------------------------
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

  // --- Section 4 trainings -----------------------------------------------
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

  // --- Section 5 tasks ---------------------------------------------------
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

  // --- Section 6 activities ----------------------------------------------
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

  // --- Dynamic sections ---------------------------------------------------
  const addSection = () =>
    setDynamicSections((prev) => [
      ...prev,
      { _id: uid(), order: prev.length + 2, title: "Шинэ хэсэг", content: "" },
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
      {/* --- LEFT: Editor --- */}
      <div className="flex flex-col w-1/2 border-r border-slate-700/50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur flex-shrink-0">
          <div className="flex items-center gap-2">
            <Link
              href="/tools/tailan"
              className="flex items-center gap-1.5 text-slate-400 hover:text-slate-100 transition-colors text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              Буцах
            </Link>
            <span className="font-semibold text-white text-sm">
              Миний тайлан
            </span>
          </div>

          <div className="flex items-center gap-2">
            {savedMsg && (
              <span
                className={`text-xs flex items-center gap-1 ${savedMsg.startsWith("❌") ? "text-red-400" : "text-emerald-400"}`}
              >
                {savedMsg.startsWith("❌") ? (
                  <X className="h-3 w-3" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                {savedMsg.replace(/^❌ /, "")}
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
              Хадгалах
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
              Word татах
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
              Илгээх
            </button>
          </div>
        </div>

        {/* Scrollable form */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Year & Quarter & Name */}
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[120px]">
              <label className={labelCls}>Нэр (кириллээр)</label>
              <input
                value={cyrillicName}
                onChange={(e) => setCyrillicName(e.target.value)}
                placeholder="Тайланд бичигдэх нэрээ оруулна уу"
                className={inputCls}
              />
            </div>
            <div className="flex-1 min-w-[100px]">
              <label className={labelCls}>Он</label>
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
              <label className={labelCls}>Улирал</label>
              <select
                value={quarter}
                onChange={(e) => setQuarter(Number(e.target.value))}
                className={inputCls}
              >
                {[1, 2, 3, 4].map((q) => (
                  <option key={q} value={q}>
                    {q}-р улирал
                  </option>
                ))}
              </select>
            </div>
          </div>
          {/* Section 1: Planned tasks */}
          <section className={`rounded-xl border border-slate-700/60 bg-slate-800/30 p-4 ${hiddenSections.has("s1") ? "opacity-50" : ""}`}>
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => toggleSection("s1")}
            >
              <h3 className="text-sm font-semibold text-white">
                I. Дата анализын үр дүнгээр аудитын үйл ажиллагааг дэмжсэн
                байдал
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleHideSection("s1");
                  }}
                  title={hiddenSections.has("s1") ? "Тайланд харуулах" : "Тайлангаас нуух"}
                  className={`transition ${hiddenSections.has("s1") ? "text-red-400 hover:text-red-300" : "text-slate-400 hover:text-slate-300"}`}
                >
                  {hiddenSections.has("s1") ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addTask();
                  }}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
                >
                  <Plus className="h-3.5 w-3.5" /> Ажил нэмэх
                </button>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${collapsedSections.has("s1") ? "-rotate-90" : ""}`}
                />
              </div>
            </div>

            <div
              className={`space-y-2 mt-3 ${collapsedSections.has("s1") ? "hidden" : ""}`}
            >
              {plannedTasks.map((t) => {
                const isOpen = expandedTaskIds.has(t._id);
                return (
                  <div
                    key={t._id}
                    className="bg-slate-700/30 rounded-lg overflow-hidden"
                  >
                    {/* Collapsed header — always visible */}
                    <div
                      className="flex items-center gap-2 px-2.5 py-2 cursor-pointer hover:bg-slate-700/60 transition select-none"
                      onClick={() => toggleTaskExpand(t._id)}
                    >
                      <span className="text-xs text-slate-500 w-5 shrink-0 text-center">
                        {t.order}
                      </span>
                      <span className="flex-1 text-sm font-bold text-white">
                        {t.title ? (
                          t.title
                        ) : (
                          <span className="font-normal text-slate-500">
                            Ажлын нэр...
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <label
                          htmlFor={t._id + "-img"}
                          className="cursor-pointer text-slate-400 hover:text-blue-400 transition"
                          onClick={(e) => e.stopPropagation()}
                          suppressHydrationWarning
                        >
                          <ImageIcon className="h-3.5 w-3.5" />
                        </label>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeTask(t._id);
                          }}
                          className="text-red-400/70 hover:text-red-400 transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <ChevronDown
                          className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                        />
                      </div>
                    </div>
                    {/* Expanded form */}
                    {isOpen && (
                      <div className="px-3 pb-3 space-y-2 border-t border-slate-700/50">
                        <div className="grid grid-cols-2 gap-2 pt-2">
                          <div className="col-span-2">
                            <label className={labelCls}>Ажлын нэр</label>
                            <input
                              value={t.title}
                              onChange={(e) =>
                                updateTask(t._id, "title", e.target.value)
                              }
                              placeholder="Ажлын нэр..."
                              className={inputCls + " font-bold"}
                            />
                          </div>
                          <div className="col-span-2">
                            <label className={labelCls}>
                              Гүйцэтгэл /тайлбар/
                            </label>
                            <RichToolbar
                              value={t.description}
                              onChange={(v) =>
                                updateTask(t._id, "description", v)
                              }
                              placeholder="Дэлгэрэнгүй тайлбар бичнэ үү..."
                              rows={2}
                              className={inputCls + " resize-none"}
                            />
                          </div>
                        </div>
                        <RowImageUpload
                          inputId={t._id + "-img"}
                          images={t.images ?? []}
                          onChange={(imgs) => updateTask(t._id, "images", imgs)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
          {/* Section I.2: Шинээр хөгжүүлсэн dashboard */}
          <section className={`rounded-xl border border-slate-700/60 bg-slate-800/30 p-4 ${hiddenSections.has("s12") ? "opacity-50" : ""}`}>
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => toggleSection("s12")}
            >
              <h3 className="text-sm font-semibold text-white">
                I.2 Шинээр хөгжүүлсэн Дашбоард хөгжүүлэлтийн чанар, үр дүн
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleHideSection("s12");
                  }}
                  title={hiddenSections.has("s12") ? "Тайланд харуулах" : "Тайлангаас нуух"}
                  className={`transition ${hiddenSections.has("s12") ? "text-red-400 hover:text-red-300" : "text-slate-400 hover:text-slate-300"}`}
                >
                  {hiddenSections.has("s12") ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addSection1Dashboard();
                  }}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
                >
                  <Plus className="h-3.5 w-3.5" /> Нэмэх
                </button>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${collapsedSections.has("s12") ? "-rotate-90" : ""}`}
                />
              </div>
            </div>
            <div
              className={`space-y-3 mt-3 ${collapsedSections.has("s12") ? "hidden" : ""}`}
            >
              {section1Dashboards.map((t) => (
                <div
                  key={t._id}
                  className="bg-slate-700/30 rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">
                      #{t.order}
                    </span>
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor={t._id + "-img"}
                        className="cursor-pointer text-slate-400 hover:text-blue-400 transition"
                        suppressHydrationWarning
                      >
                        <ImageIcon className="h-3.5 w-3.5" />
                      </label>
                      <button
                        onClick={() => removeSection1Dashboard(t._id)}
                        className="text-red-400/70 hover:text-red-400 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <label className={labelCls}>Төлөвлөгөөт ажил</label>
                      <input
                        value={t.title}
                        onChange={(e) =>
                          updateSection1Dashboard(
                            t._id,
                            "title",
                            e.target.value,
                          )
                        }
                        placeholder="Ажлын нэр..."
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Ажлын гүйцэтгэл (%)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={t.completion}
                        onChange={(e) =>
                          updateSection1Dashboard(
                            t._id,
                            "completion",
                            e.target.value,
                          )
                        }
                        placeholder="100"
                        className={inputCls}
                      />
                    </div>
                    <div />
                    <div className="col-span-2">
                      <label className={labelCls}>Хийгдсэн хугацаа</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={labelCls}>Эхлэх огноо</label>
                          <input
                            type="date"
                            value={t.period.split(" – ")[0] ?? ""}
                            onChange={(e) => {
                              const end = t.period.split(" – ")[1] ?? "";
                              updateSection1Dashboard(
                                t._id,
                                "period",
                                e.target.value + (end ? ` – ${end}` : ""),
                              );
                            }}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Дуусах огноо</label>
                          <input
                            type="date"
                            value={t.period.split(" – ")[1] ?? ""}
                            onChange={(e) => {
                              const start = t.period.split(" – ")[0] ?? "";
                              updateSection1Dashboard(
                                t._id,
                                "period",
                                (start ? `${start} – ` : "") + e.target.value,
                              );
                            }}
                            className={inputCls}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>Гүйцэтгэл /товч/</label>
                      <RichToolbar
                        value={t.summary}
                        onChange={(v) =>
                          updateSection1Dashboard(t._id, "summary", v)
                        }
                        placeholder="Товч тайлбар..."
                        rows={2}
                        className={inputCls + " resize-none"}
                      />
                    </div>
                  </div>
                  <RowImageUpload
                    inputId={t._id + "-img"}
                    images={t.images ?? []}
                    onChange={(imgs) =>
                      updateSection1Dashboard(t._id, "images", imgs)
                    }
                  />
                </div>
              ))}
            </div>
          </section>
          {/* Section II: Өгөгдөл боловсруулах ажил */}
          <section className={`rounded-xl border border-slate-700/60 bg-slate-800/30 p-4 ${hiddenSections.has("s2") ? "opacity-50" : ""}`}>
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => toggleSection("s2")}
            >
              <h3 className="text-sm font-semibold text-white">
                II. Аудитын үйл ажиллагаанд шаардлагатай өгөгдөл боловсруулах
                ажил
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleHideSection("s2");
                  }}
                  title={hiddenSections.has("s2") ? "Тайланд харуулах" : "Тайлангаас нуух"}
                  className={`transition ${hiddenSections.has("s2") ? "text-red-400 hover:text-red-300" : "text-slate-400 hover:text-slate-300"}`}
                >
                  {hiddenSections.has("s2") ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addSection2Task();
                  }}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
                >
                  <Plus className="h-3.5 w-3.5" /> Ажил нэмэх
                </button>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${collapsedSections.has("s2") ? "-rotate-90" : ""}`}
                />
              </div>
            </div>
            <div
              className={`space-y-2 mt-3 ${collapsedSections.has("s2") ? "hidden" : ""}`}
            >
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
                      placeholder="Төлөвлөгөөт ажлын нэр..."
                      className={inputCls + " flex-1"}
                    />
                    <label
                      htmlFor={t._id + "-img"}
                      className="cursor-pointer text-slate-400 hover:text-blue-400 transition shrink-0"
                      suppressHydrationWarning
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                    </label>
                    <button
                      onClick={() => removeSection2Task(t._id)}
                      className="text-red-400/70 hover:text-red-400 transition shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="space-y-1.5 pl-6">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={t.result}
                      onChange={(e) =>
                        updateSection2Task(t._id, "result", e.target.value)
                      }
                      placeholder="Ажлын гүйцэтгэл (%)"
                      className={inputCls}
                    />
                    <textarea
                      rows={2}
                      value={t.completion}
                      onChange={(e) =>
                        updateSection2Task(
                          t._id,
                          "completion",
                          e.target.value,
                        )
                      }
                      placeholder="Гүйцэтгэл /товч/"
                      className={inputCls + " resize-none"}
                    />
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className={labelCls}>Эхлэх огноо</label>
                        <input
                          type="date"
                          value={t.period.split(" – ")[0] ?? ""}
                          onChange={(e) => {
                            const end = t.period.split(" – ")[1] ?? "";
                            updateSection2Task(
                              t._id,
                              "period",
                              e.target.value + (end ? ` – ${end}` : ""),
                            );
                          }}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Дуусах огноо</label>
                        <input
                          type="date"
                          value={t.period.split(" – ")[1] ?? ""}
                          onChange={(e) => {
                            const start = t.period.split(" – ")[0] ?? "";
                            updateSection2Task(
                              t._id,
                              "period",
                              (start ? `${start} – ` : "") + e.target.value,
                            );
                          }}
                          className={inputCls}
                        />
                      </div>
                    </div>
                  </div>
                  <RowImageUpload
                    inputId={t._id + "-img"}
                    images={t.images ?? []}
                    onChange={(imgs) =>
                      updateSection2Task(t._id, "images", imgs)
                    }
                  />
                </div>
              ))}
            </div>
          </section>
          {/* Section III: Тогтмол хийгддэг ажлууд */}
          <section className={`rounded-xl border border-slate-700/60 bg-slate-800/30 p-4 ${hiddenSections.has("s3") ? "opacity-50" : ""}`}>
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => toggleSection("s3")}
            >
              <h3 className="text-sm font-semibold text-white">
                III. Тогтмол хийгддэг ажлууд
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleHideSection("s3");
                  }}
                  title={hiddenSections.has("s3") ? "Тайланд харуулах" : "Тайлангаас нуух"}
                  className={`transition ${hiddenSections.has("s3") ? "text-red-400 hover:text-red-300" : "text-slate-400 hover:text-slate-300"}`}
                >
                  {hiddenSections.has("s3") ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${collapsedSections.has("s3") ? "-rotate-90" : ""}`}
                />
              </div>
            </div>

            <div
              className={`mt-3 ${collapsedSections.has("s3") ? "hidden" : ""}`}
            >
              {/* III.1 Автоматжуулалт */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-slate-300">
                    III.1 Өгөгдөл боловсруулалт автоматжуулалтыг цаг хугацаанд
                    нь гүйцэтгэсэн байдал
                  </p>
                  <button
                    onClick={addSection3AutoTask}
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" /> Нэмэх
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
                            updateSection3AutoTask(
                              t._id,
                              "title",
                              e.target.value,
                            )
                          }
                          placeholder="Тогтмол хийгддэг автоматжуулалт..."
                          className={inputCls + " flex-1"}
                        />
                        <button
                          onClick={() => removeSection3AutoTask(t._id)}
                          className="text-red-400/70 hover:text-red-400 transition shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="space-y-1.5 pl-6">
                        <textarea
                          rows={2}
                          value={t.value}
                          onChange={(e) =>
                            updateSection3AutoTask(
                              t._id,
                              "value",
                              e.target.value,
                            )
                          }
                          placeholder="Ач холбогдол/хэрэглээ..."
                          className={inputCls + " resize-none"}
                        />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={t.rating}
                          onChange={(e) =>
                            updateSection3AutoTask(
                              t._id,
                              "rating",
                              e.target.value,
                            )
                          }
                          placeholder="Хэрэглэгчийн үнэлгээ (0-100)"
                          className={inputCls}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* III.2 Dashboard */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-slate-300">
                    III.2 Дашбоардын хэвийн ажиллагааг хангаж ажилласан байдал
                  </p>
                  <button
                    onClick={addSection3Dashboard}
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" /> Нэмэх
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
                          placeholder="Dashboard нэр..."
                          className={inputCls + " flex-1"}
                        />
                        <button
                          onClick={() => removeSection3Dashboard(t._id)}
                          className="text-red-400/70 hover:text-red-400 transition shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="space-y-1.5 pl-6">
                        <textarea
                          rows={2}
                          value={t.value}
                          onChange={(e) =>
                            updateSection3Dashboard(
                              t._id,
                              "value",
                              e.target.value,
                            )
                          }
                          placeholder="Ач холбогдол/хэрэглээ..."
                          className={inputCls + " resize-none"}
                        />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={t.rating}
                          onChange={(e) =>
                            updateSection3Dashboard(
                              t._id,
                              "rating",
                              e.target.value,
                            )
                          }
                          placeholder="Хэрэглэгч нэгжийн үнэлгээ (0-100)"
                          className={inputCls}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
          {/* Section IV: Хамрагдсан сургалт */}
          <section className={`rounded-xl border border-slate-700/60 bg-slate-800/30 p-4 ${hiddenSections.has("s4") ? "opacity-50" : ""}`}>
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => toggleSection("s4")}
            >
              <h3 className="text-sm font-semibold text-white">
                IV. Хамрагдсан сургалт
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleHideSection("s4");
                  }}
                  title={hiddenSections.has("s4") ? "Тайланд харуулах" : "Тайлангаас нуух"}
                  className={`transition ${hiddenSections.has("s4") ? "text-red-400 hover:text-red-300" : "text-slate-400 hover:text-slate-300"}`}
                >
                  {hiddenSections.has("s4") ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addSection4Training();
                  }}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
                >
                  <Plus className="h-3.5 w-3.5" /> Сургалт нэмэх
                </button>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${collapsedSections.has("s4") ? "-rotate-90" : ""}`}
                />
              </div>
            </div>
            <div
              className={`mt-3 ${collapsedSections.has("s4") ? "hidden" : ""}`}
            >
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
                        placeholder="Сургалтын нэр..."
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
                        placeholder="Зохион байгуулагч"
                        className={inputCls}
                      />
                      <div>
                        <label className={labelCls}>Сургалтын төрөл</label>
                        <select
                          value={t.type}
                          onChange={(e) =>
                            updateSection4Training(
                              t._id,
                              "type",
                              e.target.value,
                            )
                          }
                          className={selectCls}
                        >
                          <option value="">-- Сонгох --</option>
                          <option value="Гадаад">Гадаад</option>
                          <option value="Дотоод">Дотоод</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Огноо</label>
                        <input
                          type="date"
                          value={t.date}
                          onChange={(e) =>
                            updateSection4Training(
                              t._id,
                              "date",
                              e.target.value,
                            )
                          }
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Сургалтын хэлбэр</label>
                        <select
                          value={t.format}
                          onChange={(e) =>
                            updateSection4Training(
                              t._id,
                              "format",
                              e.target.value,
                            )
                          }
                          className={selectCls}
                        >
                          <option value="">-- Сонгох --</option>
                          <option value="Онлайн">Онлайн</option>
                          <option value="Танхим">Танхим</option>
                        </select>
                      </div>
                      <input
                        value={t.hours}
                        onChange={(e) =>
                          updateSection4Training(t._id, "hours", e.target.value)
                        }
                        placeholder="Цаг"
                        className={inputCls}
                      />
                      <div>
                        <label className={labelCls}>
                          Аудитын зорилгод нийцсэн эсэх
                        </label>
                        <select
                          value={t.meetsAuditGoal}
                          onChange={(e) =>
                            updateSection4Training(
                              t._id,
                              "meetsAuditGoal",
                              e.target.value,
                            )
                          }
                          className={selectCls}
                        >
                          <option value="">-- Сонгох --</option>
                          <option value="Нийцсэн">Нийцсэн</option>
                          <option value="Нийцээгүй">Нийцээгүй</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>
                          Мэдлэгээ хуваалцсан эсэх
                        </label>
                        <select
                          value={t.sharedKnowledge}
                          onChange={(e) =>
                            updateSection4Training(
                              t._id,
                              "sharedKnowledge",
                              e.target.value,
                            )
                          }
                          className={selectCls}
                        >
                          <option value="">-- Сонгох --</option>
                          <option value="Хуваалцсан">Хуваалцсан</option>
                          <option value="Хуваалцаагүй">Хуваалцаагүй</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <p className="text-xs font-medium text-slate-300 mb-1">
                  IV.1 Сургалтаас олж авсан мэдлэгээ ашиглаж буй байдал
                </p>
                <RichToolbar
                  value={section4KnowledgeText}
                  onChange={setSection4KnowledgeText}
                  rows={3}
                  placeholder="Сургалтаас авсан мэдлэгийг хэрхэн ашиглаж байгаа тухай..."
                  className={inputCls + " resize-y"}
                />
              </div>
            </div>
          </section>
          {/* Section V: Үүрэг даалгаварын биелэлт */}
          <section className={`rounded-xl border border-slate-700/60 bg-slate-800/30 p-4 ${hiddenSections.has("s5") ? "opacity-50" : ""}`}>
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => toggleSection("s5")}
            >
              <h3 className="text-sm font-semibold text-white">
                V. Үүрэг даалгаварын биелэлт
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleHideSection("s5");
                  }}
                  title={hiddenSections.has("s5") ? "Тайланд харуулах" : "Тайлангаас нуух"}
                  className={`transition ${hiddenSections.has("s5") ? "text-red-400 hover:text-red-300" : "text-slate-400 hover:text-slate-300"}`}
                >
                  {hiddenSections.has("s5") ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addSection5Task();
                  }}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
                >
                  <Plus className="h-3.5 w-3.5" /> Ажил нэмэх
                </button>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${collapsedSections.has("s5") ? "-rotate-90" : ""}`}
                />
              </div>
            </div>
            <div
              className={`space-y-2 mt-3 ${collapsedSections.has("s5") ? "hidden" : ""}`}
            >
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
                      placeholder="Ажлын төрөл..."
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
                    <RichToolbar
                      value={t.completedWork}
                      onChange={(v) =>
                        updateSection5Task(t._id, "completedWork", v)
                      }
                      placeholder="Хийгдсэн ажил..."
                      rows={2}
                      className={inputCls + " resize-none"}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
          {/* Section VI: Хамт олны ажил */}
          <section className={`rounded-xl border border-slate-700/60 bg-slate-800/30 p-4 ${hiddenSections.has("s6") ? "opacity-50" : ""}`}>
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => toggleSection("s6")}
            >
              <h3 className="text-sm font-semibold text-white">
                VI. Хамт олны ажил
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleHideSection("s6");
                  }}
                  title={hiddenSections.has("s6") ? "Тайланд харуулах" : "Тайлангаас нуух"}
                  className={`transition ${hiddenSections.has("s6") ? "text-red-400 hover:text-red-300" : "text-slate-400 hover:text-slate-300"}`}
                >
                  {hiddenSections.has("s6") ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addSection6Activity();
                  }}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
                >
                  <Plus className="h-3.5 w-3.5" /> Ажил нэмэх
                </button>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${collapsedSections.has("s6") ? "-rotate-90" : ""}`}
                />
              </div>
            </div>
            <div
              className={`space-y-2 mt-3 ${collapsedSections.has("s6") ? "hidden" : ""}`}
            >
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
                      placeholder="Хамт олны ажил..."
                      className={inputCls + " flex-1"}
                    />
                    <button
                      onClick={() => removeSection6Activity(t._id)}
                      className="text-red-400/70 hover:text-red-400 transition shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="space-y-1.5 pl-6">
                    <input
                      type="date"
                      value={t.date}
                      onChange={(e) =>
                        updateSection6Activity(t._id, "date", e.target.value)
                      }
                      className={inputCls}
                    />
                    <textarea
                      rows={2}
                      value={t.initiative}
                      onChange={(e) =>
                        updateSection6Activity(
                          t._id,
                          "initiative",
                          e.target.value,
                        )
                      }
                      placeholder="Санаачилга"
                      className={inputCls + " resize-none"}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
          {/* Section VII: Шинэ санал санаачилга */}
          <section className={`rounded-xl border border-slate-700/60 bg-slate-800/30 p-4 ${hiddenSections.has("s7") ? "opacity-50" : ""}`}>
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => toggleSection("s7")}
            >
              <h3 className="text-sm font-semibold text-white">
                VII. Шинэ санал санаачилга
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleHideSection("s7");
                  }}
                  title={hiddenSections.has("s7") ? "Тайланд харуулах" : "Тайлангаас нуух"}
                  className={`transition ${hiddenSections.has("s7") ? "text-red-400 hover:text-red-300" : "text-slate-400 hover:text-slate-300"}`}
                >
                  {hiddenSections.has("s7") ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${collapsedSections.has("s7") ? "-rotate-90" : ""}`}
                />
              </div>
            </div>
            <div
              className={`mt-3 ${collapsedSections.has("s7") ? "hidden" : ""}`}
            >
              <RichToolbar
                value={section7Text}
                onChange={setSection7Text}
                rows={4}
                placeholder="Шинэ санал санаачилга, дэвшүүлсэн санааг бичнэ үү..."
                className={inputCls + " resize-y"}
              />
            </div>
          </section>{" "}
          {/* Dynamic sections */}
          <section className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4">
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => toggleSection("sdyn")}
            >
              <h3 className="text-sm font-semibold text-white">
                Нэмэлт хэсгүүд (VIII, IX, …)
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addSection();
                  }}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
                >
                  <Plus className="h-3.5 w-3.5" /> Нэмэлт хэсэг нэмэх
                </button>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${collapsedSections.has("sdyn") ? "-rotate-90" : ""}`}
                />
              </div>
            </div>
            <div
              className={`space-y-3 mt-3 ${collapsedSections.has("sdyn") ? "hidden" : ""}`}
            >
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
                      placeholder="Хэсгийн гарчиг..."
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
                    placeholder="Хэсгийн агуулга..."
                    className={inputCls + " resize-y"}
                  />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* --- RIGHT: Live Word Preview --- */}
      <div className="flex flex-col flex-1 bg-slate-600 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-500/50 text-xs font-medium text-slate-300 flex items-center gap-2 flex-shrink-0 bg-slate-700/50">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Realtime preview — Word баримт
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <WordPreview
            userName={mounted ? cyrillicName.trim() : ""}
            userPosition={user?.position}
            userDepartment={user?.department}
            year={year}
            quarter={quarter}
            plannedTasks={plannedTasks}
            section2Tasks={section2Tasks}
            section3AutoTasks={section3AutoTasks}
            section3Dashboards={section3Dashboards}
            section1Dashboards={section1Dashboards}
            dynamicSections={dynamicSections}
            section4Trainings={section4Trainings}
            section4KnowledgeText={section4KnowledgeText}
            section5Tasks={section5Tasks}
            section6Activities={section6Activities}
            section7Text={section7Text}
            images={images}
            hiddenSections={hiddenSections}
          />
        </div>
      </div>
    </div>
  );
}
