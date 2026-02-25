"use client";

import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Calendar,
  Newspaper,
  Star,
  Loader2,
  Search,
  Globe,
  FileText,
  TrendingUp,
  Filter,
  ImagePlus,
  X,
} from "lucide-react";
import api from "@/lib/api";

interface News {
  id: string;
  title: string;
  content: string;
  category: string;
  imageUrl?: string;
  authorId: string;
  isPublished: number;
  views: number;
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = ["Ерөнхий", "Мэдэгдэл", "Үйл явдал", "Танилцуулга"];

const CATEGORY_COLORS: Record<string, string> = {
  Ерөнхий: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  Мэдэгдэл: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "Үйл явдал": "bg-blue-500/20 text-blue-300 border-blue-500/30",
  Танилцуулга: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

const empty = {
  title: "",
  content: "",
  category: "Ерөнхий",
  imageUrl: "",
  isPublished: true,
};

export default function AdminNewsPage() {
  const [news, setNews] = useState<News[]>([]);
  const [filtered, setFiltered] = useState<News[]>([]);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchNews();
  }, []);

  useEffect(() => {
    let f = [...news];
    if (catFilter !== "all") f = f.filter((n) => n.category === catFilter);
    if (search) {
      const q = search.toLowerCase();
      f = f.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.category.toLowerCase().includes(q),
      );
    }
    setFiltered(f);
  }, [news, search, catFilter]);

  const fetchNews = async () => {
    setPageLoading(true);
    try {
      const r = await api.get("/news");
      setNews(r.data);
    } catch {
      toast({
        title: "Алдаа",
        description: "Мэдээ татахад алдаа гарлаа",
        variant: "destructive",
      });
    } finally {
      setPageLoading(false);
    }
  };

  const openCreate = () => {
    setIsEditing(false);
    setCurrentId(null);
    setForm({ ...empty });
    setSheetOpen(true);
  };

  const openEdit = (item: News) => {
    setIsEditing(true);
    setCurrentId(item.id);
    setForm({
      title: item.title,
      content: item.content,
      category: item.category,
      imageUrl: item.imageUrl || "",
      isPublished: item.isPublished === 1,
    });
    setSheetOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEditing && currentId) {
        await api.patch(`/news/${currentId}`, form);
        toast({ title: "Амжилттай", description: "Мэдээг шинэчиллээ" });
      } else {
        await api.post("/news", form);
        toast({ title: "Амжилттай", description: "Шинэ мэдээ үүсгэлээ" });
      }
      setSheetOpen(false);
      fetchNews();
    } catch {
      toast({
        title: "Алдаа",
        description: "Хадгалахад алдаа гарлаа",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Энэ мэдээг устгах уу?")) return;
    try {
      await api.delete(`/news/${id}`);
      toast({ title: "Амжилттай", description: "Мэдээг устгалаа" });
      fetchNews();
    } catch {
      toast({
        title: "Алдаа",
        description: "Устгахад алдаа гарлаа",
        variant: "destructive",
      });
    }
  };

  const togglePublish = async (id: string) => {
    try {
      await api.patch(`/news/${id}/toggle-publish`);
      fetchNews();
    } catch {
      toast({
        title: "Алдаа",
        description: "Статус өөрчлөхөд алдаа гарлаа",
        variant: "destructive",
      });
    }
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Алдаа",
        description: "Зургийн хэмжээ 2MB-аас бага байх шаардлагатай",
        variant: "destructive",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm((f) => ({ ...f, imageUrl: ev.target?.result as string }));
    };
    reader.readAsDataURL(file);
    // reset input so the same file can be re-selected
    e.target.value = "";
  };

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("mn-MN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const published = news.filter((n) => n.isPublished === 1).length;

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950">
      {/* BG */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 left-1/4 w-96 h-96 bg-blue-600/8 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 right-1/4 w-96 h-96 bg-purple-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-5 sm:px-8 py-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-xl shadow-blue-500/30">
                <Newspaper className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-xs text-blue-400/80 flex items-center gap-1 mb-0.5">
                  <Star className="w-3 h-3" /> Мэдээ удридлага
                </p>
                <h1 className="text-2xl font-extrabold text-white">
                  Мэдээнүүд
                </h1>
              </div>
            </div>
            <Button
              onClick={openCreate}
              className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white border-0 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all"
            >
              <Plus className="w-4 h-4 mr-2" /> Шинэ мэдээ
            </Button>
          </div>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-4 mb-7"
        >
          {[
            {
              icon: <FileText className="w-4 h-4 text-blue-400" />,
              label: "Нийт",
              value: news.length,
              color: "text-blue-400",
            },
            {
              icon: <Globe className="w-4 h-4 text-emerald-400" />,
              label: "Нийтэлсэн",
              value: published,
              color: "text-emerald-400",
            },
            {
              icon: <TrendingUp className="w-4 h-4 text-amber-400" />,
              label: "Нийт үзэлт",
              value: news.reduce((s, n) => s + (n.views || 0), 0),
              color: "text-amber-400",
            },
          ].map((s, i) => (
            <div
              key={i}
              className="rounded-2xl bg-slate-800/50 border border-slate-700/50 px-5 py-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-2 text-xs text-slate-400">
                {s.icon} {s.label}
              </div>
              <span className={`text-2xl font-bold ${s.color}`}>{s.value}</span>
            </div>
          ))}
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex flex-wrap gap-3 mb-6"
        >
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Мэдээ хайх..."
              className="pl-9 bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500 rounded-xl"
            />
          </div>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-44 bg-slate-800/60 border-slate-700 text-white rounded-xl">
              <Filter className="w-3.5 h-3.5 mr-2 text-slate-500" />
              <SelectValue placeholder="Ангилал" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="all" className="text-white">
                Бүх ангилал
              </SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c} className="text-white">
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>

        {/* News list */}
        {pageLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-dashed border-slate-700 bg-slate-800/30 py-20 flex flex-col items-center gap-3 text-slate-500"
          >
            <Newspaper className="w-12 h-12 text-slate-600" />
            <p className="text-sm">Мэдээ олдсонгүй</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={openCreate}
              className="text-blue-400 hover:text-blue-300"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Шинэ мэдээ нэмэх
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {filtered.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ delay: i * 0.04 }}
                  className="group rounded-2xl bg-slate-800/50 border border-slate-700/50 hover:border-slate-600/70 p-5 flex items-start gap-4 transition-colors"
                >
                  {/* Publish indicator */}
                  <div className="mt-1 shrink-0">
                    <button
                      onClick={() => togglePublish(item.id)}
                      title={
                        item.isPublished === 1
                          ? "Нийтэлсэн  дарж нуух"
                          : "Нуусан  дарж нийтлэх"
                      }
                      className={`w-3 h-3 rounded-full transition-all ${
                        item.isPublished === 1
                          ? "bg-emerald-400 shadow-lg shadow-emerald-400/40"
                          : "bg-slate-600 hover:bg-slate-500"
                      }`}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap mb-1.5">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[item.category] || CATEGORY_COLORS["Ерөнхий"]}`}
                      >
                        {item.category}
                      </span>
                      {item.isPublished !== 1 && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-400 border border-slate-700">
                          Ноорог
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-white text-sm leading-snug mb-1 truncate">
                      {item.title}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {fmt(item.createdAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" /> {item.views}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => togglePublish(item.id)}
                      className={`p-2 rounded-xl transition-all ${
                        item.isPublished === 1
                          ? "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                          : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                      }`}
                    >
                      {item.isPublished === 1 ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => openEdit(item)}
                      className="p-2 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Create / Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl bg-slate-900 border-slate-700 text-white overflow-y-auto"
        >
          <SheetHeader className="mb-6">
            <SheetTitle className="text-white text-xl flex items-center gap-2">
              {isEditing ? (
                <Edit className="w-5 h-5 text-blue-400" />
              ) : (
                <Plus className="w-5 h-5 text-emerald-400" />
              )}
              {isEditing ? "Мэдээ засах" : "Шинэ мэдээ үүсгэх"}
            </SheetTitle>
            <SheetDescription className="text-slate-400">
              Мэдээний мэдээллийг бөглөнэ үү
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSave} className="space-y-5">
            {/* Title */}
            <div className="space-y-2">
              <Label className="text-slate-300 text-sm">Гарчиг *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                placeholder="Мэдээний гарчиг..."
                className="bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500 rounded-xl focus:border-blue-500"
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label className="text-slate-300 text-sm">Ангилал</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v })}
              >
                <SelectTrigger className="bg-slate-800/60 border-slate-700 text-white rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} className="text-white">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Image upload */}
            <div className="space-y-2">
              <Label className="text-slate-300 text-sm">Зураг</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageFile}
              />
              {form.imageUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-800/50 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.imageUrl}
                    alt="preview"
                    className="w-full h-44 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-medium flex items-center gap-1.5 transition-all"
                    >
                      <ImagePlus className="w-3.5 h-3.5" /> Солих
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                      className="px-3 py-1.5 rounded-lg bg-red-500/40 hover:bg-red-500/60 text-white text-xs font-medium flex items-center gap-1.5 transition-all"
                    >
                      <X className="w-3.5 h-3.5" /> Устгах
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-32 rounded-xl border-2 border-dashed border-slate-700 hover:border-blue-500/60 bg-slate-800/40 hover:bg-slate-800/70 flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-blue-400 transition-all"
                >
                  <ImagePlus className="w-7 h-7" />
                  <span className="text-xs font-medium">Зураг оруулах</span>
                  <span className="text-[10px] text-slate-600">
                    PNG, JPG, WEBP · дээд тал 2MB
                  </span>
                </button>
              )}
            </div>

            {/* Content */}
            <div className="space-y-2">
              <Label className="text-slate-300 text-sm">Агуулга *</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                required
                rows={10}
                placeholder="Мэдээний агуулга..."
                className="bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500 rounded-xl font-mono text-sm resize-none focus:border-blue-500"
              />
              <p className="text-xs text-slate-500">
                HTML форматаар бичиж болно
              </p>
            </div>

            {/* Publish toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <div>
                <p className="text-sm font-medium text-white">Шууд нийтлэх</p>
                <p className="text-xs text-slate-400">
                  Идэвхжүүлбэл хэрэглэгчид харагдана
                </p>
              </div>
              <Switch
                checked={form.isPublished}
                onCheckedChange={(v) => setForm({ ...form, isPublished: v })}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSheetOpen(false)}
                className="flex-1 border border-slate-700 text-slate-300 hover:bg-slate-800 rounded-xl"
              >
                Болих
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white border-0 rounded-xl shadow-lg shadow-blue-500/20"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Хадгалж
                    байна...
                  </>
                ) : isEditing ? (
                  "Засах"
                ) : (
                  "Үүсгэх"
                )}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
