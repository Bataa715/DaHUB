'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { searchByCif } from '@/lib/api';
import { Search, Loader2, Database, ChevronDown, ChevronUp, ArrowLeft, Calendar } from 'lucide-react';

interface DashboardResult {
  dashboardId: number;
  dashboardName: string;
  table: string;
  matchCount: number;
  totalAmount: number;
  rows: Record<string, any>[];
}

interface SearchResult {
  cif: string;
  dateFrom: string | null;
  dateTo: string | null;
  totalDashboards: number;
  totalMatches: number;
  results: DashboardResult[];
}

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [cif, setCif] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  // Auto-search if ?cif= query param is present
  useEffect(() => {
    const cifParam = searchParams.get('cif');
    if (cifParam) {
      setCif(cifParam);
      doSearch(cifParam);
    }
  }, [searchParams]);

  const doSearch = async (cifVal: string, from?: string, to?: string) => {
    if (!cifVal.trim()) { setError('CIF дугаар оруулна уу'); return; }
    setError('');
    setSearching(true);
    setResult(null);
    setExpanded({});
    try {
      const data = await searchByCif(cifVal.trim(), from || undefined, to || undefined);
      setResult(data);
    } catch (e: any) {
      setError(e?.message || 'Хайлт амжилтгүй');
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = () => doSearch(cif, dateFrom, dateTo);

  const toggleExpand = (id: number) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const formatAmount = (n: number) => {
    if (!n) return '0';
    return new Intl.NumberFormat('mn-MN').format(Math.round(n));
  };

  return (
    <div className="flex min-h-screen">
      <main className="flex-1 ml-[260px] min-w-0 overflow-hidden">
        <div className="p-6 space-y-5">

          {/* Header */}
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/')} className="p-2 rounded-lg bg-surface-card border border-surface-border hover:bg-surface-elevated transition-colors">
              <ArrowLeft size={16} className="text-txt-dim" />
            </button>
            <div>
              <h1 className="text-xl font-extrabold text-txt">Search Engine</h1>
              <p className="text-[11px] text-txt-dim">12 Dashboard дээр CIF хайлт</p>
            </div>
          </div>

          {/* Search Form */}
          <div className="bg-surface-card rounded-xl border border-surface-border p-5">
            <div className="flex flex-wrap items-end gap-3">
              {/* CIF input */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[10px] font-semibold text-txt-dim uppercase tracking-wider mb-1.5">CIF дугаар</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-dim" />
                  <input
                    type="text"
                    value={cif}
                    onChange={e => setCif(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="Ажилтны CIF ID оруулна уу..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-surface-bg border border-surface-border text-[12px] text-txt placeholder:text-txt-dim focus:outline-none focus:ring-2 focus:ring-golomt-500/30 focus:border-golomt-500/50"
                  />
                </div>
              </div>
              {/* Date from */}
              <div className="w-[170px]">
                <label className="block text-[10px] font-semibold text-txt-dim uppercase tracking-wider mb-1.5">Эхлэх огноо</label>
                <div className="relative">
                  <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-dim" />
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-surface-bg border border-surface-border text-[12px] text-txt focus:outline-none focus:ring-2 focus:ring-golomt-500/30 focus:border-golomt-500/50"
                  />
                </div>
              </div>
              {/* Date to */}
              <div className="w-[170px]">
                <label className="block text-[10px] font-semibold text-txt-dim uppercase tracking-wider mb-1.5">Дуусах огноо</label>
                <div className="relative">
                  <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-dim" />
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-surface-bg border border-surface-border text-[12px] text-txt focus:outline-none focus:ring-2 focus:ring-golomt-500/30 focus:border-golomt-500/50"
                  />
                </div>
              </div>
              {/* Search button */}
              <button
                onClick={handleSearch}
                disabled={searching}
                className="px-5 py-2.5 rounded-lg bg-golomt-600 hover:bg-golomt-700 text-white font-semibold text-[12px] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                Хайх
              </button>
            </div>
            {error && <p className="text-red-400 text-[11px] mt-2">{error}</p>}
          </div>

          {/* Results */}
          {searching && (
            <div className="flex items-center justify-center py-16">
              <div className="flex items-center gap-3">
                <Loader2 size={20} className="animate-spin text-golomt-400" />
                <span className="text-[12px] text-txt-dim">12 Dashboard хайж байна...</span>
              </div>
            </div>
          )}

          {result && !searching && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-surface-card rounded-xl border border-surface-border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-txt-dim">Хайлтын үр дүн: </span>
                    <span className="text-[13px] font-bold text-txt">{result.cif}</span>
                  </div>
                  <div className="flex gap-4">
                    <div className="text-center">
                      <p className="text-xl font-extrabold text-txt">{result.totalDashboards}</p>
                      <p className="text-[9px] text-txt-dim uppercase">Dashboard</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-extrabold text-txt">{result.totalMatches}</p>
                      <p className="text-[9px] text-txt-dim uppercase">Нийт мөр</p>
                    </div>
                  </div>
                </div>
                {result.dateFrom && (
                  <p className="text-[10px] text-txt-dim mt-1">Хугацаа: {result.dateFrom} — {result.dateTo || 'Одоо'}</p>
                )}
              </div>

              {result.totalDashboards === 0 && (
                <div className="text-center py-12">
                  <Database size={32} className="mx-auto text-txt-dim mb-2 opacity-50" />
                  <p className="text-[13px] text-txt-dim">Аль ч dashboard-ааc илэрцгүй</p>
                </div>
              )}

              {/* Dashboard cards */}
              {result.results.map((d) => (
                <div key={d.dashboardId} className="bg-surface-card rounded-xl border border-surface-border overflow-hidden">
                  <button
                    onClick={() => toggleExpand(d.dashboardId)}
                    className="w-full p-4 flex items-center justify-between hover:bg-surface-elevated/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-golomt-500/10 flex items-center justify-center">
                        <span className="text-[12px] font-bold text-golomt-400">DB{d.dashboardId}</span>
                      </div>
                      <div className="text-left">
                        <h3 className="text-[13px] font-bold text-txt">{d.dashboardName}</h3>
                        <p className="text-[10px] text-txt-dim">{d.table}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-[14px] font-bold text-txt">{d.matchCount}</p>
                        <p className="text-[9px] text-txt-dim">мөр</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[12px] font-bold text-amber-400">{formatAmount(d.totalAmount)}₮</p>
                        <p className="text-[9px] text-txt-dim">дүн</p>
                      </div>
                      {expanded[d.dashboardId] ? <ChevronUp size={16} className="text-txt-dim" /> : <ChevronDown size={16} className="text-txt-dim" />}
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {expanded[d.dashboardId] && d.rows.length > 0 && (
                    <div className="border-t border-surface-border overflow-auto max-h-[420px]">
                      <table className="text-[11px] border-collapse">
                        <thead className="sticky top-0 z-10">
                          <tr className="bg-surface-elevated">
                            <th className="px-3 py-2 text-left font-semibold text-txt-dim whitespace-nowrap bg-surface-elevated">#</th>
                            {Object.keys(d.rows[0]).map((col) => (
                              <th key={col} className="px-3 py-2 text-left font-semibold text-txt-dim whitespace-nowrap bg-surface-elevated">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {d.rows.map((row, idx) => (
                            <tr key={idx} className="border-t border-surface-border hover:bg-surface-elevated/30">
                              <td className="px-3 py-2 text-txt-dim text-[10px] whitespace-nowrap">{idx + 1}</td>
                              {Object.values(row).map((val, ci) => (
                                <td key={ci} className="px-3 py-2 text-txt whitespace-nowrap text-[11px]">
                                  {val == null ? '-' : String(val)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Sidebar />
    </div>
  );
}
