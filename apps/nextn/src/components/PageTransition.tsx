"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const WRAPPER_CLASS =
  "flex flex-col flex-1 min-h-0 min-w-0 w-full max-w-full overflow-x-hidden";

// easeOutExpo — квант шинжтэй, эхэндээ түргэн дараа нь зөөлөн буудаг муруй.
const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;

/**
 * PageTransition — хуудас хооронд шилжихэд зөөлөн crossfade + slide + settle-scale.
 * AnimatePresence mode="wait" — хуучин хуудас богинохон гарч байж шинэ нь орж ирнэ
 * (давхцахгүй тул layout үсрэлтгүй). transform + opacity-г л animate хийдэг тул
 * GPU дээр гөлгөр (60fps), том хүснэгттэй хуудсанд ч reflow үүсгэхгүй.
 * SSR/hydration-д motion state зөрөхгүй — эхний paint static, reduced-motion-д хөдөлгөөнгүй.
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

  if (!mounted) {
    return <div className={WRAPPER_CLASS}>{children}</div>;
  }

  if (reduceMotion) {
    return (
      <div key={pathname} className={WRAPPER_CLASS}>
        {children}
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 10, scale: 0.994 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.994 }}
        transition={{
          duration: 0.34,
          ease: EASE_OUT,
          exit: { duration: 0.16, ease: EASE_IN },
        }}
        style={{ willChange: "transform, opacity" }}
        className={WRAPPER_CLASS}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
