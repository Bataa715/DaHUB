"use client";

import { useState, useEffect } from "react";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import {
  Code2,
  Plus,
  Search,
  Copy,
  Check,
  Trash2,
  Edit3,
  X,
  Save,
  Tag,
} from "lucide-react";
import type { CodeSnippet } from "@/lib/data-doc-types";

const LANG_META: Record<
  string,
  { label: string; color: string; bg: string; border: string; icon: string }
> = {
  python: { label: "Python", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", icon: "🐍" },
  sql: { label: "SQL", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", icon: "🗄️" },
  bash: { label: "Bash", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", icon: "⚡" },
  other: { label: "Other", color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/30", icon: "📝" },
};

const STORAGE_KEY = "golomt_datadoc_snippets";

const DEFAULT_SNIPPETS: CodeSnippet[] = [
  {
    id: "1",
    title: "ClickHouse холболт",
    description: "audit_app хэрэглэгчээр ClickHouse-д холбогдох",
    language: "python",
    code: `import clickhouse_connect\n\nclient = clickhouse_connect.get_client(\n    host='localhost', port=8123,\n    username='audit_app',\n    password='...',\n    database='FINACLE',\n)\nprint(f"✅ ClickHouse холбогдлоо: {client.server_version}")`,
    tags: ["clickhouse", "connection"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "2",
    title: "GAM_ACCOUNTS - Идэвхтэй данс",
    description: "Харилцах болон хадгаламжийн идэвхтэй дансуудыг лавлах",
    language: "sql",
    code: `SELECT G_SCHM_TYPE, G_CRNCY_CODE, count() AS account_count\nFROM FINACLE.GAM_ACCOUNTS\nWHERE G_ACCT_CLS_FLG = 'N'\n  AND B_TXNDATE = today() - 1\nGROUP BY G_SCHM_TYPE, G_CRNCY_CODE\nORDER BY account_count DESC`,
    tags: ["FINACLE", "GAM_ACCOUNTS"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export default function CodePage() {
  const [snippets, setSnippets] = useState<CodeSnippet[]>([]);
  const [search, setSearch] = useState("");
  const [langFilter, setLangFilter] = useState("all");
  const [selected, setSelected] = useState<CodeSnippet | null>(null);
  const [editing, setEditing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [form, setForm] = useState<Partial<CodeSnippet>>({
    title: "",
    description: "",
    language: "python",
    code: "",
    tags: [],
  });

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setSnippets(JSON.parse(stored));
    } else {
      setSnippets(DEFAULT_SNIPPETS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SNIPPETS));
    }
  }, []);

  function save(updated: CodeSnippet[]) {
    setSnippets(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  function createSnippet() {
    const now = new Date().toISOString();
    const newSnippet: CodeSnippet = {
      id: generateId(),
      title: form.title || "Гарчиггүй",
      description: form.description || "",
      language: (form.language as CodeSnippet["language"]) || "other",
      code: form.code || "",
      tags: form.tags || [],
      createdAt: now,
      updatedAt: now,
    };
    const updated = [newSnippet, ...snippets];
    save(updated);
    setSelected(newSnippet);
    setShowForm(false);
    resetForm();
  }

  function updateSnippet() {
    if (!selected) return;
    const updated = snippets.map((s) =>
      s.id === selected.id ? { ...s, ...form, updatedAt: new Date().toISOString() } : s,
    );
    const updatedSnippet = updated.find((s) => s.id === selected.id)!;
    save(updated);
    setSelected(updatedSnippet);
    setEditing(false);
  }

  function deleteSnippet(id: string) {
    const updated = snippets.filter((s) => s.id !== id);
    save(updated);
    if (selected?.id === id) setSelected(null);
  }

  function startEdit(snippet: CodeSnippet) {
    setForm({ ...snippet });
    setEditing(true);
  }

  function resetForm() {
    setForm({ title: "", description: "", language: "python", code: "", tags: [] });
    setTagInput("");
  }

  function addTag() {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !form.tags?.includes(tag)) {
      setForm((f) => ({ ...f, tags: [...(f.tags || []), tag] }));
    }
    setTagInput("");
  }

  function removeTag(tag: string) {
    setForm((f) => ({ ...f, tags: (f.tags || []).filter((t) => t !== tag) }));
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const filtered = snippets.filter((s) => {
    const matchSearch =
      !search ||
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase()) ||
      s.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchLang = langFilter === "all" || s.language === langFilter;
    return matchSearch && matchLang;
  });

  const FormPanel = ({ onSubmit, onCancel }: { onSubmit: () => void; onCancel: () => void }) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Гарчиг
          </label>
          <input
            value={form.title || ""}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Кодын нэр…"
            className="w-full px-3 py-2 text-sm bg-[#0d1526] border border-slate-700/50 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Хэл
          </label>
          <select
            value={form.language || "python"}
            onChange={(e) => setForm((f) => ({ ...f, language: e.target.value as any }))}
            className="w-full px-3 py-2 text-sm bg-[#0d1526] border border-slate-700/50 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500/50"
          >
            {Object.entries(LANG_META).map(([k, v]) => (
              <option key={k} value={k}>
                {v.icon} {v.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          Тайлбар
        </label>
        <input
          value={form.description || ""}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Богино тайлбар…"
          className="w-full px-3 py-2 text-sm bg-[#0d1526] border border-slate-700/50 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
        />
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          Код
        </label>
        <textarea
          value={form.code || ""}
          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
          placeholder="Кодоо энд оруулна уу…"
          rows={12}
          className="w-full px-3 py-2.5 text-xs font-mono bg-[#060d18] border border-slate-700/50 rounded-xl text-slate-200 placeholder-slate-700 focus:outline-none focus:border-cyan-500/50 resize-none leading-relaxed"
        />
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          Тэг
        </label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {(form.tags || []).map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 text-slate-300 text-xs rounded-md"
            >
              {tag}
              <button onClick={() => removeTag(tag)} className="text-slate-500 hover:text-red-400">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTag()}
            placeholder="Тэг нэмэх + Enter"
            className="flex-1 px-3 py-1.5 text-xs bg-[#0d1526] border border-slate-700/50 rounded-lg text-slate-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
          />
          <button
            onClick={addTag}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700 transition-colors"
          >
            Нэмэх
          </button>
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button
          onClick={onSubmit}
          className="flex items-center gap-2 px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-xl transition-all text-sm"
        >
          <Save className="w-4 h-4" />
          Хадгалах
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-all text-sm"
        >
          Цуцлах
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f1117] text-white flex flex-col">
      <ToolPageHeader
        href="/tools/data-doc"
        icon={
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-md">
            <Code2 className="w-3.5 h-3.5 text-white" />
          </div>
        }
        title="Код сан"
        subtitle={`${snippets.length} код хадгалагдсан`}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Snippet list */}
        <div className="w-80 shrink-0 border-r border-slate-800/60 flex flex-col bg-[#0a0f1e]">
          <div className="px-4 py-4 border-b border-slate-800/60 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Код сан</h2>
              <button
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                  setSelected(null);
                  setEditing(false);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-400 border border-cyan-500/20 rounded-lg text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Шинэ
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Код хайх…"
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-800/60 border border-slate-700/30 rounded-lg text-slate-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500/40"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {["all", "python", "sql", "bash", "other"].map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLangFilter(lang)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                    langFilter === lang
                      ? "bg-slate-700 text-white"
                      : "text-slate-600 hover:text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {lang === "all"
                    ? "Бүгд"
                    : LANG_META[lang]?.icon + " " + LANG_META[lang]?.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {filtered.length === 0 ? (
              <div className="px-4 py-10 text-center text-slate-600 text-sm">Код олдсонгүй</div>
            ) : (
              filtered.map((snippet) => {
                const meta = LANG_META[snippet.language];
                const isSelected = selected?.id === snippet.id;
                return (
                  <div
                    key={snippet.id}
                    onClick={() => {
                      setSelected(snippet);
                      setEditing(false);
                      setShowForm(false);
                    }}
                    className={`group mx-2 mb-1 px-3 py-3 rounded-xl cursor-pointer transition-all ${
                      isSelected
                        ? "bg-slate-800 border border-slate-700"
                        : "hover:bg-slate-800/50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span
                        className={`text-xs font-semibold ${
                          isSelected ? "text-white" : "text-slate-300"
                        } leading-snug`}
                      >
                        {snippet.title}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${meta.bg} ${meta.color} ${meta.border} border shrink-0`}
                      >
                        {meta.icon}
                      </span>
                    </div>
                    {snippet.description && (
                      <p className="text-[11px] text-slate-500 line-clamp-1 mb-1.5">
                        {snippet.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {snippet.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="px-4 py-3 border-t border-slate-800/60">
            <span className="text-[11px] text-slate-600">{filtered.length} код</span>
          </div>
        </div>

        {/* Right: Detail / Editor */}
        <div className="flex-1 overflow-hidden flex flex-col min-w-0">
          {showForm ? (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-2xl">
                <h2 className="text-base font-bold text-white mb-5">Шинэ код</h2>
                <FormPanel onSubmit={createSnippet} onCancel={() => setShowForm(false)} />
              </div>
            </div>
          ) : editing && selected ? (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-2xl">
                <h2 className="text-base font-bold text-white mb-5">Код засах</h2>
                <FormPanel
                  onSubmit={updateSnippet}
                  onCancel={() => {
                    setEditing(false);
                    setForm({ ...selected });
                  }}
                />
              </div>
            </div>
          ) : selected ? (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-800/60 shrink-0">
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-bold text-white truncate">{selected.title}</h2>
                  {selected.description && (
                    <p className="text-sm text-slate-400 truncate mt-0.5">
                      {selected.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${LANG_META[selected.language].color} ${LANG_META[selected.language].bg} ${LANG_META[selected.language].border}`}
                  >
                    {LANG_META[selected.language].icon} {LANG_META[selected.language].label}
                  </span>
                  <button
                    onClick={() => copyCode(selected.code)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs transition-colors"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {copied ? "Хуулагдлаа!" : "Хуулах"}
                  </button>
                  <button
                    onClick={() => startEdit(selected)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Засах
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Энэ кодыг устгах уу?")) deleteSnippet(selected.id);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Устгах
                  </button>
                </div>
              </div>

              {selected.tags.length > 0 && (
                <div className="flex items-center gap-1.5 px-6 py-2.5 border-b border-slate-800/40">
                  <Tag className="w-3.5 h-3.5 text-slate-600" />
                  {selected.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-slate-800 text-slate-400 text-xs rounded-md"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-6">
                <pre className="text-xs font-mono text-slate-300 bg-[#060d18] border border-slate-800/60 rounded-xl p-5 overflow-x-auto leading-relaxed whitespace-pre-wrap">
                  {selected.code}
                </pre>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-800/40 flex items-center justify-center mx-auto mb-4">
                  <Code2 className="w-8 h-8 text-slate-600" />
                </div>
                <h3 className="text-slate-400 font-medium mb-1">Код сонгоогүй байна</h3>
                <p className="text-slate-600 text-sm">
                  Зүүн талаас код сонгох эсвэл шинээр нэмнэ үү
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
