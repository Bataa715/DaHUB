"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { adminKnowledgeApi } from "@/lib/api";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2,
  BookOpen,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AdminPageHeader from "@/components/shared/AdminPageHeader";
import { useLanguage } from "@/contexts/LanguageContext";
import { KnowledgeCoverImage } from "@/app/knowledge/_components/KnowledgeCoverImage";

const CATEGORY_OPTIONS = [
  "Аудит",
  "Технологи",
  "Сонин хачин",
  "Банк санхүү",
  "Risk",
];

interface MedlegItem {
  id: string;
  title: string;
  category: string;
  imageUrl?: string;
  authorId: string;
  authorName?: string;
  isPublished: boolean;
  views: number;
  createdAt: string;
  updatedAt: string;
}

interface MedlegDetail extends MedlegItem {
  content: string;
}

export default function AdminMedlegPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [items, setItems] = useState<MedlegDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    category: "",
    content: "",
    isPublished: true,
  });

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const data = await adminKnowledgeApi.listAll();
      setItems(data);
    } catch {
      toast({
        title: t("error"),
        description: t("admMedlegLoadError"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (item: MedlegDetail) => {
    setEditingId(item.id);
    setIsEditOpen(true);
    setEditForm({
      title: item.title,
      category: item.category,
      content: item.content ?? "",
      isPublished: item.isPublished,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setIsSaving(true);
    try {
      await adminKnowledgeApi.update(editingId, {
        title: editForm.title.trim(),
        category: editForm.category,
        content: editForm.content,
        isPublished: editForm.isPublished,
      });
      toast({ title: t("success"), description: t("admMedlegUpdatedDesc") });
      setIsEditOpen(false);
      loadItems();
    } catch (error) {
      let message = t("admMedlegSaveError");
      if (axios.isAxiosError(error))
        message = error.response?.data?.message ?? message;
      toast({
        title: t("error"),
        description: Array.isArray(message) ? message.join(", ") : message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item: MedlegItem) => {
    if (!confirm(`"${item.title}" ${t("admMedlegDeleteConfirmSuffix")}`))
      return;
    try {
      await adminKnowledgeApi.delete(item.id);
      toast({ title: t("success"), description: t("admMedlegDeletedDesc") });
      loadItems();
    } catch (error) {
      let message = t("admMedlegDeleteError");
      if (axios.isAxiosError(error))
        message = error.response?.data?.message ?? message;
      toast({
        title: t("error"),
        description: message,
        variant: "destructive",
      });
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user?.isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <AdminPageHeader
        title={t("admMedlegPageTitle")}
        rightContent={
          <span className="text-muted-foreground/60 text-xs">
            {items.length} {t("admMedlegUnit")}
          </span>
        }
      />

      <div className="max-w-[1400px] mx-auto px-4 py-6">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-20 text-center">
            <BookOpen className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground/50">
              {t("admMedlegEmpty")}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium w-14" />
                  <th className="px-4 py-2.5 text-left font-medium">
                    {t("admMedlegColTitle")}
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium">
                    {t("admMedlegColCategory")}
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium">
                    {t("admMedlegColAuthor")}
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium">
                    {t("admMedlegColStatus")}
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    {t("admMedlegColViews")}
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium w-24" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <div className="w-9 h-9 rounded-lg bg-muted overflow-hidden relative shrink-0">
                        {item.imageUrl && (
                          <KnowledgeCoverImage
                            path={item.imageUrl}
                            alt={item.title}
                            fill
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 max-w-[320px]">
                      <p className="font-medium text-foreground truncate">
                        {item.title}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {item.category}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground truncate max-w-[160px]">
                      {item.authorName || "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      {item.isPublished ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[11px] font-medium">
                          <Eye className="w-3 h-3" /> {t("admMedlegPublished")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-muted text-muted-foreground px-2 py-0.5 text-[11px] font-medium">
                          <EyeOff className="w-3 h-3" /> {t("admMedlegDraft")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                      {item.views}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          onClick={() => handleEdit(item)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-secondary transition-colors"
                          title={t("admCommonEditBtn")}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title={t("tailan_deleteAction")}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-background border-border text-foreground max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground text-base">
              {t("admMedlegEditDialogTitle")}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground/60 text-xs">
              {t("admMedlegEditDialogDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">
              {t("admMedlegTitleLabel")}
            </Label>
            <Input
              value={editForm.title}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, title: e.target.value }))
              }
              className="bg-muted border-border text-foreground focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">
              {t("admMedlegCategoryLabel")}
            </Label>
            <select
              value={editForm.category}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, category: e.target.value }))
              }
              className="w-full h-9 px-3 rounded-md bg-muted border border-border text-foreground text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">
              {t("admMedlegContentLabel")}
            </Label>
            <Textarea
              value={editForm.content}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, content: e.target.value }))
              }
              rows={8}
              className="bg-muted border-border text-foreground focus-visible:ring-ring text-xs font-mono"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={editForm.isPublished}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, isPublished: e.target.checked }))
              }
              className="w-4 h-4 rounded border-border accent-primary"
            />
            {t("admMedlegPublishedLabel")}
          </label>
          <DialogFooter className="gap-2 mt-2">
            <Button
              variant="ghost"
              onClick={() => setIsEditOpen(false)}
              className="border border-border text-foreground/80 hover:bg-muted"
            >
              {t("admDeptCancelBtn")}
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving && (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              )}
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
