'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase-client';
import Link from 'next/link';
import { ArrowRight, UserPlus, CheckCircle2, Loader2, Search, PlusCircle, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

type UniqueResponsable = {
  name: string;
  phone: string;
};

export default function AddVoterPage() {
  const router = useRouter();
  
  // Voter Data
  const [cin, setCin] = useState('');
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [telephoneElecteur, setTelephoneElecteur] = useState('');
  const [province, setProvince] = useState('');
  const [bureauNumber, setBureauNumber] = useState('');
  
  // Responsable Data
  const [responsable, setResponsable] = useState('');
  const [telephoneResponsable, setTelephoneResponsable] = useState('');
  
  // UI States
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Autocomplete States
  const [existingResponsables, setExistingResponsables] = useState<UniqueResponsable[]>([]);
  const [existingProvinces, setExistingProvinces] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchUniqueResponsables();
    
    // Click outside to close dropdown
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchUniqueResponsables = async () => {
    const { data, error } = await supabase
      .from('electeurs')
      .select('responsable, telephone_responsable, province');

    if (error || !data) return;

    const uniqueMap = new Map<string, UniqueResponsable>();
    const provSet = new Set<string>();

    data.forEach(v => {
      if (v.province) provSet.add(v.province);

      if (v.responsable) {
        const normalizedName = v.responsable.trim().toUpperCase();
        const safePhone = v.telephone_responsable || '';
        const key = `${normalizedName}_${safePhone}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, {
            name: normalizedName,
            phone: safePhone
          });
        }
      }
    });

    setExistingResponsables(Array.from(uniqueMap.values()));
    setExistingProvinces(Array.from(provSet));
  };

  const filteredResponsables = existingResponsables.filter(r => 
    r.name.toLowerCase().includes(responsable.toLowerCase()) || 
    r.phone.includes(responsable)
  );

  const handleSelectResponsable = (r: UniqueResponsable) => {
    setResponsable(r.name);
    setTelephoneResponsable(r.phone);
    setShowDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccess(false);

    if (!cin || !nom || !prenom || !province || !bureauNumber) {
      setErrorMsg('المرجو ملء جميع الحقول الأساسية (الاسم، البطاقة، المقاطعة، والمكتب).');
      setLoading(false);
      return;
    }

    // Construct Bureau Name exactly as expected in War Room
    const combinedBureauName = `مقاطعة ${province} - مكتب ${bureauNumber}`;

    const newVoter = {
      cin: cin.trim(),
      nom: nom.trim(),
      prenom: prenom.trim(),
      telephone_electeur: telephoneElecteur.trim(),
      bureau_name: combinedBureauName,
      province: province.trim(),
      has_voted: false,
      responsable: responsable.trim() || null,
      telephone_responsable: telephoneResponsable.trim() || null,
    };

    const { error } = await supabase
      .from('electeurs')
      .insert(newVoter);

    if (error) {
      console.error(error);
      if (error.code === '23505') {
        setErrorMsg('رقم البطاقة الوطنية (CIN) مسجل مسبقاً في النظام.');
      } else {
        setErrorMsg('حدث خطأ أثناء حفظ البيانات. المرجو المحاولة مجدداً.');
      }
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    
    // Reset form after 2 seconds
    setTimeout(() => {
      setSuccess(false);
      setCin('');
      setNom('');
      setPrenom('');
      setTelephoneElecteur('');
      setResponsable('');
      setTelephoneResponsable('');
      // Keep province and bureau to make multiple entries easier
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20" dir="rtl">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-20 border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
          <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors font-semibold mb-2">
            <ArrowRight className="w-4 h-4" />
            العودة لغرفة العمليات
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">إضافة ناخب جديد (إدخال يدوي)</h1>
              <p className="text-xs text-slate-500">
                إضافة ناخب أو مسؤول جديد وسينعكس فوراً في غرفة العمليات.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto p-4 mt-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-8 relative overflow-visible">
          
          {/* Section 1: Voter Info */}
          <div>
            <h2 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">البيانات الشخصية للناخب</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">رقم البطاقة (CIN) *</label>
                <input 
                  type="text" 
                  required
                  value={cin}
                  onChange={e => setCin(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-lg px-4 py-2.5 outline-none transition-all"
                  placeholder="مثال: AB123456"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">رقم هاتف الناخب</label>
                <input 
                  type="tel" 
                  value={telephoneElecteur}
                  onChange={e => setTelephoneElecteur(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-lg px-4 py-2.5 outline-none transition-all"
                  placeholder="مثال: 0600000000"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">الاسم العائلي *</label>
                <input 
                  type="text" 
                  required
                  value={nom}
                  onChange={e => setNom(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-lg px-4 py-2.5 outline-none transition-all"
                  placeholder="الاسم العائلي"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">الاسم الشخصي *</label>
                <input 
                  type="text" 
                  required
                  value={prenom}
                  onChange={e => setPrenom(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-lg px-4 py-2.5 outline-none transition-all"
                  placeholder="الاسم الشخصي"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Voting Info */}
          <div>
            <h2 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">بيانات التصويت</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">المقاطعة *</label>
                <input 
                  type="text" 
                  required
                  list="provinces-list"
                  value={province}
                  onChange={e => setProvince(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-lg px-4 py-2.5 outline-none transition-all"
                  placeholder="ابحث أو اكتب اسم المقاطعة..."
                />
                <datalist id="provinces-list">
                  {existingProvinces.map((prov, idx) => (
                    <option key={idx} value={prov} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">رقم المكتب *</label>
                <input 
                  type="number" 
                  required
                  value={bureauNumber}
                  onChange={e => setBureauNumber(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-lg px-4 py-2.5 outline-none transition-all"
                  placeholder="مثال: 11"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Responsable (Autocomplete) */}
          <div className="relative z-10" ref={dropdownRef}>
            <h2 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100 flex items-center justify-between">
              تعيين مسؤول للناخب (اختياري)
              <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-1 rounded-md">ميزة ذكية 🧠</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
              <div className="relative">
                <label className="block text-sm font-semibold text-slate-700 mb-1">اسم المسؤول</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={responsable}
                    onChange={e => {
                      setResponsable(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-lg px-4 py-2.5 pr-10 outline-none transition-all"
                    placeholder="ابحث عن مسؤول موجود أو اكتب اسماً جديداً..."
                  />
                  <Search className="w-5 h-5 text-slate-400 absolute top-3 right-3 pointer-events-none" />
                </div>
                
                {/* Autocomplete Dropdown */}
                {showDropdown && responsable.trim() !== '' && (
                  <div className="absolute top-full right-0 w-full mt-1 bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden z-50 max-h-60 overflow-y-auto">
                    {filteredResponsables.length > 0 ? (
                      <ul className="py-2">
                        {filteredResponsables.map((r, idx) => (
                          <li 
                            key={idx}
                            onClick={() => handleSelectResponsable(r)}
                            className="px-4 py-3 hover:bg-blue-50 cursor-pointer flex justify-between items-center transition-colors border-b border-slate-50 last:border-0"
                          >
                            <span className="font-bold text-slate-800">{r.name}</span>
                            <span className="text-sm font-mono text-blue-600 bg-blue-100 px-2 py-0.5 rounded-md">{r.phone}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="p-4 text-center text-sm text-slate-500">
                        <PlusCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        غير موجود! استمر في الكتابة لإضافة "{responsable}" كمسؤول جديد.
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">رقم هاتف المسؤول {responsable && '*'}</label>
                <input 
                  type="tel" 
                  required={!!responsable.trim()}
                  value={telephoneResponsable}
                  onChange={e => setTelephoneResponsable(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-lg px-4 py-2.5 outline-none transition-all"
                  placeholder="مثال: 0600000000"
                />
                {responsable && !telephoneResponsable && (
                  <p className="text-xs text-orange-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> يرجى إدخال رقم الهاتف لضمان عدم تداخل الأسماء
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Messages */}
          {errorMsg && (
            <div className="bg-red-50 text-red-600 border border-red-200 p-4 rounded-xl text-sm font-semibold flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {errorMsg}
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 text-emerald-600 border border-emerald-200 p-4 rounded-xl text-sm font-bold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              تم إدراج الناخب بنجاح! وسينعكس فوراً في غرفة العمليات.
            </div>
          )}

          {/* Submit */}
          <div className="pt-4 border-t border-slate-100">
            <button 
              type="submit" 
              disabled={loading || success}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  جاري الحفظ...
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  تم الحفظ بنجاح
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  حفظ الناخب في قاعدة البيانات
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
