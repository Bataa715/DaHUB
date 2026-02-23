"use client";

import { useState, useEffect, useRef } from "react";
import { departmentsApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  Loader2,
  Building2,
  Users,
  Briefcase,
  Target,
  Mail,
  User,
  Lock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Camera,
  ImageIcon,
  Crown,
  Star,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DepartmentUser {
  id: string;
  name: string;
  email: string;
  position?: string;
  isActive?: boolean;
}

interface DepartmentData {
  id: string;
  name: string;
  description?: string;
  manager?: string;
  employeeCount?: number;
  users?: DepartmentUser[];
  createdAt?: string;
  updatedAt?: string;
}

/*  helpers  */
const AVATAR_GRADIENTS = [
  "from-violet-500 to-purple-600",
  "from-blue-500 to-cyan-500",
  "from-emerald-500 to-teal-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-500",
  "from-indigo-500 to-blue-600",
  "from-fuchsia-500 to-violet-600",
  "from-teal-500 to-emerald-500",
];

const getGradient = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
};

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

const ALBUM_TILES = [
  { from: "from-blue-600", to: "to-cyan-400", label: "Хэлтсийн арга хэмжээ" },
  { from: "from-violet-600", to: "to-fuchsia-400", label: "Сургалт 2025" },
  { from: "from-emerald-600", to: "to-teal-400", label: "Баг уулзалт" },
  { from: "from-rose-600", to: "to-pink-400", label: "Тэмдэглэлт өдөр" },
  { from: "from-amber-600", to: "to-orange-400", label: "Талархлын уулзалт" },
  { from: "from-indigo-600", to: "to-blue-400", label: "Шинэ жилийн баяр" },
];

const PARTICLES = [
  { l: 8, t: 18 },
  { l: 88, t: 12 },
  { l: 48, t: 78 },
  { l: 22, t: 42 },
  { l: 72, t: 58 },
  { l: 14, t: 72 },
  { l: 82, t: 32 },
  { l: 38, t: 8 },
  { l: 62, t: 88 },
  { l: 28, t: 52 },
  { l: 68, t: 22 },
  { l: 4, t: 62 },
];

/* 
   EMPLOYEE CARD
 */
function EmployeeCard({
  member,
  isSelf,
  isManager,
}: {
  member: DepartmentUser;
  isSelf: boolean;
  isManager: boolean;
}) {
  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="relative flex-shrink-0 w-52 bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5 flex flex-col items-center gap-3 shadow-xl hover:border-blue-500/40 hover:shadow-blue-500/10 transition-colors"
    >
      {(isSelf || isManager) && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          {isSelf ? (
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/90 text-white shadow whitespace-nowrap">
              <User className="w-2.5 h-2.5" /> Та
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/90 text-white shadow whitespace-nowrap">
              <Crown className="w-2.5 h-2.5" /> Менежер
            </span>
          )}
        </div>
      )}

      <div
        className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${getGradient(member.name)} flex items-center justify-center shadow-lg text-white text-xl font-bold ring-4 ring-white/5`}
      >
        {getInitials(member.name)}
      </div>

      <div className="text-center w-full">
        <p className="font-semibold text-white leading-tight truncate w-full text-center">
          {member.name}
        </p>
        {member.position && (
          <p className="mt-0.5 text-xs text-slate-400 flex items-center justify-center gap-1">
            <Briefcase className="w-3 h-3 shrink-0" />
            <span className="truncate max-w-[140px]">{member.position}</span>
          </p>
        )}
        <p className="mt-1 text-xs text-slate-500 flex items-center justify-center gap-1">
          <Mail className="w-3 h-3 shrink-0" />
          <span className="truncate max-w-[140px]">{member.email}</span>
        </p>
      </div>

      {member.isActive !== false && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Идэвхтэй
        </div>
      )}
    </motion.div>
  );
}

/* 
   CAROUSEL
 */
function MemberCarousel({
  members,
  currentUserId,
  managerName,
}: {
  members: DepartmentUser[];
  currentUserId: string;
  managerName?: string;
}) {
  const [idx, setIdx] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const CARD_W = 224;

  const max = Math.max(0, members.length - 1);
  const prev = () => setIdx((i) => Math.max(0, i - 1));
  const next = () => setIdx((i) => Math.min(max, i + 1));

  useEffect(() => {
    if (trackRef.current) {
      trackRef.current.scrollTo({ left: idx * CARD_W, behavior: "smooth" });
    }
  }, [idx]);

  return (
    <div className="relative">
      <div
        ref={trackRef}
        className="flex gap-4 overflow-x-hidden scroll-smooth py-5 px-2"
        style={{ scrollbarWidth: "none" }}
      >
        {members.map((m) => (
          <EmployeeCard
            key={m.id}
            member={m}
            isSelf={m.id === currentUserId}
            isManager={!!managerName && m.name === managerName}
          />
        ))}
      </div>

      {members.length > 3 && (
        <div className="flex items-center justify-center gap-3 mt-2">
          <button
            onClick={prev}
            disabled={idx === 0}
            className="p-2 rounded-full bg-slate-700/60 hover:bg-blue-500/70 disabled:opacity-30 text-white transition-all hover:scale-110 disabled:scale-100"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex gap-1.5">
            {members.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`rounded-full transition-all ${
                  i === idx
                    ? "w-6 h-2 bg-blue-500"
                    : "w-2 h-2 bg-slate-600 hover:bg-slate-500"
                }`}
              />
            ))}
          </div>

          <button
            onClick={next}
            disabled={idx === max}
            className="p-2 rounded-full bg-slate-700/60 hover:bg-blue-500/70 disabled:opacity-30 text-white transition-all hover:scale-110 disabled:scale-100"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}

/* 
   MAIN PAGE
 */
export default function DepartmentsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [department, setDepartment] = useState<DepartmentData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (user?.department) {
      setIsLoading(true);
      loadDepartment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.department, authLoading]);

  const loadDepartment = async () => {
    if (!user?.department) return;
    try {
      const data = await departmentsApi.getByName(user.department);
      setDepartment(data);
    } catch {
      toast({
        title: "Алдаа",
        description: "Хэлтсийн мэдээлэл ачаалахад алдаа гарлаа.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const BG = (
    <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pointer-events-none">
      <motion.div
        className="absolute -top-1/2 -left-1/4 w-3/4 h-3/4 bg-gradient-to-br from-blue-600/8 to-transparent rounded-full blur-3xl"
        animate={{ x: [0, 80, 0], y: [0, 40, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute -bottom-1/3 -right-1/4 w-3/4 h-3/4 bg-gradient-to-tl from-cyan-600/8 to-transparent rounded-full blur-3xl"
        animate={{ x: [0, -80, 0], y: [0, -40, 0] }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
      />
      {PARTICLES.map((p, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-blue-400/25 rounded-full"
          style={{ left: `${p.l}%`, top: `${p.t}%` }}
          animate={{ y: [0, -18, 0], opacity: [0.2, 0.6, 0.2] }}
          transition={{
            duration: 3 + (i % 4),
            repeat: Infinity,
            delay: (i % 8) * 0.35,
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
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-slate-400">Ачаалж байна</p>
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
            Энэ хуудсыг үзэхийн тулд нэвтэрнэ үү.
          </p>
        </motion.div>
      </div>
    );
  }

  if (!user.department || !department) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        {BG}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 text-center"
        >
          <div className="w-20 h-20 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto mb-6">
            <Building2 className="w-10 h-10 text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Хэлтэс тодорхойгүй
          </h2>
          <p className="text-slate-400">
            Таны хэлтэс тодорхойлогдоогүй байна. Админтай холбогдоно уу.
          </p>
        </motion.div>
      </div>
    );
  }

  const members = department.users ?? [];
  const totalCount = members.length || department.employeeCount || 0;

  return (
    <div className="min-h-screen relative overflow-hidden">
      {BG}

      <div className="relative z-10 py-10 px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-5xl mx-auto"
        >
          {/* Outer frame container */}
          <div className="rounded-3xl border border-slate-700/60 bg-slate-900/70 backdrop-blur-2xl shadow-2xl shadow-black/40 overflow-hidden">
            {/*  HERO BANNER  */}
            <div className="relative h-52 bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 overflow-hidden">
              <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full bg-white/5" />
              <div className="absolute -bottom-16 -left-8 w-56 h-56 rounded-full bg-white/5" />
              <div className="absolute top-6 right-24 w-20 h-20 rounded-full bg-white/5" />
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)",
                  backgroundSize: "40px 40px",
                }}
              />
              <div className="absolute inset-0 flex flex-col justify-end p-8">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex items-end gap-4"
                >
                  <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shadow-xl ring-4 ring-white/10 mb-1">
                    <Building2 className="w-9 h-9 text-white" />
                  </div>
                  <div>
                    <p className="text-white/70 text-sm font-medium flex items-center gap-1.5 mb-1">
                      <Sparkles className="w-3.5 h-3.5" /> Миний хэлтэс
                    </p>
                    <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight drop-shadow">
                      {department.name}
                    </h1>
                  </div>
                </motion.div>
              </div>
            </div>

            {/*  INNER CONTENT  */}
            <div className="p-6 md:p-8 space-y-8">
              {/* Description */}
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Target className="w-4 h-4 text-blue-400" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">
                    Чиг үүрэг
                  </h2>
                </div>
                <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-5">
                  {department.description ? (
                    <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {department.description}
                    </p>
                  ) : (
                    <div className="flex items-center gap-3 text-slate-500 italic">
                      <Target className="w-5 h-5 text-slate-600 shrink-0" />
                      <span>
                        Тайлбар оруулаагүй байна. Админ энэ мэдээллийг нэмж
                        болно.
                      </span>
                    </div>
                  )}
                </div>
              </motion.section>

              <div className="border-t border-slate-700/50" />

              {/* Employee Carousel */}
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                      <Users className="w-4 h-4 text-cyan-400" />
                    </div>
                    <h2 className="text-lg font-semibold text-white">
                      Хамт олон
                    </h2>
                  </div>
                  <Badge className="bg-blue-500/15 text-blue-300 border-blue-500/30 text-xs">
                    {totalCount} ажилтан
                  </Badge>
                </div>

                {members.length > 0 ? (
                  <MemberCarousel
                    members={members}
                    currentUserId={
                      user.id ?? (user as { userId?: string }).userId ?? ""
                    }
                    managerName={department.manager}
                  />
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-800/30 py-14 flex flex-col items-center gap-3 text-slate-500">
                    <Users className="w-10 h-10 text-slate-600" />
                    <p className="text-sm">Ажилтан бүртгэгдээгүй байна</p>
                  </div>
                )}
              </motion.section>

              <div className="border-t border-slate-700/50" />

              {/* Photo Album */}
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-rose-500/20 flex items-center justify-center">
                      <Camera className="w-4 h-4 text-rose-400" />
                    </div>
                    <h2 className="text-lg font-semibold text-white">Альбом</h2>
                  </div>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5" />
                    {ALBUM_TILES.length} зураг
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {ALBUM_TILES.map((tile, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.65 + i * 0.07 }}
                      whileHover={{ scale: 1.03 }}
                      className="group relative rounded-2xl overflow-hidden cursor-pointer aspect-[4/3]"
                    >
                      <div
                        className={`absolute inset-0 bg-gradient-to-br ${tile.from} ${tile.to} opacity-80 group-hover:opacity-100 transition-opacity`}
                      />
                      <div
                        className="absolute inset-0 opacity-20"
                        style={{
                          backgroundImage:
                            "radial-gradient(circle, rgba(255,255,255,.3) 1px, transparent 1px)",
                          backgroundSize: "20px 20px",
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                      <div className="absolute bottom-0 inset-x-0 p-3 translate-y-1 group-hover:translate-y-0 transition-transform">
                        <p className="text-white text-xs font-medium line-clamp-1">
                          {tile.label}
                        </p>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-20 group-hover:opacity-40 transition-opacity">
                        <ImageIcon className="w-10 h-10 text-white" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.section>

              {/* Footer ribbon */}
              <div className="flex items-center justify-center gap-2 pt-2">
                <Star className="w-3.5 h-3.5 text-blue-500/50" />
                <p className="text-xs text-slate-600">
                  {department.name} DaHUB Internal Audit
                </p>
                <Star className="w-3.5 h-3.5 text-blue-500/50" />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
