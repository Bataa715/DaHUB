"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import type { ButtonHTMLAttributes, ReactNode } from "react";
/** Login / Register хуудсын нийтлэг brand + card wrapper */
export function LoginBrandHeader() {
  return (
    <div className="flex flex-col items-center mb-6 text-center">
      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="login-brand-title text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent"
      >
        DaHUB
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="login-brand-subtitle mt-2 text-sm font-medium text-muted-foreground tracking-wide"
      >
        Дотоод аудитын систем
      </motion.p>

      <motion.div
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: 40, opacity: 1 }}
        transition={{ delay: 0.35, duration: 0.6, ease: "easeOut" }}
        className="h-[3px] mt-4 rounded-full bg-gradient-to-r from-primary/40 via-primary to-primary/40"
      />
    </div>
  );
}

export function LoginAmbientBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <motion.div
        className="login-ambient login-ambient-a absolute -top-1/3 -right-1/4 w-[80%] h-[80%] rounded-full blur-3xl"
        animate={{ x: [0, -60, 0], y: [0, 40, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="login-ambient login-ambient-b absolute -bottom-1/3 -left-1/4 w-[75%] h-[75%] rounded-full blur-3xl"
        animate={{ x: [0, 50, 0], y: [0, -30, 0], scale: [1, 1.05, 1] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Нэмэлт гурав дахь, маш зөөлөн өнгийн толбо — гүн рашаар */}
      <motion.div
        className="absolute top-1/2 left-1/2 w-[50%] h-[50%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl"
        animate={{ opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="login-ambient-grid absolute inset-0 opacity-[0.35] dark:opacity-[0.2]" />
      {/* Дээд талд маш нарийн vignette, card-ыг "тогтож" харагдуулна */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/40" />
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
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className={`login-card-border relative p-[1.5px] rounded-3xl shadow-premium-xl ${className}`}
    >
      <div className="login-card-inner relative bg-card rounded-[22px] p-8 overflow-hidden">
        {/* Дотор талын дээд ирмэгт нарийн highlight шугам — "шил" мэт мэдрэмж */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
        {children}
      </div>
    </motion.div>
  );
}

export const loginInputClass =
  "h-12 rounded-xl bg-muted/50 border-border/80 text-foreground placeholder:text-muted-foreground/70 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50 hover:border-border";

export const loginLabelClass =
  "text-sm font-semibold text-foreground flex items-center gap-2 mb-1.5";

export function LoginStepLogo() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, rotateX: 18 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 18, delay: 0.08 }}
      className="relative mx-auto mb-5 w-[4.5rem] h-[4.5rem] [perspective:600px]"
    >
      {/* Гадна glow */}
      <div className="login-step-logo-glow absolute -inset-2 rounded-[1.35rem] blur-md opacity-80" />

      {/* 3D frame */}
      <div className="login-step-logo-frame relative h-full w-full rounded-[1.15rem] p-[2px]">
        <div className="login-step-logo-surface relative flex h-full w-full items-center justify-center overflow-hidden rounded-[1rem]">
          {/* Дээд highlight — гүн мэдрэмж */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/55 to-transparent dark:from-white/12" />
          <div className="pointer-events-none absolute inset-x-3 bottom-1 h-px bg-gradient-to-r from-transparent via-black/10 to-transparent dark:via-white/15" />

          <Image
            src="/golomt.jpg"
            alt="Golomt Logo"
            width={52}
            height={52}
            className="relative z-10 object-contain p-1.5 drop-shadow-[0_6px_10px_rgba(0,0,0,0.22)]"
          />
        </div>
      </div>

      {/* Доод тень — "сууж" байгаа мэт */}
      <div className="login-step-logo-shadow absolute -bottom-2 left-1/2 h-3 w-[70%] -translate-x-1/2 rounded-full blur-md" />
    </motion.div>
  );
}

export function LoginSubmitButton({
  children,
  disabled,
  type = "submit",
  className = "",
}: {
  children: ReactNode;
  disabled?: boolean;
  type?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
  className?: string;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`login-submit-btn group relative w-full disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      <div className="login-submit-btn-glow absolute -inset-1 rounded-[0.95rem] blur-md opacity-70 transition-opacity group-hover:opacity-100 group-disabled:opacity-30" />
      <div className="login-submit-btn-frame relative rounded-xl p-[2px] transition-transform duration-200 group-hover:-translate-y-0.5 group-active:translate-y-0 group-active:scale-[0.98] group-disabled:translate-y-0 group-disabled:scale-100">
        <div className="login-submit-btn-surface relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-[0.65rem] px-4 text-sm font-semibold">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/55 to-transparent dark:from-white/12" />
          <div className="pointer-events-none absolute inset-x-4 bottom-1 h-px bg-gradient-to-r from-transparent via-black/10 to-transparent dark:via-white/15" />
          <span className="relative z-10 flex items-center gap-2">{children}</span>
        </div>
      </div>
      <div className="login-submit-btn-shadow absolute -bottom-1.5 left-1/2 h-2.5 w-[88%] -translate-x-1/2 rounded-full blur-md transition-opacity group-hover:opacity-90 group-disabled:opacity-20" />
    </button>
  );
}

export const loginIconBoxClass =
  "login-icon-box relative w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-premium text-white before:absolute before:inset-0 before:rounded-2xl before:bg-white/10 before:opacity-0 hover:before:opacity-100 before:transition-opacity";