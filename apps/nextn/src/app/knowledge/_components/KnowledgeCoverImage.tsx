"use client";

import { useEffect, useState } from "react";
import { knowledgeApi } from "@/lib/api";
import { cn } from "@/lib/utils";

type KnowledgeCoverImageProps = {
  /** Backend-ээс ирсэн path, ж: `/medleg/:id/image` */
  path?: string;
  alt: string;
  className?: string;
  /** fill parent (absolute inset-0) */
  fill?: boolean;
};

/**
 * Мэдлэгийн зураг — deploy-д Next server→backend proxy бүтэлгүйтдэг тул
 * browser-ээс шууд authenticated API-аар татна (нүүр/auth-тай ижил).
 */
export function KnowledgeCoverImage({
  path,
  alt,
  className,
  fill,
}: KnowledgeCoverImageProps) {
  // Аль path-ийн зураг болохыг хамт хадгална — path солигдоход хуучин зураг
  // харагдахгүй (effect дотор setState-ээр цэвэрлэхийн оронд render үед тооцно).
  const [loaded, setLoaded] = useState<{
    path?: string;
    src: string | null;
    failed: boolean;
  }>({ src: null, failed: false });
  const current = loaded.path === path ? loaded : { src: null, failed: false };
  const { src, failed } = current;

  useEffect(() => {
    if (!path) return;
    let objectUrl: string | null = null;
    let cancelled = false;

    knowledgeApi
      .fetchImageObjectUrl(path)
      .then((url) => {
        if (cancelled) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        if (!url) {
          setLoaded({ path, src: null, failed: true });
          return;
        }
        objectUrl = url;
        setLoaded({ path, src: url, failed: false });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ path, src: null, failed: true });
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (failed || !path) return null;
  if (!src) {
    return (
      <div
        className={cn(
          "bg-muted animate-pulse",
          fill ? "absolute inset-0" : "w-full h-full",
          className,
        )}
        aria-hidden
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={cn(
        fill ? "absolute inset-0 h-full w-full object-cover" : "object-cover",
        className,
      )}
      decoding="async"
      draggable={false}
    />
  );
}
