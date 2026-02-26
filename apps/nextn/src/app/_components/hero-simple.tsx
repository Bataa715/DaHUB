"use client";

import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Loader2,
  Building2,
  Wrench,
  Calendar,
  Clock,
  User,
  ArrowRight,
  Shield,
  ChevronRight,
} from "lucide-react";
import Image from "next/image";

const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  left: (i * 37 + 11) % 100,
  top: (i * 53 + 7) % 100,
  size: (i % 3) + 1.5,
  duration: 3 + (i % 5),
  delay: (i % 6) * 0.5,
  color: i % 3 === 0 ? "59,130,246" : i % 3 === 1 ? "168,85,247" : "16,185,129",
}));

export default function Hero() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const currentDate = time.toLocaleDateString("mn-MN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const currentTime = time.toLocaleTimeString("mn-MN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const getGreeting = () => {
    const hour = time.getHours();
    if (hour < 12) return { text: "Өглөөний мэнд", emoji: "🌅" };
    if (hour < 18) return { text: "Өдрийн мэнд", emoji: "☀️" };
    return { text: "Оройн мэнд", emoji: "🌙" };
  };

  const greeting = getGreeting();

  if (loading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="h-12 w-12 text-purple-400" />
          </motion.div>
          <p className="text-slate-400 text-sm animate-pulse">
            Ачаалж байна...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-120px)] flex flex-col justify-center px-4 sm:px-6 lg:px-8 py-8 overflow-hidden relative">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Main orbs */}
        <motion.div
          className="absolute -top-60 -left-60 w-[600px] h-[600px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)",
          }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-60 -right-60 w-[600px] h-[600px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(168,85,247,0.12) 0%, transparent 70%)",
          }}
          animate={{ scale: [1.15, 1, 1.15], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)",
          }}
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Grid lines */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
            backgroundSize: "80px 80px",
          }}
        />

        {/* Particles */}
        {PARTICLES.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: p.size,
              height: p.size,
              background: `rgba(${p.color}, 0.7)`,
              boxShadow: `0 0 ${p.size * 3}px rgba(${p.color}, 0.5)`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.2, 0.9, 0.2],
              scale: [1, 1.8, 1],
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              delay: p.delay,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      <div className="max-w-7xl mx-auto w-full relative z-10">
        <div className="grid lg:grid-cols-3 gap-10 items-center">
          {/* â”€â”€ Left Column â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7 }}
            className="space-y-7"
          >
            {/* Status badge */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full border backdrop-blur-xl"
              style={{
                background:
                  "linear-gradient(135deg, rgba(59,130,246,0.1), rgba(168,85,247,0.1))",
                borderColor: "rgba(99,102,241,0.3)",
              }}
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-xs font-semibold text-indigo-300">
                {user?.position || "Ажилтан"}
                {user?.isAdmin && " · Админ"}
              </span>
            </motion.div>

            {/* Greeting + Name */}
            <div className="space-y-3">
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-2 text-slate-400 text-lg font-medium"
              >
                <span>{greeting.emoji}</span>
                <span>{greeting.text}</span>
              </motion.p>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, type: "spring", stiffness: 80 }}
                className="text-5xl sm:text-6xl font-black leading-none tracking-tight"
              >
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg, #60a5fa, #a78bfa, #f472b6)",
                  }}
                >
                  {user?.name || "Хэрэглэгч"}
                </span>
              </motion.h1>

              {/* Department */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="flex flex-col gap-1.5 pt-1"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-emerald-500/15">
                    <Building2 className="h-4 w-4 text-emerald-400" />
                  </div>
                  <p className="text-slate-200 font-medium">
                    {user?.department || "Дотоод Аудитын Газар"}
                  </p>
                </div>
                {user?.userId && (
                  <p className="text-xs text-slate-500 font-mono pl-10">
                    {user.userId}
                  </p>
                )}
              </motion.div>
            </div>

            {/* Divider */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="h-px origin-left"
              style={{
                background:
                  "linear-gradient(90deg, rgba(99,102,241,0.5), transparent)",
              }}
            />

            {/* Tools button */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <motion.button
                whileHover={{ scale: 1.04, y: -3 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => router.push("/tools")}
                className="group relative inline-flex items-center gap-3 px-7 py-4 rounded-2xl overflow-hidden font-semibold text-white shadow-xl shadow-purple-900/30"
                style={{
                  background:
                    "linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899)",
                }}
              >
                <motion.div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background:
                      "linear-gradient(135deg, #6366f1, #a855f7, #f43f5e)",
                  }}
                />
                <Wrench className="h-5 w-5 relative z-10" />
                <span className="relative z-10">Хэрэгслүүд</span>
                <motion.div
                  className="relative z-10"
                  animate={{ x: [0, 4, 0] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <ChevronRight className="h-5 w-5" />
                </motion.div>
              </motion.button>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
              duration: 0.8,
              delay: 0.2,
              type: "spring",
              stiffness: 80,
            }}
            className="flex flex-col items-center gap-5"
          >
            {/* Outer glow ring */}
            <div className="relative">
              <motion.div
                className="absolute -inset-4 rounded-full blur-2xl opacity-40"
                style={{
                  background:
                    "linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899)",
                }}
                animate={{
                  opacity: [0.3, 0.6, 0.3],
                  scale: [0.95, 1.05, 0.95],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />

              {/* Rotating dashed ring */}
              <motion.div
                className="absolute -inset-3 rounded-full border border-dashed border-purple-500/30"
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                className="absolute -inset-6 rounded-full border border-dashed border-blue-500/20"
                animate={{ rotate: -360 }}
                transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
              />

              {/* Profile circle */}
              <motion.div
                className="relative w-52 h-52 sm:w-60 sm:h-60 lg:w-68 lg:h-68 rounded-full overflow-hidden shadow-2xl"
                style={{
                  padding: "3px",
                  background:
                    "linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899)",
                }}
                whileHover={{ scale: 1.06 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <div className="w-full h-full rounded-full overflow-hidden bg-slate-900 relative">
                  {user?.profileImage ? (
                    <Image
                      src={user.profileImage}
                      alt={user.name || "Profile"}
                      fill
                      className="object-cover"
                      sizes="280px"
                      priority
                    />
                  ) : (
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(30,40,60,1), rgba(20,25,40,1))",
                      }}
                    >
                      <motion.div
                        animate={{
                          scale: [1, 1.06, 1],
                          opacity: [0.6, 1, 0.6],
                        }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      >
                        <User className="h-20 w-20 text-slate-600" />
                      </motion.div>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Name card below image */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="relative text-center px-8 py-4 rounded-2xl overflow-hidden"
              style={{
                background: "rgba(15,20,35,0.7)",
                border: "1px solid rgba(99,102,241,0.25)",
                backdropFilter: "blur(20px)",
                minWidth: "220px",
              }}
            >
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(59,130,246,0.1), rgba(168,85,247,0.1), transparent)",
                }}
              />
              <div className="relative flex items-center justify-center gap-2 mb-1">
                <motion.span
                  className={`w-2.5 h-2.5 rounded-full ${user?.isActive ? "bg-emerald-400" : "bg-red-400"}`}
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{
                    boxShadow: user?.isActive
                      ? "0 0 8px #34d399"
                      : "0 0 8px #f87171",
                  }}
                />
              </div>
              <p className="relative text-slate-400 text-sm">
                {user?.position || "Дата инженер"}
              </p>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="space-y-4"
          >
            {/* Clock */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="relative overflow-hidden rounded-3xl p-6"
              style={{
                background:
                  "linear-gradient(135deg, rgba(59,130,246,0.12), rgba(99,102,241,0.08))",
                border: "1px solid rgba(99,102,241,0.2)",
                backdropFilter: "blur(20px)",
              }}
            >
              <div
                className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20"
                style={{
                  background: "radial-gradient(circle, #3b82f6, transparent)",
                }}
              />
              <div className="flex items-center gap-3 mb-3"></div>
              <p className="text-4xl font-black text-white tracking-tight font-mono">
                {currentTime}
              </p>
            </motion.div>

            {/* Date */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="relative overflow-hidden rounded-3xl p-5"
              style={{
                background: "rgba(15,20,35,0.6)",
                border: "1px solid rgba(99,102,241,0.15)",
                backdropFilter: "blur(20px)",
              }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-500/15">
                  <Calendar className="h-4 w-4 text-purple-400" />
                </div>
                <p className="text-slate-300 text-sm font-medium leading-snug">
                  {currentDate}
                </p>
              </div>
            </motion.div>

            {/* Sparkle info card */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="relative overflow-hidden rounded-3xl p-5"
              style={{
                background:
                  "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(5,150,105,0.05))",
                border: "1px solid rgba(16,185,129,0.2)",
                backdropFilter: "blur(20px)",
              }}
            >
              <div
                className="absolute bottom-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-20"
                style={{
                  background: "radial-gradient(circle, #10b981, transparent)",
                }}
              />
              <div className="flex items-center gap-3">
                <motion.div
                  className="p-2 rounded-xl bg-emerald-500/15"
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                ></motion.div>
                <div>
                  <p className="text-emerald-300 text-xs font-semibold uppercase tracking-widest mb-0.5">
                    Дотоод аудитын газар
                  </p>
                  <p className="text-slate-400 text-xs">DaHUB</p>
                </div>
              </div>
            </motion.div>

            {/* Arrow hint */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="flex items-center gap-2 px-2 text-slate-600 text-xs"
            ></motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
