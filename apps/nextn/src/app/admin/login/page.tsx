"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import axios from "axios";
import { AuthSplitShell } from "@/components/shared/AuthSplitShell";
import { GolomtMark } from "@/components/GolomtMark";

export const dynamic = "force-dynamic";

const inputClass =
  "h-12 w-full rounded-md border border-border bg-muted/40 px-4 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors hover:border-foreground/30 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20";

export default function AdminLoginPage() {
  const { adminLogin } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const formSchema = z.object({
    userId: z.string().min(1, { message: t("adminLoginErrIdRequired") }),
    password: z
      .string()
      .min(1, { message: t("adminLoginErrPasswordRequired") }),
  });

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
      let message = t("adminLoginErrUnknown");
      if (axios.isAxiosError(error))
        message = error.response?.data?.message ?? message;
      else if (error instanceof Error) message = error.message;
      toast({
        title: t("adminLoginErrToastTitle"),
        description: message,
        variant: "destructive",
      });
      setIsLoading(false);
    }
  }

  return (
    <AuthSplitShell>
      <div className="mb-8 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-600 to-violet-700 text-white shadow-lg shadow-indigo-500/25">
          <GolomtMark className="h-9 w-9" />
        </span>
        <h2 className="mt-6 text-2xl font-bold text-foreground">
          {t("adminLoginHeading")}
        </h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-foreground">
            {t("adminLoginLabelId")}
          </label>
          <input
            {...register("userId")}
            autoComplete="off"
            placeholder={t("loginYourIdPrefix")}
            className={inputClass}
          />
          {errors.userId && (
            <p className="text-xs text-red-500">{errors.userId.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-foreground">
            {t("loginLabelPassword")}
          </label>
          <div className="relative">
            <input
              {...register("password")}
              type={showPassword ? "text" : "password"}
              placeholder={t("loginLabelPassword")}
              className={`${inputClass} pr-12`}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              aria-label={
                showPassword
                  ? t("loginAriaHidePassword")
                  : t("loginAriaShowPassword")
              }
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-red-500">{errors.password.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 px-4 text-sm font-semibold tracking-wide text-white shadow-md shadow-indigo-500/20 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              {t("loginSignIn")}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>
    </AuthSplitShell>
  );
}
