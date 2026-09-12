'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase-client';
import { Search, Phone, UserX, ChevronDown, ChevronUp, Loader2, PhoneCall, ArrowRight } from 'lucide-react';
import Link from 'next/link';

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
  bureau_name: string;
  province?: string;
};

type ViceResponsable = {
  name: string;
  phone: string;
  voters: Voter[];
};

type ResponsableStat = {
  name: string;
  phone: string;
  total: number;
  voted: number;
  nonVoted: number;
  allVoters: Voter[];
  vices: ViceResponsable[];
};

export default function TrackingBoard() {
  const [allVoters, setAllVoters] = useState<Voter[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedVices, setExpandedVices] = useState<Record<string, boolean>>({});

  const toggleVice = (viceKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedVices(prev => ({ ...prev, [viceKey]: !prev[viceKey] }));
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    let allData: any[] = [];
    let from = 0;
    const step = 1000;
    
    while (true) {
      const { data, error } = await supabase
        .from('electeurs')
        .select('*')
        .range(from, from + step - 1);

      if (error) {
        console.error('Error fetching voters:', error);
        break;
      }
      
      if (data) {
        allData = [...allData, ...data];
        if (data.length < step) break;
      } else {
        break;
      }
      from += step;
    }
    
    setAllVoters(allData as Voter[]);
    setLoading(false);
  };

  // Group voters by Responsable (with Vice nested)
  const responsablesList = useMemo(() => {
    const map = new Map<string, {
      name: string;
      phone: string;
      total: number;
      voted: number;
      nonVoted: number;
      allVoters: Voter[];
      vicesMap: Map<string, ViceResponsable>;
    }>();

    allVoters.forEach(v => {
      // Determine top-level name
      const respName = v.responsable ? v.responsable.trim().toUpperCase() : (v.sous_responsable ? v.sous_responsable.trim().toUpperCase() : null);
      if (!respName) return; // Skip if no responsable and no sous_responsable

      const key = `resp_${respName}`;

      if (!map.has(key)) {
        const initialPhone = v.responsable ? v.telephone_responsable : v.telephone_sous_responsable;
        map.set(key, {
          name: respName,
          phone: initialPhone || '',
          total: 0,
          voted: 0,
          nonVoted: 0,
          allVoters: [],
          vicesMap: new Map<string, ViceResponsable>()
        });
      }

      const r = map.get(key)!;
      r.total++;
      if (v.has_voted) r.voted++; else r.nonVoted++;
      r.allVoters.push(v);
      
      // Update phone if it was missing previously
      if (!r.phone) {
        r.phone = (v.responsable ? v.telephone_responsable : v.telephone_sous_responsable) || '';
      }

      // If the top level is the responsable, and they have a distinct vice
      if (v.responsable && v.sous_responsable && v.sous_responsable.trim().toUpperCase() !== respName) {
        const viceName = v.sous_responsable.trim().toUpperCase();
        const viceKey = `vice_${viceName}`;
        if (!r.vicesMap.has(viceKey)) {
          r.vicesMap.set(viceKey, {
            name: viceName,
            phone: v.telephone_sous_responsable || '',
            voters: []
          });
        } else if (!r.vicesMap.get(viceKey)!.phone && v.telephone_sous_responsable) {
          r.vicesMap.get(viceKey)!.phone = v.telephone_sous_responsable;
        }
        r.vicesMap.get(viceKey)!.voters.push(v);
      }
    });

    return Array.from(map.values()).map(r => ({
      name: r.name,
      phone: r.phone,
      total: r.total,
      voted: r.voted,
      nonVoted: r.nonVoted,
      allVoters: r.allVoters,
      vices: Array.from(r.vicesMap.values())
    })).sort((a, b) => b.nonVoted - a.nonVoted);
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
            <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors mb-2 font-semibold">
              <ArrowRight className="w-4 h-4" />
              العودة لغرفة العمليات
            </Link>
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
            const isExpanded = expandedId === resp.name;
            const percent = resp.total === 0 ? 0 : Math.round((resp.voted / resp.total) * 100);
            
            return (
              <div key={index} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden transition-all hover:shadow-md">
                {/* Responsable Header Card */}
                <div 
                  className="p-4 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                  onClick={() => setExpandedId(isExpanded ? null : resp.name)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="font-bold text-slate-800 text-lg">{resp.name}</h2>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-100 text-purple-700">
                        مسؤول
                      </span>
                    </div>
                    
                    {resp.phone && (
                      <a 
                        href={`tel:${resp.phone}`} 
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors mt-2"
                      >
                        <PhoneCall className="w-4 h-4" />
                        <span className="font-mono text-[14px] tracking-wide" dir="ltr">{resp.phone}</span>
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

                {/* Expanded View: Vices and Non-voters List */}
                {isExpanded && (
                  <div className="bg-slate-50 border-t border-slate-100 p-4 space-y-6">
                    
                    {/* Vices Section */}
                    {resp.vices.length > 0 && (
                      <div>
                        <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2 text-sm">
                          <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded-md text-xs font-bold">نواب المسؤول</span>
                          نواب هذا المسؤول ({resp.vices.length}):
                        </h3>
                        <div className="grid grid-cols-1 gap-4">
                          {resp.vices.map(vice => {
                            const viceNonVoters = vice.voters.filter(v => !v.has_voted);
                            const viceKey = `vice_${resp.name}_${vice.name}`;
                            const isViceExpanded = !!expandedVices[viceKey];

                            return (
                              <div key={vice.name} className="bg-orange-50/30 border border-orange-200/60 rounded-xl overflow-hidden shadow-sm">
                                {/* Vice Header */}
                                <div 
                                  className="p-3 bg-orange-50/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 cursor-pointer hover:bg-orange-100/80 transition-colors"
                                  onClick={(e) => toggleVice(viceKey, e)}
                                >
                                  <div className="flex items-start sm:items-center gap-3">
                                    <div className="text-orange-500 mt-1 sm:mt-0">
                                      {isViceExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                    </div>
                                    <div>
                                      <div className="text-sm font-bold text-orange-900">{vice.name}</div>
                                      <div className="text-xs text-orange-700/80 mt-1">
                                        ناخبين تحت إشرافه: {vice.voters.length} (باقي {viceNonVoters.length} لم يصوتوا)
                                      </div>
                                    </div>
                                  </div>
                                  {vice.phone && (
                                    <a 
                                      href={`tel:${vice.phone}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-1.5 text-orange-700 bg-orange-100 hover:bg-orange-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors mt-2 sm:mt-0"
                                    >
                                      <PhoneCall className="w-3.5 h-3.5" />
                                      <span className="font-mono text-[13px] tracking-wide" dir="ltr">{vice.phone}</span>
                                    </a>
                                  )}
                                </div>
                                
                                {/* Vice Voters List */}
                                {isViceExpanded && viceNonVoters.length > 0 && (
                                  <div className="p-3 bg-white/50 border-t border-orange-100/50">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                      {viceNonVoters.map(voter => (
                                        <div key={voter.id} className="bg-white p-2.5 rounded-lg border border-slate-200 flex justify-between items-center shadow-sm">
                                          <div>
                                            <div className="font-semibold text-slate-800 text-xs">
                                              {voter.nom} {voter.prenom}
                                            </div>
                                            <div className="text-[10px] text-slate-500 mt-0.5">
                                              CIN: {voter.cin} • المكتب: {voter.bureau_name}
                                            </div>
                                          </div>
                                          {voter.telephone_electeur && (
                                            <a 
                                              href={`tel:${voter.telephone_electeur}`}
                                              onClick={(e) => e.stopPropagation()}
                                              className="inline-flex items-center gap-1.5 bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1.5 rounded-md transition-colors shrink-0"
                                            >
                                              <Phone className="w-3 h-3" />
                                              <span className="font-mono text-[11px] tracking-wide font-bold" dir="ltr">{voter.telephone_electeur}</span>
                                            </a>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {isViceExpanded && viceNonVoters.length === 0 && (
                                  <div className="p-4 bg-white/50 border-t border-orange-100/50 text-center text-xs text-emerald-600 font-bold">
                                    جميع الناخبين تحت إشراف هذا النائب أتموا التصويت! 🎉
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Non-Voters List */}
                    <div>
                      <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2 text-sm">
                        <UserX className="w-4 h-4 text-red-500" />
                        قائمة الناخبين الذين لم يصوتوا بعد ({resp.nonVoted}):
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {resp.allVoters
                          .filter(v => !v.has_voted && (!v.sous_responsable || v.sous_responsable.trim().toUpperCase() === resp.name))
                          .map(voter => (
                          <div key={voter.id} className="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center shadow-sm relative overflow-hidden">
                            <div className="pr-2">
                              <div className="font-semibold text-slate-800 text-sm">
                                {voter.nom} {voter.prenom}
                              </div>
                              <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                                <div>CIN: {voter.cin} • المكتب: {voter.bureau_name}</div>
                              </div>
                            </div>
                            
                            {voter.telephone_electeur ? (
                              <a 
                                href={`tel:${voter.telephone_electeur}`}
                                className="inline-flex items-center gap-1.5 bg-green-100 hover:bg-green-200 text-green-700 px-2.5 py-1.5 rounded-lg transition-colors shrink-0 z-10"
                              >
                                <Phone className="w-3.5 h-3.5" />
                                <span className="font-mono text-xs tracking-wide font-bold" dir="ltr">{voter.telephone_electeur}</span>
                              </a>
                            ) : (
                              <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-1 rounded-md z-10">
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
