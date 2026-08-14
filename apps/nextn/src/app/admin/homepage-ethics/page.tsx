"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  homepageEthicsApi,
  getApiErrorMessage,
  type EthicsSlide,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import AdminPageHeader from "@/components/shared/AdminPageHeader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Pencil, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { TeamGalleryAdmin } from "./_TeamGalleryAdmin";

export default function HomepageEthicsAdminPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [slides, setSlides] = useState<EthicsSlide[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EthicsSlide | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await homepageEthicsApi.list();
      setSlides(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      toast({
        title: t("error"),
        description: getApiErrorMessage(e),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setTitle("");
    setBody("");
    setDialogOpen(true);
  };

  const openEdit = (slide: EthicsSlide) => {
    setEditing(slide);
    setTitle(slide.title);
    setBody(slide.body);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    const b = body.trim();
    if (!trimmedTitle || !b) {
      toast({
        title: t("admEthicsWarnTitle"),
        description: t("admEthicsFillRequiredDesc"),
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await homepageEthicsApi.update(editing.id, {
          title: trimmedTitle,
          body: b,
        });
        toast({
          title: t("admEthicsSavedTitle"),
          description: t("admEthicsUpdatedDesc"),
        });
      } else {
        await homepageEthicsApi.create({ title: trimmedTitle, body: b });
        toast({
          title: t("admEthicsAddedTitle"),
          description: t("admEthicsAddedDesc"),
        });
      }
      setDialogOpen(false);
      await load();
    } catch (e: unknown) {
      toast({
        title: t("error"),
        description: getApiErrorMessage(e),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (slide: EthicsSlide) => {
    if (!confirm(`"${slide.title}" ${t("admEthicsDeleteConfirmSuffix")}`))
      return;
    setBusyId(slide.id);
    try {
      await homepageEthicsApi.delete(slide.id);
      toast({ title: t("admEthicsDeletedTitle") });
      await load();
    } catch (e: unknown) {
      toast({
        title: t("error"),
        description: getApiErrorMessage(e),
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const other = index + dir;
    if (other < 0 || other >= slides.length) return;
    const a = slides[index];
    const b = slides[other];
    setBusyId(a.id);
    try {
      await Promise.all([
        homepageEthicsApi.update(a.id, { sort_order: b.sort_order }),
        homepageEthicsApi.update(b.id, { sort_order: a.sort_order }),
      ]);
      await load();
    } catch (e: unknown) {
      toast({
        title: t("error"),
        description: getApiErrorMessage(e),
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user?.isAdmin && !user?.isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <AdminPageHeader
        title={t("admEthicsPageTitle")}
        rightContent={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            {t("admEthicsAddTextBtn")}
          </button>
        }
      />

      <div className="max-w-[900px] mx-auto px-4 py-6">
        <p className="text-sm text-muted-foreground mb-5">
          {t("admEthicsIntro")}
        </p>

        {slides.length === 0 ? (
          <p className="text-muted-foreground/50 text-sm text-center py-16">
            {t("admEthicsEmpty")}
          </p>
        ) : (
          <div className="grid gap-2">
            {slides.map((slide, index) => (
              <div
                key={slide.id}
                className="rounded-xl border border-border bg-card px-4 py-3 flex gap-3 items-start"
              >
                <div className="flex flex-col gap-0.5 pt-0.5">
                  <button
                    type="button"
                    title={t("admEthicsMoveUp")}
                    disabled={index === 0 || busyId === slide.id}
                    onClick={() => move(index, -1)}
                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    title={t("admEthicsMoveDown")}
                    disabled={
                      index === slides.length - 1 || busyId === slide.id
                    }
                    onClick={() => move(index, 1)}
                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground">
                    {slide.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {slide.body}
                  </p>
                </div>

                <div className="shrink-0 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(slide)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title={t("admCommonEditBtn")}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(slide)}
                    disabled={busyId === slide.id}
                    className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                    title={t("tailan_deleteAction")}
                  >
                    {busyId === slide.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <TeamGalleryAdmin />
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-background border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? t("admEthicsEditDialogTitle")
                : t("admEthicsCreateDialogTitle")}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t("admEthicsDialogDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                {t("admEthicsTitleLabel")}
              </Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("admEthicsTitlePlaceholder")}
                className="bg-muted border-border"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                {t("admEthicsBodyLabel")}
              </Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={t("admEthicsBodyPlaceholder")}
                rows={4}
                className="bg-muted border-border resize-y"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
              className="flex-1 py-2 text-sm text-muted-foreground border border-border rounded-xl hover:bg-muted transition-colors"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2 text-sm font-semibold bg-foreground text-background rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {t("save")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
