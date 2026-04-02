"use client";

import { useState, useEffect, useRef } from "react";
import { tailanApi } from "@/lib/api";
import {
  uid,
  getCurrentYear,
  getCurrentQuarter,
} from "../_components/tailan.types";
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
} from "../_components/tailan.types";

export function useTailanReport(userName?: string) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [year, setYear] = useState(getCurrentYear);
  const [quarter, setQuarter] = useState(getCurrentQuarter);

  // ── Section data ──────────────────────────────────────────────────────
  const [plannedTasks, setPlannedTasks] = useState<PlannedTask[]>([
    { _id: uid(), order: 1, title: "", completion: 100, startDate: "", endDate: "", description: "", images: [] },
  ]);
  const [section1Dashboards, setSection1Dashboards] = useState<Section1Dashboard[]>([
    { _id: uid(), order: 1, title: "", completion: "", period: "", summary: "", images: [] },
  ]);
  const [section2Tasks, setSection2Tasks] = useState<Section2Task[]>([
    { _id: uid(), order: 1, title: "", result: "", period: "", completion: "", images: [] },
  ]);
  const [section3AutoTasks, setSection3AutoTasks] = useState<Section3AutoTask[]>([
    { _id: uid(), order: 1, title: "", value: "", rating: "" },
  ]);
  const [section3Dashboards, setSection3Dashboards] = useState<Section3Dashboard[]>([
    { _id: uid(), order: 1, dashboard: "", value: "", rating: "" },
  ]);
  const [section4Trainings, setSection4Trainings] = useState<Section4Training[]>([
    { _id: uid(), order: 1, training: "", organizer: "", type: "", date: "", format: "", hours: "", meetsAuditGoal: "", sharedKnowledge: "" },
  ]);
  const [section4KnowledgeText, setSection4KnowledgeText] = useState("");
  const [section5Tasks, setSection5Tasks] = useState<Section5Task[]>([
    { _id: uid(), order: 1, taskType: "", completedWork: "" },
  ]);
  const [section6Activities, setSection6Activities] = useState<Section6Activity[]>([
    { _id: uid(), order: 1, date: "", activity: "", initiative: "" },
  ]);
  const [section7Text, setSection7Text] = useState("");
  const [dynamicSections, setDynamicSections] = useState<DynSection[]>([]);

  // ── UI state ──────────────────────────────────────────────────────────
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [hiddenSections, setHiddenSections] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [cyrillicName, setCyrillicName] = useState("");

  // ── Images ────────────────────────────────────────────────────────────
  const [images, setImages] = useState<TailanImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const imgFileRef = useRef<HTMLInputElement>(null);

  // ── Toggle helpers ────────────────────────────────────────────────────
  const toggleTaskExpand = (id: string) =>
    setExpandedTaskIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSection = (key: string) =>
    setCollapsedSections((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const toggleHideSection = (key: string) =>
    setHiddenSections((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  // ── Load report ───────────────────────────────────────────────────────
  useEffect(() => {
    tailanApi.getMyReport(year, quarter).then((r) => {
      if (!r) return;
      if (r.plannedTasks?.length) setPlannedTasks(r.plannedTasks.map((t: any) => ({ ...t, _id: uid() })));
      setDynamicSections((r.dynamicSections ?? []).map((s: any) => ({ ...s, _id: uid() })));
      if (r.section2Tasks?.length) setSection2Tasks(r.section2Tasks.map((t: any) => ({ ...t, _id: uid() })));
      if (r.section3AutoTasks?.length) setSection3AutoTasks(r.section3AutoTasks.map((t: any) => ({ ...t, _id: uid() })));
      if (r.section3Dashboards?.length) setSection3Dashboards(r.section3Dashboards.map((t: any) => ({ ...t, _id: uid() })));
      if (r.section1Dashboards?.length) setSection1Dashboards(r.section1Dashboards.map((t: any) => ({ ...t, _id: uid() })));
      if (r.section4Trainings?.length) setSection4Trainings(r.section4Trainings.map((t: any) => ({ ...t, _id: uid() })));
      if (r.section4KnowledgeText) setSection4KnowledgeText(r.section4KnowledgeText);
      if (r.section5Tasks?.length) setSection5Tasks(r.section5Tasks.map((t: any) => ({ ...t, _id: uid() })));
      if (r.section6Activities?.length) setSection6Activities(r.section6Activities.map((t: any) => ({ ...t, _id: uid() })));
      if (r.section7Text) setSection7Text(r.section7Text);
      if (r.hiddenSections?.length) setHiddenSections(new Set(r.hiddenSections));
    }).catch(() => {}).finally(() => setLoaded(true));
    loadImages();
  }, [year, quarter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Revoke blob URLs on unmount
  useEffect(() => {
    return () => {
      setImages((prev) => { prev.forEach((img) => { if (img.blobUrl) URL.revokeObjectURL(img.blobUrl); }); return prev; });
    };
  }, []);

  // ── Image management ──────────────────────────────────────────────────
  const loadImages = async () => {
    try {
      const list = await tailanApi.getImages(year, quarter);
      const withUrls: TailanImage[] = await Promise.all(
        list.map(async (img) => {
          try { const blobUrl = await tailanApi.fetchImageDataUrl(img.id); return { ...img, blobUrl }; }
          catch { return img; }
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
      setImages((prev) => [...prev, { id: saved.id, filename: file.name, mimeType: file.type, uploadedAt: new Date().toISOString(), blobUrl }]);
    } catch {} finally {
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

  // ── Persistence ───────────────────────────────────────────────────────
  const toDto = () => ({
    year, quarter,
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
    hiddenSections: Array.from(hiddenSections),
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
      const msg = err?.response?.data?.message || err?.message || "Хадгалахад алдаа гарлаа";
      setSavedMsg(`❌ ${msg}`);
      setTimeout(() => setSavedMsg(""), 5000);
    } finally { setSaving(false); }
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
      const msg = err?.response?.data?.message || err?.message || "Илгээхэд алдаа гарлаа";
      setSavedMsg(`❌ ${msg}`);
      setTimeout(() => setSavedMsg(""), 5000);
    } finally { setSubmitting(false); }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await handleSave();
      const blob = await tailanApi.downloadMyWord(year, quarter, cyrillicName.trim() || userName);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `тайлан-${cyrillicName.trim() || userName || "mine"}-${year}-Q${quarter}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally { setDownloading(false); }
  };

  // ── CRUD: Planned tasks (Section I) ───────────────────────────────────
  const addTask = () => {
    const newId = uid();
    setPlannedTasks((prev) => [...prev, { _id: newId, order: prev.length + 1, title: "", completion: 100, startDate: "", endDate: "", description: "", images: [] }]);
    setExpandedTaskIds((prev) => { const n = new Set(prev); n.add(newId); return n; });
  };
  const removeTask = (id: string) => {
    setPlannedTasks((prev) => prev.filter((t) => t._id !== id).map((t, i) => ({ ...t, order: i + 1 })));
    setExpandedTaskIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
  };
  const updateTask = (id: string, field: keyof PlannedTask, value: any) =>
    setPlannedTasks((prev) => prev.map((t) => (t._id === id ? { ...t, [field]: value } : t)));

  // ── CRUD: Section I.2 dashboards ──────────────────────────────────────
  const addSection1Dashboard = () =>
    setSection1Dashboards((prev) => [...prev, { _id: uid(), order: prev.length + 1, title: "", completion: "", period: "", summary: "", images: [] }]);
  const removeSection1Dashboard = (id: string) =>
    setSection1Dashboards((prev) => prev.filter((t) => t._id !== id).map((t, i) => ({ ...t, order: i + 1 })));
  const updateSection1Dashboard = (id: string, field: keyof Section1Dashboard, value: any) =>
    setSection1Dashboards((prev) => prev.map((t) => (t._id === id ? { ...t, [field]: value } : t)));

  // ── CRUD: Section II tasks ────────────────────────────────────────────
  const addSection2Task = () =>
    setSection2Tasks((prev) => [...prev, { _id: uid(), order: prev.length + 1, title: "", result: "", period: "", completion: "", images: [] }]);
  const removeSection2Task = (id: string) =>
    setSection2Tasks((prev) => prev.filter((t) => t._id !== id).map((t, i) => ({ ...t, order: i + 1 })));
  const updateSection2Task = (id: string, field: keyof Section2Task, value: any) =>
    setSection2Tasks((prev) => prev.map((t) => (t._id === id ? { ...t, [field]: value } : t)));

  // ── CRUD: Section III auto tasks ──────────────────────────────────────
  const addSection3AutoTask = () =>
    setSection3AutoTasks((prev) => [...prev, { _id: uid(), order: prev.length + 1, title: "", value: "", rating: "" }]);
  const removeSection3AutoTask = (id: string) =>
    setSection3AutoTasks((prev) => prev.filter((t) => t._id !== id).map((t, i) => ({ ...t, order: i + 1 })));
  const updateSection3AutoTask = (id: string, field: keyof Section3AutoTask, value: any) =>
    setSection3AutoTasks((prev) => prev.map((t) => (t._id === id ? { ...t, [field]: value } : t)));

  // ── CRUD: Section III dashboards ──────────────────────────────────────
  const addSection3Dashboard = () =>
    setSection3Dashboards((prev) => [...prev, { _id: uid(), order: prev.length + 1, dashboard: "", value: "", rating: "" }]);
  const removeSection3Dashboard = (id: string) =>
    setSection3Dashboards((prev) => prev.filter((t) => t._id !== id).map((t, i) => ({ ...t, order: i + 1 })));
  const updateSection3Dashboard = (id: string, field: keyof Section3Dashboard, value: any) =>
    setSection3Dashboards((prev) => prev.map((t) => (t._id === id ? { ...t, [field]: value } : t)));

  // ── CRUD: Section IV trainings ────────────────────────────────────────
  const addSection4Training = () =>
    setSection4Trainings((prev) => [...prev, { _id: uid(), order: prev.length + 1, training: "", organizer: "", type: "", date: "", format: "", hours: "", meetsAuditGoal: "", sharedKnowledge: "" }]);
  const removeSection4Training = (id: string) =>
    setSection4Trainings((prev) => prev.filter((t) => t._id !== id).map((t, i) => ({ ...t, order: i + 1 })));
  const updateSection4Training = (id: string, field: keyof Section4Training, value: any) =>
    setSection4Trainings((prev) => prev.map((t) => (t._id === id ? { ...t, [field]: value } : t)));

  // ── CRUD: Section V tasks ─────────────────────────────────────────────
  const addSection5Task = () =>
    setSection5Tasks((prev) => [...prev, { _id: uid(), order: prev.length + 1, taskType: "", completedWork: "" }]);
  const removeSection5Task = (id: string) =>
    setSection5Tasks((prev) => prev.filter((t) => t._id !== id).map((t, i) => ({ ...t, order: i + 1 })));
  const updateSection5Task = (id: string, field: keyof Section5Task, value: any) =>
    setSection5Tasks((prev) => prev.map((t) => (t._id === id ? { ...t, [field]: value } : t)));

  // ── CRUD: Section VI activities ───────────────────────────────────────
  const addSection6Activity = () =>
    setSection6Activities((prev) => [...prev, { _id: uid(), order: prev.length + 1, date: "", activity: "", initiative: "" }]);
  const removeSection6Activity = (id: string) =>
    setSection6Activities((prev) => prev.filter((t) => t._id !== id).map((t, i) => ({ ...t, order: i + 1 })));
  const updateSection6Activity = (id: string, field: keyof Section6Activity, value: any) =>
    setSection6Activities((prev) => prev.map((t) => (t._id === id ? { ...t, [field]: value } : t)));

  // ── CRUD: Dynamic sections ────────────────────────────────────────────
  const addDynSection = () =>
    setDynamicSections((prev) => [...prev, { _id: uid(), order: prev.length + 2, title: "Шинэ хэсэг", content: "" }]);
  const removeDynSection = (id: string) =>
    setDynamicSections((prev) => prev.filter((s) => s._id !== id).map((s, i) => ({ ...s, order: i + 2 })));
  const updateDynSection = (id: string, field: keyof DynSection, value: any) =>
    setDynamicSections((prev) => prev.map((s) => (s._id === id ? { ...s, [field]: value } : s)));

  return {
    // Meta
    mounted, year, setYear, quarter, setQuarter, loaded,
    cyrillicName, setCyrillicName,

    // UI toggles
    expandedTaskIds, toggleTaskExpand,
    collapsedSections, toggleSection,
    hiddenSections, toggleHideSection,

    // Section data
    plannedTasks, section1Dashboards, section2Tasks,
    section3AutoTasks, section3Dashboards,
    section4Trainings, section4KnowledgeText, setSection4KnowledgeText,
    section5Tasks, section6Activities,
    section7Text, setSection7Text,
    dynamicSections,

    // CRUD handlers
    addTask, removeTask, updateTask,
    addSection1Dashboard, removeSection1Dashboard, updateSection1Dashboard,
    addSection2Task, removeSection2Task, updateSection2Task,
    addSection3AutoTask, removeSection3AutoTask, updateSection3AutoTask,
    addSection3Dashboard, removeSection3Dashboard, updateSection3Dashboard,
    addSection4Training, removeSection4Training, updateSection4Training,
    addSection5Task, removeSection5Task, updateSection5Task,
    addSection6Activity, removeSection6Activity, updateSection6Activity,
    addDynSection, removeDynSection, updateDynSection,

    // Persistence
    saving, submitting, downloading, savedMsg,
    handleSave, handleSubmit, handleDownload,

    // Images
    images, uploading, imgFileRef,
    handleImageUpload, handleDeleteImage,
  };
}
