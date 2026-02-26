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
}: RegisterFlowProps) {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <motion.div
          className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-blue-600/20 to-transparent rounded-full blur-3xl"
          animate={{ x: [0, 100, 0], y: [0, 50, 0] }}
          transition={{ duration: 20, repeat: Infinity }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-md px-6"
      >
        <div className="relative p-1 rounded-3xl bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-500">
          <div className="bg-slate-900/95 backdrop-blur-xl rounded-[22px] p-8">
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={onBack}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm">Буцах</span>
            </motion.button>

            <AnimatePresence mode="wait">
              {/* Step 1: User Info */}
              {registerStep === "info" && (
                <motion.div
                  key="info"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <UserPlus className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">
                      Бүртгүүлэх
                    </h2>
                    <p className="text-slate-400 mt-2">Мэдээллээ оруулна уу</p>
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
                            <FormLabel className="text-sm font-medium text-slate-300 flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-blue-400" />
                              Хэлтэс
                            </FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger className="h-12 rounded-xl bg-slate-800/50 border-slate-700 text-white">
                                  <SelectValue placeholder="Хэлтсээ сонгоно уу" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-slate-800 border-slate-700">
                                {DEPARTMENTS.map((dept) => (
                                  <SelectItem
                                    key={dept}
                                    value={dept}
                                    className="text-white hover:bg-slate-700"
                                  >
                                    {dept}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {selectedDepartment === "Удирдлага" && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-start gap-2 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10"
                        >
                          <ShieldCheck className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-amber-300 leading-relaxed">
                            <span className="font-semibold">Анхаар:</span>{" "}
                            Удирдлагад зөвхөн нэг хэрэглэгч — Захирал бүртгэгдэж
                            болно.
                          </p>
                        </motion.div>
                      )}

                      <FormField
                        control={registerForm.control}
                        name="position"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-slate-300 flex items-center gap-2">
                              <Briefcase className="w-4 h-4 text-cyan-400" />
                              Албан тушаал
                            </FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                              disabled={positions.length === 0}
                            >
                              <FormControl>
                                <SelectTrigger className="h-12 rounded-xl bg-slate-800/50 border-slate-700 text-white disabled:opacity-50">
                                  <SelectValue
                                    placeholder={
                                      positions.length === 0
                                        ? "Эхлээд хэлтэс сонгоно уу"
                                        : "Албан тушаалаа сонгоно уу"
                                    }
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-slate-800 border-slate-700">
                                {positions.map((pos) => (
                                  <SelectItem
                                    key={pos}
                                    value={pos}
                                    className="text-white hover:bg-slate-700"
                                  >
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
                            <FormLabel className="text-sm font-medium text-slate-300 flex items-center gap-2">
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
                                  className="h-12 rounded-xl bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
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
                            <p className="text-xs text-slate-400 mb-1">
                              Таны ID:
                            </p>
                            <code className="text-lg font-mono text-cyan-400 font-bold">
                              {generatedUserId}
                            </code>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <Button
                        type="submit"
                        disabled={isLoading || !generatedUserId}
                        className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold shadow-lg disabled:opacity-50"
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
                >
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <ShieldCheck className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">
                      Нууц үг үүсгэх
                    </h2>
                    <p className="text-slate-400 mt-2">
                      ID:{" "}
                      <code className="text-cyan-400">
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
                            <FormLabel className="text-sm font-medium text-slate-300 flex items-center gap-2">
                              <Lock className="w-4 h-4 text-emerald-400" />
                              Нууц үг
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type={showPassword ? "text" : "password"}
                                  placeholder="Нууц үгээ оруулна уу"
                                  className="h-12 rounded-xl bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 pr-12"
                                  {...field}
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPassword(!showPassword)}
                                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
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
                            <FormLabel className="text-sm font-medium text-slate-300 flex items-center gap-2">
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
                                  className="h-12 rounded-xl bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 pr-12"
                                  {...field}
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setShowConfirmPassword(!showConfirmPassword)
                                  }
                                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
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
                        className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold shadow-lg disabled:opacity-50"
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
          </div>
        </div>
      </motion.div>
    </div>
  );
}
