'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { abFetchRedFlags } from '../_lib/api';
import { Flag, Loader2, ChevronDown, ChevronUp, ArrowRight, RefreshCw, AlertTriangle } from 'lucide-react';
import ToolPageHeader from '@/components/shared/ToolPageHeader';

interface ChainResult {
  id: number;
  name: string;
  description: string;
  sourceLabel: string;
  targetLabel: string;
  sourceIds: number[];
  targetIds: number[];
  matchCount: number;
  matches: string[];
}

interface RedFlagData {
  totalChains: number;
  triggeredChains: number;
  totalMatches: number;
  chains: ChainResult[];
}

export default function RedFlagPage() {
  const router = useRouter();

  const [data, setData] = useState<RedFlagData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await abFetchRedFlags();
      setData(res);
    } catch (e: any) {
      setError(e?.message || 'Алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleExpand = (id: number) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const getSeverity = (count: number) => {
    if (count >= 20) return { bg: 'bg-red-500/10', border: 'border-red-500/25', text: 'text-red-400' };
    if (count >= 5) return { bg: 'bg-amber-500/10', border: 'border-amber-500/25', text: 'text-amber-400' };
    if (count > 0) return { bg: 'bg-blue-500/10', border: 'border-blue-500/25', text: 'text-blue-400' };
    return { bg: 'bg-surface-elevated', border: 'border-surface-border', text: 'text-txt-dim' };
  };

  const forwardChains = data?.chains.filter(c => c.id <= 10) || [];
  const reverseChains = data?.chains.filter(c => c.id > 10) || [];

  const renderChain = (chain: ChainResult) => {
    const s = getSeverity(chain.matchCount);
    const isOpen = expanded[chain.id];

    return (
      <div key={chain.id} className="bg-surface-card rounded-xl border border-surface-border overflow-hidden">
        <button
          onClick={() => toggleExpand(chain.id)}
          className="w-full p-4 flex items-center justify-between hover:bg-surface-elevated/50 transition-colors"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold ${s.bg} ${s.border} border ${s.text}`}>
              {chain.id}
            </span>
            <div className="flex-1 min-w-0 text-left">
              <h3 className="text-[13px] font-bold text-txt truncate">{chain.name}</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-elevated text-txt-dim font-mono">
                  DB{chain.sourceIds.join('+')}
                </span>
                <ArrowRight size={10} className="text-txt-dim" />
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-elevated text-txt-dim font-mono">
                  DB{chain.targetIds.join('+')}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`px-2.5 py-1 rounded-lg border text-[12px] font-bold ${s.bg} ${s.border} ${s.text}`}>
              {chain.matchCount}
            </div>
            {isOpen ? <ChevronUp size={16} className="text-txt-dim" /> : <ChevronDown size={16} className="text-txt-dim" />}
          </div>
        </button>

        {isOpen && (
          <div className="border-t border-surface-border p-4 bg-surface-elevated/30 space-y-3">
            <p className="text-[11px] text-txt-muted leading-relaxed">{chain.description}</p>

            <div className="flex items-center gap-3 p-3 bg-surface-card rounded-lg border border-surface-border">
              <div className="flex-1 text-center p-2 rounded-lg bg-blue-500/5 border border-blue-500/15">
                <p className="text-[10px] font-semibold text-blue-400">{chain.sourceLabel}</p>
              </div>
              <ArrowRight size={16} className="text-txt-dim shrink-0" />
              <div className="flex-1 text-center p-2 rounded-lg bg-red-500/5 border border-red-500/15">
                <p className="text-[10px] font-semibold text-red-400">{chain.targetLabel}</p>
              </div>
            </div>

            {chain.matchCount === 0 ? (
              <p className="text-[11px] text-txt-dim text-center py-3">Илэрц олдсонгүй</p>
            ) : (
              <div>
                <p className="text-[10px] font-semibold text-txt-dim uppercase tracking-wider mb-2">
                  Давхцсан CIF ({chain.matchCount})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {chain.matches.map(cif => (
                    <button
                      key={cif}
                      onClick={() => router.push(`/tools/alert-box/search?cif=${cif}`)}
                      className={`px-2 py-1 rounded-md text-[10px] font-mono font-medium transition-colors hover:opacity-80 ${s.bg} ${s.border} border ${s.text}`}
                    >
                      {cif}
                    </button>
                  ))}
                  {chain.matchCount > chain.matches.length && (
                    <span className="px-2 py-1 text-[10px] text-txt-dim">
                      +{chain.matchCount - chain.matches.length} бусад
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <ToolPageHeader
        href="/tools"
        icon={<Flag size={16} className="text-red-400" />}
        title="Red Flag"
        subtitle="Event Chain дүрмийн илэрцүүд"
        rightContent={
          <button onClick={load} disabled={loading}
            className="p-2 rounded-lg bg-surface-card border border-surface-border hover:bg-surface-elevated transition-colors disabled:opacity-50">
            <RefreshCw size={14} className={`text-txt-dim ${loading ? 'animate-spin' : ''}`} />
          </button>
        }
      />
      <div className="px-6 space-y-5">

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-red-400" />
          <span className="text-[12px] text-txt-dim ml-3">12 Dashboard-ийн Event Chain шалгаж байна...</span>
        </div>
      )}

      {error && <p className="text-red-400 text-[12px] text-center py-8">{error}</p>}

      {data && !loading && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface-card rounded-xl border border-surface-border p-4 text-center">
              <p className="text-2xl font-extrabold text-txt">{data.totalChains}</p>
              <p className="text-[10px] text-txt-dim uppercase">Нийт дүрэм</p>
            </div>
            <div className="bg-surface-card rounded-xl border border-surface-border p-4 text-center">
              <p className="text-2xl font-extrabold text-red-400">{data.triggeredChains}</p>
              <p className="text-[10px] text-txt-dim uppercase">Идэвхжсэн</p>
            </div>
            <div className="bg-surface-card rounded-xl border border-surface-border p-4 text-center">
              <p className="text-2xl font-extrabold text-amber-400">{data.totalMatches}</p>
              <p className="text-[10px] text-txt-dim uppercase">Нийт давхцал</p>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Flag size={14} className="text-red-400" />
              <h2 className="text-[13px] font-bold text-txt">Спортбет → Бусад Dashboard</h2>
              <span className="text-[10px] text-txt-dim">(Chain 1–10)</span>
            </div>
            <p className="text-[10px] text-txt-muted mb-3">Спортбет тавиад орлого олсон хүн мөнгө олох гэж хууль бус үйлдэл хийж эхэлсэн.</p>
            <div className="space-y-2">{forwardChains.map(renderChain)}</div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={14} className="text-amber-400" />
              <h2 className="text-[13px] font-bold text-txt">Бусад Dashboard → Спортбет</h2>
              <span className="text-[10px] text-txt-dim">(Chain 11–15)</span>
            </div>
            <p className="text-[10px] text-txt-muted mb-3">Хууль бусаар олсон мөнгөөрөө Спортбет тоглосон гэсэн үг.</p>
            <div className="space-y-2">{reverseChains.map(renderChain)}</div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
