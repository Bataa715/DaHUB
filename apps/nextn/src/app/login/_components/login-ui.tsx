"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { GolomtMark } from "@/components/GolomtMark";
import { cn } from "@/lib/utils";

// Хоёр хуваалттай бүтэц нь админ нэвтрэх хуудастай дундын тул shared-д байрлана.
export { AuthSplitShell as LoginSplitShell } from "@/components/shared/AuthSplitShell";

export function LoginCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("relative", className)}>{children}</div>;
}

export const loginInputClass =
  "h-12 rounded-md border-border bg-muted/40 text-foreground placeholder:text-muted-foreground/70 transition-colors duration-200 hover:border-foreground/30 focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/20";

export const loginLabelClass =
  "text-sm font-semibold text-foreground flex items-center gap-2 mb-1.5";

/** Алхам бүрийн гарчгийн дээрх Голомт тэмдэг — банкны өнгөт градиент дээр. */
export function LoginStepLogo() {
  return (
    <div className="mb-6 flex justify-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-600 to-violet-700 text-white shadow-lg shadow-indigo-500/25">
        <GolomtMark className="h-9 w-9" />
      </span>
    </div>
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
      className={cn(
        "inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 px-4 text-sm font-semibold tracking-wide text-white shadow-md shadow-indigo-500/20 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}
