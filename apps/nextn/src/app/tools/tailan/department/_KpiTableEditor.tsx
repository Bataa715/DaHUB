import React from "react";
import {
  KpiRow,
  KpiSubSection,
  DashboardRow,
  Section2TaskRow,
  Section14Row,
  Section23Row,
  Section42Row,
  Section43Row,
  RichTextItem,
  RichTextContent,
  PRODUCT_TYPES,
} from "./_types";

// ─── Unified content helpers ─────────────────────────────────────────────────
function getItemContents(item: RichTextItem): RichTextContent[] {
  if (item.contents && item.contents.length > 0) return item.contents;
  // backward-compat: build from bullets + images
  const bc: RichTextContent[] = item.bullets.map((b, i) => ({
    id: `b_${i}_${item.id}`,
    type: "bullet" as const,
    text: b,
  }));
  const ic: RichTextContent[] = (item.images ?? []).map((img) => ({
    id: img.id,
    type: "image" as const,
    dataUrl: img.dataUrl,
    width: img.width,
  }));
  return [...bc, ...ic];
}

// ─── Auto-resizing textarea ───────────────────────────────────────────────────
export function AutoTextarea({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      style={{ overflow: "hidden", resize: "none" }}
    />
  );
}

// ─── DashTaskCard ─────────────────────────────────────────────────────────────

export function DashTaskCard({
  index,
  row,
  onChangeTitle,
  onChangeDesc,
  onRemove,
  onChangeImages,
}: {
  index: number;
  row: DashboardRow;
  onChangeTitle: (v: string) => void;
  onChangeDesc: (v: string) => void;
  onRemove: () => void;
  onChangeImages?: (
    imgs: { id: string; dataUrl: string; width: number }[],
  ) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const iCls =
    "w-full bg-slate-800/60 border border-slate-700/50 rounded px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60";

  const handleAddImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const current = row.images ?? [];
    let loaded = 0;
    const newImgs: {
      id: string;
      dataUrl: string;
      width: number;
      height?: number;
    }[] = [...current];
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        newImgs.push({
          id: crypto.randomUUID(),
          dataUrl: reader.result as string,
          width: 80,
          height: 0,
        });
        loaded++;
        if (loaded === files.length) onChangeImages?.(newImgs);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const handleDeleteImage = (id: string) => {
    onChangeImages?.((row.images ?? []).filter((img) => img.id !== id));
  };

  const handleWidthChange = (id: string, w: number) => {
    onChangeImages?.(
      (row.images ?? []).map((img) =>
        img.id === id ? { ...img, width: w } : img,
      ),
    );
  };

  const handleHeightChange = (id: string, h: number) => {
    onChangeImages?.(
      (row.images ?? []).map((img) =>
        img.id === id ? { ...img, height: h } : img,
      ),
    );
  };
  return (
    <div className="bg-slate-700/20">
      {/* Collapsed row */}
      <div
        className="flex items-center gap-2 px-2.5 py-2 cursor-pointer hover:bg-slate-700/40 transition select-none"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-xs text-slate-500 w-5 shrink-0 text-center">
          {index + 1}
        </span>
        <span className="flex-1 text-xs font-semibold text-white truncate">
          {row.title || (
            <span className="font-normal text-slate-500">Ажлын нэр...</span>
          )}
        </span>
        {(row.images ?? []).length > 0 && (
          <span className="text-[9px] text-slate-500">
            {row.images!.length} зур
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="text-red-400/60 hover:text-red-400 transition"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
        <svg
          className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
      {/* Expanded */}
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-slate-700/40">
          <div className="pt-2">
            <label className="block text-[10px] text-slate-400 mb-1">
              Ажлын нэр
            </label>
            <input
              value={row.title}
              onChange={(e) => onChangeTitle(e.target.value)}
              placeholder="Ажлын нэр..."
              className={iCls + " font-bold"}
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">
              Гүйцэтгэл /тайлбар/
            </label>
            <textarea
              rows={4}
              value={row.description}
              onChange={(e) => onChangeDesc(e.target.value)}
              placeholder="Дэлгэрэнгүй тайлбар..."
              className={iCls + " resize-none leading-relaxed"}
            />
          </div>
          {(row.images ?? []).length > 0 && (
            <div className="flex flex-col gap-2 mt-1">
              {row.images!.map((img) => (
                <div key={img.id} className="flex items-center gap-2 group">
                  <img
                    src={img.dataUrl}
                    alt=""
                    className="h-14 rounded border border-slate-700/50 object-cover shrink-0"
                  />
                  <div className="flex flex-col gap-1 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400 w-10 shrink-0">
                        Өргөн:
                      </span>
                      <input
                        type="range"
                        min={20}
                        max={100}
                        value={img.width ?? 80}
                        onChange={(e) =>
                          handleWidthChange(img.id, Number(e.target.value))
                        }
                        className="w-20 accent-blue-400"
                      />
                      <span className="text-[10px] text-slate-300 w-7">
                        {img.width ?? 80}%
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400 w-10 shrink-0">
                        Өндөр:
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={600}
                        step={10}
                        value={img.height ?? 0}
                        onChange={(e) =>
                          handleHeightChange(img.id, Number(e.target.value))
                        }
                        className="w-20 accent-purple-400"
                      />
                      <span className="text-[10px] text-slate-300 w-12">
                        {img.height && img.height > 0
                          ? `${img.height}px`
                          : "авто"}
                      </span>
                    </div>
                  </div>
                  {onChangeImages && (
                    <button
                      onClick={() => handleDeleteImage(img.id)}
                      className="text-slate-600 hover:text-rose-400 text-sm leading-none opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Устгах"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {onChangeImages && (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleAddImages}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="text-[10px] text-slate-500 hover:text-blue-400 transition-colors"
              >
                + Зураг нэмэх
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── KPI Table Editor ─────────────────────────────────────────────────────────

export function KpiTableEditor({
  subSections,
  onChange,
  onApiLoad,
  onS2TableApiLoad,
  onS14TableApiLoad,
  onS23TableApiLoad,
  onS24TableApiLoad,
  onS33TableApiLoad,
  onS34TableApiLoad,
  onS42KnowledgeApiLoad,
  onS43TrainingsApiLoad,
}: {
  subSections: KpiSubSection[];
  onChange: (updated: KpiSubSection[]) => void;
  onApiLoad?: (si: number) => Promise<DashboardRow[]>;
  onS2TableApiLoad?: (si: number) => Promise<Section2TaskRow[]>;
  onS14TableApiLoad?: (si: number) => Promise<Section14Row[]>;
  onS23TableApiLoad?: (si: number) => Promise<Section23Row[]>;
  onS24TableApiLoad?: (si: number) => Promise<Section2TaskRow[]>;
  onS33TableApiLoad?: (si: number) => Promise<Section23Row[]>;
  onS34TableApiLoad?: (si: number) => Promise<Section23Row[]>;
  onS42KnowledgeApiLoad?: (si: number) => Promise<RichTextItem[]>;
  onS43TrainingsApiLoad?: (si: number) => Promise<Section43Row[]>;
}) {
  const iCls =
    "w-full bg-slate-800/60 border border-slate-700/50 rounded px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60";
  const taCls = iCls + " resize-none overflow-hidden leading-relaxed";

  const updateSection14Row = (
    si: number,
    ri: number,
    field: "title" | "productType" | "savedDays" | "employeeName",
    value: string,
  ) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              section14Rows: (sub.section14Rows ?? []).map((row, r) =>
                r !== ri ? row : { ...row, [field]: value },
              ),
            },
      ),
    );

  const addSection14Row = (si: number, group: "new" | "used") =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              section14Rows: [
                ...(sub.section14Rows ?? []),
                {
                  title: "",
                  productType: "Өгөгдөл боловсруулалт",
                  savedDays: "",
                  group,
                  employeeName: "",
                },
              ],
            },
      ),
    );

  const removeSection14Row = (si: number, ri: number) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              section14Rows: (sub.section14Rows ?? []).filter(
                (_, r) => r !== ri,
              ),
            },
      ),
    );

  const updateSection14Text = (si: number, value: string) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si ? sub : { ...sub, section14Text: value },
      ),
    );

  const updateSection2Row = (
    si: number,
    ri: number,
    field: "title" | "result" | "period" | "completion" | "employeeName",
    value: string,
  ) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              section2Rows: (sub.section2Rows ?? []).map((row, r) =>
                r !== ri ? row : { ...row, [field]: value },
              ),
            },
      ),
    );

  // ── RichText helpers ──────────────────────────────────────────────────────
  const addRichTextItem = (si: number) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              richTextRows: [
                ...(sub.richTextRows ?? []),
                {
                  id: Date.now().toString(),
                  title: "",
                  bullets: [],
                  images: [],
                },
              ],
            },
      ),
    );

  const removeRichTextItem = (si: number, ii: number) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              richTextRows: (sub.richTextRows ?? []).filter((_, i) => i !== ii),
            },
      ),
    );

  const updateRichTextTitle = (si: number, ii: number, value: string) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              richTextRows: (sub.richTextRows ?? []).map((item, i) =>
                i !== ii ? item : { ...item, title: value },
              ),
            },
      ),
    );

  const addBullet = (si: number, ii: number) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              richTextRows: (sub.richTextRows ?? []).map((item, i) =>
                i !== ii ? item : { ...item, bullets: [...item.bullets, ""] },
              ),
            },
      ),
    );

  const updateBullet = (si: number, ii: number, bi: number, value: string) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              richTextRows: (sub.richTextRows ?? []).map((item, i) =>
                i !== ii
                  ? item
                  : {
                      ...item,
                      bullets: item.bullets.map((b, bj) =>
                        bj !== bi ? b : value,
                      ),
                    },
              ),
            },
      ),
    );

  const removeBullet = (si: number, ii: number, bi: number) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              richTextRows: (sub.richTextRows ?? []).map((item, i) =>
                i !== ii
                  ? item
                  : {
                      ...item,
                      bullets: item.bullets.filter((_, bj) => bj !== bi),
                    },
              ),
            },
      ),
    );

  const updateContents = (
    si: number,
    ii: number,
    contents: RichTextContent[],
  ) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              richTextRows: (sub.richTextRows ?? []).map((item, i) =>
                i !== ii
                  ? item
                  : {
                      ...item,
                      contents,
                      bullets: contents
                        .filter((c) => c.type === "bullet")
                        .map((c) => c.text ?? ""),
                      images: contents
                        .filter((c) => c.type === "image")
                        .map((c) => ({
                          id: c.id,
                          dataUrl: c.dataUrl ?? "",
                          width: c.width ?? 80,
                          height: c.height ?? 0,
                        })),
                    },
              ),
            },
      ),
    );

  const addSection2Row = (si: number) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              section2Rows: [
                ...(sub.section2Rows ?? []),
                {
                  order: (sub.section2Rows?.length ?? 0) + 1,
                  title: "",
                  result: "",
                  period: "",
                  completion: "",
                  employeeName: "",
                  images: [],
                },
              ],
            },
      ),
    );

  // ── Section23 helpers ──────────────────────────────────────────────────
  const updateSection23Row = (
    si: number,
    ri: number,
    field: "title" | "usage" | "clientScore" | "employeeName",
    value: string,
  ) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              section23Rows: (sub.section23Rows ?? []).map((row, r) =>
                r !== ri ? row : { ...row, [field]: value },
              ),
            },
      ),
    );

  const addSection23Row = (si: number) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              section23Rows: [
                ...(sub.section23Rows ?? []),
                { title: "", usage: "", clientScore: "", employeeName: "" },
              ],
            },
      ),
    );

  const removeSection23Row = (si: number, ri: number) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              section23Rows: (sub.section23Rows ?? []).filter(
                (_, r) => r !== ri,
              ),
            },
      ),
    );

  // ── Section24 helpers ──────────────────────────────────────────────────
  const updateSection24Row = (
    si: number,
    ri: number,
    field: "title" | "result" | "period" | "completion" | "employeeName",
    value: string,
  ) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              section24Rows: (sub.section24Rows ?? []).map((row, r) =>
                r !== ri ? row : { ...row, [field]: value },
              ),
            },
      ),
    );

  const addSection24Row = (si: number) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              section24Rows: [
                ...(sub.section24Rows ?? []),
                {
                  order: (sub.section24Rows?.length ?? 0) + 1,
                  title: "",
                  result: "",
                  period: "",
                  completion: "",
                  employeeName: "",
                  images: [],
                },
              ],
            },
      ),
    );

  const removeSection24Row = (si: number, ri: number) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              section24Rows: (sub.section24Rows ?? []).filter(
                (_, r) => r !== ri,
              ),
            },
      ),
    );

  // ── Section33 helpers ──────────────────────────────────────────────────
  const updateSection33Row = (
    si: number,
    ri: number,
    field: "title" | "usage" | "clientScore" | "employeeName",
    value: string,
  ) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              section33Rows: (sub.section33Rows ?? []).map((row, r) =>
                r !== ri ? row : { ...row, [field]: value },
              ),
            },
      ),
    );

  const addSection33Row = (si: number) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              section33Rows: [
                ...(sub.section33Rows ?? []),
                { title: "", usage: "", clientScore: "", employeeName: "" },
              ],
            },
      ),
    );

  const removeSection33Row = (si: number, ri: number) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              section33Rows: (sub.section33Rows ?? []).filter(
                (_, r) => r !== ri,
              ),
            },
      ),
    );

  // ── Section34 helpers ──────────────────────────────────────────────────
  const updateSection34Row = (
    si: number,
    ri: number,
    field: "title" | "usage" | "clientScore" | "employeeName",
    value: string,
  ) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              section34Rows: (sub.section34Rows ?? []).map((row, r) =>
                r !== ri ? row : { ...row, [field]: value },
              ),
            },
      ),
    );

  const addSection34Row = (si: number) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              section34Rows: [
                ...(sub.section34Rows ?? []),
                { title: "", usage: "", clientScore: "", employeeName: "" },
              ],
            },
      ),
    );

  const removeSection34Row = (si: number, ri: number) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              section34Rows: (sub.section34Rows ?? []).filter(
                (_, r) => r !== ri,
              ),
            },
      ),
    );

  // ── Section42 helpers ──────────────────────────────────────────────────
  const updateSection42Row = (
    si: number,
    ri: number,
    field: "employeeName" | "text",
    value: string,
  ) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              section42Rows: (sub.section42Rows ?? []).map((row, r) =>
                r !== ri ? row : { ...row, [field]: value },
              ),
            },
      ),
    );

  const addSection42Row = (si: number) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              section42Rows: [
                ...(sub.section42Rows ?? []),
                { employeeName: "", text: "" },
              ],
            },
      ),
    );

  const removeSection42Row = (si: number, ri: number) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              section42Rows: (sub.section42Rows ?? []).filter(
                (_, r) => r !== ri,
              ),
            },
      ),
    );

  // ── Section43 helpers ──────────────────────────────────────────────────
  const updateSection43Row = (
    si: number,
    ri: number,
    field: keyof Section43Row,
    value: string,
  ) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              section43Rows: (sub.section43Rows ?? []).map((row, r) =>
                r !== ri ? row : { ...row, [field]: value },
              ),
            },
      ),
    );

  const addSection43Row = (si: number) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              section43Rows: [
                ...(sub.section43Rows ?? []),
                {
                  employeeName: "",
                  training: "",
                  organizer: "",
                  type: "",
                  date: "",
                  format: "",
                  hours: "",
                  meetsAuditGoal: "",
                  sharedKnowledge: "",
                },
              ],
            },
      ),
    );

  const removeSection43Row = (si: number, ri: number) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              section43Rows: (sub.section43Rows ?? []).filter(
                (_, r) => r !== ri,
              ),
            },
      ),
    );

  const removeSection2Row = (si: number, ri: number) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              section2Rows: (sub.section2Rows ?? []).filter((_, r) => r !== ri),
            },
      ),
    );

  const updateRow = (
    si: number,
    ri: number,
    field: keyof KpiRow,
    value: string | number,
  ) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              rows: sub.rows.map((row, r) =>
                r !== ri ? row : { ...row, [field]: value },
              ),
            },
      ),
    );

  const updateSub = (si: number, field: "id" | "groupLabel", value: string) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si ? sub : { ...sub, [field]: value },
      ),
    );

  const addRow = (si: number) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              rows: [
                ...sub.rows,
                { indicator: "", weight: 10, score: "", evaluatedBy: "" },
              ],
            },
      ),
    );

  const removeRow = (si: number, ri: number) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si ? sub : { ...sub, rows: sub.rows.filter((_, r) => r !== ri) },
      ),
    );

  const updateDashRow = (
    si: number,
    ri: number,
    field: "title" | "description",
    value: string,
  ) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              dashboardRows: (sub.dashboardRows ?? []).map((row, r) =>
                r !== ri ? row : { ...row, [field]: value },
              ),
            },
      ),
    );

  const updateDashImages = (
    si: number,
    ri: number,
    imgs: { id: string; dataUrl: string; width: number }[],
  ) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              dashboardRows: (sub.dashboardRows ?? []).map((row, r) =>
                r !== ri ? row : { ...row, images: imgs },
              ),
            },
      ),
    );

  const updateSection2RowImages = (
    si: number,
    ri: number,
    imgs: { id: string; dataUrl: string; width: number }[],
  ) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              section2Rows: (sub.section2Rows ?? []).map((row, r) =>
                r !== ri ? row : { ...row, images: imgs },
              ),
            },
      ),
    );

  const updateSection24RowImages = (
    si: number,
    ri: number,
    imgs: { id: string; dataUrl: string; width: number }[],
  ) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              section24Rows: (sub.section24Rows ?? []).map((row, r) =>
                r !== ri ? row : { ...row, images: imgs },
              ),
            },
      ),
    );

  const addDashRow = (si: number) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              dashboardRows: [
                ...(sub.dashboardRows ?? []),
                { title: "", description: "", images: [] },
              ],
            },
      ),
    );

  const removeDashRow = (si: number, ri: number) =>
    onChange(
      subSections.map((sub, s) =>
        s !== si
          ? sub
          : {
              ...sub,
              dashboardRows: (sub.dashboardRows ?? []).filter(
                (_, r) => r !== ri,
              ),
            },
      ),
    );

  return (
    <div className="space-y-4">
      {subSections.map((sub, si) => {
        // ── Section14Table (1.4 style) ────────────────────────────────────────
        if (sub.type === "section14table") {
          const all14 = sub.section14Rows ?? [];
          const newRows = all14.filter((r) => r.group === "new");
          const usedRows = all14.filter((r) => r.group === "used");

          const renderGroup = (
            group: "new" | "used",
            rows: Section14Row[],
            startIdx: number,
          ) => {
            const label =
              group === "new"
                ? "Тайлант хугацаанд шинээр нэвтрүүлсэн дата бүтээгдэхүүн"
                : "Тайлант хугацаанд аудитын үйл ажиллагаанд ашигласан дата бүтээгдэхүүн";
            const total = rows.reduce(
              (s, r) => s + (parseFloat(r.savedDays) || 0),
              0,
            );
            return (
              <>
                <tr className="bg-slate-800/60">
                  <td
                    colSpan={5}
                    className="border border-slate-700/40 px-2 py-1.5 text-center text-[10px] font-bold text-slate-300"
                  >
                    {label}
                  </td>
                </tr>
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="border border-slate-700/40 px-2 py-2 text-center text-slate-600 text-[10px]"
                    >
                      — Мэдээлэл байхгүй —
                    </td>
                  </tr>
                )}
                {rows.map((row, li) => {
                  const ri = startIdx + li;
                  return (
                    <tr key={ri} className="border-b border-slate-700/30">
                      <td className="border border-slate-700/40 px-1 py-1 text-center text-slate-400 text-xs">
                        {li + 1}
                      </td>
                      <td className="border border-slate-700/40 px-1 py-1">
                        <AutoTextarea
                          value={row.title}
                          onChange={(e) =>
                            updateSection14Row(si, ri, "title", e.target.value)
                          }
                          placeholder="Бүтээгдэхүүний нэр..."
                          className={taCls}
                        />
                      </td>
                      <td className="border border-slate-700/40 px-1 py-1">
                        <select
                          value={row.productType}
                          onChange={(e) =>
                            updateSection14Row(
                              si,
                              ri,
                              "productType",
                              e.target.value,
                            )
                          }
                          className={iCls}
                        >
                          {PRODUCT_TYPES.map((pt) => (
                            <option key={pt} value={pt}>
                              {pt}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border border-slate-700/40 px-1 py-1">
                        <input
                          value={row.savedDays}
                          onChange={(e) =>
                            updateSection14Row(
                              si,
                              ri,
                              "savedDays",
                              e.target.value,
                            )
                          }
                          placeholder="–"
                          className={`${iCls} text-center`}
                        />
                      </td>
                      <td className="border border-slate-700/40 px-1 py-1 text-center">
                        <button
                          onClick={() => removeSection14Row(si, ri)}
                          className="text-slate-600 hover:text-rose-400 text-sm leading-none"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-800/40">
                  <td
                    colSpan={3}
                    className="border border-slate-700/40 px-2 py-1.5 text-center font-bold text-[10px] text-slate-400"
                  >
                    НИЙТ
                  </td>
                  <td className="border border-slate-700/40 px-2 py-1.5 text-center font-bold text-white text-xs">
                    {total > 0 ? total : "–"}
                  </td>
                  <td className="border border-slate-700/40">
                    <button
                      onClick={() => addSection14Row(si, group)}
                      className="w-full text-[10px] text-slate-500 hover:text-blue-400 transition-colors"
                    >
                      +
                    </button>
                  </td>
                </tr>
              </>
            );
          };

          return (
            <div
              key={si}
              className="border border-slate-700/40 rounded-xl overflow-hidden"
            >
              <div className="bg-slate-800/80 px-3 py-2 flex items-center gap-2 border-b border-slate-700/50">
                <input
                  value={sub.id}
                  onChange={(e) => updateSub(si, "id", e.target.value)}
                  className="w-12 bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1 text-xs font-bold text-orange-300 focus:outline-none"
                />
                <input
                  value={sub.groupLabel}
                  onChange={(e) => updateSub(si, "groupLabel", e.target.value)}
                  placeholder="Хэсгийн нэр..."
                  className="flex-1 bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1 text-xs font-bold text-white focus:outline-none"
                />
                {onS14TableApiLoad && (
                  <button
                    onClick={async () => {
                      const rows = await onS14TableApiLoad(si);
                      onChange(
                        subSections.map((sub2, s) =>
                          s !== si ? sub2 : { ...sub2, section14Rows: rows },
                        ),
                      );
                    }}
                    className="text-[10px] bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 rounded px-2 py-1 transition-colors shrink-0"
                  >
                    Хувийн тайланаас татах
                  </button>
                )}
              </div>
              <div className="px-3 pt-2 pb-1">
                <label className="block text-[10px] text-slate-400 mb-1">
                  Тайлбар текст
                </label>
                <textarea
                  rows={3}
                  value={sub.section14Text ?? ""}
                  onChange={(e) => updateSection14Text(si, e.target.value)}
                  placeholder="Тайлант хугацаанд хэмнэсэн нөөц, цаг хугацааны талаарх тайлбар..."
                  className={iCls + " resize-none leading-relaxed"}
                />
              </div>
              <div className="px-3 pb-3">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-amber-400/30 text-amber-100">
                      <th className="border border-slate-700/40 px-2 py-1.5 text-center w-8">
                        №
                      </th>
                      <th className="border border-slate-700/40 px-2 py-1.5 text-left">
                        ДАТА БҮТЭЭГДЭХҮҮН
                      </th>
                      <th className="border border-slate-700/40 px-2 py-1.5 w-40">
                        БҮТЭЭГДЭХҮҮНИЙ ТӨРӨЛ
                      </th>
                      <th className="border border-slate-700/40 px-2 py-1.5 text-center w-24">
                        ХЭМНЭСЭН ХҮН/ӨДӨР
                      </th>
                      <th className="border border-slate-700/40 w-7"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {renderGroup("new", newRows, 0)}
                    {renderGroup("used", usedRows, newRows.length)}
                  </tbody>
                </table>
              </div>
            </div>
          );
        }

        // ── Section2Table (1.3 style) ─────────────────────────────────────────
        if (sub.type === "section2table") {
          const s2Rows = sub.section2Rows ?? [];
          return (
            <div
              key={si}
              className="border border-slate-700/40 rounded-xl overflow-hidden"
            >
              <div className="bg-slate-800/80 px-3 py-2 flex items-center gap-2 border-b border-slate-700/50">
                <input
                  value={sub.id}
                  onChange={(e) => updateSub(si, "id", e.target.value)}
                  className="w-12 bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1 text-xs font-bold text-orange-300 focus:outline-none"
                />
                <input
                  value={sub.groupLabel}
                  onChange={(e) => updateSub(si, "groupLabel", e.target.value)}
                  placeholder="Хэсгийн нэр..."
                  className="flex-1 bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1 text-xs font-bold text-white focus:outline-none"
                />
                {onS2TableApiLoad && (
                  <button
                    onClick={async () => {
                      const rows = await onS2TableApiLoad(si);
                      onChange(
                        subSections.map((sub2, s) =>
                          s !== si ? sub2 : { ...sub2, section2Rows: rows },
                        ),
                      );
                    }}
                    className="text-[10px] bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 rounded px-2 py-1 transition-colors shrink-0"
                  >
                    Хувийн тайланаас татах
                  </button>
                )}
              </div>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-700/60 text-slate-200">
                    <th className="border border-slate-700/40 px-2 py-1.5 text-center w-7">
                      №
                    </th>
                    <th className="border border-slate-700/40 px-2 py-1.5 text-left">
                      Төлөвлөгөөт ажил (Дууссан ажлууд)
                    </th>
                    <th className="border border-slate-700/40 px-2 py-1.5 text-center w-16">
                      Ажлын гүйцэтгэл
                    </th>
                    <th className="border border-slate-700/40 px-2 py-1.5 w-32">
                      Хийгдсэн хугацаа
                    </th>
                    <th className="border border-slate-700/40 px-2 py-1.5">
                      Гүйцэтгэл /товч/
                    </th>
                    <th className="border border-slate-700/40 w-7"></th>
                  </tr>
                </thead>
                <tbody>
                  {s2Rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="border border-slate-700/40 px-3 py-3 text-center text-slate-600 text-[11px]"
                      >
                        Ажил байхгүй — "Хувийн тайланаас татах" эсвэл "+" товч
                        дарна уу
                      </td>
                    </tr>
                  )}
                  {s2Rows.map((row, ri) => (
                    <tr key={ri} className="border-b border-slate-700/30">
                      <td className="border border-slate-700/40 px-1 py-1 text-center text-slate-400">
                        {ri + 1}
                      </td>
                      <td className="border border-slate-700/40 px-1 py-1">
                        <AutoTextarea
                          value={row.title}
                          onChange={(e) =>
                            updateSection2Row(si, ri, "title", e.target.value)
                          }
                          placeholder="Ажлын нэр..."
                          className={taCls}
                        />
                      </td>
                      <td className="border border-slate-700/40 px-1 py-1">
                        <input
                          type="number"
                          value={row.result}
                          onChange={(e) =>
                            updateSection2Row(si, ri, "result", e.target.value)
                          }
                          placeholder="%"
                          className={`${iCls} text-center`}
                        />
                      </td>
                      <td className="border border-slate-700/40 px-1 py-1">
                        <AutoTextarea
                          value={row.period}
                          onChange={(e) =>
                            updateSection2Row(si, ri, "period", e.target.value)
                          }
                          placeholder="Хугацаа..."
                          className={taCls}
                        />
                      </td>
                      <td className="border border-slate-700/40 px-1 py-1">
                        <AutoTextarea
                          value={row.completion}
                          onChange={(e) =>
                            updateSection2Row(
                              si,
                              ri,
                              "completion",
                              e.target.value,
                            )
                          }
                          placeholder="Гүйцэтгэл /товч/..."
                          className={taCls}
                        />
                      </td>
                      <td className="border border-slate-700/40 px-1 py-1 text-center">
                        <button
                          onClick={() => removeSection2Row(si, ri)}
                          className="text-slate-600 hover:text-rose-400 text-sm leading-none"
                          title="Устгах"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(() => {
                    const nums = s2Rows
                      .map((r) => parseFloat(r.result))
                      .filter((n) => !isNaN(n));
                    const avg =
                      nums.length > 0
                        ? nums.reduce((a, b) => a + b, 0) / nums.length
                        : null;
                    return (
                      <tr className="bg-slate-800/50">
                        <td className="border border-slate-700/40 px-1 py-1"></td>
                        <td className="border border-slate-700/40 px-2 py-1.5 text-center font-bold text-white">
                          Дундаж
                        </td>
                        <td className="border border-slate-700/40 px-1 py-1 text-center font-bold text-amber-300">
                          {avg !== null ? `${avg.toFixed(1)}%` : "–"}
                        </td>
                        <td
                          className="border border-slate-700/40 px-1 py-1"
                          colSpan={2}
                        ></td>
                        <td className="border border-slate-700/40 w-7"></td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
              <div className="px-3 py-1.5 bg-slate-900/40">
                <button
                  onClick={() => addSection2Row(si)}
                  className="text-[10px] text-slate-500 hover:text-blue-400 transition-colors"
                >
                  + Ажил нэмэх
                </button>
              </div>
              {s2Rows.some((r) => (r.images ?? []).length > 0) && (
                <div className="px-3 py-2 bg-slate-900/60 border-t border-slate-700/40">
                  <div className="text-[10px] text-slate-500 mb-1.5">
                    Зургуудын өргөн тохиргоо
                  </div>
                  {s2Rows.map((row, ri) =>
                    (row.images ?? []).length > 0 ? (
                      <div key={ri} className="mb-2">
                        <div className="text-[10px] text-slate-400 mb-1 truncate">
                          {ri + 1}. {row.title || "(нэргүй)"}
                        </div>
                        {row.images!.map((img) => (
                          <div
                            key={img.id}
                            className="flex flex-col gap-0.5 mb-2"
                          >
                            <div className="flex items-center gap-2">
                              <img
                                src={img.dataUrl}
                                alt=""
                                className="h-8 w-12 rounded border border-slate-700/50 object-cover shrink-0"
                              />
                              <div className="flex flex-col gap-0.5 flex-1">
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-slate-400 w-10 shrink-0">
                                    Өргөн:
                                  </span>
                                  <input
                                    type="range"
                                    min={20}
                                    max={100}
                                    value={img.width ?? 80}
                                    onChange={(e) => {
                                      const newImgs = row.images!.map((x) =>
                                        x.id === img.id
                                          ? {
                                              ...x,
                                              width: Number(e.target.value),
                                            }
                                          : x,
                                      );
                                      updateSection2RowImages(si, ri, newImgs);
                                    }}
                                    className="w-20 accent-blue-400"
                                  />
                                  <span className="text-[10px] text-slate-300 w-7">
                                    {img.width ?? 80}%
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-slate-400 w-10 shrink-0">
                                    Өндөр:
                                  </span>
                                  <input
                                    type="range"
                                    min={0}
                                    max={600}
                                    step={10}
                                    value={img.height ?? 0}
                                    onChange={(e) => {
                                      const newImgs = row.images!.map((x) =>
                                        x.id === img.id
                                          ? {
                                              ...x,
                                              height: Number(e.target.value),
                                            }
                                          : x,
                                      );
                                      updateSection2RowImages(si, ri, newImgs);
                                    }}
                                    className="w-20 accent-purple-400"
                                  />
                                  <span className="text-[10px] text-slate-300 w-12">
                                    {img.height && img.height > 0
                                      ? `${img.height}px`
                                      : "авто"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null,
                  )}
                </div>
              )}
            </div>
          );
        }

        // ── Section23Table (2.3 style) ────────────────────────────────────────
        if (sub.type === "section23table") {
          const s23Rows = sub.section23Rows ?? [];
          return (
            <div
              key={si}
              className="border border-slate-700/40 rounded-xl overflow-hidden"
            >
              <div className="bg-slate-800/80 px-3 py-2 flex items-center gap-2 border-b border-slate-700/50">
                <input
                  value={sub.id}
                  onChange={(e) => updateSub(si, "id", e.target.value)}
                  className="w-12 bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1 text-xs font-bold text-orange-300 focus:outline-none"
                />
                <input
                  value={sub.groupLabel}
                  onChange={(e) => updateSub(si, "groupLabel", e.target.value)}
                  placeholder="Хэсгийн нэр..."
                  className="flex-1 bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1 text-xs font-bold text-white focus:outline-none"
                />
                {onS23TableApiLoad && (
                  <button
                    onClick={async () => {
                      const rows = await onS23TableApiLoad(si);
                      onChange(
                        subSections.map((sub2, s) =>
                          s !== si ? sub2 : { ...sub2, section23Rows: rows },
                        ),
                      );
                    }}
                    className="text-[10px] bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 rounded px-2 py-1 transition-colors shrink-0"
                  >
                    Хувийн тайланаас татах
                  </button>
                )}
              </div>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-amber-400/30 text-amber-100">
                    <th className="border border-slate-700/40 px-2 py-1.5 text-center w-8">
                      №
                    </th>
                    <th className="border border-slate-700/40 px-2 py-1.5 text-left">
                      Өгөгдөл боловсруулалт
                    </th>
                    <th className="border border-slate-700/40 px-2 py-1.5 text-left">
                      Ач холбогдол хэрэглээ
                    </th>
                    <th className="border border-slate-700/40 px-2 py-1.5 text-center w-28">
                      Хэрэглэгч үнэлгээ
                    </th>
                    <th className="border border-slate-700/40 w-7"></th>
                  </tr>
                </thead>
                <tbody>
                  {s23Rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="border border-slate-700/40 px-3 py-3 text-center text-slate-600 text-[11px]"
                      >
                        Татах товч дарна уу
                      </td>
                    </tr>
                  )}
                  {s23Rows.map((row, ri) => (
                    <tr key={ri} className="border-b border-slate-700/30">
                      <td className="border border-slate-700/40 px-1 py-1 text-center text-slate-400">
                        {ri + 1}
                      </td>
                      <td className="border border-slate-700/40 px-1 py-1">
                        <textarea
                          rows={2}
                          value={row.title}
                          onChange={(e) =>
                            updateSection23Row(si, ri, "title", e.target.value)
                          }
                          placeholder="Ажлын нэр..."
                          className={taCls}
                        />
                      </td>
                      <td className="border border-slate-700/40 px-1 py-1">
                        <textarea
                          rows={2}
                          value={row.usage}
                          onChange={(e) =>
                            updateSection23Row(si, ri, "usage", e.target.value)
                          }
                          placeholder="Ач холбогдол, хэрэглээ..."
                          className={taCls}
                        />
                      </td>
                      <td className="border border-slate-700/40 px-1 py-1">
                        <input
                          value={row.clientScore}
                          onChange={(e) =>
                            updateSection23Row(
                              si,
                              ri,
                              "clientScore",
                              e.target.value,
                            )
                          }
                          placeholder="Үнэлгээ..."
                          className={`${iCls} text-center`}
                        />
                      </td>
                      <td className="border border-slate-700/40 px-1 py-1 text-center">
                        <button
                          onClick={() => removeSection23Row(si, ri)}
                          className="text-slate-600 hover:text-rose-400 text-sm leading-none"
                          title="Устгах"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(() => {
                    const nums = s23Rows
                      .map((r) => parseFloat(r.clientScore))
                      .filter((n) => !isNaN(n));
                    const avg =
                      nums.length > 0
                        ? nums.reduce((a, b) => a + b, 0) / nums.length
                        : null;
                    return (
                      <tr className="bg-slate-800/50">
                        <td
                          colSpan={3}
                          className="border border-slate-700/40 px-2 py-1.5 text-center font-bold text-white"
                        >
                          Дундаж
                        </td>
                        <td className="border border-slate-700/40 px-1 py-1 text-center font-bold text-amber-300">
                          {avg !== null ? avg.toFixed(1) : "–"}
                        </td>
                        <td className="border border-slate-700/40 w-7"></td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
              <div className="px-3 py-1.5 bg-slate-900/40">
                <button
                  onClick={() => addSection23Row(si)}
                  className="text-[10px] text-slate-500 hover:text-blue-400 transition-colors"
                >
                  + Мөр нэмэх
                </button>
              </div>
            </div>
          );
        }

        // ── Section24Table (2.4 style) ────────────────────────────────────────
        if (sub.type === "section24table") {
          const s24Rows = sub.section24Rows ?? [];
          return (
            <div
              key={si}
              className="border border-slate-700/40 rounded-xl overflow-hidden"
            >
              <div className="bg-slate-800/80 px-3 py-2 flex items-center gap-2 border-b border-slate-700/50">
                <input
                  value={sub.id}
                  onChange={(e) => updateSub(si, "id", e.target.value)}
                  className="w-12 bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1 text-xs font-bold text-orange-300 focus:outline-none"
                />
                <input
                  value={sub.groupLabel}
                  onChange={(e) => updateSub(si, "groupLabel", e.target.value)}
                  placeholder="Хэсгийн нэр..."
                  className="flex-1 bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1 text-xs font-bold text-white focus:outline-none"
                />
                {onS24TableApiLoad && (
                  <button
                    onClick={async () => {
                      const rows = await onS24TableApiLoad(si);
                      onChange(
                        subSections.map((sub2, s) =>
                          s !== si ? sub2 : { ...sub2, section24Rows: rows },
                        ),
                      );
                    }}
                    className="text-[10px] bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 rounded px-2 py-1 transition-colors shrink-0"
                  >
                    Хувийн тайланаас татах
                  </button>
                )}
              </div>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-amber-400/30 text-amber-100">
                    <th className="border border-slate-700/40 px-2 py-1.5 text-center w-8">
                      №
                    </th>
                    <th className="border border-slate-700/40 px-2 py-1.5 text-left">
                      АЖЛЫН НЭР
                    </th>
                    <th className="border border-slate-700/40 px-2 py-1.5 text-center w-16">
                      ГҮЙЦЭТГЭЛ %
                    </th>
                    <th className="border border-slate-700/40 px-2 py-1.5 w-28">
                      ГҮЙЦЭТГЭЛ /ТОВЧ/
                    </th>
                    <th className="border border-slate-700/40 px-2 py-1.5 w-36">
                      ХУГАЦАА
                    </th>
                    <th className="border border-slate-700/40 w-7"></th>
                  </tr>
                </thead>
                <tbody>
                  {s24Rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="border border-slate-700/40 px-3 py-3 text-center text-slate-600 text-[11px]"
                      >
                        Татах товч дарна уу
                      </td>
                    </tr>
                  )}
                  {s24Rows.map((row, ri) => (
                    <tr key={ri} className="border-b border-slate-700/30">
                      <td className="border border-slate-700/40 px-1 py-1 text-center text-slate-400">
                        {ri + 1}
                      </td>
                      <td className="border border-slate-700/40 px-1 py-1">
                        <textarea
                          rows={2}
                          value={row.title}
                          onChange={(e) =>
                            updateSection24Row(si, ri, "title", e.target.value)
                          }
                          placeholder="Ажлын нэр..."
                          className={taCls}
                        />
                      </td>
                      <td className="border border-slate-700/40 px-1 py-1">
                        <input
                          type="text"
                          value={row.result}
                          onChange={(e) =>
                            updateSection24Row(si, ri, "result", e.target.value)
                          }
                          className={`${iCls} text-center`}
                        />
                      </td>
                      <td className="border border-slate-700/40 px-1 py-1">
                        <textarea
                          rows={2}
                          value={row.completion}
                          onChange={(e) =>
                            updateSection24Row(
                              si,
                              ri,
                              "completion",
                              e.target.value,
                            )
                          }
                          placeholder="Товч тайлбар..."
                          className={taCls}
                        />
                      </td>
                      <td className="border border-slate-700/40 px-1 py-1">
                        <textarea
                          rows={2}
                          value={row.period}
                          onChange={(e) =>
                            updateSection24Row(si, ri, "period", e.target.value)
                          }
                          placeholder="Хугацаа..."
                          className={taCls}
                        />
                      </td>
                      <td className="border border-slate-700/40 px-1 py-1 text-center">
                        <button
                          onClick={() => removeSection24Row(si, ri)}
                          className="text-slate-600 hover:text-rose-400 text-sm leading-none"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(() => {
                    const nums = s24Rows
                      .map((r) => parseFloat(r.result))
                      .filter((n) => !isNaN(n));
                    const avg =
                      nums.length > 0
                        ? nums.reduce((a, b) => a + b, 0) / nums.length
                        : null;
                    return (
                      <tr className="bg-slate-800/50">
                        <td className="border border-slate-700/40 px-1 py-1"></td>
                        <td className="border border-slate-700/40 px-2 py-1.5 text-center font-bold text-white">
                          Дундаж
                        </td>
                        <td className="border border-slate-700/40 px-1 py-1 text-center font-bold text-amber-300">
                          {avg !== null ? `${avg.toFixed(1)}%` : "–"}
                        </td>
                        <td
                          className="border border-slate-700/40 px-1 py-1"
                          colSpan={2}
                        ></td>
                        <td className="border border-slate-700/40 w-7"></td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
              <div className="px-3 py-1.5 bg-slate-900/40">
                <button
                  onClick={() => addSection24Row(si)}
                  className="text-[10px] text-slate-500 hover:text-blue-400 transition-colors"
                >
                  + Мөр нэмэх
                </button>
              </div>
              {s24Rows.some((r) => (r.images ?? []).length > 0) && (
                <div className="px-3 py-2 bg-slate-900/60 border-t border-slate-700/40">
                  <div className="text-[10px] text-slate-500 mb-1.5">
                    Зургуудын өргөн тохиргоо
                  </div>
                  {s24Rows.map((row, ri) =>
                    (row.images ?? []).length > 0 ? (
                      <div key={ri} className="mb-2">
                        <div className="text-[10px] text-slate-400 mb-1 truncate">
                          {ri + 1}. {row.title || "(нэргүй)"}
                        </div>
                        {row.images!.map((img) => (
                          <div
                            key={img.id}
                            className="flex flex-col gap-0.5 mb-2"
                          >
                            <div className="flex items-center gap-2">
                              <img
                                src={img.dataUrl}
                                alt=""
                                className="h-8 w-12 rounded border border-slate-700/50 object-cover shrink-0"
                              />
                              <div className="flex flex-col gap-0.5 flex-1">
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-slate-400 w-10 shrink-0">
                                    Өргөн:
                                  </span>
                                  <input
                                    type="range"
                                    min={20}
                                    max={100}
                                    value={img.width ?? 80}
                                    onChange={(e) => {
                                      const newImgs = row.images!.map((x) =>
                                        x.id === img.id
                                          ? {
                                              ...x,
                                              width: Number(e.target.value),
                                            }
                                          : x,
                                      );
                                      updateSection24RowImages(si, ri, newImgs);
                                    }}
                                    className="w-20 accent-blue-400"
                                  />
                                  <span className="text-[10px] text-slate-300 w-7">
                                    {img.width ?? 80}%
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-slate-400 w-10 shrink-0">
                                    Өндөр:
                                  </span>
                                  <input
                                    type="range"
                                    min={0}
                                    max={600}
                                    step={10}
                                    value={img.height ?? 0}
                                    onChange={(e) => {
                                      const newImgs = row.images!.map((x) =>
                                        x.id === img.id
                                          ? {
                                              ...x,
                                              height: Number(e.target.value),
                                            }
                                          : x,
                                      );
                                      updateSection24RowImages(si, ri, newImgs);
                                    }}
                                    className="w-20 accent-purple-400"
                                  />
                                  <span className="text-[10px] text-slate-300 w-12">
                                    {img.height && img.height > 0
                                      ? `${img.height}px`
                                      : "авто"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null,
                  )}
                </div>
              )}
            </div>
          );
        }

        // ── Section33Table (3.3 style) ────────────────────────────────────────
        if (sub.type === "section33table") {
          const s33Rows = sub.section33Rows ?? [];
          return (
            <div
              key={si}
              className="border border-slate-700/40 rounded-xl overflow-hidden"
            >
              <div className="bg-slate-800/80 px-3 py-2 flex items-center gap-2 border-b border-slate-700/50">
                <input
                  value={sub.id}
                  onChange={(e) => updateSub(si, "id", e.target.value)}
                  className="w-12 bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1 text-xs font-bold text-orange-300 focus:outline-none"
                />
                <input
                  value={sub.groupLabel}
                  onChange={(e) => updateSub(si, "groupLabel", e.target.value)}
                  placeholder="Хэсгийн нэр..."
                  className="flex-1 bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1 text-xs font-bold text-white focus:outline-none"
                />
                {onS33TableApiLoad && (
                  <button
                    onClick={async () => {
                      const rows = await onS33TableApiLoad(si);
                      onChange(
                        subSections.map((sub2, s) =>
                          s !== si ? sub2 : { ...sub2, section33Rows: rows },
                        ),
                      );
                    }}
                    className="text-[10px] bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 rounded px-2 py-1 transition-colors shrink-0"
                  >
                    Хувийн тайланаас татах
                  </button>
                )}
              </div>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-amber-400/30 text-amber-100">
                    <th className="border border-slate-700/40 px-2 py-1.5 text-center w-8">
                      №
                    </th>
                    <th className="border border-slate-700/40 px-2 py-1.5 text-left">
                      Тогтмол хийгддэг өгөгдөл боловсруулалт
                    </th>
                    <th className="border border-slate-700/40 px-2 py-1.5 text-left">
                      Ач холбогдол хэрэглээ
                    </th>
                    <th className="border border-slate-700/40 px-2 py-1.5 text-center w-28">
                      Хэрэглэгч үнэлгээ
                    </th>
                    <th className="border border-slate-700/40 w-7"></th>
                  </tr>
                </thead>
                <tbody>
                  {s33Rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="border border-slate-700/40 px-3 py-3 text-center text-slate-600 text-[11px]"
                      >
                        Татах товч дарна уу
                      </td>
                    </tr>
                  )}
                  {s33Rows.map((row, ri) => (
                    <tr key={ri} className="border-b border-slate-700/30">
                      <td className="border border-slate-700/40 px-1 py-1 text-center text-slate-400">
                        {ri + 1}
                      </td>
                      <td className="border border-slate-700/40 px-1 py-1">
                        <textarea
                          rows={2}
                          value={row.title}
                          onChange={(e) =>
                            updateSection33Row(si, ri, "title", e.target.value)
                          }
                          placeholder="Өгөгдөл боловсруулалтын нэр..."
                          className={taCls}
                        />
                      </td>
                      <td className="border border-slate-700/40 px-1 py-1">
                        <textarea
                          rows={2}
                          value={row.usage}
                          onChange={(e) =>
                            updateSection33Row(si, ri, "usage", e.target.value)
                          }
                          placeholder="Ач холбогдол, хэрэглээ..."
                          className={taCls}
                        />
                      </td>
                      <td className="border border-slate-700/40 px-1 py-1">
                        <input
                          value={row.clientScore}
                          onChange={(e) =>
                            updateSection33Row(
                              si,
                              ri,
                              "clientScore",
                              e.target.value,
                            )
                          }
                          placeholder="Үнэлгээ..."
                          className={`${iCls} text-center`}
                        />
                      </td>
                      <td className="border border-slate-700/40 px-1 py-1 text-center">
                        <button
                          onClick={() => removeSection33Row(si, ri)}
                          className="text-slate-600 hover:text-rose-400 text-sm leading-none"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(() => {
                    const nums = s33Rows
                      .map((r) => parseFloat(r.clientScore))
                      .filter((n) => !isNaN(n));
                    const avg =
                      nums.length > 0
                        ? nums.reduce((a, b) => a + b, 0) / nums.length
                        : null;
                    return (
                      <tr className="bg-slate-800/50">
                        <td
                          colSpan={3}
                          className="border border-slate-700/40 px-2 py-1.5 text-center font-bold text-white"
                        >
                          Дундаж
                        </td>
                        <td className="border border-slate-700/40 px-1 py-1 text-center font-bold text-amber-300">
                          {avg !== null ? avg.toFixed(1) : "–"}
                        </td>
                        <td className="border border-slate-700/40 w-7"></td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
              <div className="px-3 py-1.5 bg-slate-900/40">
                <button
                  onClick={() => addSection33Row(si)}
                  className="text-[10px] text-slate-500 hover:text-blue-400 transition-colors"
                >
                  + Мөр нэмэх
                </button>
              </div>
            </div>
          );
        }

        // ── Section34Table (3.4 style) ────────────────────────────────────────
        if (sub.type === "section34table") {
          const s34Rows = sub.section34Rows ?? [];
          return (
            <div
              key={si}
              className="border border-slate-700/40 rounded-xl overflow-hidden"
            >
              <div className="bg-slate-800/80 px-3 py-2 flex items-center gap-2 border-b border-slate-700/50">
                <input
                  value={sub.id}
                  onChange={(e) => updateSub(si, "id", e.target.value)}
                  className="w-12 bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1 text-xs font-bold text-orange-300 focus:outline-none"
                />
                <input
                  value={sub.groupLabel}
                  onChange={(e) => updateSub(si, "groupLabel", e.target.value)}
                  placeholder="Хэсгийн нэр..."
                  className="flex-1 bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1 text-xs font-bold text-white focus:outline-none"
                />
                {onS34TableApiLoad && (
                  <button
                    onClick={async () => {
                      const rows = await onS34TableApiLoad(si);
                      onChange(
                        subSections.map((sub2, s) =>
                          s !== si ? sub2 : { ...sub2, section34Rows: rows },
                        ),
                      );
                    }}
                    className="text-[10px] bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 rounded px-2 py-1 transition-colors shrink-0"
                  >
                    Хувийн тайланаас татах
                  </button>
                )}
              </div>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-amber-400/30 text-amber-100">
                    <th className="border border-slate-700/40 px-2 py-1.5 text-center w-8">
                      №
                    </th>
                    <th className="border border-slate-700/40 px-2 py-1.5 text-left">
                      Dashboard
                    </th>
                    <th className="border border-slate-700/40 px-2 py-1.5 text-left">
                      Dashboard-ийн ач холбогдол хэрэглээ
                    </th>
                    <th className="border border-slate-700/40 px-2 py-1.5 text-center w-28">
                      Хэрэглэгч үнэлгээ
                    </th>
                    <th className="border border-slate-700/40 w-7"></th>
                  </tr>
                </thead>
                <tbody>
                  {s34Rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="border border-slate-700/40 px-3 py-3 text-center text-slate-600 text-[11px]"
                      >
                        Татах товч дарна уу
                      </td>
                    </tr>
                  )}
                  {s34Rows.map((row, ri) => (
                    <tr key={ri} className="border-b border-slate-700/30">
                      <td className="border border-slate-700/40 px-1 py-1 text-center text-slate-400">
                        {ri + 1}
                      </td>
                      <td className="border border-slate-700/40 px-1 py-1">
                        <textarea
                          rows={2}
                          value={row.title}
                          onChange={(e) =>
                            updateSection34Row(si, ri, "title", e.target.value)
                          }
                          placeholder="Dashboard-ийн нэр..."
                          className={taCls}
                        />
                      </td>
                      <td className="border border-slate-700/40 px-1 py-1">
                        <textarea
                          rows={2}
                          value={row.usage}
                          onChange={(e) =>
                            updateSection34Row(si, ri, "usage", e.target.value)
                          }
                          placeholder="Ач холбогдол, хэрэглээ..."
                          className={taCls}
                        />
                      </td>
                      <td className="border border-slate-700/40 px-1 py-1">
                        <input
                          value={row.clientScore}
                          onChange={(e) =>
                            updateSection34Row(
                              si,
                              ri,
                              "clientScore",
                              e.target.value,
                            )
                          }
                          placeholder="Үнэлгээ..."
                          className={`${iCls} text-center`}
                        />
                      </td>
                      <td className="border border-slate-700/40 px-1 py-1 text-center">
                        <button
                          onClick={() => removeSection34Row(si, ri)}
                          className="text-slate-600 hover:text-rose-400 text-sm leading-none"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(() => {
                    const nums = s34Rows
                      .map((r) => parseFloat(r.clientScore))
                      .filter((n) => !isNaN(n));
                    const avg =
                      nums.length > 0
                        ? nums.reduce((a, b) => a + b, 0) / nums.length
                        : null;
                    return (
                      <tr className="bg-slate-800/50">
                        <td
                          colSpan={3}
                          className="border border-slate-700/40 px-2 py-1.5 text-center font-bold text-white"
                        >
                          Дундаж
                        </td>
                        <td className="border border-slate-700/40 px-1 py-1 text-center font-bold text-amber-300">
                          {avg !== null ? avg.toFixed(1) : "–"}
                        </td>
                        <td className="border border-slate-700/40 w-7"></td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
              <div className="px-3 py-1.5 bg-slate-900/40">
                <button
                  onClick={() => addSection34Row(si)}
                  className="text-[10px] text-slate-500 hover:text-blue-400 transition-colors"
                >
                  + Мөр нэмэх
                </button>
              </div>
            </div>
          );
        }

        // ── RichTextList (2.2 style) ──────────────────────────────────────────
        if (sub.type === "richtextlist") {
          const items = sub.richTextRows ?? [];
          return (
            <div
              key={si}
              className="border border-slate-700/40 rounded-xl overflow-hidden"
            >
              <div className="bg-slate-800/80 px-3 py-2 flex items-center gap-2 border-b border-slate-700/50">
                <input
                  value={sub.id}
                  onChange={(e) => updateSub(si, "id", e.target.value)}
                  className="w-12 bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1 text-xs font-bold text-orange-300 focus:outline-none"
                />
                <input
                  value={sub.groupLabel}
                  onChange={(e) => updateSub(si, "groupLabel", e.target.value)}
                  placeholder=""
                  className="flex-1 bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1 text-xs font-bold text-white focus:outline-none"
                />
                {onS42KnowledgeApiLoad && (
                  <button
                    onClick={async () => {
                      const rows = await onS42KnowledgeApiLoad(si);
                      onChange(
                        subSections.map((sub2, s) =>
                          s !== si ? sub2 : { ...sub2, richTextRows: rows },
                        ),
                      );
                    }}
                    className="text-[10px] bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 rounded px-2 py-1 transition-colors shrink-0"
                  >
                    Хувийн тайланаас татах
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-700/30">
                {items.length === 0 && (
                  <div className="px-4 py-3 text-[11px] text-slate-600 text-center">
                    Зүйл байхгүй — &quot;+ Зүйл нэмэх&quot; товч дарна уу
                  </div>
                )}
                {items.map((item, ii) => (
                  <div key={item.id} className="px-3 py-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-orange-400 font-bold w-5 shrink-0">
                        {ii + 1}.
                      </span>
                      <input
                        value={item.title}
                        onChange={(e) =>
                          updateRichTextTitle(si, ii, e.target.value)
                        }
                        placeholder="Гарчиг..."
                        className={`${iCls} font-bold flex-1`}
                      />
                      <button
                        onClick={() => removeRichTextItem(si, ii)}
                        className="text-red-400/60 hover:text-red-400 transition text-sm leading-none shrink-0"
                        title="Зүйл устгах"
                      >
                        ×
                      </button>
                    </div>
                    <div className="pl-7 space-y-1.5">
                      {getItemContents(item).map((c, ci) => (
                        <div key={c.id} className="flex items-start gap-1.5">
                          {c.type === "bullet" ? (
                            <>
                              <span className="text-slate-500 text-xs shrink-0 mt-1.5">
                                •
                              </span>
                              <input
                                value={c.text ?? ""}
                                onChange={(e) => {
                                  const nc = getItemContents(item).map(
                                    (x, j) =>
                                      j !== ci
                                        ? x
                                        : { ...x, text: e.target.value },
                                  );
                                  updateContents(si, ii, nc);
                                }}
                                placeholder="Буллет текст..."
                                className={iCls}
                              />
                              <button
                                onClick={() =>
                                  updateContents(
                                    si,
                                    ii,
                                    getItemContents(item).filter(
                                      (_, j) => j !== ci,
                                    ),
                                  )
                                }
                                className="text-slate-600 hover:text-rose-400 text-sm leading-none shrink-0 mt-1"
                              >
                                ×
                              </button>
                            </>
                          ) : (
                            <div className="relative group flex-1">
                              <div className="flex items-start gap-1">
                                <div className="relative">
                                  <img
                                    src={c.dataUrl}
                                    alt=""
                                    className="h-16 w-auto rounded border border-slate-600/50 object-contain"
                                  />
                                  <button
                                    onClick={() =>
                                      updateContents(
                                        si,
                                        ii,
                                        getItemContents(item).filter(
                                          (_, j) => j !== ci,
                                        ),
                                      )
                                    }
                                    className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full w-4 h-4 text-[10px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    ×
                                  </button>
                                </div>
                                <input
                                  type="range"
                                  min={20}
                                  max={100}
                                  value={c.width ?? 80}
                                  onChange={(e) => {
                                    const nc = getItemContents(item).map(
                                      (x, j) =>
                                        j !== ci
                                          ? x
                                          : {
                                              ...x,
                                              width: Number(e.target.value),
                                            },
                                    );
                                    updateContents(si, ii, nc);
                                  }}
                                  className="w-16 mt-1 accent-blue-400 self-end"
                                  title={`Өргөн: ${c.width ?? 80}%`}
                                />
                                <input
                                  type="range"
                                  min={0}
                                  max={600}
                                  step={10}
                                  value={c.height ?? 0}
                                  onChange={(e) => {
                                    const nc = getItemContents(item).map(
                                      (x, j) =>
                                        j !== ci
                                          ? x
                                          : {
                                              ...x,
                                              height: Number(e.target.value),
                                            },
                                    );
                                    updateContents(si, ii, nc);
                                  }}
                                  className="w-16 mt-1 accent-purple-400 self-end"
                                  title={`Өндөр: ${c.height && c.height > 0 ? c.height + "px" : "авто"}`}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      <div className="flex items-center gap-2 pt-0.5">
                        <button
                          onClick={() =>
                            updateContents(si, ii, [
                              ...getItemContents(item),
                              {
                                id: crypto.randomUUID(),
                                type: "bullet" as const,
                                text: "",
                              },
                            ])
                          }
                          className="text-[10px] text-slate-500 hover:text-green-400 transition-colors"
                        >
                          + Буллет нэмэх
                        </button>
                        <label className="text-[10px] text-slate-500 hover:text-blue-400 transition-colors cursor-pointer">
                          + Зураг нэмэх
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              const files = Array.from(e.target.files ?? []);
                              if (!files.length) return;
                              const current = getItemContents(item);
                              let loaded = 0;
                              const appended: RichTextContent[] = [];
                              files.forEach((file) => {
                                const reader = new FileReader();
                                reader.onload = () => {
                                  appended.push({
                                    id: crypto.randomUUID(),
                                    type: "image" as const,
                                    dataUrl: reader.result as string,
                                    width: 80,
                                    height: 0,
                                  });
                                  loaded++;
                                  if (loaded === files.length)
                                    updateContents(si, ii, [
                                      ...current,
                                      ...appended,
                                    ]);
                                };
                                reader.readAsDataURL(file);
                              });
                              e.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-3 py-1.5 bg-slate-900/40">
                <button
                  onClick={() => addRichTextItem(si)}
                  className="text-[10px] text-slate-500 hover:text-blue-400 transition-colors"
                >
                  + Зүйл нэмэх
                </button>
              </div>
            </div>
          );
        }

        // ── Section42Knowledge (4.2 style) ────────────────────────────────────
        if (sub.type === "section42knowledge") {
          const s42Rows = sub.section42Rows ?? [];
          return (
            <div
              key={si}
              className="border border-slate-700/40 rounded-xl overflow-hidden"
            >
              <div className="bg-slate-800/80 px-3 py-2 flex items-center gap-2 border-b border-slate-700/50">
                <input
                  value={sub.id}
                  onChange={(e) => updateSub(si, "id", e.target.value)}
                  className="w-12 bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1 text-xs font-bold text-orange-300 focus:outline-none"
                />
                <input
                  value={sub.groupLabel}
                  onChange={(e) => updateSub(si, "groupLabel", e.target.value)}
                  placeholder="Хэсгийн нэр..."
                  className="flex-1 bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1 text-xs font-bold text-white focus:outline-none"
                />
              </div>
              <div className="divide-y divide-slate-700/30">
                {s42Rows.length === 0 && (
                  <div className="px-4 py-3 text-[11px] text-slate-600 text-center">
                    Татах товч дарна уу
                  </div>
                )}
                {s42Rows.map((row, ri) => (
                  <div key={ri} className="px-3 py-2 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        value={row.employeeName}
                        onChange={(e) =>
                          updateSection42Row(
                            si,
                            ri,
                            "employeeName",
                            e.target.value,
                          )
                        }
                        placeholder="Ажилтаны нэр..."
                        className={`${iCls} font-bold w-40 shrink-0`}
                      />
                      <button
                        onClick={() => removeSection42Row(si, ri)}
                        className="text-red-400/60 hover:text-red-400 transition text-sm leading-none shrink-0"
                      >
                        ×
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={row.text}
                      onChange={(e) =>
                        updateSection42Row(si, ri, "text", e.target.value)
                      }
                      placeholder="Мэдлэг ашиглалтын тайлбар... (шинэ мөрөөнд буллет байдлаар харагдана)"
                      className={`${iCls} min-h-[60px] resize-none`}
                    />
                  </div>
                ))}
              </div>
              <div className="px-3 py-1.5 bg-slate-900/40">
                <button
                  onClick={() => addSection42Row(si)}
                  className="text-[10px] text-slate-500 hover:text-blue-400 transition-colors"
                >
                  + Мөр нэмэх
                </button>
              </div>
            </div>
          );
        }

        // ── Section43Trainings (4.3 style) ────────────────────────────────────
        if (sub.type === "section43trainings") {
          const s43Rows = sub.section43Rows ?? [];
          return (
            <div
              key={si}
              className="border border-slate-700/40 rounded-xl overflow-hidden"
            >
              <div className="bg-slate-800/80 px-3 py-2 flex items-center gap-2 border-b border-slate-700/50">
                <input
                  value={sub.id}
                  onChange={(e) => updateSub(si, "id", e.target.value)}
                  className="w-12 bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1 text-xs font-bold text-orange-300 focus:outline-none"
                />
                <input
                  value={sub.groupLabel}
                  onChange={(e) => updateSub(si, "groupLabel", e.target.value)}
                  placeholder=""
                  className="flex-1 bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1 text-xs font-bold text-white focus:outline-none"
                />
                {onS43TrainingsApiLoad && (
                  <button
                    onClick={async () => {
                      const rows = await onS43TrainingsApiLoad(si);
                      onChange(
                        subSections.map((sub2, s) =>
                          s !== si ? sub2 : { ...sub2, section43Rows: rows },
                        ),
                      );
                    }}
                    className="text-[10px] bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 rounded px-2 py-1 transition-colors shrink-0"
                  >
                    Хувийн тайланаас татах
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-amber-400/30 text-amber-100">
                      {[
                        "Ажилтан",
                        "Сургалтын нэр",
                        "Зохион байгуулагч",
                        "Төрөл",
                        "Огноо",
                        "Хэлбэр",
                        "Цаг",
                        "Аудитын зорилготой холбогдсон",
                        "Мэдлэг хуваалцсан",
                      ].map((h) => (
                        <th
                          key={h}
                          className="border border-slate-700/40 px-2 py-1.5 text-left"
                        >
                          {h}
                        </th>
                      ))}
                      <th className="border border-slate-700/40 w-7"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {s43Rows.length === 0 && (
                      <tr>
                        <td
                          colSpan={10}
                          className="border border-slate-700/40 px-3 py-3 text-center text-slate-600 text-[11px]"
                        >
                          Татах товч дарна уу
                        </td>
                      </tr>
                    )}
                    {s43Rows.map((row, ri) => (
                      <tr key={ri} className="border-b border-slate-700/30">
                        {(
                          [
                            ["employeeName", "Ажилтан..."],
                            ["training", "Сургалт..."],
                            ["organizer", "Зохион байгуулагч..."],
                            ["type", "Төрөл..."],
                            ["date", "Огноо..."],
                            ["format", "Хэлбэр..."],
                            ["hours", "Цаг..."],
                            ["meetsAuditGoal", "Тийм/Үгүй..."],
                            ["sharedKnowledge", "Мэдлэг..."],
                          ] as [keyof Section43Row, string][]
                        ).map(([field, ph]) => (
                          <td
                            key={field}
                            className="border border-slate-700/40 px-1 py-1"
                          >
                            <AutoTextarea
                              value={row[field]}
                              onChange={(e) =>
                                updateSection43Row(
                                  si,
                                  ri,
                                  field,
                                  e.target.value,
                                )
                              }
                              placeholder={ph}
                              className={taCls}
                            />
                          </td>
                        ))}
                        <td className="border border-slate-700/40 px-1 py-1 text-center">
                          <button
                            onClick={() => removeSection43Row(si, ri)}
                            className="text-slate-600 hover:text-rose-400 text-sm leading-none"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-3 py-1.5 bg-slate-900/40">
                <button
                  onClick={() => addSection43Row(si)}
                  className="text-[10px] text-slate-500 hover:text-blue-400 transition-colors"
                >
                  + Мөр нэмэх
                </button>
              </div>
            </div>
          );
        }

        // ── Dashboard (1.2 style) ─────────────────────────────────────────────
        if (sub.type === "dashboard") {
          const dashRows = sub.dashboardRows ?? [];
          return (
            <div
              key={si}
              className="border border-slate-700/40 rounded-xl overflow-hidden"
            >
              <div className="bg-slate-800/80 px-3 py-2 flex items-center gap-2 border-b border-slate-700/50">
                <input
                  value={sub.id}
                  onChange={(e) => updateSub(si, "id", e.target.value)}
                  className="w-12 bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1 text-xs font-bold text-orange-300 focus:outline-none"
                />
                <input
                  value={sub.groupLabel}
                  onChange={(e) => updateSub(si, "groupLabel", e.target.value)}
                  placeholder="Хэсгийн нэр..."
                  className="flex-1 bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1 text-xs font-bold text-white focus:outline-none"
                />
                {onApiLoad && (
                  <button
                    onClick={async () => {
                      const rows = await onApiLoad(si);
                      onChange(
                        subSections.map((sub2, s) =>
                          s !== si ? sub2 : { ...sub2, dashboardRows: rows },
                        ),
                      );
                    }}
                    className="text-[10px] bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 rounded px-2 py-1 transition-colors shrink-0"
                  >
                    Хувийн тайланаас татах
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-700/30">
                {dashRows.length === 0 && (
                  <div className="px-4 py-4 text-center text-slate-600 text-[11px]">
                    Ажил байхгүй — "Хувийн тайланаас татах" эсвэл "+" товч дарна
                    уу
                  </div>
                )}
                {dashRows.map((row, ri) => (
                  <DashTaskCard
                    key={ri}
                    index={ri}
                    row={row}
                    onChangeTitle={(v) => updateDashRow(si, ri, "title", v)}
                    onChangeDesc={(v) =>
                      updateDashRow(si, ri, "description", v)
                    }
                    onRemove={() => removeDashRow(si, ri)}
                    onChangeImages={(imgs) => updateDashImages(si, ri, imgs)}
                  />
                ))}
              </div>
              <div className="px-3 py-1.5 bg-slate-900/40">
                <button
                  onClick={() => addDashRow(si)}
                  className="text-[10px] text-slate-500 hover:text-blue-400 transition-colors"
                >
                  + Ажил нэмэх
                </button>
              </div>
            </div>
          );
        }

        // ── KPI (1.1 style) ───────────────────────────────────────────────────
        const totalW = sub.rows.reduce(
          (s, r) => s + (Number(r.weight) || 0),
          0,
        );
        return (
          <div
            key={si}
            className="border border-slate-700/40 rounded-xl overflow-hidden"
          >
            <div className="bg-slate-800/80 px-3 py-2 flex items-center gap-2 border-b border-slate-700/50">
              <input
                value={sub.id}
                onChange={(e) => updateSub(si, "id", e.target.value)}
                className="w-12 bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1 text-xs font-bold text-orange-300 focus:outline-none"
              />
              <input
                value={sub.groupLabel}
                onChange={(e) => updateSub(si, "groupLabel", e.target.value)}
                placeholder="Хэсгийн нэр..."
                className="flex-1 bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1 text-xs font-bold text-white focus:outline-none"
              />
            </div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-amber-400/30 text-amber-100">
                  <th className="border border-slate-700/40 px-2 py-1.5 text-left">
                    ТҮЛХҮҮР ҮЗҮҮЛЭЛТ
                  </th>
                  <th className="border border-slate-700/40 px-2 py-1.5 text-center w-14">
                    ХУВЬ
                  </th>
                  <th className="border border-slate-700/40 px-2 py-1.5 text-center w-16">
                    ҮНЭЛГЭЭ
                  </th>
                  <th className="border border-slate-700/40 px-2 py-1.5 w-44">
                    ҮНЭЛСЭН ТАЙЛБАР
                  </th>
                  <th className="border border-slate-700/40 w-7"></th>
                </tr>
              </thead>
              <tbody>
                {sub.rows.map((row, ri) => (
                  <tr key={ri} className="border-b border-slate-700/30">
                    <td className="border border-slate-700/40 px-1 py-1">
                      <AutoTextarea
                        value={row.indicator}
                        onChange={(e) =>
                          updateRow(si, ri, "indicator", e.target.value)
                        }
                        placeholder="Үзүүлэлт..."
                        className={taCls}
                      />
                    </td>
                    <td className="border border-slate-700/40 px-1 py-1">
                      <input
                        type="number"
                        value={row.weight}
                        onChange={(e) =>
                          updateRow(si, ri, "weight", Number(e.target.value))
                        }
                        className={`${iCls} text-center`}
                      />
                    </td>
                    <td className="border border-slate-700/40 px-1 py-1">
                      <input
                        value={row.score}
                        onChange={(e) =>
                          updateRow(si, ri, "score", e.target.value)
                        }
                        placeholder="Оноо"
                        className={`${iCls} text-center`}
                      />
                    </td>
                    <td className="border border-slate-700/40 px-1 py-1">
                      <AutoTextarea
                        value={row.evaluatedBy}
                        onChange={(e) =>
                          updateRow(si, ri, "evaluatedBy", e.target.value)
                        }
                        className={taCls}
                      />
                    </td>
                    <td className="border border-slate-700/40 px-1 py-1 text-center">
                      <button
                        onClick={() => removeRow(si, ri)}
                        className="text-slate-600 hover:text-rose-400 text-sm leading-none"
                        title="Устгах"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-800/40">
                  <td className="border border-slate-700/40 px-2 py-1.5 text-center text-slate-400 font-bold text-[10px]">
                    Нийт
                  </td>
                  <td className="border border-slate-700/40 px-2 py-1.5 text-center font-bold text-white">
                    {totalW}
                  </td>
                  <td className="border border-slate-700/40" colSpan={3}></td>
                </tr>
              </tbody>
            </table>
            <div className="px-3 py-1.5 bg-slate-900/40">
              <button
                onClick={() => addRow(si)}
                className="text-[10px] text-slate-500 hover:text-blue-400 transition-colors"
              >
                + Мөр нэмэх
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
