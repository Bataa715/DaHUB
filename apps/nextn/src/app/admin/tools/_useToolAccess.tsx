import { startAsync } from "@/lib/start-async";
import { useMounted } from "@/hooks/use-mounted";
import { useState, useEffect, useCallback } from "react";
import { usersApi } from "@/lib/api";
import { isWebVisibleUser } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { ToolGroup, TOOL_GROUPS, User } from "./_tool-groups";

/**
 * Хэрэгслийн эрх олгох/хасах хуудасны state ба үйлдлүүд. Хуудас болон
 * дэлгэрэнгүй Sheet хоёулаа НЭГ instance-ийг хуваалцана (props-оор дамжина).
 */
export function useToolAccess() {
  const { t } = useLanguage();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const mounted = useMounted();

  // Sub-admin: restrict visible tools/variants to their grantableTools list
  const isSuperAdmin = user?.isSuperAdmin;
  const subAdminTools: string[] | null =
    user?.isAdmin && !isSuperAdmin ? (user?.grantableTools ?? []) : null;
  const visibleGroups: ToolGroup[] =
    subAdminTools !== null
      ? TOOL_GROUPS.map((g) => ({
          ...g,
          variants: g.variants.filter((v) => subAdminTools.includes(v.id)),
        })).filter((g) => g.variants.length > 0)
      : TOOL_GROUPS;

  const [selectedGroup, setSelectedGroup] = useState<ToolGroup | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("current");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  // Revoke tab state
  const [revokeSelectedUsers, setRevokeSelectedUsers] = useState<Set<string>>(
    new Set(),
  );
  const [revokeSearch, setRevokeSearch] = useState("");
  const [revokeDepartment, setRevokeDepartment] = useState<string>("");
  // Grant tab search
  const [grantSearch, setGrantSearch] = useState("");

  // The variant currently active inside the open Sheet — falls back to the
  // group's first variant (covers both single- and multi-variant groups).
  const activeVariant =
    selectedGroup?.variants.find((v) => v.id === selectedVariantId) ??
    selectedGroup?.variants[0] ??
    null;
  const activeToolId = activeVariant?.id ?? "";

  const loadUsers = useCallback(async () => {
    try {
      const data = await usersApi.getAll({ excludeAdmins: true, limit: 1000 });
      setUsers(
        (data as User[]).filter(
          (u) => isWebVisibleUser(u) && u.isActive !== false,
        ),
      );
    } catch (error) {
      if (process.env.NODE_ENV !== "production")
        console.error("Error loading users:", error);
      toast({
        title: t("error"),
        description: t("admToolsPageLoadUsersError"),
        variant: "destructive",
      });
    } finally {
      setIsLoadingUsers(false);
    }
  }, [t, toast]);

  // Хэрэглэгчдийг татах
  useEffect(() => {
    startAsync(loadUsers);
  }, [loadUsers]);

  // Group сонгоход (нэг эсвэл олон variant-тай карт) — эхний variant-аар эхэлнэ
  const handleGroupSelect = (group: ToolGroup) => {
    setSelectedGroup(group);
    setSelectedVariantId(group.variants[0]?.id ?? "");
    setActiveTab("current");
    setSelectedUsers(new Set());
    setSelectedDepartment("");
    setRevokeSelectedUsers(new Set());
    setRevokeSearch("");
    setRevokeDepartment("");
    setGrantSearch("");
  };

  // Sheet дотор variant (тухайлбал "Эрх хүсэгч" ⇄ "Эрх олгогч") сэлгэхэд —
  // тухайн variant-ийн хэрэглэгчийн жагсаалт шинээр эхэлнэ.
  const handleVariantSwitch = (variantId: string) => {
    setSelectedVariantId(variantId);
    setActiveTab("current");
    setSelectedUsers(new Set());
    setSelectedDepartment("");
    setRevokeSelectedUsers(new Set());
    setRevokeSearch("");
    setRevokeDepartment("");
    setGrantSearch("");
  };

  // Тухайн tool-д эрхтэй хэрэглэгчид
  const getUsersWithAccess = (toolId: string) => {
    return users.filter((u) => u.allowedTools?.includes(toolId));
  };

  // Тухайн tool-д эрхгүй хэрэглэгчид
  const getUsersWithoutAccess = (toolId: string) => {
    return users.filter((u) => !u.allowedTools?.includes(toolId));
  };

  // Карт дээрх нийт тоо — group-ийн АЛЬ Ч НЭГ variant-д эрхтэй хэрэглэгчдийн
  // цуглуулга (давхардалгүй), олон карт биш нэг картаар харуулахын тулд.
  const getUsersWithAnyVariant = (group: ToolGroup) => {
    const ids = new Set(group.variants.map((v) => v.id));
    return users.filter((u) => u.allowedTools?.some((t) => ids.has(t)));
  };

  // Хэрэглэгч сонгох/болих
  const toggleUserSelection = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  // Бүх хэрэглэгчийг сонгох
  const selectAllUsers = () => {
    if (!activeToolId) return;
    const usersWithoutAccess = getUsersWithoutAccess(activeToolId);
    setSelectedUsers(new Set(usersWithoutAccess.map((u) => u.id)));
  };

  // Хэлтсийн хэрэглэгчдийг сонгох
  const selectDepartmentUsers = (dept: string) => {
    if (!activeToolId) return;
    const deptUsers = getUsersWithoutAccess(activeToolId).filter(
      (u) => u.department === dept,
    );
    setSelectedUsers(new Set(deptUsers.map((u) => u.id)));
  };

  // Эрх олгох
  const grantAccess = async () => {
    if (!activeToolId || selectedUsers.size === 0) return;

    setIsSaving(true);
    let successCount = 0;
    const errors: string[] = [];

    try {
      // Sequential execution — concurrent ClickHouse mutations cause race conditions
      for (const userId of Array.from(selectedUsers)) {
        const targetUser = users.find((u) => u.id === userId);
        if (!targetUser) continue;
        // Re-fetch latest tools for this user to avoid stale state overwrites
        try {
          const fresh = await usersApi.getOne(userId);
          const currentTools: string[] = fresh.allowedTools || [];
          if (!currentTools.includes(activeToolId)) {
            await usersApi.updateTools(userId, [...currentTools, activeToolId]);
          }
          successCount++;
        } catch (err) {
          if (process.env.NODE_ENV !== "production")
            console.error("Error granting access to user:", err);
          errors.push(targetUser.name);
        }
      }

      const variantLabel = activeVariant ? t(activeVariant.labelKey) : "";
      if (errors.length === 0) {
        toast({
          title: t("success"),
          description: `${successCount} ${t("admToolsPageGrantedPart1")} ${variantLabel} ${t("admToolsPageGrantedPart2")}`,
        });
      } else {
        toast({
          title: t("admToolsPagePartialSuccess"),
          description: `${successCount} ${t("admToolsPagePartialPart1")}, ${errors.length} ${t("admToolsPagePartialPart2")}: ${errors.join(", ")}`,
          variant: "destructive",
        });
      }

      await loadUsers();
      setSelectedUsers(new Set());
      setActiveTab("current");
    } catch (error) {
      if (process.env.NODE_ENV !== "production")
        console.error("Error granting access:", error);
      toast({
        title: t("error"),
        description: t("admToolsPageGrantError"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Bulk эрх хасах
  const bulkRevokeAccess = async () => {
    if (!activeToolId || revokeSelectedUsers.size === 0) return;

    setIsSaving(true);
    let successCount = 0;
    const errors: string[] = [];

    try {
      for (const userId of Array.from(revokeSelectedUsers)) {
        const targetUser = users.find((u) => u.id === userId);
        if (!targetUser) continue;
        try {
          const fresh = await usersApi.getOne(userId);
          const currentTools: string[] = fresh.allowedTools || [];
          const newTools = currentTools.filter(
            (toolId) => toolId !== activeToolId,
          );
          await usersApi.updateTools(userId, newTools);
          successCount++;
        } catch (err) {
          if (process.env.NODE_ENV !== "production")
            console.error("Error revoking access from user:", err);
          errors.push(targetUser.name);
        }
      }

      const variantLabel = activeVariant ? t(activeVariant.labelKey) : "";
      if (errors.length === 0) {
        toast({
          title: t("success"),
          description: `${successCount} ${t("admToolsPageRevokedPart1")} ${variantLabel} ${t("admToolsPageRevokedPart2")}`,
        });
      } else {
        toast({
          title: t("admToolsPagePartialSuccess"),
          description: `${successCount} ${t("admToolsPagePartialPart1")}, ${errors.length} ${t("admToolsPagePartialPart2")}: ${errors.join(", ")}`,
          variant: "destructive",
        });
      }

      await loadUsers();
      setRevokeSelectedUsers(new Set());
    } catch (error) {
      if (process.env.NODE_ENV !== "production")
        console.error("Error revoking access:", error);
      toast({
        title: t("error"),
        description: t("admToolsPageRevokeError"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Revoke tab: toggle selection
  const toggleRevokeSelection = (userId: string) => {
    const newSet = new Set(revokeSelectedUsers);
    if (newSet.has(userId)) newSet.delete(userId);
    else newSet.add(userId);
    setRevokeSelectedUsers(newSet);
  };

  // Revoke tab: select all visible
  const selectAllRevokeUsers = () => {
    if (!activeToolId) return;
    const filtered = getFilteredUsersWithAccess();
    setRevokeSelectedUsers(new Set(filtered.map((u) => u.id)));
  };

  // Revoke tab: select department
  const selectRevokeDepartmentUsers = (dept: string) => {
    if (!activeToolId) return;
    const deptUsers = getUsersWithAccess(activeToolId).filter(
      (u) => u.department === dept,
    );
    setRevokeSelectedUsers(new Set(deptUsers.map((u) => u.id)));
  };

  // Revoke tab: filtered list
  const getFilteredUsersWithAccess = () => {
    if (!activeToolId) return [];
    let list = getUsersWithAccess(activeToolId);
    if (revokeSearch.trim()) {
      const q = revokeSearch.toLowerCase();
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.department?.toLowerCase().includes(q),
      );
    }
    return list;
  };

  // Grant tab: filtered list
  const getFilteredUsersWithoutAccess = () => {
    if (!activeToolId) return [];
    let list = getUsersWithoutAccess(activeToolId);
    if (grantSearch.trim()) {
      const q = grantSearch.toLowerCase();
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.department?.toLowerCase().includes(q),
      );
    }
    return list;
  };

  // Нийт эрхийн статистик
  const totalUsersWithAnyTool = users.filter(
    (u) => u.allowedTools?.length > 0,
  ).length;
  const totalPermissions = users.reduce(
    (acc, u) => acc + (u.allowedTools?.length || 0),
    0,
  );

  return {
    t,
    user,
    loading,
    toast,
    mounted,
    isSuperAdmin,
    subAdminTools,
    visibleGroups,
    selectedGroup,
    setSelectedGroup,
    selectedVariantId,
    setSelectedVariantId,
    users,
    setUsers,
    isLoadingUsers,
    setIsLoadingUsers,
    isSaving,
    setIsSaving,
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
    loadUsers,
    handleGroupSelect,
    handleVariantSwitch,
    getUsersWithAccess,
    getUsersWithoutAccess,
    getUsersWithAnyVariant,
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
    totalUsersWithAnyTool,
    totalPermissions,
  };
}

export type ToolAccess = ReturnType<typeof useToolAccess>;
