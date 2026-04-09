import { Database, Bot, Ruler, Shield, Activity, LayoutGrid } from 'lucide-react';

export default function StatsOverview({ groups }: { groups: any[] }) {
  const activeGroups = groups.filter((g: any) => g.enabled !== false).length;

  const cards = [
    {
      label: 'Нийт Dashboard',
      value: 13,
      icon: LayoutGrid,
      color: 'text-golomt-400',
      bg: 'bg-golomt-500/8',
      sub: '6 ангилал',
    },
    {
      label: 'ML Загвар',
      value: 10,
      icon: Bot,
      color: 'text-violet-400',
      bg: 'bg-violet-500/8',
      sub: 'CatBoost',
    },
    {
      label: 'Дүрмэд суурилсан',
      value: 3,
      icon: Ruler,
      color: 'text-amber-400',
      bg: 'bg-amber-500/8',
      sub: 'Спорт бооцоо',
    },
    {
      label: 'Мэдээллийн сан',
      value: 5,
      icon: Database,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/8',
      sub: 'FINACLE, ERP, UFC...',
    },
    {
      label: 'Логик бүлэг',
      value: 6,
      icon: Shield,
      color: 'text-blue-400',
      bg: 'bg-blue-500/8',
      sub: 'Дашбоардын огтлолцол',
    },
    {
      label: 'Идэвхтэй бүлэг',
      value: activeGroups,
      icon: Activity,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/8',
      sub: `${groups.length} нийт`,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      {cards.map((c, i) => (
        <div key={c.label} className="bg-surface-card rounded-xl border border-surface-border p-3.5 animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-semibold text-txt-dim uppercase tracking-wider leading-tight">{c.label}</span>
            <div className={`w-7 h-7 ${c.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
              <c.icon size={13} className={c.color} strokeWidth={2} />
            </div>
          </div>
          <span className="text-xl font-bold text-txt block">{c.value}</span>
          {c.sub && <span className="text-[9px] text-txt-dim mt-0.5 block">{c.sub}</span>}
        </div>
      ))}
    </div>
  );
}
