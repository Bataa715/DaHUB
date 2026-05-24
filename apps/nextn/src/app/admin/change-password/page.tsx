"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import api from "@/lib/api";
import axios from "axios";
import AdminPageHeader from "@/components/shared/AdminPageHeader";

export default function AdminChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const requirements = [
    { label: "Хамгийн багадаа 8 тэмдэгт", ok: newPassword.length >= 8 },
    { label: "Том үсэг", ok: /[A-Z]/.test(newPassword) },
    { label: "Жижиг үсэг", ok: /[a-z]/.test(newPassword) },
    { label: "Тоо", ok: /\d/.test(newPassword) },
    { label: "Тусгай тэмдэгт (@$!%*?&)", ok: /[@$!%*?&]/.test(newPassword) },
  ];

  const isValid = requirements.every((r) => r.ok);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Алдаа",
        description: "Бүх талбарыг бөглөнэ үү",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "Алдаа",
        description: "Шинэ нууц үг таарахгүй байна",
        variant: "destructive",
      });
      return;
    }
    if (!isValid) {
      toast({
        title: "Алдаа",
        description: "Нууц үг шаардлагыг хангахгүй байна",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    try {
      await api.post("/auth/change-password", { currentPassword, newPassword });
      toast({ title: "Амжилттай", description: "Нууц үг амжилттай солигдлоо" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      let message = "Нууц үг солихоор алдаа гарлаа";
      if (axios.isAxiosError(error))
        message = error.response?.data?.message ?? message;
      toast({ title: "Алдаа", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const PasswordInput = ({
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
  }) => (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        placeholder={placeholder}
        className="bg-slate-900 border-slate-800 text-white placeholder:text-slate-600 pr-10"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950">
      <AdminPageHeader title="Нууц үг солих" />

      <div className="max-w-md mx-auto px-4 py-10">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="currentPassword"
                className="text-slate-400 text-xs"
              >
                Одоогийн нууц үг
              </Label>
              <PasswordInput
                id="currentPassword"
                value={currentPassword}
                show={showCurrentPassword}
                onToggle={() => setShowCurrentPassword(!showCurrentPassword)}
                onChange={setCurrentPassword}
                placeholder="Одоогийн нууц үг"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="newPassword" className="text-slate-400 text-xs">
                Шинэ нууц үг
              </Label>
              <PasswordInput
                id="newPassword"
                value={newPassword}
                show={showNewPassword}
                onToggle={() => setShowNewPassword(!showNewPassword)}
                onChange={setNewPassword}
                placeholder="Шинэ нууц үг"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="confirmPassword"
                className="text-slate-400 text-xs"
              >
                Нууц үг давтах
              </Label>
              <PasswordInput
                id="confirmPassword"
                value={confirmPassword}
                show={showConfirmPassword}
                onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
                onChange={setConfirmPassword}
                placeholder="Нууц үг давтах"
              />
              {confirmPassword.length > 0 &&
                newPassword !== confirmPassword && (
                  <p className="text-xs text-red-400">
                    Нууц үг таарахгүй байна
                  </p>
                )}
            </div>
          </div>

          {newPassword.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
              <p className="text-xs text-slate-500 font-medium mb-2">
                Шаардлага
              </p>
              {requirements.map((r) => (
                <div key={r.label} className="flex items-center gap-2">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${r.ok ? "bg-emerald-400" : "bg-slate-700"}`}
                  />
                  <span
                    className={`text-xs ${r.ok ? "text-emerald-400" : "text-slate-500"}`}
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
              className="flex-1 py-2.5 text-sm text-slate-400 hover:text-white border border-slate-800 rounded-xl hover:bg-slate-900 transition-colors"
            >
              Цэвэрлэх
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2.5 text-sm font-semibold bg-white text-slate-950 hover:bg-slate-200 disabled:bg-slate-800 disabled:text-slate-500 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Нууц үг солих
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
