"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { departmentsApi } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2, X, Search } from "lucide-react";

interface Employee {
  id: string;
  name: string;
  position?: string;
  profileImage?: string | null;
  department?: string;
}

interface DepartmentData {
  id: string;
  name: string;
  manager?: string;
  users?: Employee[];
}

// ── helpers ──────────────────────────────────────────────────────────────
function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  "from-violet-500 to-indigo-600",
  "from-rose-500 to-pink-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-sky-500 to-blue-600",
  "from-fuchsia-500 to-purple-600",
  "from-cyan-500 to-blue-500",
  "from-lime-500 to-green-600",
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++)
    h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ── Employee card ─────────────────────────────────────────────────────────
function EmployeeCard({
  emp,
  onClick,
}: {
  emp: Employee & { department: string };
  onClick: () => void;
}) {
  const grad = avatarColor(emp.name);
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center gap-2 px-3 py-4 rounded-2xl border border-border bg-card hover:border-foreground/20 hover:shadow-sm transition-all text-left w-full"
    >
      {emp.profileImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={emp.profileImage}
          alt={emp.name}
          className="w-14 h-14 rounded-full object-cover ring-2 ring-border"
        />
      ) : (
        <div
          className={`w-14 h-14 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white text-base font-bold select-none`}
        >
          {getInitials(emp.name)}
        </div>
      )}
      <div className="w-full text-center space-y-0.5">
        <p className="text-foreground text-xs font-semibold leading-snug line-clamp-2">
          {emp.name}
        </p>
        {emp.position && (
          <p className="text-muted-foreground text-[10px] line-clamp-1">
            {emp.position}
          </p>
        )}
        <p className="text-muted-foreground/60 text-[10px] line-clamp-1">
          {emp.department}
        </p>
      </div>
    </button>
  );
}

// ── Profile Modal ─────────────────────────────────────────────────────────
function ProfileModal({
  emp,
  onClose,
}: {
  emp: Employee & { department: string };
  onClose: () => void;
}) {
  const grad = avatarColor(emp.name);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xs rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Top bar */}
        <div className="flex justify-end px-4 pt-3">
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col items-center gap-3 px-6 pb-7 pt-1">
          {emp.profileImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={emp.profileImage}
              alt={emp.name}
              className="w-20 h-20 rounded-full object-cover ring-2 ring-border"
            />
          ) : (
            <div
              className={`w-20 h-20 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white text-2xl font-bold select-none`}
            >
              {getInitials(emp.name)}
            </div>
          )}

          <div className="text-center space-y-1">
            <p className="text-foreground text-base font-bold leading-snug">
              {emp.name}
            </p>
            {emp.position && (
              <p className="text-muted-foreground text-sm">{emp.position}</p>
            )}
            <p className="text-muted-foreground/70 text-xs">{emp.department}</p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function DepartmentsPage() {
  const { t } = useLanguage();
  const [employees, setEmployees] = useState<
    (Employee & { department: string })[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<
    (Employee & { department: string }) | null
  >(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    (async () => {
      try {
        const depts: DepartmentData[] = await departmentsApi.getAll();
        // For depts that don't include users, fetch each one
        const full: DepartmentData[] = await Promise.all(
          depts.map((d) =>
            d.users
              ? Promise.resolve(d)
              : departmentsApi.getOne(d.id).catch(() => d),
          ),
        );
        const all: (Employee & { department: string })[] = [];
        for (const dept of full) {
          for (const u of dept.users ?? []) {
            all.push({ ...u, department: dept.name });
          }
        }
        // Sort by department then name
        all.sort(
          (a, b) =>
            a.department.localeCompare(b.department, "mn") ||
            a.name.localeCompare(b.name, "mn"),
        );
        setEmployees(all);
      } catch {
        // silent
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const filtered = employees.filter((e) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      e.name.toLowerCase().includes(q) ||
      e.department.toLowerCase().includes(q) ||
      (e.position ?? "").toLowerCase().includes(q)
    );
  });

  // Group by department for section headers
  const grouped: {
    dept: string;
    members: (Employee & { department: string })[];
  }[] = [];
  for (const emp of filtered) {
    const last = grouped[grouped.length - 1];
    if (last && last.dept === emp.department) {
      last.members.push(emp);
    } else {
      grouped.push({ dept: emp.department, members: [emp] });
    }
  }

  const closeModal = useCallback(() => setSelected(null), []);

  return (
    <div className="px-4 md:px-6 py-6 max-w-5xl mx-auto">
      {/* Header + search */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Хайх..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-muted border border-input text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/15 focus:border-foreground/20 transition-all"
          />
        </div>
        {!isLoading && (
          <span className="text-muted-foreground text-xs flex-shrink-0">
            {filtered.length} ажилтан
          </span>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <p className="text-sm">{t("noEmployees")}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ dept, members }) => (
            <section key={dept}>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {dept}
                </h2>
                <span className="text-muted-foreground/50 text-[10px]">
                  {members.length}
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                {members.map((emp) => (
                  <EmployeeCard
                    key={emp.id}
                    emp={emp}
                    onClick={() => setSelected(emp)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Modal */}
      {mounted && selected && (
        <ProfileModal emp={selected} onClose={closeModal} />
      )}
    </div>
  );
}
