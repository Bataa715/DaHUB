"use client";

import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Глобал route loading UI — хуудасны chunk ачаалагдах хооронд
 * шууд харагдах тул шилжилт гацаагүй, зөөлөн мэдрэгдэнэ.
 */
export default function Loading() {
  const { t } = useLanguage();
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary"
        role="status"
        aria-label={t("loadingPageText")}
      />
    </div>
  );
}
