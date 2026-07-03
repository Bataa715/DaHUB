"use client";

import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";

/**
 * PageTransition — хуудас хооронд шилжихэд зөөлөн fade + slide animation өгнө.
 * `key={pathname}` тул чиглэл солигдох бүрт дахин mount хийгдэж animation тоглоно.
 * Хөдөлгөөн багасгах (prefers-reduced-motion) тохиргоог хүндэтгэнэ.
 */
export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      key={pathname}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col flex-1 min-w-0 w-full max-w-full overflow-x-hidden"
    >
      {children}
    </motion.div>
  );
}
