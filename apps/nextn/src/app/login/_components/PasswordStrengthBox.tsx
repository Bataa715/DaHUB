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
    <div className="space-y-2 p-4 bg-slate-800/50 rounded-xl">
      <p className="text-xs text-slate-400 mb-2">Нууц үгийн шаардлага:</p>
      {CHECKS.map(({ key, label }) => (
        <div key={key} className="flex items-center gap-2">
          {checks[key] ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : (
            <X className="w-4 h-4 text-slate-500" />
          )}
          <span
            className={`text-sm ${checks[key] ? "text-emerald-400" : "text-slate-500"}`}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
