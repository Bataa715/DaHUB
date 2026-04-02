"use client";

import { useState, useEffect } from "react";
import { tailanApi } from "@/lib/api";
import {
  SECTION_DEFS,
  Q_NAMES,
  SectionReport,
  getCurrentYear,
  getCurrentQuarter,
  DEFAULT_S1_KPI,
  DEFAULT_S2_KPI,
  DEFAULT_S3_KPI,
  DEFAULT_S4_KPI,
  DEFAULT_NEGTGEL_KPI,
  emptySection,
  mergeKpi,
  mergeKpiWithRows,
  DashboardRow,
  Section2TaskRow,
  Section14Row,
  Section23Row,
  Section43Row,
  RichTextItem,
  KpiSubSection,
  KpiRow,
} from "../_types";

export function useDepartmentReport() {
  const [year, setYear] = useState(getCurrentYear);
  const [quarter, setQuarter] = useState(getCurrentQuarter);
  const [activeTab, setActiveTab] = useState<string>("s1");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sections, setSections] = useState<Record<string, SectionReport>>({});
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const updateSection = (id: string, updated: SectionReport) =>
    setSections((p) => ({ ...p, [id]: updated }));

  const negtgelKpi: KpiSubSection[] = mergeKpiWithRows(
    sections["negtgel"]?.kpiTable,
    DEFAULT_NEGTGEL_KPI,
  );

  const updateNegtgelRow = (
    gi: number,
    ri: number,
    field: keyof KpiRow,
    value: string,
  ) => {
    const updated = negtgelKpi.map((group, g) =>
      g !== gi
        ? group
        : {
            ...group,
            rows: group.rows.map((row, r) =>
              r !== ri ? row : { ...row, [field]: value },
            ),
          },
    );
    updateSection("negtgel", {
      ...(sections["negtgel"] ?? emptySection()),
      kpiTable: updated,
    });
  };

  const updateNegtgelGroupLabel = (gi: number, value: string) => {
    const updated = negtgelKpi.map((group, g) =>
      g !== gi ? group : { ...group, groupLabel: value },
    );
    updateSection("negtgel", {
      ...(sections["negtgel"] ?? emptySection()),
      kpiTable: updated,
    });
  };

  const handleS1ApiLoad = async (_si: number): Promise<DashboardRow[]> => {
    try {
      const reports = await tailanApi.getDeptReports(year, quarter);
      return (reports as any[]).flatMap((r: any) =>
        (r.plannedTasks ?? []).map((t: any) => ({
          title: t.title ?? "",
          description: t.description ?? "",
          images: (t.images ?? []).map((img: any) => ({
            id: img.id ?? "",
            dataUrl: img.dataUrl ?? "",
            width: img.width ?? 80,
            height: img.height ?? 0,
          })),
        })),
      );
    } catch {
      alert("API-аас татахад алдаа гарлаа.");
      return [];
    }
  };

  const handleS1_13ApiLoad = async (
    _si: number,
  ): Promise<Section2TaskRow[]> => {
    try {
      const reports = await tailanApi.getDeptReports(year, quarter);
      return (reports as any[]).flatMap((r: any) =>
        (r.section2Tasks ?? []).map((t: any, idx: number) => ({
          order: t.order ?? idx + 1,
          title: t.title ?? "",
          result: t.result ?? "",
          period: t.period ?? "",
          completion: t.completion ?? "",
          employeeName: r.userName ?? "",
          images: (t.images ?? []).map((img: any) => ({
            id: img.id ?? "",
            dataUrl: img.dataUrl ?? "",
            width: img.width ?? 80,
            height: img.height ?? 0,
          })),
        })),
      );
    } catch {
      alert("API-аас татахад алдаа гарлаа.");
      return [];
    }
  };

  const handleS1_14ApiLoad = async (_si: number): Promise<Section14Row[]> => {
    try {
      // 1) Хувийн тайлангийн section2Tasks-аас (хуучин section 1.3-тэй дүйцэх өгөгдөл)
      const reports = await tailanApi.getDeptReports(year, quarter);
      const newRowsFromTasks: Section14Row[] = (reports as any[]).flatMap(
        (r: any) =>
          (r.section2Tasks ?? []).map((t: any) => ({
            title: t.title ?? "",
            productType: "Өгөгдөл боловсруулалт",
            savedDays: "",
            group: "new" as const,
            employeeName: r.userName ?? "",
          })),
      );

      // 2) Дашбоард → хувийн тайлангийн section1Dashboards-аас
      const dashRows: Section14Row[] = (reports as any[]).flatMap((r: any) =>
        (r.section1Dashboards ?? []).map((t: any) => ({
          title: t.title ?? "",
          productType: "Дашбоард",
          savedDays: "",
          group: "new" as const,
          employeeName: r.userName ?? "",
        })),
      );

      // Тайлант хугацаанд аудитын үйл ажиллагаанд ашигласан дата бүтээгдэхүүн → section3AutoTasks
      const usedRows: Section14Row[] = (reports as any[]).flatMap((r: any) =>
        (r.section3AutoTasks ?? []).map((t: any) => ({
          title: t.title ?? "",
          productType: "Өгөгдөл боловсруулалт",
          savedDays: "",
          group: "used" as const,
          employeeName: r.userName ?? "",
        })),
      );

      return [...newRowsFromTasks, ...dashRows, ...usedRows];
    } catch {
      alert("API-аас татахад алдаа гарлаа.");
      return [];
    }
  };

  const handleS2_23ApiLoad = async (_si: number): Promise<Section23Row[]> => {
    try {
      // Хувийн тайлангийн section2Tasks-аас шууд татна (local state-с хараат бус)
      const reports = await tailanApi.getDeptReports(year, quarter);
      return (reports as any[]).flatMap((r: any) =>
        (r.section2Tasks ?? []).map((t: any) => ({
          title: t.title ?? "",
          usage: t.completion ?? "",
          clientScore: "",
          employeeName: r.userName ?? "",
        })),
      );
    } catch {
      alert("API-аас татахад алдаа гарлаа.");
      return [];
    }
  };

  const handleS2_24ApiLoad = async (
    _si: number,
  ): Promise<Section2TaskRow[]> => {
    try {
      // Хувийн тайлангийн section1Dashboards-аас татна
      // (I хэсэг, 2-р дэд хэсэг — Шинээр хөгжүүлсэн Дашбоард хөгжүүлэлтийн чанар, үр дүн)
      const reports = await tailanApi.getDeptReports(year, quarter);
      let order = 0;
      return (reports as any[]).flatMap((r: any) =>
        (r.section1Dashboards ?? []).map((t: any) => ({
          order: ++order,
          title: t.title ?? "",
          result: t.completion ?? "", // гүйцэтгэл %
          completion: t.summary ?? "", // гүйцэтгэл /товч/
          period: t.period ?? "",
          employeeName: r.userName ?? "",
          images: (t.images ?? []).map((img: any) => ({
            id: img.id ?? "",
            dataUrl: img.dataUrl ?? "",
            width: img.width ?? 80,
            height: img.height ?? 0,
          })),
        })),
      );
    } catch {
      alert("API-аас татахад алдаа гарлаа.");
      return [];
    }
  };

  const handleS3_33ApiLoad = async (_si: number): Promise<Section23Row[]> => {
    try {
      // Хувийн тайлангийн III. Тогтмол хийгддэг ажлууд → section3AutoTasks
      const reports = await tailanApi.getDeptReports(year, quarter);
      return (reports as any[]).flatMap((r: any) =>
        (r.section3AutoTasks ?? []).map((t: any) => ({
          title: t.title ?? "",
          usage: t.value ?? "",
          clientScore: t.rating ?? "",
          employeeName: r.userName ?? "",
        })),
      );
    } catch {
      alert("АПИ-аас татахад алдаа гарлаа.");
      return [];
    }
  };

  const handleS3_34ApiLoad = async (_si: number): Promise<Section23Row[]> => {
    try {
      // Хувийн тайлангийн III. Тогтмол хийгддэг ажлууд → section3Dashboards
      const reports = await tailanApi.getDeptReports(year, quarter);
      return (reports as any[]).flatMap((r: any) =>
        (r.section3Dashboards ?? []).map((t: any) => ({
          title: t.dashboard ?? "",
          usage: t.value ?? "",
          clientScore: t.rating ?? "",
          employeeName: r.userName ?? "",
        })),
      );
    } catch {
      alert("АПИ-аас татахад алдаа гарлаа.");
      return [];
    }
  };

  const handleS4_42ApiLoad = async (_si: number): Promise<RichTextItem[]> => {
    try {
      const reports = await tailanApi.getDeptReports(year, quarter);
      return (reports as any[])
        .filter((r: any) => (r.section4KnowledgeText ?? "").trim())
        .map((r: any) => ({
          id: r.userId ?? r.id ?? String(Math.random()),
          title: r.userName ?? "",
          bullets: (r.section4KnowledgeText ?? "")
            .split("\n")
            .map((l: string) => l.trim())
            .filter((l: string) => l.length > 0),
          images: [],
          contents: [],
        }));
    } catch {
      alert("АПИ-аас татахад алдаа гарлаа.");
      return [];
    }
  };

  const handleS4_43ApiLoad = async (_si: number): Promise<Section43Row[]> => {
    try {
      const reports = await tailanApi.getDeptReports(year, quarter);
      return (reports as any[]).flatMap((r: any) =>
        (r.section4Trainings ?? []).map((t: any) => ({
          employeeName: r.userName ?? "",
          training: t.training ?? "",
          organizer: t.organizer ?? "",
          type: t.type ?? "",
          date: t.date ?? "",
          format: t.format ?? "",
          hours: t.hours ?? "",
          meetsAuditGoal: t.meetsAuditGoal ?? "",
          sharedKnowledge: t.sharedKnowledge ?? "",
        })),
      );
    } catch {
      alert("АПИ-аас татахад алдаа гарлаа.");
      return [];
    }
  };

  useEffect(() => {
    tailanApi
      .getDeptBsc(year, quarter)
      .then((data) => {
        if (data?.sections) {
          setSections(data.sections as Record<string, SectionReport>);
          setLastSaved(
            data.updatedAt
              ? new Date(
                  data.updatedAt.replace(" ", "T") + "Z",
                ).toLocaleTimeString("mn-MN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : null,
          );
        } else {
          setSections({});
          setLastSaved(null);
        }
      })
      .catch(() => {});
  }, [year, quarter]);

  const handleDbSave = async () => {
    setSaving(true);
    try {
      // Нормализаци: хадгалахаас өмнө бүх KPI хүснэгтийг default-тай merge хийнэ.
      // Ингэснээр хэрэглэгч тухайн секцийг нь нээгээгүй байсан ч (3.2 гэх мэт)
      // шинээр нэмсэн subsection-үүд хадгалагдана.
      const norm = { ...sections };
      const get = (id: string) => norm[id] ?? emptySection();
      norm.s1 = {
        ...get("s1"),
        kpiTable: mergeKpi(get("s1").kpiTable, DEFAULT_S1_KPI),
      };
      norm.s2 = {
        ...get("s2"),
        s2kpiTable: mergeKpi(get("s2").s2kpiTable, DEFAULT_S2_KPI),
      };
      norm.s3 = {
        ...get("s3"),
        s3kpiTable: mergeKpi(get("s3").s3kpiTable, DEFAULT_S3_KPI),
      };
      norm.s4 = {
        ...get("s4"),
        s4kpiTable: mergeKpi(get("s4").s4kpiTable, DEFAULT_S4_KPI),
      };
      norm.negtgel = {
        ...get("negtgel"),
        kpiTable: mergeKpiWithRows(
          get("negtgel").kpiTable,
          DEFAULT_NEGTGEL_KPI,
        ),
      };
      await tailanApi.saveDeptBsc(
        year,
        quarter,
        norm as Record<string, unknown>,
      );
      setSections(norm);
      setLastSaved(
        new Date().toLocaleTimeString("mn-MN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
      showToast("Тайлан амжилттай хадгалагдлаа.");
    } catch {
      alert("Хадгалахад алдаа гарлала.");
    } finally {
      setSaving(false);
    }
  };

  const handleWordExport = async () => {
    try {
      await tailanApi.saveDeptBsc(
        year,
        quarter,
        sections as Record<string, unknown>,
      );
      const blob = await tailanApi.generateDeptWord({
        year,
        quarter,
        tasks: [],
        sections: [],
        otherEntries: [],
        activities: [],
        rawSections: sections,
      } as any);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tailan_${year}_Q${quarter}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("DOCX файл амжилттай татагдлаа.");
    } catch {
      showToast("DOCX файл татахад алдаа гарлаа.", "error");
    }
  };

  const totalWS = SECTION_DEFS.reduce((sum, d) => {
    const sc = parseFloat(sections[d.id]?.score ?? "");
    return sum + (!isNaN(sc) ? (sc * d.weight) / 100 : 0);
  }, 0);

  const isEval = activeTab === "eval";
  const activeDef = SECTION_DEFS.find((d) => d.id === activeTab);
  const qName = Q_NAMES[(quarter - 1) % 4];

  return {
    year, setYear,
    quarter, setQuarter,
    activeTab, setActiveTab,
    sidebarOpen, setSidebarOpen,
    sections,
    saving,
    lastSaved,
    toast,
    showToast,
    updateSection,
    negtgelKpi,
    updateNegtgelRow,
    updateNegtgelGroupLabel,
    handleS1ApiLoad,
    handleS1_13ApiLoad,
    handleS1_14ApiLoad,
    handleS2_23ApiLoad,
    handleS2_24ApiLoad,
    handleS3_33ApiLoad,
    handleS3_34ApiLoad,
    handleS4_42ApiLoad,
    handleS4_43ApiLoad,
    handleDbSave,
    handleWordExport,
    totalWS,
    isEval,
    activeDef,
    qName,
  };
}