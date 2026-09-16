"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users,
  UserPlus,
  Check,
  Loader2,
  Search,
  UserMinus,
} from "lucide-react";
import { DEPARTMENTS } from "@/lib/constants";
import type { ToolAccess } from "./_useToolAccess";

/** Сонгосон хэрэгслийн эрхтэй/эрхгүй хэрэглэгчид — олгох, хасах. */
export function ToolDetailSheet({ access }: { access: ToolAccess }) {
  const {
    t,
    selectedGroup,
    setSelectedGroup,
    isLoadingUsers,
    isSaving,
    selectedUsers,
    setSelectedUsers,
    activeTab,
    setActiveTab,
    selectedDepartment,
    setSelectedDepartment,
    revokeSelectedUsers,
    setRevokeSelectedUsers,
    revokeSearch,
    setRevokeSearch,
    revokeDepartment,
    setRevokeDepartment,
    grantSearch,
    setGrantSearch,
    activeVariant,
    activeToolId,
    handleVariantSwitch,
    getUsersWithAccess,
    getUsersWithoutAccess,
    toggleUserSelection,
    selectAllUsers,
    selectDepartmentUsers,
    grantAccess,
    bulkRevokeAccess,
    toggleRevokeSelection,
    selectAllRevokeUsers,
    selectRevokeDepartmentUsers,
    getFilteredUsersWithAccess,
    getFilteredUsersWithoutAccess,
  } = access;
  return (
    <Sheet open={!!selectedGroup} onOpenChange={() => setSelectedGroup(null)}>
      <SheetContent className="w-full sm:max-w-md bg-background border-border p-0 flex flex-col">
        <SheetTitle className="sr-only">
          {selectedGroup
            ? t(selectedGroup.nameKey)
            : t("admReportsManageAccessTitle")}
        </SheetTitle>
        {selectedGroup && activeVariant && (
          <>
            {/* Header */}
            <div className={`bg-gradient-to-br ${selectedGroup.color} p-5`}>
              <p className="text-foreground/70 text-xs font-medium uppercase tracking-widest mb-1">
                {t("admReportsManageAccessTitle")}
              </p>
              <p className="text-foreground text-lg font-semibold leading-snug">
                {t(selectedGroup.nameKey)}
              </p>
              <p className="text-foreground/60 text-xs mt-1 line-clamp-2">
                {t(selectedGroup.descKey)}
              </p>

              {/* Scenario switcher — only shown when the card groups >1 variant */}
              {selectedGroup.variants.length > 1 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {selectedGroup.variants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => handleVariantSwitch(v.id)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                        v.id === activeToolId
                          ? "bg-foreground text-background"
                          : "bg-foreground/10 text-foreground/70 hover:bg-foreground/20"
                      }`}
                    >
                      {t(v.labelKey)}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-4 mt-3">
                <div className="text-center">
                  <p className="text-foreground text-xl font-bold leading-none">
                    {getUsersWithAccess(activeToolId).length}
                  </p>
                  <p className="text-foreground/60 text-xs mt-0.5">
                    {t("admReportsWithAccessUnit")}
                  </p>
                </div>
                <div className="w-px bg-foreground/20" />
                <div className="text-center">
                  <p className="text-foreground text-xl font-bold leading-none">
                    {getUsersWithoutAccess(activeToolId).length}
                  </p>
                  <p className="text-foreground/60 text-xs mt-0.5">
                    {t("admReportsWithoutAccessUnit")}
                  </p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <TabsList className="grid w-full grid-cols-2 bg-background rounded-none border-b border-border h-10">
                <TabsTrigger
                  value="current"
                  className="rounded-none text-xs font-medium text-muted-foreground/60 data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-white"
                >
                  {t("admReportsWithAccessTabLabel")} (
                  {getUsersWithAccess(activeToolId).length})
                </TabsTrigger>
                <TabsTrigger
                  value="grant"
                  className="rounded-none text-xs font-medium text-muted-foreground/60 data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-white"
                >
                  {t("admReportsGrantAccessTabLabel")} (
                  {getUsersWithoutAccess(activeToolId).length})
                </TabsTrigger>
              </TabsList>

              {/* Users with access */}
              <TabsContent
                value="current"
                className="flex-1 overflow-hidden mt-0 hidden data-[state=active]:flex flex-col"
              >
                {/* Quick actions */}
                <div className="px-5 py-3 border-b border-border space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={selectAllRevokeUsers}
                      disabled={getUsersWithAccess(activeToolId).length === 0}
                      className="flex-1 text-xs text-muted-foreground hover:text-foreground bg-background border border-border hover:border-border/80 rounded-lg py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {t("admReportsSelectAllBtn")}
                    </button>
                    <button
                      onClick={() => setRevokeSelectedUsers(new Set())}
                      disabled={revokeSelectedUsers.size === 0}
                      className="flex-1 text-xs text-muted-foreground hover:text-foreground bg-background border border-border hover:border-border/80 rounded-lg py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {t("admReportsClearBtn")}
                    </button>
                  </div>
                  <Select
                    value={revokeDepartment}
                    onValueChange={(value) => {
                      setRevokeDepartment(value);
                      selectRevokeDepartmentUsers(value);
                    }}
                  >
                    <SelectTrigger className="bg-background border-border text-muted-foreground text-xs h-8 focus:ring-0">
                      <SelectValue
                        placeholder={t("admToolsPageDeptSelectPlaceholder")}
                      />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border">
                      {DEPARTMENTS.map((dept) => (
                        <SelectItem
                          key={dept}
                          value={dept}
                          className="text-foreground/80 text-xs focus:bg-muted focus:text-foreground"
                        >
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
                    <input
                      type="text"
                      value={revokeSearch}
                      onChange={(e) => setRevokeSearch(e.target.value)}
                      placeholder={t("admToolsPageSearchPlaceholder")}
                      className="w-full bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground/50 pl-8 pr-3 py-1.5 focus:outline-none focus:border-border"
                    />
                  </div>
                </div>

                {/* User list */}
                <ScrollArea className="flex-1">
                  {isLoadingUsers ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" />
                    </div>
                  ) : getUsersWithAccess(activeToolId).length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground/40">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">
                        {t("admToolsPageNoUsersWithAccess")}
                      </p>
                      <button
                        onClick={() => setActiveTab("grant")}
                        className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                      >
                        {t("admReportsGrantAccessTabLabel")}
                      </button>
                    </div>
                  ) : getFilteredUsersWithAccess().length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground/40">
                      <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">
                        {t("admToolsPageNoSearchResults")}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800/60">
                      {getFilteredUsersWithAccess().map((user) => (
                        <div
                          key={user.id}
                          className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors ${
                            revokeSelectedUsers.has(user.id)
                              ? "bg-muted"
                              : "hover:bg-background/60"
                          }`}
                          onClick={() => toggleRevokeSelection(user.id)}
                        >
                          <Checkbox
                            checked={revokeSelectedUsers.has(user.id)}
                            onCheckedChange={() =>
                              toggleRevokeSelection(user.id)
                            }
                            className="border-border data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500 data-[state=checked]:text-foreground shrink-0"
                          />
                          <div
                            className={`w-7 h-7 rounded-md bg-gradient-to-br ${selectedGroup.color} flex items-center justify-center text-foreground text-xs font-bold shrink-0`}
                          >
                            {user.name.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-foreground truncate">
                              {user.name}
                            </p>
                            <p className="text-xs text-muted-foreground/60 truncate">
                              {user.department}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                {/* Revoke button */}
                <AnimatePresence>
                  {revokeSelectedUsers.size > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="p-4 border-t border-border"
                    >
                      <button
                        onClick={bulkRevokeAccess}
                        disabled={isSaving}
                        className="w-full bg-gradient-to-r from-red-600 to-rose-600 text-white text-sm font-semibold py-2.5 rounded-xl shadow-premium hover:shadow-premium-lg transition-all duration-300 hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {t("admToolsPageRevokingText")}
                          </>
                        ) : (
                          <>
                            <UserMinus className="w-4 h-4" />
                            {revokeSelectedUsers.size}{" "}
                            {t("admToolsPageRevokeBtnSuffix")}
                          </>
                        )}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </TabsContent>

              {/* Grant access */}
              <TabsContent
                value="grant"
                className="flex-1 overflow-hidden mt-0 hidden data-[state=active]:flex flex-col"
              >
                {/* Quick actions */}
                <div className="px-5 py-3 border-b border-border space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={selectAllUsers}
                      disabled={
                        getUsersWithoutAccess(activeToolId).length === 0
                      }
                      className="flex-1 text-xs text-muted-foreground hover:text-foreground bg-background border border-border hover:border-border/80 rounded-lg py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {t("admReportsSelectAllBtn")}
                    </button>
                    <button
                      onClick={() => setSelectedUsers(new Set())}
                      disabled={selectedUsers.size === 0}
                      className="flex-1 text-xs text-muted-foreground hover:text-foreground bg-background border border-border hover:border-border/80 rounded-lg py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {t("admReportsClearBtn")}
                    </button>
                  </div>
                  <Select
                    value={selectedDepartment}
                    onValueChange={(value) => {
                      setSelectedDepartment(value);
                      selectDepartmentUsers(value);
                    }}
                  >
                    <SelectTrigger className="bg-background border-border text-muted-foreground text-xs h-8 focus:ring-0">
                      <SelectValue
                        placeholder={t("admToolsPageDeptSelectPlaceholder")}
                      />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border">
                      {DEPARTMENTS.map((dept) => (
                        <SelectItem
                          key={dept}
                          value={dept}
                          className="text-foreground/80 text-xs focus:bg-muted focus:text-foreground"
                        >
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
                    <input
                      type="text"
                      value={grantSearch}
                      onChange={(e) => setGrantSearch(e.target.value)}
                      placeholder={t("admToolsPageSearchPlaceholder")}
                      className="w-full bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground/50 pl-8 pr-3 py-1.5 focus:outline-none focus:border-border"
                    />
                  </div>
                </div>

                {/* User list */}
                <ScrollArea className="flex-1">
                  {isLoadingUsers ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" />
                    </div>
                  ) : getUsersWithoutAccess(activeToolId).length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground/40">
                      <Check className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">
                        {t("admToolsPageAllUsersHaveAccess")}
                      </p>
                    </div>
                  ) : getFilteredUsersWithoutAccess().length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground/40">
                      <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">
                        {t("admToolsPageNoSearchResults")}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800/60">
                      {getFilteredUsersWithoutAccess().map((user) => (
                        <div
                          key={user.id}
                          className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors ${
                            selectedUsers.has(user.id)
                              ? "bg-muted"
                              : "hover:bg-background/60"
                          }`}
                          onClick={() => toggleUserSelection(user.id)}
                        >
                          <Checkbox
                            checked={selectedUsers.has(user.id)}
                            onCheckedChange={() => toggleUserSelection(user.id)}
                            className="border-border data-[state=checked]:bg-foreground data-[state=checked]:border-foreground data-[state=checked]:text-background shrink-0"
                          />
                          <div className="w-7 h-7 rounded-md bg-muted border border-border flex items-center justify-center text-muted-foreground text-xs font-medium shrink-0">
                            {user.name.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-foreground truncate">
                              {user.name}
                            </p>
                            <p className="text-xs text-muted-foreground/60 truncate">
                              {user.department}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                {/* Grant button */}
                <AnimatePresence>
                  {selectedUsers.size > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="p-4 border-t border-border"
                    >
                      <button
                        onClick={grantAccess}
                        disabled={isSaving}
                        className={`w-full bg-gradient-to-r ${selectedGroup.color} text-white text-sm font-semibold py-2.5 rounded-xl shadow-premium hover:shadow-premium-lg transition-all duration-300 hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2`}
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {t("admToolsPageSavingText")}
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4" />
                            {selectedUsers.size}{" "}
                            {t("admToolsPageGrantBtnSuffix")}
                          </>
                        )}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
