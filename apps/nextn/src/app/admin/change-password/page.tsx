"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import api from "@/lib/api";
import axios from "axios";
import AdminPageHeader from "@/components/shared/AdminPageHeader";
import { useLanguage } from "@/contexts/LanguageContext";

function PasswordInput({
  id,
  value,
  show,
  onToggle,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  show: boolean;
  onToggle: () => void;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        placeholder={placeholder}
        className="bg-background border-border text-foreground placeholder:text-muted-foreground/50 pr-10"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export default function AdminChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { logout } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();

  const requirements = [
    { label: t("passwordReq1"), ok: newPassword.length >= 8 },
    { label: t("admChangePwUpperLabel"), ok: /[A-Z]/.test(newPassword) },
    { label: t("admChangePwLowerLabel"), ok: /[a-z]/.test(newPassword) },
    { label: t("admChangePwNumberLabel"), ok: /\d/.test(newPassword) },
    {
      label: t("admChangePwSpecialCharLabel"),
      ok: /[@$!%*?&]/.test(newPassword),
    },
  ];

  const isValid = requirements.every((r) => r.ok);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: t("error"),
        description: t("admChangePwFillAllError"),
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
    if (!isValid) {
      toast({
        title: t("error"),
        description: t("passwordInvalid"),
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    try {
      await api.post("/auth/change-password", { currentPassword, newPassword });
      await logout();
      toast({
        title: t("success"),
        description: t("admChangePwSuccessDesc"),
      });
      router.replace("/admin/login");
    } catch (error) {
      let message = t("admChangePwGenericError");
      if (axios.isAxiosError(error))
        message = error.response?.data?.message ?? message;
      toast({
        title: t("error"),
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminPageHeader title={t("passwordChangeBtn")} />

      <div className="max-w-md mx-auto px-4 py-10">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-background border border-border rounded-xl p-5 space-y-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="currentPassword"
                className="text-muted-foreground text-xs"
              >
                {t("currentPassword")}
              </Label>
              <PasswordInput
                id="currentPassword"
                value={currentPassword}
                show={showCurrentPassword}
                onToggle={() => setShowCurrentPassword(!showCurrentPassword)}
                onChange={setCurrentPassword}
                placeholder={t("currentPassword")}
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="newPassword"
                className="text-muted-foreground text-xs"
              >
                {t("newPassword")}
              </Label>
              <PasswordInput
                id="newPassword"
                value={newPassword}
                show={showNewPassword}
                onToggle={() => setShowNewPassword(!showNewPassword)}
                onChange={setNewPassword}
                placeholder={t("newPassword")}
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="confirmPassword"
                className="text-muted-foreground text-xs"
              >
                {t("confirmPassword")}
              </Label>
              <PasswordInput
                id="confirmPassword"
                value={confirmPassword}
                show={showConfirmPassword}
                onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
                onChange={setConfirmPassword}
                placeholder={t("confirmPasswordPlaceholder")}
              />
              {confirmPassword.length > 0 &&
                newPassword !== confirmPassword && (
                  <p className="text-xs text-red-400">
                    {t("admChangePwNoMatchInline")}
                  </p>
                )}
            </div>
          </div>

          {newPassword.length > 0 && (
            <div className="bg-background border border-border rounded-xl p-4 space-y-2">
              <p className="text-xs text-muted-foreground/60 font-medium mb-2">
                {t("admChangePwRequirementsLabel")}
              </p>
              {requirements.map((r) => (
                <div key={r.label} className="flex items-center gap-2">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${r.ok ? "bg-emerald-400" : "bg-secondary"}`}
                  />
                  <span
                    className={`text-xs ${r.ok ? "text-emerald-400" : "text-muted-foreground/60"}`}
                  >
                    {r.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
              }}
              className="flex-1 py-2.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-xl hover:bg-background/80 transition-colors"
            >
              {t("admChangePwClearBtn")}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2.5 text-sm font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:bg-muted disabled:text-muted-foreground/60 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("passwordChangeBtn")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
