import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Энгийн хэрэглэгч — админ/супер админ биш */
export function isRegularAppUser(u: {
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
}): boolean {
  return !u.isAdmin && !u.isSuperAdmin;
}

/** Веб дээр (ажилтнууд г.м.) харагдах эсэх — system/admin account шүүлт */
export function isWebVisibleUser(u: {
  name?: string;
  userId?: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
}): boolean {
  if (!isRegularAppUser(u)) return false;
  const name = String(u.name ?? "").trim().toLowerCase();
  const userId = String(u.userId ?? "").trim().toLowerCase();
  if (
    name.includes("system admin") ||
    name.includes("systemadmin") ||
    /^admin$/i.test(name) ||
    userId === "admin" ||
    userId.startsWith("admin.")
  ) {
    return false;
  }
  return true;
}
