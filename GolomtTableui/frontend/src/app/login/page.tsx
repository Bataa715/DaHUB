'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Eye, EyeOff, Lock, User, ArrowRight, Fingerprint } from 'lucide-react';

export default function LoginPage() {
  const { login, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (!authLoading && user) router.push('/'); }, [authLoading, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) { setError('Нэвтрэх нэр, нууц үг оруулна уу'); return; }
    setLoading(true);
    try {
      await login(username.trim(), password);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Нэвтрэхэд алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden bg-[#0a0a1a]">
      {/* LEFT: Branding */}
      <div className="hidden lg:flex lg:w-[55%] relative items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a0533] via-[#0f1035] to-[#0a1628]" />
        <div className="absolute top-[15%] left-[10%] w-[400px] h-[400px] bg-purple-600/20 rounded-full blur-[120px] animate-float-slow" />
        <div className="absolute bottom-[10%] right-[15%] w-[350px] h-[350px] bg-blue-500/15 rounded-full blur-[100px] animate-float-slow-reverse" />
        <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[140px]" />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="absolute top-20 right-20 w-40 h-40 border border-white/[0.05] rounded-3xl rotate-12 animate-float-slow" />
        <div className="absolute bottom-32 left-16 w-24 h-24 border border-white/[0.05] rounded-2xl -rotate-12 animate-float-slow-reverse" />

        <div className={`relative z-10 px-16 max-w-xl transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="mb-10">
            <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-2xl shadow-purple-500/20 ring-1 ring-white/10 mb-8">
              <img src="/Golomtlogo.jpg" alt="Голомт" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-4xl font-extrabold text-white leading-tight tracking-tight mb-3">Голомт Банк</h1>
            <div className="w-16 h-1 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full mb-5" />
            <p className="text-lg text-indigo-200/50 font-medium leading-relaxed">Аудитын Эрсдэлийн<br />Удирдлагын Систем</p>
          </div>
          <div className="space-y-4 mt-12">
            {[
              { icon: '🛡️', label: 'Бодит цагийн эрсдэлийн хяналт' },
              { icon: '📊', label: 'Аудитын тайлан & дашбоард' },
              { icon: '🔒', label: 'Аюулгүй нэвтрэлтийн систем' },
            ].map((f, i) => (
              <div key={i}
                className={`flex items-center gap-4 ${mounted ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-6'}`}
                style={{ transition: 'all 700ms ease', transitionDelay: `${(i + 1) * 200}ms` }}>
                <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-lg">{f.icon}</div>
                <span className="text-sm text-indigo-300/60 font-medium">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      </div>

      {/* RIGHT: Login form */}
      <div className="flex-1 flex items-center justify-center relative">
        <div className="absolute inset-0 bg-gradient-to-bl from-[#0d0d24] via-[#0a0a1a] to-[#0f0a20]" />
        <div className="absolute top-0 left-0 w-[300px] h-[300px] bg-purple-600/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-0 w-[250px] h-[250px] bg-blue-600/5 rounded-full blur-[80px]" />

        <div className={`relative z-10 w-full max-w-[420px] mx-6 sm:mx-auto transition-all duration-[800ms] ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
          style={{ transitionDelay: '300ms' }}>
          <div className="lg:hidden text-center mb-10">
            <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-2xl shadow-purple-500/20 ring-1 ring-white/10 mx-auto mb-5">
              <img src="/Golomtlogo.jpg" alt="Голомт" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-2xl font-bold text-white">Голомт Банк</h1>
            <p className="text-sm text-indigo-300/40 mt-1">Аудитын Эрсдэлийн Удирдлага</p>
          </div>

          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/20 flex items-center justify-center">
                <Fingerprint size={20} className="text-purple-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Нэвтрэх</h2>
                <p className="text-xs text-indigo-300/40">Системд нэвтрэхийн тулд мэдээллээ оруулна уу</p>
              </div>
            </div>
          </div>

          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-7 shadow-2xl shadow-black/20">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-indigo-300/50 uppercase tracking-wider ml-1">Нэвтрэх нэр</label>
                <div className="relative group">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400/30 group-focus-within:text-purple-400 transition-colors duration-300" />
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Хэрэглэгчийн нэр" autoComplete="username"
                    className="w-full pl-11 pr-4 py-3.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-white text-sm placeholder:text-indigo-300/20 focus:outline-none focus:bg-white/[0.06] focus:border-purple-500/30 focus:ring-2 focus:ring-purple-500/10 hover:border-white/[0.1] transition-all duration-300" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-indigo-300/50 uppercase tracking-wider ml-1">Нууц үг</label>
                <div className="relative group">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400/30 group-focus-within:text-purple-400 transition-colors duration-300" />
                  <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password"
                    className="w-full pl-11 pr-14 py-3.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-white text-sm placeholder:text-indigo-300/20 focus:outline-none focus:bg-white/[0.06] focus:border-purple-500/30 focus:ring-2 focus:ring-purple-500/10 hover:border-white/[0.1] transition-all duration-300" />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-400/30 hover:text-purple-300 transition-colors duration-200 p-0.5">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              {error && (
                <div className="flex items-center gap-3 bg-red-500/[0.08] border border-red-500/15 rounded-xl px-4 py-3">
                  <div className="w-2 h-2 bg-red-500 rounded-full shrink-0 animate-pulse" />
                  <span className="text-red-300/90 text-sm">{error}</span>
                </div>
              )}
              <button type="submit" disabled={loading}
                className="w-full relative overflow-hidden flex items-center justify-center gap-2.5 py-3.5 mt-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white font-semibold text-sm rounded-xl hover:shadow-xl hover:shadow-purple-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <><span className="relative">Нэвтрэх</span><ArrowRight size={16} className="relative group-hover:translate-x-1 transition-transform duration-300" /></>
                )}
              </button>
            </form>
          </div>

          <div className="flex items-center justify-center gap-2 mt-6">
            <Lock size={11} className="text-indigo-400/20" />
            <p className="text-[11px] text-indigo-400/20 font-medium">SSL шифрлэлтээр хамгаалагдсан</p>
          </div>
          <p className="text-center text-indigo-400/15 text-[11px] mt-8">© 2026 Голомт Банк. Бүх эрх хуулиар хамгаалагдсан.</p>
        </div>
      </div>

      <style jsx>{`
        @keyframes float-slow { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-20px); } }
        @keyframes float-slow-reverse { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(20px); } }
        .animate-float-slow { animation: float-slow 8s ease-in-out infinite; }
        .animate-float-slow-reverse { animation: float-slow-reverse 10s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
