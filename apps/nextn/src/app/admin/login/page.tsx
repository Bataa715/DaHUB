"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import axios from "axios";

export const dynamic = "force-dynamic";

const formSchema = z.object({
  userId: z.string().min(1, { message: "Админы ID-ээ оруулна уу." }),
  password: z.string().min(1, { message: "Нууц үгээ оруулна уу." }),
});

export default function AdminLoginPage() {
  const { adminLogin } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { userId: "", password: "" },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      await adminLogin(values.userId, values.password);
      window.location.replace("/admin");
    } catch (error) {
      let message = "Нэвтрэхэд тодорхойгүй алдаа гарлаа.";
      if (axios.isAxiosError(error))
        message = error.response?.data?.message ?? message;
      else if (error instanceof Error) message = error.message;
      toast({
        title: "Нэвтрэхэд алдаа гарлаа",
        description: message,
        variant: "destructive",
      });
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          {/* Identity strip */}
          <div className="px-6 pt-6 pb-4 flex items-center gap-3 border-b border-border">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
              <Image
                src="/golomt.jpg"
                alt="Golomt"
                width={24}
                height={24}
                className="rounded object-contain"
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Admin нэвтрэх
              </p>
              <p className="text-xs text-muted-foreground">
                DaHUB · Дотоод аудит
              </p>
            </div>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="px-6 py-5 space-y-4"
          >
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground/70 block">
                Админы ID
              </label>
              <input
                {...register("userId")}
                autoComplete="off"
                placeholder="Таны ID"
                className="w-full rounded-xl px-3 py-2 text-sm text-foreground bg-muted border border-input placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/30"
              />
              {errors.userId && (
                <p className="text-xs text-red-500">{errors.userId.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground/70 block">
                Нууц үг
              </label>
              <div className="relative">
                <input
                  {...register("password")}
                  type={showPassword ? "text" : "password"}
                  placeholder="Нууц үг"
                  className="w-full rounded-xl px-3 py-2 pr-10 text-sm text-foreground bg-muted border border-input placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/30"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-500">
                  {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Нэвтрэх
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
