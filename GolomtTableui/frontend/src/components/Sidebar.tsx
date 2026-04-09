'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, Bell, Users,
  AlertTriangle, X, Settings,
  Search, Flag, Database, Link2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLang } from '@/context/LangContext';
import { fetchNotifications } from '@/lib/api';

export default function Sidebar() {
  const { isAdmin } = useAuth();
  const { t } = useLang();
  const pathname = usePathname();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any>(null);
  const notifBtnRef = useRef<HTMLDivElement>(null);
  const notifPopupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        notifBtnRef.current && !notifBtnRef.current.contains(target) &&
        notifPopupRef.current && !notifPopupRef.current.contains(target)
      ) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const load = () => { fetchNotifications(20).then(setNotifications).catch(() => {}); };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { href: '/', icon: Home, label: t('nav.home') },
    { href: '/search', icon: Search, label: t('nav.search') },
    { href: '/alerts', icon: AlertTriangle, label: t('nav.alerts') },
    { href: '/redflag', icon: Flag, label: t('nav.redflag') },
  ];

  const adminItems = [
    { href: '/admin/users', icon: Users, label: t('nav.users') },
    { href: '/admin/dashboards', icon: Database, label: t('nav.dashboards') },
    { href: '/admin/chains', icon: Link2, label: t('nav.chains') },
  ];

  const notifCount = notifications?.total || 0;

  const NavLink = ({ href, icon: Icon, label }: { href: string; icon: any; label: string }) => {
    const active = pathname === href;
    return (
      <Link href={href}
        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
          active ? 'bg-golomt-500/10 text-golomt-400' : 'text-txt-muted hover:text-txt hover:bg-surface-hover'
        }`}>
        <Icon size={16} />
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-[260px] bg-surface-card border-r border-surface-border flex flex-col z-40">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <img src="/Golomtlogo.jpg" alt="Голомт" className="w-9 h-9 rounded-lg object-cover" />
          <div>
            <p className="text-sm font-bold text-txt">Голомт Банк</p>
            <p className="text-[10px] text-txt-dim font-medium tracking-wide uppercase">Аудит</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-semibold text-txt-dim uppercase tracking-wider px-2 pt-2 pb-1.5">{t('nav.menu')}</p>
        {navItems.map(item => <NavLink key={item.href} {...item} />)}

        {isAdmin && (
          <>
            <p className="text-[10px] font-semibold text-txt-dim uppercase tracking-wider px-2 pt-4 pb-1.5">{t('nav.admin')}</p>
            {adminItems.map(item => <NavLink key={item.href} {...item} />)}
          </>
        )}

        <div className="pt-2" />

        {/* Notifications */}
        <div ref={notifBtnRef} className="relative">
          <button onClick={() => setNotifOpen(!notifOpen)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all w-full ${
              notifOpen ? 'bg-golomt-500/10 text-golomt-400' : 'text-txt-muted hover:text-txt hover:bg-surface-hover'
            }`}>
            <Bell size={16} />
            <span>{t('nav.notifications')}</span>
            {notifCount > 0 && (
              <span className="ml-auto bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {notifCount > 99 ? '99+' : notifCount}
              </span>
            )}
          </button>
        </div>

        {/* Settings */}
        <NavLink href="/settings" icon={Settings} label={t('nav.settings')} />
      </nav>

      {/* Notification popup */}
      {notifOpen && (
        <div ref={notifPopupRef} className="fixed left-[270px] bottom-16 w-[340px] max-h-[400px] bg-surface-card border border-surface-border rounded-xl shadow-2xl overflow-hidden animate-slide-right z-[60]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
            <span className="text-xs font-bold text-txt">{t('nav.notifications')}</span>
            <button onClick={() => setNotifOpen(false)} className="text-txt-dim hover:text-txt"><X size={14} /></button>
          </div>
          {notifications?.criticalCount > 0 && (
            <div className="mx-3 mt-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
              <AlertTriangle size={13} className="text-red-400" />
              <span className="text-[11px] text-red-300 font-medium">{notifications.criticalCount} {t('common.highRisk')}</span>
            </div>
          )}
          <div className="overflow-y-auto max-h-[300px] py-1">
            {!notifications || notifCount === 0 ? (
              <div className="text-center py-8">
                <Bell size={20} className="text-txt-dim mx-auto mb-2 opacity-40" />
                <p className="text-xs text-txt-dim">{t('common.noNotif')}</p>
              </div>
            ) : (
              notifications.items.map((n: any) => (
                <button key={n.id} onClick={() => { setNotifOpen(false); router.push(`/dashboard/${n.dashboardId}`); }}
                  className="flex items-start gap-3 px-4 py-2.5 hover:bg-surface-hover transition-colors border-b border-surface-border/50 last:border-0 w-full text-left">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${n.severity === 'critical' ? 'bg-red-500' : 'bg-orange-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-txt truncate">{n.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${n.severity === 'critical' ? 'bg-red-500/15 text-red-400' : 'bg-orange-500/15 text-orange-400'}`}>
                        {n.severity === 'critical' ? t('common.critical') : t('common.high')}
                      </span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
