"use client";

import { useState, useEffect, useRef } from "react";
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
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import AdminPageHeader from "@/components/shared/AdminPageHeader";
import { Loader2, ImagePlus, X } from "lucide-react";
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
  "Ерөнхий": "bg-slate-500/20 text-slate-300 border-slate-500/30",
  "Мэдэгдэл": "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "Үйл явдал": "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "Танилцуулга": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
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

  useEffect(() => { fetchNews(); }, []);

  useEffect(() => {
    let f = [...news];
    if (catFilter !== "all") f = f.filter((n) => n.category === catFilter);
    if (search) {
      const q = search.toLowerCase();
      f = f.filter((n) =>
        n.title.toLowerCase().includes(q) || n.category.toLowerCase().includes(q)
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
      toast({ title: "Алдаа", description: "Мэдээ татахад алдаа гарлаа", variant: "destructive" });
    } finally {
      setPageLoading(false);
    }
  };

  const openCreate = () => {
    setIsEditing(false); setCurrentId(null); setForm({ ...empty }); setSheetOpen(true);
  };

  const openEdit = (item: News) => {
    setIsEditing(true); setCurrentId(item.id);
    setForm({
      title: item.title, content: item.content, category: item.category,
      imageUrl: item.imageUrl ? `${process.env.NEXT_PUBLIC_API_URL}${item.imageUrl}` : "",
      isPublished: item.isPublished === 1,
    });
    setSheetOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      if (isEditing && currentId) {
        const payload: typeof form = { ...form };
        if (payload.imageUrl && !payload.imageUrl.startsWith("data:")) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { imageUrl: _drop, ...rest } = payload;
          await api.patch(`/news/${currentId}`, rest);
        } else {
          await api.patch(`/news/${currentId}`, payload);
        }
        toast({ title: "Амжилттай", description: "Мэдээг шинэчиллээ" });
      } else {
        await api.post("/news", form);
        toast({ title: "Амжилттай", description: "Шинэ мэдээ үүсгэлээ" });
      }
      setSheetOpen(false); fetchNews();
    } catch {
      toast({ title: "Алдаа", description: "Хадгалахад алдаа гарлаа", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Энэ мэдээг устгах уу?")) return;
    try {
      await api.delete(`/news/${id}`);
      toast({ title: "Амжилттай", description: "Мэдээг устгалаа" });
      fetchNews();
    } catch {
      toast({ title: "Алдаа", description: "Устгахад алдаа гарлаа", variant: "destructive" });
    }
  };

  const togglePublish = async (id: string) => {
    try {
      await api.patch(`/news/${id}/toggle-publish`);
      fetchNews();
    } catch {
      toast({ title: "Алдаа", description: "Статус өөрчлөхөд алдаа гарлаа", variant: "destructive" });
    }
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Алдаа", description: "Зургийн хэмжээ 2MB-аас бага байх шаардлагатай", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setForm((f) => ({ ...f, imageUrl: ev.target?.result as string }));
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("mn-MN", { year: "numeric", month: "short", day: "numeric" });

  const published = news.filter((n) => n.isPublished === 1).length;
  const totalViews = news.reduce((s, n) => s + (n.views || 0), 0);

  return (
    <div className="min-h-screen bg-slate-950">
      <AdminPageHeader
        title="Мэдээнүүд"
        rightContent={
          <button
            onClick={openCreate}
            className="px-3 py-1.5 rounded-lg bg-white text-slate-950 text-sm font-semibold hover:bg-slate-200 transition-colors"
          >
            Шинэ мэдээ
          </button>
        }
      />

      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-7">
          {[
            { label: "Нийт", value: news.length, color: "text-blue-400" },
            { label: "Нийтэлсэн", value: published, color: "text-emerald-400" },
            { label: "Нийт үзэлт", value: totalViews, color: "text-amber-400" },
          ].map((s) => (
            <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Мэдээ хайх..."
            className="flex-1 min-w-48 bg-slate-900 border-slate-800 text-white placeholder:text-slate-600 rounded-xl"
          />
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-44 bg-slate-900 border-slate-800 text-white rounded-xl">
              <SelectValue placeholder="Ангилал" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800">
              <SelectItem value="all" className="text-white">Бүх ангилал</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c} className="text-white">{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        {pageLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 py-16 text-center text-slate-600 text-sm">
            Мэдээ олдсонгүй
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {filtered.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="group bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl px-4 py-3 flex items-center gap-3 transition-colors"
                >
                  {/* Publish dot */}
                  <button
                    onClick={() => togglePublish(item.id)}
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-colors ${
                      item.isPublished === 1
                        ? "bg-emerald-400"
                        : "bg-slate-700 hover:bg-slate-500"
                    }`}
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                          CATEGORY_COLORS[item.category] || CATEGORY_COLORS["Ерөнхий"]
                        }`}
                      >
                        {item.category}
                      </span>
                      {item.isPublished !== 1 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-500">
                          Ноорог
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-white truncate">{item.title}</p>
                    <p className="text-xs text-slate-600">{fmt(item.createdAt)} · {item.views} үзэлт</p>
                  </div>

                  {/* Actions — visible on hover */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={() => togglePublish(item.id)}
                      className="text-xs text-slate-500 hover:text-amber-400 px-2 py-1 rounded-lg hover:bg-amber-500/10 transition-colors"
                    >
                      {item.isPublished === 1 ? "Нуух" : "Нийтлэх"}
                    </button>
                    <button
                      onClick={() => openEdit(item)}
                      className="text-xs text-slate-500 hover:text-blue-400 px-2 py-1 rounded-lg hover:bg-blue-500/10 transition-colors"
                    >
                      Засах
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-xs text-slate-500 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors"
                    >
                      Устгах
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
          className="w-full sm:max-w-xl bg-slate-950 border-slate-800 text-white overflow-y-auto"
        >
          <SheetTitle className="sr-only">
            {isEditing ? "Мэдээ засах" : "Шинэ мэдээ үүсгэх"}
          </SheetTitle>

          <div className="px-6 pt-6 pb-4 border-b border-slate-800">
            <h2 className="text-lg font-semibold text-white">
              {isEditing ? "Мэдээ засах" : "Шинэ мэдээ үүсгэх"}
            </h2>
          </div>

          <form onSubmit={handleSave} className="px-6 py-5 space-y-5">
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Гарчиг *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                placeholder="Мэдээний гарчиг..."
                className="bg-slate-900 border-slate-800 text-white placeholder:text-slate-600 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Ангилал</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="bg-slate-900 border-slate-800 text-white rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} className="text-white">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Зураг</Label>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
              {form.imageUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-800 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.imageUrl} alt="preview" className="w-full h-40 object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs flex items-center gap-1.5">
                      <ImagePlus className="w-3.5 h-3.5" /> Солих
                    </button>
                    <button type="button" onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))} className="px-3 py-1.5 rounded-lg bg-red-500/40 hover:bg-red-500/60 text-white text-xs flex items-center gap-1.5">
                      <X className="w-3.5 h-3.5" /> Устгах
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full h-28 rounded-xl border border-dashed border-slate-800 hover:border-slate-600 bg-slate-900/50 flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-slate-400 transition-all">
                  <ImagePlus className="w-6 h-6" />
                  <span className="text-xs">Зураг оруулах · дээд тал 2MB</span>
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Агуулга *</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                required rows={10}
                placeholder="Мэдээний агуулга..."
                className="bg-slate-900 border-slate-800 text-white placeholder:text-slate-600 rounded-xl font-mono text-sm resize-none"
              />
              <p className="text-xs text-slate-600">HTML форматаар бичиж болно</p>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div>
                <p className="text-sm font-medium text-white">Шууд нийтлэх</p>
                <p className="text-xs text-slate-500">Идэвхжүүлбэл хэрэглэгчид харагдана</p>
              </div>
              <Switch checked={form.isPublished} onCheckedChange={(v) => setForm({ ...form, isPublished: v })} />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="flex-1 py-2.5 text-sm text-slate-400 hover:text-white border border-slate-800 rounded-xl hover:bg-slate-900 transition-colors"
              >
                Болих
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 text-sm font-semibold bg-white text-slate-950 hover:bg-slate-200 disabled:bg-slate-800 disabled:text-slate-500 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? "Хадгалж байна..." : isEditing ? "Хадгалах" : "Үүсгэх"}
              </button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
