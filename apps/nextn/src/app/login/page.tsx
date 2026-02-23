"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Cookies from "js-cookie";
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
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  ArrowRight,
  Loader2,
  Building2,
  User,
  ChevronLeft,
  Briefcase,
  KeyRound,
  UserPlus,
  Check,
  X,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import Image from "next/image";
import { DEPARTMENTS, DEPARTMENT_POSITIONS } from "@/lib/constants";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export const dynamic = "force-dynamic";

// Fixed particle positions
const PARTICLE_POSITIONS = [
  { left: 15, top: 25 },
  { left: 85, top: 10 },
  { left: 45, top: 80 },
  { left: 70, top: 35 },
  { left: 25, top: 60 },
  { left: 90, top: 70 },
  { left: 10, top: 90 },
  { left: 55, top: 15 },
  { left: 35, top: 45 },
  { left: 80, top: 55 },
  { left: 5, top: 40 },
  { left: 60, top: 95 },
];

// Department code mapping
const DEPARTMENT_CODES: Record<string, string> = {
  Удирдлага: "DAG",
  "Дата анализын алба": "DAA",
  "Ерөнхий аудитын хэлтэс": "EAH",
  "Зайны аудит чанарын баталгаажуулалтын хэлтэс": "ZAGCHBH",
  "Мэдээллийн технологийн аудитын хэлтэс": "MTAH",
};

// Password validation schema
const passwordSchema = z
  .string()
  .min(8, "Нууц үг хамгийн багадаа 8 тэмдэгт байх ёстой")
  .regex(/[a-z]/, "Жижиг үсэг агуулсан байх ёстой")
  .regex(/[A-Z]/, "Том үсэг агуулсан байх ёстой")
  .regex(/[0-9]/, "Тоо агуулсан байх ёстой")
  .regex(
    /[@$!%*?&#^()\-_=+\[\]{}|;:',.<>\/~`]/,
    "Тусгай тэмдэгт агуулсан байх ёстой",
  );

// Registration form schema
const registerFormSchema = z.object({
  department: z.string().min(1, "Хэлтсээ сонгоно уу"),
  position: z.string().min(1, "Албан тушаалаа сонгоно уу"),
  name: z.string().min(1, "Нэрээ оруулна уу"),
});

// Login form schema
const loginFormSchema = z.object({
  userId: z.string().min(1, "ID оруулна уу"),
});

// Password form schema
const passwordFormSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Нууц үг таарахгүй байна",
    path: ["confirmPassword"],
  });

// Login password schema
const loginPasswordSchema = z.object({
  password: z.string().min(1, "Нууц үгээ оруулна уу"),
});

type FlowType = "select" | "register" | "login";
type RegisterStep = "info" | "password";
type LoginStep = "userId" | "password" | "createPassword";

interface UserCheckResult {
  exists: boolean;
  hasPassword: boolean;
  userId: string | null;
  name: string | null;
  department: string | null;
  isActive?: boolean;
}

export default function LoginPage() {
  const { toast } = useToast();
  const [flowType, setFlowType] = useState<FlowType>("select");

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

  // Update positions when department changes
  useEffect(() => {
    if (selectedDepartment) {
      setPositions(DEPARTMENT_POSITIONS[selectedDepartment] || []);
      registerForm.setValue("position", "");
    }
  }, [selectedDepartment]);

  // Generate userId preview when department or name changes
  useEffect(() => {
    if (selectedDepartment && enteredName) {
      const deptCode = DEPARTMENT_CODES[selectedDepartment] || "USR";
      // Format name: capitalize first letter of each part, keep hyphens
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

  // Get userId prefix for selected department
  const getUserIdPrefix = () => {
    if (!selectedDepartment) return "";
    const deptCode = DEPARTMENT_CODES[selectedDepartment] || "USR";
    if (selectedDepartment === "Удирдлага") {
      return ".";
    }
    if (selectedDepartment === "Дата анализын алба") {
      return `${deptCode}-`;
    }
    return `DAG-${deptCode}-`;
  };

  // Password strength checks
  const passwordChecks = {
    minLength: password.length >= 8,
    hasLower: /[a-z]/.test(password),
    hasUpper: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[@$!%*?&#^()\-_=+\[\]{}|;:',.<>\/~`]/.test(password),
  };

  const allChecksPass = Object.values(passwordChecks).every(Boolean);

  // Search users for autocomplete
  const searchUsers = async (query: string) => {
    if (!query || query.length < 2) {
      setUserSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);
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
    } catch (error) {
      console.error("Search error:", error);
      setUserSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle selecting a suggestion
  const handleSelectSuggestion = (userId: string) => {
    loginForm.setValue("userId", userId);
    setShowSuggestions(false);
    setUserSuggestions([]);
  };

  // Register step 1: Submit user info
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

      if (!response.ok) {
        throw new Error(data.message || "Бүртгэл үүсгэхэд алдаа гарлаа");
      }

      setRegisteredUser({ userId: data.userId, name: data.name });
      setRegisterStep("password");
      toast({
        title: "Бүртгэл амжилттай",
        description: `Таны ID: ${data.userId}`,
      });
    } catch (error: any) {
      toast({
        title: "Алдаа",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Register step 2 / Login create password: Set password
  const handleSetPassword = async (
    values: z.infer<typeof passwordFormSchema>,
  ) => {
    const userId = registeredUser?.userId || checkedUser?.userId;
    if (!userId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, password: values.password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Нууц үг тохируулахад алдаа гарлаа");
      }

      // Set cookies with proper attributes
      const accessToken = data.accessToken || data.token;
      const refreshToken = data.refreshToken;

      Cookies.set("token", accessToken, {
        expires: 1 / 24,
        sameSite: "lax",
        path: "/",
      }); // 1 hour
      Cookies.set("refreshToken", refreshToken, {
        expires: 30,
        sameSite: "lax",
        path: "/",
      }); // 30 days
      Cookies.set("user", JSON.stringify(data.user), {
        expires: 1 / 24,
        sameSite: "lax",
        path: "/",
      });

      toast({
        title: "Амжилттай",
        description: "Нууц үг амжилттай тохирууллаа",
      });

      // Full reload so AuthProvider re-reads cookies and user state is fresh
      setTimeout(() => {
        window.location.href = "/";
      }, 300);
    } catch (error: any) {
      toast({
        title: "Алдаа",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Login step 1: Check user
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

      if (data.hasPassword) {
        setLoginStep("password");
      } else {
        setLoginStep("createPassword");
      }
    } catch (error: any) {
      toast({
        title: "Алдаа",
        description: error.message || "Хэрэглэгч шалгахад алдаа гарлаа",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Login step 2: Enter password
  const handleLogin = async (values: z.infer<typeof loginPasswordSchema>) => {
    if (!checkedUser?.userId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/login-by-id`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: checkedUser.userId,
          password: values.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Нэвтрэхэд алдаа гарлаа");
      }

      // Set cookies with proper attributes
      const accessToken = data.accessToken || data.token;
      const refreshToken = data.refreshToken;

      Cookies.set("token", accessToken, {
        expires: 1 / 24,
        sameSite: "lax",
        path: "/",
      }); // 1 hour
      Cookies.set("refreshToken", refreshToken, {
        expires: 30,
        sameSite: "lax",
        path: "/",
      }); // 30 days
      Cookies.set("user", JSON.stringify(data.user), {
        expires: 1 / 24,
        sameSite: "lax",
        path: "/",
      });

      toast({
        title: "Амжилттай нэвтэрлээ",
        description: "Нүүр хуудас руу шилжүүлж байна...",
      });

      // Full reload so AuthProvider re-reads cookies and user state is fresh
      setTimeout(() => {
        window.location.href = "/";
      }, 300);
    } catch (error: any) {
      toast({
        title: "Алдаа",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Reset flows
  const resetRegisterFlow = () => {
    setFlowType("select");
    setRegisterStep("info");
    setRegisteredUser(null);
    setGeneratedUserId("");
    registerForm.reset();
    passwordForm.reset();
  };

  const resetLoginFlow = () => {
    setFlowType("select");
    setLoginStep("userId");
    setCheckedUser(null);
    loginForm.reset();
    passwordForm.reset();
    loginPasswordForm.reset();
  };

  // Selection screen
  if (flowType === "select") {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          <motion.div
            className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-blue-600/20 to-transparent rounded-full blur-3xl"
            animate={{ x: [0, 100, 0], y: [0, 50, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-purple-600/20 to-transparent rounded-full blur-3xl"
            animate={{ x: [0, -100, 0], y: [0, -50, 0], scale: [1, 1.2, 1] }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          />

          {PARTICLE_POSITIONS.map((pos, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-white/20 rounded-full"
              style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
              animate={{ y: [0, -30, 0], opacity: [0.2, 0.8, 0.2] }}
              transition={{
                duration: 3 + (i % 5),
                repeat: Infinity,
                delay: (i % 10) * 0.2,
              }}
            />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-4xl px-6"
        >
          {/* Logo & Title */}
          <div className="text-center mb-12">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              className="inline-flex items-center justify-center w-24 h-24 rounded-3xl mb-6 overflow-hidden bg-white shadow-2xl shadow-blue-500/20"
            >
              <Image
                src="/golomt.jpg"
                alt="Golomt Logo"
                width={96}
                height={96}
                className="object-contain"
              />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-4xl md:text-5xl font-bold text-white mb-4"
            >
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                DaHUB
              </span>
            </motion.h1>
          </div>

          {/* Option Cards */}
          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Register Card */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6, type: "spring" }}
              whileHover={{ scale: 1.02, y: -5 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setFlowType("register")}
              className="group cursor-pointer"
            >
              <div className="relative p-1 rounded-3xl bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-500 shadow-2xl shadow-blue-500/20">
                <div className="bg-slate-900/90 backdrop-blur-xl rounded-[22px] p-8 h-full">
                  <div className="flex flex-col items-center text-center">
                    <motion.div
                      className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-6 shadow-lg shadow-blue-500/30"
                      whileHover={{ rotate: [0, -10, 10, 0] }}
                    >
                      <UserPlus className="w-10 h-10 text-white" />
                    </motion.div>
                    <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-blue-400 transition-colors">
                      Бүртгүүлэх
                    </h3>
                    <p className="text-slate-400 text-sm">
                      Шинээр бүртгүүлэх ба нэвтрэх ID үүсгэх
                    </p>
                    <div className="mt-6 flex items-center gap-2 text-blue-400 group-hover:gap-4 transition-all">
                      <span className="text-sm font-medium">Эхлэх</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Login Card */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7, type: "spring" }}
              whileHover={{ scale: 1.02, y: -5 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setFlowType("login")}
              className="group cursor-pointer"
            >
              <div className="relative p-1 rounded-3xl bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 shadow-2xl shadow-purple-500/20">
                <div className="bg-slate-900/90 backdrop-blur-xl rounded-[22px] p-8 h-full">
                  <div className="flex flex-col items-center text-center">
                    <motion.div
                      className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-6 shadow-lg shadow-purple-500/30"
                      whileHover={{ rotate: [0, -10, 10, 0] }}
                    >
                      <KeyRound className="w-10 h-10 text-white" />
                    </motion.div>
                    <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-purple-400 transition-colors">
                      Нэвтрэх
                    </h3>
                    <p className="text-slate-400 text-sm">
                      Бүртгэлтэй бол ID-ээрээ нэвтрэх
                    </p>
                    <div className="mt-6 flex items-center gap-2 text-purple-400 group-hover:gap-4 transition-all">
                      <span className="text-sm font-medium">Үргэлжлүүлэх</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Register flow
  if (flowType === "register") {
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
              {/* Back Button */}
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={resetRegisterFlow}
                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm">Буцах</span>
              </motion.button>

              {/* Step 1: User Info */}
              <AnimatePresence mode="wait">
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
                      <p className="text-slate-400 mt-2">
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
                                    className={`h-12 rounded-xl bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 ${
                                      selectedDepartment
                                        ? "pl-[" +
                                          (getUserIdPrefix().length * 10 + 16) +
                                          "px]"
                                        : ""
                                    }`}
                                    style={{
                                      paddingLeft: selectedDepartment
                                        ? `${getUserIdPrefix().length * 9 + 16}px`
                                        : undefined,
                                    }}
                                    disabled={!selectedDepartment}
                                    {...field}
                                    onChange={(e) => {
                                      // Allow letters and hyphens only, remove spaces
                                      const value = e.target.value
                                        .replace(/\s+/g, "")
                                        .replace(
                                          /[^a-zA-Z\u0400-\u04FF-]/g,
                                          "",
                                        );
                                      field.onChange(value);
                                    }}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Generated User ID Preview */}
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
                                    onClick={() =>
                                      setShowPassword(!showPassword)
                                    }
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

                        {/* Password Requirements */}
                        <div className="space-y-2 p-4 bg-slate-800/50 rounded-xl">
                          <p className="text-xs text-slate-400 mb-2">
                            Нууц үгийн шаардлага:
                          </p>
                          {[
                            { key: "minLength", label: "8+ тэмдэгт" },
                            { key: "hasLower", label: "Жижиг үсэг (a-z)" },
                            { key: "hasUpper", label: "Том үсэг (A-Z)" },
                            { key: "hasNumber", label: "Тоо (0-9)" },
                            {
                              key: "hasSpecial",
                              label: "Тусгай тэмдэгт (@$!%*?&#)",
                            },
                          ].map((check) => (
                            <div
                              key={check.key}
                              className="flex items-center gap-2"
                            >
                              {passwordChecks[
                                check.key as keyof typeof passwordChecks
                              ] ? (
                                <Check className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <X className="w-4 h-4 text-slate-500" />
                              )}
                              <span
                                className={`text-sm ${passwordChecks[check.key as keyof typeof passwordChecks] ? "text-emerald-400" : "text-slate-500"}`}
                              >
                                {check.label}
                              </span>
                            </div>
                          ))}
                        </div>

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
                                      setShowConfirmPassword(
                                        !showConfirmPassword,
                                      )
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

  // Login flow
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
            {/* Back Button */}
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={resetLoginFlow}
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
                                    const value = e.target.value;
                                    field.onChange(value);
                                    searchUsers(value);
                                  }}
                                  onFocus={() => {
                                    if (userSuggestions.length > 0) {
                                      setShowSuggestions(true);
                                    }
                                  }}
                                  onBlur={() => {
                                    // Delay hiding to allow click on suggestion
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

                                {/* Suggestions Dropdown */}
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

                      {/* Нууц үг мартсан */}
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

                      {/* Password Requirements */}
                      <div className="space-y-2 p-4 bg-slate-800/50 rounded-xl">
                        <p className="text-xs text-slate-400 mb-2">
                          Нууц үгийн шаардлага:
                        </p>
                        {[
                          { key: "minLength", label: "8+ тэмдэгт" },
                          { key: "hasLower", label: "Жижиг үсэг (a-z)" },
                          { key: "hasUpper", label: "Том үсэг (A-Z)" },
                          { key: "hasNumber", label: "Тоо (0-9)" },
                          {
                            key: "hasSpecial",
                            label: "Тусгай тэмдэгт (@$!%*?&#)",
                          },
                        ].map((check) => (
                          <div
                            key={check.key}
                            className="flex items-center gap-2"
                          >
                            {passwordChecks[
                              check.key as keyof typeof passwordChecks
                            ] ? (
                              <Check className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <X className="w-4 h-4 text-slate-500" />
                            )}
                            <span
                              className={`text-sm ${passwordChecks[check.key as keyof typeof passwordChecks] ? "text-emerald-400" : "text-slate-500"}`}
                            >
                              {check.label}
                            </span>
                          </div>
                        ))}
                      </div>

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
