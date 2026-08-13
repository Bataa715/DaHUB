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
  const outerRef = useRef<HTMLDivElement>(null);
  const scaleLayerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef(0);
  const [renderError, setRenderError] = useState("");
  const [scale, setScale] = useState(1);
  const [layout, setLayout] = useState<{
    width?: number;
    height?: number;
  }>({});
  const [renderVersion, setRenderVersion] = useState(0);

  const hasContent = !!blob;
  // Зөвхөн анхны ачаалал дээр spinner; дахин render үед юу ч харуулахгүй
  const showInitialLoading = !!loading && !hasContent;

  useEffect(() => {
    if (!blob || !containerRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        if (outerRef.current) {
          scrollTopRef.current = outerRef.current.scrollTop;
        }
        const { renderAsync } = await import("docx-preview");
        if (cancelled) return;
        // Хуучин preview-г арилгахгүй — шинэ render дууссаны дараа солино
        const temp = document.createElement("div");
        await renderAsync(blob, temp, undefined, {
          className: "docx-preview",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          breakPages: true,
          experimental: true,
        });
        if (cancelled || !containerRef.current) return;
        containerRef.current.replaceChildren(...Array.from(temp.childNodes));
        setRenderError("");
        setRenderVersion((v) => v + 1);
        requestAnimationFrame(() => {
          if (outerRef.current) {
            outerRef.current.scrollTop = scrollTopRef.current;
          }
        });
      } catch {
        if (!cancelled) setRenderError(t("tailanDocxViewerRenderError"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [blob, t]);

  // A4 / docx хуудсыг контейнерийн өргөнд багтааж scale хийнэ (хөндлөн scrollгүй)
  useEffect(() => {
    const outer = outerRef.current;
    const layer = scaleLayerRef.current;
    if (!outer || !layer) return;

    const update = () => {
      const available = Math.max(120, outer.clientWidth);
      const naturalW = Math.max(layer.scrollWidth, 1);
      const next = Math.min(1, available / naturalW);
      const rounded = Math.round(next * 1000) / 1000;
      setScale(rounded);
      setLayout({
        width: Math.ceil(naturalW * rounded),
        height: Math.ceil(layer.scrollHeight * rounded),
      });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(outer);
    ro.observe(layer);
    return () => ro.disconnect();
  }, [blob, renderVersion]);

  return (
    <div
      ref={outerRef}
      className="relative h-full min-w-0 w-full max-w-full overflow-y-auto overflow-x-hidden"
      style={{ background: "#d8d8d8", minHeight: "100%" }}
    >
      {/* Flatten docx-preview's nested gray wrapper so it matches dept WordPreview */}
      <style>{`
        .docx-preview-container .docx-wrapper {
          background: transparent !important;
          padding: 12px 0 20px !important;
          display: flex !important;
          flex-flow: column !important;
          align-items: center !important;
        }
        .docx-preview-container .docx-wrapper > section.docx {
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12) !important;
          margin-bottom: 20px !important;
          border: none !important;
        }
      `}</style>

      {showInitialLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#d8d8d8]/80">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {(error || renderError) && (
        <div className="p-4 text-sm text-red-400">{error || renderError}</div>
      )}

      <div
        className="relative mx-auto overflow-hidden"
        style={{
          width: layout.width,
          height: layout.height,
          maxWidth: "100%",
        }}
      >
        <div
          ref={scaleLayerRef}
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            width: "max-content",
            maxWidth: "none",
          }}
        >
          <div ref={containerRef} className="docx-preview-container" />
        </div>
      </div>
    </div>
  );
}
