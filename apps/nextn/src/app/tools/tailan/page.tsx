"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { tailanApi } from "@/lib/api";
import { ArrowLeft, Loader2 } from "lucide-react";

const QUARTER_NAMES = ["I", "II", "III", "IV"];

type MenuItem = {
  labelKey: "tailan_myReport" | "tailan_deptReport" | "tailan_membersView";
  href: string;
};

export default function TailanPage() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const [isDeptHead, setIsDeptHead] = useState(false);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const year = now.getFullYear();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  const qLabel = QUARTER_NAMES[quarter - 1];
  const quarterLabel =
    language === "en"
      ? `${year} · Q${quarter}`
      : `${year} · ${qLabel}-р улирал`;

  useEffect(() => {
    tailanApi
      .getRole()
      .then((r) => setIsDeptHead(r.isDeptHead))
      .catch(() => setIsDeptHead(false))
      .finally(() => setLoading(false));
  }, []);

  const items: MenuItem[] = [
    { labelKey: "tailan_myReport", href: "/tools/tailan/mine" },
    ...(isDeptHead
      ? [
          {
            labelKey: "tailan_deptReport" as const,
            href: "/tools/tailan/department",
          },
          {
            labelKey: "tailan_membersView" as const,
            href: "/tools/tailan/dept-view",
          },
        ]
      : []),
  ];

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center">
          <Link
            href="/tools"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> {t("back")}
          </Link>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-foreground">
            {t("tailan_title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{quarterLabel}</p>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-w-3xl">
          {items.map((item) => (
            <li
              key={item.href}
              className="rounded-lg border border-border overflow-hidden"
            >
              <button
                type="button"
                onClick={() => router.push(item.href)}
                className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-muted/40 transition-colors"
              >
                {t(item.labelKey)}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
