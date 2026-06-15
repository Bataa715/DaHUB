"use client";

import { useState, useEffect } from "react";
import { departmentsApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DepartmentUser {
  id: string;
  name: string;
  email: string;
  position?: string;
  isActive?: boolean;
  profileImage?: string | null;
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

// ── EmployeeCard ───────────────────────────────────────────────────────────
const getInitials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

function nameHash(str: string) {
  return str.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

const HERO_GRADIENTS = [
  "from-blue-600 via-violet-700 to-purple-800",
  "from-cyan-500 via-blue-600 to-indigo-700",
  "from-emerald-500 via-teal-600 to-cyan-700",
  "from-amber-500 via-orange-500 to-red-600",
  "from-indigo-500 via-blue-600 to-sky-600",
  "from-teal-500 via-emerald-600 to-green-700",
  "from-violet-600 via-indigo-700 to-blue-800",
  "from-sky-500 via-cyan-600 to-teal-700",
];

const CARD_BORDER_COLORS = [
  { border: "border-blue-500", text: "text-blue-400", bg: "bg-blue-500/5" },
  {
    border: "border-violet-500",
    text: "text-violet-400",
    bg: "bg-violet-500/5",
  },
  {
    border: "border-emerald-500",
    text: "text-emerald-400",
    bg: "bg-emerald-500/5",
  },
  { border: "border-amber-500", text: "text-amber-400", bg: "bg-amber-500/5" },
  { border: "border-cyan-500", text: "text-cyan-400", bg: "bg-cyan-500/5" },
  {
    border: "border-indigo-500",
    text: "text-indigo-400",
    bg: "bg-indigo-500/5",
  },
  { border: "border-teal-500", text: "text-teal-400", bg: "bg-teal-500/5" },
  { border: "border-sky-500", text: "text-sky-400", bg: "bg-sky-500/5" },
];

function getHeroGradient(name: string) {
  return HERO_GRADIENTS[nameHash(name) % HERO_GRADIENTS.length];
}
function getCardColor(name: string) {
  return CARD_BORDER_COLORS[nameHash(name) % CARD_BORDER_COLORS.length];
}

// ── EmployeeCard ───────────────────────────────────────────────────────────
function EmployeeCard({
  member,
  isSelf,
  isManager,
}: {
  member: DepartmentUser;
  isSelf: boolean;
  isManager: boolean;
}) {
  const { t } = useLanguage();
  const color = getCardColor(member.name);

  return (
    <div
      className={`rounded-3xl border-2 ${color.border} ${color.bg} p-4 flex flex-col items-center gap-3 text-center transition-all duration-300 shadow-premium hover:shadow-premium-lg hover:-translate-y-0.5 ${
        isSelf ? "ring-2 ring-blue-500/30" : ""
      }`}
    >
      {/* Avatar */}
      {member.profileImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={member.profileImage}
          alt={member.name}
          className="w-20 h-20 rounded-full object-cover ring-2 ring-border"
        />
      ) : (
        <div className="w-20 h-20 rounded-full bg-background border-2 border-zinc-600 flex items-center justify-center text-foreground font-black text-xl">
          {getInitials(member.name)}
        </div>
      )}

      {/* Name + position */}
      <div className="w-full">
        <p className="text-xs font-bold text-foreground leading-snug">
          {member.name}
        </p>
        {member.position && (
          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
            {member.position}
          </p>
        )}
      </div>

      {/* Badges */}
      <div className="flex flex-wrap justify-center gap-1.5">
        {isSelf && (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            {t("youBadge")}
          </span>
        )}
        {isManager && !isSelf && (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            {t("managerBadge")}
          </span>
        )}
      </div>
    </div>
  );
}

// ── MemberGrid ─────────────────────────────────────────────────────────────
function MemberGrid({
  members,
  currentUserId,
  managerName,
}: {
  members: DepartmentUser[];
  currentUserId: string;
  managerName?: string;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {members.map((m) => (
        <EmployeeCard
          key={m.id}
          member={m}
          isSelf={m.id === currentUserId}
          isManager={!!managerName && m.name === managerName}
        />
      ))}
    </div>
  );
}

// ── DeptDetailView ─────────────────────────────────────────────────────────
function DeptDetailView({
  dept,
  onBack,
}: {
  dept: DepartmentData;
  onBack: () => void;
}) {
  const color = getCardColor(dept.name);
  const members = dept.users ?? [];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className={`relative w-full border-b-2 ${color.border}`}>
        <div className="max-w-6xl mx-auto px-6 pt-8 pb-12">
          {/* Back button */}
          <button
            onClick={onBack}
            className={`mb-6 flex items-center gap-2 px-4 py-2 rounded-full border-2 ${color.border} ${color.text} ${color.bg} text-sm font-semibold transition-all hover:opacity-80`}
          >
            <ChevronLeft className="w-4 h-4" />
            Буцах
          </button>
          <p className="text-muted-foreground text-[11px] uppercase tracking-[0.2em] font-semibold mb-4">
            Хэлтэс
          </p>
          <h1 className="text-4xl sm:text-5xl font-black text-foreground tracking-tight leading-tight">
            {dept.name}
          </h1>
          {dept.description && (
            <p className="mt-4 text-muted-foreground text-base max-w-2xl leading-relaxed">
              {dept.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 mt-8">
            <div
              className={`px-5 py-2.5 rounded-full border-2 ${color.border} ${color.text} text-sm font-bold tabular-nums`}
            >
              {members.length} ажилтан
            </div>
            {dept.manager && (
              <div className="px-5 py-2.5 rounded-full border border-amber-500/50 text-amber-600 dark:text-amber-400 text-sm font-semibold">
                {dept.manager}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        {members.length > 0 && (
          <section>
            <div className="mb-5">
              <h2 className="text-xl font-black text-foreground">Баг</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {members.length} ажилтан
              </p>
            </div>
            <MemberGrid
              members={members}
              currentUserId=""
              managerName={dept.manager}
            />
          </section>
        )}

        {dept.description && dept.description.length > 80 && (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-premium ring-hairline">
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-1 h-6 rounded-full ${color.border} border-l-4`}
              />
              <h2 className="text-sm font-bold text-foreground uppercase tracking-widest">
                Тайлбар
              </h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {dept.description}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

// ── OtherDeptViewer ────────────────────────────────────────────────────────
function OtherDeptViewer({
  currentDeptId,
  onSelect,
}: {
  currentDeptId: string;
  onSelect: (dept: DepartmentData) => void;
}) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [list, setList] = useState<DepartmentData[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    departmentsApi
      .getAll()
      .then((data: DepartmentData[]) => {
        const filtered = data.filter((d) => d.id !== currentDeptId);
        filtered.sort((a, b) => {
          const aL = a.name.trim().toLowerCase().includes("удирдлага");
          const bL = b.name.trim().toLowerCase().includes("удирдлага");
          if (aL && !bL) return -1;
          if (!aL && bL) return 1;
          return 0;
        });
        setList(filtered);
      })
      .catch(() =>
        toast({
          title: t("error"),
          description: t("deptsLoadError"),
          variant: "destructive",
        }),
      )
      .finally(() => setLoadingList(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDeptId]);

  const selectDept = async (dept: DepartmentData) => {
    setLoadingId(dept.id);
    try {
      const full = await departmentsApi.getOne(dept.id);
      onSelect(full);
    } catch {
      toast({
        title: t("error"),
        description: t("deptDetailLoadError"),
        variant: "destructive",
      });
    } finally {
      setLoadingId(null);
    }
  };

  if (loadingList) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <p className="text-muted-foreground/60 text-sm text-center py-6">
        {t("noOtherDepts")}
      </p>
    );
  }

  return (
    <div className="-mx-6 px-6 overflow-x-auto pb-2">
      <div className="flex gap-4" style={{ minWidth: "max-content" }}>
        {list.map((dept) => {
          const color = getCardColor(dept.name);
          const count = dept.users?.length ?? dept.employeeCount ?? 0;
          const isLoading = loadingId === dept.id;
          return (
            <button
              key={dept.id}
              onClick={() => selectDept(dept)}
              disabled={loadingId !== null}
              className={`group w-52 flex-shrink-0 rounded-2xl border-2 ${color.border} ${color.bg} text-left p-4 transition-all duration-300 hover:-translate-y-1.5 shadow-premium hover:shadow-premium-lg disabled:opacity-60`}
            >
              {/* Initials badge */}
              <div
                className={`w-9 h-9 rounded-xl border ${color.border} ${color.text} flex items-center justify-center font-black text-xs mb-3`}
              >
                {getInitials(dept.name)}
              </div>
              <p className="text-xs font-bold text-foreground leading-snug line-clamp-2">
                {dept.name}
              </p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {count} ажилтан
                </span>
                {isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                ) : (
                  <ChevronRight
                    className={`w-3.5 h-3.5 ${color.text} opacity-40 group-hover:opacity-100 transition-opacity`}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function DepartmentsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [department, setDepartment] = useState<DepartmentData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [viewingDept, setViewingDept] = useState<DepartmentData | null>(null);
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
        title: t("error"),
        description: t("deptLoadError"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-muted mx-auto mb-4 flex items-center justify-center text-3xl">
            🔒
          </div>
          <h2 className="text-lg font-bold text-foreground">
            {t("needLogin")}
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            {t("needLoginDeptDesc")}
          </p>
        </div>
      </div>
    );
  }

  if (!user.department || !department) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-muted mx-auto mb-4 flex items-center justify-center text-3xl">
            🏢
          </div>
          <h2 className="text-lg font-bold text-foreground">
            {t("deptUnknownTitle")}
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            {t("deptUnknownDesc")}
          </p>
        </div>
      </div>
    );
  }

  const members = department.users ?? [];
  const totalCount = members.length || department.employeeCount || 0;
  const currentUserId = user?.id ?? user?.userId ?? "";
  const heroGrad = getHeroGradient(department.name);
  const heroColor = getCardColor(department.name);

  // ── Full-page detail view for another department ──
  if (viewingDept) {
    return (
      <DeptDetailView dept={viewingDept} onBack={() => setViewingDept(null)} />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <div className={`relative w-full border-b-2 ${heroColor.border}`}>
        <div className="max-w-6xl mx-auto px-6 pt-12 pb-14">
          <p className="text-muted-foreground text-[11px] uppercase tracking-[0.2em] font-semibold mb-4">
            {t("myDept")}
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-foreground tracking-tight leading-tight">
            {department.name}
          </h1>
          {department.description && (
            <p className="mt-4 text-muted-foreground text-base max-w-2xl leading-relaxed">
              {department.description}
            </p>
          )}

          {/* Stat pills */}
          <div className="flex flex-wrap items-center gap-3 mt-8">
            <div className="px-5 py-2.5 rounded-full border border-border text-foreground text-sm font-bold tabular-nums">
              {totalCount} ажилтан
            </div>
            {department.manager && (
              <div className="px-5 py-2.5 rounded-full border border-amber-500/50 text-amber-600 dark:text-amber-400 text-sm font-semibold">
                {department.manager}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── CONTENT ──────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        {/* ── MEMBERS ──────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 className="text-xl font-black text-foreground">
                {t("teamTitle")}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {totalCount} ажилтан
              </p>
            </div>
          </div>

          {members.length > 0 ? (
            <MemberGrid
              members={members}
              currentUserId={currentUserId}
              managerName={department.manager}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-border py-16 flex flex-col items-center gap-3 text-muted-foreground">
              <span className="text-4xl">👤</span>
              <p className="text-sm">{t("noEmployees")}</p>
            </div>
          )}
        </section>

        {/* ── DESCRIPTION (if long) ─────────────────────────────────────── */}
        {department.description && department.description.length > 80 && (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-premium ring-hairline">
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-1 h-6 rounded-full bg-gradient-to-b ${heroGrad}`}
              />
              <h2 className="text-sm font-bold text-foreground uppercase tracking-widest">
                {t("missionTitle")}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {department.description}
            </p>
          </section>
        )}

        {/* ── OTHER DEPARTMENTS ────────────────────────────────────────── */}
        <section>
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 className="text-xl font-black text-foreground">
                {t("otherDeptsTitle")}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Бусад хэлтсүүдийн мэдээлэл
              </p>
            </div>
          </div>
          {department.id && (
            <OtherDeptViewer
              currentDeptId={department.id}
              onSelect={(dept) => setViewingDept(dept)}
            />
          )}
        </section>
      </div>
    </div>
  );
}
