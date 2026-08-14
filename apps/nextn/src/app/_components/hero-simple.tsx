"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Cormorant_Garamond } from "next/font/google";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState, useEffect } from "react";
import { homepageEthicsApi, type EthicsSlide } from "@/lib/api";
import { GolomtWatermark } from "@/components/GolomtWatermark";
import { GolomtLogoMark } from "@/components/GolomtLogoMark";
import { Quote } from "lucide-react";
import { loadTeamGallery, type TeamGallerySlide } from "./team-gallery";

const ethicsSerif = Cormorant_Garamond({
  subsets: ["cyrillic", "cyrillic-ext", "latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const CAROUSEL_MS = 5000;

/** Landscape хамт олны зураг — эцэгээс ирсэн sync index */
function TeamGalleryCarousel({
  slides,
  idx,
  direction,
}: {
  slides: TeamGallerySlide[];
  idx: number;
  direction: number;
}) {
  if (slides.length === 0) return null;

  const active = slides[idx % slides.length] ?? slides[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 22, delay: 0.12 }}
      className="relative w-full"
    >
      <div className="hero-profile-glow absolute -inset-2 rounded-2xl blur-md opacity-70" />

      <div className="hero-profile-frame relative rounded-xl p-[2px]">
        <div className="hero-profile-surface relative aspect-[16/10] w-full overflow-hidden rounded-[0.7rem]">
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
  const [photos, setPhotos] = useState<TeamGallerySlide[]>([]);
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

    loadTeamGallery()
      .then((slides) => {
        if (!cancelled) setPhotos(slides);
      })
      .catch(() => {
        if (!cancelled) setPhotos([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const photoCount = photos.length;
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

      <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-8 py-8 sm:py-10 grid lg:grid-cols-[minmax(0,1fr)_minmax(28rem,44rem)] gap-8 lg:gap-10 items-center">
        <div className="space-y-6 min-w-0">
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1
              className={`${ethicsSerif.className} text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-foreground leading-[1.08]`}
            >
              {user?.name || t("admReportsColUser")}
            </h1>
            <div className="mt-3 h-px w-14 bg-gradient-to-r from-primary via-violet-500 to-cyan-500" />
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {user?.position ? (
                <span className="text-[13px] sm:text-sm font-semibold tracking-wide text-foreground/90">
                  {user.position}
                </span>
              ) : null}
              {user?.position && user?.department ? (
                <span className="hidden sm:inline h-3.5 w-px bg-border" />
              ) : null}
              <span className="text-[13px] sm:text-sm tracking-wide text-muted-foreground">
                {user?.department || t("internalAuditDept")}
              </span>
            </div>
          </motion.div>

          {slidesLoading ? (
            <div className="relative max-w-lg animate-pulse">
              <div className="rounded-xl p-[2px] bg-border/60">
                <div className="h-[8.5rem] rounded-[0.7rem] bg-card/70 p-4 space-y-2">
                  <div className="h-3 w-1/3 rounded bg-muted-foreground/15" />
                  <div className="h-3 w-full rounded bg-muted-foreground/10" />
                  <div className="h-3 w-5/6 rounded bg-muted-foreground/10" />
                </div>
              </div>
            </div>
          ) : (
            active && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="relative max-w-lg"
              >
                <div className="hero-profile-glow absolute -inset-2 rounded-2xl blur-md opacity-50 pointer-events-none" />
                <div className="hero-profile-frame relative rounded-xl p-[2px]">
                  <div className="hero-profile-surface relative h-[8.5rem] overflow-hidden rounded-[0.7rem] px-5 py-3.5 pl-6">
                    <div
                      className="absolute left-0 inset-y-3 w-[3px] rounded-full bg-gradient-to-b from-primary via-violet-500 to-cyan-500"
                      aria-hidden
                    />
                    <Quote
                      className="absolute top-3 right-3.5 h-5 w-5 text-primary/15 rotate-180"
                      aria-hidden
                    />

                    <AnimatePresence mode="wait" custom={direction}>
                      <motion.div
                        key={active.id}
                        custom={direction}
                        initial={{ x: direction * 24, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: direction * -24, opacity: 0 }}
                        transition={{ duration: 0.35, ease: "easeInOut" }}
                        className="absolute inset-x-5 inset-y-3.5 left-6 right-10"
                      >
                        <p
                          className={`${ethicsSerif.className} text-[0.95rem] font-semibold italic leading-snug tracking-wide text-primary line-clamp-1`}
                        >
                          {active.title}
                        </p>
                        <p
                          className={`${ethicsSerif.className} mt-1.5 text-[0.9rem] font-medium leading-relaxed text-foreground/90 line-clamp-3`}
                        >
                          {active.body}
                        </p>
                      </motion.div>
                    </AnimatePresence>

                    <motion.div
                      key={`bar-${active.id}`}
                      className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-primary via-violet-500 to-cyan-500"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{
                        duration: CAROUSEL_MS / 1000,
                        ease: "linear",
                      }}
                    />
                  </div>
                </div>

                {slides.length > 1 && (
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      {slides.map((s, i) => (
                        <span
                          key={s.id}
                          className={`h-1 rounded-full transition-all ${
                            i === ethicsIdx
                              ? "w-4 bg-primary"
                              : "w-1.5 bg-foreground/20"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="ml-auto text-[10px] font-mono tabular-nums text-muted-foreground/70">
                      {String(ethicsIdx + 1).padStart(2, "0")}
                      <span className="text-muted-foreground/40"> / </span>
                      {String(slides.length).padStart(2, "0")}
                    </span>
                  </div>
                )}
              </motion.div>
            )
          )}

          <div className="lg:hidden pt-1">
            <TeamGalleryCarousel
              slides={photos}
              idx={photoIdx}
              direction={direction}
            />
          </div>
        </div>

        <div className="hidden lg:flex flex-col items-stretch justify-center min-w-0">
          <TeamGalleryCarousel
            slides={photos}
            idx={photoIdx}
            direction={direction}
          />
        </div>
      </div>
    </div>
  );
}
