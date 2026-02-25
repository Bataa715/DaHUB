"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { usersApi } from "@/lib/api";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  ListTodo,
  Dumbbell,
  Wrench,
  Lock,
  Loader2,
  Dice6,
  Table2,
  Star,
  FileText,
  Database,
  Crown,
} from "lucide-react";

interface Tool {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  gradient: string;
  glow: string;
  tag: string;
  category: "free" | "work";
  matchIds?: string[]; // if set, card is visible if user has ANY of these tool ids
}

const allTools: Tool[] = [
  {
    id: "todo",
    title: "Хийх зүйлсийн жагсаалт",
    description:
      "Өдөр тутмын ажлуудаа үр дүнтэй төлөвлөж, хянах боломжтой хэрэгсэл",
    icon: ListTodo,
    href: "/tools/todo",
    gradient: "from-emerald-500 to-teal-500",
    glow: "shadow-emerald-500/20 group-hover:shadow-emerald-500/40",
    tag: "Productivity",
    category: "free",
  },
  {
    id: "fitness",
    title: "Биеийн тамир",
    description: "Өдөр тутмын дасгалын хөтөлбөр болон биеийн байдлын хяналт",
    icon: Dumbbell,
    href: "/tools/fitness",
    gradient: "from-orange-500 to-rose-500",
    glow: "shadow-orange-500/20 group-hover:shadow-orange-500/40",
    tag: "Health",
    category: "free",
  },
  {
    id: "chess",
    title: "Оюуны спорт",
    description:
      "Шатар тоглоом — хамт олныхоо гишүүнтэй онлайнаар тоглох боломж",
    icon: Crown,
    href: "/tools/chess",
    gradient: "from-amber-500 to-yellow-500",
    glow: "shadow-amber-500/20 group-hover:shadow-amber-500/40",
    tag: "Game",
    category: "free",
  },
  {
    id: "sanamsargui-tuuwer",
    title: "Санамсаргүй түүвэр",
    description:
      "Аудитын түүврийн хэмжээ тооцоолох, Excel файлаас санамсаргүй сонгон авах",
    icon: Dice6,
    href: "/tools/sanamsargui-tuuwer",
    gradient: "from-violet-500 to-indigo-500",
    glow: "shadow-violet-500/20 group-hover:shadow-violet-500/40",
    tag: "Audit",
    category: "work",
  },
  {
    id: "pivot",
    title: "Pivot",
    description: "Excel файлаас pivot хүснэгт болон давтамжийн хүснэгт үүсгэх",
    icon: Table2,
    href: "/tools/pivot",
    gradient: "from-cyan-500 to-blue-500",
    glow: "shadow-cyan-500/20 group-hover:shadow-cyan-500/40",
    tag: "Analysis",
    category: "work",
  },
  {
    id: "tailan",
    matchIds: ["tailan", "tailan_dept_head"],
    title: "Улирлын тайлан",
    description:
      "Улирлын ажлын тайлан бэлтгэх, хэлтсийн ахлагч руу илгээх, нэгтгэл татах",
    icon: FileText,
    href: "/tools/tailan",
    gradient: "from-violet-500 to-purple-500",
    glow: "shadow-violet-500/20 group-hover:shadow-violet-500/40",
    tag: "Report",
    category: "work",
  },
  {
    id: "db_access_requester",
    title: "Эрх Хүсэх",
    description:
      "ClickHouse хүснэгтэд хандах эрх хүсэх, өөрийн хүсэлтүүдийг хянах",
    icon: Database,
    href: "/tools/db-access",
    gradient: "from-cyan-500 to-teal-500",
    glow: "shadow-cyan-500/20 group-hover:shadow-cyan-500/40",
    tag: "Security",
    category: "work",
  },
  {
    id: "db_access_granter",
    title: "Эрх Олгох",
    description:
      "ClickHouse хандалтын хүсэлтүүдийг хянаж зөвшөөрөх, татгалзах, эрхийг удирдах",
    icon: Database,
    href: "/tools/db-access/manage",
    gradient: "from-violet-500 to-indigo-500",
    glow: "shadow-violet-500/20 group-hover:shadow-violet-500/40",
    tag: "Security",
    category: "work",
  },
];

const PARTICLES = [
  { l: 15, t: 25 },
  { l: 85, t: 10 },
  { l: 45, t: 80 },
  { l: 70, t: 35 },
  { l: 25, t: 60 },
  { l: 90, t: 70 },
  { l: 10, t: 90 },
  { l: 55, t: 15 },
  { l: 35, t: 45 },
  { l: 80, t: 55 },
  { l: 5, t: 40 },
  { l: 60, t: 95 },
];

function ToolCard({ tool, index }: { tool: Tool; index: number }) {
  const Icon = tool.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.09, duration: 0.4 }}
    >
      <Link href={tool.href} className="group block h-full">
        <div
          className={`
            relative h-full rounded-2xl
            bg-slate-800/60 backdrop-blur-xl
            border border-slate-700/50
            hover:border-slate-600/70
            shadow-xl ${tool.glow}
            transition-all duration-300
            overflow-hidden
          `}
        >
          {/* gradient accent top strip */}
          <div
            className={`absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r ${tool.gradient} opacity-70 group-hover:opacity-100 transition-opacity`}
          />
          {/* soft glow behind icon */}
          <div
            className={`absolute -top-10 -right-10 w-40 h-40 rounded-full bg-gradient-to-br ${tool.gradient} opacity-5 group-hover:opacity-10 blur-2xl transition-opacity`}
          />
          <div className="relative p-4 flex flex-col h-full">
            {/* top row: icon + tag */}
            <div className="flex items-start justify-between mb-3">
              <div
                className={`w-9 h-9 rounded-xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center shadow-md`}
              >
                <Icon className="w-4 h-4 text-white" />
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[9px] font-semibold bg-gradient-to-r ${tool.gradient} text-white opacity-80 group-hover:opacity-100 transition-opacity`}
              >
                {tool.tag}
              </span>
            </div>
            {/* text */}
            <div className="flex-1">
              <h2 className="text-sm font-bold text-white mb-1 leading-snug">
                {tool.title}
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                {tool.description}
              </p>
            </div>
            {/* bottom cta */}
            <div className="mt-3 flex items-center gap-1 text-xs font-medium text-slate-400 group-hover:text-white opacity-70 group-hover:opacity-100 transition-all">
              Нээх
              <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function ToolsPage() {
  const { user, loading: authLoading } = useAuth();
  const [allowedTools, setAllowedTools] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }
      if (user.isAdmin) {
        setAllowedTools(allTools.map((t) => t.id));
        setIsLoading(false);
        return;
      }
      try {
        const fresh = await usersApi.getOne(user.id);
        setAllowedTools(fresh.allowedTools || []);
      } catch {
        setAllowedTools(user.allowedTools || []);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [user]);

  const available = allTools.filter((t) => {
    const ids = t.matchIds ?? [t.id];
    return ids.some((id) => allowedTools.includes(id));
  });

  const freeTools = available.filter((t) => t.category === "free");
  const workTools = available.filter((t) => t.category === "work");

  /*  BG  */
  const BG = (
    <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <motion.div
        className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-purple-600/10 to-transparent rounded-full blur-3xl"
        animate={{ x: [0, 100, 0], y: [0, 50, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-pink-600/8 to-transparent rounded-full blur-3xl"
        animate={{ x: [0, -100, 0], y: [0, -50, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 27, repeat: Infinity, ease: "linear" }}
      />
      {PARTICLES.map((p, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-purple-400/20 rounded-full"
          style={{ left: `${p.l}%`, top: `${p.t}%` }}
          animate={{ y: [0, -20, 0], opacity: [0.2, 0.6, 0.2] }}
          transition={{
            duration: 3 + (i % 4),
            repeat: Infinity,
            delay: (i % 8) * 0.3,
          }}
        />
      ))}
    </div>
  );

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        {BG}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative z-10 text-center"
        >
          <Loader2 className="w-12 h-12 animate-spin text-purple-500 mx-auto mb-4" />
          <p className="text-slate-400">Ачаалж байна...</p>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        {BG}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 text-center"
        >
          <div className="w-20 h-20 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Нэвтрэх шаардлагатай
          </h2>
          <p className="text-slate-400">
            Хэрэгслүүдийг ашиглахын тулд нэвтэрнэ үү.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {BG}

      <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 py-8">
        {/*  Page header  */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-xl shadow-purple-500/30">
              <Wrench className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs text-purple-400/80 font-medium flex items-center gap-1.5 mb-0.5">
                <Star className="w-3 h-3" /> DaHUB Internal Audit
              </p>
              <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                Хэрэгслүүд
              </h1>
            </div>
          </div>
          <p className="text-slate-400 ml-16 text-sm">
            Дотоод аудитын ажлыг хөнгөвчлөх {available.length} хэрэгсэл
          </p>
        </motion.div>

        {available.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center min-h-[50vh] text-center"
          >
            <div className="p-8 rounded-3xl bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 mb-6">
              <Lock className="w-16 h-16 text-slate-500 mx-auto" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">
              Хэрэгсэл олдсонгүй
            </h2>
            <p className="text-slate-400 max-w-md">
              Танд ашиглах боломжтой хэрэгсэл байхгүй байна. Админтай холбогдож
              эрх авна уу.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {/* ── Чөлөөт хэрэгслүүд ── */}
            {freeTools.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-white">
                      Чөлөөт хэрэгслүүд
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {freeTools.length}
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-slate-700/50" />
                </div>
                <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                  {freeTools.map((tool, i) => (
                    <ToolCard key={tool.id} tool={tool} index={i} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Ажлын хэрэгслүүд ── */}
            {workTools.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-white">
                      Ажлын хэрэгслүүд
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                      {workTools.length}
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-slate-700/50" />
                </div>
                <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                  {workTools.map((tool, i) => (
                    <ToolCard key={tool.id} tool={tool} index={i} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
