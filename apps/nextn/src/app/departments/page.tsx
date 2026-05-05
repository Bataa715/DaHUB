"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { departmentsApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Loader2,
  Building2,
  Users,
  Target,
  Lock,
  ChevronLeft,
  ChevronRight,
  Camera,
  ImagePlus,
  Crown,
  X,
  Trash2,
} from "lucide-react";
import Image from "next/image";
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

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
      >
        <X className="w-5 h-5" />
      </button>
      {/* Counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-black/50 text-white/70 text-xs">
        {index + 1} / {photos.length}
      </div>
      {/* Prev */}
      {index > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 z-10 p-2.5 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      {/* Next */}
      {index < photos.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 z-10 p-2.5 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
      {/* Image + info */}
      <div
        className="relative mx-16 max-w-4xl w-full flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.imageData}
          alt={photo.caption || "Зураг"}
          className="block max-h-[80vh] max-w-full w-auto rounded-lg shadow-2xl"
        />
        <div className="flex items-center justify-between w-full px-1">
          <div>
            {photo.caption && (
              <p className="text-white text-sm font-medium">{photo.caption}</p>
            )}
            <p className="text-white/50 text-xs">
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs transition-colors"
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

  // keyboard nav in lightbox
  useEffect(() => {
    if (lightbox === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft")
        setLightbox((i) => (i !== null && i > 0 ? i - 1 : i));
      if (e.key === "ArrowRight")
        setLightbox((i) => (i !== null && i < photos.length - 1 ? i + 1 : i));
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightbox, photos.length]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast({
        title: t("error"),
        description: t("photoSizeError"),
        variant: "destructive",
      });
      return;
    }
    e.target.value = "";
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        await departmentsApi.uploadPhoto(
          deptId,
          deptName,
          ev.target!.result as string,
        );
        toast({ title: t("success"), description: t("photoAdded") });
        await loadPhotos();
      } catch {
        toast({
          title: t("error"),
          description: t("photoUploadError"),
          variant: "destructive",
        });
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
      toast({
        title: t("error"),
        description: t("deleteError"),
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">{t("albumTitle")}</h2>
          {photos.length > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">{photos.length} зураг</span>
          )}
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border hover:bg-accent text-xs font-medium transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
          {t("addPhoto")}
        </button>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : photos.length === 0 ? (
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full py-12 rounded-lg border border-dashed border-border hover:border-foreground/20 hover:bg-muted/30 flex flex-col items-center gap-2 text-muted-foreground transition-colors"
        >
          <Camera className="w-8 h-8 opacity-40" />
          <p className="text-sm">{t("uploadPhotoPrompt")}</p>
          <p className="text-xs opacity-60">{t("photoSizeHint")}</p>
        </button>
      ) : (
        <div className="columns-2 sm:columns-3 lg:columns-4 gap-2">
          {photos.map((photo, i) => (
            <div
              key={photo.id}
              className="group relative rounded-md overflow-hidden cursor-pointer bg-muted break-inside-avoid mb-2"
              onClick={() => setLightbox(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.imageData}
                alt={photo.caption || "Зураг"}
                className="w-full h-auto block transition-opacity group-hover:opacity-90"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(photo.id); }}
                className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/70"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
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
  return (
    <div
      className={`flex-shrink-0 w-40 rounded-xl border bg-card p-4 flex flex-col items-center gap-2.5 ${
        isSelf
          ? "border-blue-500/30"
          : isManager
            ? "border-amber-500/30"
            : "border-border"
      }`}
    >
      {/* Avatar */}
      {member.profileImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={member.profileImage}
          alt={member.name}
          className="w-14 h-14 rounded-full object-cover bg-muted"
        />
      ) : (
        <div className="w-14 h-14 rounded-full bg-muted border border-border flex items-center justify-center text-foreground text-base font-bold">
          {getInitials(member.name)}
        </div>
      )}
      {/* Name + position */}
      <div className="text-center w-full">
        <p className="text-xs font-semibold text-foreground leading-snug truncate">{member.name}</p>
        {member.position && (
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{member.position}</p>
        )}
      </div>
      {/* Badge */}
      {isSelf && (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 font-medium">
          {t("youBadge")}
        </span>
      )}
      {isManager && !isSelf && (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
          <Crown className="w-2.5 h-2.5" />{t("managerBadge")}
        </span>
      )}
    </div>
  );
}

// ── MemberGrid ────────────────────────────────────────────────────────────
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
    <div className="flex flex-wrap gap-2">
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

// ── OtherDeptViewer ───────────────────────────────────────────────────────
function OtherDeptViewer({ currentDeptId }: { currentDeptId: string }) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [list, setList] = useState<DepartmentData[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selected, setSelected] = useState<DepartmentData | null>(null);
  const [loadingSelected, setLoadingSelected] = useState(false);

  useEffect(() => {
    departmentsApi
      .getAll()
      .then((data: DepartmentData[]) => {
        const filtered = data.filter((d) => d.id !== currentDeptId);
        filtered.sort((a, b) => {
          const aIsLeader = a.name.trim().toLowerCase().includes("удирдлага");
          const bIsLeader = b.name.trim().toLowerCase().includes("удирдлага");
          if (aIsLeader && !bIsLeader) return -1;
          if (!aIsLeader && bIsLeader) return 1;
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
    if (selected?.id === dept.id) {
      setSelected(null);
      return;
    }
    setLoadingSelected(true);
    try {
      const full = await departmentsApi.getOne(dept.id);
      setSelected(full);
    } catch {
      toast({
        title: t("error"),
        description: t("deptDetailLoadError"),
        variant: "destructive",
      });
    } finally {
      setLoadingSelected(false);
    }
  };

  if (loadingList) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <p className="text-muted-foreground/70 text-sm text-center py-6">
        {t("noOtherDepts")}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {list.map((dept) => {
          const isActive = selected?.id === dept.id;
          return (
            <button
              key={dept.id}
              onClick={() => selectDept(dept)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                isActive
                  ? "border-foreground/30 bg-accent"
                  : "border-border bg-card hover:bg-muted/50"
              }`}
            >
              <Building2 className={`w-3.5 h-3.5 mb-2 ${isActive ? "text-foreground" : "text-muted-foreground"}`} />
              <p className="text-xs font-medium text-foreground leading-snug line-clamp-2 mb-1">{dept.name}</p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3" />
                {dept.users?.length ?? dept.employeeCount ?? 0} {t("employeeSuffix")}
              </p>
            </button>
          );
        })}
      </div>

      {(loadingSelected || selected) && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          {loadingSelected ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : selected ? (
            <>
              <div className="flex items-center gap-2.5">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{selected.name}</h3>
                  {selected.manager && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Crown className="w-3 h-3" /> {selected.manager}
                    </p>
                  )}
                </div>
              </div>
              {selected.users && selected.users.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold">{t("teamTitle")}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{selected.users.length} {t("employeeSuffix")}</span>
                  </div>
                  <MemberGrid
                    members={selected.users}
                    currentUserId=""
                    managerName={selected.manager}
                  />
                </div>
              )}
              {selected.id && (
                <DeptAlbum deptId={selected.id} deptName={selected.name} />
              )}
            </>
          ) : null}
        </div>
      )}
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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <h2 className="text-base font-semibold text-foreground">{t("needLogin")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t("needLoginDeptDesc")}</p>
        </div>
      </div>
    );
  }

  if (!user.department || !department) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Building2 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <h2 className="text-base font-semibold text-foreground">{t("deptUnknownTitle")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t("deptUnknownDesc")}</p>
        </div>
      </div>
    );
  }

  const members = department.users ?? [];
  const totalCount = members.length || department.employeeCount || 0;
  const currentUserId = (user as any).id ?? (user as any).userId ?? "";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">

        {/* Hero */}
        <div className="rounded-xl border border-border bg-card p-6 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground mb-3 px-2 py-0.5 rounded-full border border-border bg-muted/30">
              <Building2 className="w-3 h-3" /> {t("myDept")}
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">{department.name}</h1>
            {department.description && (
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-2">{department.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span className="font-semibold text-foreground">{totalCount}</span> {t("employeeSuffix")}
              </span>
              {department.manager && (
                <span className="flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5" />
                  <span className="font-semibold text-foreground">{department.manager}</span>
                </span>
              )}
            </div>
          </div>
          <div className="relative w-20 h-20 rounded-full overflow-hidden border border-border flex-shrink-0">
            <Image src="/golomt.jpg" alt="Golomt" fill className="object-cover" sizes="80px" />
          </div>
        </div>

        {/* Description */}
        {department.description && (
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">{t("missionTitle")}</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{department.description}</p>
          </div>
        )}

        {/* Members */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">{t("teamTitle")}</h2>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">{totalCount} {t("employeeSuffix")}</span>
          </div>
          {members.length > 0 ? (
            <MemberGrid members={members} currentUserId={currentUserId} managerName={department.manager} />
          ) : (
            <div className="py-10 flex flex-col items-center gap-2 text-muted-foreground">
              <Users className="w-7 h-7 opacity-40" />
              <p className="text-sm">{t("noEmployees")}</p>
            </div>
          )}
        </div>

        {/* Album */}
        <div className="rounded-xl border border-border bg-card p-6">
          {department.id && (
            <DeptAlbum deptId={department.id} deptName={department.name} />
          )}
        </div>

        {/* Other Departments */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">{t("otherDeptsTitle")}</h2>
          </div>
          {department.id && <OtherDeptViewer currentDeptId={department.id} />}
        </div>

      </div>
    </div>
  );
}
