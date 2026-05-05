"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { departmentsApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2, ChevronLeft, ChevronRight, X, Trash2 } from "lucide-react";
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

type DeptPhoto = {
  id: string;
  uploadedBy: string;
  uploadedByName: string;
  caption: string;
  imageData: string;
  uploadedAt: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────
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

const AVATAR_GRADIENTS = [
  "from-blue-400 to-violet-600",
  "from-violet-400 to-indigo-600",
  "from-emerald-400 to-teal-600",
  "from-amber-400 to-orange-500",
  "from-sky-400 to-blue-600",
  "from-cyan-400 to-teal-600",
  "from-indigo-400 to-purple-600",
  "from-teal-400 to-emerald-600",
  "from-orange-400 to-amber-600",
  "from-green-400 to-emerald-600",
];

const DEPT_COLORS = [
  {
    pill: "bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/25 text-blue-600 dark:text-blue-400",
    active: "bg-blue-500/20 border-blue-500/50 text-blue-600 dark:text-blue-300",
    header: "bg-blue-500/10 border-blue-500/20",
    dot: "bg-blue-500",
  },
  {
    pill: "bg-violet-500/10 hover:bg-violet-500/20 border-violet-500/25 text-violet-600 dark:text-violet-400",
    active: "bg-violet-500/20 border-violet-500/50 text-violet-600 dark:text-violet-300",
    header: "bg-violet-500/10 border-violet-500/20",
    dot: "bg-violet-500",
  },
  {
    pill: "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/25 text-emerald-600 dark:text-emerald-400",
    active: "bg-emerald-500/20 border-emerald-500/50 text-emerald-600 dark:text-emerald-300",
    header: "bg-emerald-500/10 border-emerald-500/20",
    dot: "bg-emerald-500",
  },
  {
    pill: "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/25 text-amber-600 dark:text-amber-400",
    active: "bg-amber-500/20 border-amber-500/50 text-amber-600 dark:text-amber-300",
    header: "bg-amber-500/10 border-amber-500/20",
    dot: "bg-amber-500",
  },
  {
    pill: "bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/25 text-rose-600 dark:text-rose-400",
    active: "bg-rose-500/20 border-rose-500/50 text-rose-600 dark:text-rose-300",
    header: "bg-rose-500/10 border-rose-500/20",
    dot: "bg-rose-500",
  },
  {
    pill: "bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/25 text-cyan-600 dark:text-cyan-400",
    active: "bg-cyan-500/20 border-cyan-500/50 text-cyan-600 dark:text-cyan-300",
    header: "bg-cyan-500/10 border-cyan-500/20",
    dot: "bg-cyan-500",
  },
  {
    pill: "bg-pink-500/10 hover:bg-pink-500/20 border-pink-500/25 text-pink-600 dark:text-pink-400",
    active: "bg-pink-500/20 border-pink-500/50 text-pink-600 dark:text-pink-300",
    header: "bg-pink-500/10 border-pink-500/20",
    dot: "bg-pink-500",
  },
  {
    pill: "bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/25 text-indigo-600 dark:text-indigo-400",
    active: "bg-indigo-500/20 border-indigo-500/50 text-indigo-600 dark:text-indigo-300",
    header: "bg-indigo-500/10 border-indigo-500/20",
    dot: "bg-indigo-500",
  },
];

const CARD_BORDER_COLORS = [
  { border: "border-blue-500",    text: "text-blue-400",    bg: "bg-blue-500/5"    },
  { border: "border-violet-500",  text: "text-violet-400",  bg: "bg-violet-500/5"  },
  { border: "border-emerald-500", text: "text-emerald-400", bg: "bg-emerald-500/5" },
  { border: "border-amber-500",   text: "text-amber-400",   bg: "bg-amber-500/5"   },
  { border: "border-cyan-500",    text: "text-cyan-400",    bg: "bg-cyan-500/5"    },
  { border: "border-indigo-500",  text: "text-indigo-400",  bg: "bg-indigo-500/5"  },
  { border: "border-teal-500",    text: "text-teal-400",    bg: "bg-teal-500/5"    },
  { border: "border-sky-500",     text: "text-sky-400",     bg: "bg-sky-500/5"     },
];

function getHeroGradient(name: string) {
  return HERO_GRADIENTS[nameHash(name) % HERO_GRADIENTS.length];
}
function getAvatarGradient(name: string) {
  return AVATAR_GRADIENTS[nameHash(name) % AVATAR_GRADIENTS.length];
}
function getDeptColor(index: number) {
  return DEPT_COLORS[index % DEPT_COLORS.length];
}
function getCardColor(name: string) {
  return CARD_BORDER_COLORS[nameHash(name) % CARD_BORDER_COLORS.length];
}

// ── Photo Modal (Lightbox) ─────────────────────────────────────────────────
function PhotoModal({
  photos,
  index,
  onClose,
  onDelete,
  onPrev,
  onNext,
}: {
  photos: DeptPhoto[];
  index: number;
  onClose: () => void;
  onDelete: (id: string) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const photo = photos[index];
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onPrev, onNext, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-5 right-5 z-10 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="absolute top-5 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-white/10 text-white/70 text-xs font-medium">
        {index + 1} / {photos.length}
      </div>
      {index > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className="absolute left-5 z-10 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      {index < photos.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="absolute right-5 z-10 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
      <div
        className="relative mx-20 max-w-4xl w-full flex flex-col items-center gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.imageData}
          alt={photo.caption || "Зураг"}
          className="block max-h-[78vh] max-w-full w-auto rounded-xl shadow-2xl"
        />
        <div className="flex items-center justify-between w-full px-2">
          <div>
            {photo.caption && (
              <p className="text-white text-sm font-semibold">{photo.caption}</p>
            )}
            <p className="text-white/50 text-xs mt-0.5">
              {photo.uploadedByName} ·{" "}
              {new Date(photo.uploadedAt).toLocaleDateString("mn-MN", {
                timeZone: "Asia/Ulaanbaatar",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <button
            onClick={() => onDelete(photo.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Устгах
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DeptAlbum ──────────────────────────────────────────────────────────────
function DeptAlbum({ deptId, deptName }: { deptId: string; deptName: string }) {
  const { t } = useLanguage();
  const [photos, setPhotos] = useState<DeptPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const loadPhotos = useCallback(async () => {
    try {
      const data = await departmentsApi.getPhotos(deptId);
      setPhotos(data);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [deptId]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  useEffect(() => {
    if (lightbox === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft")
        setLightbox((i) => (i !== null && i > 0 ? i - 1 : i));
      if (e.key === "ArrowRight")
        setLightbox((i) =>
          i !== null && i < photos.length - 1 ? i + 1 : i,
        );
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightbox, photos.length]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast({ title: t("error"), description: t("photoSizeError"), variant: "destructive" });
      return;
    }
    e.target.value = "";
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        await departmentsApi.uploadPhoto(deptId, deptName, ev.target!.result as string);
        toast({ title: t("success"), description: t("photoAdded") });
        await loadPhotos();
      } catch {
        toast({ title: t("error"), description: t("photoUploadError"), variant: "destructive" });
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = async (photoId: string) => {
    if (!confirm(t("confirmDeletePhoto"))) return;
    try {
      await departmentsApi.deletePhoto(deptId, photoId);
      if (lightbox !== null) setLightbox(null);
      await loadPhotos();
    } catch {
      toast({ title: t("error"), description: t("deleteError"), variant: "destructive" });
    }
  };

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-bold text-foreground">{t("albumTitle")}</h2>
          {photos.length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">{photos.length} зураг</p>
          )}
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="px-4 py-2 rounded-xl bg-foreground text-background text-xs font-semibold hover:opacity-80 transition-opacity disabled:opacity-40 flex items-center gap-2"
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span className="text-base leading-none">＋</span>}
          {t("addPhoto")}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-14">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : photos.length === 0 ? (
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full py-14 rounded-2xl border-2 border-dashed border-border hover:border-foreground/20 hover:bg-muted/20 flex flex-col items-center gap-3 text-muted-foreground transition-all"
        >
          <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center text-2xl">📷</div>
          <div>
            <p className="text-sm font-medium">{t("uploadPhotoPrompt")}</p>
            <p className="text-xs opacity-60 mt-1">{t("photoSizeHint")}</p>
          </div>
        </button>
      ) : (
        <div className="columns-2 sm:columns-3 lg:columns-4 gap-3">
          {photos.map((photo, i) => (
            <div
              key={photo.id}
              className="group relative rounded-xl overflow-hidden cursor-pointer bg-muted break-inside-avoid mb-3"
              onClick={() => setLightbox(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.imageData}
                alt={photo.caption || "Зураг"}
                className="w-full h-auto block group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(photo.id);
                }}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {lightbox !== null && (
        <PhotoModal
          photos={photos}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onDelete={handleDelete}
          onPrev={() => setLightbox((i) => Math.max(0, (i ?? 0) - 1))}
          onNext={() => setLightbox((i) => Math.min(photos.length - 1, (i ?? 0) + 1))}
        />
      )}
    </>
  );
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
      className={`rounded-3xl border-2 ${color.border} ${color.bg} p-4 flex flex-col items-center gap-3 text-center transition-all duration-200 hover:shadow-md ${
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
        <div
          className="w-20 h-20 rounded-full bg-zinc-900 border-2 border-zinc-600 flex items-center justify-center text-white font-black text-xl"
        >
          {getInitials(member.name)}
        </div>
      )}

      {/* Name + position */}
      <div className="w-full">
        <p className="text-xs font-bold text-foreground leading-snug">{member.name}</p>
        {member.position && (
          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{member.position}</p>
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
            <div className={`px-5 py-2.5 rounded-full border-2 ${color.border} ${color.text} text-sm font-bold tabular-nums`}>
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
              <p className="text-sm text-muted-foreground mt-0.5">{members.length} ажилтан</p>
            </div>
            <MemberGrid members={members} currentUserId="" managerName={dept.manager} />
          </section>
        )}

        {dept.description && dept.description.length > 80 && (
          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-1 h-6 rounded-full ${color.border} border-l-4`} />
              <h2 className="text-sm font-bold text-foreground uppercase tracking-widest">Тайлбар</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {dept.description}
            </p>
          </section>
        )}

        {dept.id && (
          <section className="rounded-2xl border border-border bg-card p-6">
            <DeptAlbum deptId={dept.id} deptName={dept.name} />
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
        toast({ title: t("error"), description: t("deptsLoadError"), variant: "destructive" }),
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
      toast({ title: t("error"), description: t("deptDetailLoadError"), variant: "destructive" });
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
              className={`group w-52 flex-shrink-0 rounded-2xl border-2 ${color.border} ${color.bg} text-left p-4 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg disabled:opacity-60`}
            >
              {/* Initials badge */}
              <div className={`w-9 h-9 rounded-xl border ${color.border} ${color.text} flex items-center justify-center font-black text-xs mb-3`}>
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
                  <ChevronRight className={`w-3.5 h-3.5 ${color.text} opacity-40 group-hover:opacity-100 transition-opacity`} />
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
  const [isLoading, setIsLoading] = useState(false);  const [viewingDept, setViewingDept] = useState<DepartmentData | null>(null);
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
      toast({ title: t("error"), description: t("deptLoadError"), variant: "destructive" });
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
          <h2 className="text-lg font-bold text-foreground">{t("needLogin")}</h2>
          <p className="text-sm text-muted-foreground mt-2">{t("needLoginDeptDesc")}</p>
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
          <h2 className="text-lg font-bold text-foreground">{t("deptUnknownTitle")}</h2>
          <p className="text-sm text-muted-foreground mt-2">{t("deptUnknownDesc")}</p>
        </div>
      </div>
    );
  }

  const members = department.users ?? [];
  const totalCount = members.length || department.employeeCount || 0;
  const activeCount = members.filter((m) => m.isActive !== false).length;
  const currentUserId = (user as any).id ?? (user as any).userId ?? "";
  const heroGrad = getHeroGradient(department.name);
  const heroColor = getCardColor(department.name);

  // ── Full-page detail view for another department ──
  if (viewingDept) {
    return <DeptDetailView dept={viewingDept} onBack={() => setViewingDept(null)} />;
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
              <h2 className="text-xl font-black text-foreground">{t("teamTitle")}</h2>
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
          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-1 h-6 rounded-full bg-gradient-to-b ${heroGrad}`} />
              <h2 className="text-sm font-bold text-foreground uppercase tracking-widest">
                {t("missionTitle")}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {department.description}
            </p>
          </section>
        )}

        {/* ── ALBUM ────────────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-border bg-card p-6">
          {department.id && (
            <DeptAlbum deptId={department.id} deptName={department.name} />
          )}
        </section>

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
