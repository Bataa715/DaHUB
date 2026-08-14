"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Plus, Trash2, ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { getApiErrorMessage } from "@/lib/api";
import { loadTeamGallery } from "@/app/_components/team-gallery";

type Slide = { id: string; src: string; alt: string };

export function TeamGalleryAdmin() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const slides = await loadTeamGallery();
      setSlides(slides);
    } catch (e: unknown) {
      toast({
        title: t("error"),
        description: getApiErrorMessage(e),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    load();
  }, [load]);

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/team-gallery", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { slides?: Slide[] };
      setSlides(Array.isArray(data.slides) ? data.slides : []);
      toast({ title: t("admTeamPhotoAdded") });
    } catch (e: unknown) {
      toast({
        title: t("error"),
        description: getApiErrorMessage(e),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onDelete = async (slide: Slide) => {
    if (!confirm(`"${slide.id}" ${t("admTeamPhotoDeleteConfirm")}`)) return;
    setBusyId(slide.id);
    try {
      const res = await fetch(
        `/team-gallery/${encodeURIComponent(slide.id)}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { slides?: Slide[] };
      setSlides(Array.isArray(data.slides) ? data.slides : []);
      toast({ title: t("admTeamPhotoDeleted") });
    } catch (e: unknown) {
      toast({
        title: t("error"),
        description: getApiErrorMessage(e),
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="mt-10 pt-8 border-t border-border/60">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {t("admTeamGalleryTitle")}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("admTeamGalleryIntro")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          {t("admTeamPhotoAddBtn")}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0])}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : slides.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground/50">
          <ImageIcon className="w-8 h-8 opacity-50" />
          <p className="text-sm">{t("admTeamGalleryEmpty")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {slides.map((s) => (
            <div
              key={s.id}
              className="relative group rounded-xl border border-border overflow-hidden bg-muted/30 aspect-[16/9]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.src}
                alt={s.alt}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => onDelete(s)}
                disabled={busyId === s.id}
                className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-background/80 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-40"
                title={t("tailan_deleteAction")}
              >
                {busyId === s.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
              </button>
              <p className="absolute bottom-0 inset-x-0 px-2 py-1 text-[10px] truncate bg-background/70 text-muted-foreground">
                {s.id}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
