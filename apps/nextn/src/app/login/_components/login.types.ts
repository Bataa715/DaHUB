import { z } from "zod";
import type { TranslationKey } from "@/contexts/LanguageContext";

type Translate = (key: TranslationKey) => string;

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

export const loginPasswordSchema = z.object({
  password: z.string().min(1, "Нууц үгээ оруулна уу"),
});

/**
 * Locale-aware zod schema factories — these mirror the static schemas above
 * (used elsewhere purely for `z.infer<typeof ...>` typing) but resolve their
 * validation messages through `t()` so errors respect the language toggle.
 * Only `page.tsx` actually instantiates forms, so only it needs to call these.
 */
function createPasswordSchema(t: Translate) {
  return z
    .string()
    .min(8, t("zodPasswordMinLength"))
    .regex(/[a-z]/, t("zodPasswordLower"))
    .regex(/[A-Z]/, t("zodPasswordUpper"))
    .regex(/[0-9]/, t("zodPasswordNumber"))
    .regex(/[@$!%*?&#^()\-_=+[\]{}|;:',.<>/~`]/, t("zodPasswordSpecial"));
}

export function createRegisterFormSchema(t: Translate) {
  return z.object({
    department: z.string().min(1, t("zodSelectDept")),
    position: z.string().min(1, t("zodSelectPosition")),
    name: z.string().min(1, t("zodEnterName")),
  });
}

export function createLoginFormSchema(t: Translate) {
  return z.object({
    userId: z.string().min(1, t("zodEnterId")),
  });
}

export function createLoginPasswordSchema(t: Translate) {
  return z.object({
    password: z.string().min(1, t("zodEnterPassword")),
  });
}

export type FlowType = "select" | "register" | "login";
export type RegisterStep = "info" | "pending";
export type LoginStep = "userId" | "password" | "createPassword";

export interface UserCheckResult {
  exists: boolean;
  hasPassword: boolean;
  userId: string | null;
  name?: string | null;
  isActive?: boolean;
  /** PENDING бүртгэл — админ баталгаажуулж, claim код өгсний дараа нууц үг тохируулна */
  needsPasswordSetup?: boolean;
  /** exists=false үед — бүртгэлийн хүсэлтийн одоогийн төлөв (админ хараахан
   *  шийдээгүй/татгалзсан) байвал login хуудсанд харуулах зорилготой */
  registrationStatus?: "pending" | "rejected";
}

/** Админаас авсан claim код ашиглан анхны удаа нууц үг тохируулах schema */
export const claimSetPasswordFormSchema = z
  .object({
    claimCode: z.string().min(1, "Админаас авсан кодоо оруулна уу"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Нууц үг таарахгүй байна",
    path: ["confirmPassword"],
  });

export function createClaimSetPasswordFormSchema(t: Translate) {
  return z
    .object({
      claimCode: z.string().min(1, t("zodEnterClaimCode")),
      password: createPasswordSchema(t),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("zodPasswordsNoMatch"),
      path: ["confirmPassword"],
    });
}

export interface PasswordChecks {
  minLength: boolean;
  hasLower: boolean;
  hasUpper: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}
