'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import { Loader2, LogIn, Building2, KeyRound } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pin, setPin] = useState('');

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        routeUser(session.user.id);
      }
    };
    init();
  }, []);

  const routeUser = async (userId: string) => {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      setError('لم يتم العثور على صلاحيات لهذا الحساب.');
      setLoading(false);
      return;
    }

    if (profile.role === 'admin') {
      router.push('/admin');
    } else if (profile.role === 'bureau_manager') {
      router.push('/bureau');
    }
  };

  const handleBureauLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) return;

    setLoading(true);
    setError(null);

    try {
      // 1. Verify PIN and get hidden email from backend
      const res = await fetch('/api/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin.trim() })
      });
      
      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'الرقم السري غير صحيح');
      }

      const generatedEmail = result.email;

      // 2. Login with Supabase
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: generatedEmail,
        password: pin.trim(),
      });

      if (signInError) {
        throw new Error('فشل تسجيل الدخول يرجى المحاولة مجدداً');
      }

      if (data.user) {
        await routeUser(data.user.id);
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" dir="rtl">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-blue-600">
          <div className="p-3 bg-blue-100 rounded-2xl shadow-sm">
            <Building2 className="w-10 h-10" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">
          دخول مكاتب التصويت
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          أدخل الرقم السري الممنوح لك للدخول إلى مكتبك مباشرة
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white/90 backdrop-blur-xl py-10 px-4 shadow-xl border border-white/40 sm:rounded-3xl sm:px-10 transition-all">
          
          {error && (
            <div className="mb-6 bg-red-50 border-r-4 border-red-500 p-4 rounded-xl shadow-sm animate-pulse">
              <p className="text-sm text-red-700 font-semibold text-center">{error}</p>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleBureauLogin}>
            <div>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-blue-500">
                  <KeyRound className="w-6 h-6" />
                </div>
                <input
                  type="password"
                  required
                  className="appearance-none block w-full px-4 py-4 pr-14 border-2 border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:ring-0 focus:border-blue-500 sm:text-lg transition-all text-center tracking-[0.5em] font-mono text-slate-800 font-bold bg-slate-50 hover:bg-white"
                  placeholder="••••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  dir="ltr"
                  pattern="\d*"
                  maxLength={6}
                />
              </div>
              <p className="text-xs text-slate-400 mt-3 text-center">
                الرقم السري يتكون من 6 أرقام.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || pin.length < 6}
              className="w-full flex justify-center items-center gap-3 py-4 px-4 border border-transparent rounded-2xl shadow-lg shadow-blue-600/30 text-lg font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  الدخول المباشر
                  <LogIn className="w-6 h-6" />
                </>
              )}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
