import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function GET() {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'الرجاء إضافة مفاتيح Supabase في ملف .env.local' }, { status: 500 });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  try {
    // Delete all voters (Service Role bypasses RLS)
    const { error } = await supabaseAdmin
      .from('electeurs')
      .delete()
      .not('id', 'is', null); // This acts as a catch-all filter to delete everything

    if (error) {
      throw error;
    }

    return NextResponse.json({ 
      success: true, 
      message: 'تم مسح جميع لوائح الناخبين القديمة بنجاح! يمكنك الآن العودة لمنصة الأدمين ورفع ملف الإكسيل الجديد بحرية.' 
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
