"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState, useEffect } from "react";
import { homepageEthicsApi, type EthicsSlide } from "@/lib/api";
import { GolomtWatermark } from "@/components/GolomtWatermark";
import { GolomtLogoMark } from "@/components/GolomtLogoMark";
import { TEAM_GALLERY_SLIDES } from "./team-gallery";

const CAROUSEL_MS = 5000;

/** Landscape хамт олны зураг — эцэгээс ирсэн sync index */
function TeamGalleryCarousel({
  idx,
  direction,
}: {
  idx: number;
  direction: number;
}) {
  const slides = TEAM_GALLERY_SLIDES;
  if (slides.length === 0) return null;

  const active = slides[idx % slides.length] ?? slides[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 22, delay: 0.12 }}
      className="relative w-full max-w-[22rem] sm:max-w-[26rem]"
    >
      <div className="hero-profile-glow absolute -inset-2 rounded-2xl blur-md opacity-70" />

      <div className="hero-profile-frame relative rounded-xl p-[2px]">
        <div className="hero-profile-surface relative aspect-[16/9] w-full overflow-hidden rounded-[0.7rem]">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={active.id}
              custom={direction}
              initial={{ x: direction * 36, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: direction * -36, opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="absolute inset-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={active.src}
                alt={active.alt}
                className="h-full w-full object-cover object-center"
                decoding="async"
                draggable={false}
              />
            </motion.div>
          </AnimatePresence>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/35 to-transparent" />
        </div>
      </div>

      {slides.length > 1 && (
        <div className="mt-2.5 flex items-center justify-center gap-1.5 pointer-events-none">
          {slides.map((s, i) => (
            <span
              key={s.id}
              className={`h-1 rounded-full transition-all ${
                i === idx % slides.length
                  ? "w-4 bg-foreground/70"
                  : "w-1.5 bg-foreground/25"
              }`}
            />
          ))}
        </div>
      )}

      <div className="hero-profile-shadow absolute -bottom-2 left-1/2 h-3 w-[70%] -translate-x-1/2 rounded-full blur-md" />
    </motion.div>
  );
}

// ── Арын цэгүүд — монохром, боловсронгуй ───────────────────────────────
const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: (i * 37 + 11) % 100,
  top: (i * 53 + 7) % 100,
  size: (i % 3) + 1.5,
  duration: 4 + (i % 5),
  delay: (i % 6) * 0.5,
}));

export default function Hero() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();

  const [slides, setSlides] = useState<EthicsSlide[]>([]);
  const [slidesLoading, setSlidesLoading] = useState(true);
  // Нэг tick — ethics + зураг нэг зэрэг солигдоно
  const [tick, setTick] = useState(0);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    let cancelled = false;
    homepageEthicsApi
      .list()
      .then((data) => {
        if (cancelled) return;
        setSlides(Array.isArray(data) ? data : []);
        setTick(0);
      })
      .catch(() => {
        if (!cancelled) setSlides([]);
      })
      .finally(() => {
        if (!cancelled) setSlidesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const photoCount = TEAM_GALLERY_SLIDES.length;
  const canAdvance = slides.length > 1 || photoCount > 1;

  useEffect(() => {
    if (!canAdvance) return;
    const id = setInterval(() => {
      setDirection(1);
      setTick((n) => n + 1);
    }, CAROUSEL_MS);
    return () => clearInterval(id);
  }, [canAdvance]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-foreground/20 border-t-foreground/60 rounded-full animate-spin" />
      </div>
    );
  }

  const ethicsIdx = slides.length > 0 ? tick % slides.length : 0;
  const photoIdx = photoCount > 0 ? tick % photoCount : 0;
  const active = slides[ethicsIdx];

  return (
    <div className="relative flex-1 flex flex-col justify-center overflow-hidden select-none">
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 60% at 50% 0%, hsl(var(--primary) / 0.05), transparent 70%)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.22]"
        aria-hidden
        style={{
          backgroundImage:
            "linear-gradient(to right, hsl(var(--border) / 0.45) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border) / 0.45) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 45%, black, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 45%, black, transparent 80%)",
        }}
      />

      <div
        className="absolute inset-0 flex items-start justify-center overflow-hidden pointer-events-none px-8 pt-4 sm:pt-6"
        aria-hidden
      >
        <GolomtLogoMark className="w-full max-w-xl sm:max-w-2xl -translate-x-8 sm:-translate-x-12 text-foreground/[0.045] dark:text-foreground/[0.06]" />
      </div>

      <div
        className="absolute bottom-4 right-4 sm:bottom-6 sm:right-8 pointer-events-none"
        aria-hidden
      >
        <GolomtWatermark className="w-14 h-14 sm:w-20 sm:h-20 text-foreground/[0.1] dark:text-foreground/[0.12]" />
      </div>

      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        aria-hidden
      >
        {PARTICLES.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full bg-foreground/15"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: p.size,
              height: p.size,
            }}
            animate={{ y: [0, -18, 0], opacity: [0.08, 0.22, 0.08] }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-6xl mx-auto w-full px-4 sm:px-8 py-8 sm:py-10 grid lg:grid-cols-[minmax(0,1fr)_minmax(16rem,26rem)] gap-8 lg:gap-10 items-center">
        <div className="space-y-5 min-w-0">
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-foreground leading-[1.08]">
              {user?.name || t("admReportsColUser")}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground font-medium">
              {user?.position && <span>{user.position} · </span>}
              {user?.department || t("internalAuditDept")}
            </p>
          </motion.div>

          {slidesLoading ? (
            <div className="relative max-w-md animate-pulse">
              <div className="h-2 w-28 rounded bg-muted-foreground/15 mb-2" />
              <div className="rounded-xl border border-border bg-card/70 p-3 min-h-[64px] shadow-premium ring-hairline space-y-1.5">
                <div className="h-2.5 w-3/4 rounded bg-muted-foreground/15" />
                <div className="h-2.5 w-full rounded bg-muted-foreground/10" />
              </div>
            </div>
          ) : (
            active && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="relative max-w-md"
              >
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/55 mb-1.5">
                  {t("heroSimpleEthicsCodeLabel")}
                </p>
                <div className="relative overflow-hidden rounded-xl border border-border bg-card/70 backdrop-blur-sm px-3.5 py-3 min-h-[64px] max-h-[88px] shadow-premium ring-hairline">
                  <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                      key={active.id}
                      custom={direction}
                      initial={{ x: direction * 28, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: direction * -28, opacity: 0 }}
                      transition={{ duration: 0.35, ease: "easeInOut" }}
                      className="absolute inset-x-3.5 inset-y-3"
                    >
                      <p className="text-[12px] text-foreground/80 leading-snug font-medium line-clamp-3">
                        <span className="font-bold text-foreground">
                          {active.title}
                        </span>
                        {" – "}
                        {active.body}
                      </p>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </motion.div>
            )
          )}

          <div className="lg:hidden pt-1">
            <TeamGalleryCarousel idx={photoIdx} direction={direction} />
          </div>
        </div>

        <div className="hidden lg:flex flex-col items-stretch justify-center">
          <TeamGalleryCarousel idx={photoIdx} direction={direction} />
        </div>
      </div>
    </div>
  );
}
