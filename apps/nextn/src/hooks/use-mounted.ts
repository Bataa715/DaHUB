"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * Клиент дээр hydration дууссан эсэх. Сервер болон hydration-ы үед `false`,
 * дараа нь `true` — portal, localStorage зэрэг зөвхөн хөтөчид байдаг зүйлийг
 * hydration mismatch-гүй харуулахад.
 *
 * `useEffect(() => setMounted(true), [])` загварын оронд — тэр нь mount бүрт
 * нэмэлт render хийлгэдэг ба React Compiler-ийн `set-state-in-effect` дүрмийг зөрчдөг.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
