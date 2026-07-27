import React from "react";
import { ImageIcon, X } from "lucide-react";
import { uid } from "./tailan.types";
import { useLanguage } from "@/contexts/LanguageContext";

export interface RowInlineImg {
  id: string;
  dataUrl: string;
  width: number;
  height?: number;
}

export function RowImageUpload({
  images,
  onChange,
  inputId,
}: {
  images: RowInlineImg[];
  onChange: (imgs: RowInlineImg[]) => void;
  inputId?: string;
}) {
  const { t } = useLanguage();
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
          height: 280,
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
    onChange(
      images.map((img) => (img.id === id ? { ...img, height: h } : img)),
    );
  return (
    <div className={inputId ? "mt-1" : "mt-2"}>
      {!inputId && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-blue-400 transition"
        >
          <ImageIcon className="h-3.5 w-3.5" />
          <span>{t("tailanRowImageAddButton")}</span>
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
            <div key={img.id} className="bg-card/50 rounded-lg p-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground/70">
                  {img.width}% {t("tailanRowImageWideSuffix")}
                  {img.height
                    ? ` · ${img.height}px ${t("tailanRowImageTallSuffix")}`
                    : ""}
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
                  height: `${img.height ?? 280}px`,
                  objectFit: "fill",
                }}
                className="rounded max-w-full"
              />
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground/50 w-10 shrink-0">
                  {t("tailanRowImageWidthLabel")}
                </span>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={img.width}
                  onChange={(e) => setWidth(img.id, Number(e.target.value))}
                  className="flex-1 accent-blue-500"
                />
                <span className="text-xs text-muted-foreground/70 w-9 text-right shrink-0">
                  {img.width}%
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground/50 w-10 shrink-0">
                  {t("tailanRowImageHeightLabel")}
                </span>
                <input
                  type="number"
                  min={50}
                  max={2000}
                  step={10}
                  value={img.height ?? 280}
                  onChange={(e) =>
                    setHeight(
                      img.id,
                      Math.max(50, Number(e.target.value) || 280),
                    )
                  }
                  className="flex-1 bg-card border border-border rounded px-2 py-0.5 text-xs text-foreground/80 placeholder-muted-foreground/40"
                />
                <span className="text-xs text-muted-foreground/70 w-9 shrink-0">
                  px
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
