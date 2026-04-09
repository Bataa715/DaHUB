import Link from 'next/link';
import { Activity, Moon, UserX, Banknote, Copy, ShieldAlert, Radar, Eye, AlertTriangle, ArrowRight, BarChart3 } from 'lucide-react';

const ICONS: Record<string, any> = { Activity, Moon, UserX, Banknote, Copy, ShieldAlert, Radar, Eye, BarChart3 };

function MiniBar({ critical, high, medium, low, total }: { critical: number; high: number; medium: number; low: number; total: number }) {
  if (!total) return null;
  const bars = [
    { count: critical, color: '#ef4444' },
    { count: high, color: '#f97316' },
    { count: medium, color: '#fbbf24' },
    { count: low, color: '#38bdf8' },
  ];
  return (
    <div className="flex h-1 rounded-full overflow-hidden bg-surface-elevated w-full">
      {bars.map((b, i) => b.count > 0 && (
        <div key={i} style={{ width: `${(b.count / total) * 100}%`, backgroundColor: b.color }} className="transition-all duration-500" />
      ))}
    </div>
  );
}

export default function DashboardCard({ dashboard, index }: { dashboard: any; index: number }) {
  const Icon = ICONS[dashboard.icon] || BarChart3;
  const hasCritical = dashboard.criticalCount > 0;

  return (
    <Link href={`/dashboard/${dashboard.id}`}
      className="group block bg-surface-card rounded-xl border border-surface-border hover:border-surface-hover overflow-hidden animate-fade-up transition-all hover:bg-surface-hover"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105"
              style={{ backgroundColor: `${dashboard.color}15` }}>
              <Icon size={20} style={{ color: dashboard.color }} strokeWidth={1.8} />
            </div>
            {hasCritical && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full ring-2 ring-surface-card" />
            )}
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-txt tabular-nums">{dashboard.totalFlags}</span>
            <p className="text-[9px] text-txt-dim font-medium uppercase">flags</p>
          </div>
        </div>

        <h3 className="text-sm font-semibold text-txt mb-1 group-hover:text-golomt-400 transition-colors">{dashboard.name}</h3>
        <p className="text-[11px] text-txt-dim mb-3 line-clamp-2">{dashboard.description}</p>

        <MiniBar critical={dashboard.criticalCount} high={dashboard.highCount} medium={dashboard.mediumCount} low={dashboard.lowCount} total={dashboard.totalFlags} />

        <div className="flex items-center justify-between pt-3 mt-3 border-t border-surface-border/50">
          <div className="flex items-center gap-2 text-[10px]">
            {dashboard.criticalCount > 0 && <span className="flex items-center gap-1 text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />{dashboard.criticalCount}</span>}
            {dashboard.highCount > 0 && <span className="flex items-center gap-1 text-orange-400"><span className="w-1.5 h-1.5 rounded-full bg-orange-500" />{dashboard.highCount}</span>}
            {dashboard.mediumCount > 0 && <span className="flex items-center gap-1 text-amber-400"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{dashboard.mediumCount}</span>}
          </div>
          <ArrowRight size={14} className="text-txt-dim group-hover:text-golomt-400 group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </Link>
  );
}
