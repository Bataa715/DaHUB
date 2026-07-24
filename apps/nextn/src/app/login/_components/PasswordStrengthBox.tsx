"use client";

import { Check, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TranslationKey } from "@/contexts/LanguageContext";
import type { PasswordChecks } from "./login.types";

const CHECKS: { key: keyof PasswordChecks; labelKey: TranslationKey }[] = [
  { key: "minLength", labelKey: "pwStrengthMinLength" },
  { key: "hasLower", labelKey: "pwStrengthLower" },
  { key: "hasUpper", labelKey: "pwStrengthUpper" },
  { key: "hasNumber", labelKey: "pwStrengthNumber" },
  { key: "hasSpecial", labelKey: "pwStrengthSpecial" },
];

export function PasswordStrengthBox({ checks }: { checks: PasswordChecks }) {
  const { t } = useLanguage();
  return (
    <div className="space-y-2 p-4 bg-muted/50 border border-border/50 rounded-xl">
      <p className="text-xs text-muted-foreground mb-2">
        {t("pwStrengthReqTitle")}
      </p>
      {CHECKS.map(({ key, labelKey }) => (
        <div key={key} className="flex items-center gap-2">
          {checks[key] ? (
            <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          ) : (
            <X className="w-4 h-4 text-muted-foreground/60" />
          )}
          <span
            className={`text-sm ${checks[key] ? "text-emerald-500 dark:text-emerald-400" : "text-muted-foreground/70"}`}
          >
            {t(labelKey)}
          </span>
        </div>
      ))}
    </div>
  );
}
