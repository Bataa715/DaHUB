"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

/**
 * Хэл солих товч — dark/light товчтой ижил хэлбэр. Зөвхөн нүүр хуудсанд
 * харагдана, гэхдээ сонголт нь бүх хуудсанд үйлчилнэ.
 */
export function LanguageQuickToggle({
  tone = "glass",
  className,
}: {
  /** glass — бараан толгой дээр; plain — theme-ийн дэвсгэр дээр */
  tone?: "glass" | "plain";
  className?: string;
}) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <button
      type="button"
      onClick={() => setLanguage(language === "mn" ? "en" : "mn")}
      aria-label={t("sidebarChangeLanguage")}
      title={t("sidebarChangeLanguage")}
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2",
        tone === "glass"
          ? "bg-white/10 text-white hover:bg-white/20 focus-visible:ring-white/60"
          : "bg-muted text-foreground hover:bg-muted/70 focus-visible:ring-ring",
        className,
      )}
    >
      {language === "mn" ? "МН" : "EN"}
    </button>
  );
}
