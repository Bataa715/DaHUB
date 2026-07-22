"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  tailanApi,
  tailanTemplateApi,
  getApiErrorMessage,
  type TailanTemplate,
  type TailanReportPayload,
} from "@/lib/api";
import {
  uid,
  getCurrentYear,
  getCurrentQuarter,
} from "../_components/tailan.types";
import type { DynSection, TailanImage } from "../_components/tailan.types";

export interface GenericRow {
  _id: string;
  order: number;
  [key: string]: unknown;
}

/** Default row shape per section type — used when a section has no data yet. */
function defaultRow(): GenericRow {
  return { _id: uid(), order: 1 };
}

// ─── Generic, template-driven report editor state ──────────────────────────
// Replaces the old fully-hardcoded useTailanReport() — section content is now
// a free-form map keyed by the active TailanTemplate's section keys, so the
// same hook works for any admin-defined section layout.
export function useTailanGenericReport(
  userName?: string,
  userDepartmentId?: string,
) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [year, setYear] = useState(getCurrentYear);
  const [quarter, setQuarter] = useState(getCurrentQuarter);

  const [template, setTemplate] = useState<TailanTemplate | null>(null);
  const [templateLoading, setTemplateLoading] = useState(true);

  // key -> string (richtext) | GenericRow[] (taskList/table)
  const [sectionsData, setSectionsData] = useState<Record<string, unknown>>({});
  const [dynamicSections, setDynamicSections] = useState<DynSection[]>([]);
  const [hiddenSections, setHiddenSections] = useState<Set<string>>(new Set());
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(),
  );

  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [cyrillicName, setCyrillicName] = useState("");

  const [images, setImages] = useState<TailanImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const imgFileRef = useRef<HTMLInputElement>(null);

  // ── Load active template ──────────────────────────────────────────────────
  useEffect(() => {
    setTemplateLoading(true);
    tailanTemplateApi
      .getActive(userDepartmentId, "employee")
      .then((tpl) => {
        setTemplate(tpl);
        // Seed empty rows so the editor always has at least one input row.
        setSectionsData((prev) => {
          const next = { ...prev };
          for (const sec of tpl.sections) {
            if (next[sec.key] !== undefined) continue;
            if (sec.type === "richtext") next[sec.key] = "";
            else next[sec.key] = [defaultRow()];
          }
          return next;
        });
        setHiddenSections((prev) => {
          const n = new Set(prev);
          tpl.sections.forEach((s) => {
            if (s.defaultHidden) n.add(s.key);
          });
          return n;
        });
      })
      .catch(() => {
        console.warn("[useTailanGenericReport] Template load failed");
      })
      .finally(() => setTemplateLoading(false));
  }, [userDepartmentId]);

  // ── Load report draft ─────────────────────────────────────────────────────
  useEffect(() => {
    tailanApi
      .getMyReport(year, quarter)
      .then((r) => {
        if (!r) return;
        const data = r.sectionsData ?? {};
        const withIds: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(data)) {
          if (Array.isArray(val)) {
            withIds[key] = val.length
              ? val.map((row: any, i: number) => ({
                  _id: uid(),
                  order: row.order ?? i + 1,
                  ...row,
                }))
              : [defaultRow()];
          } else {
            withIds[key] = val;
          }
        }
        setSectionsData((prev) => ({ ...prev, ...withIds }));
        setDynamicSections(
          (r.dynamicSections ?? []).map((s: DynSection) => ({
            ...s,
            _id: uid(),
          })),
        );
        if (r.hiddenSections?.length)
          setHiddenSections(new Set(r.hiddenSections));
      })
      .catch(() => {
        console.warn("[useTailanGenericReport] Draft load failed");
      })
      .finally(() => setLoaded(true));
    loadImages();
  }, [year, quarter]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Section visibility ────────────────────────────────────────────────────
  const toggleSection = (key: string) =>
    setCollapsedSections((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  const toggleHideSection = (key: string) =>
    setHiddenSections((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

  // ── Generic row/value CRUD ────────────────────────────────────────────────
  const getRows = useCallback(
    (key: string): GenericRow[] => (sectionsData[key] as GenericRow[]) ?? [],
    [sectionsData],
  );
  const getText = useCallback(
    (key: string): string => (sectionsData[key] as string) ?? "",
    [sectionsData],
  );
  const setText = (key: string, value: string) =>
    setSectionsData((prev) => ({ ...prev, [key]: value }));

  const addRow = (key: string) =>
    setSectionsData((prev) => {
      const rows = (prev[key] as GenericRow[]) ?? [];
      return {
        ...prev,
        [key]: [...rows, { _id: uid(), order: rows.length + 1 }],
      };
    });
  const removeRow = (key: string, id: string) =>
    setSectionsData((prev) => {
      const rows = ((prev[key] as GenericRow[]) ?? []).filter(
        (r) => r._id !== id,
      );
      return {
        ...prev,
        [key]: rows.map((r, i) => ({ ...r, order: i + 1 })),
      };
    });
  const updateRow = (key: string, id: string, field: string, value: unknown) =>
    setSectionsData((prev) => {
      const rows = (prev[key] as GenericRow[]) ?? [];
      return {
        ...prev,
        [key]: rows.map((r) => (r._id === id ? { ...r, [field]: value } : r)),
      };
    });

  // ── Dynamic (ad-hoc) sections ──────────────────────────────────────────────
  const addDynSection = () =>
    setDynamicSections((prev) => [
      ...prev,
      { _id: uid(), order: prev.length + 1, title: "Шинэ хэсэг", content: "" },
    ]);
  const removeDynSection = (id: string) =>
    setDynamicSections((prev) => prev.filter((s) => s._id !== id));
  const updateDynSection = (id: string, field: keyof DynSection, value: any) =>
    setDynamicSections((prev) =>
      prev.map((s) => (s._id === id ? { ...s, [field]: value } : s)),
    );

  // ── Images ────────────────────────────────────────────────────────────────
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

  // ── Persistence ────────────────────────────────────────────────────────────
  const buildPayload = useCallback(
    (status?: "draft" | "submitted"): TailanReportPayload => {
      const sections: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(sectionsData)) {
        sections[key] = Array.isArray(val)
          ? val.map(({ _id, ...rest }: GenericRow) => rest)
          : val;
      }
      return {
        year,
        quarter,
        sections,
        dynamicSections: dynamicSections.map(({ _id, ...s }) => s),
        hiddenSections: Array.from(hiddenSections),
        status,
      };
    },
    [sectionsData, dynamicSections, hiddenSections, year, quarter],
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await tailanApi.saveDraft(buildPayload("draft"));
      setSavedMsg("Хадгалагдлаа");
      setTimeout(() => setSavedMsg(""), 2500);
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err) || "Хадгалахад алдаа гарлаа";
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
      await tailanApi.saveDraft(buildPayload("submitted"));
      await tailanApi.submitReport(year, quarter);
      setSavedMsg("Илгээгдлээ");
      setTimeout(() => setSavedMsg(""), 3000);
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err) || "Илгээхэд алдаа гарлаа";
      setSavedMsg(`❌ ${msg}`);
      setTimeout(() => setSavedMsg(""), 5000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await handleSave();
      const blob = await tailanApi.downloadMyWord(
        year,
        quarter,
        cyrillicName.trim() || userName,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `тайлан-${cyrillicName.trim() || userName || "mine"}-${year}-Q${quarter}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  return {
    mounted,
    year,
    setYear,
    quarter,
    setQuarter,
    loaded,
    cyrillicName,
    setCyrillicName,

    template,
    templateLoading,

    collapsedSections,
    toggleSection,
    hiddenSections,
    toggleHideSection,

    sectionsData,
    getRows,
    getText,
    setText,
    addRow,
    removeRow,
    updateRow,

    dynamicSections,
    addDynSection,
    removeDynSection,
    updateDynSection,

    saving,
    submitting,
    downloading,
    savedMsg,
    handleSave,
    handleSubmit,
    handleDownload,
    buildPayload,

    images,
    uploading,
    imgFileRef,
    handleImageUpload,
    handleDeleteImage,
  };
}
