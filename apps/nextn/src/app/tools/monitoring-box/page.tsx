"use client";

import Link from "next/link";
import { ArrowUpRight, Activity, Users2 } from "lucide-react";
import ToolPageHeader from "@/components/shared/ToolPageHeader";

interface MonitorCard {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  gradient: string;
  status: "live" | "soon";
}

const MONITOR_CARDS: MonitorCard[] = [
  {
    id: "related-party-transactions",
    title: "Харилцсан гүйлгээ",
    description:
      "Хэдэн ч тооны CIF/FORACID-ыг сонгож, тэдгээрийн хооронд шууд хийгдсэн дотоод гүйлгээг өгөгдсөн хугацааны хүрээнд илрүүлж, нэгтгэн харуулна.",
    icon: Users2,
    href: "/tools/monitoring-box/related-party-transactions",
    gradient: "from-orange-500 to-red-500",
    status: "live",
  },
];

export default function MonitoringBoxPage() {
  return (
    <div className="min-h-screen bg-background">
      <ToolPageHeader
        icon={
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-md">
            <Activity className="w-3.5 h-3.5 text-white" />
          </div>
        }
        title="Monitoring Box"
      />

      <div className="w-full px-4 md:px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MONITOR_CARDS.map((card) => {
            const Icon = card.icon;
            const disabled = card.status === "soon";
            const CardInner = (
              <div
                className={`group relative flex flex-col gap-3 rounded-2xl p-5 h-full
                  bg-card/60 border border-border/50 overflow-hidden transition-all duration-200
                  ${disabled ? "opacity-60 cursor-not-allowed" : "hover:border-orange-500/40 hover:shadow-[0_0_30px_rgba(249,115,22,0.12)] cursor-pointer"}`}
              >
                <div
                  className={`absolute left-0 inset-y-0 w-[3px] bg-gradient-to-b ${card.gradient} opacity-0 ${!disabled ? "group-hover:opacity-100" : ""} transition-opacity duration-200`}
                />
                <div className="flex items-start justify-between">
                  <div
                    className={`w-11 h-11 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center shadow-lg`}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  {!disabled && (
                    <ArrowUpRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-orange-400 transition-colors" />
                  )}
                  {disabled && (
                    <span className="text-[10px] font-medium bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                      Тун удахгүй
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-foreground mb-1.5">
                    {card.title}
                  </h3>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">
                    {card.description}
                  </p>
                </div>
              </div>
            );
            return disabled ? (
              <div key={card.id}>{CardInner}</div>
            ) : (
              <Link key={card.id} href={card.href}>
                {CardInner}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
