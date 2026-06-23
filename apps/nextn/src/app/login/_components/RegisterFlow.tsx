"use client";

import { UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
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
import {
  LoginBrandHeader,
  LoginAmbientBackground,
  LoginCard,
  loginInputClass,
  loginLabelClass,
  loginIconBoxClass,
  loginSubmitBtnClass,
} from "./login-ui";
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

  const inputClass = loginInputClass;
  const labelClass = loginLabelClass;
  const eyeBtnClass =
    "absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors";

  return (
    <div className="login-page min-h-screen flex items-center justify-center relative overflow-hidden">
      <LoginAmbientBackground />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-md px-6 py-8"
      >
        <LoginBrandHeader />

        <LoginCard>
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
                    <div className={loginIconBoxClass}>
                      <UserPlus className="w-8 h-8" />
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
                              <Building2 className="w-4 h-4 text-primary" />
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
                              <Briefcase className="w-4 h-4 text-primary" />
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
                              <User className="w-4 h-4 text-primary" />
                              Таны нэр
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                {selectedDepartment && (
                                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-mono text-sm">
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
                            className="p-4 bg-primary/5 rounded-xl border border-primary/20"
                          >
                            <p className="text-xs text-muted-foreground mb-1">
                              Таны ID:
                            </p>
                            <code className="text-lg font-mono text-primary font-bold">
                              {generatedUserId}
                            </code>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <Button
                        type="submit"
                        disabled={isLoading || !generatedUserId}
                        className={`${loginSubmitBtnClass} disabled:opacity-50`}
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
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mx-auto mb-4 shadow-premium">
                      <ShieldCheck className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">
                      Нууц үг үүсгэх
                    </h2>
                    <p className="text-muted-foreground mt-2">
                      ID:{" "}
                      <code className="text-primary">
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
                              <Lock className="w-4 h-4 text-emerald-500" />
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
                              <Lock className="w-4 h-4 text-emerald-500" />
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
                        className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold shadow-premium hover:shadow-premium-lg transition-all duration-300 disabled:opacity-50"
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
        </LoginCard>
      </motion.div>
    </div>
  );
}
