"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Cookies from "js-cookie";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  DEPARTMENT_POSITIONS,
  DEPARTMENT_CODES,
  NO_DAG_PREFIX_DEPARTMENTS,
  NO_DIRECTOR_DEPARTMENTS,
} from "@/lib/constants";
import { RegisterFlow } from "./_components/RegisterFlow";
import { LoginFlow } from "./_components/LoginFlow";
import {
  registerFormSchema,
  loginFormSchema,
  claimSetPasswordFormSchema,
  loginPasswordSchema,
  createRegisterFormSchema,
  createLoginFormSchema,
  createClaimSetPasswordFormSchema,
  createLoginPasswordSchema,
  type FlowType,
  type RegisterStep,
  type LoginStep,
  type UserCheckResult,
} from "./_components/login.types";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [flowType, setFlowType] = useState<FlowType>("login");

  // Register state
  const [registerStep, setRegisterStep] = useState<RegisterStep>("info");
  const [positions, setPositions] = useState<string[]>([]);
  const [generatedUserId, setGeneratedUserId] = useState<string>("");
  const [registeredUser, setRegisteredUser] = useState<{
    userId: string;
    name: string;
  } | null>(null);

  // Login state
  const [loginStep, setLoginStep] = useState<LoginStep>("userId");
  const [checkedUser, setCheckedUser] = useState<UserCheckResult | null>(null);
  // Department → employee list (replaces the old free-text search)
  const [loginDepartment, setLoginDepartment] = useState<string>("");
  const [departmentEmployees, setDepartmentEmployees] = useState<
    Array<{ userId: string; name: string; position?: string }>
  >([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);

  // Common state
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);

  // Forms — resolvers built from translated zod schemas so validation errors
  // respect the language toggle (types still come from the static schemas).
  const registerForm = useForm<z.infer<typeof registerFormSchema>>({
    resolver: zodResolver(createRegisterFormSchema(t)),
    defaultValues: { department: "", position: "", name: "" },
  });

  const loginForm = useForm<z.infer<typeof loginFormSchema>>({
    resolver: zodResolver(createLoginFormSchema(t)),
    defaultValues: { userId: "" },
  });

  const claimPasswordForm = useForm<z.infer<typeof claimSetPasswordFormSchema>>(
    {
      resolver: zodResolver(createClaimSetPasswordFormSchema(t)),
      defaultValues: { claimCode: "", password: "", confirmPassword: "" },
    },
  );

  const loginPasswordForm = useForm<z.infer<typeof loginPasswordSchema>>({
    resolver: zodResolver(createLoginPasswordSchema(t)),
    defaultValues: { password: "" },
  });

  const selectedDepartment = registerForm.watch("department");
  const selectedPosition = registerForm.watch("position");
  const enteredName = registerForm.watch("name");
  const password = claimPasswordForm.watch("password");

  useEffect(() => {
    if (selectedDepartment) {
      setPositions(DEPARTMENT_POSITIONS[selectedDepartment] || []);
      registerForm.setValue("position", "");
    }
  }, [selectedDepartment]);

  // Backend buildUserId-тай ижил preview
  useEffect(() => {
    if (selectedDepartment && enteredName) {
      const deptCode = DEPARTMENT_CODES[selectedDepartment] || "USR";
      const namePart = enteredName
        .split("-")
        .map(
          (part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
        )
        .join("-")
        .replace(/\s+/g, "");
      const withDagPrefix = !NO_DAG_PREFIX_DEPARTMENTS.has(selectedDepartment);
      const staffId = withDagPrefix
        ? /^DAG-/i.test(deptCode)
          ? `${deptCode}-${namePart}`
          : `DAG-${deptCode}-${namePart}`
        : `${deptCode}-${namePart}`;

      // DAA / CHBA — захирал байхгүй
      if (NO_DIRECTOR_DEPARTMENTS.has(selectedDepartment)) {
        setGeneratedUserId(staffId);
        return;
      }

      const isDirector =
        selectedDepartment === "Удирдлага" ||
        String(selectedPosition ?? "")
          .toLowerCase()
          .includes("захирал");
      if (isDirector) {
        if (!withDagPrefix) setGeneratedUserId(`.${namePart}-${deptCode}`);
        else if (/^DAG-/i.test(deptCode))
          setGeneratedUserId(`.${namePart}-${deptCode}`);
        else if (/^DAG$/i.test(deptCode))
          setGeneratedUserId(`.${namePart}-DAG`);
        else setGeneratedUserId(`.${namePart}-DAG-${deptCode}`);
      } else {
        setGeneratedUserId(staffId);
      }
    } else {
      setGeneratedUserId("");
    }
  }, [selectedDepartment, selectedPosition, enteredName]);

  const passwordChecks = {
    minLength: password.length >= 8,
    hasLower: /[a-z]/.test(password),
    hasUpper: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[@$!%*?&#^()\-_=+[\]{}|;:',.<>/~`]/.test(password),
  };
  const allChecksPass = Object.values(passwordChecks).every(Boolean);

  const getUserIdPrefix = () => {
    if (!selectedDepartment) return "";
    const deptCode = DEPARTMENT_CODES[selectedDepartment] || "USR";
    const withDagPrefix = !NO_DAG_PREFIX_DEPARTMENTS.has(selectedDepartment);
    if (NO_DIRECTOR_DEPARTMENTS.has(selectedDepartment)) {
      if (!withDagPrefix) return `${deptCode}-`;
      return /^DAG-/i.test(deptCode) ? `${deptCode}-` : `DAG-${deptCode}-`;
    }
    const isDirector =
      selectedDepartment === "Удирдлага" ||
      String(selectedPosition ?? "")
        .toLowerCase()
        .includes("захирал");
    if (isDirector) return ".";
    if (!withDagPrefix) return `${deptCode}-`;
    return /^DAG-/i.test(deptCode) ? `${deptCode}-` : `DAG-${deptCode}-`;
  };

  // Department picked → fetch everyone in it so the user can find themselves
  const handleSelectLoginDepartment = useCallback(
    async (department: string) => {
      setLoginDepartment(department);
      loginForm.setValue("userId", "");
      setDepartmentEmployees([]);
      if (!department) return;
      setIsLoadingEmployees(true);
      try {
        const response = await fetch(
          `/api/auth/by-department?department=${encodeURIComponent(department)}`,
        );
        if (response.status === 429) {
          setDepartmentEmployees([]);
          return;
        }
        const data = await response.json();
        const users = Array.isArray(data.users) ? data.users : [];
        const rank = DEPARTMENT_POSITIONS[department] ?? [];
        const sorted = [...users].sort(
          (
            a: { name?: string; position?: string },
            b: { name?: string; position?: string },
          ) => {
            const ra = rank.indexOf(String(a.position ?? "").trim());
            const rb = rank.indexOf(String(b.position ?? "").trim());
            const ia = ra === -1 ? rank.length : ra;
            const ib = rb === -1 ? rank.length : rb;
            if (ia !== ib) return ia - ib;
            return String(a.name ?? "").localeCompare(
              String(b.name ?? ""),
              "mn",
            );
          },
        );
        setDepartmentEmployees(sorted);
      } catch {
        setDepartmentEmployees([]);
      } finally {
        setIsLoadingEmployees(false);
      }
    },
    [loginForm],
  );

  const authFetchError = async (response: Response, fallback: string) => {
    if (response.status === 429) {
      throw new Error(t("loginErrTooManyRequests"));
    }
    let message = fallback;
    try {
      const data = await response.json();
      if (typeof data?.message === "string") message = data.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  };

  const handleRegisterInfo = async (
    values: z.infer<typeof registerFormSchema>,
  ) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        await authFetchError(response, t("loginErrRegisterFailed"));
      }
      const data = await response.json();
      setRegisteredUser({
        userId: data.userId,
        name: data.name,
      });
      setRegisterStep("pending");
      toast({
        title: t("loginToastRequestSentTitle"),
        description: `${t("loginYourIdPrefix")}: ${data.userId}`,
      });
    } catch (error: unknown) {
      toast({
        title: t("error"),
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetPassword = async (
    values: z.infer<typeof claimSetPasswordFormSchema>,
  ) => {
    const userId = checkedUser?.userId;
    if (!userId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/set-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          password: values.password,
          claimToken: values.claimCode,
        }),
      });
      if (!response.ok) {
        await authFetchError(response, t("loginErrSetPasswordFailed"));
      }
      const data = await response.json();
      // [N-2] token/refreshToken cookies are set by backend as HttpOnly
      const secure =
        typeof window !== "undefined" && window.location.protocol === "https:";
      Cookies.set("user", JSON.stringify(data.user), {
        expires: 3 / 24,
        sameSite: "strict",
        secure,
        path: "/",
      });
      toast({
        title: t("success"),
        description: t("loginToastPasswordSetDesc"),
      });
      window.location.replace("/");
    } catch (error: unknown) {
      toast({
        title: t("error"),
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckUser = async (values: z.infer<typeof loginFormSchema>) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/check-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        await authFetchError(response, t("loginErrCheckUserFailed"));
      }
      const data: UserCheckResult = await response.json();
      if (!data.exists) {
        if (data.registrationStatus === "pending") {
          toast({
            title: t("loginToastPendingTitle"),
            description: t("loginToastPendingDesc"),
            variant: "destructive",
          });
          return;
        }
        if (data.registrationStatus === "rejected") {
          toast({
            title: t("loginToastRejectedTitle"),
            description: t("loginToastRejectedDesc"),
            variant: "destructive",
          });
          return;
        }
        toast({
          title: t("loginToastUserNotFoundTitle"),
          description: t("loginToastUserNotFoundDesc"),
          variant: "destructive",
        });
        return;
      }
      if (data.isActive === false && data.hasPassword) {
        toast({
          title: t("loginToastAccountDisabledTitle"),
          description: t("loginToastAccountDisabledDesc"),
          variant: "destructive",
        });
        return;
      }
      // needsPasswordSetup: an admin has approved the registration and the
      // account is now claimable — the user proceeds to enter the claim
      // code the admin gave them + their new password (createPassword step).
      setCheckedUser(data);
      setLoginStep(data.hasPassword ? "password" : "createPassword");
    } catch (error: unknown) {
      toast({
        title: t("error"),
        description:
          (error as Error).message || t("loginErrCheckUserFailed"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (values: z.infer<typeof loginPasswordSchema>) => {
    if (!checkedUser?.userId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/login-by-id`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: checkedUser.userId,
          password: values.password,
        }),
      });
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(t("loginErrWrongPassword"));
        }
        if (response.status === 403) {
          await authFetchError(response, t("loginErrAdminCannotLoginHere"));
        }
        await authFetchError(response, t("loginErrLoginFailed"));
      }
      const data = await response.json();
      // [N-2] token/refreshToken cookies are set by backend as HttpOnly
      const secure =
        typeof window !== "undefined" && window.location.protocol === "https:";
      Cookies.set("user", JSON.stringify(data.user), {
        expires: 3 / 24,
        sameSite: "strict",
        secure,
        path: "/",
      });
      toast({
        title: t("loginToastLoginSuccessTitle"),
        description: t("loginToastRedirectingDesc"),
      });
      window.location.replace("/");
    } catch (error: unknown) {
      toast({
        title: t("loginToastLoginFailedTitle"),
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // In-flow step back (Буцах at top of card)
  const backStepRegister = () => {
    setRegisterStep("info");
    setRegisteredUser(null);
  };

  const backStepLogin = () => {
    setLoginStep("userId");
    setCheckedUser(null);
    claimPasswordForm.reset();
    loginPasswordForm.reset();
  };

  // Switch entirely between login <-> register, fully resetting state
  const switchToRegister = () => {
    setLoginStep("userId");
    setCheckedUser(null);
    loginForm.reset();
    loginPasswordForm.reset();
    setLoginDepartment("");
    setDepartmentEmployees([]);
    setRegisterStep("info");
    setRegisteredUser(null);
    setGeneratedUserId("");
    registerForm.reset();
    claimPasswordForm.reset();
    setFlowType("register");
  };

  const switchToLogin = () => {
    setRegisterStep("info");
    setRegisteredUser(null);
    setGeneratedUserId("");
    registerForm.reset();
    setLoginStep("userId");
    setCheckedUser(null);
    loginForm.reset();
    loginPasswordForm.reset();
    claimPasswordForm.reset();
    setLoginDepartment("");
    setDepartmentEmployees([]);
    setFlowType("login");
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {flowType === "register" ? (
        <motion.div
          key="register"
          initial={{ opacity: 0, x: 60, filter: "blur(8px)" }}
          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, x: -60, filter: "blur(8px)" }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <RegisterFlow
            registerForm={registerForm}
            positions={positions}
            selectedDepartment={selectedDepartment}
            generatedUserId={generatedUserId}
            registeredUser={registeredUser}
            registerStep={registerStep}
            isLoading={isLoading}
            getUserIdPrefix={getUserIdPrefix}
            handleRegisterInfo={handleRegisterInfo}
            onBack={backStepRegister}
            onSwitch={switchToLogin}
          />
        </motion.div>
      ) : (
        <motion.div
          key="login"
          initial={{ opacity: 0, x: -60, filter: "blur(8px)" }}
          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, x: 60, filter: "blur(8px)" }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <LoginFlow
            loginForm={loginForm}
            loginPasswordForm={loginPasswordForm}
            claimPasswordForm={claimPasswordForm}
            loginStep={loginStep}
            checkedUser={checkedUser}
            loginDepartment={loginDepartment}
            departmentEmployees={departmentEmployees}
            isLoadingEmployees={isLoadingEmployees}
            isLoading={isLoading}
            showPassword={showPassword}
            showConfirmPassword={showConfirmPassword}
            forgotPasswordOpen={forgotPasswordOpen}
            setShowPassword={setShowPassword}
            setShowConfirmPassword={setShowConfirmPassword}
            setForgotPasswordOpen={setForgotPasswordOpen}
            passwordChecks={passwordChecks}
            allChecksPass={allChecksPass}
            handleSelectLoginDepartment={handleSelectLoginDepartment}
            handleCheckUser={handleCheckUser}
            handleLogin={handleLogin}
            handleSetPassword={handleSetPassword}
            onBack={backStepLogin}
            onSwitch={switchToRegister}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
