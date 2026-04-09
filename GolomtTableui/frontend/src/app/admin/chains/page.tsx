'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/context/AuthContext';
import { useLang } from '@/context/LangContext';
import { fetchEventChains, addEventChain, deleteEventChain, updateEventChain, fetchOracleDashboards } from '@/lib/api';
import { ArrowLeft, Plus, Trash2, Loader2, ToggleLeft, ToggleRight, ArrowRight, Link2 } from 'lucide-react';

interface Chain {
  id: number; name: string; description: string; sourceLabel: string; targetLabel: string;
  sourceIds: number[]; targetIds: number[]; enabled: boolean;
}
interface Dash { id: number; name: string; }

export default function AdminChainsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { t } = useLang();
  const router = useRouter();
  const [items, setItems] = useState<Chain[]>([]);
  const [dashboards, setDashboards] = useState<Dash[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', sourceLabel: '', targetLabel: '', sourceIds: '', targetIds: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) router.push('/');
  }, [authLoading, user, isAdmin]);

  const load = async () => {
    setLoading(true);
    try {
      const [chainsRes, dashRes] = await Promise.all([fetchEventChains(), fetchOracleDashboards()]);
      setItems(chainsRes.chains || []);
      setDashboards((dashRes.dashboards || []).map((d: any) => ({ id: d.id, name: d.name })));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (!authLoading && user && isAdmin) load(); }, [authLoading, user]);

  const parseIds = (s: string): number[] => s.split(',').map(x => parseInt(x.trim())).filter(n => n > 0);

  const handleAdd = async () => {
    const sIds = parseIds(form.sourceIds);
    const tIds = parseIds(form.targetIds);
    if (!form.name || !sIds.length || !tIds.length) { setError(t('chainConfig.required')); return; }
    setSaving(true); setError('');
    try {
      await addEventChain({ name: form.name, description: form.description, sourceLabel: form.sourceLabel, targetLabel: form.targetLabel, sourceIds: sIds, targetIds: tIds });
      setForm({ name: '', description: '', sourceLabel: '', targetLabel: '', sourceIds: '', targetIds: '' });
      setShowForm(false);
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('chainConfig.confirmDelete'))) return;
    try { await deleteEventChain(id); await load(); }
    catch (e: any) { setError(e.message); }
  };

  const handleToggle = async (c: Chain) => {
    try { await updateEventChain(c.id, { enabled: !c.enabled }); await load(); }
    catch (e: any) { setError(e.message); }
  };

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-[12px] text-txt focus:outline-none focus:ring-2 focus:ring-golomt-500/30';

  return (
    <div className="flex min-h-screen">
      <main className="flex-1 ml-[260px] min-w-0 overflow-hidden">
        <div className="max-w-4xl mx-auto p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/')} className="p-2 rounded-lg bg-surface-card border border-surface-border hover:bg-surface-elevated transition-colors">
                <ArrowLeft size={16} className="text-txt-dim" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-txt">{t('chainConfig.title')}</h1>
                <p className="text-[11px] text-txt-dim">{t('chainConfig.subtitle')}</p>
              </div>
            </div>
            <button onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-golomt-600 hover:bg-golomt-700 text-white text-[11px] font-semibold transition-colors">
              <Plus size={14} /> {t('chainConfig.new')}
            </button>
          </div>

          {error && <p className="text-red-400 text-[11px]">{error}</p>}

          {/* Dashboard ID reference */}
          {dashboards.length > 0 && (
            <div className="bg-surface-card rounded-xl border border-surface-border p-3">
              <p className="text-[10px] font-medium text-txt-dim mb-2">{t('chainConfig.dashIds')}</p>
              <div className="flex flex-wrap gap-1.5">
                {dashboards.map(d => (
                  <span key={d.id} className="text-[9px] px-2 py-0.5 rounded bg-surface-elevated text-txt-dim font-mono">{d.id}: {d.name}</span>
                ))}
              </div>
            </div>
          )}

          {/* Add form */}
          {showForm && (
            <div className="bg-surface-card rounded-xl border border-surface-border p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-txt-dim mb-1">{t('chainConfig.name')}</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-txt-dim mb-1">{t('chainConfig.desc')}</label>
                  <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-txt-dim mb-1">{t('chainConfig.sourceIds')}</label>
                  <input value={form.sourceIds} onChange={e => setForm({ ...form, sourceIds: e.target.value })} placeholder="5, 6" className={inputClass + ' font-mono'} />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-txt-dim mb-1">{t('chainConfig.targetIds')}</label>
                  <input value={form.targetIds} onChange={e => setForm({ ...form, targetIds: e.target.value })} placeholder="8, 9" className={inputClass + ' font-mono'} />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-txt-dim mb-1">{t('chainConfig.sourceLabel')}</label>
                  <input value={form.sourceLabel} onChange={e => setForm({ ...form, sourceLabel: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-txt-dim mb-1">{t('chainConfig.targetLabel')}</label>
                  <input value={form.targetLabel} onChange={e => setForm({ ...form, targetLabel: e.target.value })} className={inputClass} />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleAdd} disabled={saving}
                  className="px-4 py-2 rounded-lg bg-golomt-600 hover:bg-golomt-700 text-white text-[11px] font-semibold disabled:opacity-50 transition-colors">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : t('chainConfig.add')}
                </button>
                <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg bg-surface-elevated text-txt-dim text-[11px] hover:text-txt transition-colors">{t('chainConfig.cancel')}</button>
              </div>
            </div>
          )}

          {/* List */}
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 size={18} className="animate-spin text-golomt-400" /></div>
          ) : items.length === 0 ? (
            <div className="text-center py-16">
              <Link2 size={24} className="mx-auto text-txt-dim mb-2 opacity-40" />
              <p className="text-[12px] text-txt-dim">{t('chainConfig.empty')}</p>
            </div>
          ) : (
            <div className="bg-surface-card rounded-xl border border-surface-border overflow-hidden">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-surface-border bg-surface-elevated">
                    <th className="px-4 py-2.5 text-left font-medium text-txt-dim">ID</th>
                    <th className="px-4 py-2.5 text-left font-medium text-txt-dim">{t('chainConfig.name')}</th>
                    <th className="px-4 py-2.5 text-left font-medium text-txt-dim">Source</th>
                    <th className="px-4 py-2.5 text-left font-medium text-txt-dim">Target</th>
                    <th className="px-4 py-2.5 text-right font-medium text-txt-dim"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(c => (
                    <tr key={c.id} className={`border-b border-surface-border/30 hover:bg-surface-hover transition-colors ${!c.enabled ? 'opacity-40' : ''}`}>
                      <td className="px-4 py-3 text-txt-dim font-mono">{c.id}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-txt">{c.name}</p>
                        {c.description && <p className="text-[10px] text-txt-dim truncate max-w-[200px]">{c.description}</p>}
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px] text-txt-muted">DB{c.sourceIds.join('+')}</td>
                      <td className="px-4 py-3 font-mono text-[10px] text-txt-muted">DB{c.targetIds.join('+')}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleToggle(c)} className="p-1.5 rounded-md hover:bg-surface-elevated transition-colors">
                            {c.enabled ? <ToggleRight size={18} className="text-emerald-400" /> : <ToggleLeft size={18} className="text-txt-dim" />}
                          </button>
                          <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded-md text-txt-dim hover:text-red-400 hover:bg-surface-elevated transition-colors">
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
