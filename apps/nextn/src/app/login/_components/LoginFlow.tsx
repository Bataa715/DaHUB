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
  KeyRound,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PasswordStrengthBox } from "./PasswordStrengthBox";
import type {
  LoginStep,
  UserCheckResult,
  PasswordChecks,
  loginFormSchema,
  loginPasswordSchema,
  passwordFormSchema,
} from "./login.types";

interface LoginFlowProps {
  loginForm: UseFormReturn<z.infer<typeof loginFormSchema>>;
  loginPasswordForm: UseFormReturn<z.infer<typeof loginPasswordSchema>>;
  passwordForm: UseFormReturn<z.infer<typeof passwordFormSchema>>;
  loginStep: LoginStep;
  checkedUser: UserCheckResult | null;
  userSuggestions: Array<{
    userId: string;
    name: string;
    department: string;
  }>;
  showSuggestions: boolean;
  isSearching: boolean;
  isLoading: boolean;
  showPassword: boolean;
  showConfirmPassword: boolean;
  forgotPasswordOpen: boolean;
  setShowPassword: (v: boolean) => void;
  setShowConfirmPassword: (v: boolean) => void;
  setForgotPasswordOpen: (v: boolean) => void;
  setShowSuggestions: (v: boolean) => void;
  passwordChecks: PasswordChecks;
  allChecksPass: boolean;
  searchUsers: (query: string) => Promise<void>;
  handleSelectSuggestion: (userId: string) => void;
  handleCheckUser: (values: z.infer<typeof loginFormSchema>) => Promise<void>;
  handleLogin: (values: z.infer<typeof loginPasswordSchema>) => Promise<void>;
  handleSetPassword: (
    values: z.infer<typeof passwordFormSchema>,
  ) => Promise<void>;
  onBack: () => void;
}

export function LoginFlow({
  loginForm,
  loginPasswordForm,
  passwordForm,
  loginStep,
  checkedUser,
  userSuggestions,
  showSuggestions,
  isSearching,
  isLoading,
  showPassword,
  showConfirmPassword,
  forgotPasswordOpen,
  setShowPassword,
  setShowConfirmPassword,
  setForgotPasswordOpen,
  setShowSuggestions,
  passwordChecks,
  allChecksPass,
  searchUsers,
  handleSelectSuggestion,
  handleCheckUser,
  handleLogin,
  handleSetPassword,
  onBack,
}: LoginFlowProps) {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <motion.div
          className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-bl from-purple-600/20 to-transparent rounded-full blur-3xl"
          animate={{ x: [0, -100, 0], y: [0, 50, 0] }}
          transition={{ duration: 20, repeat: Infinity }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-md px-6"
      >
        <div className="relative p-1 rounded-3xl bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500">
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
              {/* Step 1: Enter User ID */}
              {loginStep === "userId" && (
                <motion.div
                  key="userId"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <KeyRound className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Нэвтрэх</h2>
                    <p className="text-slate-400 mt-2">ID-ээ оруулна уу</p>
                  </div>

                  <Form {...loginForm}>
                    <form
                      onSubmit={loginForm.handleSubmit(handleCheckUser)}
                      className="space-y-5"
                    >
                      <FormField
                        control={loginForm.control}
                        name="userId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-slate-300 flex items-center gap-2">
                              <User className="w-4 h-4 text-purple-400" />
                              Хэрэглэгчийн ID
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  placeholder="ID эсвэл нэрээ бичнэ үү"
                                  className="h-12 rounded-xl bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 font-mono"
                                  {...field}
                                  onChange={(e) => {
                                    field.onChange(e.target.value);
                                    searchUsers(e.target.value);
                                  }}
                                  onFocus={() => {
                                    if (userSuggestions.length > 0)
                                      setShowSuggestions(true);
                                  }}
                                  onBlur={() => {
                                    setTimeout(
                                      () => setShowSuggestions(false),
                                      200,
                                    );
                                  }}
                                  autoComplete="off"
                                />
                                {isSearching && (
                                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                                  </div>
                                )}

                                <AnimatePresence>
                                  {showSuggestions &&
                                    userSuggestions.length > 0 && (
                                      <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden"
                                      >
                                        {userSuggestions.map((user, index) => (
                                          <motion.button
                                            key={`${user.userId}-${index}`}
                                            type="button"
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            onClick={() =>
                                              handleSelectSuggestion(
                                                user.userId,
                                              )
                                            }
                                            className="w-full px-4 py-3 text-left hover:bg-slate-700/50 transition-colors border-b border-slate-700/50 last:border-b-0"
                                          >
                                            <div className="flex items-center justify-between">
                                              <div>
                                                <p className="text-white font-mono text-sm">
                                                  {user.userId}
                                                </p>
                                                <p className="text-slate-400 text-xs">
                                                  {user.name}
                                                </p>
                                              </div>
                                              <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-1 rounded-lg">
                                                {user.department}
                                              </span>
                                            </div>
                                          </motion.button>
                                        ))}
                                      </motion.div>
                                    )}
                                </AnimatePresence>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold shadow-lg"
                      >
                        {isLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <span className="flex items-center gap-2">
                            Шалгах
                            <ArrowRight className="w-4 h-4" />
                          </span>
                        )}
                      </Button>
                    </form>
                  </Form>
                </motion.div>
              )}

              {/* Step 2a: Enter Password */}
              {loginStep === "password" && checkedUser && (
                <motion.div
                  key="password"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <Lock className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">
                      Нууц үг оруулах
                    </h2>
                    <p className="text-slate-400 mt-2">{checkedUser.name}</p>
                    <code className="text-xs text-purple-400">
                      {checkedUser.userId}
                    </code>
                  </div>

                  <Form {...loginPasswordForm}>
                    <form
                      onSubmit={loginPasswordForm.handleSubmit(handleLogin)}
                      className="space-y-5"
                    >
                      <FormField
                        control={loginPasswordForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-slate-300 flex items-center gap-2">
                              <Lock className="w-4 h-4 text-pink-400" />
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

                      <div className="text-center -mt-2">
                        <button
                          type="button"
                          onClick={() => setForgotPasswordOpen(true)}
                          className="text-sm text-purple-400 hover:text-purple-300 transition-colors underline-offset-4 hover:underline inline-flex items-center gap-1"
                        >
                          <Lock className="w-3 h-3" />
                          Нууц үг мартсан уу?
                        </button>
                      </div>

                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold shadow-lg"
                      >
                        {isLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <span className="flex items-center gap-2">
                            Нэвтрэх
                            <ArrowRight className="w-4 h-4" />
                          </span>
                        )}
                      </Button>
                    </form>
                  </Form>
                </motion.div>
              )}

              {/* Step 2b: Create Password (first time) */}
              {loginStep === "createPassword" && checkedUser && (
                <motion.div
                  key="createPassword"
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
                      Анх удаа нэвтэрч байна
                    </p>
                    <code className="text-xs text-emerald-400">
                      {checkedUser.userId}
                    </code>
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
                            Нууц үг үүсгэж нэвтрэх
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

      {/* Forgot Password Dialog */}
      <AlertDialog
        open={forgotPasswordOpen}
        onOpenChange={setForgotPasswordOpen}
      >
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-purple-400" />
              Нууц үг мартсан
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300 space-y-3">
              <div>
                Дотоод аудитын хэлтсийн{" "}
                <span className="text-purple-400 font-semibold">IT admin</span>
                -д хандана уу.
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4 space-y-2 border border-slate-700">
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-purple-400" />
                  <span className="text-slate-400">IT Admin:</span>
                  <span className="text-white font-medium">
                    Болдбаатар (ИТ-ын аудитын хэлтэс)
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="w-4 h-4 text-purple-400" />
                  <span className="text-slate-400">Байршил:</span>
                  <span className="text-white">ИТ-ын аудитын хэлтэс</span>
                </div>
              </div>
              <div className="text-sm text-amber-400/80 italic">
                💡 Админ таны нууц үгийг шинэчилж өгөх болно.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 hover:bg-slate-700 text-white border-slate-600">
              Хаах
            </AlertDialogCancel>
            <AlertDialogAction className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
              Ойлголоо
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
