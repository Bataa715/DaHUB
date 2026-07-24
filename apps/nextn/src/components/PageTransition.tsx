"use client";

import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const WRAPPER_CLASS =
  "flex flex-col flex-1 min-h-0 min-w-0 w-full max-w-full overflow-x-hidden";

/**
 * PageTransition — хуудас хооронд шилжихэд зөөлөн fade + slide animation өгнө.
 * SSR/hydration-д motion initial state зөрөхгүй — эхний paint static, дараа нь animate.
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

  return (
    <motion.div
      key={pathname}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={WRAPPER_CLASS}
    >
      {children}
    </motion.div>
  );
}
