'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import { Loader2, ArrowRight, UserCheck, UserX, Phone, Search, Users } from 'lucide-react';
import Link from 'next/link';

type Voter = {
  id: string;
  cin: string;
  nom: string;
  prenom: string;
  has_voted: boolean;
  responsable: string;
  telephone_responsable: string;
  sous_responsable: string;
  telephone_sous_responsable: string;
  telephone_electeur: string;
};

export default function AdminBureauDetails() {
  const params = useParams();
  const bureauName = decodeURIComponent((params.name as string) || '');
  
  const [voters, setVoters] = useState<Voter[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'voted' | 'pending'>('all');

  useEffect(() => {
    if (bureauName) {
      fetchVoters();
    }
    
    // Subscribe to Realtime Updates
    const channel = supabase
      .channel(`public:electeurs:${bureauName}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'electeurs', filter: `bureau_name=eq.${bureauName}` },
        (payload) => {
          const updatedVoter = payload.new as Voter;
          setVoters(prev => prev.map(v => v.id === updatedVoter.id ? { ...v, has_voted: updatedVoter.has_voted } : v));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bureauName]);

  const fetchVoters = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('electeurs')
      .select('*')
      .eq('bureau_name', bureauName)
      .order('nom', { ascending: true });

    if (error) {
      console.error('Error fetching bureau voters:', error);
    } else {
      setVoters(data as Voter[]);
    }
    setLoading(false);
  };

  const filteredVoters = voters.filter(v => {
    const matchesSearch = 
      (v.nom + ' ' + v.prenom).toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.cin || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.responsable || '').toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesFilter = 
      filter === 'all' ? true : 
      filter === 'voted' ? v.has_voted === true : 
      v.has_voted === false;

    return matchesSearch && matchesFilter;
  });

  const votedCount = voters.filter(v => v.has_voted).length;
  const totalCount = voters.length;
  const percent = totalCount === 0 ? 0 : Math.round((votedCount / totalCount) * 100);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20" dir="rtl">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-20 border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors mb-2 font-semibold">
                <ArrowRight className="w-4 h-4" />
                العودة لغرفة العمليات
              </Link>
              <h1 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
                تفاصيل: <span className="text-blue-600">{bureauName}</span>
              </h1>
            </div>
            
            {/* Bureau Quick Stats */}
            <div className="text-left bg-slate-100 px-4 py-2 rounded-xl">
              <div className="text-xs text-slate-500 font-bold mb-1">نسبة المشاركة</div>
              <div className="flex items-end gap-2 justify-end">
                <span className="text-2xl font-black text-slate-800">{percent}%</span>
                <span className="text-sm text-slate-500 font-bold mb-1" dir="ltr">{votedCount} / {totalCount}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-3 relative">
            <div className="relative flex-1 group">
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                <Search className="w-5 h-5" />
              </div>
              <input
                type="text"
                className="w-full bg-slate-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-xl py-3 pr-10 pl-4 text-sm transition-all outline-none"
                placeholder="ابحث بالاسم، رقم البطاقة، أو اسم المسؤول..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex bg-slate-100 rounded-xl p-1 md:w-auto w-full">
              <button
                onClick={() => setFilter('all')}
                className={`flex-1 md:px-6 py-2 rounded-lg text-sm font-bold transition-all ${filter === 'all' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >
                الجميع
              </button>
              <button
                onClick={() => setFilter('voted')}
                className={`flex-1 md:px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1 ${filter === 'voted' ? 'bg-emerald-500 shadow text-white' : 'text-slate-500 hover:text-slate-700'}`}
              >
                صوتوا
              </button>
              <button
                onClick={() => setFilter('pending')}
                className={`flex-1 md:px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1 ${filter === 'pending' ? 'bg-red-500 shadow text-white' : 'text-slate-500 hover:text-slate-700'}`}
              >
                لم يصوتوا
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto p-4 mt-4">
        {filteredVoters.length === 0 ? (
          <div className="text-center py-20 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300">
            <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="font-semibold text-lg">لا توجد نتائج مطابقة</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right text-slate-500">
                <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th scope="col" className="px-6 py-4">الناخب</th>
                    <th scope="col" className="px-6 py-4">CIN</th>
                    <th scope="col" className="px-6 py-4">الحالة</th>
                    <th scope="col" className="px-6 py-4">المسؤول / الهاتف</th>
                    <th scope="col" className="px-6 py-4">هاتف الناخب</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVoters.map((voter) => (
                    <tr key={voter.id} className="bg-white border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-800">
                        {voter.nom} {voter.prenom}
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-600">
                        {voter.cin}
                      </td>
                      <td className="px-6 py-4">
                        {voter.has_voted ? (
                          <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">
                            <UserCheck className="w-4 h-4" /> تم التصويت
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold">
                            <UserX className="w-4 h-4" /> لم يصوت
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {voter.responsable ? (
                          <div className="flex flex-col gap-1">
                            <span className="font-semibold text-slate-700">{voter.responsable}</span>
                            {voter.telephone_responsable && (
                              <a href={`tel:${voter.telephone_responsable}`} className="text-blue-600 hover:underline text-xs flex items-center gap-1">
                                <Phone className="w-3 h-3" /> {voter.telephone_responsable}
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">غير محدد</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {voter.telephone_electeur ? (
                          <a href={`tel:${voter.telephone_electeur}`} className="text-blue-600 hover:underline font-semibold flex items-center gap-1.5">
                            <Phone className="w-4 h-4" /> {voter.telephone_electeur}
                          </a>
                        ) : (
                          <span className="text-slate-400 text-xs">لا يوجد رقم</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
