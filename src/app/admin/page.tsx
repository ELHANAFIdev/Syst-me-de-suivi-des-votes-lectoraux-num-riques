'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase-client';
import { Users, CheckCircle, Activity, BarChart3, Loader2 } from 'lucide-react';

type BureauStat = {
  bureau_name: string;
  province: string;
  total: number;
  voted: number;
  lastActive?: number; // timestamp to trigger glow effect
};

export default function AdminWarRoom() {
  const [stats, setStats] = useState<Record<string, BureauStat>>({});
  const [loading, setLoading] = useState(true);
  const [selectedProvince, setSelectedProvince] = useState<string>('الكل');

  useEffect(() => {
    fetchInitialData();

    // 2. Subscribe to Realtime Updates
    const channel = supabase
      .channel('public:electeurs')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'electeurs' },
        (payload) => {
          const updatedVoter = payload.new as any;
          const oldVoter = payload.old as any;
          
          // Only react if has_voted changed
          if (updatedVoter.has_voted !== oldVoter.has_voted) {
            handleRealtimeUpdate(updatedVoter.bureau_name, updatedVoter.has_voted);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    // Fetch all needed fields to aggregate stats locally.
    // For a massive DB (>100k), an RPC function in Supabase doing GROUP BY is recommended.
    // This approach works perfectly for up to ~50k-100k records for the Admin Dashboard.
    const { data, error } = await supabase
      .from('electeurs')
      .select('bureau_name, province, has_voted');

    if (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
      return;
    }

    const aggregated: Record<string, BureauStat> = {};

    data.forEach((voter: any) => {
      const bName = voter.bureau_name || 'غير محدد';

      if (!aggregated[bName]) {
        aggregated[bName] = { bureau_name: bName, province: voter.province, total: 0, voted: 0 };
      }
      aggregated[bName].total += 1;
      if (voter.has_voted) {
        aggregated[bName].voted += 1;
      }
    });

    setStats(aggregated);
    setLoading(false);
  };

  const handleRealtimeUpdate = (bureauName: string, hasVoted: boolean) => {
    setStats(prev => {
      const prevStat = prev[bureauName];
      if (!prevStat) return prev;

      return {
        ...prev,
        [bureauName]: {
          ...prevStat,
          voted: hasVoted ? prevStat.voted + 1 : prevStat.voted - 1,
          lastActive: Date.now(), // Trigger glowing animation
        }
      };
    });
  };

  // Global metrics
  const globalStats = useMemo(() => {
    const statValues = Object.values(stats);
    const total = statValues.reduce((acc, curr) => acc + curr.total, 0);
    const voted = statValues.reduce((acc, curr) => acc + curr.voted, 0);
    const percent = total === 0 ? 0 : ((voted / total) * 100).toFixed(1);
    
    // Sort bureaux by lowest participation first to identify lagging offices
    const sortedBureaux = [...statValues].sort((a, b) => {
      const percentA = a.total === 0 ? 0 : a.voted / a.total;
      const percentB = b.total === 0 ? 0 : b.voted / b.total;
      return percentA - percentB;
    });

    return { total, voted, percent, sortedBureaux };
  }, [stats]);

  const uniqueProvinces = useMemo(() => {
    const pSet = new Set<string>();
    Object.values(stats).forEach(s => {
      if (s.province) pSet.add(s.province);
    });
    return Array.from(pSet).sort();
  }, [stats]);

  const filteredBureaux = useMemo(() => {
    if (selectedProvince === 'الكل') return globalStats.sortedBureaux;
    return globalStats.sortedBureaux.filter(b => b.province === selectedProvince);
  }, [globalStats.sortedBureaux, selectedProvince]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-400">
        <Loader2 className="w-12 h-12 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500/30" dir="rtl">
      
      {/* Header */}
      <header className="border-b border-white/10 bg-slate-950/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-l from-white to-slate-400 bg-clip-text text-transparent">
                غرفة العمليات المركزية
              </h1>
              <p className="text-xs text-slate-400 font-mono flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
                مزامنة لحظية نشطة (Real-Time)
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-6 text-right">
             <div className="flex gap-3">
               <a href="/admin/tracking" className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg font-bold transition-colors">
                 لوحة التتبع (المسؤولين)
               </a>
               <a href="/admin/import" className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg font-bold transition-colors shadow-lg shadow-blue-900/50">
                 استيراد الإكسيل
               </a>
             </div>
             <div className="border-r border-slate-800 pr-6">
               <div className="text-sm text-slate-400">نسبة المشاركة الإجمالية</div>
               <div className="text-3xl font-black text-white tracking-tight">
                 {globalStats.percent}%
               </div>
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Top KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* KPI 1 */}
          <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-30 bg-blue-500/5 rounded-full blur-3xl -z-10 group-hover:bg-blue-500/10 transition-colors"></div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-1">إجمالي الناخبين المستهدفين</p>
                <p className="text-4xl font-bold text-white">{globalStats.total.toLocaleString('ar-MA')}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                <Users className="w-6 h-6" />
              </div>
            </div>
          </div>
          
          {/* KPI 2 */}
          <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-30 bg-green-500/5 rounded-full blur-3xl -z-10 group-hover:bg-green-500/10 transition-colors"></div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-1">إجمالي المصوتين للآن</p>
                <p className="text-4xl font-bold text-white">{globalStats.voted.toLocaleString('ar-MA')}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-400">
                <CheckCircle className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>

        {/* Bureaux Grid */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2 text-slate-300">
              <BarChart3 className="w-5 h-5" />
              <h2 className="text-lg font-semibold">حالة مكاتب التصويت (الأقل مشاركة أولاً)</h2>
            </div>
            
            {/* Province Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">تصفية بالمقاطعة:</span>
              <select
                className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 outline-none"
                value={selectedProvince}
                onChange={(e) => setSelectedProvince(e.target.value)}
              >
                <option value="الكل">الجميع</option>
                {uniqueProvinces.map((prov, i) => (
                  <option key={i} value={prov}>{prov}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredBureaux.map((bureau) => {
              const percent = bureau.total === 0 ? 0 : Math.round((bureau.voted / bureau.total) * 100);
              // Glow effect if updated recently (< 3 seconds ago)
              const isRecentlyActive = bureau.lastActive && Date.now() - bureau.lastActive < 3000;
              
              return (
                <div 
                  key={bureau.bureau_name}
                  className={`bg-slate-900 border rounded-2xl p-4 transition-all duration-500 ${
                    isRecentlyActive 
                      ? 'border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.3)] scale-[1.02] z-10' 
                      : 'border-white/5 hover:border-white/10'
                  }`}
                >
                  <h3 className="font-semibold text-slate-200 text-sm truncate mb-3" title={bureau.bureau_name}>
                    {bureau.bureau_name}
                  </h3>
                  
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-2xl font-bold text-white">{percent}%</span>
                    <span className="text-xs text-slate-500 mb-1" dir="ltr">
                      {bureau.voted} / {bureau.total}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ease-out ${
                        percent < 20 ? 'bg-red-500' : percent < 50 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  
                  {isRecentlyActive && (
                    <div className="mt-3 text-[10px] text-blue-400 font-bold flex items-center gap-1 animate-pulse">
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                      تم تسجيل تصويت للتو!
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
