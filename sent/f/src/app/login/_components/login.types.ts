import { z } from "zod";

export const PARTICLE_POSITIONS = [
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

const passwordSchema = z
  .string()
  .min(8, "Нууц үг хамгийн багадаа 8 тэмдэгт байх ёстой")
  .regex(/[a-z]/, "Жижиг үсэг агуулсан байх ёстой")
  .regex(/[A-Z]/, "Том үсэг агуулсан байх ёстой")
  .regex(/[0-9]/, "Тоо агуулсан байх ёстой")
  .regex(
    /[@$!%*?&#^()\-_=+[\]{}|;:',.<>/~`]/,
    "Тусгай тэмдэгт агуулсан байх ёстой",
  );

export const registerFormSchema = z.object({
  department: z.string().min(1, "Хэлтсээ сонгоно уу"),
  position: z.string().min(1, "Албан тушаалаа сонгоно уу"),
  name: z.string().min(1, "Нэрээ оруулна уу"),
});

export const loginFormSchema = z.object({
  userId: z.string().min(1, "ID оруулна уу"),
});

export const passwordFormSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Нууц үг таарахгүй байна",
    path: ["confirmPassword"],
  });

export const loginPasswordSchema = z.object({
  password: z.string().min(1, "Нууц үгээ оруулна уу"),
});

export type FlowType = "select" | "register" | "login";
export type RegisterStep = "info" | "password";
export type LoginStep = "userId" | "password" | "createPassword";

export interface UserCheckResult {
  exists: boolean;
  hasPassword: boolean;
  userId: string | null;
  name: string | null;
  department: string | null;
  isActive?: boolean;
}

export interface PasswordChecks {
  minLength: boolean;
  hasLower: boolean;
  hasUpper: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}
