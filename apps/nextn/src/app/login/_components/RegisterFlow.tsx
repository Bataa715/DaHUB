"use client";

import { UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Loader2,
  Building2,
  User,
  ChevronLeft,
  Briefcase,
  Clock,
} from "lucide-react";
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
import { useLanguage } from "@/contexts/LanguageContext";
import {
  LoginSplitShell,
  LoginCard,
  LoginStepLogo,
  LoginSubmitButton,
  loginInputClass,
  loginLabelClass,
} from "./login-ui";
import type { RegisterStep, registerFormSchema } from "./login.types";

interface RegisterFlowProps {
  registerForm: UseFormReturn<z.infer<typeof registerFormSchema>>;
  positions: string[];
  selectedDepartment: string;
  generatedUserId: string;
  registeredUser: { userId: string; name: string } | null;
  registerStep: RegisterStep;
  isLoading: boolean;
  getUserIdPrefix: () => string;
  handleRegisterInfo: (
    values: z.infer<typeof registerFormSchema>,
  ) => Promise<void>;
  onBack: () => void;
  onSwitch: () => void;
}

export function RegisterFlow({
  registerForm,
  positions,
  selectedDepartment,
  generatedUserId,
  registeredUser,
  registerStep,
  isLoading,
  getUserIdPrefix,
  handleRegisterInfo,
  onBack,
  onSwitch,
}: RegisterFlowProps) {
  const { t } = useLanguage();
  const showBack = registerStep !== "info";

  const inputClass = loginInputClass;
  const labelClass = loginLabelClass;

  return (
    <LoginSplitShell>
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
                  <LoginStepLogo />
                  <h2 className="text-2xl font-bold text-foreground">
                    {t("regFlowHeadingRequest")}
                  </h2>
                  <p className="text-muted-foreground mt-2">
                    {t("regFlowInfoSubtitle")}
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
                            {t("regFlowLabelDept")}
                          </FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger
                                className={`${inputClass} text-left`}
                              >
                                <SelectValue
                                  placeholder={t(
                                    "regFlowPlaceholderSelectDept",
                                  )}
                                />
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
                            {t("regFlowLabelPosition")}
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
                                      ? t("regFlowPlaceholderSelectDeptFirst")
                                      : t("regFlowPlaceholderSelectPosition")
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
                            {t("regFlowLabelName")}
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
                                    ? t("regFlowPlaceholderEnterName")
                                    : t("regFlowPlaceholderSelectDeptFirst")
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
                                    .replace(/[^a-zA-ZЀ-ӿ-]/g, "");
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
                            {t("regFlowYourIdLabel")}
                          </p>
                          <code className="text-lg font-mono text-primary font-bold">
                            {generatedUserId}
                          </code>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <LoginSubmitButton disabled={isLoading || !generatedUserId}>
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          {t("regFlowBtnSubmitRequest")}
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </LoginSubmitButton>
                  </form>
                </Form>
              </motion.div>
            )}

            {/* Step 2: Pending admin approval */}
            {registerStep === "pending" && (
              <motion.div
                key="pending"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className="text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-6">
                  <Clock className="w-8 h-8 text-amber-500" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  {t("loginToastRequestSentTitle")}
                </h2>
                <p className="text-muted-foreground mb-1">
                  {t("regFlowPendingDesc")}
                </p>
                {registeredUser?.userId && (
                  <p className="text-muted-foreground mt-3 mb-6">
                    {t("regFlowYourIdLabel")}{" "}
                    <code className="text-primary font-mono font-bold">
                      {registeredUser.userId}
                    </code>
                  </p>
                )}
                <p className="text-xs text-muted-foreground/70 mb-8">
                  {t("regFlowPendingHint")}
                </p>

                <button
                  type="button"
                  onClick={onSwitch}
                  className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors underline-offset-4 hover:underline"
                >
                  {t("regFlowGoToLoginBtn")}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Switch flow link */}
          {registerStep === "info" && (
            <div className="mt-6 pt-5 border-t border-border/50 text-center">
              <span className="text-sm text-muted-foreground">
                {t("regFlowHaveAccountText")}{" "}
              </span>
              <button
                type="button"
                onClick={onSwitch}
                className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors underline-offset-4 hover:underline"
              >
                {t("loginSignIn")}
              </button>
            </div>
          )}
        </LoginCard>
    </LoginSplitShell>
  );
}
