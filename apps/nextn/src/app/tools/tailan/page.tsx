"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { tailanApi } from "@/lib/api";
import {
  FileText,
  Users,
  ChevronRight,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import Link from "next/link";

export default function TailanPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [isDeptHead, setIsDeptHead] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tailanApi
      .getRole()
      .then((r) => setIsDeptHead(r.isDeptHead))
      .catch(() => setIsDeptHead(false))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );

  return (
    <div className="relative min-h-[calc(100vh-64px)] bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-6">
      {/* Back button */}
      <Link
        href="/tools"
        className="absolute top-5 left-5 flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Хэрэгслүүд
      </Link>

      <div className="w-full max-w-lg space-y-4">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Улирлын тайлан</h1>
          <p className="text-slate-400 text-sm">
            Улирлын ажлын тайлан бэлтгэх систем
          </p>
        </div>

        <div className="grid gap-3">
          {/* Өөрийн тайлан */}
          <button
            onClick={() => router.push("/tools/tailan/mine")}
            className="group flex items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/50 rounded-2xl p-5 transition-all duration-200 text-left"
          >
            <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
              <FileText className="h-5 w-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-white">
                Өөрийн тайлан
              </h2>
              <p className="text-slate-400 text-xs mt-0.5">
                Улирлын ажлын тайлангаа бэлтгэж, хэлтсийн ахлагч руу илгээх
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-500 group-hover:text-blue-400 transition-colors" />
          </button>

          {/* Хэлтсийн тайлан — зөвхөн dept head */}
          {isDeptHead && (
            <button
              onClick={() => router.push("/tools/tailan/department")}
              className="group flex items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/50 rounded-2xl p-5 transition-all duration-200 text-left"
            >
              <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/30 transition-colors">
                <Users className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-white">
                  Хэлтсийн тайлан
                </h2>
                <p className="text-slate-400 text-xs mt-0.5">
                  Хэлтсийн гишүүдийн ирүүлсэн тайлануудыг нэгтгэх, татах
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-500 group-hover:text-emerald-400 transition-colors" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
