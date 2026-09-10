'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase-client';
import { Search, Phone, CheckCircle, User, MapPin, Loader2, Check, LogOut } from 'lucide-react';
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
};

export default function BureauDashboard() {
  const [voters, setVoters] = useState<Voter[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [bureauName, setBureauName] = useState<string>('');
  
  const router = useRouter();

  useEffect(() => {
    checkAuthAndFetchVoters();
  }, []);

  const checkAuthAndFetchVoters = async () => {
    setLoading(true);
    
    // 1. Check Session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      router.replace('/');
      return;
    }

    // 2. Get Profile to find Bureau Name
    const { data: profile } = await supabase
      .from('profiles')
      .select('bureau_name, role')
      .eq('id', session.user.id)
      .single();

    if (!profile || profile.role !== 'bureau_manager') {
      alert('لا تملك صلاحيات الدخول لهذه الصفحة');
      router.replace('/');
      return;
    }

    const assignedBureau = profile.bureau_name;
    setBureauName(assignedBureau);

    // 3. Fetch Voters for this Bureau
    const { data, error } = await supabase
      .from('electeurs')
      .select('*')
      .eq('bureau_name', assignedBureau)
      .order('has_voted', { ascending: true }) // Show unvoted first
      .order('nom', { ascending: true });

    if (error) {
      console.error('Error fetching voters:', error);
    } else {
      setVoters(data as Voter[]);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  const handleVoteToggle = async (voterId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    const votedAt = newStatus ? new Date().toISOString() : null;

    // Optimistic UI Update
    setVoters(prev => prev.map(v => 
      v.id === voterId ? { ...v, has_voted: newStatus } : v
    ));

    // Database Update
    const { error } = await supabase
      .from('electeurs')
      .update({ has_voted: newStatus, voted_at: votedAt })
      .eq('id', voterId);

    if (error) {
      // Revert if error occurs
      console.error('Failed to update vote status:', error);
      setVoters(prev => prev.map(v => 
        v.id === voterId ? { ...v, has_voted: currentStatus } : v
      ));
      alert('حدث خطأ أثناء تحديث حالة التصويت. يرجى المحاولة مرة أخرى.');
    }
  };

  // Fast filtering by CIN, First Name, or Last Name
  const filteredVoters = useMemo(() => {
    if (!searchQuery) return voters;
    const query = searchQuery.toLowerCase();
    return voters.filter(v => 
      v.cin?.toLowerCase().includes(query) ||
      v.nom?.toLowerCase().includes(query) ||
      v.prenom?.toLowerCase().includes(query)
    );
  }, [voters, searchQuery]);

  const stats = useMemo(() => {
    const total = voters.length;
    const voted = voters.filter(v => v.has_voted).length;
    const percent = total === 0 ? 0 : Math.round((voted / total) * 100);
    return { total, voted, percent };
  }, [voters]);

  if (loading && !bureauName) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-blue-600">
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
              <h1 className="text-lg font-bold text-slate-800">إدارة مكتب التصويت</h1>
              <p className="text-sm text-slate-500 font-medium">{bureauName}</p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full font-bold text-sm border border-blue-100 shadow-inner">
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
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-1000 ease-out" 
              style={{ width: `${stats.percent}%` }}
            ></div>
          </div>
          
          <div className="flex justify-between text-xs text-slate-500 font-medium px-1">
            <span>إجمالي الناخبين: {stats.total}</span>
            <span>صوتوا: {stats.voted}</span>
          </div>

          {/* Search Bar */}
          <div className="relative group">
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
              <Search className="w-5 h-5" />
            </div>
            <input
              type="text"
              className="w-full bg-slate-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-xl py-3 pr-10 pl-4 text-sm transition-all outline-none shadow-sm"
              placeholder="البحث برقم البطاقة (CIN) أو الاسم..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </header>

      {/* Voters List */}
      <main className="p-4 max-w-2xl mx-auto space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
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
                voter.has_voted ? 'border-green-200 bg-green-50/30' : 'border-slate-200 hover:border-blue-200 hover:shadow-md'
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
                  
                  <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                    <MapPin className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[200px]">{voter.adresse || 'بدون عنوان'}</span>
                  </div>
                  
                  {voter.telephone_electeur && (
                    <a 
                      href={`tel:${voter.telephone_electeur}`}
                      className="inline-flex items-center gap-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors mt-1 w-fit"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      اتصال بالناخب
                    </a>
                  )}
                </div>

                {/* Vote Action Button */}
                <button
                  onClick={() => handleVoteToggle(voter.id, voter.has_voted)}
                  className={`relative overflow-hidden group flex flex-col items-center justify-center h-16 w-20 rounded-xl transition-all duration-300 active:scale-95 ${
                    voter.has_voted 
                      ? 'bg-green-500 text-white shadow-green-200 shadow-lg' 
                      : 'bg-slate-100 text-slate-600 hover:bg-blue-500 hover:text-white hover:shadow-blue-200 hover:shadow-lg'
                  }`}
                >
                  <div className="absolute inset-0 bg-white/20 transform scale-x-0 group-active:scale-x-100 transition-transform origin-left"></div>
                  {voter.has_voted ? (
                    <>
                      <CheckCircle className="w-6 h-6 mb-1 animate-in zoom-in duration-300" />
                      <span className="text-[10px] font-bold">مُصوِّت</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-6 h-6 mb-1 opacity-50 group-hover:opacity-100 transition-opacity" />
                      <span className="text-[10px] font-bold">تأكيد</span>
                    </>
                  )}
                </button>
                
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
