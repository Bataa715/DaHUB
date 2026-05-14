"use client";

import { Check, X } from "lucide-react";
import type { PasswordChecks } from "./login.types";

const CHECKS: { key: keyof PasswordChecks; label: string }[] = [
  { key: "minLength", label: "8+ тэмдэгт" },
  { key: "hasLower", label: "Жижиг үсэг (a-z)" },
  { key: "hasUpper", label: "Том үсэг (A-Z)" },
  { key: "hasNumber", label: "Тоо (0-9)" },
  { key: "hasSpecial", label: "Тусгай тэмдэгт (@$!%*?&#)" },
];

export function PasswordStrengthBox({ checks }: { checks: PasswordChecks }) {
  return (
    <div className="space-y-2 p-4 bg-muted/50 border border-border/50 rounded-xl">
      <p className="text-xs text-muted-foreground mb-2">
        Нууц үгийн шаардлага:
      </p>
      {CHECKS.map(({ key, label }) => (
        <div key={key} className="flex items-center gap-2">
          {checks[key] ? (
            <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          ) : (
            <X className="w-4 h-4 text-muted-foreground/60" />
          )}
          <span
            className={`text-sm ${checks[key] ? "text-emerald-500 dark:text-emerald-400" : "text-muted-foreground/70"}`}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
