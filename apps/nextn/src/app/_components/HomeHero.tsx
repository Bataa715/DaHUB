"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAllowedTools } from "@/hooks/use-allowed-tools";
import { getTools, type Tool, type ToolSection } from "@/lib/tools-config";
import { GolomtLogoMark } from "@/components/GolomtLogoMark";
import { AppTopBar } from "@/components/shared/AppTopBar";
import { HUB_BG, HUB_CONTAINER } from "@/components/shared/HubPage";
import { cn } from "@/lib/utils";
import { HomeCardArt, type HomeArtVariant } from "./HomeCardArt";

/** Карт дээр багтах мөрийн тоо — илүүг "+N" болгоно. */
const MAX_BULLETS = 4;

type Section = {
  id: HomeArtVariant;
  href: string;
  title: string;
  /** Хэсэг дотор юу байгааг жагсаана (тайлбарын оронд) */
  bullets: string[];
};

function SectionCard({ section, index }: { section: Section; index: number }) {
  const visible = section.bullets.slice(0, MAX_BULLETS);
  const extra = section.bullets.length - visible.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: 0.1 + index * 0.07,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <Link
        href={section.href}
        className="group relative block min-h-[26rem] overflow-hidden rounded-[28px] bg-[#05060d] text-white shadow-[0_30px_60px_-25px_rgba(0,0,0,0.6)] ring-1 ring-white/10 transition-transform duration-300 hover:-translate-y-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <HomeCardArt
          variant={section.id}
          className="absolute inset-0 h-full w-full transition-transform duration-700 ease-out group-hover:scale-105"
        />
        {/* Текст уншигдахуйц байхаар доод хэсгийг бараан болгоно */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-[#05060d] via-[#05060d]/90 to-transparent"
        />
        <div className="relative flex h-full min-h-[26rem] flex-col p-7">
          <div className="flex items-center justify-between">
            <span
              aria-hidden
              className="text-5xl font-black leading-none text-transparent"
              style={{ WebkitTextStroke: "1.2px rgba(255,255,255,0.7)" }}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white/15 backdrop-blur transition-colors group-hover:bg-white group-hover:text-[#07070c]">
              <ArrowUpRight className="h-5 w-5" aria-hidden />
            </span>
          </div>
          {/* Нэр зүүн талд, доторх зүйлсийн жагсаалт баруун талд — дээр доороо давхцахгүй */}
          <div className="mt-auto flex items-end justify-between gap-4 pt-10">
            <h2 className="min-w-0 text-xl font-black leading-tight tracking-tight sm:text-2xl">
              {section.title}
            </h2>
            {visible.length > 0 && (
              <ul className="shrink-0 space-y-1.5 text-right">
                {visible.map((bullet) => (
                  <li
                    key={bullet}
                    className="flex flex-row-reverse items-center gap-2 text-xs font-semibold text-white/85"
                  >
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/70"
                    />
                    <span className="truncate">{bullet}</span>
                  </li>
                ))}
                {extra > 0 && (
                  <li className="pr-3.5 text-xs font-bold text-white/55">
                    +{extra}
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/** Нүүр хуудасны hero — мэндчилгээ + 4 үндсэн хэсэг (sidebar-ийн оронд үндсэн навигаци). */
export default function HomeHero() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const { loading: accessLoading, canAccess } = useAllowedTools();

  const tools = getTools(t);
  // Эрхгүй хэрэгслийн нэрийг ч харуулахгүй — эрх ачаалж дуустал хоосон
  const bulletsOf = (section: ToolSection) =>
    accessLoading
      ? []
      : tools
          .filter(
            (tool) =>
              tool.section === section &&
              !tool.hidden &&
              canAccess(tool.matchIds ?? [tool.id]),
          )
          .map((tool: Tool) => tool.title);

  const sections: Section[] = [
    {
      id: "news",
      href: "/knowledge",
      title: t("navNews"),
      bullets: [],
    },
    {
      // /dashboard нь эрхтэй эхний самбарыг шууд нээнэ (нэг даралт).
      id: "dashboard",
      href: "/dashboard",
      title: t("homeSectionDashboard"),
      bullets: bulletsOf("dashboard"),
    },
    {
      id: "tools",
      href: "/tools",
      title: t("homeSectionTools"),
      bullets: bulletsOf("tool"),
    },
    {
      // 3 төрлийн үнэлгээ тус бүр тусдаа эрхтэй — хаб өөрөө үргэлж нээлттэй.
      id: "risk",
      href: "/ersdel",
      title: t("homeSectionRisk"),
      bullets: [],
    },
  ];

  const subtitle = [user?.position, user?.department]
    .filter(Boolean)
    .join(" • ");

  return (
    <section className={cn("relative overflow-hidden text-white", HUB_BG)}>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-24 h-[36rem] w-[36rem] rounded-full bg-blue-600/25 blur-3xl" />
        <div className="absolute -right-32 -top-32 h-[30rem] w-[30rem] rounded-full bg-violet-600/20 blur-3xl" />
      </div>

      <div className={cn("relative", HUB_CONTAINER)}>
        <AppTopBar />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-end justify-between gap-8 pb-8 pt-6 sm:pt-10"
        >
          <div className="min-w-0">
            <p className="text-xs font-extrabold tracking-[0.14em] text-blue-400">
              {t("internalAuditDept")}
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
              {t("homeGreeting")}
              {user?.name && (
                <span className="text-white/80">, {user.name}</span>
              )}
            </h1>
            {subtitle && (
              <p className="mt-1.5 text-sm font-semibold text-white/55">
                {subtitle}
              </p>
            )}
          </div>
          {/* Банкны лого — картуудтай давхцахгүй, бүтэн харагдахаар мэндчилгээтэй нэг мөрөнд */}
          <GolomtLogoMark className="hidden w-[26rem] shrink-0 text-white/[0.07] lg:block xl:w-[32rem]" />
        </motion.div>

        <div className="grid grid-cols-1 gap-5 pb-20 sm:grid-cols-2 lg:grid-cols-4">
          {sections.map((section, i) => (
            <SectionCard key={section.id} section={section} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
