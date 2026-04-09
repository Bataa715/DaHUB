'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useTheme } from '@/context/ThemeContext';
import { useLang } from '@/context/LangContext';
import { Sun, Moon, Globe, ArrowLeft } from 'lucide-react';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { lang, setLang, t } = useLang();
  const router = useRouter();

  return (
    <div className="flex min-h-screen">
      <main className="flex-1 ml-[260px] min-w-0 overflow-hidden">
        <div className="max-w-2xl mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/')} className="p-2 rounded-lg bg-surface-card border border-surface-border hover:bg-surface-elevated transition-colors">
              <ArrowLeft size={16} className="text-txt-dim" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-txt">{t('settings.title')}</h1>
              <p className="text-[11px] text-txt-dim">{t('settings.subtitle')}</p>
            </div>
          </div>

          {/* Appearance */}
          <section className="bg-surface-card rounded-xl border border-surface-border">
            <div className="px-5 py-4 border-b border-surface-border">
              <h2 className="text-[13px] font-bold text-txt">{t('settings.appearance')}</h2>
            </div>
            <div className="p-5 space-y-5">
              {/* Theme */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-semibold text-txt">{t('settings.theme')}</p>
                  <p className="text-[10px] text-txt-dim">{theme === 'dark' ? t('settings.dark') : t('settings.light')}</p>
                </div>
                <div className="flex bg-surface-elevated rounded-lg p-0.5 border border-surface-border">
                  <button onClick={() => setTheme('dark')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${theme === 'dark' ? 'bg-golomt-600 text-white shadow-sm' : 'text-txt-muted hover:text-txt'}`}>
                    <Moon size={13} /> {t('settings.dark')}
                  </button>
                  <button onClick={() => setTheme('light')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${theme === 'light' ? 'bg-golomt-600 text-white shadow-sm' : 'text-txt-muted hover:text-txt'}`}>
                    <Sun size={13} /> {t('settings.light')}
                  </button>
                </div>
              </div>

              {/* Language */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-semibold text-txt">{t('settings.language')}</p>
                  <p className="text-[10px] text-txt-dim">{lang === 'mn' ? 'Монгол' : 'English'}</p>
                </div>
                <div className="flex bg-surface-elevated rounded-lg p-0.5 border border-surface-border">
                  <button onClick={() => setLang('mn')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${lang === 'mn' ? 'bg-golomt-600 text-white shadow-sm' : 'text-txt-muted hover:text-txt'}`}>
                    <Globe size={13} /> MN
                  </button>
                  <button onClick={() => setLang('en')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${lang === 'en' ? 'bg-golomt-600 text-white shadow-sm' : 'text-txt-muted hover:text-txt'}`}>
                    <Globe size={13} /> EN
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
      <Sidebar />
    </div>
  );
}
