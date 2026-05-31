"use client";

import { UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  Lock,
  ArrowRight,
  Loader2,
  Building2,
  User,
  ChevronLeft,
  Briefcase,
  UserPlus,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEPARTMENTS } from "@/lib/constants";
import { PasswordStrengthBox } from "./PasswordStrengthBox";
import type {
  RegisterStep,
  PasswordChecks,
  registerFormSchema,
  passwordFormSchema,
} from "./login.types";

interface RegisterFlowProps {
  registerForm: UseFormReturn<z.infer<typeof registerFormSchema>>;
  passwordForm: UseFormReturn<z.infer<typeof passwordFormSchema>>;
  positions: string[];
  selectedDepartment: string;
  generatedUserId: string;
  registeredUser: { userId: string; name: string } | null;
  registerStep: RegisterStep;
  isLoading: boolean;
  showPassword: boolean;
  showConfirmPassword: boolean;
  setShowPassword: (v: boolean) => void;
  setShowConfirmPassword: (v: boolean) => void;
  passwordChecks: PasswordChecks;
  allChecksPass: boolean;
  getUserIdPrefix: () => string;
  handleRegisterInfo: (
    values: z.infer<typeof registerFormSchema>,
  ) => Promise<void>;
  handleSetPassword: (
    values: z.infer<typeof passwordFormSchema>,
  ) => Promise<void>;
  onBack: () => void;
  onSwitch: () => void;
}

export function RegisterFlow({
  registerForm,
  passwordForm,
  positions,
  selectedDepartment,
  generatedUserId,
  registeredUser,
  registerStep,
  isLoading,
  showPassword,
  showConfirmPassword,
  setShowPassword,
  setShowConfirmPassword,
  passwordChecks,
  allChecksPass,
  getUserIdPrefix,
  handleRegisterInfo,
  handleSetPassword,
  onBack,
  onSwitch,
}: RegisterFlowProps) {
  const showBack = registerStep !== "info";

  const inputClass =
    "h-12 rounded-xl bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/60";
  const labelClass =
    "text-sm font-medium text-foreground/80 flex items-center gap-2";
  const eyeBtnClass =
    "absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors";

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background">
      {/* Theme-aware ambient background */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-primary/25 via-primary/5 to-transparent rounded-full blur-3xl"
          animate={{ x: [0, 100, 0], y: [0, 50, 0] }}
          transition={{ duration: 20, repeat: Infinity }}
        />
        <motion.div
          className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-accent/25 via-accent/5 to-transparent rounded-full blur-3xl"
          animate={{ x: [0, -80, 0], y: [0, -40, 0] }}
          transition={{ duration: 24, repeat: Infinity }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-md px-6"
      >
        {/* Brand */}
        <div className="flex flex-col items-center mb-6">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-3 overflow-hidden bg-white shadow-xl shadow-primary/20"
          >
            <Image
              src="/golomt.jpg"
              alt="Golomt Logo"
              width={64}
              height={64}
              priority
              className="object-contain"
            />
          </motion.div>
          <h1 className="text-2xl font-bold">
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              DaHUB
            </span>
          </h1>
        </div>

        <div className="relative p-[1.5px] rounded-3xl bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-500 shadow-2xl shadow-primary/10">
          <div className="bg-card/95 backdrop-blur-xl rounded-[22px] p-8">
            {showBack && (
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={onBack}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm">Буцах</span>
              </motion.button>
            )}

            <AnimatePresence mode="wait">
              {/* Step 1: User Info */}
              {registerStep === "info" && (
                <motion.div
                  key="info"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <UserPlus className="w-8 h-8 text-foreground" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">
                      Бүртгүүлэх
                    </h2>
                    <p className="text-muted-foreground mt-2">
                      Мэдээллээ оруулна уу
                    </p>
                  </div>

                  <Form {...registerForm}>
                    <form
                      onSubmit={registerForm.handleSubmit(handleRegisterInfo)}
                      className="space-y-5"
                    >
                      <FormField
                        control={registerForm.control}
                        name="department"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className={labelClass}>
                              <Building2 className="w-4 h-4 text-blue-400" />
                              Хэлтэс
                            </FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger
                                  className={`${inputClass} text-left`}
                                >
                                  <SelectValue placeholder="Хэлтсээ сонгоно уу" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {DEPARTMENTS.map((dept) => (
                                  <SelectItem key={dept} value={dept}>
                                    {dept}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="position"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className={labelClass}>
                              <Briefcase className="w-4 h-4 text-cyan-400" />
                              Албан тушаал
                            </FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                              disabled={positions.length === 0}
                            >
                              <FormControl>
                                <SelectTrigger
                                  className={`${inputClass} text-left disabled:opacity-50`}
                                >
                                  <SelectValue
                                    placeholder={
                                      positions.length === 0
                                        ? "Эхлээд хэлтэс сонгоно уу"
                                        : "Албан тушаалаа сонгоно уу"
                                    }
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {positions.map((pos) => (
                                  <SelectItem key={pos} value={pos}>
                                    {pos}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className={labelClass}>
                              <User className="w-4 h-4 text-teal-400" />
                              Таны нэр
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                {selectedDepartment && (
                                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400 font-mono text-sm">
                                    {getUserIdPrefix()}
                                  </span>
                                )}
                                <Input
                                  placeholder={
                                    selectedDepartment
                                      ? "Нэрээ оруулна уу"
                                      : "Эхлээд хэлтэс сонгоно уу"
                                  }
                                  className={inputClass}
                                  style={{
                                    paddingLeft: selectedDepartment
                                      ? `${getUserIdPrefix().length * 9 + 16}px`
                                      : undefined,
                                  }}
                                  disabled={!selectedDepartment}
                                  {...field}
                                  onChange={(e) => {
                                    const value = e.target.value
                                      .replace(/\s+/g, "")
                                      .replace(/[^a-zA-Z\u0400-\u04FF-]/g, "");
                                    field.onChange(value);
                                  }}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <AnimatePresence>
                        {generatedUserId && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="p-4 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-xl border border-blue-500/20"
                          >
                            <p className="text-xs text-muted-foreground mb-1">
                              Таны ID:
                            </p>
                            <code className="text-lg font-mono text-cyan-500 dark:text-cyan-400 font-bold">
                              {generatedUserId}
                            </code>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <Button
                        type="submit"
                        disabled={isLoading || !generatedUserId}
                        className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-foreground font-semibold shadow-lg disabled:opacity-50"
                      >
                        {isLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <span className="flex items-center gap-2">
                            Үргэлжлүүлэх
                            <ArrowRight className="w-4 h-4" />
                          </span>
                        )}
                      </Button>
                    </form>
                  </Form>
                </motion.div>
              )}

              {/* Step 2: Create Password */}
              {registerStep === "password" && (
                <motion.div
                  key="password"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <ShieldCheck className="w-8 h-8 text-foreground" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">
                      Нууц үг үүсгэх
                    </h2>
                    <p className="text-muted-foreground mt-2">
                      ID:{" "}
                      <code className="text-cyan-500 dark:text-cyan-400">
                        {registeredUser?.userId}
                      </code>
                    </p>
                  </div>

                  <Form {...passwordForm}>
                    <form
                      onSubmit={passwordForm.handleSubmit(handleSetPassword)}
                      className="space-y-5"
                    >
                      <FormField
                        control={passwordForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className={labelClass}>
                              <Lock className="w-4 h-4 text-emerald-400" />
                              Нууц үг
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type={showPassword ? "text" : "password"}
                                  placeholder="Нууц үгээ оруулна уу"
                                  className={`${inputClass} pr-12`}
                                  {...field}
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPassword(!showPassword)}
                                  className={eyeBtnClass}
                                >
                                  {showPassword ? (
                                    <EyeOff className="w-5 h-5" />
                                  ) : (
                                    <Eye className="w-5 h-5" />
                                  )}
                                </button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <PasswordStrengthBox checks={passwordChecks} />

                      <FormField
                        control={passwordForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className={labelClass}>
                              <Lock className="w-4 h-4 text-teal-400" />
                              Нууц үг давтах
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type={
                                    showConfirmPassword ? "text" : "password"
                                  }
                                  placeholder="Нууц үгээ давтана уу"
                                  className={`${inputClass} pr-12`}
                                  {...field}
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setShowConfirmPassword(!showConfirmPassword)
                                  }
                                  className={eyeBtnClass}
                                >
                                  {showConfirmPassword ? (
                                    <EyeOff className="w-5 h-5" />
                                  ) : (
                                    <Eye className="w-5 h-5" />
                                  )}
                                </button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        disabled={isLoading || !allChecksPass}
                        className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-foreground font-semibold shadow-lg disabled:opacity-50"
                      >
                        {isLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <span className="flex items-center gap-2">
                            Бүртгэл дуусгах
                            <ArrowRight className="w-4 h-4" />
                          </span>
                        )}
                      </Button>
                    </form>
                  </Form>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Switch flow link */}
            {registerStep === "info" && (
              <div className="mt-6 pt-5 border-t border-border/50 text-center">
                <span className="text-sm text-muted-foreground">
                  Бүртгэлтэй юу?{" "}
                </span>
                <button
                  type="button"
                  onClick={onSwitch}
                  className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors underline-offset-4 hover:underline"
                >
                  Нэвтрэх
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
