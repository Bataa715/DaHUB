"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState, useEffect } from "react";
import { homepageEthicsApi, type EthicsSlide } from "@/lib/api";

function HeroProfilePortrait({
  name,
  profileImage,
}: {
  name?: string;
  profileImage?: string;
}) {
  const initial = (name || "?")[0]?.toUpperCase() ?? "?";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, rotateX: 10 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.15 }}
      className="relative w-[15rem] h-[20rem] sm:w-[16.5rem] sm:h-[22rem] [perspective:900px]"
    >
      <div className="hero-profile-glow absolute -inset-3 rounded-[1.4rem] blur-lg opacity-80" />

      <div className="hero-profile-frame relative h-full w-full rounded-[1.2rem] p-[2px]">
        <div className="hero-profile-surface relative h-full w-full overflow-hidden rounded-[1.05rem]">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1/4 bg-gradient-to-b from-white/15 to-transparent dark:from-white/5" />
          <div className="pointer-events-none absolute inset-x-4 bottom-2 z-10 h-px bg-gradient-to-r from-transparent via-black/10 to-transparent dark:via-white/15" />

          {profileImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profileImage}
              alt={name || "Profile"}
              className="h-full w-full object-cover object-center [image-rendering:auto]"
              decoding="async"
              draggable={false}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <span className="text-6xl font-black text-muted-foreground/30 select-none">
                {initial}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="hero-profile-shadow absolute -bottom-3 left-1/2 h-4 w-[78%] -translate-x-1/2 rounded-full blur-lg" />
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

/** API ачаалагдах хүртэл / алдаа үед fallback */
const FALLBACK_SLIDES: EthicsSlide[] = [
  {
    id: "fallback-1",
    title: "Шударга байдал",
    body: "Аудитор нь үнэнч шударга байж, өөрийн дүгнэлтэд итгэх итгэлийг бий болгох үндсийг бүрдүүлнэ.",
    sort_order: 1,
  },
  {
    id: "fallback-2",
    title: "Бодитой байдал",
    body: "Аудитор нь мэдээллийг цуглуулах, үнэлэх, тайлагнахдаа аливаа нөлөөнд автахгүйгээр тэнцвэртэй, шударга дүгнэлт гаргана.",
    sort_order: 2,
  },
  {
    id: "fallback-3",
    title: "Нууцлалыг хадгалах",
    body: "Аудитор нь олж авсан мэдээллийн нууцыг хамгаалж, зөвшөөрөлгүйгээр задруулахгүй.",
    sort_order: 3,
  },
  {
    id: "fallback-4",
    title: "Мэргэжлийн чадвар",
    body: "Аудитор нь ажлаа гүйцэтгэхэд шаардлагатай мэдлэг, ур чадвар, туршлагаа ашиглан чанартай, хариуцлагатай ажиллана.",
    sort_order: 4,
  },
];

export default function Hero() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();

  const [slides, setSlides] = useState<EthicsSlide[]>(FALLBACK_SLIDES);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    let cancelled = false;
    homepageEthicsApi
      .list()
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data) && data.length > 0) {
          setSlides(data);
          setCarouselIdx(0);
        }
      })
      .catch(() => {
        /* keep fallback */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-advance carousel
  useEffect(() => {
    if (slides.length === 0) return;
    const id = setInterval(() => {
      setDirection(1);
      setCarouselIdx((i) => (i + 1) % slides.length);
    }, 5000);
    return () => clearInterval(id);
  }, [slides.length]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-foreground/20 border-t-foreground/60 rounded-full animate-spin" />
      </div>
    );
  }

  const active = slides[carouselIdx] ?? slides[0];

  return (
    <div className="relative flex-1 flex flex-col justify-center overflow-hidden select-none">
      {/* ── Зөөлөн арын градиент ── */}
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

      {/* ── Арын цэгүүдийн animation (маш зөөлөн) ── */}
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

      {/* ── Гол агуулга ── */}
      <div className="relative z-10 max-w-6xl mx-auto w-full px-4 sm:px-8 py-12 grid lg:grid-cols-[1fr_auto] gap-12 items-center">
        <div className="space-y-8">
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-foreground leading-[1.05]">
              {user?.name || "Хэрэглэгч"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground font-medium">
              {user?.position && <span>{user.position} · </span>}
              {user?.department || t("internalAuditDept")}
            </p>
          </motion.div>

          {active && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.6 }}
              className="relative max-w-xl"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 mb-3">
                Аудиторын ёс зүйн код
              </p>
              <div className="relative overflow-hidden rounded-2xl border border-border bg-card/70 backdrop-blur-sm p-5 min-h-[110px] shadow-premium ring-hairline">
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={active.id}
                    custom={direction}
                    initial={{ x: direction * 40, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: direction * -40, opacity: 0 }}
                    transition={{ duration: 0.35, ease: "easeInOut" }}
                    className="absolute inset-5"
                  >
                    <p className="text-sm text-foreground/85 leading-relaxed font-medium">
                      <span className="font-black text-foreground">
                        {active.title}
                      </span>
                      {" – "}
                      {active.body}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </div>

        <div className="hidden lg:flex flex-col items-center gap-4">
          <HeroProfilePortrait
            name={user?.name}
            profileImage={user?.profileImage}
          />
        </div>
      </div>
    </div>
  );
}
