"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpRight,
  Clock,
  LayoutGrid,
  Loader2,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAllowedTools } from "@/hooks/use-allowed-tools";
import type { Tool } from "@/lib/tools-config";
import { cn } from "@/lib/utils";
import { AppTopBar } from "./AppTopBar";

// Дэлгэцийн бүтэн өргөнийг ашиглана — зөвхөн ирмэгийн padding.
export const HUB_CONTAINER = "w-full px-4 sm:px-8 lg:px-12 2xl:px-16";
// dark-surface — цайвар горимд ч бараан token/текстийн өнгөтэй (ThemeStyleInjector, globals.css).
export const HUB_BG = "dark-surface bg-[#07070c]";

/** Хаб хуудасны нэг карт — хэрэгсэл эсвэл хэрэгслийн дэд хуудас. */
export type HubItem = {
  id: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tag?: string;
  /** Icon-ы дэвсгэр градиент, ж: "from-rose-500 to-orange-500" */
  gradient: string;
  /** Аль нэг нь байхад нээгдэнэ (allowedTools id) */
  accessIds: string[];
  /** Хараахан хөгжүүлэгдээгүй — "Удахгүй" карт, дарагдахгүй */
  comingSoon?: boolean;
};

/** Хаб хуудасны бүлэг (ж: Эрсдэлийн үнэлгээний төрөл бүр). Гарчиггүй бол энгийн жагсаалт. */
export type HubSection = {
  id: string;
  title?: string;
  items: HubItem[];
};

export function toHubItem(tool: Tool): HubItem {
  return {
    id: tool.id,
    href: tool.href,
    icon: tool.icon,
    title: tool.title,
    tag: tool.tag,
    gradient: tool.gradient,
    accessIds: tool.matchIds ?? [tool.id],
  };
}

type CardStatus = "open" | "soon";

/**
 * Хэрэгсэл/дэд хэсэг рүү орох карт — хаб хуудас болон хэрэгслийн нүүр
 * хуудсууд (Зайны аудит г.м.) ижил загвартай. Олон самбар багтахаар нягт.
 */
export function HubCard({
  href,
  icon: Icon,
  title,
  tag,
  gradient,
  status = "open",
  index = 0,
}: Omit<HubItem, "id" | "accessIds" | "comingSoon"> & {
  status?: CardStatus;
  index?: number;
}) {
  const { t } = useLanguage();

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br text-white shadow-md",
            gradient,
            status === "soon" && "opacity-60 saturate-50",
          )}
        >
          <Icon className="h-6 w-6" />
        </span>
        {status === "open" ? (
          <ArrowUpRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            <Clock className="h-3 w-3" aria-hidden />
            {t("hubComingSoon")}
          </span>
        )}
      </div>
      {tag && (
        <p className="mt-6 text-xs font-bold tracking-wide text-muted-foreground">
          {tag}
        </p>
      )}
      <h3
        className={cn(
          "text-lg font-bold leading-snug tracking-tight text-foreground",
          tag ? "mt-1" : "mt-6",
        )}
      >
        {title}
      </h3>
    </>
  );

  const cardClass = cn(
    "group relative flex h-full flex-col rounded-3xl p-6 transition-all duration-300",
    status === "soon"
      ? "border-2 border-dashed border-border bg-transparent"
      : "bg-card ring-1 ring-border/60 shadow-[0_20px_50px_-32px_rgba(15,23,42,0.35)]",
    status === "open" &&
      "hover:-translate-y-1 hover:shadow-[0_28px_60px_-30px_rgba(15,23,42,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: 0.04 * index,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {status === "open" ? (
        <Link href={href} className={cardClass}>
          {body}
        </Link>
      ) : (
        <div aria-disabled className={cardClass}>
          {body}
        </div>
      )}
    </motion.div>
  );
}

/**
 * Нүүр хуудасны үндсэн хэсгийн дотоод хуудас (Дашбоард / Хэрэгсэл / Эрсдэлийн үнэлгээ).
 * Зөвхөн хэрэглэгчийн эрхтэй картууд харагдана ("Удахгүй" картаас бусад).
 */
export function HubPage({
  title,
  accent,
  sections,
  backHref = "/",
}: {
  title: string;
  /** Толгой хэсгийн өнгөт туяа, ж: "from-violet-600 to-fuchsia-700" */
  accent: string;
  sections: HubSection[];
  /** Буцах зам — дэд хаб (ж: эрсдэлийн үнэлгээний төрөл) эцэг хаб руугаа буцна. */
  backHref?: string;
}) {
  const { t } = useLanguage();
  const { loading, canAccess } = useAllowedTools();
  // Эрхгүй хэрэгслийг огт харуулахгүй — "Удахгүй" карт л эрхээс үл хамааран харагдана.
  // UI цэгцлэл; жинхэнэ хамгаалалт нь proxy.ts + backend @RequireTools.
  const visibleSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => item.comingSoon || canAccess(item.accessIds),
      ),
    }))
    .filter((section) => section.items.length > 0);
  const isEmpty = visibleSections.length === 0;
  const home = backHref === "/";

  return (
    <div className="min-h-full bg-background pb-24">
      <section className={cn("relative overflow-hidden text-white", HUB_BG)}>
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -right-40 -top-56 h-[28rem] w-[28rem] rounded-full bg-gradient-to-br opacity-30 blur-3xl",
            accent,
          )}
        />
        <div className={cn("relative", HUB_CONTAINER)}>
          <AppTopBar />
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center gap-4 pb-8 pt-1"
          >
            {/* Нүүр рүү буцахдаа DAG news-тэй ижил товч; дэд хаб дээр сум */}
            <Link
              href={backHref}
              aria-label={home ? t("knowledgeGoHome") : t("back")}
              title={home ? t("knowledgeGoHome") : t("back")}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              {home ? (
                <LayoutGrid className="h-5 w-5" />
              ) : (
                <ArrowLeft className="h-5 w-5" />
              )}
            </Link>
            <h1 className="min-w-0 truncate text-2xl font-black tracking-tight sm:text-3xl">
              {title}
            </h1>
          </motion.div>
        </div>
      </section>

      <div className={cn(HUB_CONTAINER, "space-y-10 pt-8")}>
        {loading ? (
          <div className="flex justify-center rounded-3xl bg-card py-20 ring-1 ring-border/60">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : isEmpty ? (
          <p className="rounded-3xl bg-card py-20 text-center text-sm text-muted-foreground ring-1 ring-border/60">
            {t("hubEmpty")}
          </p>
        ) : (
          visibleSections.map((section) => (
            <section key={section.id}>
              {section.title && (
                <h2 className="mb-4 text-lg font-bold tracking-tight text-foreground">
                  {section.title}
                </h2>
              )}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {section.items.map((item, i) => (
                  <HubCard
                    key={item.id}
                    href={item.href}
                    icon={item.icon}
                    title={item.title}
                    tag={item.tag}
                    gradient={item.gradient}
                    status={item.comingSoon ? "soon" : "open"}
                    index={i}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
