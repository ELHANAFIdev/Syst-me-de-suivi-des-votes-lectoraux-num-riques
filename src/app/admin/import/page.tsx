'use client';

import { useState } from 'react';
import { UploadCloud, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function ImportVotersPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setMessage('');
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setMessage('');
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/import-voters', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'حدث خطأ أثناء رفع الملف');
      }

      setMessage(data.message || 'تم استيراد البيانات بنجاح!');
      setFile(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-6" dir="rtl">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Navigation */}
        <Link 
          href="/admin" 
          className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors font-semibold text-sm"
        >
          <ArrowRight className="w-4 h-4" />
          العودة لغرفة العمليات
        </Link>

        {/* Header */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">استيراد لوائح الناخبين</h1>
              <p className="text-slate-500 text-sm">
                قم برفع ملف Excel (.xlsx) يحتوي على اللوائح لتحديث قاعدة البيانات. 
                النظام ذكي ولن يقوم بمسح حالة التصويت السابقة.
              </p>
            </div>
          </div>
        </div>

        {/* Upload Area */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
          
          <label 
            className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all ${
              file ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
            }`}
          >
            <UploadCloud className={`w-12 h-12 mb-4 ${file ? 'text-blue-500' : 'text-slate-400'}`} />
            <h3 className="text-lg font-bold text-slate-700 mb-1">
              {file ? file.name : 'اختر ملف Excel أو اسحبه إلى هنا'}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              يجب أن يكون الملف بصيغة .xlsx ويحتوي على عمود CIN
            </p>
            
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              className="hidden" 
              onChange={handleFileChange}
            />
          </label>

          {/* Feedback Messages */}
          {error && (
            <div className="mt-6 flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl border border-red-100 text-sm font-semibold text-right">
              <AlertCircle className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}
          
          {message && (
            <div className="mt-6 flex items-center gap-2 text-emerald-600 bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-sm font-semibold text-right">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              {message}
            </div>
          )}

          {/* Submit Action */}
          <div className="mt-8">
            <button
              onClick={handleUpload}
              disabled={!file || loading}
              className="w-full sm:w-auto px-10 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mx-auto"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'بدء رفع البيانات'
              )}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
