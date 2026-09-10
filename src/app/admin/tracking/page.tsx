'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase-client';
import { Search, Phone, UserX, ChevronDown, ChevronUp, Loader2, PhoneCall } from 'lucide-react';

type Voter = {
  id: string;
  cin: string;
  nom: string;
  prenom: string;
  telephone_electeur: string;
  has_voted: boolean;
  responsable: string;
  telephone_responsable: string;
  sous_responsable: string;
  telephone_sous_responsable: string;
};

type ResponsableStat = {
  name: string;
  phone: string;
  type: 'Responsable' | 'Sous-responsable';
  total: number;
  voted: number;
  nonVoted: number;
  voters: Voter[];
};

export default function TrackingBoard() {
  const [allVoters, setAllVoters] = useState<Voter[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('electeurs')
      .select('*');

    if (error) {
      console.error('Error fetching voters:', error);
    } else {
      setAllVoters(data as Voter[]);
    }
    setLoading(false);
  };

  // Group voters by Responsable and Sous-responsable
  const responsablesList = useMemo(() => {
    const map = new Map<string, ResponsableStat>();

    allVoters.forEach(v => {
      // Process Responsable
      if (v.responsable) {
        const key = `resp_${v.responsable}`;
        if (!map.has(key)) {
          map.set(key, {
            name: v.responsable,
            phone: v.telephone_responsable,
            type: 'Responsable',
            total: 0,
            voted: 0,
            nonVoted: 0,
            voters: []
          });
        }
        const r = map.get(key)!;
        r.total++;
        if (v.has_voted) r.voted++; else r.nonVoted++;
        r.voters.push(v);
      }

      // Process Sous-responsable (if different/exists)
      if (v.sous_responsable) {
        const key = `sous_${v.sous_responsable}`;
        if (!map.has(key)) {
          map.set(key, {
            name: v.sous_responsable,
            phone: v.telephone_sous_responsable,
            type: 'Sous-responsable',
            total: 0,
            voted: 0,
            nonVoted: 0,
            voters: []
          });
        }
        const sr = map.get(key)!;
        sr.total++;
        if (v.has_voted) sr.voted++; else sr.nonVoted++;
        sr.voters.push(v);
      }
    });

    return Array.from(map.values())
      // Sort by number of non-voted (highest priority first)
      .sort((a, b) => b.nonVoted - a.nonVoted);
  }, [allVoters]);

  // Filter by search query
  const filteredResponsables = useMemo(() => {
    if (!searchQuery) return responsablesList;
    const q = searchQuery.toLowerCase();
    return responsablesList.filter(r => r.name.toLowerCase().includes(q));
  }, [responsablesList, searchQuery]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-blue-600">
        <Loader2 className="w-10 h-10 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20" dir="rtl">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-20 border-b border-slate-200">
        <div className="max-w-4xl mx-auto p-4 space-y-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800">تتبع المسؤولين (War Room)</h1>
            <p className="text-sm text-slate-500">
              تحديد المسؤولين الذين لديهم أكبر عدد من الناخبين المتخلفين عن التصويت
            </p>
          </div>

          <div className="relative group">
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
              <Search className="w-5 h-5" />
            </div>
            <input
              type="text"
              className="w-full bg-slate-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-xl py-3 pr-10 pl-4 text-sm transition-all outline-none"
              placeholder="ابحث عن اسم المسؤول أو نائب المسؤول..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-4 space-y-4 mt-4">
        {filteredResponsables.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            لا توجد نتائج مطابقة للبحث
          </div>
        ) : (
          filteredResponsables.map((resp, index) => {
            const isExpanded = expandedId === `${resp.type}_${resp.name}`;
            const percent = resp.total === 0 ? 0 : Math.round((resp.voted / resp.total) * 100);
            
            return (
              <div key={index} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden transition-all hover:shadow-md">
                {/* Responsable Header Card */}
                <div 
                  className="p-4 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                  onClick={() => setExpandedId(isExpanded ? null : `${resp.type}_${resp.name}`)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="font-bold text-slate-800 text-lg">{resp.name}</h2>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        resp.type === 'Responsable' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {resp.type === 'Responsable' ? 'مسؤول' : 'نائب مسؤول'}
                      </span>
                    </div>
                    
                    {resp.phone && (
                      <a 
                        href={`tel:${resp.phone}`} 
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors mt-1"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        اتصال بالمسؤول
                      </a>
                    )}
                  </div>

                  {/* Stats Badges */}
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-center">
                      <div className="text-slate-400 text-xs">إجمالي</div>
                      <div className="font-bold text-slate-700">{resp.total}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-emerald-500 text-xs">صوتوا</div>
                      <div className="font-bold text-emerald-600">{resp.voted}</div>
                    </div>
                    <div className="text-center bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">
                      <div className="text-red-500 text-xs font-bold">باقي للاتصال</div>
                      <div className="font-black text-red-600 text-lg">{resp.nonVoted}</div>
                    </div>
                    
                    <div className="text-slate-400">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                {/* Progress Bar under header */}
                <div className="w-full bg-slate-100 h-1">
                  <div 
                    className="bg-blue-500 h-1 transition-all duration-1000" 
                    style={{ width: `${percent}%` }}
                  ></div>
                </div>

                {/* Expanded View: Non-voters List */}
                {isExpanded && (
                  <div className="bg-slate-50 border-t border-slate-100 p-4">
                    <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2 text-sm">
                      <UserX className="w-4 h-4 text-red-500" />
                      قائمة الناخبين الذين لم يصوتوا بعد ({resp.nonVoted}):
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {resp.voters.filter(v => !v.has_voted).map(voter => (
                        <div key={voter.id} className="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center shadow-sm">
                          <div>
                            <div className="font-semibold text-slate-800 text-sm">
                              {voter.nom} {voter.prenom}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              CIN: {voter.cin} • المكتب: {voter.bureau_name}
                            </div>
                          </div>
                          
                          {voter.telephone_electeur ? (
                            <a 
                              href={`tel:${voter.telephone_electeur}`}
                              className="w-10 h-10 rounded-full bg-green-100 hover:bg-green-200 text-green-700 flex items-center justify-center transition-colors shrink-0"
                            >
                              <Phone className="w-4 h-4" />
                            </a>
                          ) : (
                            <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-1 rounded-md">
                              لا يوجد رقم
                            </span>
                          )}
                        </div>
                      ))}
                      
                      {resp.nonVoted === 0 && (
                        <div className="col-span-full text-center py-6 text-emerald-600 bg-emerald-50 rounded-xl border border-emerald-100 font-medium text-sm">
                          🎉 أحسنت! جميع الناخبين التابعين لهذا المسؤول أتموا التصويت.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
