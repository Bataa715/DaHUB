"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  Lock,
  ArrowRight,
  Loader2,
  UserCog,
  Shield,
  Eye,
  EyeOff,
} from "lucide-react";
import Image from "next/image";
import axios from "axios";

export const dynamic = "force-dynamic";

const PARTICLES = [
  { left: 12, top: 18 },
  { left: 88, top: 8 },
  { left: 44, top: 82 },
  { left: 72, top: 34 },
  { left: 22, top: 58 },
  { left: 91, top: 72 },
  { left: 8, top: 92 },
  { left: 56, top: 14 },
  { left: 35, top: 48 },
  { left: 78, top: 62 },
  { left: 4, top: 38 },
  { left: 62, top: 96 },
];

const formSchema = z.object({
  userId: z.string().min(1, { message: "Админы ID-ээ оруулна уу." }),
  password: z.string().min(1, { message: "Нууц үгээ оруулна уу." }),
});

export default function AdminLoginPage() {
  const { adminLogin } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { userId: "", password: "" },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      await adminLogin(values.userId, values.password);
      toast({
        title: "Амжилттай нэвтэрлээ",
        description: "Админ хуудас руу шилжүүлж байна...",
        duration: 3000,
      });
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
    <div className="h-screen flex overflow-hidden bg-background">
      {/* ── LEFT PANEL ── */}
      <div
        className="hidden lg:flex lg:w-[52%] relative flex-col items-center justify-center overflow-hidden
                      bg-gradient-to-br from-slate-900 via-blue-950/60 to-slate-900"
      >
        {/* Mesh glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-32 w-[480px] h-[480px] bg-blue-600/18 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[420px] h-[420px] bg-indigo-600/15 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/6 rounded-full blur-3xl" />
        </div>

        {/* Grid */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.15) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.15) 1px,transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Particles */}
        {PARTICLES.map((p, i) => (
          <motion.div
            key={i}
            className="absolute w-1.5 h-1.5 rounded-full bg-blue-400/50"
            style={{ left: `${p.left}%`, top: `${p.top}%` }}
            animate={{ y: [0, -14, 0], opacity: [0.35, 0.75, 0.35] }}
            transition={{
              duration: 3 + (i % 3),
              repeat: Infinity,
              delay: i * 0.25,
            }}
          />
        ))}

        {/* Branding content */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="relative z-10 max-w-sm text-center px-8"
        >
          {/* Icon */}
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 180, delay: 0.2 }}
            className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700
                       flex items-center justify-center mx-auto mb-7
                       shadow-2xl shadow-blue-500/40 ring-1 ring-blue-400/20"
          >
            <Shield className="w-12 h-12 text-foreground drop-shadow-lg" />
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="text-xs font-semibold tracking-[0.2em] text-blue-400/80 uppercase mb-2 flex items-center justify-center gap-1"
          >
            <Shield className="w-3 h-3" /> Admin Portal
          </motion.p>

          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="text-3xl font-black text-foreground leading-tight mb-4"
          >
            DaHUB
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Дотоод аудит
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="text-sm text-muted-foreground leading-relaxed"
          >
            Зөвхөн админ эрхтэй хэрэглэгчид нэвтрэх боломжтой. Таны мэдээлэл
            хамгаалагдсан орчинд ажиллана.
          </motion.p>

          {/* Feature tags */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
            className="flex flex-wrap justify-center gap-2 mt-6"
          >
            {[
              "Хэрэглэгч удирдлага",
              "Хэлтэс тохиргоо",
              "Мэдээ хариуцах",
              "Тайлан",
            ].map((t) => (
              <span
                key={t}
                className="text-[11px] px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20"
              >
                {t}
              </span>
            ))}
          </motion.div>
        </motion.div>

        {/* Bottom bank logo */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3"
        >
          <div className="w-8 h-8 rounded-lg bg-white/90 flex items-center justify-center">
            <Image
              src="/golomt.jpg"
              alt="Golomt"
              width={24}
              height={24}
              className="rounded object-contain"
            />
          </div>
          <span className="text-xs text-muted-foreground/60">
            Голомт Банк — Дотоод аудит
          </span>
        </motion.div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div
        className="flex-1 flex flex-col items-center justify-center relative overflow-hidden
                      bg-background px-6 sm:px-12"
      >
        {/* Subtle glow top-right */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

        {/* Mobile logo */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:hidden flex items-center gap-3 mb-8"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <Shield className="w-5 h-5 text-foreground" />
          </div>
          <span className="text-foreground font-bold text-lg">
            Admin Portal
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 w-full max-w-[390px]"
        >
          {/* Card glow */}
          <div className="absolute -inset-1 bg-gradient-to-br from-blue-600/15 via-indigo-600/10 to-transparent rounded-3xl blur-xl" />

          <div className="relative bg-background/80 backdrop-blur-xl border border-border/60 rounded-3xl p-8 shadow-2xl">
            {/* Header */}
            <div className="mb-7">
              <p className="text-xs font-semibold tracking-widest text-blue-400/70 uppercase mb-1.5">
                Admin · Нэвтрэх
              </p>
              <h1 className="text-2xl font-extrabold text-foreground">
                Сайн байна уу 👋
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Админы мэдээллээ оруулна уу
              </p>
            </div>

            {/* Form */}
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-5"
              >
                {/* User ID */}
                <motion.div
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 }}
                  className="relative"
                >
                  <FormField
                    control={form.control}
                    name="userId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                          <UserCog className="w-4 h-4 text-blue-400" />
                          Админы ID
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Админы ID-ээ оруулна уу"
                            className="h-12 bg-muted/60 border-border rounded-xl pl-4 pr-4
                                       text-foreground placeholder:text-muted-foreground/60
                                       focus:border-blue-500/60 focus:ring-blue-500/20 transition-all"
                            {...field}
                            autoComplete="off"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </motion.div>

                {/* Password */}
                <motion.div
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                          <Lock className="w-4 h-4 text-blue-400" />
                          Нууц үг
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="Нууц үгээ оруулна уу"
                              className="h-12 bg-muted/60 border-border rounded-xl pl-4 pr-11
                                         text-foreground placeholder:text-muted-foreground/60
                                         focus:border-blue-500/60 focus:ring-blue-500/20 transition-all"
                              {...field}
                            />
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground/80 transition-colors"
                            >
                              {showPassword ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </motion.div>

                {/* Submit */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                >
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-12 rounded-xl font-semibold text-foreground border-0
                               bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600
                               hover:from-blue-600 hover:via-blue-700 hover:to-indigo-700
                               shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50
                               transition-all duration-300 hover:scale-[1.015] active:scale-[0.985]"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        Нэвтрэх <ArrowRight className="w-4 h-4" />
                      </span>
                    )}
                  </Button>
                </motion.div>
              </form>
            </Form>

            {/* Footer note */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-center text-xs text-muted-foreground/40 mt-6 flex items-center justify-center gap-1.5"
            >
              <Shield className="w-3 h-3" />
              Зөвхөн зөвшөөрөгдсөн хэрэглэгчид нэвтрэх боломжтой
            </motion.p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
