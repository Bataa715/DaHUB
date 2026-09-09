"use client";

import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Хэрэглэгч үйлдлийн систем дээрээ "хөдөлгөөнийг багасгах" сонголтыг
 * идэвхжүүлсэн эсэх.
 *
 * ⚠️ Яагаад framer-motion-ий `useReducedMotion()`-ыг ашиглахгүй байна вэ:
 * тэр хук нь илрүүлмэгцээ `console.warn("You have Reduced Motion enabled on
 * your device…")` гэж бичдэг ба энэ нь dev горимоор хязгаарлагдаагүй —
 * production дээр ч уг тохиргоотой хэрэглэгч бүрийн консолыг бохирдуулна.
 * Бид сонголтыг зөв хүндэтгэдэг тул анхааруулах шаардлагагүй.
 *
 * SSR болон hydration-ы үед `false` буцаана — сервер дээр хэрэглэгчийн
 * тохиргоо мэдэгдэхгүй тул зөрүү (hydration mismatch) гаргахгүйн тулд.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mql = window.matchMedia(QUERY);
    setReduced(mql.matches);

    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);

    // Safari 13 ба түүнээс өмнөх хувилбарт addEventListener байхгүй.
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);

  return reduced;
}
