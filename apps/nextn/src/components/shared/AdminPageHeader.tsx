"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ReactNode } from "react";

interface AdminPageHeaderProps {
  href?: string;
  icon: ReactNode;
  title: string;
  rightContent?: ReactNode;
}

export default function AdminPageHeader({
  href = "/admin",
  icon,
  title,
  rightContent,
}: AdminPageHeaderProps) {
  return (
    <div className="sticky top-0 z-20 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center gap-3">
        <Link
          href={href}
          className="flex items-center gap-1.5 text-slate-400 hover:text-slate-100 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Буцах
        </Link>
        <span className="text-slate-700">/</span>
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-semibold text-slate-100">{title}</span>
        </div>
        {rightContent && <div className="ml-auto">{rightContent}</div>}
      </div>
    </div>
  );
}
