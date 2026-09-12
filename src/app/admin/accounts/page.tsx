'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, KeyRound, Loader2, Download, AlertTriangle, ShieldCheck } from 'lucide-react';

type Account = {
  province: string;
  bureau_name: string;
  pin: string;
};

export default function AccountsManagementPage() {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  const generateAccounts = async () => {
    if (!confirm('هل أنت متأكد؟ سيتم توليد أرقام سرية (PIN) جديدة لجميع المكاتب، وسيفقد أي رقم سري قديم صلاحيته فوراً.')) return;
    
    setLoading(true);
    setErrorMsg('');
    setAccounts([]);

    try {
      const res = await fetch('/api/bureau-accounts', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'حدث خطأ غير متوقع');
      
      // Sort alphabetically by province then bureau name
      const sorted = (data.accounts as Account[]).sort((a, b) => a.bureau_name.localeCompare(b.bureau_name));
      setAccounts(sorted);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (accounts.length === 0) return;

    // Add UTF-8 BOM so Excel opens it correctly with Arabic
    let csvContent = "\uFEFF";
    csvContent += "المقاطعة,اسم المكتب,الرقم السري (PIN)\n";

    accounts.forEach(acc => {
      // Escape quotes if any
      const prov = `"${acc.province}"`;
      const bureau = `"${acc.bureau_name}"`;
      const pin = `"${acc.pin}"`;
      csvContent += `${prov},${bureau},${pin}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `حسابات_مكاتب_التصويت_${new Date().toISOString().split('T')[0]}.csv`);
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
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">إدارة الأرقام السرية (PIN) للمكاتب</h1>
              <p className="text-xs text-slate-500">
                توليد حسابات آمنة للمكاتب وطباعتها لتوزيعها يوم التصويت.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-4 mt-6 space-y-6">
        
        {/* Information Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-sm text-blue-800 leading-relaxed shadow-sm flex gap-4">
          <ShieldCheck className="w-8 h-8 text-blue-600 shrink-0" />
          <div>
            <h3 className="font-bold text-blue-900 mb-1">كيف تعمل هذه الخاصية؟</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>يقوم النظام بالبحث عن جميع المكاتب الموجودة في قوائم الناخبين.</li>
              <li>يتم توليد <strong>رقم سري عشوائي من 6 أرقام</strong> لكل مكتب.</li>
              <li>هذه الأرقام لا تحفظ بشكل مكشوف في قاعدة البيانات (لأسباب أمنية).</li>
              <li>يجب عليك تصدير الجدول فور توليده وطباعته في أوراق لمدراء المكاتب.</li>
              <li>إذا أضاع مدير المكتب رقمه، يمكنك الضغط على زر التوليد مجدداً ليتم تغيير أرقام الجميع فوراً.</li>
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
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                جاري توليد الحسابات (قد يستغرق دقائق)...
              </>
            ) : (
              <>
                <KeyRound className="w-5 h-5" />
                توليد جميع الأرقام السرية الآن
              </>
            )}
          </button>

          {accounts.length > 0 && (
            <button 
              onClick={exportToCSV}
              className="w-full sm:w-auto bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-slate-800/30 transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              تصدير الجدول (Excel) للطباعة
            </button>
          )}
        </div>

        {/* Results Table */}
        {accounts.length > 0 && (
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
            <div className="bg-orange-50 border-b border-orange-200 p-3 text-center text-orange-800 text-xs font-bold flex items-center justify-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              يرجى تصدير هذا الجدول الآن. لن تتمكن من استعادته لاحقاً إلا بتوليد أرقام جديدة!
            </div>
            <div className="overflow-x-auto max-h-[60vh]">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-slate-500 font-bold sticky top-0 z-10 border-b border-slate-200 shadow-sm">
                  <tr>
                    <th className="px-6 py-4">#</th>
                    <th className="px-6 py-4">المقاطعة</th>
                    <th className="px-6 py-4">اسم المكتب (كما يظهر للرئيس)</th>
                    <th className="px-6 py-4 text-center">الرقم السري (PIN)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {accounts.map((acc, index) => (
                    <tr key={index} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-slate-400 font-mono">{index + 1}</td>
                      <td className="px-6 py-4 font-bold text-slate-800">{acc.province}</td>
                      <td className="px-6 py-4 text-slate-600">{acc.bureau_name}</td>
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
