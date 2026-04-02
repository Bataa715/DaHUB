'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  BookOpen,
  Code2,
  ChevronRight,
  Database,
} from 'lucide-react';

const navItems = [
  {
    href: '/',
    label: 'Хяналтын самбар',
    icon: LayoutDashboard,
    desc: 'Ерөнхий мэдээлэл',
  },
  {
    href: '/docs',
    label: 'Баримт бичиг',
    icon: BookOpen,
    desc: 'Схемийн хайлт',
  },
  {
    href: '/code',
    label: 'Код сан',
    icon: Code2,
    desc: 'Python & SQL жишээ',
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 flex flex-col bg-[#0a0f1e] border-r border-slate-800/60">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800/60">
        <div className="relative">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center shadow-lg">
            <Database className="w-5 h-5 text-white" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#0a0f1e]" />
        </div>
        <div>
          <div className="text-sm font-bold text-white tracking-wide">Golomt</div>
          <div className="text-[11px] text-slate-500 font-medium tracking-widest uppercase">DataDoc</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-1">
        <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-3 mb-3">
          ЦЭС
        </p>
        {navItems.map(({ href, label, icon: Icon, desc }) => {
          const isActive = href === '/' ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-500/15 to-violet-500/10 text-cyan-300 border border-cyan-500/20 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'bg-slate-800 text-slate-500 group-hover:text-slate-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`font-medium leading-none mb-0.5 ${isActive ? 'text-cyan-300' : ''}`}>
                  {label}
                </div>
                <div className="text-[11px] text-slate-600 truncate">{desc}</div>
              </div>
              {isActive && <ChevronRight className="w-3 h-3 text-cyan-500/60 shrink-0" />}
            </Link>
          );
        })}
      </nav>

      {/* Database badges */}
      <div className="px-5 py-4 border-t border-slate-800/60">
        <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-3">
          МЭДЭЭЛЛИЙН САН
        </p>
        <div className="flex flex-wrap gap-1.5">
          {[
            { name: 'FINACLE', color: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
            { name: 'ERP', color: 'bg-violet-500/15 text-violet-400 border-violet-500/20' },
            { name: 'EBANK', color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20' },
            { name: 'CARDZONE', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
          ].map(db => (
            <Link
              key={db.name}
              href={`/docs?db=${db.name}`}
              className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-medium border transition-opacity hover:opacity-80 ${db.color}`}
            >
              {db.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-slate-800/60">
        <div className="text-[11px] text-slate-600">Internal Audit · 2026</div>
      </div>
    </aside>
  );
}
