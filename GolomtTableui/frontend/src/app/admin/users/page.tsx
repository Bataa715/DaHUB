'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { fetchUsers, createUserAPI, deleteUserAPI, updateUserRoleAPI, changePasswordAPI } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import { Users, Trash2, Shield, Eye, KeyRound, X, Check, AlertTriangle, UserPlus } from 'lucide-react';

export default function UserManagementPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [pwModal, setPwModal] = useState<string | null>(null);
  const [newPw, setNewPw] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ username: '', password: '', displayName: '', role: 'viewer' });

  useEffect(() => {
    if (!authLoading && !isAdmin) { router.push('/'); return; }
    if (!authLoading && isAdmin) loadUsers();
  }, [authLoading, isAdmin]);

  const loadUsers = () => {
    setLoading(true);
    fetchUsers().then(data => setUsers(data.users || [])).catch(e => setError(e.message)).finally(() => setLoading(false));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!form.username || !form.password || !form.displayName) { setError('Бүх талбар бөглөнө үү'); return; }
    if (form.password.length < 8) { setError('Нууц үг хамгийн багадаа 8 тэмдэгт'); return; }
    if (!/[a-zA-Z]/.test(form.password) || !/[0-9]/.test(form.password)) { setError('Нууц үг үсэг болон тоо агуулсан байх ёстой'); return; }
    if (!/^[a-zA-Z0-9_.\-]+$/.test(form.username)) { setError('Нэвтрэх нэр зөвхөн үсэг, тоо, _, ., - агуулна'); return; }
    try {
      await createUserAPI(form.username, form.password, form.displayName, form.role);
      setSuccess('Хэрэглэгч үүслээ');
      setForm({ username: '', password: '', displayName: '', role: 'viewer' });
      setShowAdd(false);
      loadUsers();
    } catch (e: any) { setError(e.message); }
  };

  const handleDelete = async (userId: string, uname: string) => {
    if (!confirm(`"${uname}" устгах уу?`)) return;
    try { await deleteUserAPI(userId); loadUsers(); } catch (e: any) { setError(e.message); }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try { await updateUserRoleAPI(userId, newRole); loadUsers(); } catch (e: any) { setError(e.message); }
  };

  const handleChangePw = async () => {
    if (!newPw || newPw.length < 8) { setError('Хамгийн багадаа 8 тэмдэгт'); return; }
    if (!/[a-zA-Z]/.test(newPw) || !/[0-9]/.test(newPw)) { setError('Үсэг болон тоо агуулсан байх ёстой'); return; }
    try { await changePasswordAPI(pwModal!, newPw); setSuccess('Нууц үг солигдлоо'); setPwModal(null); setNewPw(''); } catch (e: any) { setError(e.message); }
  };

  return (
    <div className="flex min-h-screen">
      <main className="flex-1 ml-[260px] min-w-0 overflow-hidden p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-txt">Хэрэглэгчийн удирдлага</h1>
            <p className="text-xs text-txt-dim">Системийн хэрэглэгчид & эрх</p>
          </div>
          <button onClick={() => { setShowAdd(true); setError(''); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-golomt-500 text-white text-xs font-medium rounded-lg hover:bg-golomt-600 transition-colors">
            <UserPlus size={14} /> Нэмэх
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-red-400 text-xs">
            <AlertTriangle size={14} /> {error}
            <button onClick={() => setError('')} className="ml-auto text-red-400/60 hover:text-red-400"><X size={12} /></button>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 text-emerald-400 text-xs">
            <Check size={14} /> {success}
            <button onClick={() => setSuccess('')} className="ml-auto"><X size={12} /></button>
          </div>
        )}

        {/* Add user modal */}
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-surface-card border border-surface-border rounded-xl w-full max-w-sm p-5 mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-txt flex items-center gap-2"><UserPlus size={15} /> Шинэ хэрэглэгч</h3>
                <button onClick={() => setShowAdd(false)} className="text-txt-dim hover:text-txt"><X size={16} /></button>
              </div>
              <form onSubmit={handleCreate} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-medium text-txt-dim mb-1">Нэвтрэх нэр</label>
                  <input type="text" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-xs text-txt focus:outline-none focus:border-golomt-500/50 transition-colors" placeholder="username" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-txt-dim mb-1">Нэр</label>
                  <input type="text" value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-xs text-txt focus:outline-none focus:border-golomt-500/50 transition-colors" placeholder="Бат" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-txt-dim mb-1">Нууц үг</label>
                  <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-xs text-txt focus:outline-none focus:border-golomt-500/50 transition-colors" placeholder="••••••••" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-txt-dim mb-1">Эрх</label>
                  <div className="flex gap-2">
                    <label className={`flex-1 flex items-center gap-2 p-2.5 border rounded-lg cursor-pointer transition-all ${form.role === 'viewer' ? 'border-blue-500/40 bg-blue-500/5' : 'border-surface-border hover:bg-surface-hover'}`}>
                      <input type="radio" name="role" value="viewer" checked={form.role === 'viewer'} onChange={() => setForm({ ...form, role: 'viewer' })} className="hidden" />
                      <Eye size={14} className={form.role === 'viewer' ? 'text-blue-400' : 'text-txt-dim'} />
                      <span className="text-xs text-txt">Харагч</span>
                    </label>
                    <label className={`flex-1 flex items-center gap-2 p-2.5 border rounded-lg cursor-pointer transition-all ${form.role === 'admin' ? 'border-purple-500/40 bg-purple-500/5' : 'border-surface-border hover:bg-surface-hover'}`}>
                      <input type="radio" name="role" value="admin" checked={form.role === 'admin'} onChange={() => setForm({ ...form, role: 'admin' })} className="hidden" />
                      <Shield size={14} className={form.role === 'admin' ? 'text-purple-400' : 'text-txt-dim'} />
                      <span className="text-xs text-txt">Админ</span>
                    </label>
                  </div>
                </div>
                <button type="submit" className="w-full py-2 bg-golomt-500 text-white font-medium text-xs rounded-lg hover:bg-golomt-600 transition-colors">
                  Үүсгэх
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Password modal */}
        {pwModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-surface-card border border-surface-border rounded-xl w-full max-w-xs p-5 mx-4">
              <h3 className="text-sm font-bold text-txt flex items-center gap-2 mb-3"><KeyRound size={15} /> Нууц үг солих</h3>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Шинэ нууц үг"
                className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-xs text-txt mb-3 focus:outline-none focus:border-golomt-500/50 transition-colors" />
              <div className="flex gap-2">
                <button onClick={() => { setPwModal(null); setNewPw(''); }} className="flex-1 py-2 border border-surface-border rounded-lg text-xs text-txt-muted hover:bg-surface-hover transition-colors">Болих</button>
                <button onClick={handleChangePw} className="flex-1 py-2 bg-golomt-500 text-white text-xs font-medium rounded-lg hover:bg-golomt-600 transition-colors">Хадгалах</button>
              </div>
            </div>
          </div>
        )}

        {/* Users table */}
        <div className="bg-surface-card rounded-xl border border-surface-border overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-border">
            <p className="text-xs text-txt-muted">Нийт {users.length} хэрэглэгч</p>
          </div>
          {loading ? (
            <div className="p-10 text-center">
              <div className="w-7 h-7 border-2 border-golomt-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-surface-elevated border-b border-surface-border">
                  <th className="px-4 py-2.5 text-left font-medium text-txt-dim">Хэрэглэгч</th>
                  <th className="px-4 py-2.5 text-left font-medium text-txt-dim">Нэвтрэх</th>
                  <th className="px-4 py-2.5 text-left font-medium text-txt-dim">Эрх</th>
                  <th className="px-4 py-2.5 text-left font-medium text-txt-dim">Үүсгэсэн</th>
                  <th className="px-4 py-2.5 text-right font-medium text-txt-dim">Үйлдэл</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-surface-border/30 hover:bg-surface-hover transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold text-white ${u.role === 'admin' ? 'bg-gradient-to-br from-purple-500 to-indigo-600' : 'bg-gradient-to-br from-blue-500 to-cyan-500'}`}>
                          {u.displayName?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <span className="font-medium text-txt">{u.displayName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-txt-muted font-mono">{u.username}</td>
                    <td className="px-4 py-3">
                      {u.username === 'admin' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded text-[10px] font-medium">
                          <Shield size={10} /> Админ
                        </span>
                      ) : (
                        <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium border-0 cursor-pointer bg-transparent ${u.role === 'admin' ? 'text-purple-400' : 'text-blue-400'}`}>
                          <option value="viewer">Харагч</option>
                          <option value="admin">Админ</option>
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3 text-txt-dim">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('mn-MN') : '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setPwModal(u.id); setNewPw(''); }}
                          className="p-1.5 text-txt-dim hover:text-golomt-400 rounded-md hover:bg-surface-hover transition-all" title="Нууц үг">
                          <KeyRound size={13} />
                        </button>
                        {u.username !== 'admin' && (
                          <button onClick={() => handleDelete(u.id, u.username)}
                            className="p-1.5 text-txt-dim hover:text-red-400 rounded-md hover:bg-surface-hover transition-all" title="Устгах">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
      <Sidebar />
    </div>
  );
}
