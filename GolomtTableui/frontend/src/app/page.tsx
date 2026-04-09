'use client';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { useLang } from '@/context/LangContext';
import { Search, AlertTriangle, Flag, ChevronRight } from 'lucide-react';

export default function Home() {
  const { t } = useLang();

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? t('home.greeting.morning') : hour < 17 ? t('home.greeting.afternoon') : t('home.greeting.evening');
  const dateStr = now.toLocaleDateString('mn-MN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

  const sections = [
    {
      href: '/search',
      icon: Search,
      title: t('home.search.title'),
      subtitle: t('home.search.subtitle'),
      description: t('home.search.desc'),
      color: '#3B82F6',
    },
    {
      href: '/alerts',
      icon: AlertTriangle,
      title: t('home.alerts.title'),
      subtitle: t('home.alerts.subtitle'),
      description: t('home.alerts.desc'),
      color: '#F59E0B',
    },
    {
      href: '/redflag',
      icon: Flag,
      title: t('home.redflag.title'),
      subtitle: t('home.redflag.subtitle'),
      description: t('home.redflag.desc'),
      color: '#EF4444',
    },
  ];

  return (
    <div className="flex min-h-screen">
      <main className="flex-1 ml-[260px] min-w-0 overflow-hidden">
        <div className="p-6 space-y-6">
            {/* Hero */}
            <div className="relative rounded-2xl overflow-hidden border border-surface-border">
              <div className="absolute inset-0 bg-gradient-to-br from-golomt-600/20 via-surface-card to-surface-card" />
              <div className="relative px-6 py-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] text-golomt-400 font-semibold">{greeting}</span>
                </div>
                <h1 className="text-2xl font-extrabold text-txt tracking-tight">{t('home.title')}</h1>
                <p className="text-[11px] text-txt-dim mt-1">{dateStr}</p>
              </div>
            </div>

            {/* 3 Navigation Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {sections.map((s) => (
                <Link key={s.href} href={s.href}
                  className="group relative bg-surface-card rounded-xl border border-surface-border hover:border-opacity-60 transition-all hover:shadow-lg hover:shadow-black/10 overflow-hidden">
                  <div className="h-1 w-full" style={{ background: s.color }} />
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.color + '15' }}>
                          <s.icon size={22} style={{ color: s.color }} />
                        </div>
                        <div>
                          <h3 className="text-[15px] font-bold text-txt">{s.title}</h3>
                          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: s.color }}>{s.subtitle}</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-txt-dim group-hover:translate-x-0.5 transition-transform mt-1" style={{ color: s.color }} />
                    </div>
                    <p className="text-[11px] text-txt-muted leading-relaxed mb-4">{s.description}</p>
                    <div className="pt-3 border-t border-surface-border">
                      <span className="text-[10px] text-txt-dim group-hover:text-txt transition-colors">{t('home.details')} →</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Sidebar />
    </div>
  );
}



