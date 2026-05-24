"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Cookies from "js-cookie";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { DEPARTMENT_POSITIONS, DEPARTMENT_CODES } from "@/lib/constants";
import { RegisterFlow } from "./_components/RegisterFlow";
import { LoginFlow } from "./_components/LoginFlow";
import {
  registerFormSchema,
  loginFormSchema,
  passwordFormSchema,
  loginPasswordSchema,
  type FlowType,
  type RegisterStep,
  type LoginStep,
  type UserCheckResult,
} from "./_components/login.types";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const { toast } = useToast();
  const [flowType, setFlowType] = useState<FlowType>("login");

  // Register state
  const [registerStep, setRegisterStep] = useState<RegisterStep>("info");
  const [positions, setPositions] = useState<string[]>([]);
  const [generatedUserId, setGeneratedUserId] = useState<string>("");
  const [registeredUser, setRegisteredUser] = useState<{
    userId: string;
    name: string;
    claimToken: string;
  } | null>(null);

  // Login state
  const [loginStep, setLoginStep] = useState<LoginStep>("userId");
  const [checkedUser, setCheckedUser] = useState<UserCheckResult | null>(null);
  const [userSuggestions, setUserSuggestions] = useState<
    Array<{ userId: string; name: string; department: string }>
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Common state
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);

  // Forms
  const registerForm = useForm<z.infer<typeof registerFormSchema>>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { department: "", position: "", name: "" },
  });

  const loginForm = useForm<z.infer<typeof loginFormSchema>>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { userId: "" },
  });

  const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const loginPasswordForm = useForm<z.infer<typeof loginPasswordSchema>>({
    resolver: zodResolver(loginPasswordSchema),
    defaultValues: { password: "" },
  });

  const selectedDepartment = registerForm.watch("department");
  const enteredName = registerForm.watch("name");
  const password = passwordForm.watch("password");

  useEffect(() => {
    if (selectedDepartment) {
      setPositions(DEPARTMENT_POSITIONS[selectedDepartment] || []);
      registerForm.setValue("position", "");
    }
  }, [selectedDepartment]);

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

      if (selectedDepartment === "Удирдлага") {
        setGeneratedUserId(`.${namePart}-${deptCode}`);
      } else if (selectedDepartment === "Дата анализын алба") {
        setGeneratedUserId(`${deptCode}-${namePart}`);
      } else {
        setGeneratedUserId(`DAG-${deptCode}-${namePart}`);
      }
    } else {
      setGeneratedUserId("");
    }
  }, [selectedDepartment, enteredName]);

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
    if (selectedDepartment === "Удирдлага") return ".";
    if (selectedDepartment === "Дата анализын алба") return `${deptCode}-`;
    return `DAG-${deptCode}-`;
  };

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchUsers = useCallback(async (query: string) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!query || query.length < 2) {
      setUserSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `${API_URL}/auth/search?q=${encodeURIComponent(query)}`,
        );
        const data = await response.json();
        if (data.users && data.users.length > 0) {
          setUserSuggestions(data.users);
          setShowSuggestions(true);
        } else {
          setUserSuggestions([]);
          setShowSuggestions(false);
        }
      } catch {
        setUserSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  }, []);

  const handleSelectSuggestion = (userId: string) => {
    loginForm.setValue("userId", userId);
    setShowSuggestions(false);
    setUserSuggestions([]);
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
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Бүртгэл үүсгэхэд алдаа гарлаа");
      setRegisteredUser({
        userId: data.userId,
        name: data.name,
        claimToken: data.claimToken,
      });
      setRegisterStep("password");
      toast({
        title: "Бүртгэл амжилттай",
        description: `Таны ID: ${data.userId}`,
      });
    } catch (error: unknown) {
      toast({
        title: "Алдаа",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetPassword = async (
    values: z.infer<typeof passwordFormSchema>,
  ) => {
    const userId = registeredUser?.userId || checkedUser?.userId;
    const claimToken = registeredUser?.claimToken;
    if (!userId || !claimToken) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/set-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, password: values.password, claimToken }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Нууц үг тохируулахад алдаа гарлаа");
      // [N-2] token/refreshToken cookies are set by backend as HttpOnly
      const secure =
        typeof window !== "undefined" &&
        window.location.protocol === "https:";
      Cookies.set("user", JSON.stringify(data.user), {
        expires: 3,
        sameSite: "strict",
        secure,
        path: "/",
      });
      toast({
        title: "Амжилттай",
        description: "Нууц үг амжилттай тохирууллаа",
      });
      window.location.replace("/");
    } catch (error: unknown) {
      toast({
        title: "Алдаа",
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
      const data: UserCheckResult = await response.json();
      if (!data.exists) {
        toast({
          title: "Хэрэглэгч олдсонгүй",
          description: "Энэ ID-тай хэрэглэгч бүртгэлгүй байна",
          variant: "destructive",
        });
        return;
      }
      if (data.isActive === false) {
        toast({
          title: "Эрх хаагдсан",
          description: "Таны эрх идэвхгүй байна. Админд хандана уу.",
          variant: "destructive",
        });
        return;
      }
      setCheckedUser(data);
      setLoginStep(data.hasPassword ? "password" : "createPassword");
    } catch (error: unknown) {
      toast({
        title: "Алдаа",
        description:
          (error as Error).message || "Хэрэглэгч шалгахад алдаа гарлаа",
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
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Нэвтрэхэд алдаа гарлаа");
      // [N-2] token/refreshToken cookies are set by backend as HttpOnly
      const secure =
        typeof window !== "undefined" &&
        window.location.protocol === "https:";
      Cookies.set("user", JSON.stringify(data.user), {
        expires: 3,
        sameSite: "strict",
        secure,
        path: "/",
      });
      toast({
        title: "Амжилттай нэвтэрлээ",
        description: "Нүүр хуудас руу шилжүүлж байна...",
      });
      window.location.replace("/");
    } catch (error: unknown) {
      toast({
        title: "Алдаа",
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
    passwordForm.reset();
  };

  const backStepLogin = () => {
    setLoginStep("userId");
    setCheckedUser(null);
    passwordForm.reset();
    loginPasswordForm.reset();
  };

  // Switch entirely between login <-> register, fully resetting state
  const switchToRegister = () => {
    setLoginStep("userId");
    setCheckedUser(null);
    loginForm.reset();
    loginPasswordForm.reset();
    setRegisterStep("info");
    setRegisteredUser(null);
    setGeneratedUserId("");
    registerForm.reset();
    passwordForm.reset();
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
    passwordForm.reset();
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
            passwordForm={passwordForm}
            positions={positions}
            selectedDepartment={selectedDepartment}
            generatedUserId={generatedUserId}
            registeredUser={registeredUser}
            registerStep={registerStep}
            isLoading={isLoading}
            showPassword={showPassword}
            showConfirmPassword={showConfirmPassword}
            setShowPassword={setShowPassword}
            setShowConfirmPassword={setShowConfirmPassword}
            passwordChecks={passwordChecks}
            allChecksPass={allChecksPass}
            getUserIdPrefix={getUserIdPrefix}
            handleRegisterInfo={handleRegisterInfo}
            handleSetPassword={handleSetPassword}
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
            passwordForm={passwordForm}
            loginStep={loginStep}
            checkedUser={checkedUser}
            userSuggestions={userSuggestions}
            showSuggestions={showSuggestions}
            isSearching={isSearching}
            isLoading={isLoading}
            showPassword={showPassword}
            showConfirmPassword={showConfirmPassword}
            forgotPasswordOpen={forgotPasswordOpen}
            setShowPassword={setShowPassword}
            setShowConfirmPassword={setShowConfirmPassword}
            setForgotPasswordOpen={setForgotPasswordOpen}
            setShowSuggestions={setShowSuggestions}
            passwordChecks={passwordChecks}
            allChecksPass={allChecksPass}
            searchUsers={searchUsers}
            handleSelectSuggestion={handleSelectSuggestion}
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
