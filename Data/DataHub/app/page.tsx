export const dynamic = 'force-dynamic';

import { parseSchema } from '@/lib/schema-parser';
import Link from 'next/link';
import {
  Database,
  Layers,
  Hash,
  CheckCircle2,
} from 'lucide-react';

export default function HomePage() {
  const schema = parseSchema();

  const coveragePct =
    schema.totalColumns > 0
      ? Math.round((schema.describedColumns / schema.totalColumns) * 100)
      : 0;

  const statCards = [
    {
      label: 'Мэдээллийн сан',
      value: schema.databases.length,
      icon: Database,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/20',
    },
    {
      label: 'Хүснэгт',
      value: schema.totalTables,
      icon: Layers,
      color: 'text-violet-400',
      bg: 'bg-violet-500/10',
      border: 'border-violet-500/20',
    },
    {
      label: 'Нийт багана',
      value: schema.totalColumns.toLocaleString(),
      icon: Hash,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    },
    {
      label: 'Хамрагдалт',
      value: `${coveragePct}%`,
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
  ];

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-3 font-mono uppercase tracking-widest">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
          Шууд · ClickHouse холбогдсон
        </div>
        <h1 className="text-4xl font-bold text-white tracking-tight mb-2">
          <span className="gradient-text">DataDoc</span>
        </h1>
        <p className="text-slate-400 text-lg">
          Голомт Банк · Дотоод Аудит · Өгөгдлийн Сангийн Баримт Бичгийн Төв
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4 mb-10">
        {statCards.map(stat => (
          <div
            key={stat.label}
            className={`bg-[#0d1526] border ${stat.border} rounded-2xl p-5 hover:border-opacity-60 transition-all`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-slate-400">{stat.label}</span>
              <div className={`w-8 h-8 rounded-xl ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </div>
            <div className={`text-3xl font-bold ${stat.color} tracking-tight`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Database Overview */}
      <div>
        <h2 className="text-base font-semibold text-slate-300 mb-4">Мэдээллийн сангууд</h2>
        <div className="grid grid-cols-2 gap-4">
          {schema.databases.map(db => {
            const totalCols = db.tables.reduce((s, t) => s + t.totalColumns, 0);
            const described = db.tables.reduce(
              (s, t) => s + t.columns.filter(c => c.description).length,
              0
            );
            const pct = totalCols > 0 ? Math.round((described / totalCols) * 100) : 0;

            return (
              <Link key={db.name} href={`/docs?db=${db.name}`}>
                <div className="group bg-[#0d1526] border border-slate-800/60 hover:border-slate-700 rounded-2xl p-5 cursor-pointer transition-all hover:bg-[#0f1a2e]">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-3 h-3 rounded-full shadow-sm"
                      style={{ backgroundColor: db.color, boxShadow: `0 0 8px ${db.color}50` }}
                    />
                    <span className="font-mono font-bold text-white text-base">{db.name}</span>
                    <span className="ml-auto text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-md">
                      {db.tables.length} хүснэгт
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm text-slate-500 mb-2.5">
                    <span>{totalCols.toLocaleString()} багана</span>
                    <span style={{ color: db.color }}>{pct}% баримтжуулсан</span>
                  </div>

                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: db.color }}
                    />
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {db.tables.slice(0, 5).map(t => (
                      <span
                        key={t.name}
                        className="text-[11px] font-mono px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded"
                      >
                        {t.name}
                      </span>
                    ))}
                    {db.tables.length > 5 && (
                      <span className="text-[11px] text-slate-600">
                        +{db.tables.length - 5} дахин
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
