'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase-client';
import { Search, Phone, CheckCircle, User, MapPin, Loader2, LogOut, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Voter = {
  id: string;
  cin: string;
  nom: string;
  prenom: string;
  telephone_electeur: string;
  has_voted: boolean;
  bureau_name: string;
  adresse: string;
  sous_responsable: string;
};

export default function ResponsableDashboard() {
  const [voters, setVoters] = useState<Voter[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [responsableName, setResponsableName] = useState<string>('');
  const [selectedVice, setSelectedVice] = useState<string | null>(null);
  
  const router = useRouter();

  useEffect(() => {
    checkAuthAndFetchVoters();

    // Subscribe to Realtime Updates to see when voters cast their votes
    const channel = supabase
      .channel('public:electeurs')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'electeurs' },
        (payload) => {
          const updatedVoter = payload.new as any;
          setVoters(prev => prev.map(v => 
            v.id === updatedVoter.id ? { ...v, has_voted: updatedVoter.has_voted } : v
          ));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const checkAuthAndFetchVoters = async () => {
    setLoading(true);
    
    // 1. Check Session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      router.replace('/');
      return;
    }

    // 2. Get Profile to find Responsable Name
    // Note: We used bureau_name column in DB to store the responsable name to avoid schema changes
    const { data: profile } = await supabase
      .from('profiles')
      .select('bureau_name, role')
      .eq('id', session.user.id)
      .single();

    if (!profile || profile.role !== 'bureau_manager' || !profile.bureau_name?.startsWith('RESP_')) {
      alert('لا تملك صلاحيات الدخول لهذه الصفحة');
      router.replace('/');
      return;
    }

    const assignedName = profile.bureau_name.replace('RESP_', '');
    setResponsableName(assignedName);

    // 3. Fetch Voters for this Responsable using API to bypass RLS policies on electeurs table
    try {
      const res = await fetch('/api/responsable-voters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedName: assignedName,
          token: session.access_token
        })
      });

      if (!res.ok) {
        console.error('Error fetching via API');
        setVoters([]);
      } else {
        const result = await res.json();
        const filteredData = result.voters || [];
        
        // Sort manually
        filteredData.sort((a: any, b: any) => {
          if (a.has_voted === b.has_voted) {
            return (a.nom || '').localeCompare(b.nom || '');
          }
          return a.has_voted ? 1 : -1;
        });

        setVoters(filteredData as Voter[]);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setVoters([]);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  // Extract unique vice responsables
  const viceResponsables = useMemo(() => {
    const set = new Set<string>();
    voters.forEach(v => {
      if (v.sous_responsable && v.sous_responsable.trim().toUpperCase() !== responsableName.trim().toUpperCase()) {
        set.add(v.sous_responsable.trim());
      }
    });
    return Array.from(set);
  }, [voters, responsableName]);

  // Fast filtering by CIN, First Name, Last Name, and Vice Responsable
  const filteredVoters = useMemo(() => {
    let result = voters;
    
    if (selectedVice) {
      if (selectedVice === 'direct') {
        result = result.filter(v => !v.sous_responsable || v.sous_responsable.trim().toUpperCase() === responsableName.trim().toUpperCase());
      } else {
        result = result.filter(v => v.sous_responsable?.trim() === selectedVice);
      }
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(v => 
        v.cin?.toLowerCase().includes(query) ||
        v.nom?.toLowerCase().includes(query) ||
        v.prenom?.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [voters, searchQuery, selectedVice, responsableName]);

  const stats = useMemo(() => {
    const total = voters.length;
    const voted = voters.filter(v => v.has_voted).length;
    const percent = total === 0 ? 0 : Math.round((voted / total) * 100);
    return { total, voted, percent };
  }, [voters]);

  if (loading && !responsableName) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-purple-600">
        <Loader2 className="w-10 h-10 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 font-sans" dir="rtl">
      {/* Header Profile & Stats */}
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="p-4 flex flex-col gap-4 max-w-2xl mx-auto">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-lg font-bold text-slate-800">لوحة المراقبة والتتبع</h1>
              <p className="text-sm text-slate-500 font-medium">المسؤول: {responsableName}</p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="bg-purple-50 text-purple-700 px-3 py-1.5 rounded-full font-bold text-sm border border-purple-100 shadow-inner">
                {stats.percent}% 
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                title="تسجيل الخروج"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div 
              className="bg-purple-600 h-2.5 rounded-full transition-all duration-1000 ease-out" 
              style={{ width: `${stats.percent}%` }}
            ></div>
          </div>
          
          <div className="flex justify-between text-xs text-slate-500 font-medium px-1">
            <span>الناخبين التابعين لك: {stats.total}</span>
            <span>صوتوا: {stats.voted}</span>
            <span className="text-red-500">باقي للاتصال: {stats.total - stats.voted}</span>
          </div>

          {/* Search Bar */}
          <div className="relative group">
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400 group-focus-within:text-purple-500 transition-colors">
              <Search className="w-5 h-5" />
            </div>
            <input
              type="text"
              className="w-full bg-slate-100 border-transparent focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-200 rounded-xl py-3 pr-10 pl-4 text-sm transition-all outline-none shadow-sm"
              placeholder="البحث في الناخبين ديالك (CIN، الاسم)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Vice Responsables Filter Tabs */}
          {viceResponsables.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide mt-1">
              <button
                onClick={() => setSelectedVice(null)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${!selectedVice ? 'bg-purple-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
              >
                الجميع
              </button>
              <button
                onClick={() => setSelectedVice('direct')}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${selectedVice === 'direct' ? 'bg-purple-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
              >
                تابعين لي مباشرة
              </button>
              {viceResponsables.map(vice => (
                <button
                  key={vice}
                  onClick={() => setSelectedVice(vice)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${selectedVice === vice ? 'bg-orange-500 text-white shadow-md' : 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100'}`}
                >
                  {vice}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Voters List */}
      <main className="p-4 max-w-2xl mx-auto space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            <p className="text-sm">جاري تحديث البيانات...</p>
          </div>
        ) : filteredVoters.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3 bg-white rounded-2xl shadow-sm border border-slate-100">
            <User className="w-12 h-12 text-slate-300" />
            <p className="text-sm font-medium">لا يوجد ناخبين مطابقين للبحث.</p>
          </div>
        ) : (
          filteredVoters.map((voter) => (
            <div 
              key={voter.id} 
              className={`bg-white rounded-2xl p-4 shadow-sm border transition-all duration-300 ${
                voter.has_voted ? 'border-green-200 bg-green-50/30' : 'border-slate-200 hover:border-purple-200 hover:shadow-md'
              }`}
            >
              <div className="flex justify-between items-start gap-3">
                
                {/* Voter Info */}
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-slate-800 text-base">
                      {voter.nom} {voter.prenom}
                    </h2>
                    <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-md font-mono tracking-wider border border-slate-200">
                      {voter.cin}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-1.5 text-slate-500 text-xs">
                    <MapPin className="w-3.5 h-3.5" />
                    <span className="font-semibold text-slate-700">مكتب: {voter.bureau_name}</span>
                    
                    {voter.sous_responsable && voter.sous_responsable.trim().toUpperCase() !== responsableName.trim().toUpperCase() && (
                      <span className="bg-orange-100 text-orange-700 text-[10px] px-2 py-0.5 rounded-md font-bold border border-orange-200">
                        نائب: {voter.sous_responsable}
                      </span>
                    )}
                  </div>
                  
                  {voter.telephone_electeur && !voter.has_voted && (
                    <a 
                      href={`tel:${voter.telephone_electeur}`}
                      className="inline-flex items-center gap-1.5 text-purple-600 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors mt-1 w-fit"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      اتصال بالناخب
                    </a>
                  )}
                </div>

                {/* Vote Status Indicator (View Only) */}
                <div
                  className={`flex flex-col items-center justify-center h-16 w-20 rounded-xl transition-all duration-300 ${
                    voter.has_voted 
                      ? 'bg-green-100 text-green-600 border border-green-200' 
                      : 'bg-red-50 text-red-500 border border-red-100'
                  }`}
                >
                  {voter.has_voted ? (
                    <>
                      <CheckCircle className="w-6 h-6 mb-1" />
                      <span className="text-[10px] font-bold">صوَّت</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-6 h-6 mb-1 opacity-70" />
                      <span className="text-[10px] font-bold">لم يصوت</span>
                    </>
                  )}
                </div>
                
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
