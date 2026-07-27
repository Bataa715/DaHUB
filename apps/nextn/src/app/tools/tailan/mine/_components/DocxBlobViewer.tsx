"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

// ─── Renders an already-fetched .docx Blob using docx-preview ─────────────
// Shared by the live editor preview (RealDocxPreview, built from an unsaved
// draft) and read-only viewers (e.g. dept head viewing a submitted member's
// report) — both cases just need "render this .docx blob as HTML".
export function DocxBlobViewer({
  blob,
  loading,
  error,
}: {
  blob: Blob | null;
  loading?: boolean;
  error?: string;
}) {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState("");

  useEffect(() => {
    if (!blob || !containerRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const { renderAsync } = await import("docx-preview");
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = "";
        await renderAsync(blob, containerRef.current, undefined, {
          className: "docx-preview",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          breakPages: true,
          experimental: true,
        });
        setRenderError("");
      } catch {
        if (!cancelled) setRenderError(t("tailanDocxViewerRenderError"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [blob]);

  return (
    <div className="relative h-full overflow-auto bg-muted/20">
      {loading && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("loading")}
        </div>
      )}
      {(error || renderError) && (
        <div className="p-4 text-sm text-red-400">{error || renderError}</div>
      )}
      <div ref={containerRef} className="docx-preview-container p-4" />
    </div>
  );
}
