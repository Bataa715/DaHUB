"use client";

import { UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  Lock,
  ArrowRight,
  Loader2,
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
  onSwitch: () => void;
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
  onSwitch,
}: LoginFlowProps) {
  const showBack = loginStep !== "userId";

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
          className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-bl from-primary/25 via-primary/5 to-transparent rounded-full blur-3xl"
          animate={{ x: [0, -100, 0], y: [0, 50, 0] }}
          transition={{ duration: 20, repeat: Infinity }}
        />
        <motion.div
          className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-accent/25 via-accent/5 to-transparent rounded-full blur-3xl"
          animate={{ x: [0, 80, 0], y: [0, -40, 0] }}
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

        <div className="relative p-[1.5px] rounded-3xl bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 shadow-2xl shadow-primary/10">
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
              {/* Step 1: Enter User ID */}
              {loginStep === "userId" && (
                <motion.div
                  key="userId"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <KeyRound className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">
                      Нэвтрэх
                    </h2>
                    <p className="text-muted-foreground mt-2">
                      ID-ээ оруулна уу
                    </p>
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
                            <FormLabel className={labelClass}>
                              <User className="w-4 h-4 text-purple-400" />
                              Хэрэглэгчийн ID
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  placeholder="ID эсвэл нэрээ бичнэ үү"
                                  className={`${inputClass} font-mono`}
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
                                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                  </div>
                                )}

                                <AnimatePresence>
                                  {showSuggestions &&
                                    userSuggestions.length > 0 && (
                                      <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute z-50 w-full mt-2 bg-popover border border-border rounded-xl shadow-xl max-h-60 overflow-y-auto"
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
                                            className="w-full px-4 py-3 text-left hover:bg-muted/60 transition-colors border-b border-border/50 last:border-b-0"
                                          >
                                            <div className="flex items-center justify-between">
                                              <div>
                                                <p className="text-foreground font-mono text-sm">
                                                  {user.userId}
                                                </p>
                                                <p className="text-muted-foreground text-xs">
                                                  {user.name}
                                                </p>
                                              </div>
                                              <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded-lg">
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
                  transition={{ duration: 0.25 }}
                >
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <Lock className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">
                      Нууц үг оруулах
                    </h2>
                    <code className="text-xs text-primary">
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
                            <FormLabel className={labelClass}>
                              <Lock className="w-4 h-4 text-pink-400" />
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

                      <div className="text-center -mt-2">
                        <button
                          type="button"
                          onClick={() => setForgotPasswordOpen(true)}
                          className="text-sm text-primary hover:text-primary/80 transition-colors underline-offset-4 hover:underline inline-flex items-center gap-1"
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
                  transition={{ duration: 0.25 }}
                >
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <ShieldCheck className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">
                      Нууц үг үүсгэх
                    </h2>
                    <p className="text-muted-foreground mt-2">
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

            {/* Switch flow link */}
            {loginStep === "userId" && (
              <div className="mt-6 pt-5 border-t border-border/50 text-center">
                <span className="text-sm text-muted-foreground">
                  Бүртгэлгүй юу?{" "}
                </span>
                <button
                  type="button"
                  onClick={onSwitch}
                  className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors underline-offset-4 hover:underline"
                >
                  Бүртгүүлэх
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Forgot Password Dialog */}
      <AlertDialog
        open={forgotPasswordOpen}
        onOpenChange={setForgotPasswordOpen}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Нууц үг мартсан
            </AlertDialogTitle>
            <AlertDialogDescription
              asChild
              className="text-foreground/80 space-y-3"
            >
              <div>
                <div className="bg-muted/50 rounded-lg p-4 border border-border">
                  <span className="block text-foreground/80 text-sm leading-relaxed">
                    Нууц үгээ мартсан бол{" "}
                    <span className="text-primary font-semibold">Skype</span>{" "}
                    аар{" "}
                    <span className="text-foreground font-semibold">
                      DAA – Батмягмар
                    </span>{" "}
                    руу бичиж сэргээлгэнэ үү.
                  </span>
                </div>
                <div className="text-xs text-muted-foreground italic">
                  💡 Админ таны нууц үгийг шинэчилж өгөх болно.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Хаах</AlertDialogCancel>
            <AlertDialogAction className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white">
              Ойлголоо
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
