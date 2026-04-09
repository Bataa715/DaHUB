'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { createDashboard } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  ChevronLeft, Plus, Database, Code2, Sparkles, Check, AlertCircle,
  Loader2, Columns, ArrowRight, Wand2,
  Activity, Moon, UserX, Banknote, Copy, ShieldAlert, Radar, Eye,
  BarChart3, TrendingUp, AlertTriangle, Search, Zap, Shield,
  FileText, Bell, Lock, Unlock, Globe,
} from 'lucide-react';

const ICON_MAP: Record<string, any> = {
  Activity, Moon, UserX, Banknote, Copy, ShieldAlert, Radar, Eye,
  BarChart3, TrendingUp, AlertTriangle, Search, Zap, Shield, Database,
  FileText, Bell, Lock, Unlock, Globe,
};
const ICON_NAMES = Object.keys(ICON_MAP);

const PRESET_COLORS = [
  '#EF4444','#F59E0B','#DC2626','#059669','#7C3AED','#0EA5E9',
  '#E11D48','#D97706','#6366F1','#3B82F6','#10B981','#8B5CF6',
  '#EC4899','#14B8A6','#F97316',
];

const SQL_TEMPLATES = [
  { label: 'Гүйлгээний хяналт', sql: `SELECT id, severity, title, description,\n       customer_id, customer_name, account_number,\n       amount, detected_at, category, details\nFROM AUDIT_CUSTOM_TABLE\nORDER BY detected_at DESC` },
  { label: 'Харилцагчийн эрсдэл', sql: `SELECT c.customer_id, c.customer_name, c.risk_level AS severity,\n       c.risk_score, c.account_number, c.total_amount AS amount,\n       c.flag_date AS detected_at, c.flag_type AS category,\n       c.description, c.title\nFROM CUSTOMER_RISK_FLAGS c\nWHERE c.risk_score > 0.5\nORDER BY c.risk_score DESC` },
];

const CYRILLIC_MAP: Record<string, string> = {
  'а':'a','б':'b','в':'v','г':'g','д':'d','е':'ye','ё':'yo','ж':'j','з':'z','и':'i',
  'й':'i','к':'k','л':'l','м':'m','н':'n','о':'o','ө':'u','п':'p','р':'r','с':'s',
  'т':'t','у':'u','ү':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'sh',
  'ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',
};

function slugify(text: string) {
  let result = '';
  for (const ch of text.toLowerCase()) {
    if (CYRILLIC_MAP[ch] !== undefined) result += CYRILLIC_MAP[ch];
    else if (/[a-z0-9]/.test(ch)) result += ch;
    else if (/[\s_-]/.test(ch)) result += '_';
  }
  return result.replace(/_+/g, '_').replace(/^_|_$/g, '');
}

function parseSqlColumns(sql: string) {
  const cleaned = sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const match = cleaned.match(/SELECT\s+([\s\S]*?)\s+FROM/i);
  if (!match) return [];
  const selectClause = match[1];
  if (selectClause.trim() === '*') return ['*'];
  return selectClause.split(',').map(col => {
    const trimmed = col.trim();
    const aliasMatch = trimmed.match(/\s+(?:AS\s+)?["']?(\w+)["']?\s*$/i);
    if (aliasMatch) return aliasMatch[1].toLowerCase();
    const dotMatch = trimmed.match(/\.(\w+)$/);
    if (dotMatch) return dotMatch[1].toLowerCase();
    const simple = trimmed.match(/^["']?(\w+)["']?$/);
    if (simple) return simple[1].toLowerCase();
    return trimmed.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  }).filter(c => c.length > 0);
}

const KNOWN_COLUMNS = new Set([
  'id','severity','title','description','customer_id','customer_name',
  'account_number','amount','detected_at','category','details',
]);

export default function CreateDashboardPage() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [description, setDescription] = useState('');
  const [sqlQuery, setSqlQuery] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('BarChart3');
  const [selectedColor, setSelectedColor] = useState('#6366F1');
  const [sampleCount, setSampleCount] = useState(25);
  const [useOracle, setUseOracle] = useState(false);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) router.push('/');
  }, [authLoading, user, isAdmin]);

  const autoId = useMemo(() => slugify(name), [name]);
  const detectedColumns = useMemo(() => parseSqlColumns(sqlQuery), [sqlQuery]);
  const standardColumns = detectedColumns.filter(c => KNOWN_COLUMNS.has(c));
  const customColumns = detectedColumns.filter(c => !KNOWN_COLUMNS.has(c) && c !== '*');
  const canStep1 = name.trim().length > 0;
  const canStep2 = sqlQuery.trim().length > 0 && detectedColumns.length > 0;

  const handleCreate = async () => {
    setCreating(true); setError('');
    try {
      const res = await createDashboard({ name, nameEn: nameEn || name, description, sqlQuery, icon: selectedIcon, color: selectedColor, sampleCount, useOracle });
      if (res.error) setError(res.error); else { setResult(res); setStep(4); }
    } catch (err: any) { setError(err.message || 'Алдаа гарлаа'); }
    setCreating(false);
  };

  const SelectedIcon = ICON_MAP[selectedIcon] || BarChart3;

  return (
    <div className="flex min-h-screen">
      <main className="flex-1 ml-[260px] min-w-0 overflow-hidden p-6 max-w-[800px]">
        {/* Top */}
        <div className="flex items-center justify-between mb-5">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-txt-dim hover:text-golomt-400 transition-colors group">
            <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" /> Нүүр
          </Link>
          <div className="flex items-center gap-1.5">
            {[1,2,3,4].map(s => (
              <div key={s} className="flex items-center gap-1.5">
                <div className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center transition-all ${
                  step === s ? 'bg-golomt-500 text-white' : step > s ? 'bg-emerald-500 text-white' : 'bg-surface-elevated text-txt-dim'}`}>
                  {step > s ? <Check size={12} /> : s}
                </div>
                {s < 4 && <div className={`w-5 h-0.5 rounded-full ${step > s ? 'bg-emerald-500' : 'bg-surface-border'}`} />}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-up">
            <div className="text-center mb-4">
              <h1 className="text-lg font-bold text-txt">Шинэ Dashboard</h1>
              <p className="text-xs text-txt-dim mt-0.5">SQL query оруулж, автоматаар dashboard үүсгэнэ</p>
            </div>

            <div className="bg-surface-card rounded-xl border border-surface-border p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-txt-muted mb-1.5 block">Dashboard нэр *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Зээлийн эрсдэлийн хяналт"
                  className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-sm text-txt focus:outline-none focus:border-golomt-500/50 transition-colors placeholder:text-txt-dim" />
                {autoId && <p className="text-[10px] text-txt-dim mt-1.5">ID: <code className="text-golomt-400 font-mono">{autoId}</code></p>}
              </div>
              <div>
                <label className="text-xs font-medium text-txt-muted mb-1.5 block">Англи нэр</label>
                <input type="text" value={nameEn} onChange={e => setNameEn(e.target.value)} placeholder="Loan Risk Monitoring"
                  className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-sm text-txt focus:outline-none focus:border-golomt-500/50 transition-colors placeholder:text-txt-dim" />
              </div>
              <div>
                <label className="text-xs font-medium text-txt-muted mb-1.5 block">Тайлбар</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Товч тайлбар..." rows={2}
                  className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-sm text-txt focus:outline-none focus:border-golomt-500/50 transition-colors resize-none placeholder:text-txt-dim" />
              </div>
            </div>

            <div className="bg-surface-card rounded-xl border border-surface-border p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-txt-muted mb-2 block">Дүрс</label>
                <div className="flex flex-wrap gap-1.5">
                  {ICON_NAMES.map(iconName => {
                    const Ic = ICON_MAP[iconName];
                    return (
                      <button key={iconName} onClick={() => setSelectedIcon(iconName)}
                        className={`w-8 h-8 rounded-md flex items-center justify-center transition-all ${
                          selectedIcon === iconName ? 'bg-golomt-500 text-white' : 'bg-surface-elevated text-txt-dim hover:text-txt'}`}>
                        <Ic size={15} />
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-txt-muted mb-2 block">Өнгө</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map(color => (
                    <button key={color} onClick={() => setSelectedColor(color)}
                      className={`w-7 h-7 rounded-md transition-all ${selectedColor === color ? 'ring-2 ring-offset-2 ring-offset-surface-card ring-golomt-400 scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: color }} />
                  ))}
                </div>
              </div>
              <div className="pt-3 border-t border-surface-border">
                <p className="text-[10px] text-txt-dim uppercase mb-2">Урьдчилсан</p>
                <div className="inline-flex items-center gap-3 bg-surface-elevated rounded-lg p-3 border border-surface-border/50">
                  <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ backgroundColor: `${selectedColor}15` }}>
                    <SelectedIcon size={18} style={{ color: selectedColor }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-txt">{name || 'Нэр'}</p>
                    <p className="text-[10px] text-txt-dim">{description || 'Тайлбар...'}</p>
                  </div>
                </div>
              </div>
            </div>

            <button onClick={() => setStep(2)} disabled={!canStep1}
              className="w-full py-2.5 bg-golomt-500 text-white rounded-lg text-xs font-medium hover:bg-golomt-600 disabled:opacity-30 transition-all flex items-center justify-center gap-1.5">
              Дараах <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-4 animate-fade-up">
            <div className="text-center mb-4">
              <h1 className="text-lg font-bold text-txt">SQL Query</h1>
              <p className="text-xs text-txt-dim mt-0.5">ClickHouse дээр ажиллах SQL query оруулна уу</p>
            </div>

            <div className="bg-surface-card rounded-xl border border-surface-border p-4">
              <p className="text-[10px] font-semibold text-txt-dim mb-2">Бэлэн загвар:</p>
              <div className="flex gap-2">
                {SQL_TEMPLATES.map((t, i) => (
                  <button key={i} onClick={() => setSqlQuery(t.sql)}
                    className="px-3 py-1.5 bg-surface-elevated text-txt-muted text-[11px] font-medium rounded-md hover:text-golomt-400 hover:bg-golomt-500/10 transition-all border border-surface-border/50">
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-surface-card rounded-xl border border-surface-border overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-surface-elevated border-b border-surface-border">
                <Code2 size={12} className="text-golomt-400" />
                <span className="text-[10px] font-semibold text-txt-dim">SQL</span>
              </div>
              <textarea value={sqlQuery} onChange={e => setSqlQuery(e.target.value)}
                placeholder="SELECT ... FROM ..." rows={10}
                className="w-full px-4 py-3 bg-[#0d0d14] text-emerald-400 font-mono text-xs focus:outline-none resize-none placeholder:text-surface-border leading-relaxed"
                spellCheck={false} />
            </div>

            {detectedColumns.length > 0 && (
              <div className="bg-surface-card rounded-xl border border-surface-border p-4 animate-fade-up">
                <p className="text-xs font-medium text-txt mb-2 flex items-center gap-1.5">
                  <Columns size={13} className="text-golomt-400" /> Илэрсэн багана ({detectedColumns.length})
                </p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {detectedColumns.map(col => (
                    <span key={col} className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      KNOWN_COLUMNS.has(col) ? 'bg-emerald-500/10 text-emerald-400' : 'bg-violet-500/10 text-violet-400'}`}>
                      {col}
                    </span>
                  ))}
                </div>
                <div className="flex gap-3 text-[9px] text-txt-dim">
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded bg-emerald-400" /> Стандарт</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded bg-violet-400" /> Нэмэлт (details)</span>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="px-5 py-2.5 bg-surface-card border border-surface-border text-txt-muted text-xs font-medium rounded-lg hover:bg-surface-hover transition-all">Буцах</button>
              <button onClick={() => setStep(3)} disabled={!canStep2}
                className="flex-1 py-2.5 bg-golomt-500 text-white rounded-lg text-xs font-medium hover:bg-golomt-600 disabled:opacity-30 transition-all flex items-center justify-center gap-1.5">
                Дараах <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="space-y-4 animate-fade-up">
            <div className="text-center mb-4">
              <h1 className="text-lg font-bold text-txt">Баталгаажуулах</h1>
            </div>

            <div className="bg-surface-card rounded-xl border border-surface-border p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${selectedColor}15` }}>
                  <SelectedIcon size={22} style={{ color: selectedColor }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-txt">{name}</h3>
                  <p className="text-[10px] text-txt-dim font-mono">{autoId}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-surface-border text-xs">
                <div><span className="text-txt-dim block">Багана</span><b className="text-txt">{detectedColumns.length}</b></div>
                <div><span className="text-txt-dim block">Стандарт</span><b className="text-emerald-400">{standardColumns.length}</b></div>
                <div><span className="text-txt-dim block">Нэмэлт</span><b className="text-violet-400">{customColumns.length}</b></div>
                <div><span className="text-txt-dim block">Тайлбар</span><span className="text-txt">{description || '—'}</span></div>
              </div>
            </div>

            <div className="bg-surface-card rounded-xl border border-surface-border overflow-hidden">
              <div className="px-3 py-2 bg-surface-elevated border-b border-surface-border text-[10px] font-semibold text-txt-dim">SQL</div>
              <pre className="px-3 py-2.5 bg-[#0d0d14] text-emerald-400 font-mono text-[10px] overflow-x-auto max-h-32 leading-relaxed">{sqlQuery}</pre>
            </div>

            <div className="bg-surface-card rounded-xl border border-surface-border p-4 space-y-3">
              <p className="text-xs font-medium text-txt">Өгөгдлийн эх үүсвэр</p>
              <div className="flex gap-2">
                <button onClick={() => setUseOracle(false)}
                  className={`flex-1 p-3 rounded-lg border text-left transition-all ${!useOracle ? 'border-golomt-500/40 bg-golomt-500/5' : 'border-surface-border hover:bg-surface-hover'}`}>
                  <p className={`text-xs font-medium ${!useOracle ? 'text-golomt-400' : 'text-txt-muted'}`}>Жишээ дата</p>
                  <p className="text-[10px] text-txt-dim mt-0.5">Автомат жишээ үүсгэнэ</p>
                </button>
                <button onClick={() => setUseOracle(true)}
                  className={`flex-1 p-3 rounded-lg border text-left transition-all ${useOracle ? 'border-orange-500/40 bg-orange-500/5' : 'border-surface-border hover:bg-surface-hover'}`}>
                  <p className={`text-xs font-medium ${useOracle ? 'text-orange-400' : 'text-txt-muted'}`}>ClickHouse DB</p>
                  <p className="text-[10px] text-txt-dim mt-0.5">Бодит дата татна</p>
                </button>
              </div>
              {!useOracle && (
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-txt-dim">Мөрийн тоо:</label>
                  <input type="range" min={5} max={100} value={sampleCount} onChange={e => setSampleCount(+e.target.value)}
                    className="flex-1 h-1 bg-surface-elevated rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-golomt-500 [&::-webkit-slider-thumb]:cursor-pointer" />
                  <span className="text-xs font-medium text-golomt-400 w-8 text-right">{sampleCount}</span>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-2 text-red-400 text-xs">
                <AlertCircle size={14} /> {error}
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="px-5 py-2.5 bg-surface-card border border-surface-border text-txt-muted text-xs font-medium rounded-lg hover:bg-surface-hover transition-all">Буцах</button>
              <button onClick={handleCreate} disabled={creating}
                className="flex-1 py-2.5 bg-golomt-500 text-white rounded-lg text-xs font-medium hover:bg-golomt-600 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5">
                {creating ? <><Loader2 size={14} className="animate-spin" /> Үүсгэж байна...</> : <><Wand2 size={14} /> Dashboard үүсгэх</>}
              </button>
            </div>
          </div>
        )}

        {/* Step 4 */}
        {step === 4 && result && (
          <div className="space-y-4 text-center animate-fade-up">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto">
              <Check size={28} className="text-emerald-400" />
            </div>
            <h1 className="text-lg font-bold text-txt">Амжилттай!</h1>

            <div className="bg-surface-card rounded-xl border border-surface-border p-5 text-left">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${result.dashboard?.color}15` }}>
                  {(() => { const Ic = ICON_MAP[result.dashboard?.icon] || BarChart3; return <Ic size={20} style={{ color: result.dashboard?.color }} />; })()}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-txt">{result.dashboard?.name}</h3>
                  <p className="text-[10px] text-txt-dim font-mono">{result.dashboard?.id}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-surface-border text-center">
                <div><span className="text-lg font-bold text-golomt-400">{result.flagCount}</span><p className="text-[9px] text-txt-dim">Flags</p></div>
                <div><span className="text-lg font-bold text-txt">{result.dashboard?.totalFlags}</span><p className="text-[9px] text-txt-dim">Нийт</p></div>
                <div><span className="text-lg font-bold text-emerald-400">{detectedColumns.length}</span><p className="text-[9px] text-txt-dim">Багана</p></div>
              </div>
            </div>

            <div className="flex gap-2">
              <Link href="/" className="flex-1 py-2.5 bg-surface-card border border-surface-border text-txt-muted text-xs font-medium rounded-lg hover:bg-surface-hover transition-all text-center">Нүүр</Link>
              <Link href={`/dashboard/${result.dashboard?.id}`} className="flex-1 py-2.5 bg-golomt-500 text-white text-xs font-medium rounded-lg hover:bg-golomt-600 transition-all text-center">Нээх</Link>
            </div>
          </div>
        )}
      </main>
      <Sidebar />
    </div>
  );
}
