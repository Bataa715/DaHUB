import React from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { DashboardRow } from "../_types";

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
  const { t } = useLanguage();
  const iCls =
    "w-full bg-muted/60 border border-border/50 rounded px-2 py-1 text-xs text-foreground placeholder-muted-foreground/40 focus:outline-none focus:border-blue-500/60";

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
          height: 280,
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
    <div className="bg-muted/20">
      {/* Collapsed row */}
      <div
        className="flex items-center gap-2 px-2.5 py-2 cursor-pointer hover:bg-muted/40 transition select-none"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-xs text-muted-foreground/70 w-5 shrink-0 text-center">
          {index + 1}
        </span>
        <span className="flex-1 text-xs font-semibold text-foreground truncate">
          {row.title || (
            <span className="font-normal text-muted-foreground/70">
              {t("tailan_taskNamePlaceholder")}
            </span>
          )}
        </span>
        {(row.images ?? []).length > 0 && (
          <span className="text-[9px] text-muted-foreground/70">
            {row.images!.length} {t("tailan_imagesCount")}
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
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
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
        <div className="px-3 pb-3 space-y-2 border-t border-border/40">
          <div className="pt-2">
            <label className="block text-[10px] text-muted-foreground mb-1">
              {t("tailan_taskNameLabel")}
            </label>
            <input
              value={row.title}
              onChange={(e) => onChangeTitle(e.target.value)}
              placeholder={t("tailan_taskNamePlaceholder")}
              className={iCls + " font-bold"}
            />
          </div>
          <div>
            <label className="block text-[10px] text-muted-foreground mb-1">
              {t("tailan_taskResultLabel")}
            </label>
            <textarea
              rows={4}
              value={row.description}
              onChange={(e) => onChangeDesc(e.target.value)}
              placeholder={t("tailan_taskDetailedPlaceholder")}
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
                    className="h-14 rounded border border-border/50 object-cover shrink-0"
                  />
                  <div className="flex flex-col gap-1 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground w-10 shrink-0">
                        {t("tailan_widthLabel")}
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
                      <span className="text-[10px] text-foreground/80 w-7">
                        {img.width ?? 80}%
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground w-10 shrink-0">
                        {t("tailan_heightLabel")}
                      </span>
                      <input
                        type="range"
                        min={50}
                        max={600}
                        step={10}
                        value={img.height ?? 280}
                        onChange={(e) =>
                          handleHeightChange(img.id, Number(e.target.value))
                        }
                        className="w-20 accent-purple-400"
                      />
                      <span className="text-[10px] text-foreground/80 w-12">
                        {`${img.height ?? 280}px`}
                      </span>
                    </div>
                  </div>
                  {onChangeImages && (
                    <button
                      onClick={() => handleDeleteImage(img.id)}
                      className="text-muted-foreground/50 hover:text-rose-400 text-sm leading-none opacity-0 group-hover:opacity-100 transition-opacity"
                      title={t("tailan_deleteAction")}
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
                className="text-[10px] text-muted-foreground/70 hover:text-blue-400 transition-colors"
              >
                {t("tailan_addImage")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
