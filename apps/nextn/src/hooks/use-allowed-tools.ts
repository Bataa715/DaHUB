"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usersApi } from "@/lib/api";

function normalizeTools(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  // Edge case: allowedTools JSON string хэлбэрээр ирж болно
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Хэрэглэгчийн хэрэгслийн эрх. JWT доторх claim хуучирсан байж болох тул DB-ээс
 * шинээр уншина. Админ бүх хэрэгслийг харна (backend ToolGuard-тай ижил дүрэм).
 * UI-г цэгцлэх зорилготой — жинхэнэ хамгаалалт нь proxy.ts + backend @RequireTools.
 */
export function useAllowedTools() {
  const { user, loading: authLoading } = useAuth();
  const [tools, setTools] = useState<string[] | null>(null);
  const isAdmin = !!user?.isAdmin || !!user?.isSuperAdmin;

  useEffect(() => {
    if (!user || isAdmin) return;
    let cancelled = false;
    usersApi
      .getOne(user.id)
      .then((fresh) => {
        if (!cancelled) setTools(normalizeTools(fresh?.allowedTools));
      })
      .catch(() => {
        if (!cancelled) setTools(normalizeTools(user.allowedTools));
      });
    return () => {
      cancelled = true;
    };
  }, [user, isAdmin]);

  const canAccess = (ids: string[]) =>
    isAdmin || (tools ?? []).some((id) => ids.includes(id));

  return {
    loading: authLoading || (!!user && !isAdmin && tools === null),
    canAccess,
  };
}
