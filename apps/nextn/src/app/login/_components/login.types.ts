import { z } from "zod";

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
  isActive?: boolean;
  claimToken?: string;
}

export interface PasswordChecks {
  minLength: boolean;
  hasLower: boolean;
  hasUpper: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}
