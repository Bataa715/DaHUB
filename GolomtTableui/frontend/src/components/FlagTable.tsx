'use client';
import { useState } from 'react';
import SeverityBadge from './SeverityBadge';
import { ChevronDown } from 'lucide-react';

function fmtAmount(a: number | null | undefined) {
  if (!a) return '—';
  return `₮${a.toLocaleString('mn-MN', { maximumFractionDigits: 0 })}`;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('mn-MN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function FlagRow({ flag, idx }: { flag: any; idx: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`border-b border-surface-border/50 last:border-0 ${open ? 'bg-surface-hover/50' : ''}`}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-hover transition-colors"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={`${flag.title} - ${flag.severity}`}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open); } }}
      >
        <span className="text-[11px] text-txt-dim font-mono w-6 tabular-nums">{idx + 1}</span>
        <div className="w-[80px] shrink-0"><SeverityBadge severity={flag.severity} /></div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-txt truncate">{flag.title}</p>
          <p className="text-[11px] text-txt-muted truncate mt-0.5">{flag.description}</p>
        </div>
        <div className="hidden md:block w-32 text-right">
          <p className="text-[12px] font-medium text-txt">{flag.customerName || '—'}</p>
          <p className="text-[10px] text-txt-dim font-mono">{flag.customerId || ''}</p>
        </div>
        <div className="hidden lg:block w-28 text-right">
          <p className="text-[13px] font-semibold text-txt tabular-nums">{fmtAmount(flag.amount)}</p>
        </div>
        <div className="hidden sm:block w-32 text-right">
          <p className="text-[11px] text-txt-dim tabular-nums">{fmtDate(flag.detectedAt)}</p>
        </div>
        <ChevronDown size={14} className={`text-txt-dim shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && flag.details && (
        <div className="px-4 pb-3 ml-[86px] animate-fade-up" style={{ animationDuration: '150ms' }}>
          <div className="bg-surface-elevated rounded-lg p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 border border-surface-border">
            {flag.accountNumber && (
              <div>
                <span className="text-[9px] text-txt-dim uppercase tracking-wider font-semibold block mb-0.5">Дансны дугаар</span>
                <span className="text-xs font-medium text-txt font-mono">{flag.accountNumber}</span>
              </div>
            )}
            {Object.entries(flag.details).map(([k, v]: [string, any]) => (
              <div key={k}>
                <span className="text-[9px] text-txt-dim uppercase tracking-wider font-semibold block mb-0.5">{k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}</span>
                <span className="text-xs font-medium text-txt">
                  {typeof v === 'number' ? (v > 10000 ? fmtAmount(v) : v.toLocaleString()) : Array.isArray(v) ? v.join(', ') : String(v)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FlagTable({ flags, loading }: { flags: any[]; loading: boolean }) {
  if (loading) return (
    <div className="bg-surface-card rounded-xl border border-surface-border p-12 flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-golomt-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-xs text-txt-dim">Уншиж байна...</p>
    </div>
  );

  if (!flags?.length) return (
    <div className="bg-surface-card rounded-xl border border-surface-border p-12 text-center">
      <p className="text-sm text-txt-muted font-medium">Тэмдэглэгээ олдсонгүй</p>
      <p className="text-xs text-txt-dim mt-1">Хайлтын утгаа өөрчилж үзнэ үү</p>
    </div>
  );

  return (
    <div className="bg-surface-card rounded-xl border border-surface-border overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2.5 bg-surface-elevated border-b border-surface-border text-[10px] font-semibold text-txt-dim uppercase tracking-wider">
        <span className="w-6">#</span>
        <span className="w-[80px] shrink-0">Түвшин</span>
        <span className="flex-1">Тодорхойлолт</span>
        <span className="hidden md:block w-32 text-right">Харилцагч</span>
        <span className="hidden lg:block w-28 text-right">Дүн</span>
        <span className="hidden sm:block w-32 text-right">Огноо</span>
        <span className="w-4 shrink-0" />
      </div>
      {flags.map((f, i) => <FlagRow key={f.id} flag={f} idx={i} />)}
    </div>
  );
}
