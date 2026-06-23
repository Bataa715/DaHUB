"use client";

import { motion } from "framer-motion";
import Image from "next/image";

/** Login / Register хуудсын нийтлэг brand + card wrapper */
export function LoginBrandHeader() {
  return (
    <div className="flex flex-col items-center mb-7 text-center">
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
        className="login-logo-wrap inline-flex items-center justify-center w-[4.5rem] h-[4.5rem] rounded-2xl mb-4 overflow-hidden"
      >
        <Image
          src="/golomt.jpg"
          alt="Golomt Logo"
          width={72}
          height={72}
          priority
          className="object-contain p-1"
        />
      </motion.div>
      <h1 className="login-brand-title">DaHUB</h1>
      <p className="login-brand-subtitle mt-1.5">
        Дотоод аудитын систем
      </p>
    </div>
  );
}

export function LoginAmbientBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <motion.div
        className="login-ambient login-ambient-a absolute -top-1/3 -right-1/4 w-[80%] h-[80%] rounded-full blur-3xl"
        animate={{ x: [0, -60, 0], y: [0, 40, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="login-ambient login-ambient-b absolute -bottom-1/3 -left-1/4 w-[75%] h-[75%] rounded-full blur-3xl"
        animate={{ x: [0, 50, 0], y: [0, -30, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="login-ambient-grid absolute inset-0 opacity-[0.35] dark:opacity-[0.2]" />
    </div>
  );
}

export function LoginCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`login-card-border relative p-[1.5px] rounded-3xl shadow-premium-xl ${className}`}>
      <div className="login-card-inner bg-card rounded-[22px] p-8">{children}</div>
    </div>
  );
}

export const loginInputClass =
  "h-12 rounded-xl bg-muted/60 border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/30";

export const loginLabelClass =
  "text-sm font-semibold text-foreground flex items-center gap-2";

export const loginIconBoxClass =
  "login-icon-box w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-premium text-white";

export const loginSubmitBtnClass =
  "w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold shadow-premium hover:shadow-premium-lg hover:bg-primary/90 transition-all duration-300";
