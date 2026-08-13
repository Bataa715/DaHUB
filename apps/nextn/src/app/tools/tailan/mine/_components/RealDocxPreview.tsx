"use client";

import { useEffect, useRef, useState } from "react";
import {
  tailanApi,
  getApiErrorMessage,
  type TailanReportPayload,
} from "@/lib/api";
import { DocxBlobViewer } from "./DocxBlobViewer";
import { useLanguage } from "@/contexts/LanguageContext";

// ─── Real .docx preview ──────────────────────────────────────────────────────
// Renders the ACTUAL generated .docx (via /tailan/preview) using docx-preview.
// Typing үед хуучин preview-г хадгалж, зөвхөн debounce-ийн дараа silent шинэчилнэ
// — «Ачааллаж байна» текст/цаас доошлохгүй.
export function RealDocxPreview({
  payload,
  debounceMs = 800,
}: {
  payload: TailanReportPayload;
  debounceMs?: number;
}) {
  const { t } = useLanguage();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const payloadKey = JSON.stringify(payload);
  const requestIdRef = useRef(0);
  const hasBlobRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const requestId = ++requestIdRef.current;
    // Зөвхөн анхны удаа (blob байхгүй) loading=true — дахин generate layout-ыг бүү эвд
    if (!hasBlobRef.current) setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const b = await tailanApi.previewWord(payload);
        if (cancelled || requestId !== requestIdRef.current) return;
        setBlob(b);
        hasBlobRef.current = true;
        setError("");
      } catch (err: unknown) {
        if (!cancelled && requestId === requestIdRef.current) {
          setError(
            getApiErrorMessage(err) || t("tailanRealPreviewGenerateError"),
          );
        }
      } finally {
        if (!cancelled && requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payloadKey]);

  return <DocxBlobViewer blob={blob} loading={loading} error={error} />;
}
