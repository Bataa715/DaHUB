"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import Image from "next/image";

// ── Арын цэгүүд — монохром, боловсронгуй ───────────────────────────────
const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: (i * 37 + 11) % 100,
  top: (i * 53 + 7) % 100,
  size: (i % 3) + 1.5,
  duration: 4 + (i % 5),
  delay: (i % 6) * 0.5,
}));

// ── Carousel: аудитын дүрэм, журмуудаас эш татсан мөрүүд ─────────────────────
const RULES = [
  "Шударга байдал – Аудитор нь үнэнч шударга байж, өөрийн дүгнэлтэд итгэх итгэлийг бий болгох үндсийг бүрдүүлнэ.",
  "Бодитой байдал – Аудитор нь мэдээллийг цуглуулах, үнэлэх, тайлагнахдаа аливаа нөлөөнд автахгүйгээр тэнцвэртэй, шударга дүгнэлт гаргана.",
  "Нууцлалыг хадгалах – Аудитор нь олж авсан мэдээллийн нууцыг хамгаалж, зөвшөөрөлгүйгээр задруулахгүй.",
  "Мэргэжлийн чадвар – Аудитор нь ажлаа гүйцэтгэхэд шаардлагатай мэдлэг, ур чадвар, туршлагаа ашиглан чанартай, хариуцлагатай ажиллана.",
];

export default function Hero() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  const [carouselIdx, setCarouselIdx] = useState(0);
  const [direction, setDirection] = useState(1);

  // Auto-advance carousel
  useEffect(() => {
    const id = setInterval(() => {
      setDirection(1);
      setCarouselIdx((i) => (i + 1) % RULES.length);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-foreground/20 border-t-foreground/60 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-120px)] flex flex-col justify-center overflow-hidden select-none">

      {/* ── Зөөлөн арын градиент + сүлжээ ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 60% at 50% 0%, hsl(var(--primary) / 0.06), transparent 70%)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.4]"
        aria-hidden
        style={{
          backgroundImage:
            "linear-gradient(to right, hsl(var(--border) / 0.5) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border) / 0.5) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 45%, black, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 45%, black, transparent 80%)",
        }}
      />

      {/* ── Арын цэгүүдийн animation (монохром) ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        {PARTICLES.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full bg-foreground/20"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: p.size,
              height: p.size,
            }}
            animate={{ y: [0, -18, 0], opacity: [0.15, 0.4, 0.15] }}
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

        {/* Зүүн: мэндчилгээ + нэр + motto */}
        <div className="space-y-8">

          {/* Мэндчилгээ */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground mb-3">
              Тавтай морил
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-foreground leading-[1.05]">
              {user?.name || "Хэрэглэгч"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground font-medium">
              {user?.position && <span>{user.position} · </span>}
              {user?.department || t("internalAuditDept")}
            </p>
          </motion.div>

          {/* Mottos - hidden */}

          {/* CTA товчлуур */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.5 }}
          >
            <button
              onClick={() => router.push("/tools")}
              className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-foreground text-background text-sm font-bold tracking-wide shadow-premium hover:shadow-premium-lg hover:-translate-y-0.5 transition-all duration-300"
            >
              Хэрэгслүүд
              <ChevronRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </button>
          </motion.div>

          {/* ── Carousel: дүрэм журам ── */}
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
                  key={carouselIdx}
                  custom={direction}
                  initial={{ x: direction * 40, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: direction * -40, opacity: 0 }}
                  transition={{ duration: 0.35, ease: "easeInOut" }}
                  className="absolute inset-5"
                >
                  <p className="text-sm text-foreground/85 leading-relaxed font-medium">
                    {(() => {
                      const [title, ...rest] = RULES[carouselIdx].split(" – ");
                      return (<><span className="font-black text-foreground">{title}</span>{" – "}{rest.join(" – ")}</>);
                    })()}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Carousel controls - auto only, no buttons */}
          </motion.div>
        </div>

        {/* Баруун: профайл зураг */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
          className="hidden lg:flex flex-col items-center gap-4"
        >
          <div className="relative w-52 h-52 rounded-2xl overflow-hidden border border-border shadow-premium-lg ring-hairline">
            {user?.profileImage ? (
              <Image
                src={user.profileImage}
                alt={user.name || "Profile"}
                fill
                className="object-cover"
                sizes="208px"
                priority
              />
            ) : (
              <div className="absolute inset-0 bg-muted flex items-center justify-center">
                <span className="text-5xl font-black text-muted-foreground/30 select-none">
                  {(user?.name || "?")[0]}
                </span>
              </div>
            )}
          </div>
          {/* Active badge */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Идэвхтэй
          </div>
        </motion.div>
      </div>
    </div>
  );
}

