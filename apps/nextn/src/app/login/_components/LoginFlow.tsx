"use client";

import { UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  KeyRound,
  ArrowRight,
  Loader2,
  User,
  Building2,
  ChevronLeft,
  Eye,
  EyeOff,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { LOGIN_DEPARTMENT_ORDER } from "@/lib/constants";
import { useLanguage } from "@/contexts/LanguageContext";
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
import {
  LoginBrandHeader,
  LoginAmbientBackground,
  LoginCard,
  LoginStepLogo,
  LoginSubmitButton,
  loginInputClass,
  loginLabelClass,
} from "./login-ui";
import type {
  LoginStep,
  UserCheckResult,
  PasswordChecks,
  loginFormSchema,
  loginPasswordSchema,
  claimSetPasswordFormSchema,
} from "./login.types";

interface LoginFlowProps {
  loginForm: UseFormReturn<z.infer<typeof loginFormSchema>>;
  loginPasswordForm: UseFormReturn<z.infer<typeof loginPasswordSchema>>;
  claimPasswordForm: UseFormReturn<z.infer<typeof claimSetPasswordFormSchema>>;
  loginStep: LoginStep;
  checkedUser: UserCheckResult | null;
  loginDepartment: string;
  departmentEmployees: Array<{
    userId: string;
    name: string;
    position?: string;
  }>;
  isLoadingEmployees: boolean;
  isLoading: boolean;
  showPassword: boolean;
  showConfirmPassword: boolean;
  forgotPasswordOpen: boolean;
  setShowPassword: (v: boolean) => void;
  setShowConfirmPassword: (v: boolean) => void;
  setForgotPasswordOpen: (v: boolean) => void;
  passwordChecks: PasswordChecks;
  allChecksPass: boolean;
  handleSelectLoginDepartment: (department: string) => Promise<void>;
  handleCheckUser: (values: z.infer<typeof loginFormSchema>) => Promise<void>;
  handleLogin: (values: z.infer<typeof loginPasswordSchema>) => Promise<void>;
  handleSetPassword: (
    values: z.infer<typeof claimSetPasswordFormSchema>,
  ) => Promise<void>;
  onBack: () => void;
  onSwitch: () => void;
}

export function LoginFlow({
  loginForm,
  loginPasswordForm,
  claimPasswordForm,
  loginStep,
  checkedUser,
  loginDepartment,
  departmentEmployees,
  isLoadingEmployees,
  isLoading,
  showPassword,
  showConfirmPassword,
  forgotPasswordOpen,
  setShowPassword,
  setShowConfirmPassword,
  setForgotPasswordOpen,
  passwordChecks,
  allChecksPass,
  handleSelectLoginDepartment,
  handleCheckUser,
  handleLogin,
  handleSetPassword,
  onBack,
  onSwitch,
}: LoginFlowProps) {
  const { t } = useLanguage();
  const showBack = loginStep !== "userId";

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
              <span className="text-sm">{t("back")}</span>
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
                  <LoginStepLogo />
                  <h2 className="text-2xl font-bold text-foreground">
                    {t("loginSignIn")}
                  </h2>
                </div>

                <Form {...loginForm}>
                  <form
                    onSubmit={loginForm.handleSubmit(handleCheckUser)}
                    className="space-y-5"
                  >
                    <div className="space-y-2">
                      <label className={labelClass}>
                        <Building2 className="w-4 h-4 text-primary" />
                        {t("regFlowLabelDept")}
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {LOGIN_DEPARTMENT_ORDER.map((dept) => {
                          const active = loginDepartment === dept;
                          return (
                            <button
                              key={dept}
                              type="button"
                              onClick={() => handleSelectLoginDepartment(dept)}
                              aria-pressed={active}
                              className={`flex items-center justify-center text-center min-h-[72px] px-2 py-2.5 rounded-2xl border text-[11px] leading-tight font-semibold transition-all duration-200 active:scale-[0.97] ${
                                active
                                  ? "bg-primary/10 border-primary text-primary shadow-sm ring-1 ring-primary/20"
                                  : "bg-muted/50 border-border/80 text-foreground hover:border-primary/40 hover:bg-muted hover:shadow-sm"
                              }`}
                            >
                              {dept}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <FormField
                      control={loginForm.control}
                      name="userId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelClass}>
                            <User className="w-4 h-4 text-primary" />
                            {t("loginLabelEmployee")}
                          </FormLabel>
                          <FormControl>
                            <div
                              role="listbox"
                              aria-label={t("loginLabelEmployee")}
                              className="rounded-2xl border border-border/80 bg-muted/30 overflow-hidden"
                            >
                              {!loginDepartment ? (
                                <p className="px-4 py-3 text-sm text-muted-foreground">
                                  {t("regFlowPlaceholderSelectDeptFirst")}
                                </p>
                              ) : isLoadingEmployees ? (
                                <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  {t("loginPlaceholderLoadingEmployees")}
                                </div>
                              ) : departmentEmployees.length === 0 ? (
                                <p className="px-4 py-3 text-sm text-muted-foreground">
                                  {t("loginPlaceholderNoEmployees")}
                                </p>
                              ) : (
                                <div className="max-h-56 overflow-y-auto p-1.5 space-y-1">
                                  {departmentEmployees.map((user) => {
                                    const selected =
                                      field.value === user.userId;
                                    return (
                                      <button
                                        key={user.userId}
                                        type="button"
                                        role="option"
                                        aria-selected={selected}
                                        onClick={() =>
                                          field.onChange(user.userId)
                                        }
                                        className={`w-full text-left rounded-xl px-3 py-2.5 transition-all duration-150 active:scale-[0.99] ${
                                          selected
                                            ? "bg-primary/10 border border-primary/40 text-primary shadow-sm"
                                            : "border border-transparent hover:bg-muted hover:border-border/60 text-foreground"
                                        }`}
                                      >
                                        <span className="block text-sm font-semibold leading-snug">
                                          {user.name}
                                        </span>
                                        {user.position ? (
                                          <span
                                            className={`block text-[11px] mt-0.5 ${
                                              selected
                                                ? "text-primary/70"
                                                : "text-muted-foreground"
                                            }`}
                                          >
                                            {user.position}
                                          </span>
                                        ) : null}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <LoginSubmitButton disabled={isLoading}>
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          {t("loginBtnCheck")}
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </LoginSubmitButton>
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
                  <LoginStepLogo />
                  <h2 className="text-2xl font-bold text-foreground">
                    {t("loginHeadingEnterPassword")}
                  </h2>
                  <p className="text-sm font-medium text-primary">
                    {checkedUser.name || checkedUser.userId}
                  </p>
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
                            <Lock className="w-4 h-4 text-primary" />
                            {t("loginLabelPassword")}
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showPassword ? "text" : "password"}
                                placeholder={t("loginPlaceholderEnterPassword")}
                                className={`${inputClass} pr-12`}
                                {...field}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={
                                  showPassword
                                    ? t("loginAriaHidePassword")
                                    : t("loginAriaShowPassword")
                                }
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
                        {t("loginForgotPasswordLink")}
                      </button>
                    </div>

                    <LoginSubmitButton disabled={isLoading}>
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          {t("loginSignIn")}
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </LoginSubmitButton>
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
                  <LoginStepLogo />
                  <h2 className="text-2xl font-bold text-foreground">
                    {t("loginHeadingCreatePassword")}
                  </h2>
                  <p className="text-muted-foreground mt-2">
                    {t("loginCreatePasswordSubtitle")}
                  </p>
                  <p className="text-sm font-medium text-emerald-400">
                    {checkedUser.name || checkedUser.userId}
                  </p>
                </div>

                <Form {...claimPasswordForm}>
                  <form
                    onSubmit={claimPasswordForm.handleSubmit(handleSetPassword)}
                    className="space-y-5"
                  >
                    <FormField
                      control={claimPasswordForm.control}
                      name="claimCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelClass}>
                            <KeyRound className="w-4 h-4 text-emerald-400" />
                            {t("loginLabelClaimCode")}
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t("loginPlaceholderClaimCode")}
                              className={inputClass}
                              autoComplete="off"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={claimPasswordForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelClass}>
                            <Lock className="w-4 h-4 text-emerald-400" />
                            {t("loginLabelPassword")}
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showPassword ? "text" : "password"}
                                placeholder={t("loginPlaceholderEnterPassword")}
                                className={`${inputClass} pr-12`}
                                {...field}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={
                                  showPassword
                                    ? t("loginAriaHidePassword")
                                    : t("loginAriaShowPassword")
                                }
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
                      control={claimPasswordForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelClass}>
                            <Lock className="w-4 h-4 text-teal-400" />
                            {t("loginLabelConfirmPassword")}
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showConfirmPassword ? "text" : "password"}
                                placeholder={t(
                                  "loginPlaceholderConfirmPassword",
                                )}
                                className={`${inputClass} pr-12`}
                                {...field}
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setShowConfirmPassword(!showConfirmPassword)
                                }
                                aria-label={
                                  showConfirmPassword
                                    ? t("loginAriaHidePassword")
                                    : t("loginAriaShowPassword")
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

                    <LoginSubmitButton disabled={isLoading || !allChecksPass}>
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          {t("loginBtnCreateAndSignIn")}
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </LoginSubmitButton>
                  </form>
                </Form>
              </motion.div>
            )}
          </AnimatePresence>

          {loginStep === "userId" && (
            <div className="mt-6 pt-5 border-t border-border/50 text-center">
              <span className="text-sm text-muted-foreground">
                {t("loginNoAccountText")}{" "}
              </span>
              <button
                type="button"
                onClick={onSwitch}
                className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors underline-offset-4 hover:underline"
              >
                {t("loginRegisterLink")}
              </button>
            </div>
          )}
        </LoginCard>
      </motion.div>

      <AlertDialog
        open={forgotPasswordOpen}
        onOpenChange={setForgotPasswordOpen}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              {t("loginForgotPasswordTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription
              asChild
              className="text-foreground/80 space-y-3"
            >
              <div>
                <div className="bg-muted/50 rounded-lg p-4 border border-border">
                  <span className="block text-foreground/80 text-sm leading-relaxed">
                    {t("loginForgotPasswordIntro")}{" "}
                    <span className="text-primary font-semibold">Skype</span>{" "}
                    {t("loginForgotPasswordViaSuffix")}{" "}
                    <span className="text-foreground font-semibold">
                      DAA – Батмягмар
                    </span>{" "}
                    {t("loginForgotPasswordOutro")}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground italic">
                  {t("loginForgotPasswordAdminNote")}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("close")}</AlertDialogCancel>
            <AlertDialogAction className="bg-primary text-primary-foreground hover:bg-primary/90">
              {t("loginGotItBtn")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
