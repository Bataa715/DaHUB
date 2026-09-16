"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Cormorant_Garamond } from "next/font/google";
import { useEffect, useState } from "react";
import { Quote } from "lucide-react";
import { homepageEthicsApi, type EthicsSlide } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { HUB_CONTAINER } from "@/components/shared/HubPage";
import { cn } from "@/lib/utils";
import { DEFAULT_TEAM_SLIDES } from "./team-gallery";

const serif = Cormorant_Garamond({
  subsets: ["cyrillic", "cyrillic-ext", "latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const INTERVAL_MS = 6000;

/** Нүүр хуудасны доод хэсэг — аудиторын ёс зүйн код ба багийн зураг ээлжлэн солигдоно. */
export default function HomeEthics() {
  const { t } = useLanguage();
  const [slides, setSlides] = useState<EthicsSlide[]>([]);
  const [tick, setTick] = useState(0);
  const photos = DEFAULT_TEAM_SLIDES;

  useEffect(() => {
    let cancelled = false;
    homepageEthicsApi
      .list()
      .then((data) => {
        if (!cancelled) setSlides(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const canAdvance = slides.length > 1 || photos.length > 1;
  useEffect(() => {
    if (!canAdvance) return;
    const id = setInterval(() => setTick((n) => n + 1), INTERVAL_MS);
    return () => clearInterval(id);
  }, [canAdvance]);

  const activeIdx = slides.length ? tick % slides.length : 0;
  const active = slides[activeIdx];
  const photoIdx = photos.length ? tick % photos.length : 0;

  if (!active && photos.length === 0) return null;

  return (
    <section
      className={cn(
        HUB_CONTAINER,
        "grid items-center gap-12 py-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:py-28",
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-extrabold tracking-[0.14em] text-blue-600 dark:text-blue-400">
          {t("homeEthicsTitle")}
        </p>
        {active && (
          <div className="relative mt-6 min-h-[16rem]">
            <Quote
              aria-hidden
              className="h-10 w-10 rotate-180 text-blue-600/20 dark:text-blue-400/25"
            />
            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4 }}
              >
                <h2
                  className={cn(
                    serif.className,
                    "mt-4 text-3xl font-semibold italic leading-tight text-foreground sm:text-4xl",
                  )}
                >
                  {active.title}
                </h2>
                <p
                  className={cn(
                    serif.className,
                    "mt-4 text-xl font-medium leading-relaxed text-foreground/80",
                  )}
                >
                  {active.body}
                </p>
              </motion.div>
            </AnimatePresence>
            {slides.length > 1 && (
              <div className="mt-8 flex gap-1.5">
                {slides.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-label={`${i + 1} / ${slides.length}`}
                    onClick={() => setTick(i)}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      i === activeIdx
                        ? "w-8 bg-blue-600 dark:bg-blue-400"
                        : "w-3 bg-foreground/20 hover:bg-foreground/35",
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {photos.length > 0 && (
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[28px] bg-muted shadow-[0_40px_90px_-40px_rgba(15,23,42,0.5)] ring-1 ring-border/60">
          {photos.map((photo, i) => (
            <Image
              key={photo.id}
              src={photo.src}
              alt={photo.alt}
              fill
              priority={i === 0}
              // Бүтэн өргөн layout-д зургийн багана ~55vw — жижиг хувилбар татаж
              // томруулснаас бүдгэрч байсан. quality 95 нь next.config-д зөвшөөрөгдсөн.
              quality={95}
              sizes="(min-width: 1024px) 60vw, 100vw"
              className={cn(
                "object-cover transition-opacity duration-700",
                i === photoIdx ? "opacity-100" : "opacity-0",
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
}
