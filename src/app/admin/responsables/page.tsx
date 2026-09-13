'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, KeyRound, Loader2, Download, AlertTriangle, ShieldCheck } from 'lucide-react';

type Account = {
  type: string;
  responsable_name: string;
  pin: string;
};

export default function ResponsableAccountsPage() {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  const generateAccounts = async () => {
    if (!confirm('هل أنت متأكد؟ سيتم توليد أرقام سرية (PIN) جديدة لجميع المسؤولين والنواب.')) return;
    
    setLoading(true);
    setErrorMsg('');
    setAccounts([]);

    try {
      const res = await fetch('/api/responsable-accounts', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'حدث خطأ غير متوقع');
      
      const sorted = (data.accounts as Account[]).sort((a, b) => {
        if (a.type !== b.type) return a.type.localeCompare(b.type);
        return a.responsable_name.localeCompare(b.responsable_name);
      });
      setAccounts(sorted);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (accounts.length === 0) return;

    let csvContent = "\uFEFF";
    csvContent += "الصفة,الاسم,الرقم السري (PIN)\n";

    accounts.forEach(acc => {
      const type = `"${acc.type}"`;
      const name = `"${acc.responsable_name}"`;
      const pin = `"${acc.pin}"`;
      csvContent += `${type},${name},${pin}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `حسابات_المسؤولين_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20" dir="rtl">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-20 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
          <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors font-semibold mb-2">
            <ArrowRight className="w-4 h-4" />
            العودة لغرفة العمليات
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">إدارة حسابات المسؤولين</h1>
              <p className="text-xs text-slate-500">
                توليد أرقام سرية للمسؤولين والنواب للولوج إلى لوحة التتبع الخاصة بهم.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-4 mt-6 space-y-6">
        
        {/* Information Box */}
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 text-sm text-purple-800 leading-relaxed shadow-sm flex gap-4">
          <ShieldCheck className="w-8 h-8 text-purple-600 shrink-0" />
          <div>
            <h3 className="font-bold text-purple-900 mb-1">كيف تعمل هذه الخاصية؟</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>يقوم النظام بإنشاء حساب لكل مسؤول ونائب موجود في لوائح الناخبين.</li>
              <li>كل مسؤول سيحصل على لوحة تحكم خاصة به تمكنه من مراقبة وتتبع المصوتين التابعين له فقط.</li>
              <li>لا يمكن للمسؤولين تغيير حالة التصويت، دورهم يقتصر على المراقبة لتسهيل عملية التتبع.</li>
              <li>بمجرد إنشاء الأرقام السرية، يرجى تصديرها كملف إكسيل وتوزيعها على المسؤولين.</li>
            </ul>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-50 text-red-600 border border-red-200 p-4 rounded-xl text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            {errorMsg}
          </div>
        )}

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <button 
            onClick={generateAccounts}
            disabled={loading}
            className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                جاري توليد الحسابات (قد يستغرق دقائق)...
              </>
            ) : (
              <>
                <KeyRound className="w-5 h-5" />
                توليد حسابات لجميع المسؤولين
              </>
            )}
          </button>

          {accounts.length > 0 && (
            <button 
              onClick={exportToCSV}
              className="w-full sm:w-auto bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-slate-800/30 transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              تصدير الجدول (Excel)
            </button>
          )}
        </div>

        {/* Results Table */}
        {accounts.length > 0 && (
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
            <div className="bg-orange-50 border-b border-orange-200 p-3 text-center text-orange-800 text-xs font-bold flex items-center justify-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              يرجى تصدير هذا الجدول الآن وحفظه لتوزيع الأرقام على المسؤولين.
            </div>
            <div className="overflow-x-auto max-h-[60vh]">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-slate-500 font-bold sticky top-0 z-10 border-b border-slate-200 shadow-sm">
                  <tr>
                    <th className="px-6 py-4">#</th>
                    <th className="px-6 py-4">الصفة</th>
                    <th className="px-6 py-4">الاسم (المسؤول / النائب)</th>
                    <th className="px-6 py-4 text-center">الرقم السري (PIN)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {accounts.map((acc, index) => (
                    <tr key={index} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-slate-400 font-mono">{index + 1}</td>
                      <td className="px-6 py-4 font-bold text-slate-800">
                        <span className={`px-2 py-1 rounded-md text-xs ${acc.type === 'مسؤول' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                          {acc.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-800 font-bold">{acc.responsable_name}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-block bg-emerald-100 text-emerald-800 font-mono font-bold text-lg px-3 py-1 rounded-lg tracking-widest">
                          {acc.pin}
                        </span>
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
