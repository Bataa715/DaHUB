"use client";

import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const WRAPPER_CLASS =
  "flex flex-col flex-1 min-h-0 min-w-0 w-full max-w-full overflow-x-hidden";

// easeOutExpo — эхэндээ түргэн, дараа нь зөөлөн буудаг муруй.
const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/**
 * PageTransition — хуудас хооронд шилжихэд зөөлөн fade + slide + settle-scale.
 *
 * Зөвхөн ENTER animation (AnimatePresence/exit ашиглахгүй). App Router-т
 * `children` нь nested layout-той (жишээ нь Alert Box өөрийн layout.tsx-тэй)
 * үед AnimatePresence mode="wait" нь хуучин subtree-г exit хийх зуур шинэ route-ийн
 * контент доор нь солигдож, "Rendered more hooks than during the previous render"
 * алдаа өгдөг. Тиймээс key={pathname}-тэй энгийн enter-only motion.div ашиглана —
 * App Router-т найдвартай, transform+opacity-г л animate хийдэг тул GPU дээр гөлгөр.
 * SSR/hydration-д static, reduced-motion-д хөдөлгөөнгүй.
 */
export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || reduceMotion) {
    return <div className={WRAPPER_CLASS}>{children}</div>;
  }

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 10, scale: 0.994 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.32, ease: EASE_OUT }}
      style={{ willChange: "transform, opacity" }}
      className={WRAPPER_CLASS}
    >
      {children}
    </motion.div>
  );
}
