'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/context/AuthContext';
import { useLang } from '@/context/LangContext';
import { fetchOracleDashboards, addOracleDashboard, deleteOracleDashboard, updateOracleDashboard } from '@/lib/api';
import { ArrowLeft, Plus, Trash2, Loader2, ToggleLeft, ToggleRight, Database } from 'lucide-react';

interface Dashboard {
  id: number; name: string; tableName: string; cifColumn: string; dateColumn: string; amountColumn: string; enabled: boolean;
}

export default function AdminDashboardsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { t } = useLang();
  const router = useRouter();
  const [items, setItems] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', tableName: '', cifColumn: '', dateColumn: 'H_TRAN_DATE', amountColumn: 'H_TRAN_AMT_MNT' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) router.push('/');
  }, [authLoading, user, isAdmin]);

  const load = async () => {
    setLoading(true);
    try { setItems((await fetchOracleDashboards()).dashboards || []); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (!authLoading && user && isAdmin) load(); }, [authLoading, user]);

  const handleAdd = async () => {
    if (!form.name || !form.tableName || !form.cifColumn) { setError(t('dashConfig.fillAll')); return; }
    setSaving(true); setError('');
    try {
      await addOracleDashboard(form);
      setForm({ name: '', tableName: '', cifColumn: '', dateColumn: 'H_TRAN_DATE', amountColumn: 'H_TRAN_AMT_MNT' });
      setShowForm(false);
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('dashConfig.confirmDelete'))) return;
    try { await deleteOracleDashboard(id); await load(); }
    catch (e: any) { setError(e.message); }
  };

  const handleToggle = async (d: Dashboard) => {
    try { await updateOracleDashboard(d.id, { enabled: !d.enabled }); await load(); }
    catch (e: any) { setError(e.message); }
  };

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-[12px] text-txt focus:outline-none focus:ring-2 focus:ring-golomt-500/30';

  return (
    <div className="flex min-h-screen">
      <main className="flex-1 ml-[260px] min-w-0 overflow-hidden">
        <div className="max-w-4xl mx-auto p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/')} className="p-2 rounded-lg bg-surface-card border border-surface-border hover:bg-surface-elevated transition-colors">
                <ArrowLeft size={16} className="text-txt-dim" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-txt">{t('dashConfig.title')}</h1>
                <p className="text-[11px] text-txt-dim">{t('dashConfig.subtitle')}</p>
              </div>
            </div>
            <button onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-golomt-600 hover:bg-golomt-700 text-white text-[11px] font-semibold transition-colors">
              <Plus size={14} /> {t('dashConfig.new')}
            </button>
          </div>

          {error && <p className="text-red-400 text-[11px]">{error}</p>}

          {showForm && (
            <div className="bg-surface-card rounded-xl border border-surface-border p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-txt-dim mb-1">{t('dashConfig.name')}</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Dormant лог" className={inputClass} />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-txt-dim mb-1">{t('dashConfig.table')}</label>
                  <input value={form.tableName} onChange={e => setForm({ ...form, tableName: e.target.value })} placeholder="DATA_ANALYST.TABLE_NAME" className={inputClass + ' font-mono'} />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-txt-dim mb-1">{t('dashConfig.cifCol')}</label>
                  <input value={form.cifColumn} onChange={e => setForm({ ...form, cifColumn: e.target.value })} placeholder="EMP_CIF" className={inputClass + ' font-mono'} />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-txt-dim mb-1">{t('dashConfig.dateCol')}</label>
                  <input value={form.dateColumn} onChange={e => setForm({ ...form, dateColumn: e.target.value })} placeholder="H_TRAN_DATE" className={inputClass + ' font-mono'} />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-txt-dim mb-1">{t('dashConfig.amountCol')}</label>
                  <input value={form.amountColumn} onChange={e => setForm({ ...form, amountColumn: e.target.value })} placeholder="H_TRAN_AMT_MNT" className={inputClass + ' font-mono'} />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleAdd} disabled={saving}
                  className="px-4 py-2 rounded-lg bg-golomt-600 hover:bg-golomt-700 text-white text-[11px] font-semibold disabled:opacity-50 transition-colors">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : t('dashConfig.add')}
                </button>
                <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg bg-surface-elevated text-txt-dim text-[11px] hover:text-txt transition-colors">{t('dashConfig.cancel')}</button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 size={18} className="animate-spin text-golomt-400" /></div>
          ) : items.length === 0 ? (
            <div className="text-center py-16">
              <Database size={24} className="mx-auto text-txt-dim mb-2 opacity-40" />
              <p className="text-[12px] text-txt-dim">{t('dashConfig.empty')}</p>
            </div>
          ) : (
            <div className="bg-surface-card rounded-xl border border-surface-border overflow-hidden">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-surface-border bg-surface-elevated">
                    <th className="px-4 py-2.5 text-left font-medium text-txt-dim">ID</th>
                    <th className="px-4 py-2.5 text-left font-medium text-txt-dim">{t('dashConfig.name')}</th>
                    <th className="px-4 py-2.5 text-left font-medium text-txt-dim">{t('dashConfig.table')}</th>
                    <th className="px-4 py-2.5 text-left font-medium text-txt-dim">{t('dashConfig.cifCol')}</th>
                    <th className="px-4 py-2.5 text-right font-medium text-txt-dim"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(d => (
                    <tr key={d.id} className={`border-b border-surface-border/30 hover:bg-surface-hover transition-colors ${!d.enabled ? 'opacity-40' : ''}`}>
                      <td className="px-4 py-3 text-txt-dim font-mono">{d.id}</td>
                      <td className="px-4 py-3 font-medium text-txt">{d.name}</td>
                      <td className="px-4 py-3 text-txt-muted font-mono text-[10px]">{d.tableName}</td>
                      <td className="px-4 py-3 text-txt-muted font-mono text-[10px]">{d.cifColumn}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleToggle(d)} className="p-1.5 rounded-md hover:bg-surface-elevated transition-colors">
                            {d.enabled ? <ToggleRight size={18} className="text-emerald-400" /> : <ToggleLeft size={18} className="text-txt-dim" />}
                          </button>
                          <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded-md text-txt-dim hover:text-red-400 hover:bg-surface-elevated transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
      <Sidebar />
    </div>
  );
}
