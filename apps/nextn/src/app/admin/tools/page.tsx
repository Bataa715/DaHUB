"use client";

import { useToolAccess } from "./_useToolAccess";
import { ToolDetailSheet } from "./_ToolDetailSheet";
import { Loader2, Shield, Wrench } from "lucide-react";
import Link from "next/link";
import AdminPageHeader from "@/components/shared/AdminPageHeader";
import { TOOL_CATEGORIES } from "./_tool-groups";

export default function AdminToolsPage() {
  const access = useToolAccess();
  const {
    t,
    user,
    loading,
    mounted,
    visibleGroups,
    users,
    handleGroupSelect,
    getUsersWithAnyVariant,
    totalUsersWithAnyTool,
    totalPermissions,
  } = access;

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  if (!user?.isAdmin && !user?.isSuperAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground/60 text-sm">
            {t("admToolsPageNoAccessMsg")}
          </p>
          <a
            href="/admin/login"
            className="mt-3 inline-block text-xs text-muted-foreground hover:text-foreground underline"
          >
            {t("admToolsPageAdminLoginLink")}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminPageHeader
        icon={
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-premium">
            <Wrench className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
        }
        title={t("admToolsPagePageTitle")}
      />

      <div className="container mx-auto py-6 px-4 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: t("admToolsPageStatTotalUsers"), value: users.length },
            {
              label: t("admToolsPageStatWithAccess"),
              value: totalUsersWithAnyTool,
            },
            {
              label: t("admToolsPageStatTotalPermissions"),
              value: totalPermissions,
            },
            { label: t("admToolsPageStatTools"), value: visibleGroups.length },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-background border border-border rounded-xl px-4 py-3 shadow-premium ring-hairline"
            >
              <p className="text-xs text-muted-foreground/60 mb-0.5">
                {stat.label}
              </p>
              <p className="text-xl font-semibold text-foreground">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Tool Cards — ангиллаар: Dashboard / Хэрэгсэл */}
        {TOOL_CATEGORIES.map((category) => {
          const groups = visibleGroups.filter(
            (g) => g.category === category.id,
          );
          if (groups.length === 0) return null;
          return (
            <section key={category.id} className="space-y-3">
              <div className="flex items-baseline gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                  {t(category.labelKey)}
                </h2>
                <span className="text-xs text-muted-foreground/60">
                  {groups.length}
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {groups.map((group) => {
                  const usersWithAccess = getUsersWithAnyVariant(group);
                  const pct =
                    users.length > 0
                      ? Math.round(
                          (usersWithAccess.length / users.length) * 100,
                        )
                      : 0;
                  return (
                    <button
                      key={group.id}
                      onClick={() => handleGroupSelect(group)}
                      className="group text-left bg-background border-2 border-border hover:border-border rounded-xl p-3 flex flex-col gap-3 hover:-translate-y-0.5 transition-all duration-300"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground leading-snug whitespace-normal break-words">
                          {t(group.nameKey)}
                        </p>
                        {group.variants.length > 1 && (
                          <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                            {group.variants.length}{" "}
                            {t("admToolsPageScenarioUnit")}
                          </p>
                        )}
                      </div>
                      <div className="mt-auto">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground/60">
                            {usersWithAccess.length} {t("admToolsPageUserUnit")}
                          </span>
                          {group.adminPath ? (
                            <Link
                              href={group.adminPath}
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {group.adminLabelKey
                                ? t(group.adminLabelKey)
                                : t("admToolsPageSettingsArrow")}
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">
                              {pct}%
                            </span>
                          )}
                        </div>
                        <div className="mt-2 h-0.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-muted-foreground/60 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* Tool Detail Sheet */}
      <ToolDetailSheet access={access} />
    </div>
  );
}
