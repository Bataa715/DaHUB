"use client";

import { useEffect, useState } from "react";
import {
  tailanApi,
  getApiErrorMessage,
  type TailanReportPayload,
} from "@/lib/api";
import { DocxBlobViewer } from "./DocxBlobViewer";

// ─── Real .docx preview ──────────────────────────────────────────────────────
// Renders the ACTUAL generated .docx (via /tailan/preview) using docx-preview,
// so what the user sees while editing is byte-for-byte the same document
// they'll download — no more separate hand-drawn HTML "Word simulator" that
// can drift out of sync with the real export.
export function RealDocxPreview({
  payload,
  debounceMs = 600,
}: {
  payload: TailanReportPayload;
  debounceMs?: number;
}) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const payloadKey = JSON.stringify(payload);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const b = await tailanApi.previewWord(payload);
        if (cancelled) return;
        setBlob(b);
        setError("");
      } catch (err: unknown) {
        if (!cancelled) {
          setError(getApiErrorMessage(err) || "Preview үүсгэхэд алдаа гарлаа");
        }
      } finally {
        if (!cancelled) setLoading(false);
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
