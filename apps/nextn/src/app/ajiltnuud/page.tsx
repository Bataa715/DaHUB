"use client";

import { useState, useEffect } from "react";
import { departmentsApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2, Users, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DepartmentUser {
  id: string;
  userId?: string;
  name: string;
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
}

// ── Helpers ─────────────────────────────────────────────────────────────────
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

const CARD_COLORS = [
  { border: "border-blue-500", text: "text-blue-500", bg: "bg-blue-500/5" },
  {
    border: "border-violet-500",
    text: "text-violet-500",
    bg: "bg-violet-500/5",
  },
  {
    border: "border-emerald-500",
    text: "text-emerald-500",
    bg: "bg-emerald-500/5",
  },
  { border: "border-amber-500", text: "text-amber-500", bg: "bg-amber-500/5" },
  { border: "border-cyan-500", text: "text-cyan-500", bg: "bg-cyan-500/5" },
  {
    border: "border-indigo-500",
    text: "text-indigo-500",
    bg: "bg-indigo-500/5",
  },
  { border: "border-teal-500", text: "text-teal-500", bg: "bg-teal-500/5" },
  { border: "border-sky-500", text: "text-sky-500", bg: "bg-sky-500/5" },
];

function getColor(name: string) {
  return CARD_COLORS[nameHash(name) % CARD_COLORS.length];
}

function isLeadership(name: string) {
  return name.trim().toLowerCase().includes("удирдлага");
}

// ── EmployeeCard ─────────────────────────────────────────────────────────────
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
  const color = getColor(member.name);

  return (
    <div
      className={`w-44 flex-shrink-0 rounded-2xl border-2 ${color.border} ${color.bg} p-4 flex flex-col items-center gap-3 text-center transition-all duration-300 shadow-premium hover:shadow-premium-lg hover:-translate-y-0.5 ${
        isSelf ? "ring-2 ring-blue-500/30" : ""
      }`}
    >
      {member.profileImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={member.profileImage}
          alt={member.name}
          className="w-20 h-20 rounded-full object-cover ring-2 ring-border"
        />
      ) : (
        <div className="w-20 h-20 rounded-full bg-background border-2 border-zinc-400 dark:border-zinc-600 flex items-center justify-center text-foreground font-black text-xl">
          {getInitials(member.name)}
        </div>
      )}

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

// ── DepartmentRow ─────────────────────────────────────────────────────────────
function DepartmentRow({
  dept,
  currentUserId,
}: {
  dept: DepartmentData;
  currentUserId: string;
}) {
  const color = getColor(dept.name);
  const members = dept.users ?? [];

  return (
    <section>
      {/* Department heading line */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`w-10 h-10 rounded-xl border-2 ${color.border} ${color.text} ${color.bg} flex items-center justify-center font-black text-xs flex-shrink-0`}
        >
          {getInitials(dept.name)}
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-black text-foreground tracking-tight truncate">
            {dept.name}
          </h2>
          <p className="text-xs text-muted-foreground tabular-nums">
            {members.length} ажилтан
          </p>
        </div>
        <div className={`flex-1 h-[2px] rounded-full ${color.bg}`} />
      </div>

      {/* Employees on one horizontal line */}
      {members.length > 0 ? (
        <div className="flex gap-4 overflow-x-auto pb-3 -mx-1 px-1">
          {members.map((m) => (
            <EmployeeCard
              key={m.id}
              member={m}
              isSelf={m.id === currentUserId}
              isManager={!!dept.manager && m.name === dept.manager}
            />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground/60 text-sm py-4">
          Ажилтан бүртгэгдээгүй байна
        </p>
      )}
    </section>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function EmployeesPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [departments, setDepartments] = useState<DepartmentData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsLoading(false);
      return;
    }
    departmentsApi
      .getAll()
      .then((data: DepartmentData[]) => {
        const sorted = [...data].sort((a, b) => {
          const aL = isLeadership(a.name);
          const bL = isLeadership(b.name);
          if (aL && !bL) return -1;
          if (!aL && bL) return 1;
          return a.name.localeCompare(b.name, "mn");
        });
        setDepartments(sorted);
      })
      .catch(() =>
        toast({
          title: t("error"),
          description: t("deptsLoadError"),
          variant: "destructive",
        }),
      )
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  const currentUserId = user?.id ?? user?.userId ?? "";

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
          <div className="w-16 h-16 rounded-2xl bg-muted mx-auto mb-4 flex items-center justify-center">
            <Lock className="w-8 h-8 text-muted-foreground" />
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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-11 h-11 rounded-2xl bg-foreground/5 border border-border flex items-center justify-center shadow-premium ring-hairline">
            <Users className="w-5 h-5 text-foreground/70" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 mb-0.5">
              {t("navEmployees")}
            </p>
            <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">
              {t("navEmployees")}
            </h1>
          </div>
        </div>

        {/* Department rows */}
        {departments.length > 0 ? (
          <div className="space-y-10">
            {departments.map((dept) => (
              <DepartmentRow
                key={dept.id}
                dept={dept}
                currentUserId={currentUserId}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border py-16 flex flex-col items-center gap-3 text-muted-foreground">
            <Users className="w-8 h-8" />
            <p className="text-sm">{t("noEmployees")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
