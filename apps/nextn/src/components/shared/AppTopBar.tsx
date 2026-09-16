"use client";

import Link from "next/link";
import { GolomtMark } from "@/components/GolomtMark";
import { AccountMenu } from "./AccountMenu";
import { LanguageQuickToggle } from "./LanguageQuickToggle";
import { ThemeQuickToggle } from "./ThemeQuickToggle";

/**
 * Бараан hero-ийн дээд мөр: Голомт тэмдэг + DaHUB (нүүр рүү), горим/хэл солих
 * товч, профайл цэс. Горим ба хэлний товч зөвхөн энд байна — сонголт нь бүх
 * хуудсанд үйлчилнэ (бусад хуудасны толгойг цэвэр байлгана).
 */
export function AppTopBar() {
  return (
    <header className="relative z-20 flex items-center gap-4 py-5">
      <Link
        href="/"
        className="flex items-center gap-2.5 rounded-full text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        <GolomtMark className="h-7 w-7" />
        <span className="text-xl font-black tracking-tight">DaHUB</span>
      </Link>
      <div className="ml-auto flex items-center gap-2">
        <LanguageQuickToggle className="h-10 w-10" />
        <ThemeQuickToggle className="h-10 w-10" />
        <AccountMenu />
      </div>
    </header>
  );
}
