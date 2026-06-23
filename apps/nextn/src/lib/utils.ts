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
