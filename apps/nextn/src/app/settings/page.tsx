"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2, Check } from "lucide-react";
import { usersApi, getApiErrorMessage } from "@/lib/api";
import api from "@/lib/api";
import axios from "axios";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resizeProfileImageToDataUrl } from "@/lib/profile-image";

type Tab = "profile" | "password";

export default function SettingsPage() {
  const { user, loading, refreshUser } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<Tab>("profile");

  // Profile image
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const validatePassword = (p: string) =>
    p.length >= 8 &&
    /[A-Z]/.test(p) &&
    /[a-z]/.test(p) &&
    /\d/.test(p) &&
    /[@$!%*?&#^()\-_=+\[\]{}|;:',.<>\/~`]/.test(p);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: t("error"),
        description: t("imageTooBig"),
        variant: "destructive",
      });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        setImagePreview(resizeProfileImageToDataUrl(img));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = async () => {
    if (!imagePreview || !user) return;
    setIsUploadingImage(true);
    try {
      await usersApi.update(user.id, { profileImage: imagePreview });
      toast({ title: t("success"), description: t("imageSuccess") });
      await refreshUser();
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      let msg = t("imageError");
      if (axios.isAxiosError(error) && error.response?.status === 413)
        msg = t("imageTooBig");
      toast({ title: t("error"), description: msg, variant: "destructive" });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!user) return;
    setIsUploadingImage(true);
    try {
      await usersApi.removeProfileImage(user.id);
      setImagePreview(null);
      toast({ title: t("success"), description: t("imageRemoved") });
      await refreshUser();
    } catch (e: unknown) {
      toast({
        title: t("error"),
        description: getApiErrorMessage(e) || t("imageError"),
        variant: "destructive",
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: t("error"),
        description: t("passwordFillAll"),
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: t("error"),
        description: t("passwordMismatch"),
        variant: "destructive",
      });
      return;
    }
    if (!validatePassword(newPassword)) {
      toast({
        title: t("error"),
        description: t("passwordInvalid"),
        variant: "destructive",
      });
      return;
    }
    setIsChangingPassword(true);
    try {
      await api.post("/auth/change-password", { currentPassword, newPassword });
      toast({ title: t("success"), description: t("passwordChanged") });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      let msg = t("passwordChangeBtn");
      if (axios.isAxiosError(error)) msg = error.response?.data?.message ?? msg;
      toast({ title: t("error"), description: msg, variant: "destructive" });
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  const initials = user.name?.[0]?.toUpperCase() ?? "?";

  const TABS: { key: Tab; label: string }[] = [
    { key: "profile", label: "Профайл" },
    { key: "password", label: "Нууц үг" },
  ];

  return (
    <div className="min-h-[60vh] flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Modal card */}
        <div className="rounded-2xl border border-border bg-card shadow-premium-lg ring-hairline overflow-hidden">
          {/* User identity strip */}
          <div className="px-6 pt-6 pb-4 flex items-center gap-3 border-b border-border">
            <Avatar className="w-10 h-10">
              <AvatarImage src={user.profileImage} alt={user.name} />
              <AvatarFallback className="bg-muted text-foreground text-sm font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-foreground text-sm font-semibold truncate">
                {user.name}
              </p>
              <p className="text-muted-foreground text-xs truncate">
                {user.userId} · {user.department}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border">
            {TABS.map((tb) => (
              <button
                key={tb.key}
                onClick={() => setTab(tb.key)}
                className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                  tab === tb.key
                    ? "text-foreground border-b-2 border-foreground -mb-px"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tb.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="px-6 py-5">
            {/* ── Profile photo ── */}
            {tab === "profile" && (
              <div className="space-y-5">
                <div className="flex flex-col items-center gap-3">
                  <Avatar className="w-20 h-20">
                    <AvatarImage
                      src={imagePreview ?? user.profileImage}
                      alt={user.name}
                    />
                    <AvatarFallback className="bg-muted text-foreground text-2xl font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={handleImageSelect}
                  />
                  {!imagePreview ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingImage}
                        className="px-4 py-1.5 rounded-lg border border-border bg-muted text-foreground text-xs font-medium hover:bg-muted/80 transition-colors disabled:opacity-50"
                      >
                        {t("changeImage")}
                      </button>
                      {user.profileImage && (
                        <button
                          onClick={handleRemoveImage}
                          disabled={isUploadingImage}
                          className="px-4 py-1.5 rounded-lg border border-border text-muted-foreground text-xs font-medium hover:text-red-500 hover:border-red-300 dark:hover:border-red-700 transition-colors disabled:opacity-50"
                        >
                          {isUploadingImage ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            t("removeImage")
                          )}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={handleImageUpload}
                        disabled={isUploadingImage}
                        className="px-4 py-1.5 rounded-lg bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {isUploadingImage ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        Хадгалах
                      </button>
                      <button
                        onClick={() => {
                          setImagePreview(null);
                          if (fileInputRef.current)
                            fileInputRef.current.value = "";
                        }}
                        disabled={isUploadingImage}
                        className="px-4 py-1.5 rounded-lg border border-border text-muted-foreground text-xs font-medium hover:text-foreground transition-colors"
                      >
                        {t("cancel")}
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-muted-foreground text-[11px] text-center leading-relaxed">
                  {t("imageHint1")} · {t("imageHint3")}
                </p>
              </div>
            )}

            {/* ── Password ── */}
            {tab === "password" && (
              <form onSubmit={handlePasswordChange} className="space-y-4">
                {[
                  {
                    label: t("currentPassword"),
                    value: currentPassword,
                    set: setCurrentPassword,
                    show: showCurrent,
                    toggle: () => setShowCurrent((v) => !v),
                    placeholder: t("currentPasswordPlaceholder"),
                  },
                  {
                    label: t("newPassword"),
                    value: newPassword,
                    set: setNewPassword,
                    show: showNew,
                    toggle: () => setShowNew((v) => !v),
                    placeholder: t("newPasswordPlaceholder"),
                  },
                  {
                    label: t("confirmPassword"),
                    value: confirmPassword,
                    set: setConfirmPassword,
                    show: showConfirm,
                    toggle: () => setShowConfirm((v) => !v),
                    placeholder: t("confirmPasswordPlaceholder"),
                  },
                ].map((field, i) => (
                  <div key={i} className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground/70 block">
                      {field.label}
                    </label>
                    <div className="relative">
                      <input
                        type={field.show ? "text" : "password"}
                        value={field.value}
                        onChange={(e) => field.set(e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full rounded-xl px-3 py-2 pr-10 text-sm text-foreground bg-muted border border-input placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/30"
                      />
                      <button
                        type="button"
                        onClick={field.toggle}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {field.show ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}

                <div className="rounded-xl bg-muted px-4 py-3 space-y-1.5">
                  {[
                    t("passwordReq1"),
                    t("passwordReq2"),
                    t("passwordReq3"),
                    t("passwordReq4"),
                    t("passwordReq5"),
                  ].map((req, i) => (
                    <p
                      key={i}
                      className="text-[11px] text-muted-foreground flex items-center gap-1.5"
                    >
                      <span className="w-1 h-1 rounded-full bg-muted-foreground/50 flex-shrink-0" />
                      {req}
                    </p>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="w-full py-2.5 rounded-xl bg-foreground text-background text-sm font-semibold shadow-premium hover:shadow-premium-lg hover:opacity-90 transition-all duration-300 disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {isChangingPassword && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  {t("passwordChangeBtn")}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
